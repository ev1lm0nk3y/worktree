---
name: worktree-orchestrator
description: Orchestrates multi-agent workflows using the 'worktree' (wt) CLI. Use this when the user wants to start a new feature, tackle an issue, or scale up their development team with specialized archetypes (Architect, Detective, Craftsman, etc.).
---

# Worktree Orchestrator

This skill enables Gemini CLI to use the `worktree` (`wt`) tool to manage isolated workspaces and coordinate specialized AI teams.

## Core Workflows

### 1. Starting a New Task
When a user wants to begin a new task without a ticket:
- Run `wt create "[short-topic]"`
- This spawns a **Guide** archetype to refine the requirements with the user.

### 2. Opening an Existing Issue
When working on a GitHub or Linear issue:
- Run `wt open [id]`
- Optional: Use `--deploy-pool [PoolName]` to launch a team (e.g., `Researchers`, `Coders`).

### 3. Scaling a Session
To add specialized workers to an active session:
- Run `wt split [id] -a [archetype]`

## References
For detailed information on commands, archetypes, and pools, see:
- [commands.md](references/commands.md) - Full CLI reference.
- [pools.md](references/pools.md) - Guide to worker pools and archetypes.
- [instructions.md](references/instructions.md) - Orchestration best practices.
