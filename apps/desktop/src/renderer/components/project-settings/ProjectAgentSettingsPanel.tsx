import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_AGENT_PROFILES,
  DEFAULT_FEATURE_MODELS,
  DEFAULT_FEATURE_THINKING,
  DEFAULT_PHASE_MODELS,
  DEFAULT_PHASE_THINKING,
  FEATURE_KEYS,
  PHASE_KEYS,
  THINKING_LEVELS,
} from '../../../shared/constants/models';
import { PROVIDER_REGISTRY } from '../../../shared/constants/providers';
import { resolveEffectiveAgentSettingsSources, resolveProjectProvider } from '../../../shared/utils/agent-settings-resolver';
import type { ProjectAgentOverrides, ProjectSettings as ProjectSettingsType } from '../../../shared/types';
import type { FeatureModelConfig, FeatureThinkingConfig, PhaseModelConfig, PhaseThinkingConfig, ThinkingLevel } from '../../../shared/types/settings';
import { useActiveProvider } from '../../hooks/useActiveProvider';
import { useSettingsStore } from '../../stores/settings-store';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface ProjectAgentSettingsPanelProps {
  settings: ProjectSettingsType;
  setSettings: React.Dispatch<React.SetStateAction<ProjectSettingsType>>;
}


export function ProjectAgentSettingsPanel({ settings, setSettings }: ProjectAgentSettingsPanelProps) {
  const { t } = useTranslation('settings');
  const appSettings = useSettingsStore((state) => state.settings);
  const { provider: currentProvider } = useActiveProvider();
  const overrides = settings.projectAgentOverrides;
  const effectiveProvider = resolveProjectProvider(appSettings, overrides) ?? currentProvider;
  const sources = resolveEffectiveAgentSettingsSources(appSettings, effectiveProvider ?? undefined, overrides);
  const [providerJson, setProviderJson] = useState(() => JSON.stringify(overrides?.providerAgentConfig ?? {}, null, 2));
  const [providerJsonError, setProviderJsonError] = useState<string | null>(null);
  const [mixedPhaseJson, setMixedPhaseJson] = useState(() => JSON.stringify(overrides?.customMixedPhaseConfig ?? null, null, 2));
  const [mixedFeatureJson, setMixedFeatureJson] = useState(() => JSON.stringify(overrides?.customMixedFeatureConfig ?? null, null, 2));
  const [mixedJsonError, setMixedJsonError] = useState<string | null>(null);

  useEffect(() => {
    setProviderJson(JSON.stringify(overrides?.providerAgentConfig ?? {}, null, 2));
    setProviderJsonError(null);
  }, [overrides?.providerAgentConfig]);

  useEffect(() => {
    setMixedPhaseJson(JSON.stringify(overrides?.customMixedPhaseConfig ?? null, null, 2));
    setMixedFeatureJson(JSON.stringify(overrides?.customMixedFeatureConfig ?? null, null, 2));
    setMixedJsonError(null);
  }, [overrides?.customMixedPhaseConfig, overrides?.customMixedFeatureConfig]);

  const updateOverrides = (patch: ProjectAgentOverrides) => {
    setSettings({
      ...settings,
      projectAgentOverrides: {
        ...(settings.projectAgentOverrides ?? {}),
        ...patch,
      },
    });
  };

  const removeOverrides = () => {
    const { projectAgentOverrides: _projectAgentOverrides, ...nextSettings } = settings;
    setSettings(nextSettings);
  };

  const phaseModels = overrides?.customPhaseModels ?? DEFAULT_PHASE_MODELS;
  const phaseThinking = overrides?.customPhaseThinking ?? DEFAULT_PHASE_THINKING;
  const featureModels = overrides?.featureModels ?? DEFAULT_FEATURE_MODELS;
  const featureThinking = overrides?.featureThinking ?? DEFAULT_FEATURE_THINKING;
  const sourceLabel = (source: string) => t(`projectSections.agentSettings.sourceLabels.${source}`);

  const updatePhaseModel = (phase: keyof PhaseModelConfig, model: string) => {
    updateOverrides({ customPhaseModels: { ...phaseModels, [phase]: model } });
  };

  const updatePhaseThinking = (phase: keyof PhaseThinkingConfig, thinking: ThinkingLevel) => {
    updateOverrides({ customPhaseThinking: { ...phaseThinking, [phase]: thinking } });
  };

  const updateFeatureModel = (feature: keyof FeatureModelConfig, model: string) => {
    updateOverrides({ featureModels: { ...featureModels, [feature]: model } });
  };

  const updateFeatureThinking = (feature: keyof FeatureThinkingConfig, thinking: ThinkingLevel) => {
    updateOverrides({ featureThinking: { ...featureThinking, [feature]: thinking } });
  };

  const saveProviderJson = () => {
    try {
      const parsed = JSON.parse(providerJson) as ProjectAgentOverrides['providerAgentConfig'];
      updateOverrides({ providerAgentConfig: parsed });
      setProviderJsonError(null);
    } catch (error) {
      setProviderJsonError(error instanceof Error ? error.message : t('projectSections.agentSettings.invalidProviderJson'));
    }
  };

  const saveMixedJson = () => {
    try {
      const parsedPhase = JSON.parse(mixedPhaseJson) as ProjectAgentOverrides['customMixedPhaseConfig'] | null;
      const parsedFeature = JSON.parse(mixedFeatureJson) as ProjectAgentOverrides['customMixedFeatureConfig'] | null;
      updateOverrides({
        customMixedPhaseConfig: parsedPhase ?? undefined,
        customMixedFeatureConfig: parsedFeature ?? undefined,
      });
      setMixedJsonError(null);
    } catch (error) {
      setMixedJsonError(error instanceof Error ? error.message : t('projectSections.agentSettings.invalidMixedJson'));
    }
  };

  if (!overrides) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label className="font-normal text-foreground">{t('projectSections.general.agentOverrides')}</Label>
            <p className="text-xs text-muted-foreground">{t('projectSections.general.agentOverridesInherited')}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSettings({ ...settings, projectAgentOverrides: { selectedAgentProfile: 'auto' } })}
          >
            {t('projectSections.general.overrideForProject')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label className="font-normal text-foreground">{t('projectSections.agentSettings.title')}</Label>
          <p className="text-xs text-muted-foreground">{t('projectSections.general.agentOverridesProject')}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={removeOverrides}>
          {t('projectSections.general.removeAgentOverride')}
        </Button>
      </div>

      <div className="grid gap-2 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground sm:grid-cols-2">
        <span>{t('projectSections.agentSettings.phaseModelSource')}: {sourceLabel(sources.phaseModels)}</span>
        <span>{t('projectSections.agentSettings.phaseThinkingSource')}: {sourceLabel(sources.phaseThinking)}</span>
        <span>{t('projectSections.agentSettings.featureModelSource')}: {sourceLabel(sources.featureModels)}</span>
        <span>{t('projectSections.agentSettings.featureThinkingSource')}: {sourceLabel(sources.featureThinking)}</span>
      </div>

      <div className="max-w-xs space-y-2">
        <Label className="text-sm font-medium text-foreground">{t('projectSections.agentSettings.projectProvider')}</Label>
        <Select
          value={overrides.provider ?? 'inherit'}
          onValueChange={(value) => updateOverrides({ provider: value === 'inherit' ? undefined : value as ProjectAgentOverrides['provider'] })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="inherit">{t('projectSections.agentSettings.inheritProvider')}</SelectItem>
            {PROVIDER_REGISTRY.map((provider) => (
              <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="max-w-xs space-y-2">
        <Label className="text-sm font-medium text-foreground">{t('projectSections.general.projectAgentProfile')}</Label>
        <Select
          value={overrides.selectedAgentProfile ?? 'auto'}
          onValueChange={(value) => updateOverrides({ selectedAgentProfile: value })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {DEFAULT_AGENT_PROFILES.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>{t(`agentProfile.profiles.${profile.id}.name`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
        <div>
          <Label className="text-sm font-medium text-foreground">{t('projectSections.agentSettings.mixedProfileActive')}</Label>
          <p className="text-xs text-muted-foreground">{t('projectSections.agentSettings.mixedProfileDescription')}</p>
        </div>
        <Button
          type="button"
          variant={overrides.customMixedProfileActive ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateOverrides({ customMixedProfileActive: !overrides.customMixedProfileActive })}
        >
          {overrides.customMixedProfileActive ? t('projectSections.diagnostics.yes') : t('projectSections.diagnostics.no')}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">{t('projectSections.agentSettings.mixedPhaseJson')}</Label>
          <textarea
            value={mixedPhaseJson}
            onChange={(event) => setMixedPhaseJson(event.target.value)}
            onBlur={saveMixedJson}
            className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground"
            spellCheck={false}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">{t('projectSections.agentSettings.mixedFeatureJson')}</Label>
          <textarea
            value={mixedFeatureJson}
            onChange={(event) => setMixedFeatureJson(event.target.value)}
            onBlur={saveMixedJson}
            className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground"
            spellCheck={false}
          />
        </div>
      </div>
      {mixedJsonError && <p className="text-xs text-destructive">{mixedJsonError}</p>}

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">{t('projectSections.agentSettings.phaseOverrides')}</h4>
        {PHASE_KEYS.map((phase) => (
          <div key={phase} className="grid gap-2 sm:grid-cols-[1fr_1fr_160px] sm:items-end">
            <Label className="text-xs text-muted-foreground">{t(`agentProfile.phases.${phase}.label`)}</Label>
            <Input value={phaseModels[phase]} onChange={(event) => updatePhaseModel(phase, event.target.value)} />
            <Select value={phaseThinking[phase]} onValueChange={(value) => updatePhaseThinking(phase, value as ThinkingLevel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {THINKING_LEVELS.map((level) => <SelectItem key={level.value} value={level.value}>{t(`projectSections.agentSettings.thinkingLevels.${level.value}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">{t('projectSections.agentSettings.featureOverrides')}</h4>
        {FEATURE_KEYS.map((feature) => (
          <div key={feature} className="grid gap-2 sm:grid-cols-[1fr_1fr_160px] sm:items-end">
            <Label className="text-xs text-muted-foreground">{t(`projectSections.agentSettings.features.${feature}`)}</Label>
            <Input value={featureModels[feature]} onChange={(event) => updateFeatureModel(feature, event.target.value)} />
            <Select value={featureThinking[feature]} onValueChange={(value) => updateFeatureThinking(feature, value as ThinkingLevel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {THINKING_LEVELS.map((level) => <SelectItem key={level.value} value={level.value}>{t(`projectSections.agentSettings.thinkingLevels.${level.value}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">{t('projectSections.agentSettings.providerJson')}</Label>
        <textarea
          value={providerJson}
          onChange={(event) => setProviderJson(event.target.value)}
          onBlur={saveProviderJson}
          className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground"
          spellCheck={false}
        />
        {providerJsonError && <p className="text-xs text-destructive">{providerJsonError}</p>}
        <p className="text-xs text-muted-foreground">{t('projectSections.agentSettings.providerJsonDescription')}</p>
      </div>
    </div>
  );
}
