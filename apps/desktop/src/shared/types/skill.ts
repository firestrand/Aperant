export type SkillSurface = 'build' | 'insights';

export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  body: string;
  surfaces: SkillSurface[];
  allowedTools?: string[];
  category?: string;
  homepage?: string;
  disableModelInvocation?: boolean;
}

export interface LoadedSkill {
  manifest: SkillManifest;
  directory: string;
  enabled: boolean;
  loadError?: string;
}

export interface CreateSkillInput {
  id: string;
  name: string;
  description: string;
  surfaces?: SkillSurface[];
}

export interface SkillToggleResult {
  skill: LoadedSkill;
}
