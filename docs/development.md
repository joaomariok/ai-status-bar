# Development

## Setup

```sh
npm install
```

No project Python/other-language environment is used; this is a pure
TypeScript/Node project. Requires Node compatible with `@types/node@^20`
(Node 20+) and `vscode-engines ^1.85.0`.

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
[`panelHtml.ts`](../src/shared/panelHtml.ts). Everything else (`renderer.ts`,
`settings.ts`, `statusController.ts`, `usageViewProvider.ts`, all of
`src/agents/`) imports `vscode`, which only resolves inside a real or mocked
extension host. If you need to test logic in one of those files, factor the
pure part out into `shared/` first rather than trying to run it under
`node --test`.

## The gate

```sh
npm run gate
```

Runs `scripts/gate.mjs`, which chains: typecheck → tests → packaging dry-run
(`vsce ls` / `vsce package` against a scratch directory — never writes a
`.vsix` into the repo). It stops at the first failing step and prints which
step failed. This is the closest local equivalent to CI (there is no CI
workflow in this repository); run it before considering a change complete.

## Other scripts

| Script | Does |
| --- | --- |
| `npm run compile` | One-shot `tsc -p ./`. |
| `npm run typecheck` | `tsc --noEmit -p ./` — fast check, no `out/` written. |
| `npm run clean` | Removes `out/` and any stray `*.vsix` from the repo root. |
| `npm run pack` | Compiles then runs `vsce package` — produces the real `.vsix` (see [build-and-release.md](build-and-release.md)). |
