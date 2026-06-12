import { describe, expect, it } from 'vitest';
import type { Task, TaskStatus } from '../../types';
import { evaluateTaskDependencies, selectReadyTasksForExecution } from '../task-dependency-scheduler';

function task(overrides: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    id: overrides.id,
    specId: overrides.specId ?? `spec-${overrides.id}`,
    projectId: overrides.projectId ?? 'project-1',
    title: overrides.title ?? overrides.id,
    description: overrides.description ?? '',
    status: overrides.status ?? 'queue',
    reviewReason: overrides.reviewReason,
    subtasks: overrides.subtasks ?? [],
    logs: overrides.logs ?? [],
    metadata: overrides.metadata,
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('task dependency scheduler', () => {
  it('starts independent tasks while holding dependent tasks until prerequisites complete', () => {
    const tasks = [
      task({ id: 'A', createdAt: new Date('2026-01-01T00:00:00.000Z') }),
      task({ id: 'B', createdAt: new Date('2026-01-01T00:01:00.000Z') }),
      task({
        id: 'C',
        createdAt: new Date('2026-01-01T00:02:00.000Z'),
        metadata: { dependencies: ['A'] },
      }),
    ];

    expect(selectReadyTasksForExecution(tasks, { capacity: 3 }).map((readyTask) => readyTask.id)).toEqual(['A', 'B']);

    const afterACompletes = tasks.map((currentTask) =>
      currentTask.id === 'A' ? { ...currentTask, status: 'done' as TaskStatus } : currentTask
    );

    expect(selectReadyTasksForExecution(afterACompletes, { capacity: 3 }).map((readyTask) => readyTask.id)).toEqual(['B', 'C']);
  });

  it('treats pr_created and completed human review dependencies as satisfied', () => {
    const tasks = [
      task({ id: 'merged', status: 'pr_created' }),
      task({ id: 'reviewed', status: 'human_review', reviewReason: 'completed' }),
      task({ id: 'dependent', metadata: { dependencies: ['merged', 'reviewed'] } }),
    ];

    expect(evaluateTaskDependencies(tasks[2], tasks)).toEqual({
      ready: true,
      dependencyIds: ['merged', 'reviewed'],
      missingDependencyIds: [],
      incompleteDependencyIds: [],
    });
    expect(selectReadyTasksForExecution(tasks, { capacity: 1 }).map((readyTask) => readyTask.id)).toEqual(['dependent']);
  });

  it('blocks tasks with missing dependencies', () => {
    const tasks = [task({ id: 'blocked', metadata: { dependencies: ['missing-task'] } })];

    expect(evaluateTaskDependencies(tasks[0], tasks)).toEqual({
      ready: false,
      dependencyIds: ['missing-task'],
      missingDependencyIds: ['missing-task'],
      incompleteDependencyIds: [],
    });
    expect(selectReadyTasksForExecution(tasks, { capacity: 1 })).toEqual([]);
  });

  it('does not schedule dependency cycles because neither side is complete', () => {
    const tasks = [
      task({ id: 'A', metadata: { dependencies: ['B'] } }),
      task({ id: 'B', metadata: { dependencies: ['A'] } }),
    ];

    expect(selectReadyTasksForExecution(tasks, { capacity: 2 })).toEqual([]);
    expect(evaluateTaskDependencies(tasks[0], tasks).incompleteDependencyIds).toEqual(['B']);
    expect(evaluateTaskDependencies(tasks[1], tasks).incompleteDependencyIds).toEqual(['A']);
  });

  it('respects capacity, archive status, attempted tasks, and FIFO creation order', () => {
    const tasks = [
      task({ id: 'newer', createdAt: new Date('2026-01-01T00:02:00.000Z') }),
      task({ id: 'archived', createdAt: new Date('2026-01-01T00:00:00.000Z'), metadata: { archivedAt: '2026-01-02T00:00:00.000Z' } }),
      task({ id: 'attempted', createdAt: new Date('2026-01-01T00:01:00.000Z') }),
      task({ id: 'older', createdAt: new Date('2026-01-01T00:00:30.000Z') }),
    ];

    expect(
      selectReadyTasksForExecution(tasks, {
        capacity: 1,
        attemptedTaskIds: new Set(['attempted']),
      }).map((readyTask) => readyTask.id)
    ).toEqual(['older']);
  });

  it('matches dependencies by specId as well as task id', () => {
    const tasks = [
      task({ id: 'source', specId: 'spec-source', status: 'done' }),
      task({ id: 'dependent', metadata: { dependencies: ['spec-source'] } }),
    ];

    expect(evaluateTaskDependencies(tasks[1], tasks).ready).toBe(true);
  });

  it('prioritizes the caller-provided queue order before FIFO fallback', () => {
    const tasks = [
      task({ id: 'older', createdAt: new Date('2026-01-01T00:00:00.000Z') }),
      task({ id: 'newer', createdAt: new Date('2026-01-01T00:01:00.000Z') }),
      task({ id: 'unordered', createdAt: new Date('2026-01-01T00:00:30.000Z') }),
    ];

    expect(
      selectReadyTasksForExecution(tasks, {
        capacity: 3,
        orderedTaskIds: ['newer', 'older'],
      }).map((readyTask) => readyTask.id)
    ).toEqual(['newer', 'older', 'unordered']);
  });
});
