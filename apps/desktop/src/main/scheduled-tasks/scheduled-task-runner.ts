import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { AUTO_BUILD_PATHS, getSpecsDir } from '../../shared/constants';
import type { Project, Task, TaskMetadata } from '../../shared/types';
import type { ScheduledTaskDefinition } from '../../shared/types/scheduled-task';
import type { AgentManager } from '../agent';
import { projectStore } from '../project-store';
import { writeFileAtomicSyncWithRetry } from '../utils/atomic-file';

function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);

  return slug || 'scheduled-task';
}

function updateTaskPlanStatus(task: Task, status: Task['status']): void {
  if (!task.specsPath) return;

  const planPath = path.join(task.specsPath, AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN);
  const plan = JSON.parse(readFileSync(planPath, 'utf-8')) as Record<string, unknown>;
  writeFileAtomicSyncWithRetry(
    planPath,
    JSON.stringify({
      ...plan,
      status,
      updated_at: new Date().toISOString(),
    }, null, 2),
    { encoding: 'utf-8' }
  );
  projectStore.invalidateTasksCache(task.projectId);
}

function getNextSpecId(project: Project, title: string): { specId: string; specDir: string } {
  const specsBaseDir = getSpecsDir(project.autoBuildPath);
  const specsDir = path.join(project.path, specsBaseDir);
  mkdirSync(specsDir, { recursive: true });

  const existingNumbers = readdirSync(specsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name.match(/^(\d+)/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value > 0);

  const specNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  const specId = `${String(specNumber).padStart(3, '0')}-${slugifyTitle(title)}`;
  return { specId, specDir: path.join(specsDir, specId) };
}

export function createTaskFromSchedule(schedule: ScheduledTaskDefinition): Task {
  const project = projectStore.getProject(schedule.projectId);
  if (!project) {
    throw new Error('scheduledTasks.errors.projectUnavailable');
  }

  const { specId, specDir } = getNextSpecId(project, schedule.name);
  mkdirSync(specDir, { recursive: true });

  const now = new Date().toISOString();
  const metadata: TaskMetadata = {
    sourceType: 'manual',
    category: 'feature',
    rationale: 'tasks:metadata.scheduledTaskRationale',
    scheduledTaskName: schedule.name,
  };

  writeFileAtomicSyncWithRetry(
    path.join(specDir, AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN),
    JSON.stringify({
      feature: schedule.name,
      description: schedule.prompt,
      created_at: now,
      updated_at: now,
      status: 'pending',
      phases: [],
    }, null, 2),
    { encoding: 'utf-8' }
  );

  writeFileAtomicSyncWithRetry(
    path.join(specDir, 'task_metadata.json'),
    JSON.stringify(metadata, null, 2),
    { encoding: 'utf-8' }
  );

  writeFileAtomicSyncWithRetry(
    path.join(specDir, AUTO_BUILD_PATHS.REQUIREMENTS),
    JSON.stringify({
      task_description: schedule.prompt,
      workflow_type: 'feature',
      scheduled_task_id: schedule.id,
      scheduled_task_name: schedule.name,
    }, null, 2),
    { encoding: 'utf-8' }
  );

  projectStore.invalidateTasksCache(schedule.projectId);

  return {
    id: specId,
    specId,
    projectId: schedule.projectId,
    title: schedule.name,
    description: schedule.prompt,
    status: 'backlog',
    subtasks: [],
    logs: [],
    metadata,
    specsPath: specDir,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
}

export async function startScheduledTask(agentManager: AgentManager, task: Task): Promise<void> {
  const project = projectStore.getProject(task.projectId);
  if (!project) {
    throw new Error('scheduledTasks.errors.projectUnavailable');
  }

  if (agentManager.isRunning(task.id)) {
    return;
  }

  const maxParallelTasks = project.settings.maxParallelTasks ?? 3;
  const inProgressCount = projectStore.getTasks(task.projectId).filter((candidate) => (
    candidate.status === 'in_progress' && !candidate.metadata?.archivedAt && candidate.id !== task.id
  )).length;
  if (inProgressCount >= maxParallelTasks) {
    updateTaskPlanStatus(task, 'queue');
    return;
  }

  await agentManager.startSpecCreation(
    task.id,
    project.path,
    task.description,
    task.specsPath,
    task.metadata,
    undefined,
    task.projectId
  );
}
