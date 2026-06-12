import { app, ipcMain } from 'electron';

import { IPC_CHANNELS } from '../../shared/constants/ipc';
import type { CreateSkillInput, IPCResult, LoadedSkill, SkillToggleResult } from '../../shared/types';
import { SkillsManager } from '../skills/skills-manager';

function getManager(projectDir?: string): SkillsManager {
  return new SkillsManager({ userDataDir: app.getPath('userData'), projectDir });
}

function success<T>(data: T): IPCResult<T> {
  return { success: true, data };
}

function failure(error: unknown): IPCResult<never> {
  return { success: false, error: error instanceof Error ? error.message : String(error) };
}

export function registerSkillHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SKILLS_LIST, async (_event, projectDir?: string): Promise<IPCResult<LoadedSkill[]>> => {
    try {
      return success(await getManager(projectDir).listSkills());
    } catch (error) {
      return failure(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SKILLS_CREATE, async (_event, input: CreateSkillInput): Promise<IPCResult<LoadedSkill>> => {
    try {
      return success(await getManager().createSkill(input));
    } catch (error) {
      return failure(error);
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.SKILLS_SET_ENABLED,
    async (_event, skillId: string, enabled: boolean, projectDir?: string): Promise<IPCResult<SkillToggleResult>> => {
      try {
        const skill = await getManager(projectDir).setSkillEnabled(skillId, enabled);
        return success({ skill });
      } catch (error) {
        return failure(error);
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.SKILLS_GET_USER_DIR, async (): Promise<IPCResult<string>> => {
    try {
      return success(getManager().getUserSkillsDirectory());
    } catch (error) {
      return failure(error);
    }
  });
}
