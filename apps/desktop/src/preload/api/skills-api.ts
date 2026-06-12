import { ipcRenderer } from 'electron';

import { IPC_CHANNELS } from '../../shared/constants';
import type { CreateSkillInput, IPCResult, LoadedSkill, SkillToggleResult } from '../../shared/types';

export interface SkillsAPI {
  listSkills: (projectDir?: string) => Promise<IPCResult<LoadedSkill[]>>;
  createSkill: (input: CreateSkillInput) => Promise<IPCResult<LoadedSkill>>;
  setSkillEnabled: (skillId: string, enabled: boolean, projectDir?: string) => Promise<IPCResult<SkillToggleResult>>;
  getUserSkillsDirectory: () => Promise<IPCResult<string>>;
}

export const createSkillsAPI = (): SkillsAPI => ({
  listSkills: (projectDir?: string): Promise<IPCResult<LoadedSkill[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_LIST, projectDir),
  createSkill: (input: CreateSkillInput): Promise<IPCResult<LoadedSkill>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_CREATE, input),
  setSkillEnabled: (skillId: string, enabled: boolean, projectDir?: string): Promise<IPCResult<SkillToggleResult>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_SET_ENABLED, skillId, enabled, projectDir),
  getUserSkillsDirectory: (): Promise<IPCResult<string>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_GET_USER_DIR),
});
