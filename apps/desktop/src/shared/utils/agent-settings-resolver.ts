/**
 * Agent settings resolution utilities.
 *
 * Pure shared logic for resolving phase/feature model and thinking settings.
 * Keep filesystem, IPC, Electron, and process.env access in callers.
 */

import { buildOllamaAgentConfigFromCategories, isOllamaCategoryMappingComplete } from './ollama-agent-config';
import {
  DEFAULT_AGENT_PROFILES,
  DEFAULT_FEATURE_MODELS,
  DEFAULT_FEATURE_THINKING,
  DEFAULT_PHASE_MODELS,
  DEFAULT_PHASE_THINKING,
  MODEL_ID_MAP,
  buildProviderDefaultFeatureModels,
  buildProviderDefaultFeatureThinking,
  getProviderPresetOrFallback,
  resolveModelEquivalent,
} from '../constants/models';
import type {
  AppSettings,
  FeatureModelConfig,
  FeatureThinkingConfig,
  PhaseModelConfig,
  PhaseThinkingConfig,
  ThinkingLevel,
} from '../types/settings';
import type { BuiltinProvider, ProviderAccount } from '../types/provider-account';
import type { ProjectAgentOverrides } from '../types/project';
import type { TaskMetadata } from '../types/task';

export interface ResolvedAgentSettings {
  /** Phase model settings (spec, planning, coding, qa) */
  phaseModels: PhaseModelConfig;
  /** Phase thinking level settings */
  phaseThinking: PhaseThinkingConfig;
  /** Feature model settings (insights, ideation, roadmap, githubIssues, githubPrs, utility, naming) */
  featureModels: FeatureModelConfig;
  /** Feature thinking level settings */
  featureThinking: FeatureThinkingConfig;
}

export type AgentSettingsSource =
  | { type: 'phase'; phase: 'spec' | 'planning' | 'coding' | 'qa' }
  | { type: 'feature'; feature: keyof FeatureModelConfig }
  | { type: 'fixed'; model: string; thinking: ThinkingLevel };

export interface AgentModelConfig {
  model: string;
  thinking: ThinkingLevel;
}

export function resolveProviderNativeModelId(model: string | undefined, provider?: BuiltinProvider | string | null, fallbackModel = 'sonnet'): string {
  const modelToResolve = model || fallbackModel;
  const anthropicModelId = MODEL_ID_MAP[modelToResolve] ?? modelToResolve;

  if (!provider || provider === 'anthropic') {
    return anthropicModelId;
  }

  return resolveModelEquivalent(modelToResolve, provider as BuiltinProvider)?.modelId
    ?? resolveModelEquivalent(anthropicModelId, provider as BuiltinProvider)?.modelId
    ?? modelToResolve;
}

function normalizeModelForProvider(model: string, provider?: BuiltinProvider): string {
  return provider ? resolveProviderNativeModelId(model, provider, model) : model;
}

function normalizePhaseModelsForProvider(models: PhaseModelConfig, provider?: BuiltinProvider): PhaseModelConfig {
  const normalized = {
    spec: normalizeModelForProvider(models.spec, provider),
    planning: normalizeModelForProvider(models.planning, provider),
    coding: normalizeModelForProvider(models.coding, provider),
    qa: normalizeModelForProvider(models.qa, provider),
  };

  return normalized.spec === models.spec
    && normalized.planning === models.planning
    && normalized.coding === models.coding
    && normalized.qa === models.qa
    ? models
    : normalized;
}

function normalizeFeatureModelsForProvider(models: FeatureModelConfig, provider?: BuiltinProvider): FeatureModelConfig {
  const normalized = {
    insights: normalizeModelForProvider(models.insights, provider),
    ideation: normalizeModelForProvider(models.ideation, provider),
    roadmap: normalizeModelForProvider(models.roadmap, provider),
    githubIssues: normalizeModelForProvider(models.githubIssues, provider),
    githubPrs: normalizeModelForProvider(models.githubPrs, provider),
    utility: normalizeModelForProvider(models.utility, provider),
    naming: normalizeModelForProvider(models.naming, provider),
  };

  return normalized.insights === models.insights
    && normalized.ideation === models.ideation
    && normalized.roadmap === models.roadmap
    && normalized.githubIssues === models.githubIssues
    && normalized.githubPrs === models.githubPrs
    && normalized.utility === models.utility
    && normalized.naming === models.naming
    ? models
    : normalized;
}

/**
 * Resolve effective agent settings based on provider, mixed config, profile,
 * and custom overrides. This preserves the behavior previously implemented in
 * useResolvedAgentSettings.
 */
