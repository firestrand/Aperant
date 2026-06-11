/**
 * Agent Settings Resolution Hook
 *
 * Thin React wrapper around the shared pure agent settings resolver.
 */

import { useMemo } from 'react';
import type { AppSettings } from '../../shared/types/settings';
import type { BuiltinProvider } from '../../shared/types/provider-account';
import type { ProjectAgentOverrides } from '../../shared/types/project';
import {
  resolveAgentSettings,
  resolveEffectiveAgentSettings,
  type AgentModelConfig,
  type AgentSettingsSource,
  type ResolvedAgentSettings,
} from '../../shared/utils/agent-settings-resolver';

export type { AgentModelConfig, AgentSettingsSource, ResolvedAgentSettings };
export { resolveAgentSettings, resolveEffectiveAgentSettings };

/**
 * Hook to resolve agent settings based on provider, mixed config, profile, and custom overrides.
 */
export function useResolvedAgentSettings(
  settings: AppSettings,
  provider?: BuiltinProvider,
  projectOverrides?: ProjectAgentOverrides,
): ResolvedAgentSettings {
  return useMemo(
    () => resolveEffectiveAgentSettings(settings, provider, projectOverrides),
    [settings, provider, projectOverrides],
  );
}
