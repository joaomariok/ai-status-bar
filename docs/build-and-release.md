# Build and release

## Packaging

```sh
npm run pack
```

Runs `npm run compile && vsce package`, producing
`ai-status-bar-<version>.vsix` in the repo root. Install it locally with:

```sh
code --install-extension ai-status-bar-<version>.vsix --force
```

## What ships

Controlled by [`.vscodeignore`](../.vscodeignore) (allowlist-style: it excludes
`src/**` and other dev-only paths, then re-includes specific files). Generated
`out/*.js` files are what actually ships; `src/**`, `out/test/**`,
`package-lock.json`, and `tsconfig.json` are excluded. If you add a new
top-level source directory, check `.vscodeignore` still excludes it correctly
— `vsce ls` (used by `npm run gate`) shows exactly what would be packaged.

## Versioning

```sh
npm run bump:compile
```

Runs `npm version patch --no-git-tag-version && npm run compile` — bumps the
patch version in `package.json` without creating a git tag/commit, then
recompiles. Update [`CHANGELOG.md`](../CHANGELOG.md) as part of any release
that changes user-visible behavior.

## Publishing

There is no automated publish pipeline (no CI, no `vsce publish` script).
Publishing to the Marketplace, if/when done, is a manual `vsce publish` step
outside the scope of this repository's tooling.
