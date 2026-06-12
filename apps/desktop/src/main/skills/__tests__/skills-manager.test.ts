import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { SkillsManager } from '../skills-manager';

async function createSkill(root: string, id: string, body = 'Follow the skill instructions.'): Promise<void> {
  const directory = join(root, id);
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, 'SKILL.md'),
    `---
name: ${id}
description: ${id} description.
surfaces: [build]
---
${body}
`,
    'utf-8'
  );
}

describe('SkillsManager', () => {
  it('discovers user-global and project-local skills', async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'aperant-skills-user-'));
    const projectDir = await mkdtemp(join(tmpdir(), 'aperant-skills-project-'));
    await createSkill(join(userDataDir, 'skills'), 'global-skill');
    await createSkill(join(projectDir, '.aperant', 'skills'), 'project-skill');

    const manager = new SkillsManager({ userDataDir, projectDir });
    const skills = await manager.listSkills();

    expect(skills.map((skill) => skill.manifest.id)).toEqual(['global-skill', 'project-skill']);
    expect(skills.every((skill) => skill.enabled)).toBe(true);
  });

  it('persists enabled state outside the skill markdown', async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'aperant-skills-state-'));
    await createSkill(join(userDataDir, 'skills'), 'toggle-me');

    const manager = new SkillsManager({ userDataDir });
    await manager.setSkillEnabled('toggle-me', false);

    const state = JSON.parse(await readFile(join(userDataDir, 'skill-state.json'), 'utf-8')) as { enabled: Record<string, boolean> };
    expect(state.enabled['toggle-me']).toBe(false);

    const reloaded = await new SkillsManager({ userDataDir }).listSkills();
    expect(reloaded[0].enabled).toBe(false);
  });

  it('formats enabled build skills for prompt injection', async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'aperant-skills-prompt-'));
    await createSkill(join(userDataDir, 'skills'), 'prompt-skill', 'Use the repo test command before edits.');

    const instructions = await new SkillsManager({ userDataDir }).getPromptInstructions('build');

    expect(instructions).toContain('## SKILLS');
    expect(instructions).toContain('prompt-skill');
    expect(instructions).toContain('Use the repo test command before edits.');
  });

  it('uses stable translation keys for failed skill loads', async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'aperant-skills-invalid-'));
    const directory = join(userDataDir, 'skills', 'broken-skill');
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'SKILL.md'), '---\nname: broken-skill\n---\nMissing description.', 'utf-8');

    const skills = await new SkillsManager({ userDataDir }).listSkills();

    expect(skills[0].manifest.description).toBe('skills.loadFailedDescription');
    expect(skills[0].loadError).toBe('skills.errors.missingDescription');
  });

  it('normalizes generic skill load failures to a stable translation key', async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'aperant-skills-missing-file-'));
    await mkdir(join(userDataDir, 'skills', 'missing-file-skill'), { recursive: true });

    const skills = await new SkillsManager({ userDataDir }).listSkills();

    expect(skills[0].manifest.description).toBe('skills.loadFailedDescription');
    expect(skills[0].loadError).toBe('skills.errors.loadFailed');
  });
});
