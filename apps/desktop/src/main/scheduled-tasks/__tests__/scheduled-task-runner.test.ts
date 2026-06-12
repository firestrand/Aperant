import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const projectStoreMock = vi.hoisted(() => ({
  project: undefined as import('../../../shared/types').Project | undefined,
  tasks: [] as import('../../../shared/types').Task[],
  invalidateTasksCache: vi.fn(),
}));

vi.mock('../../project-store', () => ({
  projectStore: {
    getProject: vi.fn((projectId: string) => projectStoreMock.project?.id === projectId ? projectStoreMock.project : undefined),
    getTasks: vi.fn(() => projectStoreMock.tasks),
    invalidateTasksCache: projectStoreMock.invalidateTasksCache,
  },
}));

import type { ScheduledTaskDefinition } from '../../../shared/types/scheduled-task';
import type { AgentManager } from '../../agent';
import type { Task } from '../../../shared/types';
import { createTaskFromSchedule, startScheduledTask } from '../scheduled-task-runner';

function schedule(overrides: Partial<ScheduledTaskDefinition> = {}): ScheduledTaskDefinition {
  return {
    id: 'schedule-1',
    projectId: 'project-1',
    name: 'Daily Planning',
    prompt: 'Plan the next feature',
    recurrence: { kind: 'daily', timeOfDay: '09:00' },
    enabled: true,
    autoStart: false,
    ...overrides,
  };
}

function createAgentManagerStub(runningTasks: string[] = []): AgentManager {
  return {
    isRunning: vi.fn(() => false),
    getRunningTasks: vi.fn(() => runningTasks),
    startSpecCreation: vi.fn(async () => undefined),
  } as unknown as AgentManager;
}

function projectSettings() {
  return {
    memoryBackend: 'file' as const,
    linearSync: false,
    notifications: {
      onTaskComplete: true,
      onTaskFailed: true,
      onReviewNeeded: true,
      sound: false,
    },
    useClaudeMd: true,
  };
}

describe('createTaskFromSchedule', () => {
  beforeEach(() => {
    projectStoreMock.project = undefined;
    projectStoreMock.tasks = [];
    projectStoreMock.invalidateTasksCache.mockClear();
  });

  it('creates a normal Aperant task spec from a schedule', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'aperant-scheduled-project-'));
    await mkdir(join(projectDir, '.auto-claude', 'specs'), { recursive: true });
    projectStoreMock.project = {
      id: 'project-1',
      name: 'Project',
      path: projectDir,
      autoBuildPath: '',
      settings: projectSettings(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const task = createTaskFromSchedule(schedule());

    expect(task.id).toMatch(/^001-daily-planning$/);
    expect(task.status).toBe('backlog');
    expect(task.description).toBe('Plan the next feature');
    expect(projectStoreMock.invalidateTasksCache).toHaveBeenCalledWith('project-1');
    expect(task.metadata?.rationale).toBe('tasks:metadata.scheduledTaskRationale');
    expect(task.metadata?.scheduledTaskName).toBe('Daily Planning');

    expect(task.specsPath).toBeDefined();
    const specsPath = task.specsPath!;
    const plan = JSON.parse(await readFile(join(specsPath, 'implementation_plan.json'), 'utf-8')) as { feature: string; status: string };
    expect(plan).toMatchObject({ feature: 'Daily Planning', status: 'pending' });

    const metadata = JSON.parse(await readFile(join(specsPath, 'task_metadata.json'), 'utf-8')) as { rationale: string; scheduledTaskName: string };
    expect(metadata).toMatchObject({
      rationale: 'tasks:metadata.scheduledTaskRationale',
      scheduledTaskName: 'Daily Planning',
    });

    const requirements = JSON.parse(await readFile(join(specsPath, 'requirements.json'), 'utf-8')) as { scheduled_task_id: string };
    expect(requirements.scheduled_task_id).toBe('schedule-1');
  });

  it('throws when the target project is unavailable', () => {
    expect(() => createTaskFromSchedule(schedule({ projectId: 'missing' }))).toThrow('scheduledTasks.errors.projectUnavailable');
  });
});

describe('startScheduledTask', () => {
  beforeEach(() => {
    projectStoreMock.tasks = [];
    projectStoreMock.invalidateTasksCache.mockClear();
    projectStoreMock.project = {
      id: 'project-1',
      name: 'Project',
      path: '/tmp/project',
      autoBuildPath: '',
      settings: { ...projectSettings(), maxParallelTasks: 1 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  it('queues instead of auto-starting when the project max parallel task limit is reached', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'aperant-scheduled-queue-'));
    const specsPath = join(projectDir, '.auto-claude', 'specs', 'task-1');
    await mkdir(specsPath, { recursive: true });
    await writeFile(
      join(specsPath, 'implementation_plan.json'),
      JSON.stringify({ feature: 'Scheduled task', status: 'pending', updated_at: '2026-01-01T00:00:00.000Z' })
    );

    projectStoreMock.project = {
      ...projectStoreMock.project!,
      path: projectDir,
    };
    projectStoreMock.tasks = [{
      id: 'already-running',
      specId: 'already-running',
      projectId: 'project-1',
      title: 'Already running',
      description: 'Running',
      status: 'in_progress',
      subtasks: [],
      logs: [],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }];

    const task: Task = {
      id: 'task-1',
      specId: 'task-1',
      projectId: 'project-1',
      title: 'Scheduled task',
      description: 'Run me',
      status: 'backlog',
      subtasks: [],
      logs: [],
      metadata: {},
      specsPath,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const agentManager = createAgentManagerStub(['already-running']);

    await startScheduledTask(agentManager, task);

    const plan = JSON.parse(await readFile(join(specsPath, 'implementation_plan.json'), 'utf-8')) as { status: string };
    expect(plan.status).toBe('queue');
    expect(projectStoreMock.invalidateTasksCache).toHaveBeenCalledWith('project-1');
    expect(agentManager.startSpecCreation).not.toHaveBeenCalled();
  });
});
