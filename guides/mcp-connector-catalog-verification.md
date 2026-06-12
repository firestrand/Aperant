# MCP Connector Catalog Verification

Phase 1 installs verified remote MCP connectors into global custom MCP server defaults. The rollout setting is `mcpConnectorCatalogEnabled`; leaving it undefined or `false` hides and bypasses the catalog UI.

## Install target decision

Catalog entries install into global custom MCP servers (`globalMcpServers`). Project-level catalog installation is deferred so the first slice does not introduce a parallel MCP configuration model.

Rollback: set `mcpConnectorCatalogEnabled` to `false` and remove any installed global custom MCP server entries through the existing MCP settings UI.

## Verification table

| Entry | Command | Package/version | Transport | License | Auth/env requirements | Source verified | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Linear Remote MCP | `npx -y mcp-remote@0.1.38 https://mcp.linear.app/mcp` | `mcp-remote@0.1.38` | stdio bridge to remote HTTP MCP | MIT bridge; Linear hosted service vendor-managed | OAuth/browser auth handled by Linear remote MCP; no static env var in catalog | 2026-06-11, Linear MCP docs | Vendor remote connector; no placeholders. |
| Notion Remote MCP | `npx -y mcp-remote@0.1.38 https://mcp.notion.com/mcp` | `mcp-remote@0.1.38` | stdio bridge to remote HTTP MCP | MIT bridge; Notion hosted service vendor-managed | OAuth/browser auth handled by Notion remote MCP; no static env var in catalog | 2026-06-11, Notion MCP docs | Vendor remote connector; no placeholders. |
| Atlassian Rovo Remote MCP | `npx -y mcp-remote@0.1.38 https://mcp.atlassian.com/v1/mcp/authv2` | `mcp-remote@0.1.38` | stdio bridge to remote HTTP MCP | MIT bridge; Atlassian hosted service vendor-managed | OAuth/browser auth handled by Atlassian remote MCP; no static env var in catalog | 2026-06-11, Atlassian Rovo MCP docs | Vendor remote connector; no placeholders. |

Package metadata check performed with `npm view mcp-remote version license deprecated --json`, returning version `0.1.38`, license `MIT`, and no deprecated flag.
