import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, ClipboardList, FileJson, FolderPlus, Loader2, Network } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Textarea } from './ui/textarea';
import { AddProjectModal } from './AddProjectModal';
import { useToast } from '../hooks/use-toast';
import { useProjectStore } from '../stores/project-store';
import { createWorkItemsFromImplementationPlan, loadTasks, useTaskStore } from '../stores/task-store';
import type { ImplementationPlan, Phase, PlanSubtask, SubtaskStatus, Task } from '../../shared/types';

interface WorkItemsProps {
  projectId: string;
}

interface ParseResult {
  plan: ImplementationPlan | null;
  error: string | null;
}

interface ParseLabels {
  subtaskFallback: (index: number) => string;
  phaseFallback: (phaseNumber: number) => string;
  pastedSpecFile: string;
  importedSpecPhase: string;
  importedSpecSubtask: string;
}

type DraftWorkflowStage = 'ideation' | 'review' | 'revise' | 'approved';

const defaultParseLabels: ParseLabels = {
  subtaskFallback: (index) => `Subtask ${index + 1}`,
  phaseFallback: (phaseNumber) => `Phase ${phaseNumber}`,
  pastedSpecFile: 'pasted-plan.json',
  importedSpecPhase: 'Imported spec',
  importedSpecSubtask: 'Review source document',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asDependencyArray(value: unknown): Array<string | number> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const dependencies = value.filter((item): item is string | number => typeof item === 'string' || typeof item === 'number');
  return dependencies.length > 0 ? dependencies : undefined;
}

function asSubtaskStatus(value: unknown): SubtaskStatus {
  return value === 'in_progress' || value === 'completed' || value === 'failed' ? value : 'pending';
}

function parseSubtask(value: unknown, index: number, labels: ParseLabels): PlanSubtask | null {
  if (!isRecord(value)) {
    return null;
  }

  const title = asString(value.title) || asString(value.description) || asString(value.name) || labels.subtaskFallback(index);
  const description = asString(value.description) || title;

  return {
    id: asString(value.id) || `subtask-${index + 1}`,
    title,
    description,
    status: asSubtaskStatus(value.status),
  };
}

function parsePhase(value: unknown, index: number, labels: ParseLabels): Phase | null {
  if (!isRecord(value)) {
    return null;
  }

  const phaseNumber = typeof value.phase === 'number' ? value.phase : index + 1;
  const name = asString(value.name) || asString(value.title) || labels.phaseFallback(phaseNumber);
  const rawSubtasks = Array.isArray(value.subtasks) ? value.subtasks : [];
  const subtasks = rawSubtasks
    .map((subtask, subtaskIndex) => parseSubtask(subtask, subtaskIndex, labels))
    .filter((subtask): subtask is PlanSubtask => subtask !== null);

  return {
    phase: phaseNumber,
    id: typeof value.id === 'string' || typeof value.id === 'number' ? value.id : phaseNumber,
    name,
    type: asString(value.type) || 'implementation',
    subtasks,
    depends_on: asDependencyArray(value.depends_on),
    parallel_safe: typeof value.parallel_safe === 'boolean' ? value.parallel_safe : undefined,
  };
}

function getImplementationPlanPath(task: Task): string | null {
  if (!task.specsPath) {
    return null;
  }

  return `${task.specsPath.replace(/[\\/]$/, '')}/implementation_plan.json`;
}

function getTaskOptionLabel(task: Task): string {
  return `${task.specId} — ${task.title}`;
}

function slugifyReference(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
}

function stripMarkdownPrefix(value: string): string {
  return value.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+|#{1,6}\s*)/, '').trim();
}

