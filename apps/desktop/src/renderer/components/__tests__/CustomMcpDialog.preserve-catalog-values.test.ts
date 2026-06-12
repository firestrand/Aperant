import { describe, expect, it } from 'vitest';

import { preserveMcpCatalogValueIfUnchanged } from '../mcp-catalog-values';

const translations: Record<string, string> = {
  'settings:mcp.catalog.entries.linear.name': 'Linear Remote MCP',
  'settings:mcp.catalog.entries.linear.description': 'Official Linear remote MCP server bridged through mcp-remote.',
};

function t(key: string): string {
  return translations[key] ?? key;
}

describe('preserveMcpCatalogValueIfUnchanged', () => {
  it('preserves key-backed catalog values when localized text is unchanged', () => {
    expect(preserveMcpCatalogValueIfUnchanged(
      'settings:mcp.catalog.entries.linear.name',
      'Linear Remote MCP',
      t
    )).toBe('settings:mcp.catalog.entries.linear.name');

    expect(preserveMcpCatalogValueIfUnchanged(
      'settings:mcp.catalog.entries.linear.description',
      'Official Linear remote MCP server bridged through mcp-remote.',
      t
    )).toBe('settings:mcp.catalog.entries.linear.description');
  });

  it('stores custom edits as literal text', () => {
    expect(preserveMcpCatalogValueIfUnchanged(
      'settings:mcp.catalog.entries.linear.name',
      'My Linear MCP',
      t
    )).toBe('My Linear MCP');
  });
});
