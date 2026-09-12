# Privacy and Data Handling

This is a technical description of how AI Status Bar handles data in its current
implementation. It is not a formal legal privacy policy.

AI Status Bar reads the information needed to display Codex and Claude Code usage
in VS Code. It has no telemetry, analytics, or advertising integrations.

## Data flow at a glance

```text
Claude Code credentials file
  ├→ OAuth token kept in memory → Anthropic OAuth usage endpoint → usage response
  └→ Subscription and rate-limit metadata normalized locally
Usage response + normalized metadata
  → normalized usage snapshot in VS Code extension storage

Codex executable
  → local codex app-server process over stdio
  → normalized usage snapshot in VS Code extension storage
```

The extension makes a direct off-device request only for Claude usage. Codex usage
is requested from a local `codex app-server` process; Codex handles its own
authentication and any service communication.

## Local data the extension reads

### Claude Code credentials

For Claude Code, the extension reads `~/.claude/.credentials.json` and extracts
`claudeAiOauth.accessToken`, falling back to a top-level `accessToken`. It also
reads optional `claudeAiOauth.subscriptionType` and
`claudeAiOauth.rateLimitTier` fields to display the Claude plan and rate-limit tier.
The token is read during availability detection and again before a fresh usage request.
It is held only in local variables and request state, is not intentionally retained
after those operations, and is never cached or persisted by the extension.

The extension does not write, replace, refresh, or cache Claude credentials.

### Codex command and local process output

For Codex, the extension reads its VS Code configuration to determine the
machine-scoped `aiStatusBar.codex.command` setting. When that setting remains at its
default, it checks known global-install and VS Code/Cursor extension locations before
falling back to `codex` on `PATH`.

The resolved executable is started locally as `codex app-server`. The extension
communicates with it using line-delimited JSON-RPC over standard input and output,
requesting account rate limits. It does not read Codex authentication files directly.

Standard error from the Codex process is buffered in memory up to 2,000 characters.
If the request fails, up to its final 300 characters can be included in the failure
note rendered by the extension. Standard error is not written to the usage cache.

### Cached usage snapshots

Before a normal refresh, the extension reads the existing provider cache when it is
newer than the configured polling interval. This avoids an unnecessary Claude request
or Codex process start.

Cache files are stored in VS Code extension storage at:

```text
<globalStorageUri>/<provider>-usage-cache.json
```

Each cache entry contains a version, update timestamp, and normalized usage data:
plan name, primary and secondary usage percentages and reset times, available credits,
rate-limit state, and optional display labels. Cache entries do not contain OAuth
tokens or raw credential-file contents. A plan name derived from the Claude credential
metadata may be present as normalized usage data.

Fresh usage replaces the corresponding cache entry. The extension does not define a
separate retention period for these local cache files.

## Data that leaves the device

### Claude usage request

The extension sends an HTTPS `GET` request to:

```text
https://api.anthropic.com/api/oauth/usage
```

The request includes the Claude OAuth token as a Bearer authorization header and the
required Anthropic OAuth beta header. The response is parsed in memory to derive the
usage windows, reset times, and optional extra-usage credits shown by the extension.

This endpoint is internal and undocumented. Its behavior or response format may
change without notice.

### No extension telemetry

AI Status Bar does not send telemetry, analytics events, crash reports, or usage data
to its own service or to third-party analytics services. Aside from the Claude usage
request above, it does not make direct network requests.

## Local execution and security boundaries

### Codex process handling

Each Codex refresh starts a local child process with `codex app-server`. The process
is tracked, and the extension requests its termination after a successful response,
timeout, error, or extension disposal. On Windows, it requests termination of the
process tree; on other platforms, it requests termination of the child process.

Windows `.cmd` and `.bat` command shims are rejected. A custom
`aiStatusBar.codex.command` must point to the executable itself, which avoids routing
the configured command through a shell wrapper.

### Configuration boundary

`aiStatusBar.codex.command` has VS Code's `machine` scope. A workspace cannot use
repository-local settings to redirect the extension to a different executable.

### Rendering boundary

Dynamic tooltip values use Markdown escaping, and dynamic sidebar-panel values use
HTML escaping before rendering. This includes API values and local process output.

## What the extension does not do

- It does not persist Claude OAuth tokens or raw Claude credential-file contents.
- It does not read Codex authentication files.
- It does not write to agent credential files or refresh agent authentication.
- It does not upload cached usage snapshots to an AI Status Bar-operated service.
- It does not trust workspace settings for the Codex executable path.

## Scope and limitations

This document describes the extension code in this repository. It does not describe
how VS Code, Claude Code, Codex, Anthropic, OpenAI, or any executable launched by
Codex handles data outside the extension's control. Review those products' policies
for their own data practices.

The Claude usage integration depends on an internal/undocumented endpoint, so the
exact request and response behavior may change in a future version.
