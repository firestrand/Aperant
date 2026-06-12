import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Sparkles } from 'lucide-react';

import type { AppSettings, LoadedSkill } from '../../../shared/types';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

interface SkillsSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  projectDir?: string;
}

export function SkillsSettings({ settings, onSettingsChange, projectDir }: SkillsSettingsProps) {
  const { t } = useTranslation('settings');
  const [skills, setSkills] = useState<LoadedSkill[]>([]);
  const [userSkillsDirectory, setUserSkillsDirectory] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translateSkillMessage = (message: string | undefined, fallback: string): string => {
    if (!message) return fallback;
    return message.startsWith('skills.') ? t(message) : message;
  };

  const loadSkills = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [skillsResult, directoryResult] = await Promise.all([
        window.electronAPI.listSkills(projectDir),
        window.electronAPI.getUserSkillsDirectory(),
      ]);
      if (skillsResult.success && skillsResult.data) {
        setSkills(skillsResult.data);
      } else {
        setError(translateSkillMessage(skillsResult.error, t('skills.loadError')));
      }
      if (directoryResult.success && directoryResult.data) {
        setUserSkillsDirectory(directoryResult.data);
      }
    } catch (caught) {
      setError(translateSkillMessage(caught instanceof Error ? caught.message : undefined, t('skills.loadError')));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (settings.skillsEnabled === true) {
      void loadSkills();
      return;
    }

    setSkills([]);
    setUserSkillsDirectory('');
    setError(null);
    setIsLoading(false);
  }, [settings.skillsEnabled, projectDir]);

  const toggleSkill = async (skillId: string, enabled: boolean) => {
    const result = await window.electronAPI.setSkillEnabled(skillId, enabled, projectDir);
    if (result.success) {
      setSkills((current) => current.map((skill) => (
        skill.manifest.id === skillId ? { ...skill, enabled } : skill
      )));
    } else {
      setError(translateSkillMessage(result.error, t('skills.toggleError')));
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div className="space-y-1">
            <Label className="text-sm font-medium text-foreground">
              {t('skills.title')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('skills.description')}
            </p>
            {userSkillsDirectory && (
              <p className="text-xs text-muted-foreground">
                {t('skills.userDirectory')}: <code className="rounded bg-muted px-1 py-0.5">{userSkillsDirectory}</code>
              </p>
            )}
          </div>
        </div>
        <Switch
          checked={settings.skillsEnabled === true}
          onCheckedChange={(checked) => onSettingsChange({ ...settings, skillsEnabled: checked })}
          aria-label={t('skills.toggleGlobal')}
        />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
        <p className="text-xs text-muted-foreground">
          {t('skills.count', { count: skills.length })}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={loadSkills} disabled={isLoading || settings.skillsEnabled !== true}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {isLoading ? t('skills.loading') : t('skills.reload')}
        </Button>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {skills.length === 0 ? (
          <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            {t('skills.empty')}
          </div>
        ) : skills.map((skill) => (
          <div key={`${skill.directory}:${skill.manifest.id}`} className="rounded-lg bg-muted/40 p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">{skill.manifest.name}</div>
                <p className="text-xs text-muted-foreground">{translateSkillMessage(skill.manifest.description, skill.manifest.description)}</p>
                <p className="text-xs text-muted-foreground">
                  {t('skills.surfaces')}: {skill.manifest.surfaces.map((surface) => t(`skills.surfaceLabels.${surface}`)).join(', ')}
                </p>
                {skill.loadError && (
                  <p className="text-xs text-destructive">{translateSkillMessage(skill.loadError, t('skills.loadError'))}</p>
                )}
              </div>
              <Switch
                checked={skill.enabled}
                disabled={Boolean(skill.loadError) || settings.skillsEnabled !== true}
                onCheckedChange={(checked) => toggleSkill(skill.manifest.id, checked)}
                aria-label={t('skills.toggleSkill', { name: skill.manifest.name })}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
