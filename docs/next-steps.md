# Next steps

Deliberately left out of the doc bootstrap:

- **Linter/formatter**: no existing convention; adding one would touch every file for formatting. Consider ESLint if the fork grows.
- **CI**: none exists. `npm run gate` is already the exact command to wire into a GitHub Actions workflow.

## Known debt (not fixed, out of scope for the bootstrap)

- `CodexProvider.detect()`'s first branch (`resolved !== 'codex' || configured !== 'codex'`) is always true when reached — the "let fetchUsage make the final call" comment is dead code.
