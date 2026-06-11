import type { Task, TaskStatus } from '../types';
import { isCompletedTask } from './task-status';

export interface DependencyEvaluation {
  readonly ready: boolean;
  readonly dependencyIds: string[];
  readonly missingDependencyIds: string[];
  readonly incompleteDependencyIds: string[];
}

export interface ReadyTaskSelectionOptions {
  readonly capacity: number;
  readonly candidateStatus?: TaskStatus;
  readonly attemptedTaskIds?: ReadonlySet<string>;
  readonly orderedTaskIds?: readonly string[];
}

function normalizeDependencyIds(dependencies: string[] | undefined): string[] {
  if (!dependencies) {
    return [];
  }

  return [...new Set(dependencies.map((dependency) => dependency.trim()).filter(Boolean))];
}

function isArchived(task: Task): boolean {
  return Boolean(task.metadata?.archivedAt);
}

function getTaskTimestamp(task: Task): number {
  const timestamp = new Date(task.createdAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function findDependencyTask(tasks: readonly Task[], dependencyId: string): Task | undefined {
  return tasks.find((task) => task.id === dependencyId || task.specId === dependencyId);
}

export function isTaskDependencySatisfied(task: Task): boolean {
  return isCompletedTask(task.status, task.reviewReason);
}

export function evaluateTaskDependencies(task: Task, allTasks: readonly Task[]): DependencyEvaluation {
  const dependencyIds = normalizeDependencyIds(task.metadata?.dependencies);
  const missingDependencyIds: string[] = [];
  const incompleteDependencyIds: string[] = [];

  for (const dependencyId of dependencyIds) {
    const dependencyTask = findDependencyTask(allTasks, dependencyId);

    if (!dependencyTask) {
      missingDependencyIds.push(dependencyId);
      continue;
    }

    if (!isTaskDependencySatisfied(dependencyTask)) {
      incompleteDependencyIds.push(dependencyId);
    }
  }

  return {
    ready: missingDependencyIds.length === 0 && incompleteDependencyIds.length === 0,
    dependencyIds,
    missingDependencyIds,
    incompleteDependencyIds,
  };
}

export function selectReadyTasksForExecution(
  tasks: readonly Task[],
  options: ReadyTaskSelectionOptions,
): Task[] {
  if (options.capacity <= 0) {
    return [];
  }

  const candidateStatus = options.candidateStatus ?? 'queue';
  const attemptedTaskIds = options.attemptedTaskIds ?? new Set<string>();
  const orderedTaskIds = options.orderedTaskIds ?? [];
  const orderIndex = new Map(orderedTaskIds.map((taskId, index) => [taskId, index]));

  return tasks
    .filter((task) =>
      task.status === candidateStatus &&
      !isArchived(task) &&
      !attemptedTaskIds.has(task.id) &&
      evaluateTaskDependencies(task, tasks).ready
    )
    .sort((a, b) => {
      const indexA = orderIndex.get(a.id);
      const indexB = orderIndex.get(b.id);

      if (indexA !== undefined && indexB !== undefined) {
        return indexA - indexB;
      }

      if (indexA !== undefined) {
        return -1;
      }

      if (indexB !== undefined) {
        return 1;
      }

      return getTaskTimestamp(a) - getTaskTimestamp(b);
    })
    .slice(0, options.capacity);
}
