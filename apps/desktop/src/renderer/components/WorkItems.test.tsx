/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkItems } from './WorkItems';
import { useProjectStore } from '../stores/project-store';
import { useTaskStore } from '../stores/task-store';
import type { Project } from '../../shared/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, values?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        'workItems.title': 'Work Items',
        'workItems.description': 'Create dependency-linked tasks.',
        'workItems.inputTitle': 'Spec, PRD, or implementation plan',
        'workItems.inputDescription': 'Paste a plan.',
        'workItems.loadFromTask': 'Load from an existing task',
        'workItems.selectTaskPlaceholder': 'Select a task with an implementation plan...',
        'workItems.loadPlan': 'Load plan',
        'workItems.placeholder': 'Paste implementation plan JSON, Markdown spec, or PRD text here...',
        'workItems.create': 'Create work items',
        'workItems.creating': 'Creating work items...',
        'workItems.previewTitle': 'Preview',
        'workItems.previewDescription': 'Review before creating tasks.',
        'workItems.emptyPreview': 'Paste a plan to preview generated work items.',
        'workItems.target.title': 'Target project',
        'workItems.target.description': 'Choose where the generated tasks will be created.',
        'workItems.target.createNew': 'New project',
        'workItems.target.selected': `Destination: ${values?.project ?? ''}`,
        'workItems.target.unknownProject': 'Unknown project',
        'workItems.workflow.title': 'Draft workflow',
        'workItems.workflow.description': 'Review and approve the draft before task creation.',
        'workItems.workflow.review': 'Review draft',
        'workItems.workflow.revise': 'Revise',
        'workItems.workflow.approve': 'Approve',
        'workItems.workflow.approvalRequired': 'Approve the draft before creating work items.',
        'workItems.workflow.stages.ideation': 'Ideation',
        'workItems.workflow.stages.review': 'Review',
        'workItems.workflow.stages.revise': 'Revise',
        'workItems.workflow.stages.approved': 'Approved',
        'workItems.confirm.title': 'Create work items?',
        'workItems.confirm.description': `Create tasks in ${values?.project ?? ''}.`,
        'workItems.confirm.summary': `${values?.phases ?? 0} phase(s) · ${values?.subtasks ?? 0} task(s)`,
        'workItems.confirm.cancel': 'Cancel',
        'workItems.confirm.create': 'Create tasks',
        'workItems.stats.phases': 'Phases',
        'workItems.stats.subtasks': 'Subtasks',
        'workItems.stats.dependencies': 'Dependencies',
        'workItems.phaseMeta': `${values?.subtasks ?? 0} subtasks · ${values?.dependencies ?? 0} dependencies`,
        'workItems.dependsOn': `Depends on: ${values?.dependencies ?? ''}`,
        'workItems.fallbacks.subtask': `Subtask ${values?.number ?? ''}`,
        'workItems.fallbacks.phase': `Phase ${values?.number ?? ''}`,
        'workItems.fallbacks.pastedSpecFile': 'pasted-work-items.txt',
        'workItems.fallbacks.importedSpecPhase': 'Imported spec',
        'workItems.fallbacks.importedSpecSubtask': 'Review source document',
      };
      return translations[key] ?? key;
    },
  }),
}));

vi.mock('./AddProjectModal', () => ({
  AddProjectModal: () => null,
}));

vi.mock('../hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const testProject: Project = {
  id: 'project-1',
  name: 'Aperant Test',
  path: '/tmp/aperant-test',
  autoBuildPath: '.auto-claude',
  settings: {
    memoryBackend: 'file',
    linearSync: false,
    linearTeamId: '',
    notifications: {
      onTaskComplete: false,
      onTaskFailed: false,
      onReviewNeeded: false,
      sound: false,
    },
    mainBranch: 'main',
  },
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const validPlan = JSON.stringify({
  title: 'Generated plan',
  phases: [
    {
      phase: 1,
      id: 'phase-1',
      name: 'Build feature',
      subtasks: [
        {
          id: 'task-1',
          title: 'Implement feature',
          description: 'Implement feature',
        },
      ],
    },
  ],
});

describe('WorkItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectStore.setState({
      projects: [testProject],
      selectedProjectId: testProject.id,
      activeProjectId: testProject.id,
      openProjectIds: [testProject.id],
      tabOrder: [testProject.id],
    });
    useTaskStore.setState({ tasks: [] });
  });

  it('requires review and approval before opening the create confirmation', () => {
    render(<WorkItems projectId={testProject.id} />);

    const createButton = screen.getByRole('button', { name: 'Create work items' });
    expect(createButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Paste implementation plan JSON, Markdown spec, or PRD text here...'), {
      target: { value: validPlan },
    });

    expect(screen.getByText('Approve the draft before creating work items.')).toBeInTheDocument();
    expect(createButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Review draft' }));
    expect(createButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(createButton).toBeEnabled();

    fireEvent.click(createButton);
    expect(screen.getByRole('heading', { name: 'Create work items?' })).toBeInTheDocument();
    expect(screen.getByText('Create tasks in Aperant Test.')).toBeInTheDocument();
  });
});