export function resolveEffectiveAgentSettings(
  settings: AppSettings,
  provider?: BuiltinProvider,
  projectOverrides?: ProjectAgentOverrides,
): ResolvedAgentSettings {
  const mixedProfileActive = projectOverrides?.customMixedProfileActive ?? settings.customMixedProfileActive;
  const mixedPhaseConfig = projectOverrides?.customMixedPhaseConfig ?? settings.customMixedPhaseConfig;

  if (mixedProfileActive && mixedPhaseConfig) {
    const mixed = mixedPhaseConfig;
    const phaseModels: PhaseModelConfig = {
      spec: mixed.spec.modelId,
      planning: mixed.planning.modelId,
      coding: mixed.coding.modelId,
      qa: mixed.qa.modelId,
    };
    const phaseThinking: PhaseThinkingConfig = {
      spec: mixed.spec.thinkingLevel,
      planning: mixed.planning.thinkingLevel,
      coding: mixed.coding.thinkingLevel,
      qa: mixed.qa.thinkingLevel,
    };

    const mixedFeature = projectOverrides?.customMixedFeatureConfig ?? settings.customMixedFeatureConfig;
    const featureModels: FeatureModelConfig = mixedFeature
      ? {
          insights: mixedFeature.insights.modelId,
          ideation: mixedFeature.ideation.modelId,
          roadmap: mixedFeature.roadmap.modelId,
          githubIssues: mixedFeature.githubIssues.modelId,
          githubPrs: mixedFeature.githubPrs.modelId,
          utility: mixedFeature.utility.modelId,
          naming: mixedFeature.naming?.modelId ?? 'haiku',
        }
      : projectOverrides?.featureModels ?? settings.featureModels ?? DEFAULT_FEATURE_MODELS;
    const featureThinking: FeatureThinkingConfig = mixedFeature
      ? {
          insights: mixedFeature.insights.thinkingLevel,
          ideation: mixedFeature.ideation.thinkingLevel,
          roadmap: mixedFeature.roadmap.thinkingLevel,
          githubIssues: mixedFeature.githubIssues.thinkingLevel,
          githubPrs: mixedFeature.githubPrs.thinkingLevel,
          utility: mixedFeature.utility.thinkingLevel,
          naming: mixedFeature.naming?.thinkingLevel ?? 'low',
        }
      : projectOverrides?.featureThinking ?? settings.featureThinking ?? DEFAULT_FEATURE_THINKING;

    return { phaseModels, phaseThinking, featureModels, featureThinking };
  }

  const appProviderConfig = provider ? settings.providerAgentConfig?.[provider] : undefined;
  const projectProviderConfig = provider ? projectOverrides?.providerAgentConfig?.[provider] : undefined;
  const providerConfig = appProviderConfig || projectProviderConfig
    ? { ...appProviderConfig, ...projectProviderConfig }
    : undefined;
  const selectedProfileId = projectProviderConfig?.selectedAgentProfile
    ?? projectOverrides?.selectedAgentProfile
    ?? appProviderConfig?.selectedAgentProfile
    ?? settings.selectedAgentProfile
    ?? 'auto';
  const presetDefaults = provider
    ? getProviderPresetOrFallback(provider, selectedProfileId)
    : null;

  const selectedProfile = DEFAULT_AGENT_PROFILES.find((profile) => profile.id === selectedProfileId) || DEFAULT_AGENT_PROFILES[0];
  const ollamaCategoryDefaults = provider === 'ollama' && isOllamaCategoryMappingComplete(providerConfig?.categoryModels)
    ? buildOllamaAgentConfigFromCategories(providerConfig.categoryModels)
    : null;
  const profilePhaseModels = ollamaCategoryDefaults?.customPhaseModels ?? presetDefaults?.phaseModels ?? selectedProfile.phaseModels ?? DEFAULT_PHASE_MODELS;
  const profilePhaseThinking = presetDefaults?.phaseThinking ?? selectedProfile.phaseThinking ?? DEFAULT_PHASE_THINKING;

  const phaseModels = projectProviderConfig?.customPhaseModels
    ?? projectOverrides?.customPhaseModels
    ?? appProviderConfig?.customPhaseModels
    ?? settings.customPhaseModels
    ?? profilePhaseModels;
  const phaseThinking = projectProviderConfig?.customPhaseThinking
    ?? projectOverrides?.customPhaseThinking
    ?? appProviderConfig?.customPhaseThinking
    ?? settings.customPhaseThinking
    ?? profilePhaseThinking;

  const providerFeatureModels = ollamaCategoryDefaults?.featureModels ?? (provider ? buildProviderDefaultFeatureModels(provider) : DEFAULT_FEATURE_MODELS);
  const providerFeatureThinking = ollamaCategoryDefaults?.featureThinking ?? (provider ? buildProviderDefaultFeatureThinking(provider) : DEFAULT_FEATURE_THINKING);
  const featureModels = projectProviderConfig?.featureModels
    ?? projectOverrides?.featureModels
    ?? appProviderConfig?.featureModels
    ?? (provider ? providerFeatureModels : settings.featureModels ?? DEFAULT_FEATURE_MODELS);
  const featureThinking = projectProviderConfig?.featureThinking
    ?? projectOverrides?.featureThinking
    ?? appProviderConfig?.featureThinking
    ?? (provider ? providerFeatureThinking : settings.featureThinking ?? DEFAULT_FEATURE_THINKING);

  return {
    phaseModels: normalizePhaseModelsForProvider(phaseModels, provider),
    phaseThinking,
    featureModels: normalizeFeatureModelsForProvider(featureModels, provider),
    featureThinking,
  };
}

