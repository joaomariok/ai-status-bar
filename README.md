# AI Status Bar

AI Status Bar tracks AI coding-agent usage directly in the VS Code status bar.

It currently supports:

- **Codex** usage from `codex app-server`
- **Claude Code** usage from Claude's local OAuth credentials and usage endpoint

When multiple agents are available, they appear side by side in the status bar, each with its own hover popup for active usage windows, reset times, known plan details, credits, and last update time.

> Platform note: this extension has only been tested on **Windows**. macOS and Linux support is best-effort: Claude should work if credentials are in the standard location, and Codex should work if `codex app-server` is available on `PATH` or in a known extension install location.

## Status Bar

By default:

- Codex shows remaining usage.
- Claude shows used usage.

You can keep those native defaults or force all agents to show either used or remaining percentages with `aiStatusBar.presentationMode`.

Example status-bar shape:

```text
Codex: 🟢 5h ▰▰▱ 69% · 🟢 wk ▰▰▱ 51%   Claude: 🟢 5h ▰▰▰ 100%
```

## Screenshots

![AI Status Bar entries with usage hover details](assets/screenshots/status-bar-overview.png)

Codex and Claude Code each get their own compact status-bar item. Hover any entry to see usage windows, reset times, credits, plan details, and the last update time.

![Codex usage hover details](assets/screenshots/tooltip-codex.png)

![Claude Code usage hover details](assets/screenshots/tooltip-claude-code.png)

## Why I Created This

I use multiple AI coding agents during the same development workflow. Codex and Claude Code each have their own limits, reset windows, plan details, and credit state, but that information is easy to lose track of while coding.

This extension was created to make that usage visible without opening separate tools, running commands, or switching context. The goal is simple: keep the current state of the AI agents I rely on in the same place I already look all day, the editor status bar.

It also replaces separate status-bar experiments with one shared implementation. The agent-specific parts stay separate, but common behavior such as polling, caching, rendering, settings, warnings, and popup layout is centralized for easier maintenance.

## Features

- Detects Claude Code and Codex automatically.
- Shows one status-bar item per detected agent.
- Displays a compact `5h` primary gauge plus an optional weekly gauge.
- Keeps agent hover popups visually consistent across providers.
- Uses shared settings for polling, gauge width, threshold colors, locale, and presentation mode.
- Caches usage snapshots to avoid unnecessary API/process calls across windows.
- Warns when usage crosses the configured threshold.

## How To Use It

1. Install AI Status Bar from your editor's extension marketplace once published, or install a local `.vsix` build:

   ```sh
   code --install-extension ai-status-bar-1.0.0.vsix --force
   ```

2. Make sure the agents you want to monitor are signed in and usable:

   - Claude Code should have a valid `~/.claude/.credentials.json`.
   - Codex should be able to run `codex app-server`.

3. Reload VS Code.

4. Look at the right side of the status bar.

   If multiple agents are detected, you should see multiple status-bar entries. Hover each entry to see its detailed popup.

5. Optional: tune settings under `AI Status Bar`.

   Useful first settings:

   ```json
   {
     "aiStatusBar.presentationMode": "agentDefault",
     "aiStatusBar.pollSeconds": 120,
     "aiStatusBar.locale": "de-DE"
   }
   ```

Use the command palette commands when needed:

- `AI Status Bar: Refresh`

## How It Works

The extension only collects enough local usage data to show status-bar percentages and hover details.

Each agent provider is read-only from the agent's point of view:

- Codex usage is requested through Codex's local app-server. The extension does not read Codex auth files directly.
- Claude usage uses the existing local Claude Code sign-in token. The token is kept in memory only and is not written to the extension cache.

The extension stores normalized usage snapshots in its own VS Code extension storage so multiple editor windows do not have to repeatedly query the same data. Those snapshots contain usage details, not agent credentials.

### Codex

