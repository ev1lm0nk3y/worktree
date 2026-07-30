---
name: worktree-orchestrator
description: >
  Orchestrates multi-agent workflows using the 'wt' (worktree) CLI. Use this skill when the user wants to "start working on an issue", "open a worktree", "deploy a team", "spawn workers", "add an archetype", "scale up agents", or mentions wt/worktree commands. Also triggers for "use the Coders pool", "launch a Researcher team", "add a Detective", "split a pane", or any request to coordinate multiple Claude agents on a task.
metadata:
  version: "0.1.0"
---

# Worktree Orchestrator

This skill lets Claude use the `wt` CLI to manage isolated Git workspaces and coordinate specialized AI agent teams. The `wt` and `worktree` commands are aliases.

## Prerequisites

The `wt` CLI must be installed and in PATH. The repo must have a `.worktree.yml` (run `wt init` if missing). For Linear tickets, `LINEAR_API_KEY` must be set in the environment.

## Core Workflows

### Start a New Task (No Existing Ticket)

When the user has a vague idea or feature request without a ticket:

```bash
wt create "[short-topic]"
```

This spawns a **Guide** archetype in the current repo (no worktree yet). The Guide scopes requirements with the user, creates a ticket in the configured provider (Linear or GitHub), then calls `wt open <ticket-id>` to provision the worktree and launch workers.

### Open an Existing Issue

When working on a specific GitHub or Linear issue:

```bash
# Single worker (default)
wt open 123
wt open LIN-123

# With branch descriptor
wt open LIN-123 "add-auth-middleware"

# With multiple workers (2–5)
wt open LIN-123 -w 3

# Deploy a pre-configured pool
wt open LIN-123 --deploy-pool Coders

# Add an overseer monitor
wt open LIN-123 --deploy-pool Researchers --watcher
```

### Add Workers to an Active Session

```bash
wt split LIN-123 -a detective
wt split LIN-123 -a adversary -v   # vertical split
wt split LIN-123 --no-wizard        # use default archetype
```

### Inspect & Clean Up

```bash
wt list              # show all active worktrees
wt remove LIN-123    # close tmux window + delete worktree
wt rm LIN-123        # alias for remove
```

## Worker Pools

Pools deploy pre-configured archetype teams with one flag. `-w` and `--deploy-pool` are mutually exclusive.

| Pool | Workers | When to Use |
|------|---------|-------------|
| **Researchers** | Architect + Explorer | Exploring solution space, evaluating trade-offs |
| **Coders** | Craftsman + Aesthete | Implementing well-defined tasks |
| **Reviewers** | Detective + Adversary + Sentinel | Final QA and security review |

Custom pools can be defined in `.claude/archetype-groups.yml`.

## Agent Archetypes

Nine archetypes — use case-insensitive, partial names with `-a`:

| Archetype | Role |
|-----------|------|
| `architect` | System design & high-level structure |
| `detective` | Debugging, edge cases, analysis |
| `craftsman` | Implementation & code quality |
| `explorer` | Research & alternative approaches |
| `aesthete` | Elegant solutions & DX |
| `adversary` | Adversarial red-team review |
| `sentinel` | Security review & threat modeling |
| `scribe` | Documentation & knowledge capture |
| `guide` | Requirements gathering & scoping |

## Coordination Protocol

- All workers coordinate via `WORKTREE_COORDINATION.md` in the worktree root
- Worker 1 is always the Coordinator
- Workers write their status and findings to the coordination doc
- The Adversary provides the final brief before a task is considered done

## Typical Multi-Phase Workflow

```bash
# 1. Research
wt open LIN-526 --deploy-pool Researchers --watcher

# 2. Implement from research output
wt open LIN-526 --deploy-pool Coders

# 3. Add adversary review when implementation is ready
wt split LIN-526 -a adversary

# 4. Final review
wt open LIN-526 --deploy-pool Reviewers

# 5. Clean up
wt remove LIN-526
```

## References

- [commands.md](references/commands.md) — Full CLI reference for all `wt` subcommands
- [pools.md](references/pools.md) — Worker pools and custom pool configuration
- [instructions.md](references/instructions.md) — Orchestration best practices and agent guidelines
