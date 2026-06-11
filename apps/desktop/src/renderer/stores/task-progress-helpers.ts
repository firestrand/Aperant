import type { ExecutionPhase, ExecutionProgress, TaskStatus } from '../../shared/types';

export function deriveExecutionProgressForStatus(
  status: TaskStatus,
  currentProgress: ExecutionProgress | undefined,
): ExecutionProgress | undefined {
  if (status === 'backlog') {
    return { phase: 'idle' as ExecutionPhase, phaseProgress: 0, overallProgress: 0 };
  }

  if (status === 'in_progress' && !currentProgress?.phase) {
    return { phase: 'planning' as ExecutionPhase, phaseProgress: 0, overallProgress: 0 };
  }

  if (['human_review', 'error', 'done', 'pr_created'].includes(status)) {
    return { phase: 'idle' as ExecutionPhase, phaseProgress: 0, overallProgress: 0 };
  }

  return currentProgress;
}
