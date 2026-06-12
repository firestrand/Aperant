import { describe, expect, it } from 'vitest';
import { formatRawModelLabel, getProviderModelLabel } from '../model-display';

describe('model display utilities', () => {
  it('formats raw GPT model ids with display casing', () => {
    expect(formatRawModelLabel('gpt-5.5')).toBe('GPT-5.5');
    expect(formatRawModelLabel('GPT-5.4-mini')).toBe('GPT-5.4-mini');
  });

  it('uses catalog labels for provider-native GPT models', () => {
    expect(getProviderModelLabel('gpt-5.5', 'openai')).toBe('GPT-5.5');
    expect(getProviderModelLabel('gpt-5.4-mini', 'openai')).toBe('GPT-5.4 Mini');
  });
});
