// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '../../../shared/constants';
import { useProjectStore } from '../../stores/project-store';
import { useSettingsStore } from '../../stores/settings-store';

const electronApi = vi.hoisted(() => ({
  getProjectEnv: vi.fn(),
  updateProjectEnv: vi.fn(),
  checkMcpHealth: vi.fn(),
  testMcpConnection: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const labels: Record<string, string> = {
        'settings:mcp.projectEnabled': 'Project enabled',
        'settings:mcp.projectOverride': 'Project override',
        'settings:mcp.disabledInherited': 'Disabled inherited',
        'settings:mcp.globalServer': 'Global server',
        'settings:mcp.servers.context7.name': 'Context7',
        'settings:mcp.servers.context7.description': 'Documentation lookup for libraries',
        'settings:mcp.servers.memory.name': 'Graphiti Memory',
        'settings:mcp.servers.memory.description': 'Knowledge graph for cross-session context',
        'settings:mcp.servers.memory.notConfigured': 'Requires memory configuration',
        'settings:mcp.servers.linear.name': 'Linear',
        'settings:mcp.servers.linear.description': 'Project management integration',
        'settings:mcp.servers.linear.notConfigured': 'Requires Linear integration',
        'settings:mcp.configuration': 'MCP Server Configuration',
        'settings:mcp.configurationHint': 'Disabled servers reduce context usage and startup time',
        'settings:mcp.browserAutomation': 'Browser Automation',
        'settings:mcp.toggleServer': `Toggle ${params?.server ?? ''} MCP server`,
      };
      return labels[key] ?? key;
    },
  }),
}));

vi.mock('../settings/McpSettingsPanel', () => ({
  McpSettingsPanel: () => null,
}));

vi.mock('../CustomMcpDialog', () => ({
  CustomMcpDialog: () => null,
}));

import { AgentTools } from '../AgentTools';

describe('AgentTools built-in MCP source labels', () => {
  beforeEach(() => {
    electronApi.getProjectEnv.mockResolvedValue({
      success: true,
      data: {
        linearEnabled: true,
        memoryEnabled: false,
        memoryMcpUrl: undefined,
        mcpServers: {
          context7Enabled: true,
          linearMcpEnabled: false,
        },
        customMcpServers: [],
      },
    });
    electronApi.updateProjectEnv.mockResolvedValue({ success: true });
    electronApi.checkMcpHealth.mockResolvedValue({ success: true, data: undefined });
    electronApi.testMcpConnection.mockResolvedValue({ success: true, data: { success: true } });
    Object.defineProperty(window, 'electronAPI', {
      value: electronApi,
      configurable: true,
    });

    useSettingsStore.setState({ settings: DEFAULT_APP_SETTINGS });
    useProjectStore.setState({
      selectedProjectId: 'project-1',
      projects: [
        {
          id: 'project-1',
          name: 'Project 1',
          path: '/tmp/project-1',
          autoBuildPath: '.auto-claude',
          settings: {
            projectAgentOverrides: undefined,
          },
        } as never,
      ],
    });
  });

  it('distinguishes project overrides from inherited MCP states and persists toggles', async () => {
    render(React.createElement(AgentTools));

    await waitFor(() => expect(screen.getByText('MCP Server Configuration')).toBeTruthy());

    expect(screen.getByText('Project enabled')).toBeTruthy();
    expect(screen.getByText('Project override')).toBeTruthy();
    expect(screen.getAllByText('Disabled inherited').length).toBeGreaterThan(0);

    const memorySwitch = screen.getByRole('switch', { name: 'Toggle Graphiti Memory MCP server' });
    expect(memorySwitch).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('switch', { name: 'Toggle Context7 MCP server' }));

    await waitFor(() => expect(electronApi.updateProjectEnv).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        mcpServers: expect.objectContaining({ context7Enabled: false }),
      }),
    ));
  });
});
