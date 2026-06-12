# Plugin Loader RFC

Phase 8 of the selected fork-feature adoption summarized in `fork-differences.md` and tracked in `selected-fork-features-characterization.md` is an evaluation gate. This RFC intentionally does not add an executable plugin surface.

## Problem statement

A plugin loader could make Aperant extensible, but it creates a broad trust boundary: plugins may request filesystem access, affect prompts, add UI, or influence scheduled work. The safer MCP catalog and scoped Skills runtime already cover the highest-value extension needs without loading arbitrary code.

## Possible plugin contributions

| Contribution type | Decision |
| --- | --- |
| MCP connector templates | Covered by verified MCP connector catalog. Prefer static reviewed entries. |
| Prompts/skills | Covered by scoped Skills as Markdown instruction packs. |
| UI contributions | Rejected for first plugin-loader scope because renderer injection expands XSS and supply-chain risk. |
| Scheduled tasks | Rejected for first plugin-loader scope; schedules remain native app data with explicit user review. |

## Permission and trust boundaries

A future plugin system must not bypass existing Aperant safety layers: no direct Node/Electron renderer exposure, no arbitrary shell command templates, no automatic secret reads, no prompt injection into structured phases without schema-safety proof, and no background scheduled execution without explicit user-created schedule records.

## Go/no-go criteria

Go only if a future use case cannot be met by MCP catalog entries, scoped Skills, provider settings, or native scheduled tasks, and only with a reviewed implementation plan that defines permissions, signing/trust, storage, UI boundaries, and tests.

No-go for this plan: do not add a plugin loader now. The current implementation ships no executable plugin surface.
