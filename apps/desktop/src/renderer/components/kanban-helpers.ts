import { TASK_STATUS_COLUMNS, type TaskStatusColumn } from '../../shared/constants';
import type { Task, TaskOrderState, TaskStatus } from '../../shared/types';

export type KanbanTasksByStatus = Record<TaskStatusColumn, Task[]>;

/**
 * Get the visual Kanban column for a task status.
 * pr_created tasks are displayed in done; error tasks are displayed in human_review.
 */
export function getVisualColumn(status: TaskStatus): TaskStatusColumn {
  if (status === 'pr_created') return 'done';
  if (status === 'error') return 'human_review';
  return status;
}

function sortByCreatedAtNewestFirst(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });
}

function createEmptyTasksByStatus(): KanbanTasksByStatus {
  return {
    backlog: [],
    queue: [],
    in_progress: [],
    ai_review: [],
    human_review: [],
    done: [],
  };
}

export function groupTasksByVisualStatus(tasks: Task[], taskOrder: TaskOrderState | null): KanbanTasksByStatus {
  const grouped = createEmptyTasksByStatus();

  for (const task of tasks) {
    grouped[getVisualColumn(task.status)].push(task);
  }

  for (const status of TASK_STATUS_COLUMNS) {
    const columnTasks = grouped[status];
    const columnOrder = taskOrder?.[status];

    if (columnOrder && columnOrder.length > 0) {
      const currentTaskIds = new Set(columnTasks.map((task) => task.id));
      const validOrder = columnOrder.filter((id) => currentTaskIds.has(id));
      const validOrderSet = new Set(validOrder);
      const newTasks = sortByCreatedAtNewestFirst(columnTasks.filter((task) => !validOrderSet.has(task.id)));
      const indexMap = new Map(validOrder.map((id, index) => [id, index]));
      const orderedTasks = columnTasks
        .filter((task) => validOrderSet.has(task.id))
        .sort((a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0));

      grouped[status] = [...newTasks, ...orderedTasks];
    } else {
      grouped[status] = sortByCreatedAtNewestFirst(columnTasks);
    }
  }

  return grouped;
}

export function toggleSelectedTaskId(selectedIds: Set<string>, taskId: string): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(taskId)) {
    next.delete(taskId);
  } else {
    next.add(taskId);
  }
  return next;
}

export function selectTaskIdsForColumn(selectedIds: Set<string>, columnTasks: Task[]): Set<string> {
  return new Set<string>([
    ...selectedIds,
    ...columnTasks.map((task) => task.id),
  ]);
}

export function selectAllVisibleTaskIds(tasks: Task[]): Set<string> {
  return new Set(tasks.map((task) => task.id));
}

export function pruneSelectedTaskIds(selectedIds: Set<string>, visibleTasks: Task[]): Set<string> {
  const visibleTaskIds = new Set(visibleTasks.map((task) => task.id));
  const pruned = new Set([...selectedIds].filter((id) => visibleTaskIds.has(id)));
  return pruned.size === selectedIds.size ? selectedIds : pruned;
}
