import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '../../../shared/constants';
import type { AppSettings } from '../../../shared/types';
import type { ProviderAccount } from '../../../shared/types/provider-account';
import {
  addProviderAccountState,
  deleteProviderAccountState,
  updateProviderAccountState,
} from '../settings-store';

function account(overrides: Partial<ProviderAccount> = {}): ProviderAccount {
  return {
    id: 'account-1',
    provider: 'openai',
    name: 'OpenAI',
    authType: 'api-key',
    billingModel: 'pay-per-use',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...overrides,
  } as AppSettings;
}

describe('settings-store provider account state helpers', () => {
  it('adds an account and initializes provider agent config when no provider config exists', () => {
    const newAccount = account();
    const result = addProviderAccountState({
      providerAccounts: [],
      settings: settings({
        selectedAgentProfile: 'quick',
        globalPriorityOrder: ['existing-account'],
        crossProviderPriorityOrder: undefined,
        providerAgentConfig: undefined,
      }),
    }, newAccount);

    expect(result.providerAccounts).toEqual([newAccount]);
    expect(result.settings.globalPriorityOrder).toEqual(['account-1', 'existing-account']);
    expect(result.settings.crossProviderPriorityOrder).toBeUndefined();
    expect(result.settings.providerAgentConfig?.openai?.mode).toBe('simple');
    expect(result.settings.providerAgentConfig?.openai?.selectedAgentProfile).toBe('quick');
    expect(result.settings.providerAgentConfig?.openai?.simpleBaseModel).toBeTruthy();
    expect(result.settings.providerAgentConfig?.openai?.customPhaseModels).toBeDefined();
    expect(result.settings.providerAgentConfig?.openai?.customPhaseThinking).toBeDefined();
    expect(result.settings.providerAgentConfig?.openai?.featureModels).toBeDefined();
    expect(result.settings.providerAgentConfig?.openai?.featureThinking).toBeDefined();
  });

  it('preserves existing provider config fields and prepends initialized cross-provider order', () => {
    const newAccount = account({ id: 'account-2' });
    const existingFeatureModels = {
      insights: 'custom-model',
      ideation: 'custom-model',
      roadmap: 'custom-model',
      githubIssues: 'custom-model',
      githubPrs: 'custom-model',
      utility: 'custom-model',
      naming: 'custom-model',
    };

    const result = addProviderAccountState({
      providerAccounts: [account({ id: 'account-1' })],
      settings: settings({
        selectedAgentProfile: 'auto',
        globalPriorityOrder: ['account-1'],
        crossProviderPriorityOrder: [],
        providerAgentConfig: {
          openai: {
            mode: 'advanced',
            selectedAgentProfile: 'balanced',
            simpleBaseModel: 'custom-base',
            featureModels: existingFeatureModels,
          },
        },
      }),
    }, newAccount);

    expect(result.providerAccounts.map((item) => item.id)).toEqual(['account-1', 'account-2']);
    expect(result.settings.globalPriorityOrder).toEqual(['account-2', 'account-1']);
    expect(result.settings.crossProviderPriorityOrder).toEqual(['account-2']);
    expect(result.settings.providerAgentConfig?.openai?.mode).toBe('advanced');
    expect(result.settings.providerAgentConfig?.openai?.selectedAgentProfile).toBe('balanced');
    expect(result.settings.providerAgentConfig?.openai?.simpleBaseModel).toBe('custom-base');
    expect(result.settings.providerAgentConfig?.openai?.featureModels).toBe(existingFeatureModels);
    expect(result.settings.providerAgentConfig?.openai?.customPhaseModels).toBeDefined();
  });

  it('replaces only the matching provider account on update', () => {
    const first = account({ id: 'account-1', name: 'Old' });
    const second = account({ id: 'account-2', provider: 'anthropic', name: 'Anthropic' });
    const updated = account({ id: 'account-1', name: 'New' });

    const result = updateProviderAccountState({ providerAccounts: [first, second] }, 'account-1', updated);

    expect(result.providerAccounts).toEqual([updated, second]);
  });

  it('deletes account IDs from accounts and priority orders without pruning provider config', () => {
    const result = deleteProviderAccountState({
      providerAccounts: [account({ id: 'account-1' }), account({ id: 'account-2' })],
      settings: settings({
        globalPriorityOrder: ['account-1', 'account-2', 'account-1'],
        crossProviderPriorityOrder: ['account-2', 'account-1'],
        providerAgentConfig: {
          openai: { selectedAgentProfile: 'quick' },
        },
      }),
    }, 'account-1');

    expect(result.providerAccounts.map((item) => item.id)).toEqual(['account-2']);
    expect(result.settings.globalPriorityOrder).toEqual(['account-2']);
    expect(result.settings.crossProviderPriorityOrder).toEqual(['account-2']);
    expect(result.settings.providerAgentConfig?.openai).toEqual({ selectedAgentProfile: 'quick' });
  });

  it('converts missing global priority order to empty array on delete while preserving missing cross-provider order', () => {
    const result = deleteProviderAccountState({
      providerAccounts: [account({ id: 'account-1' })],
      settings: settings({
        globalPriorityOrder: undefined,
        crossProviderPriorityOrder: undefined,
      }),
    }, 'account-1');

    expect(result.providerAccounts).toEqual([]);
    expect(result.settings.globalPriorityOrder).toEqual([]);
    expect(result.settings.crossProviderPriorityOrder).toBeUndefined();
  });
});
