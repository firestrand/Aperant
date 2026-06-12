import { describe, expect, it } from 'vitest';

import { formatSkillsForPrompt, parseSkillMarkdown } from '../skill-parser';

describe('parseSkillMarkdown', () => {
  it('parses Claude/OpenCode-style frontmatter and normalizes surfaces', () => {
    const manifest = parseSkillMarkdown(
      `---
name: test-fixer
description: Fixes failing tests when Vitest or Playwright fails.
allowed-tools: [Read, Grep, Bash(npm test *)]
surfaces: [task-agent, insights]
disable-model-invocation: true
category: testing
homepage: https://example.com/skills/test-fixer
---
Always inspect the failing test first.
`,
      'fallback-id'
    );

    expect(manifest).toEqual({
      id: 'test-fixer',
      name: 'test-fixer',
      description: 'Fixes failing tests when Vitest or Playwright fails.',
      allowedTools: ['Read', 'Grep', 'Bash(npm test *)'],
      body: 'Always inspect the failing test first.',
      category: 'testing',
      disableModelInvocation: true,
      homepage: 'https://example.com/skills/test-fixer',
      surfaces: ['build', 'insights'],
    });
  });

  it('defaults build surface and requires a description', () => {
    expect(() => parseSkillMarkdown('Skill body only', 'quick-fix')).toThrow('skills.errors.missingDescription');

    const manifest = parseSkillMarkdown(
      `---
name: quick-fix
description: Apply a small targeted correction.
---
Patch only the requested issue.
`,
      'quick-fix'
    );

    expect(manifest.surfaces).toEqual(['build']);
  });
});

describe('formatSkillsForPrompt', () => {
  it('formats enabled skills into a bounded prompt section', () => {
    const formatted = formatSkillsForPrompt([
      {
        id: 'test-fixer',
        name: 'Test Fixer',
        description: 'Fix failing tests.',
        body: 'Run the focused test before changing code.',
        surfaces: ['build'],
        allowedTools: ['Read', 'Bash(npm test *)'],
      },
    ]);

    expect(formatted).toContain('## SKILLS');
    expect(formatted).toContain('### Test Fixer (test-fixer)');
    expect(formatted).toContain('Allowed tools declared by this skill: Read, Bash(npm test *)');
    expect(formatted).toContain('Run the focused test before changing code.');
    expect(formatted).toMatch(/---\n\n$/);
  });
});
