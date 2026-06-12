import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../../../shared/types/settings';

const { readSettingsFileMock } = vi.hoisted(() => ({
  readSettingsFileMock: vi.fn<() => Partial<AppSettings> | null>(),
}));

vi.mock('../../settings-utils', () => ({
  readSettingsFile: readSettingsFileMock,
}));

import { getActiveProviderFeatureSettings } from '../feature-settings-helper';

function settings(overrides: Partial<AppSettings> = {}): Partial<AppSettings> {
  return {
    providerAccounts: [
      {
        id: 'openai-account',
        provider: 'openai',
        name: 'OpenAI',
        authType: 'api-key',
        billingModel: 'pay-per-use',
        createdAt: 1767225600000,
        updatedAt: 1767225600000,
      },
    ],
    globalPriorityOrder: ['openai-account'],
    ...overrides,
  };
}

describe('getActiveProviderFeatureSettings', () => {
  beforeEach(() => {
    readSettingsFileMock.mockReset();
  });

  it('returns defaults when settings are unavailable', () => {
    readSettingsFileMock.mockReturnValue(null);

    expect(getActiveProviderFeatureSettings('utility')).toEqual({
      model: 'haiku',
      thinkingLevel: 'low',
    });
  });

  it('uses the shared provider resolver instead of legacy global feature overrides', () => {
    readSettingsFileMock.mockReturnValue(settings({
      featureModels: {
        insights: 'haiku',
        ideation: 'haiku',
        roadmap: 'haiku',
        githubIssues: 'haiku',
        githubPrs: 'haiku',
        utility: 'haiku',
        naming: 'haiku',
      },
      featureThinking: {
        insights: 'low',
        ideation: 'low',
        roadmap: 'low',
        githubIssues: 'low',
        githubPrs: 'low',
        utility: 'low',
        naming: 'low',
      },
    }));

    expect(getActiveProviderFeatureSettings('insights')).toEqual({
      model: 'gpt-5.5',
      thinkingLevel: 'medium',
    });
  });

  it('uses the project provider override before app priority order', () => {
    readSettingsFileMock.mockReturnValue(settings({
      providerAccounts: [
        {
          id: 'openai-account',
          provider: 'openai',
          name: 'OpenAI',
          authType: 'api-key',
          billingModel: 'pay-per-use',
          createdAt: 1767225600000,
          updatedAt: 1767225600000,
        },
        {
          id: 'google-account',
          provider: 'google',
          name: 'Google',
          authType: 'api-key',
          billingModel: 'pay-per-use',
          createdAt: 1767225600000,
          updatedAt: 1767225600000,
        },
      ],
      globalPriorityOrder: ['openai-account', 'google-account'],
    }));

    expect(getActiveProviderFeatureSettings('naming', { provider: 'google' })).toEqual({
      model: 'gemini-2.5-flash-lite',
      thinkingLevel: 'low',
    });
  });

  it('lets project feature overrides win over app/provider defaults', () => {
    readSettingsFileMock.mockReturnValue(settings({
      providerAgentConfig: {
        openai: {
          featureModels: {
            insights: 'gpt-5.4-mini',
            ideation: 'gpt-5.5',
            roadmap: 'gpt-5.5',
            githubIssues: 'gpt-5.5',
            githubPrs: 'gpt-5.5',
            utility: 'gpt-5.4-mini',
            naming: 'gpt-5.4-mini',
          },
        },
      },
    }));

    expect(getActiveProviderFeatureSettings('insights', {
      featureModels: {
        insights: 'project-insights',
        ideation: 'project-ideation',
        roadmap: 'project-roadmap',
        githubIssues: 'project-github-issues',
        githubPrs: 'project-github-prs',
        utility: 'project-utility',
        naming: 'project-naming',
      },
      featureThinking: {
        insights: 'high',
        ideation: 'medium',
        roadmap: 'medium',
        githubIssues: 'medium',
        githubPrs: 'medium',
        utility: 'low',
        naming: 'low',
      },
    })).toEqual({
      model: 'project-insights',
      thinkingLevel: 'high',
    });
  });

  it('lets an active provider-specific feature override win', () => {
    readSettingsFileMock.mockReturnValue(settings({
      providerAgentConfig: {
        openai: {
          featureModels: {
            insights: 'gpt-5.4-mini',
            ideation: 'gpt-5.5',
            roadmap: 'gpt-5.5',
            githubIssues: 'gpt-5.5',
            githubPrs: 'gpt-5.5',
            utility: 'gpt-5.4-mini',
            naming: 'gpt-5.4-mini',
          },
          featureThinking: {
            insights: 'low',
            ideation: 'high',
            roadmap: 'high',
            githubIssues: 'medium',
            githubPrs: 'medium',
            utility: 'low',
            naming: 'low',
          },
        },
      },
    }));

    expect(getActiveProviderFeatureSettings('insights')).toEqual({
      model: 'gpt-5.4-mini',
      thinkingLevel: 'low',
    });
  });
});
