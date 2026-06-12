# Skills and Output Styles Design Slice

Phase 4 design note for the selected fork-feature adoption documented in `selected-fork-features-characterization.md`.

## Why not just project instructions?

`AGENTS.md` and `CLAUDE.md` are project-local, always-on instruction files. The first Skills slice adds only behavior those files do not provide: reusable global/project `SKILL.md` instruction packs, user-visible enable/disable state, per-surface metadata for future routing, and a global rollout/rollback setting.

## First slice scope

- Skills are Markdown instruction packs with frontmatter metadata.
- User skills live under the Electron user data skills directory.
- Project skills are discovered from `.aperant/skills`, `.claude/skills`, and `.agents/skills`.
- Enabled state is persisted separately from skill content.
- Skills are injected only through the existing TypeScript prompt assembly path.
- Runtime injection requires `skillsEnabled === true`; false or undefined fully bypasses discovery/injection.

## Output styles decision

Output styles are intentionally deferred from runtime code in this adoption pass. They must only target chat/prose surfaces such as Insights in a follow-up slice and must not be injected into structured planner/coder/QA schema-bound phases.

The current implementation satisfies the design rule by adding no output-style instructions to structured phases. A future output-style slice must add focused tests proving planner/coder/QA prompts do not receive prose style instructions.

## Out of scope for this slice

- Tool permission grants.
- Executable plugin behavior.
- Direct Anthropic SDK paths.
- Output-style runtime for structured phases.
