# Model Metadata Verification and MCP Catalog Audit

Phase 7 verification record for the selected fork-feature adoption documented in `selected-fork-features-characterization.md`.

## Model metadata decision

No new fork-proposed model IDs are added in this implementation slice. Because no model defaults or static model catalog entries changed, there are no new provider model IDs to verify against provider docs, live model listing, or `model-discovery-service.ts`.

Future model additions must include provider documentation or live listing evidence, exact model ID string, compatibility notes, and static catalog/helper tests before shipping defaults.

Unverified model candidates are intentionally dropped from this implementation scope.

## MCP catalog audit

Phase 1 package evidence is present in `guides/mcp-connector-catalog-verification.md` and catalog data in `apps/desktop/src/shared/mcp/connector-catalog.ts` records `packageName`, `packageVersion`, `verifiedAt`, `license`, and `sourceUrl`.

Current shipped connector entries all use verified `mcp-remote@0.1.38` metadata and vendor-hosted remote MCP URLs. No unverified package names are shipped in catalog defaults.