export type AgentSettingSourceLabel =
  | 'taskSnapshot'
  | 'crossProviderOverride'
  | 'projectOverride'
  | 'perProviderOverride'
  | 'globalAdvancedOverride'
  | 'providerDefault'
  | 'globalPreset'
  | 'builtInDefault';

export interface ResolvedAgentSettingsSources {
  phaseModels: AgentSettingSourceLabel;
  phaseThinking: AgentSettingSourceLabel;
  featureModels: AgentSettingSourceLabel;
  featureThinking: AgentSettingSourceLabel;
}

export function resolveEffectiveAgentSettingsSources(
  settings: AppSettings,
  provider?: BuiltinProvider,
  projectOverrides?: ProjectAgentOverrides,
): ResolvedAgentSettingsSources {
  const mixedProfileActive = projectOverrides?.customMixedProfileActive ?? settings.customMixedProfileActive;
  const mixedPhaseConfig = projectOverrides?.customMixedPhaseConfig ?? settings.customMixedPhaseConfig;

  if (mixedProfileActive && mixedPhaseConfig) {
    const phaseSource = projectOverrides?.customMixedPhaseConfig ? 'projectOverride' : 'crossProviderOverride';
    const featureSource = projectOverrides?.customMixedFeatureConfig ? 'projectOverride'
      : settings.customMixedFeatureConfig ? 'crossProviderOverride'
        : projectOverrides?.featureModels ? 'projectOverride'
          : settings.featureModels ? 'globalAdvancedOverride'
            : 'builtInDefault';
    const featureThinkingSource = projectOverrides?.customMixedFeatureConfig ? 'projectOverride'
      : settings.customMixedFeatureConfig ? 'crossProviderOverride'
        : projectOverrides?.featureThinking ? 'projectOverride'
          : settings.featureThinking ? 'globalAdvancedOverride'
            : 'builtInDefault';

    return {
      phaseModels: phaseSource,
      phaseThinking: phaseSource,
      featureModels: featureSource,
      featureThinking: featureThinkingSource,
    };
  }

  const projectProviderConfig = provider ? projectOverrides?.providerAgentConfig?.[provider] : undefined;
  const appProviderConfig = provider ? settings.providerAgentConfig?.[provider] : undefined;
  const providerFromProject = Boolean(provider && projectOverrides?.provider === provider);
  const projectProfileOverride = Boolean(projectProviderConfig?.selectedAgentProfile || projectOverrides?.selectedAgentProfile);
  const appProviderProfileOverride = Boolean(appProviderConfig?.selectedAgentProfile);
  const globalProfileOverride = Boolean(settings.selectedAgentProfile);

  const defaultPhaseSource: AgentSettingSourceLabel = providerFromProject || projectProfileOverride ? 'projectOverride'
    : appProviderProfileOverride ? 'perProviderOverride'
      : globalProfileOverride ? 'globalPreset'
        : provider ? 'providerDefault'
          : 'builtInDefault';
  const defaultFeatureSource: AgentSettingSourceLabel = providerFromProject ? 'projectOverride'
    : provider ? 'providerDefault'
      : 'builtInDefault';

  return {
    phaseModels: projectProviderConfig?.customPhaseModels ? 'projectOverride'
      : projectOverrides?.customPhaseModels ? 'projectOverride'
        : appProviderConfig?.customPhaseModels ? 'perProviderOverride'
          : settings.customPhaseModels ? 'globalAdvancedOverride'
            : defaultPhaseSource,
    phaseThinking: projectProviderConfig?.customPhaseThinking ? 'projectOverride'
      : projectOverrides?.customPhaseThinking ? 'projectOverride'
        : appProviderConfig?.customPhaseThinking ? 'perProviderOverride'
          : settings.customPhaseThinking ? 'globalAdvancedOverride'
            : defaultPhaseSource,
    featureModels: projectProviderConfig?.featureModels ? 'projectOverride'
      : projectOverrides?.featureModels ? 'projectOverride'
        : appProviderConfig?.featureModels ? 'perProviderOverride'
          : settings.featureModels ? 'globalAdvancedOverride'
            : defaultFeatureSource,
    featureThinking: projectProviderConfig?.featureThinking ? 'projectOverride'
      : projectOverrides?.featureThinking ? 'projectOverride'
        : appProviderConfig?.featureThinking ? 'perProviderOverride'
          : settings.featureThinking ? 'globalAdvancedOverride'
            : defaultFeatureSource,
  };
}

