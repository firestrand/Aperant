import { describe, expect, it } from 'vitest';
import { AgentManager } from '../agent-manager';
import type { CustomMcpServer } from '../../../shared/types';

describe('AgentManager MCP project env parity', () => {
  it('resolves MCP options only from project env vars and global/project custom servers', () => {
    const globalServer: CustomMcpServer = {
      id: 'global-server',
      name: 'Global Server',
      type: 'command',
      command: 'node',
      args: ['global.js'],
    };
    const projectServer: CustomMcpServer = {
      id: 'project-server',
      name: 'Project Server',
      type: 'command',
      command: 'node',
      args: ['project.js'],
    };

    const options = AgentManager.resolveProjectMcpOptions({
      GRAPHITI_MCP_URL: 'http://127.0.0.1:8000/mcp',
      GRAPHITI_ENABLED: 'false',
      LINEAR_API_KEY: 'linear-project-key',
      LINEAR_MCP_ENABLED: 'true',
      CONTEXT7_ENABLED: 'false',
      ELECTRON_MCP_ENABLED: 'true',
      PUPPETEER_MCP_ENABLED: 'false',
      AGENT_MCP_build_orchestrator_ADD: 'project-server',
      AGENT_MCP_build_orchestrator_REMOVE: 'legacy-server',
      CUSTOM_MCP_SERVERS: JSON.stringify([projectServer, { ...globalServer, name: 'Duplicate Global' }]),
    }, 'build_orchestrator', [globalServer], {
      context7Enabled: true,
      serenaEnabled: true,
      serenaLaunchWebUi: false,
    });

    expect(options).toMatchObject({
      context7Enabled: false,
      memoryEnabled: false,
      memoryMcpUrl: 'http://127.0.0.1:8000/mcp',
      linearEnabled: true,
      linearApiKey: 'linear-project-key',
      electronMcpEnabled: true,
      puppeteerMcpEnabled: false,
      serenaEnabled: true,
      serenaLaunchWebUi: false,
      agentMcpAdd: 'project-server',
      agentMcpRemove: 'legacy-server',
    });
    expect(options.customMcpServers).toEqual([globalServer, projectServer]);
  });

  it('does not infer Memory or Linear MCP settings when project env vars are absent', () => {
    const options = AgentManager.resolveProjectMcpOptions({}, 'build_orchestrator');

    expect(options.context7Enabled).toBe(true);
    expect(options.memoryEnabled).toBe(false);
    expect(options.memoryMcpUrl).toBeUndefined();
    expect(options.linearEnabled).toBe(false);
    expect(options.linearApiKey).toBeUndefined();
    expect(options.serenaEnabled).toBe(false);
    expect(options.serenaLaunchWebUi).toBe(true);
  });

  it('uses global built-in MCP defaults when project env vars are absent', () => {
    const options = AgentManager.resolveProjectMcpOptions({}, 'build_orchestrator', [], {
      context7Enabled: false,
      serenaEnabled: true,
      serenaLaunchWebUi: false,
    });

    expect(options.context7Enabled).toBe(false);
    expect(options.serenaEnabled).toBe(true);
    expect(options.serenaLaunchWebUi).toBe(false);
  });
});

describe('AgentManager memory MCP enablement', () => {
  it('lets explicit GRAPHITI_ENABLED=false override a configured MCP URL', () => {
    expect(AgentManager.resolveMemoryMcpEnabled('false', 'http://127.0.0.1:8000/mcp')).toBe(false);
  });

  it('enables memory MCP from URL when no explicit project toggle exists', () => {
    expect(AgentManager.resolveMemoryMcpEnabled(undefined, 'http://127.0.0.1:8000/mcp')).toBe(true);
  });

  it('uses explicit true even without URL', () => {
    expect(AgentManager.resolveMemoryMcpEnabled('true', undefined)).toBe(true);
  });
});
