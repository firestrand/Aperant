import { ipcRenderer } from 'electron';

import { IPC_CHANNELS } from '../../shared/constants';
import type {
  CreateScheduledTaskInput,
  IPCResult,
  ScheduledTaskDefinition,
  UpdateScheduledTaskInput,
} from '../../shared/types';

export interface ScheduledTasksAPI {
  listScheduledTasks: () => Promise<IPCResult<ScheduledTaskDefinition[]>>;
  createScheduledTask: (input: CreateScheduledTaskInput) => Promise<IPCResult<ScheduledTaskDefinition>>;
  updateScheduledTask: (scheduleId: string, input: UpdateScheduledTaskInput) => Promise<IPCResult<ScheduledTaskDefinition>>;
  deleteScheduledTask: (scheduleId: string) => Promise<IPCResult<void>>;
  fireScheduledTaskNow: (scheduleId: string) => Promise<IPCResult<ScheduledTaskDefinition>>;
}

export const createScheduledTasksAPI = (): ScheduledTasksAPI => ({
  listScheduledTasks: (): Promise<IPCResult<ScheduledTaskDefinition[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SCHEDULED_TASKS_LIST),
  createScheduledTask: (input: CreateScheduledTaskInput): Promise<IPCResult<ScheduledTaskDefinition>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SCHEDULED_TASKS_CREATE, input),
  updateScheduledTask: (scheduleId: string, input: UpdateScheduledTaskInput): Promise<IPCResult<ScheduledTaskDefinition>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SCHEDULED_TASKS_UPDATE, scheduleId, input),
  deleteScheduledTask: (scheduleId: string): Promise<IPCResult<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SCHEDULED_TASKS_DELETE, scheduleId),
  fireScheduledTaskNow: (scheduleId: string): Promise<IPCResult<ScheduledTaskDefinition>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SCHEDULED_TASKS_FIRE_NOW, scheduleId),
});
