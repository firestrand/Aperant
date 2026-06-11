// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings, TaskMetadata } from '../../../shared/types';
import { useProjectStore } from '../../stores/project-store';

const mocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  onOpenChange: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../task-form/TaskModalLayout', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    TaskModalLayout: ({ open, children, footer }: { open: boolean; children: React.ReactNode; footer: React.ReactNode }) => (
      open ? React.createElement('div', null, children, footer) : null
    ),
  };
});

vi.mock('../task-form/TaskFormFields', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    TaskFormFields: ({ description, onDescriptionChange }: { description: string; onDescriptionChange: (value: string) => void }) => (
      React.createElement('textarea', {
        'aria-label': 'description',
        value: description,
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => onDescriptionChange(event.target.value),
      })
    ),
  };
});

vi.mock('../TaskFileExplorerDrawer', () => ({
  TaskFileExplorerDrawer: () => null,
}));

vi.mock('../FileAutocomplete', () => ({
  FileAutocomplete: () => null,
}));

vi.mock('../ui/button', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => React.createElement('button', props, children),
  };
});

vi.mock('../ui/label', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    Label: ({ children }: { children: React.ReactNode }) => React.createElement('label', null, children),
  };
});

vi.mock('../ui/combobox', () => ({
  Combobox: () => null,
}));

vi.mock('../../stores/task-store', () => ({
  createTask: (...args: unknown[]) => mocks.createTask(...args),
  saveDraft: vi.fn(),
  loadDraft: vi.fn(() => null),
  clearDraft: vi.fn(),
  isDraftEmpty: vi.fn(() => true),
}));

vi.mock('../../stores/settings-store', () => ({
  useSettingsStore: () => ({
    settings: {
      theme: 'system',
      defaultModel: 'sonnet',
      agentFramework: 'claude-code',
      autoUpdateAutoBuild: false,
      autoNameTerminals: true,
      notifications: {
        onTaskComplete: true,
        onTaskFailed: true,
        onReviewNeeded: true,
        sound: false,
      },
      providerAccounts: [
        { id: 'anthropic-account', provider: 'anthropic', name: 'Anthropic', authType: 'oauth', billingModel: 'subscription', createdAt: 1, updatedAt: 1 },
        { id: 'openai-account', provider: 'openai', name: 'OpenAI', authType: 'api-key', billingModel: 'pay-per-use', createdAt: 1, updatedAt: 1 },
      ],
      globalPriorityOrder: ['anthropic-account', 'openai-account'],
      selectedAgentProfile: 'quick',
    } satisfies AppSettings,
  }),
}));

vi.mock('../../hooks/useActiveProvider', () => ({
  useActiveProvider: () => ({ provider: 'anthropic' }),
}));

import { TaskCreationWizard } from '../TaskCreationWizard';

describe('TaskCreationWizard project-aware provider snapshot', () => {
  beforeEach(() => {
    mocks.createTask.mockResolvedValue({ id: 'task-1' });
    mocks.createTask.mockClear();
    mocks.onOpenChange.mockClear();
    useProjectStore.setState({
      projects: [
        {
          id: 'project-1',
          name: 'Project 1',
          path: '/tmp/project-1',
          settings: {
            projectAgentOverrides: {
              provider: 'openai',
            },
          },
        } as never,
      ],
    });
  });

  it('writes metadata using the project-effective provider and phase models', async () => {
    render(React.createElement(TaskCreationWizard, {
      projectId: 'project-1',
      open: true,
      onOpenChange: mocks.onOpenChange,
    }));

    fireEvent.change(screen.getByLabelText('description'), {
      target: { value: 'Implement project-aware metadata' },
    });
    fireEvent.click(screen.getByText('tasks:wizard.createTask'));

    await waitFor(() => expect(mocks.createTask).toHaveBeenCalled());
    const metadata = mocks.createTask.mock.calls[0][3] as TaskMetadata;

    expect(mocks.createTask.mock.calls[0][0]).toBe('project-1');
    expect(metadata.provider).toBe('openai');
    expect(metadata.phaseModels).toEqual({
      spec: 'gpt-5.4-mini',
      planning: 'gpt-5.4-mini',
      coding: 'gpt-5.4-mini',
      qa: 'gpt-5.4-mini',
    });
    expect(metadata.phaseThinking).toEqual({ spec: 'low', planning: 'low', coding: 'low', qa: 'low' });
  });
});
