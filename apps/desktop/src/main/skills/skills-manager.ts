import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { CreateSkillInput, LoadedSkill, SkillManifest, SkillSurface } from '../../shared/types/skill';
import { formatSkillsForPrompt, parseSkillMarkdown } from './skill-parser';

interface SkillStateFile {
  enabled?: Record<string, boolean>;
}

export interface SkillsManagerPaths {
  userDataDir: string;
  projectDir?: string;
}

export class SkillsManager {
  private readonly userSkillsDir: string;
  private readonly statePath: string;
  private readonly projectDir?: string;

  constructor(paths: SkillsManagerPaths) {
    this.userSkillsDir = join(paths.userDataDir, 'skills');
    this.statePath = join(paths.userDataDir, 'skill-state.json');
    this.projectDir = paths.projectDir;
  }

  async listSkills(): Promise<LoadedSkill[]> {
    await mkdir(this.userSkillsDir, { recursive: true });
    const state = await this.readState();
    const directories = this.getDiscoveryDirectories();
    const skillGroups = await Promise.all(directories.map((directory) => this.loadDirectorySkills(directory, state)));
    return skillGroups
      .flat()
      .sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
  }

  async setSkillEnabled(skillId: string, enabled: boolean): Promise<LoadedSkill> {
    const skills = await this.listSkills();
    const skill = skills.find((candidate) => candidate.manifest.id === skillId);
    if (!skill) {
      throw new Error('skills.errors.notFound');
    }

    const state = await this.readState();
    state.enabled = { ...state.enabled, [skillId]: enabled };
    await this.writeState(state);

    return { ...skill, enabled };
  }

  async createSkill(input: CreateSkillInput): Promise<LoadedSkill> {
    const id = input.id.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      throw new Error('skills.errors.invalidId');
    }

    const directory = join(this.userSkillsDir, id);
    const skillPath = join(directory, 'SKILL.md');
    if (existsSync(skillPath)) {
      throw new Error('skills.errors.alreadyExists');
    }

    await mkdir(directory, { recursive: true });
    const surfaces = input.surfaces?.length ? input.surfaces : ['build'];
    const content = `---\nname: ${input.name}\ndescription: ${input.description}\nsurfaces: [${surfaces.join(', ')}]\n---\n\nDescribe the reusable workflow, constraints, and examples for this skill.\n`;
    await writeFile(skillPath, content, 'utf-8');
    const manifest = parseSkillMarkdown(content, id);
    return { manifest, directory, enabled: true };
  }

  async getPromptInstructions(surface: SkillSurface = 'build'): Promise<string | null> {
    const skills = await this.listSkills();
    const manifests = skills
      .filter((skill) => skill.enabled && !skill.loadError && skill.manifest.surfaces.includes(surface))
      .map((skill) => skill.manifest);
    return formatSkillsForPrompt(manifests);
  }

  getUserSkillsDirectory(): string {
    return this.userSkillsDir;
  }

  private getDiscoveryDirectories(): string[] {
    const directories = [this.userSkillsDir];
    if (this.projectDir) {
      directories.push(
        join(this.projectDir, '.aperant', 'skills'),
        join(this.projectDir, '.claude', 'skills'),
        join(this.projectDir, '.agents', 'skills')
      );
    }
    return directories;
  }

  private async loadDirectorySkills(directory: string, state: SkillStateFile): Promise<LoadedSkill[]> {
    let entries: string[];
    try {
      const dirents = await readdir(directory, { withFileTypes: true });
      entries = dirents.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {
      return [];
    }

    return Promise.all(entries.map((entry) => this.loadSkill(join(directory, entry), entry, state)));
  }

  private async loadSkill(directory: string, fallbackId: string, state: SkillStateFile): Promise<LoadedSkill> {
    try {
      const markdown = await readFile(join(directory, 'SKILL.md'), 'utf-8');
      const manifest = parseSkillMarkdown(markdown, fallbackId);
      return {
        manifest,
        directory,
        enabled: state.enabled?.[manifest.id] ?? true,
      };
    } catch (error) {
      const manifest: SkillManifest = {
        id: fallbackId,
        name: fallbackId,
        description: 'skills.loadFailedDescription',
        body: '',
        surfaces: ['build'],
      };
      return {
        manifest,
        directory,
        enabled: false,
        loadError: error instanceof Error && error.message.startsWith('skills.')
          ? error.message
          : 'skills.errors.loadFailed',
      };
    }
  }

  private async readState(): Promise<SkillStateFile> {
    try {
      const content = await readFile(this.statePath, 'utf-8');
      const parsed = JSON.parse(content) as SkillStateFile;
      return { enabled: parsed.enabled ?? {} };
    } catch {
      return { enabled: {} };
    }
  }

  private async writeState(state: SkillStateFile): Promise<void> {
    await mkdir(this.userSkillsDir, { recursive: true });
    await writeFile(this.statePath, JSON.stringify({ enabled: state.enabled ?? {} }, null, 2), 'utf-8');
  }
}
