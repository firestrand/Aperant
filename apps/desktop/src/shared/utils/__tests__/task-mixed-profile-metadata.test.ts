import { describe, expect, it } from 'vitest';
import type { AppSettings } from '../../types/settings';
import type { TaskMetadata } from '../../types/task';
import {
  applyMixedPhaseConfigToTaskMetadata,
  resolveEffectiveMixedPhaseConfig,
} from '../task-mixed-profile-metadata';

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    theme: 'system',
    defaultModel: 'sonnet',
    agentFramework: 'claude-code',
    autoUpdateAutoBuild: false,
    autoNameTerminals: true,
    notifications: {
      onTaskComplete: true,
      onTaskFailed: true,
      onReviewNeeded: true,
      sound: false,
    },
    ...overrides,
  };
}

const appMixed = {
  spec: { provider: 'anthropic' as const, modelId: 'app-spec', thinkingLevel: 'high' as const },
  planning: { provider: 'openai' as const, modelId: 'app-planning', thinkingLevel: 'medium' as const },
  coding: { provider: 'google' as const, modelId: 'app-coding', thinkingLevel: 'low' as const },
  qa: { provider: 'anthropic' as const, modelId: 'app-qa', thinkingLevel: 'medium' as const },
};

const projectMixed = {
  spec: { provider: 'google' as const, modelId: 'project-spec', thinkingLevel: 'medium' as const },
  planning: { provider: 'anthropic' as const, modelId: 'project-planning', thinkingLevel: 'high' as const },
  coding: { provider: 'openai' as const, modelId: 'project-coding', thinkingLevel: 'low' as const },
  qa: { provider: 'google' as const, modelId: 'project-qa', thinkingLevel: 'high' as const },
};

describe('task mixed profile metadata', () => {
  it('resolves project mixed config before app mixed config', () => {
    const resolved = resolveEffectiveMixedPhaseConfig(
      settings({ customMixedProfileActive: true, customMixedPhaseConfig: appMixed }),
      { customMixedProfileActive: true, customMixedPhaseConfig: projectMixed },
    );

    expect(resolved).toBe(projectMixed);
  });

  it('allows project settings to disable app mixed config', () => {
    const resolved = resolveEffectiveMixedPhaseConfig(
      settings({ customMixedProfileActive: true, customMixedPhaseConfig: appMixed }),
      { customMixedProfileActive: false, customMixedPhaseConfig: projectMixed },
    );

    expect(resolved).toBeUndefined();
  });

  it('applies mixed config models, thinking, and providers to task metadata', () => {
    const metadata: TaskMetadata = { sourceType: 'manual' };

    applyMixedPhaseConfigToTaskMetadata(metadata, projectMixed);

    expect(metadata.isAutoProfile).toBe(true);
    expect(metadata.phaseModels).toEqual({
      spec: 'project-spec',
      planning: 'project-planning',
      coding: 'project-coding',
      qa: 'project-qa',
    });
    expect(metadata.phaseThinking).toEqual({
      spec: 'medium',
      planning: 'high',
      coding: 'low',
      qa: 'high',
    });
    expect(metadata.phaseProviders).toEqual({
      spec: 'google',
      planning: 'anthropic',
      coding: 'openai',
      qa: 'google',
    });
  });
});
