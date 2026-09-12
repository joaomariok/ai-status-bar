# AGENTS.md

AI Status Bar is a VS Code extension that shows Codex and Claude Code usage in
the status bar.

Read [docs/index.md](docs/index.md) for repository knowledge beyond this file:
architecture, agent-provider internals, development workflow, and
build/release mechanics. Load only the specific document you need.

## Before considering a change complete

```sh
npm run gate
```

Typecheck → tests → packaging dry-run. See
[docs/development.md](docs/development.md#the-gate).

## Rules

- **Never hand-edit** `out/` (compiler output, gitignored) or
  `package-lock.json`.
- Never log, cache, or persist the Claude OAuth token — it must stay
  in-memory only for the lifetime of one fetch. See
  [docs/agent-providers.md](docs/agent-providers.md#claude).
- Keep `codex.command` `scope: "machine"` in `package.json` — this is a
  deliberate security boundary, not an oversight.
- Route all dynamic tooltip text through `escapeMarkdown()`
  (`src/shared/format.ts`) before rendering.
- Adding or changing an `aiStatusBar.*` setting touches **three** places:
  `package.json` `contributes.configuration`, `src/shared/settings.ts` (or an
  inline getter), and the settings table in `README.md`. See
  [docs/architecture.md](docs/architecture.md#adding-or-changing-a-setting).
- This is a fork tracking upstream. Prefer additive, isolated changes; avoid
  reformatting or restructuring files you don't need to touch.
- No new dependencies without a compelling reason — the extension currently
  has zero runtime dependencies.
