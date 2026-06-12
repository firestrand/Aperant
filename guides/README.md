# Aperant Guides

Detailed documentation for Aperant setup, usage, and project direction.

For the canonical explanation of how Aperant differs from the starting Auto Claude codebase and the selected donor fork, start with [fork-differences.md](fork-differences.md).

## Start Here

| Guide | Description |
|-------|-------------|
| **[fork-differences.md](fork-differences.md)** | Canonical overview of Aperant's fork lineage, architectural divergence, adopted fork features, and future porting rules |

## User and Platform Guides

| Guide | Description |
|-------|-------------|
| **[CLI-USAGE.md](CLI-USAGE.md)** | Desktop-first usage notes, source-running commands, and configuration overview |
| **[windows-development.md](windows-development.md)** | Windows-specific development guide (file encoding, paths, line endings) |
| **[linux.md](linux.md)** | Linux-specific installation and build guide (Flatpak, AppImage) |

## Adoption Records and Evidence

These records preserve the detailed decisions behind selected features ported from another Auto Claude-derived fork. They support [fork-differences.md](fork-differences.md) rather than replacing it.

| Guide | Description |
|-------|-------------|
| **[selected-fork-features-characterization.md](selected-fork-features-characterization.md)** | Detailed adoption record, characterization coverage, rollout settings, and remaining candidate inventory |
| **[mcp-connector-catalog-verification.md](mcp-connector-catalog-verification.md)** | MCP catalog package verification and safety record |
| **[skills-output-styles-design-slice.md](skills-output-styles-design-slice.md)** | Skills and output-style adoption decision record |
| **[scheduled-tasks-recurrence-decision.md](scheduled-tasks-recurrence-decision.md)** | Scheduled task recurrence semantics and local-time decision |
| **[task-attachments-preview-strategy.md](task-attachments-preview-strategy.md)** | Task attachment and preview safety strategy |
| **[model-metadata-and-mcp-catalog-audit.md](model-metadata-and-mcp-catalog-audit.md)** | Model metadata and MCP catalog audit record |
| **[plugin-loader-rfc.md](plugin-loader-rfc.md)** | Plugin-loader no-go/RFC evaluation |

## Quick Links

- [Main README](../README.md) - Getting started (download and install)
- [Contributing](../CONTRIBUTING.md) - How to contribute and run from source
- [Changelog](../CHANGELOG.md) - Release history
