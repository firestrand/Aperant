import type { CustomMcpServer } from '../types/project';

export type McpCatalogCategory = 'filesystem' | 'code-hosting' | 'monitoring' | 'database' | 'search' | 'browser' | 'utility';
export type McpCatalogInstallKind = 'command' | 'http';
export type McpCatalogRiskLevel = 'low' | 'medium' | 'high';
export type McpCatalogMaintenanceStatus = 'verified' | 'vendor-maintained' | 'deprecated' | 'unknown';

export interface McpCatalogRequiredEnv {
  name: string;
  descriptionKey: string;
  required: boolean;
}

export interface McpCatalogEntry {
  id: string;
  nameKey: string;
  descriptionKey: string;
  category: McpCatalogCategory;
  installKind: McpCatalogInstallKind;
  transport: 'stdio' | 'http';
  riskLevel: McpCatalogRiskLevel;
  maintenanceStatus: McpCatalogMaintenanceStatus;
  verifiedAt: string;
  homepage: string;
  license: string;
  packageName?: string;
  packageVersion?: string;
  installCommandTemplate?: string;
  command?: string;
  args?: string[];
  url?: string;
  requiredEnv?: McpCatalogRequiredEnv[];
  sourceUrl: string;
}

export interface McpCatalogValidationResult {
  valid: boolean;
  duplicateIds: string[];
  unsafeEntries: string[];
  entriesWithPlaceholders: string[];
  entriesMissingPackageVersion: string[];
  entriesWithUnpinnedPackageArgs: string[];
}

const SAFE_COMMANDS = new Set(['npx', 'npm', 'node', 'python', 'python3', 'uv', 'uvx']);
const PLACEHOLDER_PATTERN = /\{\{[^}]+\}\}|<[^>]+>/;

export const MCP_CONNECTOR_CATALOG: McpCatalogEntry[] = [
  {
    id: 'linear-remote',
    nameKey: 'mcp.catalog.entries.linear.name',
    descriptionKey: 'mcp.catalog.entries.linear.description',
    category: 'utility',
    installKind: 'command',
    transport: 'stdio',
    riskLevel: 'medium',
    maintenanceStatus: 'vendor-maintained',
    verifiedAt: '2026-06-11',
    homepage: 'https://linear.app/docs/mcp',
    license: 'MIT for mcp-remote bridge; Linear hosted service is vendor-managed',
    packageName: 'mcp-remote',
    packageVersion: '0.1.38',
    command: 'npx',
    args: ['-y', 'mcp-remote@0.1.38', 'https://mcp.linear.app/mcp'],
    sourceUrl: 'https://linear.app/docs/mcp',
  },
  {
    id: 'notion-remote',
    nameKey: 'mcp.catalog.entries.notion.name',
    descriptionKey: 'mcp.catalog.entries.notion.description',
    category: 'utility',
    installKind: 'command',
    transport: 'stdio',
    riskLevel: 'medium',
    maintenanceStatus: 'vendor-maintained',
    verifiedAt: '2026-06-11',
    homepage: 'https://developers.notion.com/guides/mcp/get-started-with-mcp',
    license: 'MIT for mcp-remote bridge; Notion hosted service is vendor-managed',
    packageName: 'mcp-remote',
    packageVersion: '0.1.38',
    command: 'npx',
    args: ['-y', 'mcp-remote@0.1.38', 'https://mcp.notion.com/mcp'],
    sourceUrl: 'https://developers.notion.com/guides/mcp/get-started-with-mcp',
  },
  {
    id: 'atlassian-rovo-remote',
    nameKey: 'mcp.catalog.entries.atlassianRovo.name',
    descriptionKey: 'mcp.catalog.entries.atlassianRovo.description',
    category: 'utility',
    installKind: 'command',
    transport: 'stdio',
    riskLevel: 'medium',
    maintenanceStatus: 'vendor-maintained',
    verifiedAt: '2026-06-11',
    homepage: 'https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/',
    license: 'MIT for mcp-remote bridge; Atlassian hosted service is vendor-managed',
    packageName: 'mcp-remote',
    packageVersion: '0.1.38',
    command: 'npx',
    args: ['-y', 'mcp-remote@0.1.38', 'https://mcp.atlassian.com/v1/mcp/authv2'],
    sourceUrl: 'https://support.atlassian.com/atlassian-rovo-mcp-server/docs/setting-up-ides/',
  },
];

export function catalogEntryToCustomMcpServer(entry: McpCatalogEntry): CustomMcpServer {
  if (entry.installKind === 'http') {
    if (!entry.url) {
      throw new Error(`Catalog entry ${entry.id} is missing an HTTP URL.`);
    }
    return {
      id: entry.id,
      name: entry.nameKey,
      type: 'http',
      url: entry.url,
      description: entry.descriptionKey,
    };
  }

  if (!entry.command) {
    throw new Error(`Catalog entry ${entry.id} is missing a command.`);
  }

  return {
    id: entry.id,
    name: entry.nameKey,
    type: 'command',
    command: entry.command,
    args: entry.args ?? [],
    description: entry.descriptionKey,
  };
}

export function catalogEntryRequiresUserConfiguration(entry: McpCatalogEntry): boolean {
  const hasRequiredEnv = entry.requiredEnv?.some((env) => env.required) ?? false;
  const hasPlaceholder = PLACEHOLDER_PATTERN.test(JSON.stringify(entry));
  return hasRequiredEnv || hasPlaceholder;
}

export function validateMcpCatalog(entries: McpCatalogEntry[]): McpCatalogValidationResult {
  const seen = new Set<string>();
  const duplicateIds = new Set<string>();
  const unsafeEntries: string[] = [];
  const entriesWithPlaceholders: string[] = [];
  const entriesMissingPackageVersion: string[] = [];
  const entriesWithUnpinnedPackageArgs: string[] = [];

  for (const entry of entries) {
    if (seen.has(entry.id)) {
      duplicateIds.add(entry.id);
    }
    seen.add(entry.id);

    if (entry.installKind === 'command' && (!entry.command || !SAFE_COMMANDS.has(entry.command))) {
      unsafeEntries.push(entry.id);
    }

    if (entry.packageName && !entry.packageVersion) {
      entriesMissingPackageVersion.push(entry.id);
    }

    if (entry.installKind === 'command' && entry.packageName && entry.packageVersion) {
      const expectedPackageArg = `${entry.packageName}@${entry.packageVersion}`;
      if (!entry.args?.includes(expectedPackageArg)) {
        entriesWithUnpinnedPackageArgs.push(entry.id);
      }
    }

    const serialized = JSON.stringify(entry);
    if (PLACEHOLDER_PATTERN.test(serialized)) {
      entriesWithPlaceholders.push(entry.id);
    }
  }

  return {
    valid: duplicateIds.size === 0 && unsafeEntries.length === 0 && entriesMissingPackageVersion.length === 0 && entriesWithUnpinnedPackageArgs.length === 0,
    duplicateIds: Array.from(duplicateIds),
    unsafeEntries,
    entriesWithPlaceholders,
    entriesMissingPackageVersion,
    entriesWithUnpinnedPackageArgs,
  };
}

export function isMcpConnectorCatalogEnabled(settings: { mcpConnectorCatalogEnabled?: boolean }): boolean {
  return settings.mcpConnectorCatalogEnabled === true;
}
