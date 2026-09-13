# Agent providers

Each provider in `src/agents/` obtains usage data through a completely
different mechanism. None of this is inferable from the filenames — read this
before touching a provider.

| Provider | Default presentation | Data source(s), in order tried |
| --- | --- | --- |
| [`claude.ts`](../src/agents/claude.ts) | `used` | Local credentials file → Anthropic OAuth usage endpoint |
| [`codex.ts`](../src/agents/codex.ts) | `remaining` | Local `codex app-server` process (JSON-RPC over stdio) |

## Claude

Reads `~/.claude/.credentials.json`, taking
`claudeAiOauth.accessToken` (falling back to a top-level `accessToken`) plus
the optional `claudeAiOauth.subscriptionType` and
`claudeAiOauth.rateLimitTier` metadata, then issues
`GET https://api.anthropic.com/api/oauth/usage` with header
`anthropic-beta: oauth-2025-04-20`.

- This is an **undocumented/internal endpoint** — it may change without
  notice. If Claude usage starts failing, check this first before assuming a
  code bug.
- The token is read fresh on every fetch and kept in memory only; it is never
  written to the on-disk usage cache (see `PRIVACY.md`).
- The displayed plan derives only from credential metadata:
  `subscriptionType (rateLimitTier)` when both are present, or the available
  value alone. The usage payload does not provide plan information.
- On non-200 responses, a `Retry-After` header (if present) is converted to
  `retryAfterMs` and honored by the controller's backoff (see
  [architecture.md](architecture.md#failure-handling-and-backoff)).

## Codex

Spawns `codex app-server` and speaks line-delimited JSON-RPC over its stdio:

1. Send `{method: 'initialize', id: 0, ...}`.
2. On its response, send `{method: 'initialized'}` followed by
   `{method: 'account/rateLimits/read', id: 1}`.
3. Read the response to `id: 1`; prefer `rateLimitsByLimitId.codex` over the
   generic `rateLimits` field if present.

Total budget is 45 seconds (15s to start responding + 30s for the request).
The child process is always killed on completion, timeout, or error
(`taskkill /T /F` on Windows, `proc.kill()` elsewhere) and tracked in a
`Set<ChildProcess>` disposed with the provider.

**Command resolution** (`resolveCodexCommand`) locates a safe executable before
Codex is marked available. With the default `codex` command, it checks:

1. npm global install locations (`%APPDATA%\npm\...` on Windows,
   `~/.npm-global/bin`, `~/.local/bin`, Homebrew paths elsewhere).
2. Bundled binaries inside `openai.chatgpt-*` VS Code/Cursor extension
   directories, per-platform (`bin/windows-x86_64/codex.exe`,
   `bin/macos-aarch64/codex`, etc.).
3. `PATH` entries for the Codex executable.

A custom `aiStatusBar.codex.command` is resolved as either a direct executable
path or a command found on `PATH`. If no safe executable resolves, Codex is
unavailable and no `app-server` process starts.

**`.cmd`/`.bat` shims are explicitly rejected on Windows** — `codex.command`
must point directly at `codex.exe`, not a wrapper script, to avoid a future
shell-injection footgun via `spawn`.

## Settings-to-provider map

| Setting | Provider | Notes |
| --- | --- | --- |
| `claude.enabled` | Claude | — |
| `codex.enabled`, `codex.command` | Codex | `codex.command` is `scope: machine` |

`machine` scope is a deliberate security choice (see `PRIVACY.md`): a
workspace's `.vscode/settings.json` cannot silently redirect the Codex
executable.
