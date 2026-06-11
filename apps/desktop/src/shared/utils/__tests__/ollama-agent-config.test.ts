import { describe, expect, it } from 'vitest';
import { buildProviderDefaultFeatureModels, getProviderPresetOrFallback } from '../../constants/models';
import type { PerProviderAgentConfig } from '../../types/settings';
import {
  OLLAMA_ROLE_CATEGORIES,
  buildOllamaAgentConfigFromCategories,
  getMissingOllamaAgentModelKeys,
  isOllamaAgentConfigComplete,
} from '../ollama-agent-config';

const completeConfig: PerProviderAgentConfig = {
  customPhaseModels: {
    spec: 'qwen3:32b',
    planning: 'qwen3:32b',
    coding: 'codestral',
    qa: 'qwen3:8b',
  },
  featureModels: {
    insights: 'qwen3:8b',
    ideation: 'qwen3:32b',
    roadmap: 'qwen3:32b',
    githubIssues: 'qwen3:32b',
    githubPrs: 'qwen3:8b',
    utility: 'qwen3:8b',
    naming: 'qwen3:8b',
  },
};

describe('ollama agent config', () => {
  it('defines role category mappings for every phase and feature key', () => {
    expect(OLLAMA_ROLE_CATEGORIES.reasoningHeavy).toEqual(expect.arrayContaining(['spec', 'planning', 'roadmap', 'ideation']));
    expect(OLLAMA_ROLE_CATEGORIES.coding).toContain('coding');
    expect(OLLAMA_ROLE_CATEGORIES.review).toEqual(expect.arrayContaining(['qa', 'githubPrs']));
    expect(OLLAMA_ROLE_CATEGORIES.fastUtility).toEqual(expect.arrayContaining(['utility', 'naming']));
    expect(OLLAMA_ROLE_CATEGORIES.chat).toContain('insights');
  });

  it('requires every phase and feature model including naming', () => {
    expect(isOllamaAgentConfigComplete(completeConfig)).toBe(true);

    expect(isOllamaAgentConfigComplete({
      ...completeConfig,
      customPhaseModels: { ...completeConfig.customPhaseModels!, coding: '' },
    })).toBe(false);

    expect(getMissingOllamaAgentModelKeys({
      ...completeConfig,
      featureModels: { ...completeConfig.featureModels!, naming: '' },
    })).toContain('naming');
  });

  it('uses explicit setup-required sentinels instead of empty Ollama defaults', () => {
    expect(Object.values(getProviderPresetOrFallback('ollama', 'auto').phaseModels)).toEqual([
      'ollama-setup-required',
      'ollama-setup-required',
      'ollama-setup-required',
      'ollama-setup-required',
    ]);
    expect(Object.values(buildProviderDefaultFeatureModels('ollama'))).toEqual([
      'ollama-setup-required',
      'ollama-setup-required',
      'ollama-setup-required',
      'ollama-setup-required',
      'ollama-setup-required',
      'ollama-setup-required',
      'ollama-setup-required',
    ]);
  });

  it('builds phase and feature models from category assignments', () => {
    const config = buildOllamaAgentConfigFromCategories({
      reasoningHeavy: 'qwen3:32b',
      coding: 'codestral',
      review: 'qwen3:8b',
      fastUtility: 'qwen3:8b',
      chat: 'llama3.3',
    });

    expect(config.customPhaseModels).toEqual({
      spec: 'qwen3:32b',
      planning: 'qwen3:32b',
      coding: 'codestral',
      qa: 'qwen3:8b',
    });
    expect(config.featureModels).toMatchObject({
      insights: 'llama3.3',
      ideation: 'qwen3:32b',
      roadmap: 'qwen3:32b',
      githubIssues: 'qwen3:8b',
      githubPrs: 'qwen3:8b',
      utility: 'qwen3:8b',
      naming: 'qwen3:8b',
    });
  });
});
