import {
  DEFAULT_FEATURE_THINKING,
  FEATURE_KEYS,
  PHASE_KEYS,
} from '../constants/models';
import type {
  FeatureModelConfig,
  PerProviderAgentConfig,
  PhaseModelConfig,
} from '../types/settings';

export type OllamaRoleCategory = 'reasoningHeavy' | 'coding' | 'review' | 'fastUtility' | 'chat';
export type OllamaRoleKey = keyof PhaseModelConfig | keyof FeatureModelConfig;

export const OLLAMA_ROLE_CATEGORIES: Record<OllamaRoleCategory, readonly OllamaRoleKey[]> = {
  reasoningHeavy: ['spec', 'planning', 'roadmap', 'ideation'],
  coding: ['coding'],
  review: ['qa', 'githubIssues', 'githubPrs'],
  fastUtility: ['utility', 'naming'],
  chat: ['insights'],
};

export type OllamaCategoryModelConfig = Record<OllamaRoleCategory, string>;

export function isOllamaCategoryMappingComplete(categories?: Partial<OllamaCategoryModelConfig>): categories is OllamaCategoryModelConfig {
  return Boolean(
    categories?.reasoningHeavy &&
    categories.coding &&
    categories.review &&
    categories.fastUtility &&
    categories.chat
  );
}

export function getMissingOllamaAgentModelKeys(config?: PerProviderAgentConfig): OllamaRoleKey[] {
  if (isOllamaCategoryMappingComplete(config?.categoryModels)) {
    return [];
  }

  const missing: OllamaRoleKey[] = [];

  for (const phase of PHASE_KEYS) {
    if (!config?.customPhaseModels?.[phase]) {
      missing.push(phase);
    }
  }

  for (const feature of FEATURE_KEYS) {
    if (!config?.featureModels?.[feature]) {
      missing.push(feature);
    }
  }

  return missing;
}

export function isOllamaAgentConfigComplete(config?: PerProviderAgentConfig): boolean {
  return getMissingOllamaAgentModelKeys(config).length === 0;
}

export function buildOllamaAgentConfigFromCategories(categories: OllamaCategoryModelConfig): Pick<PerProviderAgentConfig, 'customPhaseModels' | 'featureModels' | 'featureThinking'> {
  return {
    customPhaseModels: {
      spec: categories.reasoningHeavy,
      planning: categories.reasoningHeavy,
      coding: categories.coding,
      qa: categories.review,
    },
    featureModels: {
      insights: categories.chat,
      ideation: categories.reasoningHeavy,
      roadmap: categories.reasoningHeavy,
      githubIssues: categories.review,
      githubPrs: categories.review,
      utility: categories.fastUtility,
      naming: categories.fastUtility,
    },
    featureThinking: {
      ...DEFAULT_FEATURE_THINKING,
      insights: 'low',
      ideation: 'low',
      roadmap: 'low',
      githubIssues: 'low',
      githubPrs: 'low',
      utility: 'low',
      naming: 'low',
    },
  };
}
