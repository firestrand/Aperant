import type { PerProviderAgentConfig } from '../types/settings';

export type AgentSettingsMode = 'simple' | 'advanced';

export function resolveAgentSettingsMode(config?: Pick<PerProviderAgentConfig, 'mode'> | null): AgentSettingsMode {
  return config?.mode === 'advanced' ? 'advanced' : 'simple';
}

export function isAdvancedAgentSettingsMode(config?: Pick<PerProviderAgentConfig, 'mode'> | null): boolean {
  return resolveAgentSettingsMode(config) === 'advanced';
}
