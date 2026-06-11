/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderAgentTabs } from './ProviderAgentTabs';
import { useSettingsStore } from '../../stores/settings-store';
import { DEFAULT_APP_SETTINGS } from '../../../shared/constants';
import type { ProviderAccount } from '../../../shared/types/provider-account';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        'agentProfile.title': 'Agent Profiles',
        'agentProfile.sectionDescription': 'Configure agent defaults.',
        'agentProfile.providerTabs.configureFor': `Configure agent settings for ${values?.provider ?? ''}`,
        'agentProfile.providerTabs.defaultProviderDescription': 'This provider is default.',
        'agentProfile.providerTabs.notDefaultProviderDescription': 'This provider is not default.',
        'agentProfile.providerTabs.defaultBadge': 'Default',
        'agentProfile.providerTabs.makeDefault': 'Make default provider',
        'agentProfile.providerTabs.currentDefault': 'Current Default',
        'agentProfile.providerTabs.moreProviders': 'More',
        'agentProfile.providerTabs.noProviders': 'No providers connected.',
        'agentProfile.mode.label': 'Mode',
        'agentProfile.mode.simple': 'Simple',
        'agentProfile.mode.advanced': 'Advanced',
        'agentProfile.mode.simpleDescription': 'Simple mode description.',
        'agentProfile.mode.advancedDescription': 'Advanced mode description.',
        'agentProfile.profilesInfo': 'Choose a profile.',
        'agentProfile.simpleBaseModel.label': 'Base Model',
        'agentProfile.simpleBaseModel.description': 'Base model description.',
        'agentProfile.simpleBaseModel.resetToLatest': 'Reset',
        'agentProfile.ollamaNotConfigured': 'Setup required',
        'agentProfile.thinking': 'thinking',
        'agentProfile.ollamaCategories.title': 'Ollama role models',
        'agentProfile.ollamaCategories.description': 'Assign installed local models.',
        'agentProfile.ollamaCategories.reasoningHeavy.label': 'Reasoning-heavy',
        'agentProfile.ollamaCategories.reasoningHeavy.description': 'Spec and planning',
        'agentProfile.ollamaCategories.coding.label': 'Coding',
        'agentProfile.ollamaCategories.coding.description': 'Implementation',
        'agentProfile.ollamaCategories.review.label': 'Review',
        'agentProfile.ollamaCategories.review.description': 'QA',
        'agentProfile.ollamaCategories.fastUtility.label': 'Fast utility',
        'agentProfile.ollamaCategories.fastUtility.description': 'Utilities',
        'agentProfile.ollamaCategories.chat.label': 'Chat',
        'agentProfile.ollamaCategories.chat.description': 'Insights',
        'agentProfile.ollamaModels.loading': 'Loading models...',
        'settings:modelSelect.placeholder': 'Select a model',
      };
      return translations[key] ?? key;
    },
  }),
}));

const ollamaAccount: ProviderAccount = {
  id: 'ollama-local',
  provider: 'ollama',
  name: 'Ollama Local',
  authType: 'api-key',
  billingModel: 'pay-per-use',
  baseUrl: 'http://localhost:11434',
  createdAt: 1,
  updatedAt: 1,
};

describe('ProviderAgentTabs Ollama tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      settings: {
        ...DEFAULT_APP_SETTINGS,
        globalPriorityOrder: [ollamaAccount.id],
        providerAgentConfig: {
          ollama: {
            mode: 'simple',
            selectedAgentProfile: 'auto',
            simpleBaseModel: 'ollama-setup-required',
          },
        },
      },
      providerAccounts: [ollamaAccount],
    });

    window.electronAPI.listOllamaModels = vi.fn().mockResolvedValue({
      success: true,
      data: { models: [] },
    });
  });

  it('renders Ollama configuration without blanking the settings panel', async () => {
    render(<ProviderAgentTabs />);

    expect(screen.getByText('Configure agent settings for Ollama')).toBeInTheDocument();
    expect(screen.getByText('Current Default')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make default provider' })).not.toBeInTheDocument();
    expect(screen.getByText('Ollama role models')).toBeInTheDocument();
    expect(screen.getAllByText('Select a model').length).toBeGreaterThan(0);
  });
});
