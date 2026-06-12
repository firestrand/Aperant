import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Pencil, Plus, Trash2, Zap } from 'lucide-react';

import type { AppSettings, ScheduledTaskDefinition, ScheduledTaskRecurrence } from '../../../shared/types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

interface ScheduledTasksSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

const defaultRecurrence: ScheduledTaskRecurrence = { kind: 'daily', timeOfDay: '09:00' };

function formatScheduleDate(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  return new Date(value).toLocaleString();
}

function isScheduledTaskTranslationKey(value: string | undefined): value is string {
  return Boolean(value?.startsWith('scheduledTasks.errors.'));
}

export function ScheduledTasksSettings({ settings, onSettingsChange }: ScheduledTasksSettingsProps) {
  const { t } = useTranslation('settings');
  const [schedules, setSchedules] = useState<ScheduledTaskDefinition[]>([]);
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [recurrenceKind, setRecurrenceKind] = useState<'daily' | 'weekly'>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1]);
  const [autoStart, setAutoStart] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = settings.scheduledTasksEnabled === true;

  const loadSchedules = async () => {
    if (!enabled) {
      setSchedules([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.listScheduledTasks();
      if (result.success && result.data) {
        setSchedules(result.data);
      } else {
        setError(isScheduledTaskTranslationKey(result.error) ? t(result.error) : (result.error ?? t('scheduledTasks.loadError')));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSchedules();
  }, [enabled]);

  const resetForm = () => {
    setProjectId('');
    setName('');
    setPrompt('');
    setTimeOfDay('09:00');
    setRecurrenceKind('daily');
    setDaysOfWeek([1]);
    setAutoStart(false);
    setEditingScheduleId(null);
  };

  const recurrence: ScheduledTaskRecurrence = recurrenceKind === 'daily'
    ? { ...defaultRecurrence, timeOfDay }
    : { kind: 'weekly', timeOfDay, daysOfWeek };

  const editSchedule = (schedule: ScheduledTaskDefinition) => {
    setProjectId(schedule.projectId);
    setName(schedule.name);
    setPrompt(schedule.prompt);
    setTimeOfDay(schedule.recurrence.timeOfDay);
    setRecurrenceKind(schedule.recurrence.kind);
    setDaysOfWeek(schedule.recurrence.kind === 'weekly' ? schedule.recurrence.daysOfWeek : [1]);
    setAutoStart(schedule.autoStart);
    setEditingScheduleId(schedule.id);
    setError(null);
  };

  const submitSchedule = async () => {
    if (editingScheduleId) {
      const result = await window.electronAPI.updateScheduledTask(editingScheduleId, {
        projectId,
        name,
        prompt,
        recurrence,
        autoStart,
      });
      if (result.success && result.data) {
        setSchedules((current) => current.map((item) => item.id === editingScheduleId ? result.data! : item));
        resetForm();
      } else {
        setError(isScheduledTaskTranslationKey(result.error) ? t(result.error) : (result.error ?? t('scheduledTasks.updateError')));
      }
      return;
    }

    const result = await window.electronAPI.createScheduledTask({
      projectId,
      name,
      prompt,
      recurrence,
      enabled: false,
      autoStart,
    });

    if (result.success && result.data) {
      setSchedules((current) => [...current, result.data!]);
      resetForm();
    } else {
      setError(isScheduledTaskTranslationKey(result.error) ? t(result.error) : (result.error ?? t('scheduledTasks.createError')));
    }
  };

  const updateSchedule = async (schedule: ScheduledTaskDefinition, input: Partial<ScheduledTaskDefinition>) => {
    const result = await window.electronAPI.updateScheduledTask(schedule.id, input);
    if (result.success && result.data) {
      setSchedules((current) => current.map((item) => item.id === schedule.id ? result.data! : item));
    } else {
      setError(isScheduledTaskTranslationKey(result.error) ? t(result.error) : (result.error ?? t('scheduledTasks.updateError')));
    }
  };

  const deleteSchedule = async (scheduleId: string) => {
    const result = await window.electronAPI.deleteScheduledTask(scheduleId);
    if (result.success) {
      setSchedules((current) => current.filter((item) => item.id !== scheduleId));
    } else {
      setError(isScheduledTaskTranslationKey(result.error) ? t(result.error) : (result.error ?? t('scheduledTasks.deleteError')));
    }
  };

  const fireNow = async (scheduleId: string) => {
    const result = await window.electronAPI.fireScheduledTaskNow(scheduleId);
    if (result.success && result.data) {
      setSchedules((current) => current.map((item) => item.id === scheduleId ? result.data! : item));
    } else {
      setError(isScheduledTaskTranslationKey(result.error) ? t(result.error) : (result.error ?? t('scheduledTasks.fireError')));
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div className="space-y-1">
            <Label className="text-sm font-medium text-foreground">{t('scheduledTasks.title')}</Label>
            <p className="text-sm text-muted-foreground">{t('scheduledTasks.description')}</p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => onSettingsChange({ ...settings, scheduledTasksEnabled: checked })}
          aria-label={t('scheduledTasks.toggle')}
        />
      </div>

      {enabled && (
        <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Input placeholder={t('scheduledTasks.projectId')} value={projectId} onChange={(event) => setProjectId(event.target.value)} />
            <Input placeholder={t('scheduledTasks.name')} value={name} onChange={(event) => setName(event.target.value)} />
            <Input placeholder={t('scheduledTasks.prompt')} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            <Input type="time" value={timeOfDay} onChange={(event) => setTimeOfDay(event.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <label className="flex items-center gap-2">
              {t('scheduledTasks.recurrence')}
              <select
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                value={recurrenceKind}
                onChange={(event) => setRecurrenceKind(event.target.value as 'daily' | 'weekly')}
              >
                <option value="daily">{t('scheduledTasks.daily')}</option>
                <option value="weekly">{t('scheduledTasks.weekly')}</option>
              </select>
            </label>
            {recurrenceKind === 'weekly' && [0, 1, 2, 3, 4, 5, 6].map((day) => (
              <label key={day} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={daysOfWeek.includes(day)}
                  onChange={(event) => setDaysOfWeek((current) => event.target.checked
                    ? Array.from(new Set([...current, day])).sort()
                    : current.filter((value) => value !== day))}
                />
                {t(`scheduledTasks.days.${day}`)}
              </label>
            ))}
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={autoStart} onChange={(event) => setAutoStart(event.target.checked)} />
              {t('scheduledTasks.autoStart')}
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={submitSchedule} disabled={!projectId || !name || !prompt || (recurrenceKind === 'weekly' && daysOfWeek.length === 0)}>
              <Plus className="mr-2 h-4 w-4" />
              {editingScheduleId ? t('scheduledTasks.save') : t('scheduledTasks.create')}
            </Button>
            {editingScheduleId && (
              <Button type="button" size="sm" variant="outline" onClick={resetForm}>
                {t('scheduledTasks.cancelEdit')}
              </Button>
            )}
          </div>

          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

          <div className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t('scheduledTasks.loading')}</p>
            ) : schedules.length === 0 ? (
              <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{t('scheduledTasks.empty')}</p>
            ) : schedules.map((schedule) => (
              <div key={schedule.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-medium text-foreground">{schedule.name}</div>
                  <p className="text-xs text-muted-foreground">{schedule.prompt}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t('scheduledTasks.nextRun')}: {formatScheduleDate(schedule.nextRunAt, t('scheduledTasks.notScheduled'))}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t(`scheduledTasks.${schedule.recurrence.kind}`)} · {schedule.recurrence.timeOfDay} · {schedule.autoStart ? t('scheduledTasks.autoStartOn') : t('scheduledTasks.autoStartOff')}
                  </p>
                  {schedule.lastError && (
                    <p className="text-xs text-destructive">
                      {isScheduledTaskTranslationKey(schedule.lastError) ? t(schedule.lastError) : schedule.lastError}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={schedule.autoStart}
                    onCheckedChange={(checked) => updateSchedule(schedule, { autoStart: checked })}
                    aria-label={t('scheduledTasks.toggleAutoStart', { name: schedule.name })}
                  />
                  <Switch
                    checked={schedule.enabled}
                    onCheckedChange={(checked) => updateSchedule(schedule, { enabled: checked })}
                    aria-label={t('scheduledTasks.enableSchedule', { name: schedule.name })}
                  />
                  <Button type="button" size="icon" variant="outline" onClick={() => editSchedule(schedule)} aria-label={t('scheduledTasks.editSchedule', { name: schedule.name })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="outline" onClick={() => fireNow(schedule.id)}>
                    <Zap className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="outline" onClick={() => deleteSchedule(schedule.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
