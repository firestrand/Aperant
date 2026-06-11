import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { IPCResult, ProjectEnvConfig } from '../../../shared/types';

type IpcHandler = (event: unknown, ...args: unknown[]) => Promise<unknown>;
const registeredHandlers = new Map<string, IpcHandler>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: IpcHandler) => {
      registeredHandlers.set(channel, handler);
    }),
  },
  app: {
    getPath: vi.fn(() => tmpdir()),
  },
}));

vi.mock('../../project-store', () => ({
  projectStore: {
    getProject: vi.fn(),
  },
}));

import { registerEnvHandlers } from '../env-handlers';
import { projectStore } from '../../project-store';

describe('env MCP source preservation', () => {
  let projectPath: string;
  let envGet: IpcHandler;

  beforeEach(() => {
    registeredHandlers.clear();
    projectPath = join(tmpdir(), `env-mcp-source-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(join(projectPath, '.auto-claude'), { recursive: true });
    vi.mocked(projectStore.getProject).mockReturnValue({
      id: 'project-1',
      name: 'Project 1',
      path: projectPath,
      autoBuildPath: '.auto-claude',
    } as never);
    registerEnvHandlers(() => null);
    const handler = registeredHandlers.get(IPC_CHANNELS.ENV_GET);
    if (!handler) throw new Error('ENV_GET handler not registered');
    envGet = handler;
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('does not materialize inherited built-in MCP defaults as explicit project values', async () => {
    writeFileSync(join(projectPath, '.auto-claude', '.env'), 'LINEAR_API_KEY=project-linear-key\n');

    const result = await envGet({}, 'project-1') as IPCResult<ProjectEnvConfig>;

    expect(result.success).toBe(true);
    expect(result.data?.mcpServers).toEqual({});
    expect(result.data?.linearEnabled).toBe(true);
    expect(result.data?.linearApiKey).toBe('project-linear-key');
  });

  it('returns explicit MCP project overrides only when env vars are present', async () => {
    writeFileSync(join(projectPath, '.auto-claude', '.env'), [
      'CONTEXT7_ENABLED=false',
      'GRAPHITI_ENABLED=true',
      'LINEAR_MCP_ENABLED=false',
      'ELECTRON_MCP_ENABLED=true',
      'PUPPETEER_MCP_ENABLED=false',
    ].join('\n'));

    const result = await envGet({}, 'project-1') as IPCResult<ProjectEnvConfig>;

    expect(result.success).toBe(true);
    expect(result.data?.mcpServers).toEqual({
      context7Enabled: false,
      memoryEnabled: true,
      linearMcpEnabled: false,
      electronEnabled: true,
      puppeteerEnabled: false,
    });
  });
});
