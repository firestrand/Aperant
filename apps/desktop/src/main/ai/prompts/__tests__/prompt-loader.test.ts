import { describe, expect, it } from 'vitest';

import { injectContext } from '../prompt-loader';

describe('injectContext', () => {
  it('injects skill instructions after project instructions and before the base prompt', () => {
    const assembled = injectContext('BASE PROMPT', {
      specDir: '/tmp/spec',
      projectDir: '/tmp/project',
      projectInstructions: 'Prefer existing patterns.',
      skillInstructions: '## SKILLS\n\n### Test Fixer\n\nRun focused tests.\n\n---\n\n',
    });

    expect(assembled).toContain('## PROJECT INSTRUCTIONS');
    expect(assembled).toContain('## SKILLS');
    expect(assembled.indexOf('## PROJECT INSTRUCTIONS')).toBeLessThan(assembled.indexOf('## SKILLS'));
    expect(assembled.indexOf('## SKILLS')).toBeLessThan(assembled.indexOf('BASE PROMPT'));
  });
});
