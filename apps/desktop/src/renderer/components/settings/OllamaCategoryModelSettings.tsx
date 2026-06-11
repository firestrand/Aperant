import { useTranslation } from 'react-i18next';
import { saveProviderAgentConfig, useSettingsStore } from '../../stores/settings-store';
import { MultiProviderModelSelect } from './MultiProviderModelSelect';
import type { OllamaCategoryModelConfig, OllamaRoleCategory } from '@shared/utils/ollama-agent-config';

const OLLAMA_CATEGORY_KEYS: readonly OllamaRoleCategory[] = [
  'reasoningHeavy',
  'coding',
  'review',
  'fastUtility',
  'chat',
] as const;

const EMPTY_CATEGORY_MODELS: Partial<OllamaCategoryModelConfig> = {};

export function OllamaCategoryModelSettings({ refreshTrigger }: { refreshTrigger?: number }) {
  const { t } = useTranslation('settings');
  const categoryModels = useSettingsStore(
    (state) => state.settings.providerAgentConfig?.ollama?.categoryModels ?? EMPTY_CATEGORY_MODELS,
  );

  const handleCategoryModelChange = async (category: OllamaRoleCategory, model: string) => {
    await saveProviderAgentConfig('ollama', {
      categoryModels: {
        ...categoryModels,
        [category]: model,
      },
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h4 className="text-base font-semibold text-foreground">
          {t('agentProfile.ollamaCategories.title')}
        </h4>
        <p className="text-sm text-muted-foreground">
          {t('agentProfile.ollamaCategories.description')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {OLLAMA_CATEGORY_KEYS.map((category) => (
          <div key={category} className="space-y-2">
            <div>
              <label className="text-sm font-medium text-foreground">
                {t(`agentProfile.ollamaCategories.${category}.label`)}
              </label>
              <p className="text-xs text-muted-foreground">
                {t(`agentProfile.ollamaCategories.${category}.description`)}
              </p>
            </div>
            <MultiProviderModelSelect
              value={categoryModels[category] ?? ''}
              onChange={(model) => handleCategoryModelChange(category, model)}
              filterProvider="ollama"
              refreshTrigger={refreshTrigger}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
