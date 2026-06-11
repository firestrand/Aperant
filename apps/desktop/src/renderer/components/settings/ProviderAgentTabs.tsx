import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useActiveProvider } from '../../hooks/useActiveProvider';
import { PROVIDER_REGISTRY } from '@shared/constants/providers';
import type { BuiltinProvider } from '@shared/types/provider-account';
import { ProviderTabBar } from './ProviderTabBar';
import { AgentProfileSettings } from './AgentProfileSettings';
import { FeatureModelSettings } from './FeatureModelSettings';
import { CrossProviderTabContent } from './CrossProviderTabContent';
import { OllamaModelManager } from './OllamaModelManager';
import { OllamaCategoryModelSettings } from './OllamaCategoryModelSettings';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { saveProviderAgentConfig, saveSettings, useSettingsStore } from '../../stores/settings-store';
import { resolveAgentSettingsMode } from '@shared/utils/agent-settings-mode';
import { isOllamaAgentConfigComplete } from '@shared/utils/ollama-agent-config';
import {
  buildSimpleModeFeatureModels,
  buildSimpleModeFeatureThinking,
  buildSimpleModePhaseModels,
  buildSimpleModePhaseThinking,
  resolveSimpleModeBaseModel,
} from '@shared/constants/models';

/**
 * ProviderAgentTabs
 *
 * Orchestrator wrapper for the entire agent settings section.
 * Shows a provider tab bar and renders agent/feature/override settings
 * scoped to the selected provider.
 */
