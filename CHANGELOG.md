# Changelog

## 1.1.2 - 2026-09-14

- Added `aiStatusBar.resetTimeFormat` to show reset times as a clock time, a countdown, or both.
- Added the Claude credential plan and tier to the Claude tooltip.
- Changed the default weekly window label from `wk` to `7d`.
- Fixed Codex availability detection — a missing executable, or a `.cmd`/`.bat` shim in `codex.command`, now reports a clear reason instead of failing silently.
- Added ESLint and Prettier with `lint` and `format` scripts.
- Refreshed the README, privacy reference, and repository docs.

## 1.1.1 - 2026-09-12

- Fixed release-notes extraction to parse changelog headings without regex.
- Added an `install:local` script and VS Code task to install the built extension locally.

## 1.1.0 - 2026-09-12

- Added an "AI Usage" activity-bar panel that mirrors the status-bar tooltips with always-visible, proportional usage bars.
- Added a compact status-bar style (`aiStatusBar.statusBarStyle`) showing percentage only, without gauges.
- Added per-agent brand icons (`aiStatusBar.agentNameStyle`).
- Removed Devin usage monitoring, its settings, and its API fallback.
- Changed the publisher to `joaomariok` and added fork copyright.
- Pinned `@types/vscode` and resolved npm audit advisories.
- Fixed the Codex app-server handshake to report the real extension version instead of a hardcoded `1.0.0`.
- Added tag-driven GitHub Release automation — each release now publishes a downloadable `.vsix` on the Releases page.
- Added repository docs (`docs/`), the `npm run gate` verification script, and dev tooling.

## 1.0.0 - 2026-06-20

- Renamed the extension to **AI Status Bar**.
- Added Codex, Claude Code, and Devin usage monitoring in one status-bar extension.
- Added shared polling, caching, warning thresholds, presentation mode, and hover rendering.
- Added MIT license, privacy notes, publish metadata, and package ignore rules.
