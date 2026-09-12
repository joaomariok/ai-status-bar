# Development

## Setup

```sh
npm install
```

No project Python/other-language environment is used; this is a pure
TypeScript/Node project. Requires Node `20.19.0+`, compatible with
`@types/node@^20`, and `vscode-engines ^1.85.0`.

## Watch loop

```sh
npm run watch
```

Runs `tsc -watch -p ./`, emitting to `out/`. Pair with the Extension
Development Host below to see changes live — reload the host window
(`Ctrl+R` / `Cmd+R`) after each recompile; there is no auto-reload.

## Running the extension (F5)

`.vscode/launch.json` defines a **Run Extension** configuration that opens a
new VS Code window with this extension loaded (`--extensionDevelopmentPath`).
Its `preLaunchTask` runs the `npm: watch` task first so `out/` exists before
the host starts. Press F5, or use the Run and Debug panel.

This is not exercised by the automated gate — verify manually after changes
that affect activation, commands, or status-bar rendering.

## Installing into your own VS Code

```sh
npm run install:local
```

Runs `scripts/install-local.mjs`: compiles, packages a `.vsix` into a
temporary directory, and installs it into your normal VS Code via
`code --install-extension --force`, then deletes the temporary `.vsix`. Unlike
F5's Extension Development Host, this puts the extension in your everyday
window with your real settings and real Codex/Claude CLIs, and it survives
window restarts — useful for dogfooding day to day. Reload the window
(`Developer: Reload Window`) after each install to pick up the new build.
Requires the `code` CLI on `PATH` (command palette →
`Shell Command: Install 'code' command in PATH` if it isn't). Also runnable
via *Tasks: Run Task* → `npm: install:local`.

## Tests

Tests live under `src/test/` and use Node's built-in `node:test` +
`node:assert` runner — **no test framework dependency**. They compile through
the same `tsconfig.json` as the rest of `src/` (there is no separate test
tsconfig) and land in `out/test/`.

```sh
npm test
```

**Only modules with no `vscode` import are unit-testable this way**:
[`format.ts`](../src/shared/format.ts), [`cache.ts`](../src/shared/cache.ts),
[`usageStore.ts`](../src/shared/usageStore.ts),
[`panelModel.ts`](../src/shared/panelModel.ts), and
[`panelHtml.ts`](../src/shared/panelHtml.ts), and
[`claudeCredentials.ts`](../src/agents/claudeCredentials.ts). Everything else
(`renderer.ts`, `settings.ts`, `statusController.ts`, `usageViewProvider.ts`,
and the remaining agent providers) imports `vscode`, which only resolves inside
a real or mocked extension host. If you need to test logic in one of those
files, factor the pure part into a `vscode`-free module before trying to run it
under `node --test`.

## The gate

```sh
npm run gate
```

Runs `scripts/gate.mjs`, which chains: lint → format check → typecheck → tests
→ packaging dry-run (`vsce ls`, which lists exactly what would be packaged
without writing a `.vsix`). It stops at the first failing step and prints which
step failed.
This is the same sequence run by the release workflow
(`.github/workflows/release.yml`) before it packages a release; run it
locally before considering a change complete.

## Other scripts

| Script | Does |
| --- | --- |
| `npm run compile` | One-shot `tsc -p ./`. |
| `npm run lint` | Run ESLint's recommended checks over TypeScript source and tests. |
| `npm run format:check` | Verify Prettier formatting for code and configuration files. |
| `npm run format` | Apply Prettier formatting to code and configuration files. |
| `npm run typecheck` | `tsc --noEmit -p ./` — fast check, no `out/` written. |
| `npm run clean` | Removes `out/` and any stray `*.vsix` from the repo root. |
| `npm run pack` | Compiles then runs `vsce package` — produces the real `.vsix` (see [build-and-release.md](build-and-release.md)). |
| `npm run install:local` | Compiles, packages to a temp `.vsix`, and installs it into local VS Code via `code --install-extension --force`. |
| `npm run bump:patch:compile` / `npm run bump:minor:compile` | Bumps `package.json`'s version (patch or minor) without a git tag/commit, then recompiles (see [build-and-release.md](build-and-release.md#versioning)). |
