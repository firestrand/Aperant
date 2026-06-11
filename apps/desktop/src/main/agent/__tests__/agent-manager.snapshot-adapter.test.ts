import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentManager } from '../agent-manager';

let tempDirs: string[] = [];

function createSpecDir(metadata: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'agent-manager-snapshot-'));
  tempDirs.push(dir);
  writeFileSync(join(dir, 'task_metadata.json'), JSON.stringify(metadata, null, 2));
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe('AgentManager task snapshot adapters', () => {
  it('resolves per-phase providers from task metadata at runtime', () => {
    const specDir = createSpecDir({
      provider: 'anthropic',
      phaseProviders: {
        planning: 'openai',
        coding: 'google',
        qa: 'ollama',
      },
    });

    expect(AgentManager.resolveTaskSnapshotProvider(specDir, 'planning')).toBe('openai');
    expect(AgentManager.resolveTaskSnapshotProvider(specDir, 'coding')).toBe('google');
    expect(AgentManager.resolveTaskSnapshotProvider(specDir, 'qa')).toBe('ollama');
    expect(AgentManager.resolveTaskSnapshotProvider(specDir, 'spec')).toBe('anthropic');
  });

  it('translates task snapshot phase models into provider-native model IDs', async () => {
    const specDir = createSpecDir({
      provider: 'anthropic',
      model: 'sonnet',
      phaseModels: {
        planning: 'opus',
        coding: 'sonnet',
        qa: 'haiku',
      },
      phaseProviders: {
        planning: 'openai',
        coding: 'google',
        qa: 'anthropic',
      },
    });

    await expect(AgentManager.resolveTaskSnapshotModelId(specDir, 'planning')).resolves.toBe('gpt-5.5');
    await expect(AgentManager.resolveTaskSnapshotModelId(specDir, 'coding')).resolves.toBe('gemini-2.5-flash');
    await expect(AgentManager.resolveTaskSnapshotModelId(specDir, 'qa')).resolves.toBe('claude-haiku-4-5-20251001');
  });
});
