# Privacy

AI Status Bar reads local agent usage data and stores normalized usage snapshots on your machine.

- No telemetry is collected.
- No data is sent to services other than the agent usage APIs documented in the README.
- Claude OAuth credentials are read from the local Claude Code credentials file and kept in memory only.
- Codex usage is read through `codex app-server`; Codex authentication files are not read directly.
- Usage snapshots are cached under VS Code extension storage and do not contain OAuth tokens.

Only use local usage-file overrides and API keys you trust.
