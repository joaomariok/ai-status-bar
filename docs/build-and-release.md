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
npm run bump:patch:compile   # bug fixes
npm run bump:minor:compile   # new settings/features, non-breaking
```

Each runs `npm version <patch|minor> --no-git-tag-version && npm run compile`
— bumps `package.json`'s version without creating a git tag/commit, then
recompiles. Update [`CHANGELOG.md`](../CHANGELOG.md) as part of any release
that changes user-visible behavior — the release workflow (see "Releasing"
below) reads that version's section as the GitHub Release notes, and fails if
one is missing.

## Releasing

Pushing a tag matching `v*` (for example `v1.1.0`) runs
[`.github/workflows/release.yml`](../.github/workflows/release.yml), which:

1. Checks the tag's version (minus the `v`) matches `package.json`'s
   `version`, failing the build otherwise.
2. Runs `npm run gate` (typecheck → tests → packaging dry-run).
3. Runs `npm run pack` to build the `.vsix`.
4. Extracts that version's section from `CHANGELOG.md` via
   `scripts/releasenotes.mjs` and publishes a GitHub Release with the
   `.vsix` attached and that section as the release notes.

The same workflow can also be run manually via `workflow_dispatch` (Actions
tab, or `gh workflow run release.yml`) without a tag — that dry-runs steps
1–3, uploads the `.vsix` as a workflow artifact, and creates no release. Tag
locally with `git tag -a v<version> -m "AI Status Bar <version>"`, then push
the tag once you're ready to publish; nothing is released until the tag is
pushed.

## Publishing to the Marketplace

There is no Marketplace publish pipeline (no `vsce publish` step, no
`VSCE_PAT` secret). The GitHub Release above is the supported distribution
channel; publishing to the VS Code Marketplace, if/when done, is a manual
`vsce publish` step outside the scope of this repository's tooling.
