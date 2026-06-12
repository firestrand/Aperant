# Task Attachments and Artifact Preview Strategy

Phase 6 decision record for the selected fork-feature adoption summarized in `fork-differences.md` and tracked in `selected-fork-features-characterization.md`.

## Strategy decision

Use a conservative hybrid strategy:

1. Keep existing image attachment behavior, excluding SVG.
2. Keep referenced files as path references where current task metadata supports them.
3. Copy approved non-image text/Markdown/code/config attachments into the task spec directory only when `taskAttachmentsEnabled === true`.
4. Do not embed arbitrary binary contents directly into prompts.
5. Provide text-only escaped previews through React-rendered text, not inline HTML/SVG.

## First allowed non-image types

The first runtime slice supports `.txt`, `.md`, `.markdown`, common code files, and config files such as JSON/YAML/TOML subject to size and path validation.

PDF support is deferred until extraction and preview behavior are explicitly designed.

## SVG/HTML safety decision

SVG and HTML are rejected by the first runtime slice. SVG is not inert and must not be rendered inline in the Electron renderer. HTML preview also remains blocked unless rendered in a sandboxed, non-Node context with restrictive CSP and no `file://` access.

## Rollout

Runtime ingestion and preview UI are gated by `taskAttachmentsEnabled`, defaulting to `false`. False or undefined bypasses non-image ingestion.
