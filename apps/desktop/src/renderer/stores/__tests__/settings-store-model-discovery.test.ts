/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelInfo } from '../../../shared/types/profile';
import { createModelDiscoveryCacheKey, useSettingsStore } from '../settings-store';

const models: ModelInfo[] = [
  {
    id: 'model-1',
    display_name: 'Model 1',
  },
];

function mockDiscoverModels(result: unknown) {
  const discoverModels = vi.fn().mockResolvedValue(result);
  window.electronAPI = {
    ...(window.electronAPI ?? {}),
    discoverModels,
  } as typeof window.electronAPI;
  return discoverModels;
}

describe('settings-store model discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      modelsLoading: false,
      modelsError: null,
      discoveredModels: new Map<string, ModelInfo[]>(),
    });
  });

  it('builds cache keys from the base URL and last four API key characters', () => {
    expect(createModelDiscoveryCacheKey('https://api.example.com', 'sk-abcdef')).toBe('https://api.example.com::cdef');
  });

  it('returns cached models without calling IPC or changing loading/error state', async () => {
    const cacheKey = createModelDiscoveryCacheKey('https://api.example.com', 'sk-abcdef');
    const discoverModels = mockDiscoverModels({ success: true, data: { models: [] } });
    useSettingsStore.setState({
      modelsLoading: true,
      modelsError: 'previous error',
      discoveredModels: new Map([[cacheKey, models]]),
    });

    const result = await useSettingsStore.getState().discoverModels('https://api.example.com', 'sk-abcdef');

    expect(result).toBe(models);
    expect(discoverModels).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().modelsLoading).toBe(true);
    expect(useSettingsStore.getState().modelsError).toBe('previous error');
  });

  it('fetches, caches, and returns models on cache miss success', async () => {
    const discoverModels = mockDiscoverModels({ success: true, data: { models } });

    const result = await useSettingsStore.getState().discoverModels('https://api.example.com', 'sk-abcdef');

    expect(discoverModels).toHaveBeenCalledWith('https://api.example.com', 'sk-abcdef', undefined);
    expect(result).toBe(models);
    expect(useSettingsStore.getState().modelsLoading).toBe(false);
    expect(useSettingsStore.getState().modelsError).toBeNull();
    expect(useSettingsStore.getState().discoveredModels.get('https://api.example.com::cdef')).toBe(models);
  });

  it('sets modelsError and returns null on IPC failure', async () => {
    mockDiscoverModels({ success: false, error: 'provider unavailable' });

    const result = await useSettingsStore.getState().discoverModels('https://api.example.com', 'sk-abcdef');

    expect(result).toBeNull();
    expect(useSettingsStore.getState().modelsLoading).toBe(false);
    expect(useSettingsStore.getState().modelsError).toBe('provider unavailable');
  });

  it('sets modelsError and returns null when IPC throws', async () => {
    const discoverModels = vi.fn().mockRejectedValue(new Error('network down'));
    window.electronAPI = {
      ...(window.electronAPI ?? {}),
      discoverModels,
    } as typeof window.electronAPI;

    const result = await useSettingsStore.getState().discoverModels('https://api.example.com', 'sk-abcdef');

    expect(result).toBeNull();
    expect(useSettingsStore.getState().modelsLoading).toBe(false);
    expect(useSettingsStore.getState().modelsError).toBe('network down');
  });
});
