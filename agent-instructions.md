# Worktree Orchestration: AI Agent Guide

This document defines how an AI agent (Gemini, Claude, or others) should use the `worktree` (`wt`) CLI tool to orchestrate multi-agent workflows.

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
- **Result**: A new worktree and tmux session are created. A **Guide** archetype is launched to interact with the user and generate `WORKTREE_COORDINATION.md`.
- **Handoff**: Once the Guide has produced the coordination document, subsequent workers can be added.

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
- **Always check status**: Run `wt list` to see active worktrees.
- **Stay isolated**: Only perform work within the `worktree/` directory created by the tool.
- **Refine first**: Use `wt create` and the **Guide** archetype to ensure "Definition of Done" is locked before implementation.
