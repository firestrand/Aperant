import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { computeNextRunAt, ScheduledTaskService } from '../scheduled-task-service';

function serviceOptions(overrides: Partial<ConstructorParameters<typeof ScheduledTaskService>[0]> = {}) {
  return {
    storagePath: join(tmpdir(), `scheduled-tasks-${Math.random()}.json`),
    isEnabled: vi.fn(() => true),
    projectExists: vi.fn(() => true),
    createTask: vi.fn(async () => ({ taskId: 'task-1' })),
    now: vi.fn(() => new Date('2026-01-05T10:00:00.000Z')),
    ...overrides,
  };
}

describe('computeNextRunAt', () => {
  it('computes the next daily run without a cron dependency', () => {
    expect(computeNextRunAt(
      { kind: 'daily', timeOfDay: '09:00' },
      new Date(2026, 0, 5, 10, 0)
    )).toBe(new Date(2026, 0, 6, 9, 0).toISOString());

    expect(computeNextRunAt(
      { kind: 'daily', timeOfDay: '11:00' },
      new Date(2026, 0, 5, 10, 0)
    )).toBe(new Date(2026, 0, 5, 11, 0).toISOString());
  });

  it('computes the next weekly run for selected weekdays', () => {
    expect(computeNextRunAt(
      { kind: 'weekly', timeOfDay: '09:30', daysOfWeek: [1, 3] },
      new Date(2026, 0, 5, 10, 0)
    )).toBe(new Date(2026, 0, 7, 9, 30).toISOString());
  });

  it('rejects invalid recurrence values', () => {
    expect(() => computeNextRunAt({ kind: 'daily', timeOfDay: '24:00' }, new Date())).toThrow('scheduledTasks.errors.invalidTimeOfDay');
    expect(() => computeNextRunAt({ kind: 'weekly', timeOfDay: '09:00', daysOfWeek: [7] }, new Date())).toThrow('scheduledTasks.errors.invalidDaysOfWeek');
  });

  it('preserves local daily time across the DST start boundary', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      expect(computeNextRunAt(
        { kind: 'daily', timeOfDay: '09:00' },
        new Date(2026, 2, 7, 15, 0)
      )).toBe(new Date(2026, 2, 8, 9, 0).toISOString());
    } finally {
      process.env.TZ = previousTimezone;
    }
  });

  it('preserves local daily time across the DST end boundary', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      expect(computeNextRunAt(
        { kind: 'daily', timeOfDay: '09:00' },
        new Date(2026, 9, 31, 15, 0)
      )).toBe(new Date(2026, 10, 1, 9, 0).toISOString());
    } finally {
      process.env.TZ = previousTimezone;
    }
  });

  it('does not skip a selected weekly day near midnight before DST start', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      expect(computeNextRunAt(
        { kind: 'weekly', timeOfDay: '09:00', daysOfWeek: [0] },
        new Date(2026, 2, 7, 23, 30)
      )).toBe(new Date(2026, 2, 8, 9, 0).toISOString());
    } finally {
      process.env.TZ = previousTimezone;
    }
  });
});