export function ProviderAgentTabs() {
  const { t } = useTranslation('settings');
  const { connectedProviders, orderedAccounts, provider: activeProvider } = useActiveProvider();
  const settings = useSettingsStore((s) => s.settings);
  const providerAccounts = useSettingsStore((s) => s.providerAccounts);
  const setQueueOrder = useSettingsStore((s) => s.setQueueOrder);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const needsSetup = useCallback((provider: BuiltinProvider): boolean => {
    if (provider !== 'ollama') return false;
    return !isOllamaAgentConfigComplete(settings.providerAgentConfig?.ollama);
  }, [settings.providerAgentConfig]);

  // Use the same provider order as execution: first account in globalPriorityOrder wins.
  const orderedProviders = useMemo<BuiltinProvider[]>(() => {
    const ordered = orderedAccounts.map((account) => account.provider);
    return [...new Set([...ordered, ...connectedProviders])];
  }, [connectedProviders, orderedAccounts]);

  const [activeTab, setActiveTab] = useState<BuiltinProvider | 'cross-provider' | null>(activeProvider);

  const requestedProviderTab = activeTab !== 'cross-provider' ? activeTab : null;
  const modeProvider = requestedProviderTab && orderedProviders.includes(requestedProviderTab)
    ? requestedProviderTab
    : activeProvider && orderedProviders.includes(activeProvider)
      ? activeProvider
      : orderedProviders[0] ?? null;
  const activeMode = resolveAgentSettingsMode(modeProvider ? settings.providerAgentConfig?.[modeProvider] : undefined);
  const isAdvancedMode = activeMode === 'advanced';
  const isCrossProviderActive = isAdvancedMode && activeTab === 'cross-provider';

  // Keep active tab valid when providers change; fall back to first in list.
  // When cross-provider is active, resolvedTab is null (no provider selected).
  const resolvedTab: BuiltinProvider | null =
    isCrossProviderActive
      ? null
      : requestedProviderTab && orderedProviders.includes(requestedProviderTab)
        ? requestedProviderTab
        : modeProvider;

  const selectedProviderAccount = resolvedTab
    ? orderedAccounts.find((account) => account.provider === resolvedTab)
      ?? providerAccounts.find((account) => account.provider === resolvedTab)
    : undefined;
  const isSelectedProviderDefault = resolvedTab !== null && resolvedTab === activeProvider;

  const handleMakeDefaultProvider = useCallback(async () => {
    if (!selectedProviderAccount) return;
    const accountIds = providerAccounts.map((account) => account.id);
    const currentOrder = settings.globalPriorityOrder ?? [];
    const normalizedOrder = [
      ...currentOrder.filter((id) => accountIds.includes(id)),
      ...accountIds.filter((id) => !currentOrder.includes(id)),
    ];
    await setQueueOrder([
      selectedProviderAccount.id,
      ...normalizedOrder.filter((id) => id !== selectedProviderAccount.id),
    ]);
  }, [providerAccounts, selectedProviderAccount, setQueueOrder, settings.globalPriorityOrder]);

  const handleModeChange = useCallback(async (mode: 'simple' | 'advanced') => {
    if (!modeProvider || activeMode === mode) return;
    if (mode === 'simple' && activeTab === 'cross-provider') {
      await saveSettings({ customMixedProfileActive: false });
      setActiveTab(modeProvider);
    }

    const providerConfig = settings.providerAgentConfig?.[modeProvider];
    const selectedProfile = providerConfig?.selectedAgentProfile ?? settings.selectedAgentProfile ?? 'auto';
    const simpleBaseModel = resolveSimpleModeBaseModel(modeProvider, selectedProfile, providerConfig?.simpleBaseModel);

    if (mode === 'advanced') {
      await saveProviderAgentConfig(modeProvider, {
        mode,
        simpleBaseModel,
        customPhaseModels: buildSimpleModePhaseModels(simpleBaseModel),
        customPhaseThinking: buildSimpleModePhaseThinking(modeProvider, selectedProfile),
        featureModels: buildSimpleModeFeatureModels(simpleBaseModel),
        featureThinking: buildSimpleModeFeatureThinking(modeProvider),
      });
      return;
    }

    await saveProviderAgentConfig(modeProvider, { mode, simpleBaseModel });
  }, [activeMode, activeTab, modeProvider, settings.providerAgentConfig, settings.selectedAgentProfile]);

  if (orderedProviders.length === 0) {
    return (
      <div className="rounded-lg bg-muted/50 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {t('agentProfile.providerTabs.noProviders')}
        </p>
      </div>
    );
  }

  const providerDisplayName =
    resolvedTab !== null
      ? (PROVIDER_REGISTRY.find((p) => p.id === resolvedTab)?.name ?? resolvedTab)
      : '';

  return (
    <div className="space-y-6">
      {/* Section heading */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">{t('agentProfile.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('agentProfile.sectionDescription')}</p>
      </div>
      <Separator />

      {/* Tab strip (below heading) */}
      <ProviderTabBar
        providers={orderedProviders}
        activeProvider={resolvedTab}
        defaultProvider={activeProvider}
        onProviderChange={(provider) => {
          if (isCrossProviderActive) {
            saveSettings({ customMixedProfileActive: false });
          }
          setActiveTab(provider);
          setRefreshTrigger(prev => prev + 1);
        }}
        showCrossProvider={isAdvancedMode}
        isCrossProviderActive={isCrossProviderActive}
        onCrossProviderClick={() => setActiveTab('cross-provider')}
        crossProviderDisabled={connectedProviders.length < 2}
        needsSetup={needsSetup}
      />

      {isCrossProviderActive ? (
        <CrossProviderTabContent />
      ) : (
        <>
          {/* Subtitle */}
          {resolvedTab !== null && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t('agentProfile.providerTabs.configureFor', { provider: providerDisplayName })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isSelectedProviderDefault
                    ? t('agentProfile.providerTabs.defaultProviderDescription')
                    : t('agentProfile.providerTabs.notDefaultProviderDescription')}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1" aria-label={t('agentProfile.mode.label')}>
                  <Button
                    type="button"
                    size="sm"
                    variant={activeMode === 'simple' ? 'default' : 'ghost'}
                    onClick={() => handleModeChange('simple')}
                    className="h-7 px-2 text-xs"
                  >
                    {t('agentProfile.mode.simple')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={activeMode === 'advanced' ? 'default' : 'ghost'}
                    onClick={() => handleModeChange('advanced')}
                    className="h-7 px-2 text-xs"
                  >
                    {t('agentProfile.mode.advanced')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {activeMode === 'advanced'
                    ? t('agentProfile.mode.advancedDescription')
                    : t('agentProfile.mode.simpleDescription')}
                </p>
                {selectedProviderAccount && (
                  isSelectedProviderDefault ? (
                    <div className="flex h-8 items-center rounded-md border border-primary/30 bg-primary/10 px-3 text-xs font-medium text-primary">
                      {t('agentProfile.providerTabs.currentDefault')}
                    </div>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={handleMakeDefaultProvider}>
                      {t('agentProfile.providerTabs.makeDefault')}
                    </Button>
                  )
                )}
              </div>
            </div>
          )}

          {/* Provider-scoped agent profile settings */}
          <AgentProfileSettings provider={resolvedTab ?? undefined} refreshTrigger={refreshTrigger} advanced={isAdvancedMode} />

          {/* Provider-scoped feature model settings */}
          {isAdvancedMode && resolvedTab && <FeatureModelSettings provider={resolvedTab} refreshTrigger={refreshTrigger} />}

          {/* Ollama role mapping and model management */}
          {resolvedTab === 'ollama' && (
            <>
              <OllamaCategoryModelSettings refreshTrigger={refreshTrigger} />
              <OllamaModelManager />
            </>
          )}
        </>
      )}
    </div>
  );
}
