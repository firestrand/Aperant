import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AppSettings } from '../../../shared/types';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

interface TaskAttachmentsSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export function TaskAttachmentsSettings({ settings, onSettingsChange }: TaskAttachmentsSettingsProps) {
  const { t } = useTranslation('settings');
  const enabled = settings.taskAttachmentsEnabled === true;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div className="space-y-1">
            <Label className="text-sm font-medium text-foreground">{t('taskAttachments.title')}</Label>
            <p className="text-sm text-muted-foreground">{t('taskAttachments.description')}</p>
            <p className="text-xs text-muted-foreground">{t('taskAttachments.safety')}</p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => onSettingsChange({ ...settings, taskAttachmentsEnabled: checked })}
          aria-label={t('taskAttachments.toggle')}
        />
      </div>
    </div>
  );
}
