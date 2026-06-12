import { describe, expect, it } from 'vitest';
import type { ExecutionProgress, TaskStatus } from '../../../shared/types';
import { deriveExecutionProgressForStatus } from '../task-progress-helpers';

const existingProgress: ExecutionProgress = {
  phase: 'coding',
  phaseProgress: 42,
  overallProgress: 55,
  message: 'still working',
};

const idleProgress: ExecutionProgress = {
  phase: 'idle',
  phaseProgress: 0,
  overallProgress: 0,
};

const planningProgress: ExecutionProgress = {
  phase: 'planning',
  phaseProgress: 0,
  overallProgress: 0,
};

describe('deriveExecutionProgressForStatus', () => {
  it('resets progress to idle when moving to backlog', () => {
    expect(deriveExecutionProgressForStatus('backlog', existingProgress)).toEqual(idleProgress);
  });

  it('initializes planning progress for in_progress tasks without a current phase', () => {
    expect(deriveExecutionProgressForStatus('in_progress', undefined)).toEqual(planningProgress);
  });

  it('preserves existing progress for in_progress tasks with a current phase', () => {
    expect(deriveExecutionProgressForStatus('in_progress', existingProgress)).toBe(existingProgress);
  });

  it('resets terminal and review statuses to idle', () => {
    const resetStatuses: TaskStatus[] = ['human_review', 'error', 'done', 'pr_created'];

    for (const status of resetStatuses) {
      expect(deriveExecutionProgressForStatus(status, existingProgress)).toEqual(idleProgress);
    }
  });

  it('preserves existing progress for statuses that do not initialize or reset progress', () => {
    const preserveStatuses: TaskStatus[] = ['queue', 'ai_review'];

    for (const status of preserveStatuses) {
      expect(deriveExecutionProgressForStatus(status, existingProgress)).toBe(existingProgress);
    }
  });

  it('keeps undefined progress undefined for statuses that do not initialize or reset progress', () => {
    expect(deriveExecutionProgressForStatus('queue', undefined)).toBeUndefined();
    expect(deriveExecutionProgressForStatus('ai_review', undefined)).toBeUndefined();
  });
});