export function resolveProjectProvider(
  settings: Pick<AppSettings, 'globalPriorityOrder' | 'providerAccounts'>,
  projectOverrides?: ProjectAgentOverrides,
): BuiltinProvider | undefined {
  if (projectOverrides?.provider) {
    return projectOverrides.provider;
  }

  const priorityOrder = settings.globalPriorityOrder;
  const accounts = settings.providerAccounts;

  if (!priorityOrder?.length || !accounts?.length) return accounts?.[0]?.provider;

  for (const accountId of priorityOrder) {
    const account = accounts.find((candidate: ProviderAccount) => candidate.id === accountId);
    if (account?.provider) {
      return account.provider;
    }
  }

  return accounts[0]?.provider;
}

export interface TaskSnapshotAgentSettings {
  source: 'taskSnapshot';
  provider: BuiltinProvider | string | null;
  model?: string;
  thinking?: string;
}

export function resolveTaskSnapshotAgentSettings(
  metadata: {
    model?: string;
    thinkingLevel?: string;
    phaseModels?: Partial<Record<'planning' | 'coding' | 'qa' | 'spec', string>>;
    phaseThinking?: Partial<Record<'planning' | 'coding' | 'qa' | 'spec', string>>;
    phaseProviders?: Partial<Record<'planning' | 'coding' | 'qa' | 'spec', string>>;
    provider?: string;
  } | null | undefined,
  phase: 'planning' | 'coding' | 'qa' | 'spec',
): TaskSnapshotAgentSettings | null {
  if (!metadata) return null;

  const model = metadata.phaseModels?.[phase] ?? metadata.model;
  const thinking = metadata.phaseThinking?.[phase] ?? metadata.thinkingLevel;
  const provider = metadata.phaseProviders?.[phase] ?? metadata.provider ?? null;
  if (!model && !thinking && !provider) return null;

  return {
    source: 'taskSnapshot',
    provider,
    model,
    thinking,
  };
}

export function resolveTaskSnapshotPhaseProvider(
  metadata: Pick<TaskMetadata, 'phaseProviders' | 'provider'> | null | undefined,
  phase: 'planning' | 'coding' | 'qa' | 'spec',
): BuiltinProvider | string | null {
  return metadata?.phaseProviders?.[phase] ?? metadata?.provider ?? null;
}

export function resolveTaskSnapshotPhaseModelId(
  metadata: Parameters<typeof resolveTaskSnapshotAgentSettings>[0],
  phase: 'planning' | 'coding' | 'qa' | 'spec',
  fallbackModel?: string,
): string {
  const snapshot = resolveTaskSnapshotAgentSettings(metadata, phase);
  const provider = resolveTaskSnapshotPhaseProvider(metadata, phase);
  return resolveProviderNativeModelId(snapshot?.model ?? fallbackModel, provider, 'sonnet');
}

export function resolveAgentSettings(
  settingsSource: AgentSettingsSource,
  resolvedSettings: ResolvedAgentSettings,
): AgentModelConfig {
  if (settingsSource.type === 'phase') {
    return {
      model: resolvedSettings.phaseModels[settingsSource.phase],
      thinking: resolvedSettings.phaseThinking[settingsSource.phase],
    };
  }

  if (settingsSource.type === 'feature') {
    return {
      model: resolvedSettings.featureModels[settingsSource.feature],
      thinking: resolvedSettings.featureThinking[settingsSource.feature],
    };
  }

  return {
    model: settingsSource.model,
    thinking: settingsSource.thinking,
  };
}
