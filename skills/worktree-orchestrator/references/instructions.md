# Worktree Orchestration: Agent Guide

This document defines how Claude should use the `worktree` (`wt`) CLI tool to orchestrate multi-agent workflows.

## Core Capabilities

1. **Ticketless Initiation (`wt create`)**: Start a new task without a pre-existing ticket. Spawns a **Guide** to refine requirements.
2. **Issue-Driven Workspaces (`wt open`)**: Provision a workspace tied to a GitHub or Linear issue.
3. **Team Deployment (`--deploy-pool`)**: Launch pre-configured teams (Researchers, Coders, Reviewers).
4. **Dynamic Scaling (`wt split`)**: Add specific archetypes (Architect, Detective, etc.) to an active session.

---

## Orchestration Workflows

### 1. Starting a New Task (The "Agent" Entry Point)
When the user has a vague idea or a new feature request:
- **Action**: Run `wt create "[topic]"`
- **Result**: The **Guide** archetype launches in the main repo (no worktree yet). The Guide converses with the user to refine scope and acceptance criteria, creates a ticket in the configured provider (Linear or GitHub), then calls `wt open <ticket-id>` to provision the worktree and launch workers.
- **Handoff**: Workers start inside the newly created worktree with `WORKTREE_COORDINATION.md` already generated.

### 2. Scaling Up (The "Coordinator" Role)
If a task is complex and requires multiple perspectives:
- **Action**: Run `wt split [issue-number] -a [archetype]`
- **Archetypes**:
  - `architect`: For system design.
  - `detective`: For debugging/testing.
  - `craftsman`: For implementation.
  - `explorer`: For researching alternatives.
  - `aesthete`: For simplicity and polish.
  - `adversary`: For security and red-teaming.

### 3. Deploying Standard Teams
For well-defined phases of development:
- **Research Phase**: `wt open [id] --deploy-pool Researchers`
- **Coding Phase**: `wt open [id] --deploy-pool Coders`
- **Review Phase**: `wt open [id] --deploy-pool Reviewers`

---

## Coordination Protocol
All workers in a `worktree` session MUST coordinate via the `WORKTREE_COORDINATION.md` file in the root of the worktree.
- **Worker 1**: Acts as the Lead/Coordinator.
- **Worker N**: Executes assigned sub-tasks.
- **Adversary**: Provides the final "Lead Brief" before the task is considered done.

## Agent Guidelines
- **Always check status first**: Run `wt list` to see active worktrees before opening a new one.
- **Stay isolated**: Workers should only perform work within the worktree directory created by `wt open`.
- **Refine before implementing**: Use `wt create` and the **Guide** archetype to lock the "Definition of Done" before any implementation starts.
- **Use pools for standard phases**: Researchers → Coders → Reviewers is the standard development lifecycle.
- **Scale dynamically**: Start with `wt open`, then add workers with `wt split -a <archetype>` as complexity increases.
- **The Adversary closes the loop**: Always run an Adversary before considering implementation complete — either via `--deploy-pool Reviewers` or `wt split -a adversary`.
