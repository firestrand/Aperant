import { describe, expect, it } from 'vitest';
import { isAdvancedAgentSettingsMode, resolveAgentSettingsMode } from '../agent-settings-mode';

describe('agent settings mode', () => {
  it('defaults missing mode to simple', () => {
    expect(resolveAgentSettingsMode()).toBe('simple');
    expect(resolveAgentSettingsMode({})).toBe('simple');
    expect(isAdvancedAgentSettingsMode()).toBe(false);
  });

  it('treats only explicit advanced mode as advanced', () => {
    expect(resolveAgentSettingsMode({ mode: 'advanced' })).toBe('advanced');
    expect(isAdvancedAgentSettingsMode({ mode: 'advanced' })).toBe(true);
  });

  it('keeps explicit simple mode simple', () => {
    expect(resolveAgentSettingsMode({ mode: 'simple' })).toBe('simple');
    expect(isAdvancedAgentSettingsMode({ mode: 'simple' })).toBe(false);
  });
});
