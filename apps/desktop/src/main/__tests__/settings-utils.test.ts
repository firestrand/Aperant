import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeFileAtomicSyncWithRetry: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/aperant-settings-utils-test'),
  },
}));

vi.mock('../utils/atomic-file', () => ({
  writeFileAtomicSyncWithRetry: mocks.writeFileAtomicSyncWithRetry,
}));

import path from 'path';
import { writeSettingsFile } from '../settings-utils';

describe('settings-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes settings through sync atomic retry helper', () => {
    const settings = { theme: 'dark', mcpConnectorCatalogEnabled: true };

    writeSettingsFile(settings);

    expect(mocks.writeFileAtomicSyncWithRetry).toHaveBeenCalledWith(
      path.join('/tmp/aperant-settings-utils-test', 'settings.json'),
      JSON.stringify(settings, null, 2),
      { encoding: 'utf-8' }
    );
  });
});
