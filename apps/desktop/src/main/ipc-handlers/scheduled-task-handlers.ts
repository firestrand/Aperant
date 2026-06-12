import { app, ipcMain } from 'electron';

import { DEFAULT_APP_SETTINGS, IPC_CHANNELS } from '../../shared/constants';
import type {
  CreateScheduledTaskInput,
  IPCResult,
  ScheduledTaskDefinition,
  UpdateScheduledTaskInput,
} from '../../shared/types';
import type { AgentManager } from '../agent';
import { projectStore } from '../project-store';
import { readSettingsFile } from '../settings-utils';
import { ScheduledTaskService, getScheduledTasksStoragePath } from '../scheduled-tasks/scheduled-task-service';
import { createTaskFromSchedule, startScheduledTask } from '../scheduled-tasks/scheduled-task-runner';

function success<T>(data: T): IPCResult<T> {
  return { success: true, data };
}

function failure(error: unknown): IPCResult<never> {
  return { success: false, error: error instanceof Error ? error.message : String(error) };
}

function isScheduledTasksEnabled(): boolean {
  const settings = { ...DEFAULT_APP_SETTINGS, ...readSettingsFile() };
  return settings.scheduledTasksEnabled === true;
}

const SCHEDULED_TASK_POLL_INTERVAL_MS = 60_000;
let runtimeInterval: NodeJS.Timeout | null = null;
let runtimeTickInFlight = false;

export function stopScheduledTaskRuntime(): void {
  if (!runtimeInterval) {
    return;
  }

  clearInterval(runtimeInterval);
  runtimeInterval = null;
  runtimeTickInFlight = false;
}

function getService(agentManager: AgentManager): ScheduledTaskService {
  return new ScheduledTaskService({
    storagePath: getScheduledTasksStoragePath(app.getPath('userData')),
    isEnabled: isScheduledTasksEnabled,
    projectExists: (projectId) => Boolean(projectStore.getProject(projectId)),
    createTask: async (schedule) => {
      const task = createTaskFromSchedule(schedule);
      return { taskId: task.id };
    },
    startTask: async (taskId, schedule) => {
      const task = projectStore.getTasks(schedule.projectId).find((candidate) => candidate.id === taskId);
      if (!task) {
        throw new Error('scheduledTasks.errors.createdTaskUnavailable');
      }
      await startScheduledTask(agentManager, task);
    },
  });
}

async function loadService(agentManager: AgentManager): Promise<ScheduledTaskService> {
  const service = getService(agentManager);
  await service.load();
  return service;
}

export function startScheduledTaskRuntime(agentManager: AgentManager): void {
  if (!isScheduledTasksEnabled() || runtimeInterval) {
    return;
  }

  const runTick = async () => {
    if (!isScheduledTasksEnabled()) {
      stopScheduledTaskRuntime();
      return;
    }

    if (runtimeTickInFlight) {
      return;
    }
    runtimeTickInFlight = true;
    try {
      const service = await loadService(agentManager);
      await service.tick();
    } catch (error) {
      console.warn('[ScheduledTasks] Runtime tick failed:', error);
    } finally {
      runtimeTickInFlight = false;
    }
  };

  runtimeInterval = setInterval(() => {
    void runTick();
  }, SCHEDULED_TASK_POLL_INTERVAL_MS);

  void runTick();
}

export function registerScheduledTaskHandlers(agentManager: AgentManager): void {
  if (isScheduledTasksEnabled()) {
    startScheduledTaskRuntime(agentManager);
  }
  ipcMain.handle(IPC_CHANNELS.SCHEDULED_TASKS_LIST, async (): Promise<IPCResult<ScheduledTaskDefinition[]>> => {
    try {
      if (!isScheduledTasksEnabled()) {
        stopScheduledTaskRuntime();
        return success([]);
      }
      startScheduledTaskRuntime(agentManager);
      const service = await loadService(agentManager);
      return success(service.list());
    } catch (error) {
      return failure(error);
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.SCHEDULED_TASKS_CREATE,
    async (_event, input: CreateScheduledTaskInput): Promise<IPCResult<ScheduledTaskDefinition>> => {
      try {
        if (!isScheduledTasksEnabled()) {
          throw new Error('scheduledTasks.errors.disabled');
        }
        startScheduledTaskRuntime(agentManager);
        const service = await loadService(agentManager);
        return success(await service.create(input));
      } catch (error) {
        return failure(error);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SCHEDULED_TASKS_UPDATE,
    async (_event, scheduleId: string, input: UpdateScheduledTaskInput): Promise<IPCResult<ScheduledTaskDefinition>> => {
      try {
        if (!isScheduledTasksEnabled()) {
          throw new Error('scheduledTasks.errors.disabled');
        }
        startScheduledTaskRuntime(agentManager);
        const service = await loadService(agentManager);
        return success(await service.update(scheduleId, input));
      } catch (error) {
        return failure(error);
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.SCHEDULED_TASKS_DELETE, async (_event, scheduleId: string): Promise<IPCResult<void>> => {
    try {
      if (!isScheduledTasksEnabled()) {
        throw new Error('scheduledTasks.errors.disabled');
      }
      startScheduledTaskRuntime(agentManager);
      const service = await loadService(agentManager);
      await service.remove(scheduleId);
      return success(undefined);
    } catch (error) {
      return failure(error);
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.SCHEDULED_TASKS_FIRE_NOW,
    async (_event, scheduleId: string): Promise<IPCResult<ScheduledTaskDefinition>> => {
      try {
        if (!isScheduledTasksEnabled()) {
          throw new Error('scheduledTasks.errors.disabled');
        }
        startScheduledTaskRuntime(agentManager);
        const service = await loadService(agentManager);
        return success(await service.fireNow(scheduleId));
      } catch (error) {
        return failure(error);
      }
    }
  );
}
