import { describe, expect, it } from 'vitest';

import {
  MCP_CONNECTOR_CATALOG,
  catalogEntryRequiresUserConfiguration,
  catalogEntryToCustomMcpServer,
  isMcpConnectorCatalogEnabled,
  type McpCatalogEntry,
  validateMcpCatalog,
} from '../connector-catalog';

const commandEntry: McpCatalogEntry = {
  id: 'verified-search',
  nameKey: 'mcp.catalog.entries.verifiedSearch.name',
  descriptionKey: 'mcp.catalog.entries.verifiedSearch.description',
  category: 'search',
  installKind: 'command',
  transport: 'stdio',
  riskLevel: 'medium',
  maintenanceStatus: 'vendor-maintained',
  verifiedAt: '2026-06-11',
  homepage: 'https://example.com/search-mcp',
  license: 'MIT',
  packageName: '@vendor/search-mcp',
  packageVersion: '1.2.3',
  command: 'npx',
  args: ['-y', '@vendor/search-mcp@1.2.3'],
  requiredEnv: [{ name: 'SEARCH_API_KEY', descriptionKey: 'mcp.catalog.env.searchApiKey', required: true }],
  sourceUrl: 'https://example.com/search-mcp/package',
};

describe('catalogEntryToCustomMcpServer', () => {
  it('converts command catalog entries into CustomMcpServer objects', () => {
    expect(catalogEntryToCustomMcpServer(commandEntry)).toEqual({
      id: 'verified-search',
      name: 'mcp.catalog.entries.verifiedSearch.name',
      type: 'command',
      command: 'npx',
      args: ['-y', '@vendor/search-mcp@1.2.3'],
      description: 'mcp.catalog.entries.verifiedSearch.description',
    });
  });

  it('converts HTTP catalog entries into CustomMcpServer objects', () => {
    expect(catalogEntryToCustomMcpServer({
      ...commandEntry,
      id: 'verified-http',
      installKind: 'http',
      transport: 'http',
      command: undefined,
      args: undefined,
      url: 'https://mcp.example.com/mcp',
    })).toMatchObject({
      id: 'verified-http',
      type: 'http',
      url: 'https://mcp.example.com/mcp',
    });
  });
});

describe('validateMcpCatalog', () => {
  it('keeps the shipped catalog safe and deterministic', () => {
    const result = validateMcpCatalog(MCP_CONNECTOR_CATALOG);

    expect(result).toEqual({
      valid: true,
      duplicateIds: [],
      unsafeEntries: [],
      entriesWithPlaceholders: [],
      entriesMissingPackageVersion: [],
      entriesWithUnpinnedPackageArgs: [],
    });
    expect(MCP_CONNECTOR_CATALOG).toHaveLength(3);
  });

  it('detects duplicate IDs and unsafe commands', () => {
    const result = validateMcpCatalog([
      commandEntry,
      { ...commandEntry },
      { ...commandEntry, id: 'unsafe', command: 'curl' },
    ]);

    expect(result.valid).toBe(false);
    expect(result.duplicateIds).toEqual(['verified-search']);
    expect(result.unsafeEntries).toEqual(['unsafe']);
  });

  it('records placeholders for entries that need user editing', () => {
    const result = validateMcpCatalog([
      { ...commandEntry, id: 'placeholder', args: ['-y', '@vendor/search-mcp@1.2.3', '--path', '{{PROJECT_PATH}}'] },
    ]);

    expect(result.entriesWithPlaceholders).toEqual(['placeholder']);
  });

  it('requires package-backed entries to record a verified package version', () => {
    const result = validateMcpCatalog([
      { ...commandEntry, id: 'missing-version', packageVersion: undefined },
    ]);

    expect(result.valid).toBe(false);
    expect(result.entriesMissingPackageVersion).toEqual(['missing-version']);
  });

  it('requires package-backed command entries to execute the verified package version', () => {
    const result = validateMcpCatalog([
      { ...commandEntry, id: 'unpinned-package', args: ['-y', '@vendor/search-mcp'] },
    ]);

    expect(result.valid).toBe(false);
    expect(result.entriesWithUnpinnedPackageArgs).toEqual(['unpinned-package']);
  });
});

describe('catalogEntryRequiresUserConfiguration', () => {
  it('requires confirmation when required env vars or placeholders are present', () => {
    expect(catalogEntryRequiresUserConfiguration(commandEntry)).toBe(true);
    expect(catalogEntryRequiresUserConfiguration({ ...commandEntry, requiredEnv: [] })).toBe(false);
    expect(catalogEntryRequiresUserConfiguration({
      ...commandEntry,
      requiredEnv: [],
      args: ['-y', '@vendor/search-mcp@1.2.3', '--path', '{{PROJECT_PATH}}'],
    })).toBe(true);
  });
});

describe('isMcpConnectorCatalogEnabled', () => {
  it('is default-off unless explicitly enabled', () => {
    expect(isMcpConnectorCatalogEnabled({})).toBe(false);
    expect(isMcpConnectorCatalogEnabled({ mcpConnectorCatalogEnabled: false })).toBe(false);
    expect(isMcpConnectorCatalogEnabled({ mcpConnectorCatalogEnabled: true })).toBe(true);
  });
});
