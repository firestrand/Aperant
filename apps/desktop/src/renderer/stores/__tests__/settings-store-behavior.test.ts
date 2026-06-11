/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '../../../shared/constants';
import type { AppSettings } from '../../../shared/types';
import type { APIProfile, ProfileFormData } from '../../../shared/types/profile';
import { loadSettings, saveSettings, useSettingsStore } from '../settings-store';

function profile(overrides: Partial<APIProfile> = {}): APIProfile {
  return {
    id: 'profile-1',
    name: 'Profile 1',
    baseUrl: 'https://api.example.com',
    apiKey: 'sk-test',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function profileForm(overrides: Partial<ProfileFormData> = {}): ProfileFormData {
  return {
    name: 'Profile 1',
    baseUrl: 'https://api.example.com',
    apiKey: 'sk-test',
    ...overrides,
  };
}

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...overrides,
  } as AppSettings;
}

function setElectronApi(overrides: Partial<typeof window.electronAPI>) {
  window.electronAPI = {
    ...(window.electronAPI ?? {}),
    ...overrides,
  } as typeof window.electronAPI;
}

describe('settings-store load/save and profile behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      settings: DEFAULT_APP_SETTINGS as AppSettings,
      isLoading: false,
      error: null,
      profiles: [],
      activeProfileId: null,
      profilesLoading: false,
      profilesError: null,
      providerAccounts: [],
    });
  });

  it('loads settings, migrates onboarding from Claude Code status, persists migration, and loads provider accounts', async () => {
    const loadedSettings = settings({ onboardingCompleted: undefined, autoBuildPath: undefined });
    const getSettings = vi.fn().mockResolvedValue({ success: true, data: loadedSettings });
    const saveSettingsIpc = vi.fn().mockResolvedValue({ success: true });
    const getClaudeCodeOnboardingStatus = vi.fn().mockResolvedValue({
      success: true,
      data: { hasCompletedOnboarding: true },
    });
    const getProviderAccounts = vi.fn().mockResolvedValue({ success: true, data: { accounts: [] } });
    setElectronApi({
      getSettings,
      saveSettings: saveSettingsIpc,
      getClaudeCodeOnboardingStatus,
      getProviderAccounts,
    });

    await loadSettings();

    expect(useSettingsStore.getState().settings.onboardingCompleted).toBe(true);
    expect(saveSettingsIpc).toHaveBeenCalledWith({ onboardingCompleted: true });
    expect(getProviderAccounts).toHaveBeenCalled();
    expect(useSettingsStore.getState().isLoading).toBe(false);
    expect(useSettingsStore.getState().error).toBeNull();
  });

  it('saves settings through IPC and updates local settings on success', async () => {
    const saveSettingsIpc = vi.fn().mockResolvedValue({ success: true });
    setElectronApi({ saveSettings: saveSettingsIpc });

    const result = await saveSettings({ autoNameTerminals: false });

    expect(result).toBe(true);
    expect(saveSettingsIpc).toHaveBeenCalledWith({ autoNameTerminals: false });
    expect(useSettingsStore.getState().settings.autoNameTerminals).toBe(false);
  });

  it('saves a profile and refreshes authoritative profile state', async () => {
    const savedProfile = profile({ id: 'saved-profile' });
    const refreshedProfile = profile({ id: 'refreshed-profile' });
    const saveAPIProfile = vi.fn().mockResolvedValue({ success: true, data: savedProfile });
    const getAPIProfiles = vi.fn().mockResolvedValue({
      success: true,
      data: { profiles: [refreshedProfile], activeProfileId: 'refreshed-profile' },
    });
    setElectronApi({ saveAPIProfile, getAPIProfiles });

    const result = await useSettingsStore.getState().saveProfile(profileForm());

    expect(result).toBe(true);
    expect(useSettingsStore.getState().profiles).toEqual([refreshedProfile]);
    expect(useSettingsStore.getState().activeProfileId).toBe('refreshed-profile');
    expect(useSettingsStore.getState().profilesLoading).toBe(false);
  });

  it('updates a profile with the authoritative IPC result', async () => {
    const oldProfile = profile({ id: 'profile-1', name: 'Old' });
    const updatedProfile = profile({ id: 'profile-1', name: 'New' });
    useSettingsStore.setState({ profiles: [oldProfile] });
    setElectronApi({ updateAPIProfile: vi.fn().mockResolvedValue({ success: true, data: updatedProfile }) });

    const result = await useSettingsStore.getState().updateProfile(updatedProfile);

    expect(result).toBe(true);
    expect(useSettingsStore.getState().profiles).toEqual([updatedProfile]);
    expect(useSettingsStore.getState().profilesLoading).toBe(false);
  });

  it('deletes a profile and clears activeProfileId when deleting the active profile', async () => {
    const first = profile({ id: 'profile-1' });
    const second = profile({ id: 'profile-2' });
    useSettingsStore.setState({ profiles: [first, second], activeProfileId: 'profile-1' });
    setElectronApi({ deleteAPIProfile: vi.fn().mockResolvedValue({ success: true }) });

    const result = await useSettingsStore.getState().deleteProfile('profile-1');

    expect(result).toBe(true);
    expect(useSettingsStore.getState().profiles).toEqual([second]);
    expect(useSettingsStore.getState().activeProfileId).toBeNull();
  });

  it('sets active profile on IPC success', async () => {
    setElectronApi({ setActiveAPIProfile: vi.fn().mockResolvedValue({ success: true }) });

    const result = await useSettingsStore.getState().setActiveProfile('profile-1');

    expect(result).toBe(true);
    expect(useSettingsStore.getState().activeProfileId).toBe('profile-1');
    expect(useSettingsStore.getState().profilesLoading).toBe(false);
  });

  it('leaves settings unchanged and skips provider account loading when settings IPC fails', async () => {
    const getProviderAccounts = vi.fn();
    setElectronApi({
      getSettings: vi.fn().mockResolvedValue({ success: false, error: 'settings failed' }),
      getProviderAccounts,
    });

    await loadSettings();

    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(useSettingsStore.getState().error).toBeNull();
    expect(useSettingsStore.getState().isLoading).toBe(false);
    expect(getProviderAccounts).not.toHaveBeenCalled();
  });

  it('records load settings errors when IPC throws', async () => {
    setElectronApi({ getSettings: vi.fn().mockRejectedValue(new Error('settings unavailable')) });

    await loadSettings();

    expect(useSettingsStore.getState().error).toBe('settings unavailable');
    expect(useSettingsStore.getState().isLoading).toBe(false);
  });

  it('does not update settings when save settings returns a failure', async () => {
    setElectronApi({ saveSettings: vi.fn().mockResolvedValue({ success: false, error: 'save failed' }) });

    const result = await saveSettings({ autoNameTerminals: false });

    expect(result).toBe(false);
    expect(useSettingsStore.getState().settings.autoNameTerminals).toBe(
      DEFAULT_APP_SETTINGS.autoNameTerminals,
    );
  });

  it('returns false when save settings throws', async () => {
    setElectronApi({ saveSettings: vi.fn().mockRejectedValue(new Error('save exploded')) });

    const result = await saveSettings({ autoNameTerminals: false });

    expect(result).toBe(false);
    expect(useSettingsStore.getState().settings.autoNameTerminals).toBe(
      DEFAULT_APP_SETTINGS.autoNameTerminals,
    );
  });

  it('stores profile save errors from failed IPC responses', async () => {
    setElectronApi({ saveAPIProfile: vi.fn().mockResolvedValue({ success: false, error: 'save rejected' }) });

    const result = await useSettingsStore.getState().saveProfile(profileForm());

    expect(result).toBe(false);
    expect(useSettingsStore.getState().profilesError).toBe('save rejected');
    expect(useSettingsStore.getState().profilesLoading).toBe(false);
  });

  it('stores profile save errors from thrown IPC errors', async () => {
    setElectronApi({ saveAPIProfile: vi.fn().mockRejectedValue(new Error('save threw')) });

    const result = await useSettingsStore.getState().saveProfile(profileForm());

    expect(result).toBe(false);
    expect(useSettingsStore.getState().profilesError).toBe('save threw');
    expect(useSettingsStore.getState().profilesLoading).toBe(false);
  });

  it('stores profile update errors from failed IPC responses', async () => {
    const existingProfile = profile();
    useSettingsStore.setState({ profiles: [existingProfile] });
    setElectronApi({ updateAPIProfile: vi.fn().mockResolvedValue({ success: false, error: 'update rejected' }) });

    const result = await useSettingsStore.getState().updateProfile({ ...existingProfile, name: 'Updated' });

    expect(result).toBe(false);
    expect(useSettingsStore.getState().profiles).toEqual([existingProfile]);
    expect(useSettingsStore.getState().profilesError).toBe('update rejected');
    expect(useSettingsStore.getState().profilesLoading).toBe(false);
  });

  it('stores profile update errors from thrown IPC errors', async () => {
    const existingProfile = profile();
    useSettingsStore.setState({ profiles: [existingProfile] });
    setElectronApi({ updateAPIProfile: vi.fn().mockRejectedValue(new Error('update threw')) });

    const result = await useSettingsStore.getState().updateProfile({ ...existingProfile, name: 'Updated' });

    expect(result).toBe(false);
    expect(useSettingsStore.getState().profiles).toEqual([existingProfile]);
    expect(useSettingsStore.getState().profilesError).toBe('update threw');
    expect(useSettingsStore.getState().profilesLoading).toBe(false);
  });

  it('stores profile delete errors from failed IPC responses', async () => {
    const existingProfile = profile();
    useSettingsStore.setState({ profiles: [existingProfile], activeProfileId: existingProfile.id });
    setElectronApi({ deleteAPIProfile: vi.fn().mockResolvedValue({ success: false, error: 'delete rejected' }) });

    const result = await useSettingsStore.getState().deleteProfile(existingProfile.id);

    expect(result).toBe(false);
    expect(useSettingsStore.getState().profiles).toEqual([existingProfile]);
    expect(useSettingsStore.getState().activeProfileId).toBe(existingProfile.id);
    expect(useSettingsStore.getState().profilesError).toBe('delete rejected');
    expect(useSettingsStore.getState().profilesLoading).toBe(false);
  });

  it('stores profile delete errors from thrown IPC errors', async () => {
    const existingProfile = profile();
    useSettingsStore.setState({ profiles: [existingProfile], activeProfileId: existingProfile.id });
    setElectronApi({ deleteAPIProfile: vi.fn().mockRejectedValue(new Error('delete threw')) });

    const result = await useSettingsStore.getState().deleteProfile(existingProfile.id);

    expect(result).toBe(false);
    expect(useSettingsStore.getState().profiles).toEqual([existingProfile]);
    expect(useSettingsStore.getState().activeProfileId).toBe(existingProfile.id);
    expect(useSettingsStore.getState().profilesError).toBe('delete threw');
    expect(useSettingsStore.getState().profilesLoading).toBe(false);
  });

  it('stores active profile errors from failed IPC responses', async () => {
    useSettingsStore.setState({ activeProfileId: 'profile-1' });
    setElectronApi({ setActiveAPIProfile: vi.fn().mockResolvedValue({ success: false, error: 'activate rejected' }) });

    const result = await useSettingsStore.getState().setActiveProfile('profile-2');

    expect(result).toBe(false);
    expect(useSettingsStore.getState().activeProfileId).toBe('profile-1');
    expect(useSettingsStore.getState().profilesError).toBe('activate rejected');
    expect(useSettingsStore.getState().profilesLoading).toBe(false);
  });

  it('stores active profile errors from thrown IPC errors', async () => {
    useSettingsStore.setState({ activeProfileId: 'profile-1' });
    setElectronApi({ setActiveAPIProfile: vi.fn().mockRejectedValue(new Error('activate threw')) });

    const result = await useSettingsStore.getState().setActiveProfile('profile-2');

    expect(result).toBe(false);
    expect(useSettingsStore.getState().activeProfileId).toBe('profile-1');
    expect(useSettingsStore.getState().profilesError).toBe('activate threw');
    expect(useSettingsStore.getState().profilesLoading).toBe(false);
  });
});
