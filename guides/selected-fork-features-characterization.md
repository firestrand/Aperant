# Selected Fork Feature Adoption Record

This is a detailed adoption record for selected features ported from another Auto Claude-derived fork. For the reader-friendly overview of Aperant's lineage and fork differences, see [fork-differences.md](fork-differences.md).

This repository was forked from upstream Aperant after Auto Claude was renamed. It is currently maintained separately while upstream Aperant 3.0 mergeability is evaluated. The features below were adopted only where they fit this repository's TypeScript-first Electron architecture, Vercel AI SDK v6 agent runtime, security model, i18n requirements, and default-off rollout strategy.

## Characterization tests and current coverage

| Area | Existing or added coverage |
| --- | --- |
| MCP catalog conversion/safety | `apps/desktop/src/shared/mcp/__tests__/connector-catalog.test.ts` covers safe allowlisted commands, deterministic conversion, duplicate IDs, placeholders, package-version metadata, and default-off rollout predicate. |
| Atomic async retry | `apps/desktop/src/main/utils/__tests__/atomic-file-retry.test.ts` covers transient async retry and non-transient failure behavior. |
| Atomic sync cleanup | `apps/desktop/src/main/utils/__tests__/atomic-file.test.ts` covers sync atomic writes and temp cleanup on failure. |
| Atomic sync retry/fallback | `apps/desktop/src/main/utils/__tests__/atomic-file-sync-retry.test.ts` covers transient retry, direct-write fallback, and non-transient no-fallback behavior. |
| Usage monitor cooldowns | `apps/desktop/src/main/claude-profile/usage-monitor.test.ts` covers per-profile API failure cooldown, Retry-After 429 cooldown, sibling configDir blocking, unrelated profile availability, and repeated log suppression. |
| Skills prompt path | `apps/desktop/src/main/skills/__tests__/skill-parser.test.ts`, `skills-manager.test.ts`, and `apps/desktop/src/main/ai/prompts/__tests__/prompt-loader.test.ts` cover parsing, persistence, and existing prompt assembly injection. |

## Atomic sync hardening candidate call-site inventory

| Candidate | Status |
| --- | --- |
| `apps/desktop/src/main/settings-utils.ts` | Migrated to `writeFileAtomicSyncWithRetry` with focused regression coverage. |
| `apps/desktop/src/main/project-store.ts` | Candidate remains for later reviewed migration; not mechanically replaced. |
| `apps/desktop/src/main/ipc-handlers/task/plan-file-utils.ts` | Candidate remains for later reviewed migration because sync functions bypass async locks and need separate race analysis. |
| selected task/spec phase-state persistence in `execution-handlers.ts` | Candidate remains for later reviewed migration after focused tests. |

## Rollout settings inventory

| Phase | Setting | Default | Rollback |
| --- | --- | --- | --- |
| Phase 1 MCP catalog | `mcpConnectorCatalogEnabled` | `false` / undefined bypass | Disable setting; remove installed global custom MCP entries through existing MCP settings. |
| Phase 4 Skills | `skillsEnabled` | `false` / undefined bypass | Disable setting; prompt assembly receives no `## SKILLS` section and UI does not discover skills. |
| Phase 5 scheduled recurring tasks | `scheduledTasksEnabled` | `false` / undefined bypass | Disable setting; scheduler runtime does not start; UI hides schedule management. |
| Phase 6 attachments/previews | `taskAttachmentsEnabled` | `false` / undefined bypass | Disable setting; non-image attachment ingestion bypasses and preview UI stays opt-in. |

## Attachment/SVG current-state note

Current image handling excludes SVG through the shared `ALLOWED_IMAGE_TYPES` allowlist and main-process attachment validators. Non-image attachment ingestion is gated by `taskAttachmentsEnabled` and accepts only conservative text/Markdown/code/config files with bounded text previews.
