import { describe, expect, it } from 'vitest';
import { TASK_STATUS_COLUMNS } from '../../../shared/constants';
import type { Task, TaskOrderState, TaskStatus } from '../../../shared/types';
import {
  getVisualColumn,
  groupTasksByVisualStatus,
  pruneSelectedTaskIds,
  selectAllVisibleTaskIds,
  selectTaskIdsForColumn,
  toggleSelectedTaskId,
} from '../kanban-helpers';

function task(id: string, status: TaskStatus = 'backlog', createdAt = '2024-01-01T00:00:00Z'): Task {
  return {
    id,
    specId: id,
    projectId: 'project-1',
    title: id,
    description: `${id} description`,
    status,
    subtasks: [],
    logs: [],
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}

function idsFrom(selectedIds: Set<string>): string[] {
  return Array.from(selectedIds).sort();
}

function taskIds(tasks: Task[]): string[] {
  return tasks.map((item) => item.id);
}

function emptyTaskOrder(overrides: Partial<TaskOrderState> = {}): TaskOrderState {
  return {
    backlog: [],
    queue: [],
    in_progress: [],
    ai_review: [],
    human_review: [],
    done: [],
    pr_created: [],
    error: [],
    ...overrides,
  };
}

describe('getVisualColumn', () => {
  it('keeps regular Kanban column statuses in their own visual columns', () => {
    for (const status of TASK_STATUS_COLUMNS) {
      expect(getVisualColumn(status)).toBe(status);
    }
  });

  it('maps pr_created tasks to the done column', () => {
    expect(getVisualColumn('pr_created')).toBe('done');
  });

  it('maps error tasks to the human_review column', () => {
    expect(getVisualColumn('error')).toBe('human_review');
  });

  it('returns a visual column for every task status', () => {
    const allStatuses: TaskStatus[] = [
      ...TASK_STATUS_COLUMNS,
      'pr_created',
      'error',
    ];

    for (const status of allStatuses) {
      expect(TASK_STATUS_COLUMNS).toContain(getVisualColumn(status));
    }
  });
});

describe('groupTasksByVisualStatus', () => {
  it('groups tasks by visual status', () => {
    const grouped = groupTasksByVisualStatus([
      task('backlog-1', 'backlog'),
      task('pr-1', 'pr_created'),
      task('error-1', 'error'),
    ], null);

    expect(taskIds(grouped.backlog)).toEqual(['backlog-1']);
    expect(taskIds(grouped.done)).toEqual(['pr-1']);
    expect(taskIds(grouped.human_review)).toEqual(['error-1']);
  });

  it('sorts columns by createdAt newest first when no custom order exists', () => {
    const grouped = groupTasksByVisualStatus([
      task('older', 'backlog', '2024-01-01T00:00:00Z'),
      task('newer', 'backlog', '2024-01-02T00:00:00Z'),
    ], null);

    expect(taskIds(grouped.backlog)).toEqual(['newer', 'older']);
  });

  it('uses custom order and prepends unordered new tasks newest first', () => {
    const grouped = groupTasksByVisualStatus([
      task('ordered-1', 'backlog', '2024-01-01T00:00:00Z'),
      task('ordered-2', 'backlog', '2024-01-02T00:00:00Z'),
      task('newer-unordered', 'backlog', '2024-01-04T00:00:00Z'),
      task('older-unordered', 'backlog', '2024-01-03T00:00:00Z'),
    ], emptyTaskOrder({ backlog: ['ordered-2', 'stale-id', 'ordered-1'] }));

    expect(taskIds(grouped.backlog)).toEqual([
      'newer-unordered',
      'older-unordered',
      'ordered-2',
      'ordered-1',
    ]);
  });

  it('returns empty arrays for columns without tasks', () => {
    const grouped = groupTasksByVisualStatus([], null);

    for (const status of TASK_STATUS_COLUMNS) {
      expect(grouped[status]).toEqual([]);
    }
  });
});

describe('Kanban selected task helpers', () => {
  it('toggles selected task IDs by membership', () => {
    expect(idsFrom(toggleSelectedTaskId(new Set(['task-1']), 'task-1'))).toEqual([]);
    expect(idsFrom(toggleSelectedTaskId(new Set(['task-1']), 'task-2'))).toEqual(['task-1', 'task-2']);
  });

  it('adds column task IDs to the existing selection', () => {
    const selected = selectTaskIdsForColumn(new Set(['existing']), [task('column-1'), task('column-2')]);

    expect(idsFrom(selected)).toEqual(['column-1', 'column-2', 'existing']);
  });

  it('selects all visible task IDs as a replacement set', () => {
    const selected = selectAllVisibleTaskIds([task('visible-1'), task('visible-2')]);

    expect(idsFrom(selected)).toEqual(['visible-1', 'visible-2']);
  });

  it('prunes selected IDs that are no longer visible', () => {
    const pruned = pruneSelectedTaskIds(new Set(['visible-1', 'hidden-1']), [task('visible-1')]);

    expect(idsFrom(pruned)).toEqual(['visible-1']);
  });

  it('preserves the existing selection set reference when no IDs are pruned', () => {
    const selectedIds = new Set(['visible-1']);
    const pruned = pruneSelectedTaskIds(selectedIds, [task('visible-1'), task('visible-2')]);

    expect(pruned).toBe(selectedIds);
  });
});