function parsePlainTextPlan(rawText: string, labels: ParseLabels): ImplementationPlan | null {
  const lines = rawText.split(/\r?\n/);
  const nonEmptyLines = lines.map((line) => line.trim()).filter(Boolean);

  if (nonEmptyLines.length === 0) {
    return null;
  }

  const titleLine = nonEmptyLines.find((line) => /^#\s+/.test(line)) || nonEmptyLines[0];
  const title = stripMarkdownPrefix(titleLine);
  const phases: Phase[] = [];
  let currentPhase: Phase | null = null;

  const finishCurrentPhase = () => {
    if (currentPhase) {
      if (currentPhase.subtasks.length === 0) {
        currentPhase.subtasks.push({
          id: `${currentPhase.id}-summary`,
          title: labels.importedSpecSubtask,
          description: title,
          status: 'pending',
        });
      }
      phases.push(currentPhase);
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const headingMatch = /^(?:#{2,4}\s+|phase\s+\d+[:.)-]\s*)(.+)$/i.exec(line);
    if (headingMatch) {
      finishCurrentPhase();
      const phaseNumber = phases.length + 1;
      const phaseName = stripMarkdownPrefix(headingMatch[1]);
      currentPhase = {
        phase: phaseNumber,
        id: slugifyReference(phaseName, `phase-${phaseNumber}`),
        name: phaseName || labels.phaseFallback(phaseNumber),
        type: 'spec',
        subtasks: [],
      };
      continue;
    }

    const taskMatch = /^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/.exec(line);
    if (taskMatch) {
      if (!currentPhase) {
        currentPhase = {
          phase: 1,
          id: 'imported-spec',
          name: labels.importedSpecPhase,
          type: 'spec',
          subtasks: [],
        };
      }

      const taskText = stripMarkdownPrefix(taskMatch[1]);
      const subtaskIndex = currentPhase.subtasks.length;
      currentPhase.subtasks.push({
        id: `${currentPhase.id}-item-${subtaskIndex + 1}`,
        title: taskText || labels.subtaskFallback(subtaskIndex),
        description: taskText || title,
        status: 'pending',
      });
    }
  }

  finishCurrentPhase();

  if (phases.length === 0) {
    phases.push({
      phase: 1,
      id: 'imported-spec',
      name: labels.importedSpecPhase,
      type: 'spec',
      subtasks: [{
        id: 'imported-spec-item-1',
        title: labels.importedSpecSubtask,
        description: rawText.trim(),
        status: 'pending',
      }],
    });
  }

  return {
    feature: title,
    title,
    workflow_type: 'work_items',
    services_involved: [],
    phases,
    final_acceptance: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    spec_file: labels.pastedSpecFile,
    description: rawText.trim(),
  };
}

function parseImplementationPlan(rawJson: string, labels: ParseLabels = defaultParseLabels): ParseResult {
  if (!rawJson.trim()) {
    return { plan: null, error: null };
  }

  try {
    const parsed: unknown = JSON.parse(rawJson);

    if (!isRecord(parsed)) {
      return { plan: null, error: 'invalidRoot' };
    }

    const rawPhases = parsed.phases;
    if (!Array.isArray(rawPhases) || rawPhases.length === 0) {
      return { plan: null, error: 'missingPhases' };
    }

    const phases = rawPhases
      .map((phase, index) => parsePhase(phase, index, labels))
      .filter((phase): phase is Phase => phase !== null);

    if (phases.length === 0) {
      return { plan: null, error: 'missingPhases' };
    }

    return {
      plan: {
        feature: asString(parsed.feature),
        title: asString(parsed.title),
        workflow_type: asString(parsed.workflow_type) || 'work_items',
        services_involved: asStringArray(parsed.services_involved),
        phases,
        final_acceptance: asStringArray(parsed.final_acceptance),
        created_at: asString(parsed.created_at) || new Date().toISOString(),
        updated_at: asString(parsed.updated_at) || new Date().toISOString(),
        spec_file: asString(parsed.spec_file) || labels.pastedSpecFile,
        description: asString(parsed.description),
      },
      error: null,
    };
  } catch {
    const trimmed = rawJson.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return { plan: null, error: 'invalidJson' };
    }

    const textPlan = parsePlainTextPlan(rawJson, labels);
    return textPlan ? { plan: textPlan, error: null } : { plan: null, error: 'missingPhases' };
  }
}

export function WorkItems({ projectId }: WorkItemsProps) {
  const { t } = useTranslation(['tasks']);
  const { toast } = useToast();
  const tasks = useTaskStore((state) => state.tasks);
  const projects = useProjectStore((state) => state.projects);
  const setActiveProject = useProjectStore((state) => state.setActiveProject);
  const openProjectTab = useProjectStore((state) => state.openProjectTab);
  const planSourceTasks = useMemo(
    () => tasks.filter((task) => getImplementationPlanPath(task) !== null),
    [tasks]
  );
  const [rawJson, setRawJson] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [targetProjectId, setTargetProjectId] = useState(projectId);
  const [draftStage, setDraftStage] = useState<DraftWorkflowStage>('ideation');
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isConfirmCreateOpen, setIsConfirmCreateOpen] = useState(false);
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const parseLabels = useMemo<ParseLabels>(() => ({
    subtaskFallback: (index) => t('workItems.fallbacks.subtask', { number: index + 1 }),
    phaseFallback: (phaseNumber) => t('workItems.fallbacks.phase', { number: phaseNumber }),
    pastedSpecFile: t('workItems.fallbacks.pastedSpecFile'),
    importedSpecPhase: t('workItems.fallbacks.importedSpecPhase'),
    importedSpecSubtask: t('workItems.fallbacks.importedSpecSubtask'),
  }), [t]);

  const parseResult = useMemo(() => parseImplementationPlan(rawJson, parseLabels), [rawJson, parseLabels]);
  const plan = parseResult.plan;
  const parseError = parseResult.error;
  const totalSubtasks = plan?.phases.reduce((total, phase) => total + phase.subtasks.length, 0) ?? 0;
  const totalDependencies = plan?.phases.reduce((total, phase) => total + (phase.depends_on?.length ?? 0), 0) ?? 0;
  const targetProject = projects.find((project) => project.id === targetProjectId);
  const targetProjectName = targetProject?.name ?? t('workItems.target.unknownProject');
  const isDraftApproved = draftStage === 'approved';
  const canRequestReview = Boolean(plan) && !parseError && draftStage !== 'review' && !isDraftApproved;
  const canApproveDraft = Boolean(plan) && !parseError && draftStage === 'review';
  const canCreateWorkItems = Boolean(plan) && !parseError && isDraftApproved && Boolean(targetProjectId);

  useEffect(() => {
    setTargetProjectId(projectId);
  }, [projectId]);

  const updateRawJson = (value: string) => {
    setRawJson(value);
    setDraftStage('ideation');
  };

  const handleLoadPlanFromTask = async () => {
    const task = planSourceTasks.find((candidate) => candidate.id === selectedTaskId);
    if (!task) {
      return;
    }

    const planPath = getImplementationPlanPath(task);
    if (!planPath) {
      return;
    }

    setIsLoadingPlan(true);
    try {
      const result = await window.electronAPI.readFile(planPath);
      if (!result.success || !result.data) {
        toast({
          title: t('workItems.loadErrorTitle'),
          description: result.error || t('workItems.loadErrorDescription'),
          variant: 'destructive',
        });
        return;
      }

      updateRawJson(result.data);
    } catch (error) {
      toast({
        title: t('workItems.loadErrorTitle'),
        description: error instanceof Error ? error.message : t('workItems.loadErrorDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPlan(false);
    }
  };

  const handleCreateWorkItems = () => {
    if (!canCreateWorkItems) {
      return;
    }

    setIsConfirmCreateOpen(true);
  };

  const handleConfirmCreateWorkItems = async () => {
    if (!plan || !targetProjectId) {
      return;
    }

    setIsCreating(true);
    try {
      const result = await createWorkItemsFromImplementationPlan(targetProjectId, plan, {
        metadata: {
          sourceType: 'imported',
        },
        descriptionLabels: {
          parentSpec: t('workItems.descriptionLabels.parentSpec'),
          specContext: t('workItems.descriptionLabels.specContext'),
          phase: t('workItems.descriptionLabels.phase'),
          type: t('workItems.descriptionLabels.type'),
          workItems: t('workItems.descriptionLabels.workItems'),
          finalAcceptanceCriteria: t('workItems.descriptionLabels.finalAcceptanceCriteria'),
        },
      });
      await loadTasks(targetProjectId, { forceRefresh: true });
      openProjectTab(targetProjectId);
      setActiveProject(targetProjectId);

      if (result.failedPhases.length > 0) {
        toast({
          title: t('workItems.partialSuccessTitle'),
          description: t('workItems.partialSuccessDescription', {
            created: result.createdTasks.length,
            failed: result.failedPhases.length,
          }),
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: t('workItems.successTitle'),
        description: t('workItems.successDescription', {
          count: result.createdTasks.length,
          project: targetProjectName,
        }),
      });
      setIsConfirmCreateOpen(false);
      updateRawJson('');
    } catch (error) {
      toast({
        title: t('workItems.errorTitle'),
        description: error instanceof Error ? error.message : t('workItems.errorDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="h-full overflow-hidden bg-background">
      <ScrollArea className="h-full">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('workItems.title')}</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t('workItems.description')}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <Card>
              <CardHeader>
                <CardTitle>{t('workItems.inputTitle')}</CardTitle>
                <CardDescription>{t('workItems.inputDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border bg-secondary/20 p-3">
                  <label htmlFor="work-items-source-task" className="text-sm font-medium text-foreground">
                    {t('workItems.loadFromTask')}
                  </label>
                  <div className="mt-2 flex gap-2">
                    <select
                      id="work-items-source-task"
                      value={selectedTaskId}
                      onChange={(event) => setSelectedTaskId(event.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">{t('workItems.selectTaskPlaceholder')}</option>
                      {planSourceTasks.map((task) => (
                        <option key={task.id} value={task.id}>{getTaskOptionLabel(task)}</option>
                      ))}
                    </select>
                    <Button type="button" variant="secondary" onClick={handleLoadPlanFromTask} disabled={!selectedTaskId || isLoadingPlan}>
                      {isLoadingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileJson className="mr-2 h-4 w-4" />}
                      {t('workItems.loadPlan')}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-secondary/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <label htmlFor="work-items-target-project" className="text-sm font-medium text-foreground">
                          {t('workItems.target.title')}
                        </label>
                        <p className="mt-1 text-xs text-muted-foreground">{t('workItems.target.description')}</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setIsAddProjectOpen(true)}>
                        <FolderPlus className="mr-2 h-4 w-4" />
                        {t('workItems.target.createNew')}
                      </Button>
                    </div>
                    <select
                      id="work-items-target-project"
                      value={targetProjectId}
                      onChange={(event) => setTargetProjectId(event.target.value)}
                      className="mt-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('workItems.target.selected', { project: targetProjectName })}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-secondary/20 p-3">
                    <div className="text-sm font-medium text-foreground">{t('workItems.workflow.title')}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{t('workItems.workflow.description')}</p>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                      {(['ideation', 'review', 'revise', 'approved'] as DraftWorkflowStage[]).map((stage) => (
                        <div
                          key={stage}
                          className={`rounded-md border px-2 py-2 ${draftStage === stage ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground'}`}
                        >
                          {t(`workItems.workflow.stages.${stage}`)}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={() => setDraftStage('review')} disabled={!canRequestReview}>
                        {t('workItems.workflow.review')}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setDraftStage('revise')} disabled={draftStage !== 'review'}>
                        {t('workItems.workflow.revise')}
                      </Button>
                      <Button type="button" size="sm" onClick={() => setDraftStage('approved')} disabled={!canApproveDraft}>
                        {t('workItems.workflow.approve')}
                      </Button>
                    </div>
                  </div>
                </div>

                <Textarea
                  value={rawJson}
                  onChange={(event) => updateRawJson(event.target.value)}
                  placeholder={t('workItems.placeholder')}
                  className="min-h-[420px] resize-y font-mono text-xs leading-relaxed"
                  spellCheck={false}
                />
                {parseError && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{t(`workItems.errors.${parseError}`)}</span>
                  </div>
                )}
                <div className="flex flex-col items-end gap-2">
                  {!isDraftApproved && plan && !parseError && (
                    <p className="text-xs text-muted-foreground">{t('workItems.workflow.approvalRequired')}</p>
                  )}
                  <Button onClick={handleCreateWorkItems} disabled={!canCreateWorkItems || isCreating}>
                    {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Network className="mr-2 h-4 w-4" />}
                    {isCreating ? t('workItems.creating') : t('workItems.create')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('workItems.previewTitle')}</CardTitle>
                  <CardDescription>{t('workItems.previewDescription')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {plan ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-lg bg-secondary/50 p-3">
                          <div className="text-xl font-semibold">{plan.phases.length}</div>
                          <div className="text-xs text-muted-foreground">{t('workItems.stats.phases')}</div>
                        </div>
                        <div className="rounded-lg bg-secondary/50 p-3">
                          <div className="text-xl font-semibold">{totalSubtasks}</div>
                          <div className="text-xs text-muted-foreground">{t('workItems.stats.subtasks')}</div>
                        </div>
                        <div className="rounded-lg bg-secondary/50 p-3">
                          <div className="text-xl font-semibold">{totalDependencies}</div>
                          <div className="text-xs text-muted-foreground">{t('workItems.stats.dependencies')}</div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {plan.phases.map((phase) => (
                          <div key={`${phase.id ?? phase.phase}`} className="rounded-lg border border-border p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium text-sm text-foreground">{phase.name}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {t('workItems.phaseMeta', {
                                    subtasks: phase.subtasks.length,
                                    dependencies: phase.depends_on?.length ?? 0,
                                  })}
                                </div>
                              </div>
                              {phase.parallel_safe && <CheckCircle2 className="h-4 w-4 text-success" />}
                            </div>
                            {phase.depends_on && phase.depends_on.length > 0 && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                {t('workItems.dependsOn', { dependencies: phase.depends_on.join(', ') })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      {t('workItems.emptyPreview')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </ScrollArea>

      <AddProjectModal
        open={isAddProjectOpen}
        onOpenChange={setIsAddProjectOpen}
        onProjectAdded={(project) => {
          setTargetProjectId(project.id);
        }}
      />

      <Dialog open={isConfirmCreateOpen} onOpenChange={setIsConfirmCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('workItems.confirm.title')}</DialogTitle>
            <DialogDescription>
              {t('workItems.confirm.description', { project: targetProjectName })}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-secondary/30 p-4 text-sm">
            <div className="font-medium text-foreground">{targetProjectName}</div>
            <div className="mt-2 text-muted-foreground">
              {t('workItems.confirm.summary', {
                phases: plan?.phases.length ?? 0,
                subtasks: totalSubtasks,
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmCreateOpen(false)} disabled={isCreating}>
              {t('workItems.confirm.cancel')}
            </Button>
            <Button onClick={handleConfirmCreateWorkItems} disabled={isCreating}>
              {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Network className="mr-2 h-4 w-4" />}
              {isCreating ? t('workItems.creating') : t('workItems.confirm.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
