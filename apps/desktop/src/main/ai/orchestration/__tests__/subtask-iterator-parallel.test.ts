import { describe, it, expect } from 'vitest';

import { getReadyParallelSubtasks } from '../subtask-iterator';

type TestSubtask = {
  id: string;
  title: string;
  description: string;
  status: string;
  files_to_modify?: string[];
  files_to_create?: string[];
};

type TestPhase = {
  id: string;
  name: string;
  depends_on?: string[];
  parallel_safe?: boolean;
  subtasks: TestSubtask[];
};

type TestPlan = {
  phases: TestPhase[];
};

function subtask(id: string, files: string[] = [], status = 'pending'): TestSubtask {
  return {
    id,
    title: `Task ${id}`,
    description: `Implement ${id}`,
    status,
    files_to_modify: files,
  };
}

function plan(phases: TestPhase[]): TestPlan {
  return { phases };
}

describe('getReadyParallelSubtasks', () => {
  it('selects pending subtasks from dependency-satisfied parallel-safe phases', () => {
    const result = getReadyParallelSubtasks(
      plan([
        {
          id: 'phase-1',
          name: 'Backend',
          parallel_safe: true,
          subtasks: [subtask('a', ['src/a.ts']), subtask('b', ['src/b.ts'])],
        },
      ]) as never,
      [],
      3,
    );

    expect(result.map((item) => item.subtask.id)).toEqual(['a', 'b']);
  });

  it('does not select phases whose dependencies are incomplete', () => {
    const result = getReadyParallelSubtasks(
      plan([
        {
          id: 'phase-1',
          name: 'Setup',
          parallel_safe: true,
          subtasks: [subtask('setup', ['src/setup.ts'], 'pending')],
        },
        {
          id: 'phase-2',
          name: 'Feature',
          depends_on: ['phase-1'],
          parallel_safe: true,
          subtasks: [subtask('feature', ['src/feature.ts'])],
        },
      ]) as never,
      [],
      3,
    );

    expect(result.map((item) => item.subtask.id)).toEqual(['setup']);
  });

  it('selects dependent phases once blockers are completed', () => {
    const result = getReadyParallelSubtasks(
      plan([
        {
          id: 'phase-1',
          name: 'Setup',
          parallel_safe: true,
          subtasks: [subtask('setup', ['src/setup.ts'], 'completed')],
        },
        {
          id: 'phase-2',
          name: 'Feature',
          depends_on: ['phase-1'],
          parallel_safe: true,
          subtasks: [subtask('feature', ['src/feature.ts'])],
        },
      ]) as never,
      [],
      3,
    );

    expect(result.map((item) => item.subtask.id)).toEqual(['feature']);
  });

  it('requires phases to be explicitly parallel safe', () => {
    const result = getReadyParallelSubtasks(
      plan([
        {
          id: 'phase-1',
          name: 'Sequential',
          subtasks: [subtask('a', ['src/a.ts'])],
        },
      ]) as never,
      [],
      3,
    );

    expect(result).toEqual([]);
  });

  it('filters subtasks with overlapping target files', () => {
    const result = getReadyParallelSubtasks(
      plan([
        {
          id: 'phase-1',
          name: 'Backend',
          parallel_safe: true,
          subtasks: [
            subtask('a', ['src/shared.ts']),
            subtask('b', ['src/shared.ts']),
            subtask('c', ['src/other.ts']),
          ],
        },
      ]) as never,
      [],
      3,
    );

    expect(result.map((item) => item.subtask.id)).toEqual(['a', 'c']);
  });

  it('respects the worker limit and stuck subtask list', () => {
    const result = getReadyParallelSubtasks(
      plan([
        {
          id: 'phase-1',
          name: 'Backend',
          parallel_safe: true,
          subtasks: [
            subtask('a', ['src/a.ts']),
            subtask('b', ['src/b.ts']),
            subtask('c', ['src/c.ts']),
          ],
        },
      ]) as never,
      ['a'],
      1,
    );

    expect(result.map((item) => item.subtask.id)).toEqual(['b']);
  });
});
