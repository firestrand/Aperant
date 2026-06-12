import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentExecutorConfig } from '../../ai/agent/types';

let capturedExecutorConfig: AgentExecutorConfig | undefined;

vi.mock('../agent-process', () => ({
  AgentProcessManager: vi.fn().mockImplementation(function AgentProcessManager() {
    return {
      configure: vi.fn(),
      spawnWorkerProcess: vi.fn(async (_taskId: string, executorConfig: AgentExecutorConfig) => {
        capturedExecutorConfig = executorConfig;
      }),
      killProcess: vi.fn(),
      getRunningProcesses: vi.fn(() => []),
    };
  }),
}));

vi.mock('../../project-store', () => ({
  projectStore: {
    getProjects: vi.fn(),
  },
}));

vi.mock('../../claude-profile-manager', () => ({
  initializeClaudeProfileManager: vi.fn(async () => ({ hasValidAuth: () => true })),
  getClaudeProfileManager: vi.fn(() => ({
    getActiveProfile: () => ({ id: 'profile-1', name: 'Profile 1' }),
  })),
}));

vi.mock('../../claude-profile/operation-registry', () => ({
  getOperationRegistry: vi.fn(() => ({
    registerOperation: vi.fn(),
    unregisterOperation: vi.fn(),
  })),
}));

vi.mock('../../settings-utils', () => ({
  readSettingsFile: vi.fn(() => ({
    providerAccounts: [
      { id: 'anthropic', provider: 'anthropic', name: 'Anthropic', authType: 'oauth', billingModel: 'subscription', createdAt: 1, updatedAt: 1 },
      { id: 'openai', provider: 'openai', name: 'OpenAI', authType: 'api-key', billingModel: 'pay-per-use', createdAt: 1, updatedAt: 1 },
      { id: 'google', provider: 'google', name: 'Google', authType: 'api-key', billingModel: 'pay-per-use', createdAt: 1, updatedAt: 1 },
    ],
    globalPriorityOrder: ['anthropic', 'openai', 'google'],
  })),
}));

vi.mock('../../ai/auth/resolver', () => ({
  resolveAuth: vi.fn(async () => ({ apiKey: 'fallback-key' })),
  resolveAuthFromQueue: vi.fn(async (requestedModel: string, orderedQueue: Array<{ provider: string }>) => ({
    accountId: `${orderedQueue[0]?.provider ?? 'unknown'}-account`,
    resolvedProvider: orderedQueue[0]?.provider ?? 'anthropic',
    resolvedModelId: requestedModel,
    apiKey: `${orderedQueue[0]?.provider ?? 'unknown'}-key`,
  })),
}));

vi.mock('../../ai/worktree', () => ({
  createOrGetWorktree: vi.fn(),
}));

vi.mock('../../worktree-paths', () => ({
  findTaskWorktree: vi.fn(() => null),
}));

vi.mock('../../ai/prompts/prompt-loader', () => ({
  tryLoadPrompt: vi.fn(() => 'planner prompt'),
}));

import { AgentManager } from '../agent-manager';
import { projectStore } from '../../project-store';

describe('AgentManager phase auth parity', () => {
  let projectPath: string;

  beforeEach(() => {
    capturedExecutorConfig = undefined;
    projectPath = join(tmpdir(), `agent-manager-phase-auth-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const specDir = join(projectPath, '.auto-claude', 'specs', 'spec-1');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(join(specDir, 'spec.md'), '# Spec');
    writeFileSync(join(specDir, 'implementation_plan.json'), '{"phases":[]}');
    writeFileSync(join(specDir, 'task_metadata.json'), JSON.stringify({
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
    }, null, 2));

    vi.mocked(projectStore.getProjects).mockReturnValue([
      {
        id: 'project-1',
        name: 'Project 1',
        path: projectPath,
        autoBuildPath: '.auto-claude',
        settings: { mainBranch: 'main', pushNewBranches: false },
      } as never,
    ]);
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('passes snapshot-derived planning, coding, and QA auth into build orchestrator phaseAuth', async () => {
    const manager = new AgentManager();

    await manager.startTaskExecution('task-1', projectPath, 'spec-1', { useWorktree: false }, 'project-1');

    expect(capturedExecutorConfig?.session.agentType).toBe('build_orchestrator');
    expect(capturedExecutorConfig?.session.phaseAuth).toMatchObject({
      planning: {
        provider: 'openai',
        modelId: 'gpt-5.5',
        apiKey: 'openai-key',
      },
      coding: {
        provider: 'google',
        modelId: 'gemini-2.5-flash',
        apiKey: 'google-key',
      },
      qa: {
        provider: 'anthropic',
        modelId: 'claude-haiku-4-5-20251001',
        apiKey: 'anthropic-key',
      },
    });
  });
});
