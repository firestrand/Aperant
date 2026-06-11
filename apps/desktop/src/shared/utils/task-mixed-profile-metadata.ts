import type { ProjectAgentOverrides } from '../types/project';
import type { AppSettings, MixedPhaseConfig } from '../types/settings';
import type { TaskMetadata } from '../types/task';

export function resolveEffectiveMixedPhaseConfig(
  settings: AppSettings,
  projectOverrides?: ProjectAgentOverrides,
): MixedPhaseConfig | undefined {
  const mixedProfileActive = projectOverrides?.customMixedProfileActive ?? settings.customMixedProfileActive;
  return mixedProfileActive
    ? projectOverrides?.customMixedPhaseConfig ?? settings.customMixedPhaseConfig
    : undefined;
}

export function applyMixedPhaseConfigToTaskMetadata(
  metadata: TaskMetadata,
  mixed: MixedPhaseConfig | undefined,
): void {
  if (!mixed) return;

  metadata.phaseModels = {
    spec: mixed.spec.modelId,
    planning: mixed.planning.modelId,
    coding: mixed.coding.modelId,
    qa: mixed.qa.modelId,
  };
  metadata.phaseThinking = {
    spec: mixed.spec.thinkingLevel,
    planning: mixed.planning.thinkingLevel,
    coding: mixed.coding.thinkingLevel,
    qa: mixed.qa.thinkingLevel,
  };
  metadata.phaseProviders = {
    spec: mixed.spec.provider,
    planning: mixed.planning.provider,
    coding: mixed.coding.provider,
    qa: mixed.qa.provider,
  };
  metadata.isAutoProfile = true;
}
