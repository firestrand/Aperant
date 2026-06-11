import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getPhaseThinking } from '../phase-config';

let specDir: string | null = null;

afterEach(async () => {
  if (specDir) {
    await rm(specDir, { recursive: true, force: true });
    specDir = null;
  }
});

describe('getPhaseThinking task snapshot resolution', () => {
  it('preserves phase thinking snapshots through the shared resolver even without a model snapshot', async () => {
    specDir = await mkdtemp(join(tmpdir(), 'aperant-phase-config-'));
    await writeFile(join(specDir, 'task_metadata.json'), JSON.stringify({
      phaseThinking: {
        planning: 'high',
        coding: 'medium',
      },
      thinkingLevel: 'low',
    }));

    await expect(getPhaseThinking(specDir, 'planning')).resolves.toBe('high');
    await expect(getPhaseThinking(specDir, 'coding')).resolves.toBe('medium');
    await expect(getPhaseThinking(specDir, 'qa')).resolves.toBe('low');
  });
});
