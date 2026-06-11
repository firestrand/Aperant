import { describe, expect, it } from 'vitest';
import type { AppSettings, FeatureModelConfig, PhaseModelConfig } from '../../types/settings';
import { DEFAULT_FEATURE_MODELS } from '../../constants/models';
import {
  resolveAgentSettings,
  resolveEffectiveAgentSettings,
  resolveEffectiveAgentSettingsSources,
  resolveProjectProvider,
  resolveProviderNativeModelId,
  resolveTaskSnapshotAgentSettings,
  resolveTaskSnapshotPhaseModelId,
  resolveTaskSnapshotPhaseProvider,
  type ResolvedAgentSettings,
} from '../agent-settings-resolver';

function baseSettings(overrides: Partial<AppSettings> = {}): AppSettings {
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

describe('agent settings resolver', () => {
  it('uses the selected global profile when no provider is active', () => {
    const resolved = resolveEffectiveAgentSettings(baseSettings({ selectedAgentProfile: 'quick' }));

    expect(resolved.phaseModels).toEqual({ spec: 'haiku', planning: 'haiku', coding: 'haiku', qa: 'haiku' });
    expect(resolved.phaseThinking).toEqual({ spec: 'low', planning: 'low', coding: 'low', qa: 'low' });
    expect(resolved.featureModels).toEqual(DEFAULT_FEATURE_MODELS);
  });

  it('normalizes shorthands to provider-native model IDs when a provider is active', () => {
    const resolved = resolveEffectiveAgentSettings(
      baseSettings({
        customPhaseModels: { spec: 'opus', planning: 'sonnet', coding: 'haiku', qa: 'opus' },
        featureModels: {
          insights: 'sonnet',
          ideation: 'opus',
          roadmap: 'opus',
          githubIssues: 'opus',
          githubPrs: 'opus',
          utility: 'haiku',
          naming: 'haiku',
        },
      }),
      'openai',
    );

    expect(resolved.phaseModels).toMatchObject({
      spec: 'gpt-5.5',
      planning: 'gpt-5.5',
      coding: 'gpt-5.4-mini',
    });
    expect(resolved.featureModels.naming).toBe('gpt-5.4-mini');
  });

  it('uses provider-native preset and feature defaults when a provider is active', () => {
    const resolved = resolveEffectiveAgentSettings(baseSettings({ selectedAgentProfile: 'balanced' }), 'openai');

    expect(resolved.phaseModels).toEqual({
      spec: 'gpt-5.5',
      planning: 'gpt-5.5',
      coding: 'gpt-5.5',
      qa: 'gpt-5.5',
    });
    expect(resolved.featureModels).toMatchObject({
      insights: 'gpt-5.5',
      ideation: 'gpt-5.5',
      roadmap: 'gpt-5.5',
      githubIssues: 'gpt-5.5',
      githubPrs: 'gpt-5.5',
      utility: 'gpt-5.4-mini',
      naming: 'gpt-5.4-mini',
    });
  });

  it('lets per-provider overrides win over global settings', () => {
    const providerPhaseModels: PhaseModelConfig = {
      spec: 'gemini-2.5-pro',
      planning: 'gemini-2.5-flash',
      coding: 'gemini-2.5-flash',
      qa: 'gemini-2.5-flash-lite',
    };
    const providerFeatureModels: FeatureModelConfig = {
      insights: 'gemini-2.5-flash',
      ideation: 'gemini-2.5-pro',
      roadmap: 'gemini-2.5-pro',
      githubIssues: 'gemini-2.5-pro',
      githubPrs: 'gemini-2.5-pro',
      utility: 'gemini-2.5-flash-lite',
      naming: 'gemini-2.5-flash-lite',
    };

    const resolved = resolveEffectiveAgentSettings(
      baseSettings({
        selectedAgentProfile: 'quick',
        customPhaseModels: { spec: 'haiku', planning: 'haiku', coding: 'haiku', qa: 'haiku' },
        providerAgentConfig: {
          google: {
            selectedAgentProfile: 'balanced',
            customPhaseModels: providerPhaseModels,
            featureModels: providerFeatureModels,
          },
        },
      }),
      'google',
    );

    expect(resolved.phaseModels).toBe(providerPhaseModels);
    expect(resolved.featureModels).toBe(providerFeatureModels);
  });

  it('uses cross-provider mixed config before provider and global settings', () => {
    const resolved = resolveEffectiveAgentSettings(
      baseSettings({
        selectedAgentProfile: 'quick',
        customMixedProfileActive: true,
        customMixedPhaseConfig: {
          spec: { provider: 'anthropic', modelId: 'opus', thinkingLevel: 'high' },
          planning: { provider: 'openai', modelId: 'gpt-5.5', thinkingLevel: 'high' },
          coding: { provider: 'google', modelId: 'gemini-2.5-pro', thinkingLevel: 'medium' },
          qa: { provider: 'openai', modelId: 'gpt-5.4-mini', thinkingLevel: 'low' },
        },
      }),
      'anthropic',
    );

    expect(resolved.phaseModels).toEqual({
      spec: 'opus',
      planning: 'gpt-5.5',
      coding: 'gemini-2.5-pro',
      qa: 'gpt-5.4-mini',
    });
    expect(resolved.phaseThinking).toEqual({ spec: 'high', planning: 'high', coding: 'medium', qa: 'low' });
  });

  it('derives Ollama phase and feature models from complete category mappings', () => {
    const resolved = resolveEffectiveAgentSettings(
      baseSettings({
        providerAgentConfig: {
          ollama: {
            categoryModels: {
              reasoningHeavy: 'qwen3:32b',
              coding: 'codestral',
              review: 'qwen3:8b',
              fastUtility: 'qwen3:8b',
              chat: 'llama3.3',
            },
          },
        },
      }),
      'ollama',
    );

    expect(resolved.phaseModels).toEqual({
      spec: 'qwen3:32b',
      planning: 'qwen3:32b',
      coding: 'codestral',
      qa: 'qwen3:8b',
    });
    expect(resolved.featureModels).toMatchObject({
      insights: 'llama3.3',
      ideation: 'qwen3:32b',
      roadmap: 'qwen3:32b',
      githubPrs: 'qwen3:8b',
      utility: 'qwen3:8b',
      naming: 'qwen3:8b',
    });
  });

  it('lets exact Ollama advanced overrides win over category mappings', () => {
    const resolved = resolveEffectiveAgentSettings(
      baseSettings({
        providerAgentConfig: {
          ollama: {
            categoryModels: {
              reasoningHeavy: 'qwen3:32b',
              coding: 'codestral',
              review: 'qwen3:8b',
              fastUtility: 'qwen3:8b',
              chat: 'llama3.3',
            },
            customPhaseModels: {
              spec: 'custom-spec',
              planning: 'custom-planning',
              coding: 'custom-coding',
              qa: 'custom-qa',
            },
          },
        },
      }),
      'ollama',
    );

    expect(resolved.phaseModels).toEqual({
      spec: 'custom-spec',
      planning: 'custom-planning',
      coding: 'custom-coding',
      qa: 'custom-qa',
    });
  });

  it('lets project phase overrides win over app phase overrides', () => {
    const projectPhaseModels: PhaseModelConfig = {
      spec: 'project-spec',
      planning: 'project-planning',
      coding: 'project-coding',
      qa: 'project-qa',
    };

    const resolved = resolveEffectiveAgentSettings(
      baseSettings({
        customPhaseModels: { spec: 'app-spec', planning: 'app-planning', coding: 'app-coding', qa: 'app-qa' },
      }),
      undefined,
      { customPhaseModels: projectPhaseModels },
    );

    expect(resolved.phaseModels).toBe(projectPhaseModels);
  });

  it('lets project provider overrides win over app provider overrides', () => {
    const projectProviderPhaseModels: PhaseModelConfig = {
      spec: 'project-google-spec',
      planning: 'project-google-planning',
      coding: 'project-google-coding',
      qa: 'project-google-qa',
    };

    const resolved = resolveEffectiveAgentSettings(
      baseSettings({
        providerAgentConfig: {
          google: {
            selectedAgentProfile: 'quick',
            customPhaseModels: { spec: 'app-google-spec', planning: 'app-google-planning', coding: 'app-google-coding', qa: 'app-google-qa' },
          },
        },
      }),
      'google',
      {
        providerAgentConfig: {
          google: {
            selectedAgentProfile: 'balanced',
            customPhaseModels: projectProviderPhaseModels,
          },
        },
      },
    );

    expect(resolved.phaseModels).toBe(projectProviderPhaseModels);
  });

  it('preserves app behavior when project overrides are absent', () => {
    const settings = baseSettings({ selectedAgentProfile: 'quick' });

    expect(resolveEffectiveAgentSettings(settings)).toEqual(resolveEffectiveAgentSettings(settings, undefined, undefined));
  });

  it('reports project/provider/default provenance for resolved settings', () => {
    expect(resolveEffectiveAgentSettingsSources(baseSettings(), 'openai')).toEqual({
      phaseModels: 'providerDefault',
      phaseThinking: 'providerDefault',
      featureModels: 'providerDefault',
      featureThinking: 'providerDefault',
    });

    expect(resolveEffectiveAgentSettingsSources(
      baseSettings({
        providerAgentConfig: {
          openai: {
            featureModels: {
              insights: 'app-provider-insights',
              ideation: 'app-provider-ideation',
              roadmap: 'app-provider-roadmap',
              githubIssues: 'app-provider-github-issues',
              githubPrs: 'app-provider-github-prs',
              utility: 'app-provider-utility',
              naming: 'app-provider-naming',
            },
          },
        },
      }),
      'openai',
      {
        customPhaseModels: { spec: 'project-spec', planning: 'project-planning', coding: 'project-coding', qa: 'project-qa' },
      },
    )).toMatchObject({
      phaseModels: 'projectOverride',
      featureModels: 'perProviderOverride',
    });
  });

  it('reports mixed-profile provenance', () => {
    expect(resolveEffectiveAgentSettingsSources(
      baseSettings({ customMixedProfileActive: true, customMixedPhaseConfig: {
        spec: { provider: 'anthropic', modelId: 'app-spec', thinkingLevel: 'high' },
        planning: { provider: 'openai', modelId: 'app-planning', thinkingLevel: 'medium' },
        coding: { provider: 'google', modelId: 'app-coding', thinkingLevel: 'low' },
        qa: { provider: 'anthropic', modelId: 'app-qa', thinkingLevel: 'medium' },
      } }),
      undefined,
      { customMixedProfileActive: true, customMixedPhaseConfig: {
        spec: { provider: 'google', modelId: 'project-spec', thinkingLevel: 'medium' },
        planning: { provider: 'anthropic', modelId: 'project-planning', thinkingLevel: 'high' },
        coding: { provider: 'openai', modelId: 'project-coding', thinkingLevel: 'low' },
        qa: { provider: 'google', modelId: 'project-qa', thinkingLevel: 'high' },
      } },
    )).toMatchObject({
      phaseModels: 'projectOverride',
      phaseThinking: 'projectOverride',
    });
  });

  it('reports provider-scoped project provenance when a provider is active', () => {
    expect(resolveEffectiveAgentSettingsSources(
      baseSettings(),
      'openai',
      {
        providerAgentConfig: {
          openai: {
            featureModels: {
              insights: 'project-provider-insights',
              ideation: 'project-provider-ideation',
              roadmap: 'project-provider-roadmap',
              githubIssues: 'project-provider-github-issues',
              githubPrs: 'project-provider-github-prs',
              utility: 'project-provider-utility',
              naming: 'project-provider-naming',
            },
          },
        },
      },
    )).toMatchObject({
      featureModels: 'projectOverride',
    });
  });

  it('reports mixed-profile feature fallback provenance from project overrides', () => {
    expect(resolveEffectiveAgentSettingsSources(
      baseSettings({ customMixedProfileActive: true }),
      undefined,
      {
        customMixedProfileActive: true,
        customMixedPhaseConfig: {
          spec: { provider: 'google', modelId: 'project-spec', thinkingLevel: 'medium' },
          planning: { provider: 'anthropic', modelId: 'project-planning', thinkingLevel: 'high' },
          coding: { provider: 'openai', modelId: 'project-coding', thinkingLevel: 'low' },
          qa: { provider: 'google', modelId: 'project-qa', thinkingLevel: 'high' },
        },
        featureModels: {
          insights: 'project-insights',
          ideation: 'project-ideation',
          roadmap: 'project-roadmap',
          githubIssues: 'project-github-issues',
          githubPrs: 'project-github-prs',
          utility: 'project-utility',
          naming: 'project-naming',
        },
      },
    )).toMatchObject({
      featureModels: 'projectOverride',
    });
  });

  it('reports provider and profile selection provenance truthfully', () => {
    expect(resolveEffectiveAgentSettingsSources(
      baseSettings({ selectedAgentProfile: 'quick' }),
      'anthropic',
    )).toMatchObject({
      phaseModels: 'globalPreset',
      phaseThinking: 'globalPreset',
    });

    expect(resolveEffectiveAgentSettingsSources(
      baseSettings({ providerAgentConfig: { openai: { selectedAgentProfile: 'quick' } } }),
      'openai',
    )).toMatchObject({
      phaseModels: 'perProviderOverride',
      phaseThinking: 'perProviderOverride',
    });

    expect(resolveEffectiveAgentSettingsSources(
      baseSettings(),
      'google',
      { provider: 'google' },
    )).toMatchObject({
      phaseModels: 'projectOverride',
      featureModels: 'projectOverride',
    });

    expect(resolveEffectiveAgentSettingsSources(
      baseSettings(),
      'openai',
      { selectedAgentProfile: 'balanced' },
    )).toMatchObject({
      phaseModels: 'projectOverride',
      phaseThinking: 'projectOverride',
    });
  });

  it('resolves project provider before app priority order', () => {
    const settings = baseSettings({
      providerAccounts: [
        { id: 'anthropic-account', provider: 'anthropic', name: 'Anthropic', authType: 'oauth', billingModel: 'subscription', createdAt: 1, updatedAt: 1 },
        { id: 'openai-account', provider: 'openai', name: 'OpenAI', authType: 'api-key', billingModel: 'pay-per-use', createdAt: 1, updatedAt: 1 },
      ],
      globalPriorityOrder: ['anthropic-account', 'openai-account'],
    });

    expect(resolveProjectProvider(settings)).toBe('anthropic');
    expect(resolveProjectProvider(settings, { provider: 'openai' })).toBe('openai');
  });

  it('resolves task metadata snapshots through the shared resolver', () => {
    const metadata = {
      model: 'sonnet',
      provider: 'anthropic',
      thinkingLevel: 'medium' as const,
      phaseModels: { spec: 'opus', planning: 'gpt-5.5', coding: 'codestral', qa: 'gemini-2.5-pro' },
      phaseThinking: { spec: 'high' as const, planning: 'high' as const, coding: 'medium' as const, qa: 'low' as const },
      phaseProviders: { planning: 'openai', coding: 'ollama' },
    };

    expect(resolveTaskSnapshotAgentSettings(metadata, 'planning')).toEqual({
      source: 'taskSnapshot',
      provider: 'openai',
      model: 'gpt-5.5',
      thinking: 'high',
    });
    expect(resolveTaskSnapshotPhaseProvider(metadata, 'coding')).toBe('ollama');
    expect(resolveTaskSnapshotPhaseProvider(metadata, 'qa')).toBe('anthropic');
  });

  it('resolves provider-native task snapshot model IDs in shared logic', () => {
    const metadata = {
      provider: 'anthropic',
      model: 'sonnet',
      phaseModels: { planning: 'opus', coding: 'sonnet', qa: 'haiku' },
      phaseProviders: { planning: 'openai', coding: 'google', qa: 'anthropic' },
    };

    expect(resolveTaskSnapshotPhaseModelId(metadata, 'planning')).toBe('gpt-5.5');
    expect(resolveTaskSnapshotPhaseModelId(metadata, 'coding')).toBe('gemini-2.5-flash');
    expect(resolveTaskSnapshotPhaseModelId(metadata, 'qa')).toBe('claude-haiku-4-5-20251001');
    expect(resolveTaskSnapshotPhaseModelId(undefined, 'planning')).toBe('claude-sonnet-4-6');
  });

  it('resolves provider-native model IDs through a shared helper', () => {
    expect(resolveProviderNativeModelId('opus', 'openai')).toBe('gpt-5.5');
    expect(resolveProviderNativeModelId('sonnet', 'google')).toBe('gemini-2.5-flash');
    expect(resolveProviderNativeModelId('raw-local-model', 'ollama')).toBe('raw-local-model');
    expect(resolveProviderNativeModelId('haiku', 'anthropic')).toBe('claude-haiku-4-5-20251001');
  });

  it('preserves task snapshot thinking even when no model is frozen', () => {
    expect(resolveTaskSnapshotAgentSettings({
      thinkingLevel: 'high',
      phaseThinking: { planning: 'medium' },
    }, 'planning')).toEqual({
      source: 'taskSnapshot',
      provider: null,
      model: undefined,
      thinking: 'medium',
    });
  });

  it('resolves phase, feature, and fixed agent settings from resolved settings', () => {
    const resolvedSettings: ResolvedAgentSettings = {
      phaseModels: { spec: 'opus', planning: 'sonnet', coding: 'haiku', qa: 'sonnet' },
      phaseThinking: { spec: 'high', planning: 'medium', coding: 'low', qa: 'medium' },
      featureModels: DEFAULT_FEATURE_MODELS,
      featureThinking: {
        insights: 'medium',
        ideation: 'high',
        roadmap: 'high',
        githubIssues: 'medium',
        githubPrs: 'medium',
        utility: 'low',
        naming: 'low',
      },
    };

    expect(resolveAgentSettings({ type: 'phase', phase: 'coding' }, resolvedSettings)).toEqual({ model: 'haiku', thinking: 'low' });
    expect(resolveAgentSettings({ type: 'feature', feature: 'utility' }, resolvedSettings)).toEqual({ model: 'haiku', thinking: 'low' });
    expect(resolveAgentSettings({ type: 'fixed', model: 'custom-model', thinking: 'xhigh' }, resolvedSettings)).toEqual({ model: 'custom-model', thinking: 'xhigh' });
  });
});
