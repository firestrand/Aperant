/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SkillsSettings } from '../SkillsSettings';
import type { AppSettings, LoadedSkill } from '../../../../shared/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string; count?: number }) => options?.name ?? options?.count?.toString() ?? key,
  }),
}));

const settings = {
  skillsEnabled: true,
} as AppSettings;

const skill: LoadedSkill = {
  manifest: {
    id: 'project-skill',
    name: 'Project Skill',
    description: 'Project skill description.',
    body: 'Use project conventions.',
    surfaces: ['build'],
  },
  directory: '/repo/.aperant/skills/project-skill',
  enabled: true,
};

describe('SkillsSettings project directory wiring', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        listSkills: vi.fn(async () => ({ success: true, data: [skill] })),
        getUserSkillsDirectory: vi.fn(async () => ({ success: true, data: '/user/skills' })),
        setSkillEnabled: vi.fn(async () => ({ success: true, data: { skill: { ...skill, enabled: false } } })),
      },
    });
  });

  it('passes projectDir when listing and toggling skills', async () => {
    const projectDir = '/repo';
    const { getAllByRole } = render(
      <SkillsSettings settings={settings} onSettingsChange={vi.fn()} projectDir={projectDir} />
    );

    await waitFor(() => {
      expect(window.electronAPI.listSkills).toHaveBeenCalledWith(projectDir);
    });

    fireEvent.click(getAllByRole('switch')[1]);

    await waitFor(() => {
      expect(window.electronAPI.setSkillEnabled).toHaveBeenCalledWith('project-skill', false, projectDir);
    });
  });
});
