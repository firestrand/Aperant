import type { ProjectSettings } from '../../../shared/types';

interface AgentConfigSectionProps {
  settings: ProjectSettings;
  onUpdateSettings: (updates: Partial<ProjectSettings>) => void;
}

/**
 * @deprecated Project-specific agent model configuration now lives in explicit
 * projectAgentOverrides. Keep this component as a no-op compatibility export
 * until the project settings section cleanup removes the stale route entirely.
 */
export function AgentConfigSection(_props: AgentConfigSectionProps) {
  return null;
}
