# Documentation map

Start here, then load only the document you need.

| Document | Read it when you need to know... |
| --- | --- |
| [architecture.md](architecture.md) | How activation, polling, caching, backoff, and rendering fit together; the `AgentProvider` contract shared by all agents. |
| [agent-providers.md](agent-providers.md) | How Codex, Claude Code, and Devin usage is actually obtained (protocols, file locations, quirks). |
| [development.md](development.md) | Local setup, the watch loop, F5 debugging, the gate, and how tests are structured. |
| [build-and-release.md](build-and-release.md) | Versioning, packaging with `vsce`, what ships in the `.vsix`. |
| [next-steps.md](next-steps.md) | Deliberately out-of-scope tooling and known debt. |

## Quick pointers

- Adding or changing a setting? See the settings-wiring note in [architecture.md](architecture.md#agentprovider-contract) and the checklist in [../AGENTS.md](../AGENTS.md).
- Debugging why an agent's status bar item is missing or wrong? Start with [agent-providers.md](agent-providers.md), then [architecture.md](architecture.md) for the controller lifecycle.
- Setting up your machine or running tests? [development.md](development.md).
- Cutting a release or building a `.vsix`? [build-and-release.md](build-and-release.md).
- User-facing behavior, settings reference, and privacy claims live in [../README.md](../README.md) and [../PRIVACY.md](../PRIVACY.md) — this `docs/` tree is for contributors and agents, not end users.
