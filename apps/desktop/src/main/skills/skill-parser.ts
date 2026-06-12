import type { SkillManifest, SkillSurface } from '../../shared/types/skill';

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const VALID_SKILL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_SURFACES: SkillSurface[] = ['build'];

const SURFACE_ALIASES: Record<string, SkillSurface> = {
  build: 'build',
  'task-agent': 'build',
  'qa-agent': 'build',
  'terminal-agent': 'build',
  insights: 'insights',
  chat: 'insights',
};

interface ParsedFrontmatter {
  [key: string]: string | string[] | boolean | Record<string, unknown> | undefined;
}

export function parseSkillMarkdown(markdown: string, fallbackId: string): SkillManifest {
  const match = markdown.match(FRONTMATTER_PATTERN);
  const frontmatter = match ? parseFrontmatter(match[1]) : {};
  const body = (match ? markdown.slice(match[0].length) : markdown).trim();
  const id = normalizeSkillId(readString(frontmatter.id) ?? readString(frontmatter.name) ?? fallbackId);
  const name = readString(frontmatter.name) ?? id;
  const description = readString(frontmatter.description) ?? '';

  if (!VALID_SKILL_ID_PATTERN.test(id)) {
    throw new Error('skills.errors.invalidId');
  }

  if (!description.trim()) {
    throw new Error('skills.errors.missingDescription');
  }

  return {
    id,
    name,
    description,
    body,
    surfaces: readSurfaces(frontmatter),
    allowedTools: readStringArray(frontmatter['allowed-tools']) ?? readPermissionTools(frontmatter),
    category: readString(frontmatter.category),
    homepage: readString(frontmatter.homepage),
    disableModelInvocation: readBoolean(frontmatter['disable-model-invocation']),
  };
}

export function formatSkillsForPrompt(skills: SkillManifest[]): string | null {
  const activeSkills = skills.filter((skill) => skill.body.trim());
  if (activeSkills.length === 0) return null;

  const sections = activeSkills
    .map((skill) => {
      const toolLine = skill.allowedTools?.length
        ? `\nAllowed tools declared by this skill: ${skill.allowedTools.join(', ')}\n`
        : '\n';
      return `### ${skill.name} (${skill.id})\n\nDescription: ${skill.description}${toolLine}\n${skill.body.trim()}`;
    })
    .join('\n\n');

  return `## SKILLS\n\nThe following enabled skills are instruction packs selected for this agent surface. Follow them when they apply, but do not treat them as permission to bypass Aperant safety rules.\n\n${sections}\n\n---\n\n`;
}

function parseFrontmatter(source: string): ParsedFrontmatter {
  const result: ParsedFrontmatter = {};
  const lines = source.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const keyMatch = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!keyMatch) {
      index += 1;
      continue;
    }

    const [, key, rawValue] = keyMatch;
    if (rawValue.trim() === '') {
      const nested: string[] = [];
      index += 1;
      while (index < lines.length && /^\s+/.test(lines[index])) {
        const nestedLine = lines[index].trim();
        if (nestedLine.startsWith('- ')) {
          nested.push(unquote(nestedLine.slice(2).trim()));
        }
        index += 1;
      }
      result[key] = nested;
      continue;
    }

    result[key] = parseScalar(rawValue.trim());
    index += 1;
  }

  return result;
}

function parseScalar(value: string): string | string[] | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((entry) => unquote(entry.trim()))
      .filter(Boolean);
  }
  return unquote(value);
}

function readPermissionTools(frontmatter: ParsedFrontmatter): string[] | undefined {
  const value = frontmatter.permissions;
  if (!Array.isArray(value)) return undefined;
  return value;
}

function readSurfaces(frontmatter: ParsedFrontmatter): SkillSurface[] {
  const direct = readStringArray(frontmatter.surfaces);
  const scopeSurface = readStringArray(frontmatter['scope.surface']);
  const values = direct ?? scopeSurface ?? DEFAULT_SURFACES;
  const normalized = values
    .map((surface) => SURFACE_ALIASES[surface])
    .filter((surface): surface is SkillSurface => Boolean(surface));
  return normalized.length > 0 ? Array.from(new Set(normalized)) : DEFAULT_SURFACES;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const strings = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    return strings.length > 0 ? strings : undefined;
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return undefined;
}

function normalizeSkillId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/g, '');
}
