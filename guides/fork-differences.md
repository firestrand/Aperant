# Aperant Fork Differences

This guide is the canonical overview of how Aperant differs from the starting Auto Claude codebase and from the separate Auto Claude-derived fork whose ideas were selectively adopted.

## Summary

Aperant began from Auto Claude, but it is now a long-lived independent fork with its own product direction, architecture, safety model, and release expectations. Selected ideas from another Auto Claude-derived fork were ported only when they fit Aperant's current TypeScript/Electron application, Vercel AI SDK v6 agent runtime, i18n requirements, cross-platform support, and default-off rollout strategy.

The practical rule is: preserve useful concepts, but implement them as Aperant-native features rather than copying older fork code directly.

## Lineage

### Starting point: Auto Claude

The starting project established the core autonomous coding workflow: users create tasks, agents plan and implement work, QA validates results, and changes are isolated from the user's main branch.

Aperant keeps that product center, but the codebase has diverged enough that upstream or fork changes should not be treated as drop-in patches.

### Aperant as an independent fork

Aperant's current implementation is centered on:

- a single Electron desktop app under `apps/desktop/`;
- a TypeScript-first AI agent layer under `apps/desktop/src/main/ai/`;
- Vercel AI SDK v6 (`ai`) for model calls and tool-use loops;
- provider registry abstractions instead of direct provider SDK calls;
- English/French i18n for user-facing renderer text;
- cross-platform platform helpers for OS-specific behavior;
- isolated git worktrees and task/spec metadata for autonomous builds.

### Selected donor fork features

A separate Auto Claude-derived fork contained useful feature ideas. Aperant adopted a curated subset by reimplementing them inside the current architecture, with risky surfaces gated behind explicit settings and disabled by default.

## What changed in Aperant

### Product direction

Aperant is maintained as its own product line, not as a temporary downstream rename. Documentation and contributions should describe current Aperant behavior first, with historical Auto Claude naming used only where it helps explain lineage or older release artifacts.

### Architecture

Aperant's agent runtime lives in TypeScript and uses the Vercel AI SDK v6. New AI interactions should use `createProvider()` from the provider factory and `streamText()` / `generateText()` from `ai`, not direct Anthropic SDK clients or legacy runtime paths.

### Provider and authentication model

Aperant supports Claude subscription/OAuth flows and API-provider profiles through a provider registry. Features should avoid Claude-only assumptions unless the behavior is genuinely Claude-specific. Provider-neutral wording is preferred in UI and docs; for example, the app keeps the familiar "YOLO" concept but describes it as a cross-provider risk mode.

### Security and rollout model

Ported or newly risky features must preserve Aperant's safety boundaries:

- no direct Node/Electron exposure in the renderer;
- no unreviewed arbitrary code execution surfaces;
- no automatic secret reads;
- no unsafe attachment rendering;
- no default-on background execution for newly introduced automation;
- bounded validation for filesystem paths, command templates, and preview content.

### i18n and platform support

User-facing renderer text must use translation keys in both English and French locale files. Main-process platform behavior must use the platform abstraction in `apps/desktop/src/main/platform/` rather than raw `process.platform` checks.

## Selected fork features adopted

### MCP connector catalog

Aperant added a verified, default-off MCP connector catalog. Catalog entries keep package metadata and use reviewed command conversion rather than accepting arbitrary connector templates.

Details: [mcp-connector-catalog-verification.md](mcp-connector-catalog-verification.md)

### Skills

Skills were adopted as scoped Markdown instruction packs, gated by `skillsEnabled`. Project-local skills are visible only in project context, and prompt assembly receives skills only when the setting is explicitly enabled.

Details: [skills-output-styles-design-slice.md](skills-output-styles-design-slice.md)

### Scheduled recurring tasks

Scheduled tasks were adopted as native Aperant data and runtime behavior, gated by `scheduledTasksEnabled`. Recurrence uses local-time daily/weekly arithmetic so schedules behave as users expect around DST and near-midnight cases.

Details: [scheduled-tasks-recurrence-decision.md](scheduled-tasks-recurrence-decision.md)

### Task attachments and previews

Task attachments were adopted conservatively behind `taskAttachmentsEnabled`. The first slice supports bounded text/Markdown/code/config previews, rejects SVG/HTML, and avoids embedding arbitrary binary contents into prompts.

Details: [task-attachments-preview-strategy.md](task-attachments-preview-strategy.md)

### Usage and persistence hardening

Aperant adopted targeted hardening around atomic file writes and usage cooldown behavior where the change had clear tests and fit existing persistence patterns. Broad mechanical replacement was avoided where sync writes or locking semantics needed more review.

Details: [selected-fork-features-characterization.md](selected-fork-features-characterization.md)

## What was not directly ported

Aperant intentionally did not directly port:

- legacy Python or direct provider-SDK agent runtime paths;
- unverified provider model IDs;
- an executable plugin loader;
- unsafe SVG/HTML attachment rendering;
- arbitrary binary prompt ingestion;
- default-on donor-fork automation;
- older UI/backend code that conflicts with the current Electron/Vercel AI SDK architecture.

The plugin loader remains a no-go/RFC record until a future use case proves it cannot be solved by MCP catalog entries, scoped skills, provider settings, or native scheduled tasks.

Details: [plugin-loader-rfc.md](plugin-loader-rfc.md), [model-metadata-and-mcp-catalog-audit.md](model-metadata-and-mcp-catalog-audit.md)

## Rules for future ports

When comparing Aperant with Auto Claude or other forks:

1. Start from the current `apps/desktop` architecture.
2. Port concepts, not code, unless the source code already matches Aperant's structure and safety model.
3. Keep risky or broad features default-off until validated.
4. Add English and French translations for all renderer UI text.
5. Preserve platform abstraction and cross-platform tests.
6. Include focused tests or verification records for new behavior.
7. Prefer provider-neutral language unless a feature is provider-specific by design.

## Detailed records

The files below are evidence and decision records for the selected adoption work. They are intentionally more detailed than this overview:

- [selected-fork-features-characterization.md](selected-fork-features-characterization.md)
- [mcp-connector-catalog-verification.md](mcp-connector-catalog-verification.md)
- [skills-output-styles-design-slice.md](skills-output-styles-design-slice.md)
- [scheduled-tasks-recurrence-decision.md](scheduled-tasks-recurrence-decision.md)
- [task-attachments-preview-strategy.md](task-attachments-preview-strategy.md)
- [model-metadata-and-mcp-catalog-audit.md](model-metadata-and-mcp-catalog-audit.md)
- [plugin-loader-rfc.md](plugin-loader-rfc.md)
