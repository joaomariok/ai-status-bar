# Agent providers

Each provider in `src/agents/` obtains usage data through a completely
different mechanism. None of this is inferable from the filenames — read this
before touching a provider.

| Provider | Default presentation | Data source(s), in order tried |
| --- | --- | --- |
| [`claude.ts`](../src/agents/claude.ts) | `used` | Local credentials file → Anthropic OAuth usage endpoint |
| [`codex.ts`](../src/agents/codex.ts) | `remaining` | Local `codex app-server` process (JSON-RPC over stdio) |
| [`devin.ts`](../src/agents/devin.ts) | `used` | Configured file → local IDE cache (`state.vscdb`) → documented API |

## Claude

Reads `~/.claude/.credentials.json`, taking
`claudeAiOauth.accessToken` (falling back to a top-level `accessToken`), then
issues `GET https://api.anthropic.com/api/oauth/usage` with header
`anthropic-beta: oauth-2025-04-20`.

- This is an **undocumented/internal endpoint** — it may change without
  notice. If Claude usage starts failing, check this first before assuming a
  code bug.
- The token is read fresh on every fetch and kept in memory only; it is never
  written to the on-disk usage cache (see `PRIVACY.md`).
- `planFromPayload()` tries 14 different JSON paths (`plan`, `plan_type`,
  `subscription.tier`, `organization.plan`, ...) because the actual field
  location in the response is not documented and may vary by account type.
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

**Command resolution** (`resolveCodexCommand`), only when
`aiStatusBar.codex.command` is left at its default `codex`:

1. npm global install locations (`%APPDATA%\npm\...` on Windows,
   `~/.npm-global/bin`, `~/.local/bin`, Homebrew paths elsewhere).
2. Bundled binaries inside `openai.chatgpt-*` VS Code/Cursor/Devin extension
   directories, per-platform (`bin/windows-x86_64/codex.exe`,
   `bin/macos-aarch64/codex`, etc.).
3. Falls back to the bare `codex` and lets `PATH` resolve it.

**`.cmd`/`.bat` shims are explicitly rejected on Windows** — `codex.command`
must point directly at `codex.exe`, not a wrapper script, to avoid a future
shell-injection footgun via `spawn`.

## Devin

Three tiers, tried in order, first success wins:

1. **Configured JSON file** — `aiStatusBar.devin.usageFile` or
   `DEVIN_USAGE_FILE` env var, parsed by `usageFromPayload()` (accepts several
   shapes: `usedPercent`/`used_percent`/`utilization`/`percent`/`percentage`
   for windows, `text`/`balanceText`/`summary` or a used/limit pair for
   credits).
2. **Local IDE cache** (`readLocalDevinCache`) — the default path when Devin
   or Windsurf has been opened at least once. This is the surprising one: it
   reads the raw bytes of a SQLite file (`state.vscdb`, and its `.backup`) as
   UTF-8 text and does a **string search** for the keys
   `windsurf.reactSettings.cachedPlanInfoData:` or
   `windsurf.settings.cachedPlanInfo`, then extracts the JSON object that
   follows using a hand-written balanced-brace scanner
   (`readBalancedJsonObject`) — there is no SQLite parsing. It checks up to 50
   matches per key and uses the **last** (newest) valid one. Windsurf's own
   storage paths are probed alongside Devin's, because Devin's cache format
   originated in the same codebase.
   - This tier reports **remaining** percent (`dailyRemainingPercent`,
     `weeklyRemainingPercent`); `usedPercentFromRemaining()` inverts it.
   - Percent values `<= 1` are treated as fractions and multiplied by 100
     (`normalizePercent`) — the source data is inconsistent about scale.
3. **Documented API fallback** — only reached if no cache file exists and
   `DEVIN_API_KEY` (or `aiStatusBar.devin.apiKeyEnv`) is set. Requires
   `aiStatusBar.devin.orgId` (or discoverable via `/v3/self`) and
   `aiStatusBar.devin.userId`. Computes "daily" usage against the ACU
   consumption for the current UTC day, and "weekly" against the current
   billing cycle (from `/v3/enterprise/consumption/cycles`), both divided by
   `devin.cycleAcuLimit` or the organization's `max_cycle_acu_limit`.

The local-cache tier sets its own `windowLabels` per fetch
(`fiveHourTooltip: 'Daily quota'`, `weeklyTooltip: 'Weekly quota'`), which
override the provider's static `windowLabels` (`day`/`Today`,
`cy`/`Billing cycle`) — see
[architecture.md](architecture.md#agentprovider-contract) for the resolution
order.

## Settings-to-provider map

| Setting | Provider | Notes |
| --- | --- | --- |
| `claude.enabled` | Claude | — |
| `codex.enabled`, `codex.command` | Codex | `codex.command` is `scope: machine` |
| `devin.enabled`, `devin.apiKeyEnv`, `devin.apiBaseUrl`, `devin.orgId`, `devin.userId`, `devin.cycleAcuLimit`, `devin.usageFile` | Devin | all `scope: machine` |

`machine` scope is a deliberate security choice (see `PRIVACY.md`): a
workspace's `.vscode/settings.json` cannot silently redirect the Codex
executable or the Devin API target.
