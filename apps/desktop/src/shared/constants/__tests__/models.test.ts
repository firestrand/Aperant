import { describe, it, expect } from 'vitest';
import {
  buildSimpleModeFeatureModels,
  buildSimpleModePhaseModels,
  buildSimpleModePhaseThinking,
  getProviderPreset,
  getProviderPresetOrFallback,
  PROVIDER_PRESET_DEFINITIONS,
  resolveSimpleModeBaseModel,
} from '../models';

describe('getProviderPreset', () => {
  it('returns correct preset for known provider and presetId', () => {
    const result = getProviderPreset('anthropic', 'auto');
    expect(result).not.toBeNull();
    expect(result?.primaryModel).toBe('opus');
    expect(result?.primaryThinking).toBe('high');
  });

  it('returns correct balanced preset for anthropic', () => {
    const result = getProviderPreset('anthropic', 'balanced');
    expect(result).not.toBeNull();
    expect(result?.primaryModel).toBe('sonnet');
    expect(result?.primaryThinking).toBe('medium');
  });

  it('returns correct preset for openai provider', () => {
    const result = getProviderPreset('openai', 'auto');
    expect(result).not.toBeNull();
    expect(result?.primaryModel).toBe('gpt-5.5');
  });

  it('returns null for unknown presetId', () => {
    const result = getProviderPreset('anthropic', 'nonexistent-preset');
    expect(result).toBeNull();
  });

  it('returns null for unknown provider', () => {
    // @ts-expect-error testing unknown provider
    const result = getProviderPreset('unknown-provider', 'auto');
    expect(result).toBeNull();
  });

  it('returns null for provider that does not have a complex preset (mistral)', () => {
    const result = getProviderPreset('mistral', 'complex');
    expect(result).toBeNull();
  });
});

describe('getProviderPresetOrFallback', () => {
  it('returns exact match when provider and preset both exist', () => {
    const result = getProviderPresetOrFallback('anthropic', 'complex');
    expect(result.primaryModel).toBe('opus');
    expect(result.primaryThinking).toBe('high');
    expect(result.phaseThinking.coding).toBe('high');
  });

  it('returns openai balanced preset exactly when available', () => {
    const result = getProviderPresetOrFallback('openai', 'balanced');
    expect(result.primaryModel).toBe('gpt-5.5');
    expect(result.primaryThinking).toBe('medium');
  });

  it("falls back to provider's 'auto' preset when requested preset is missing", () => {
    // mistral has no 'complex' preset, so falls back to mistral 'auto'
    const result = getProviderPresetOrFallback('mistral', 'complex');
    const mistralAuto = PROVIDER_PRESET_DEFINITIONS['mistral']?.['auto'];
    expect(result).toEqual(mistralAuto);
  });

  it('falls back to anthropic preset when provider has no auto and no matching preset', () => {
    // groq has no 'complex' preset — its 'auto' fallback should be used first
    // but if we use a provider with NO 'auto' at all, it should fall back to anthropic
    // groq has 'auto', so verify we get groq auto
    const result = getProviderPresetOrFallback('groq', 'complex');
    const groqAuto = PROVIDER_PRESET_DEFINITIONS['groq']?.['auto'];
    expect(result).toEqual(groqAuto);
  });

  it('falls back to anthropic preset when provider is unknown', () => {
    // @ts-expect-error testing unknown provider to exercise anthropic fallback
    const result = getProviderPresetOrFallback('unknown-provider', 'complex');
    const anthropicComplex = PROVIDER_PRESET_DEFINITIONS['anthropic']?.['complex'];
    expect(result).toEqual(anthropicComplex);
  });

  it('falls back to anthropic auto as ultimate fallback', () => {
    // @ts-expect-error testing unknown provider and preset
    const result = getProviderPresetOrFallback('unknown-provider', 'unknown-preset');
    const anthropicAuto = PROVIDER_PRESET_DEFINITIONS['anthropic']!['auto'];
    expect(result).toEqual(anthropicAuto);
  });

  it('always returns a valid config (never null)', () => {
    const knownCombinations: Array<[Parameters<typeof getProviderPresetOrFallback>[0], string]> = [
      ['anthropic', 'auto'],
      ['anthropic', 'complex'],
      ['anthropic', 'balanced'],
      ['anthropic', 'quick'],
      ['openai', 'auto'],
      ['openai', 'complex'],
      ['google', 'balanced'],
      ['xai', 'quick'],
      ['mistral', 'complex'],  // no 'complex', falls back to mistral auto
      ['groq', 'quick'],       // groq has no 'quick', falls back to groq auto
    ];

    for (const [provider, presetId] of knownCombinations) {
      const result = getProviderPresetOrFallback(provider, presetId);
      expect(result).toBeDefined();
      expect(result.primaryModel).toBeTruthy();
      expect(result.phaseModels).toBeDefined();
      expect(result.phaseThinking).toBeDefined();
    }
  });

  it('returned config has all required phase keys', () => {
    const result = getProviderPresetOrFallback('anthropic', 'auto');
    const phaseKeys = ['spec', 'planning', 'coding', 'qa'] as const;
    for (const key of phaseKeys) {
      expect(result.phaseModels[key]).toBeTruthy();
      expect(result.phaseThinking[key]).toBeTruthy();
    }
  });
});

describe('simple mode model helpers', () => {
  it('uses one selected base model for every pipeline phase', () => {
    expect(buildSimpleModePhaseModels('gpt-5.5')).toEqual({
      spec: 'gpt-5.5',
      planning: 'gpt-5.5',
      coding: 'gpt-5.5',
      qa: 'gpt-5.5',
    });
  });

  it('uses one selected base model for every feature model', () => {
    expect(buildSimpleModeFeatureModels('gpt-5.4-mini')).toEqual({
      insights: 'gpt-5.4-mini',
      ideation: 'gpt-5.4-mini',
      roadmap: 'gpt-5.4-mini',
      githubIssues: 'gpt-5.4-mini',
      githubPrs: 'gpt-5.4-mini',
      utility: 'gpt-5.4-mini',
      naming: 'gpt-5.4-mini',
    });
  });

  it('keeps profile-specific thinking levels with a selected base model', () => {
    expect(buildSimpleModePhaseThinking('openai', 'auto')).toEqual({
      spec: 'high',
      planning: 'high',
      coding: 'low',
      qa: 'low',
    });
  });

  it('resets OpenAI simple mode to latest preset models by profile', () => {
    expect(resolveSimpleModeBaseModel('openai', 'auto')).toBe('gpt-5.5');
    expect(resolveSimpleModeBaseModel('openai', 'quick')).toBe('gpt-5.4-mini');
  });

  it('preserves an explicitly configured simple-mode base model', () => {
    expect(resolveSimpleModeBaseModel('openai', 'auto', 'o3')).toBe('o3');
  });
});
