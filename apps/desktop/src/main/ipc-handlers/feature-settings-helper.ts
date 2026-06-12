import { DEFAULT_FEATURE_MODELS, DEFAULT_FEATURE_THINKING } from '../../shared/constants/models';
import { resolveEffectiveAgentSettings, resolveProjectProvider } from '../../shared/utils/agent-settings-resolver';
import type { AppSettings, FeatureModelConfig } from '../../shared/types/settings';
import type { ProjectAgentOverrides } from '../../shared/types/project';
import { readSettingsFile } from '../settings-utils';

type FeatureKey = keyof FeatureModelConfig;

interface FeatureSettings {
  model: string;
  thinkingLevel: string;
}

function fallbackFeatureSettings(featureKey: FeatureKey): FeatureSettings {
  return {
    model: DEFAULT_FEATURE_MODELS[featureKey],
    thinkingLevel: DEFAULT_FEATURE_THINKING[featureKey],
  };
}

/**
 * Get feature model and thinking level for a specific feature runner.
 */
export function getActiveProviderFeatureSettings(
  featureKey: FeatureKey,
  projectOverrides?: ProjectAgentOverrides,
): FeatureSettings {
  const settings = readSettingsFile() as unknown as AppSettings | null;
  if (!settings) {
    return fallbackFeatureSettings(featureKey);
  }

  const activeProvider = resolveProjectProvider(settings, projectOverrides);
  const resolved = resolveEffectiveAgentSettings(settings, activeProvider, projectOverrides);

  return {
    model: resolved.featureModels[featureKey],
    thinkingLevel: resolved.featureThinking[featureKey],
  };
}
