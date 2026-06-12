import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

import type {
  CreateScheduledTaskInput,
  ScheduledTaskDefinition,
  ScheduledTaskRecurrence,
  UpdateScheduledTaskInput,
} from '../../shared/types/scheduled-task';
import { writeJsonWithRetry } from '../utils/atomic-file';

interface ScheduledTaskStore {
  schedules: ScheduledTaskDefinition[];
}

export interface ScheduledTaskServiceOptions {
  storagePath: string;
  isEnabled: () => boolean;
  projectExists: (projectId: string) => boolean;
  createTask: (schedule: ScheduledTaskDefinition) => Promise<{ taskId: string }>;
  startTask?: (taskId: string, schedule: ScheduledTaskDefinition) => Promise<void>;
  now?: () => Date;
}

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SCHEDULED_TASK_ERROR_PREFIX = 'scheduledTasks.errors.';

function toScheduledTaskErrorKey(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.startsWith(SCHEDULED_TASK_ERROR_PREFIX)
    ? message
    : 'scheduledTasks.errors.taskCreationFailed';
}

function parseTimeOfDay(timeOfDay: string): { hours: number; minutes: number } {
  const match = TIME_OF_DAY_PATTERN.exec(timeOfDay);
  if (!match) {
    throw new Error('scheduledTasks.errors.invalidTimeOfDay');
  }

  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

function dateAtTime(base: Date, timeOfDay: string): Date {
  const { hours, minutes } = parseTimeOfDay(timeOfDay);
  const candidate = new Date(base);
  candidate.setHours(hours, minutes, 0, 0);
  return candidate;
}

export function computeNextRunAt(recurrence: ScheduledTaskRecurrence, from: Date = new Date()): string {
  if (recurrence.kind === 'daily') {
    const candidate = dateAtTime(from, recurrence.timeOfDay);
    if (candidate <= from) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate.toISOString();
  }

  const uniqueDays = Array.from(new Set(recurrence.daysOfWeek)).sort((left, right) => left - right);
  if (uniqueDays.length === 0 || uniqueDays.some((day) => day < 0 || day > 6 || !Number.isInteger(day))) {
    throw new Error('scheduledTasks.errors.invalidDaysOfWeek');
  }

  for (let offset = 0; offset <= 7; offset++) {
    const candidateBase = new Date(from);
    candidateBase.setDate(candidateBase.getDate() + offset);
    if (!uniqueDays.includes(candidateBase.getDay())) {
      continue;
    }

    const candidate = dateAtTime(candidateBase, recurrence.timeOfDay);
    if (candidate > from) {
      return candidate.toISOString();
    }
  }

  throw new Error('scheduledTasks.errors.nextRunUnavailable');
}

function getRecurrenceWindowKey(schedule: ScheduledTaskDefinition, now: Date): string {
  if (schedule.recurrence.kind === 'daily') {
    return `${schedule.id}:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  }

  return `${schedule.id}:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}:${now.getDay()}`;
}

export class ScheduledTaskService {
  private schedules: ScheduledTaskDefinition[] = [];
  private firedWindows = new Set<string>();

  constructor(private readonly options: ScheduledTaskServiceOptions) {}

  async load(): Promise<ScheduledTaskDefinition[]> {
    try {
      const content = await readFile(this.options.storagePath, 'utf-8');
      const parsed = JSON.parse(content) as ScheduledTaskStore;
      this.schedules = (parsed.schedules ?? []).map((schedule) => ({
        ...schedule,
        nextRunAt: schedule.nextRunAt ?? computeNextRunAt(schedule.recurrence, this.options.now?.() ?? new Date()),
      }));
    } catch {
      this.schedules = [];
    }

    return this.list();
  }

  list(): ScheduledTaskDefinition[] {
    return this.schedules.map((schedule) => ({ ...schedule }));
  }

  async create(input: CreateScheduledTaskInput): Promise<ScheduledTaskDefinition> {
    const now = this.options.now?.() ?? new Date();
    const schedule: ScheduledTaskDefinition = {
      id: randomUUID(),
      projectId: input.projectId,
      name: input.name.trim(),
      prompt: input.prompt.trim(),
      recurrence: input.recurrence,
      enabled: input.enabled ?? false,
      autoStart: input.autoStart ?? false,
      nextRunAt: computeNextRunAt(input.recurrence, now),
    };

    this.validateSchedule(schedule);
    this.schedules = [...this.schedules, schedule];
    await this.save();
    return { ...schedule };
  }

  async update(scheduleId: string, input: UpdateScheduledTaskInput): Promise<ScheduledTaskDefinition> {
    const index = this.schedules.findIndex((schedule) => schedule.id === scheduleId);
    if (index === -1) {
      throw new Error('scheduledTasks.errors.notFound');
    }

    const current = this.schedules[index];
    const updated: ScheduledTaskDefinition = {
      ...current,
      ...input,
      name: input.name?.trim() ?? current.name,
      prompt: input.prompt?.trim() ?? current.prompt,
      recurrence: input.recurrence ?? current.recurrence,
    };
    updated.nextRunAt = computeNextRunAt(updated.recurrence, this.options.now?.() ?? new Date());

    this.validateSchedule(updated);
    this.schedules = [
      ...this.schedules.slice(0, index),
      updated,
      ...this.schedules.slice(index + 1),
    ];
    await this.save();
    return { ...updated };
  }

  async remove(scheduleId: string): Promise<void> {
    this.schedules = this.schedules.filter((schedule) => schedule.id !== scheduleId);
    await this.save();
  }

  async tick(): Promise<ScheduledTaskDefinition[]> {
    if (!this.options.isEnabled()) {
      return [];
    }

    const now = this.options.now?.() ?? new Date();
    const fired: ScheduledTaskDefinition[] = [];
    let changed = false;

    for (const schedule of this.schedules) {
      if (!schedule.enabled) {
        continue;
      }

      const nextRunAt = schedule.nextRunAt ?? computeNextRunAt(schedule.recurrence, now);
      if (new Date(nextRunAt) > now) {
        continue;
      }

      const windowKey = getRecurrenceWindowKey(schedule, now);
      if (this.firedWindows.has(windowKey)) {
        continue;
      }
      this.firedWindows.add(windowKey);

      if (!this.options.projectExists(schedule.projectId)) {
        schedule.lastError = 'scheduledTasks.errors.projectUnavailable';
        schedule.nextRunAt = computeNextRunAt(schedule.recurrence, now);
        changed = true;
        continue;
      }

      try {
        const created = await this.options.createTask(schedule);
        if (schedule.autoStart && this.options.startTask) {
          await this.options.startTask(created.taskId, schedule);
        }
        schedule.lastFiredAt = now.toISOString();
        schedule.lastError = undefined;
        schedule.nextRunAt = computeNextRunAt(schedule.recurrence, now);
        fired.push({ ...schedule });
        changed = true;
      } catch (error) {
        schedule.lastError = toScheduledTaskErrorKey(error);
        schedule.nextRunAt = computeNextRunAt(schedule.recurrence, now);
        changed = true;
      }
    }

    if (changed) {
      await this.save();
    }

    return fired;
  }

  async fireNow(scheduleId: string): Promise<ScheduledTaskDefinition> {
    const schedule = this.schedules.find((candidate) => candidate.id === scheduleId);
    if (!schedule) {
      throw new Error('scheduledTasks.errors.notFound');
    }

    const now = this.options.now?.() ?? new Date();
    if (!this.options.projectExists(schedule.projectId)) {
      schedule.lastError = 'scheduledTasks.errors.projectUnavailable';
      await this.save();
      return { ...schedule };
    }

    try {
      const created = await this.options.createTask(schedule);
      if (schedule.autoStart && this.options.startTask) {
        await this.options.startTask(created.taskId, schedule);
      }
      schedule.lastFiredAt = now.toISOString();
      schedule.lastError = undefined;
      schedule.nextRunAt = computeNextRunAt(schedule.recurrence, now);
    } catch (error) {
      schedule.lastError = toScheduledTaskErrorKey(error);
      schedule.nextRunAt = computeNextRunAt(schedule.recurrence, now);
    }

    await this.save();
    return { ...schedule };
  }

  private validateSchedule(schedule: ScheduledTaskDefinition): void {
    if (!schedule.projectId.trim()) {
      throw new Error('scheduledTasks.errors.projectIdRequired');
    }
    if (!schedule.name.trim()) {
      throw new Error('scheduledTasks.errors.nameRequired');
    }
    if (!schedule.prompt.trim()) {
      throw new Error('scheduledTasks.errors.promptRequired');
    }
    computeNextRunAt(schedule.recurrence, this.options.now?.() ?? new Date());
  }

  private async save(): Promise<void> {
    await mkdir(dirname(this.options.storagePath), { recursive: true });
    await writeJsonWithRetry(this.options.storagePath, { schedules: this.schedules });
  }
}

export function getScheduledTasksStoragePath(userDataPath: string): string {
  return join(userDataPath, 'store', 'scheduled-tasks.json');
}