Codex handles its own authentication. AI Status Bar asks the local Codex app-server for usage limits and does not inspect Codex credential files.

### Claude Code

Claude Code authentication stays with Claude Code. AI Status Bar uses the existing local sign-in token to request usage, keeps that token in memory only, and caches only the resulting usage snapshot.

## Settings

All settings are under `aiStatusBar`.

| Setting | Default | Description |
| --- | --- | --- |
| `pollSeconds` | `120` | How often to refresh usage data. |
| `barCells` | `3` | Number of segments in the compact status-bar gauge. |
| `showWeekly` | `true` | Show the secondary weekly or billing-cycle usage window. The primary 5-hour or daily window is otherwise always shown. |
| `replacePrimaryWithWeeklyOnLimit` | `true` | When the secondary weekly or billing-cycle limit is reached, show that exhausted budget in the primary status-bar slot instead of the 5-hour or daily budget. |
| `presentationMode` | `agentDefault` | `agentDefault`, `used`, or `remaining`. |
| `cautionAt` | `70` | Used percentage where the status indicator turns yellow. |
| `warnAt` | `90` | Used percentage where the status indicator turns red and warning notifications can appear. |
| `locale` | `""` | BCP-47 locale for reset times, for example `de-DE`. Empty uses the system locale. |
| `claude.enabled` | `true` | Enable or disable Claude Code detection and display. |
| `codex.enabled` | `true` | Enable or disable Codex detection and display. |
| `codex.command` | `codex` | Codex executable path or command. This is machine-scoped for safety. |

Example:

```json
{
  "aiStatusBar.presentationMode": "remaining",
  "aiStatusBar.locale": "de-DE",
  "aiStatusBar.warnAt": 90,
  "aiStatusBar.claude.enabled": true,
  "aiStatusBar.codex.enabled": true,
  "aiStatusBar.codex.command": "C:\\Users\\you\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\node_modules\\@openai\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\codex\\codex.exe"
}
```

## macOS and Linux

This extension is **not yet tested** on macOS or Linux.

Best-effort support is included:

- Claude uses `~/.claude/.credentials.json`, which should be platform-neutral.
- Codex first checks known bundled binary locations for the current platform.
- If no bundled binary is found, Codex falls back to `codex` on `PATH`.

For non-Windows environments, first verify this works in a terminal:

```sh
codex app-server
```

If Codex is installed somewhere custom, set `aiStatusBar.codex.command` to the full executable path in user or machine settings.

## Privacy and Security

This extension is intentionally read-only from the agents' point of view.

What it reads:

- Claude's local credentials file, only to get the existing OAuth token.
- Codex usage data through `codex app-server`.
- Its own cache files under VS Code extension storage.

What it writes:

- Usage snapshot cache files under VS Code extension storage.

What it does not do:

- It does not write, replace, or refresh Claude credentials.
- It does not read Codex auth files directly.
- It does not transmit tokens to any third-party service.
- It does not trust workspace settings for the Codex executable path.

Security choices:

- Claude OAuth tokens are kept in memory only.
- Usage cache files contain usage snapshots, not credentials.
- `aiStatusBar.codex.command` is machine-scoped so a workspace cannot override it with a repository-local executable.
- `.cmd` and `.bat` Codex shims are rejected on Windows to avoid future shell-injection footguns.
- Tooltip content from APIs and process output is escaped before rendering.
- Codex child processes are cleaned up on timeout, failure, and extension disposal.

## Build

```sh
npm install
npm run compile
npx @vscode/vsce package
```

The generated `.vsix` can be installed with:

```sh
code --install-extension ai-status-bar-1.0.0.vsix --force
```

See `PRIVACY.md` for local data notes and `CHANGELOG.md` for release history.

## Limitations

- The extension is unofficial.
- Claude usage uses an internal/undocumented endpoint and may break if Claude changes it.
- Codex support depends on the local `codex app-server` protocol.
- Windows is the only tested platform at this time.
