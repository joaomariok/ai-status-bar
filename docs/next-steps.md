# Next steps

## Known debt (not fixed, out of scope for the bootstrap)

- `typescript` is held at `^5.4.0` while 7.x is current. TypeScript 7 is the
  native-port rewrite with its own compatibility surface; upgrading is a
  deliberate change that needs its own gate run and `vsce package`
  verification, not a ride-along on a dependency bump. `tsconfig.json` is
  plain (`commonjs`, `ES2020`, `strict`) with nothing exotic, so the upgrade
  is expected to be cheap when taken up.
- As of the 2026-09 audit, every `npm audit` finding was transitive under
  the single dev dependency `@vscode/vsce` and resolved cleanly via
  `npm audit fix` (lockfile-only, no direct dependency touched). A future
  finding that doesn't fit that shape — a direct dependency, or one that
  needs `--force` — deserves a closer look before fixing.