describe('ScheduledTaskService', () => {
  let storagePath: string;

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aperant-scheduled-tasks-'));
    storagePath = join(dir, 'scheduled-tasks.json');
  });

  it('persists created schedules atomically through the store file', async () => {
    const options = serviceOptions({ storagePath });
    const service = new ScheduledTaskService(options);

    const schedule = await service.create({
      projectId: 'project-1',
      name: 'Daily review',
      prompt: 'Review open issues',
      recurrence: { kind: 'daily', timeOfDay: '11:00' },
      enabled: true,
      autoStart: false,
    });

    const stored = JSON.parse(await readFile(storagePath, 'utf-8')) as { schedules: Array<{ id: string }> };
    expect(stored.schedules[0].id).toBe(schedule.id);
  });

  it('does not fire when the rollout setting is disabled', async () => {
    const createTask = vi.fn(async () => ({ taskId: 'task-1' }));
    const options = serviceOptions({ storagePath, isEnabled: vi.fn(() => false), createTask });
    const service = new ScheduledTaskService(options);
    await service.create({
      projectId: 'project-1',
      name: 'Disabled runtime',
      prompt: 'Do not run',
      recurrence: { kind: 'daily', timeOfDay: '09:00' },
      enabled: true,
    });

    expect(await service.tick()).toEqual([]);
    expect(createTask).not.toHaveBeenCalled();
  });

  it('creates one task for a due schedule and prevents duplicate fires in the same window', async () => {
    const createTask = vi.fn(async () => ({ taskId: 'task-1' }));
    let now = new Date(2026, 0, 5, 8, 0);
    const options = serviceOptions({ storagePath, createTask, now: vi.fn(() => now) });
    const service = new ScheduledTaskService(options);
    await service.create({
      projectId: 'project-1',
      name: 'Due task',
      prompt: 'Run me',
      recurrence: { kind: 'daily', timeOfDay: '09:00' },
      enabled: true,
    });

    now = new Date(2026, 0, 5, 10, 0);
    const first = await service.tick();
    const second = await service.tick();

    expect(first).toHaveLength(1);
    expect(second).toEqual([]);
    expect(createTask).toHaveBeenCalledTimes(1);
  });

  it('records lastError and skips creation when the project is unavailable', async () => {
    const createTask = vi.fn(async () => ({ taskId: 'task-1' }));
    let now = new Date(2026, 0, 5, 8, 0);
    const options = serviceOptions({ storagePath, projectExists: vi.fn(() => false), createTask, now: vi.fn(() => now) });
    const service = new ScheduledTaskService(options);
    await service.create({
      projectId: 'missing-project',
      name: 'Missing project',
      prompt: 'Run me',
      recurrence: { kind: 'daily', timeOfDay: '09:00' },
      enabled: true,
    });

    now = new Date(2026, 0, 5, 10, 0);
    await service.tick();

    expect(createTask).not.toHaveBeenCalled();
    expect(service.list()[0].lastError).toBe('scheduledTasks.errors.projectUnavailable');
  });

  it('normalizes unexpected task creation errors to a translation key', async () => {
    const createTask = vi.fn(async () => {
      throw new Error('raw backend failure');
    });
    let now = new Date(2026, 0, 5, 8, 0);
    const options = serviceOptions({ storagePath, createTask, now: vi.fn(() => now) });
    const service = new ScheduledTaskService(options);
    await service.create({
      projectId: 'project-1',
      name: 'Failing task',
      prompt: 'Run me',
      recurrence: { kind: 'daily', timeOfDay: '09:00' },
      enabled: true,
    });

    now = new Date(2026, 0, 5, 10, 0);
    await service.tick();

    expect(service.list()[0].lastError).toBe('scheduledTasks.errors.taskCreationFailed');
  });

  it('throws stable keys for missing schedules', async () => {
    const service = new ScheduledTaskService(serviceOptions({ storagePath }));

    await expect(service.update('missing', { name: 'Nope' })).rejects.toThrow('scheduledTasks.errors.notFound');
    await expect(service.fireNow('missing')).rejects.toThrow('scheduledTasks.errors.notFound');
  });

  it('normalizes and persists raw fire-now task creation failures', async () => {
    const createTask = vi.fn(async () => {
      throw new Error('raw fire-now failure');
    });
    const options = serviceOptions({ storagePath, createTask });
    const service = new ScheduledTaskService(options);
    const schedule = await service.create({
      projectId: 'project-1',
      name: 'Manual failure',
      prompt: 'Run me',
      recurrence: { kind: 'daily', timeOfDay: '11:00' },
      enabled: true,
    });

    const fired = await service.fireNow(schedule.id);
    const stored = JSON.parse(await readFile(storagePath, 'utf-8')) as { schedules: Array<{ lastError?: string; lastFiredAt?: string }> };

    expect(fired.lastError).toBe('scheduledTasks.errors.taskCreationFailed');
    expect(fired.lastFiredAt).toBeUndefined();
    expect(stored.schedules[0].lastError).toBe('scheduledTasks.errors.taskCreationFailed');
    expect(stored.schedules[0].lastFiredAt).toBeUndefined();
  });

  it('normalizes and persists fire-now auto-start failures', async () => {
    const startTask = vi.fn(async () => {
      throw new Error('raw start failure');
    });
    const options = serviceOptions({ storagePath, startTask });
    const service = new ScheduledTaskService(options);
    const schedule = await service.create({
      projectId: 'project-1',
      name: 'Manual start failure',
      prompt: 'Run me',
      recurrence: { kind: 'daily', timeOfDay: '11:00' },
      enabled: true,
      autoStart: true,
    });

    const fired = await service.fireNow(schedule.id);
    const stored = JSON.parse(await readFile(storagePath, 'utf-8')) as { schedules: Array<{ lastError?: string; lastFiredAt?: string }> };

    expect(startTask).toHaveBeenCalledWith('task-1', expect.objectContaining({ id: schedule.id }));
    expect(fired.lastError).toBe('scheduledTasks.errors.taskCreationFailed');
    expect(fired.lastFiredAt).toBeUndefined();
    expect(stored.schedules[0].lastError).toBe('scheduledTasks.errors.taskCreationFailed');
    expect(stored.schedules[0].lastFiredAt).toBeUndefined();
  });

  it('auto-starts only when requested and a start hook is available', async () => {
    const startTask = vi.fn(async () => undefined);
    let now = new Date(2026, 0, 5, 8, 0);
    const options = serviceOptions({ storagePath, startTask, now: vi.fn(() => now) });
    const service = new ScheduledTaskService(options);
    await service.create({
      projectId: 'project-1',
      name: 'Auto start',
      prompt: 'Run me',
      recurrence: { kind: 'daily', timeOfDay: '09:00' },
      enabled: true,
      autoStart: true,
    });

    now = new Date(2026, 0, 5, 10, 0);
    await service.tick();

    expect(startTask).toHaveBeenCalledWith('task-1', expect.objectContaining({ name: 'Auto start' }));
  });
});
