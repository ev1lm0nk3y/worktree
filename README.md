# Worktree CLI

A powerful CLI tool for managing Git worktrees with GitHub or Linear issues and Claude Code integration. Create isolated workspaces for each issue with automatic context loading, tmux session management, and support for multiple Claude workers collaborating on the same issue.

## Features

- 🌳 **Git Worktree Management** - Create isolated branches and directories per issue
- 🎟️ **Multi-provider Ticketing** - Pick GitHub Issues or Linear per-repo
- 🤖 **Claude Code Integration** - Auto-launch Claude with issue context
- 🖥️ **tmux Session Management** - Organized windows, panes, and layouts per issue
- 📝 **Contextual Documentation** - Auto-generated CLAUDE.md with project info
- ⚡ **Smart Commands** - Quick access to development commands
- 👁️ **Progress Monitoring** - Optional overseer worker that tracks progress
- 🎭 **Coding Agent Archetypes** - Assign specialized roles to multiple workers
- 🧩 **Worker Pools** - Deploy pre-configured archetype teams (Researchers, Coders, Reviewers) in one command

## Prerequisites

- Git
- tmux
- iTerm2 (macOS)
- Claude Code CLI (`claude`)
- One of:
  - GitHub CLI (`gh`) — `brew install gh`, for GitHub Issues
  - `LINEAR_API_KEY` env var — from https://linear.app/settings/api, for Linear

## Installation

Clone and link locally:

```bash
git clone https://github.com/ev1lm0nk3y/worktree
cd worktree
npm run setup
```

## Usage

### Initialize Configuration

In your Git repository:

```bash
worktree init
```

This creates `.worktree.yml` with auto-detected project settings. You'll be prompted to pick a ticketing provider (GitHub or Linear); re-running `worktree init` updates the provider on an existing config.

### Create/Open Worktree

```bash
# GitHub: open issue #123
worktree open 123

# Linear: open by identifier
worktree open LIN-123

# With description for better branch naming
worktree open 123 "add-authentication"
# Creates branch: issue-123-add-authentication

# With multiple Claude workers (2-5)
worktree open 123 -w 3
# Spawns 3 Claude instances with coordination

# Deploy a pre-configured worker pool (interactive picker)
worktree open 123 --deploy-pool

# Deploy a specific pool by name
worktree open 123 --deploy-pool Researchers

# With an overseer worker
worktree open 123 --watcher
# Adds an overseer that monitors progress every 60 seconds

# Combine multiple workers with overseer
worktree open 123 -w 3 --watcher
# 3 workers + 1 overseer monitoring them
```

> `--deploy-pool` and `-w/--workers` are mutually exclusive — a pool defines its own worker count and archetype assignments.

### Split Pane

When you need additional Claude instances for the same issue:

```bash
# Split horizontally (default) — prompts for archetype
worktree split 123

# Split vertically
worktree split 123 -v

# Assign an archetype directly (skips the wizard)
worktree split 123 -a detective

# Skip the wizard and take the default archetype for this worker slot
worktree split 123 --no-wizard
```

Valid archetype ids: `architect`, `detective`, `craftsman`, `explorer`, `aesthete`, `adversary`. The new pane is wired into `WORKTREE_COORDINATION.md` just like `open -w`.

### List Worktrees

```bash
worktree list
```

Shows all worktrees with:
- Issue number and branch name
- tmux window status
- Last modified time
- Number of panes

### Remove Worktree

```bash
worktree remove 123
# or
worktree rm 123
```

Closes tmux window and removes Git worktree.

## Configuration

Edit `.worktree.yml` in your repository:

```yaml
name: "My Project"
session: "myproject_workers"

# Ticketing provider: "github" (default) or "linear"
ticketing: github

# Default number of workers when -w is omitted (1-5)
workers: 1

# tmux layout applied when there are multiple panes
# One of: tiled | even-horizontal | even-vertical | main-vertical | main-horizontal
layout: tiled

# iTerm attach behavior (macOS)
iterm:
  open: window   # window | tab | current
  focus: true

claude_context: |
  This is a Next.js app with TypeScript.
  Key areas:
  - src/app - App router pages
  - src/lib - Utilities and actions

commands:
  dev: npm run dev
  test: npm test
  lint: npm run lint
  typecheck: npm run typecheck

setup_commands:
  - npm install
```

## How It Works

1. **Validates ticket** - Ensures the issue exists in GitHub or Linear before creating worktree
2. **Creates Git worktree** - Isolated directory with new branch
3. **Fetches issue details** - Title, body, labels via `gh` CLI or the Linear API
4. **Generates context files**:
   - **CLAUDE.md** - Issue details and project context for all workers
   - **WORKTREE_COORDINATION.md** - Task coordination for multi-worker setups
   - **OVERSEER.md** - Progress tracking and recommendations (when --watcher used)
5. **Launches Claude Code** - In tmux window/pane with working directory set
6. **Auto-sends prompts**:
   - Single worker: "Solve the issue described in CLAUDE.md"
   - Multiple workers: Role-specific prompts for coordination

## tmux Commands

- **List windows**: `Ctrl+B, w`
- **Switch window**: `Ctrl+B, [0-9]`
- **Detach session**: `Ctrl+B, d`
- **Reattach**: `tmux attach -t <session-name>`

## Example Workflows

### Single Worker
```bash
# Start working on issue #42
worktree open 42 "fix-login-bug"

# Claude opens and starts working...
# Need to check something else? Split the pane
worktree split 42

# See all your worktrees
worktree list

# Done with the issue?
worktree rm 42
```

### Multiple Workers
```bash
# Complex issue requiring collaboration
worktree open 78 "refactor-api" -w 3

# Skip archetype wizard and use defaults
worktree open 78 "refactor-api" -w 3 --no-wizard

# Creates 3 Claude instances:
# - Worker 1: Coordinator, creates task breakdown
# - Worker 2: Select archetype via wizard (or default: Detective)
# - Worker 3: Select archetype via wizard (or default: Craftsman)

# Workers coordinate through WORKTREE_COORDINATION.md
```

## Agent Archetypes

When using multiple workers, you can assign specialized roles:

- 🏗️ **The Architect** - System design & architecture patterns
- 🔍 **The Detective** - Debugging, edge cases & security
- 🛠️ **The Craftsman** - Code quality & best practices
- 🚀 **The Explorer** - Innovation & alternative approaches
- 🎨 **The Aesthete** - Elegant solutions & simplicity
- ⚔️ **The Adversary** - Adversarial review & red-teaming (drives the `init-adversarial-review` flow)

## Worker Pools

Worker pools are named, pre-configured teams of archetypes you can deploy with a single flag. Instead of picking `-w 3` and walking through the archetype wizard, `--deploy-pool` spins up the exact roster the pool defines. Worker 1 is always the Coordinator; the pool's `workers` list drives workers 2..N.

### Built-in Pools

| Pool | Workers | Purpose |
|---|---|---|
| **Researchers** | architect, detective, explorer | Evaluate solutions, choose best approach, structure deployment |
| **Coders** | craftsman, aesthete, detective | Implement from research output (add adversary later with `split`) |
| **Reviewers** | aesthete, detective, adversary | Final code quality and security review |

### Usage

```bash
# Pick interactively from all available pools
worktree open 123 --deploy-pool

# Deploy a specific pool
worktree open 123 --deploy-pool Coders

# Pool count drives worker count — do not combine with -w
worktree open 123 --deploy-pool Reviewers --watcher
```

### Custom Pools

Define your own pools in either location (user-level overrides project-level):

- Project: `<repo>/.claude/archetype-groups.yml`
- User: `~/.claude/archetype-groups.yml`

```yaml
pools:
  Hardening:
    description: Security-focused review and remediation
    coordinator:
      enable: true
    workers:
      - adversary
      - detective
      - craftsman
    watcher:
      enable: false   # set true to auto-spawn an overseer with this pool
```

Valid archetype ids: `architect`, `detective`, `craftsman`, `explorer`, `aesthete`, `adversary`. Custom pools appear alongside the built-ins in the interactive picker and in `--deploy-pool <name>`.

## Linear Integration

This CLI supports Linear as a first-class ticketing provider alongside GitHub. Select it per-repo at `worktree init`, or by setting `ticketing: linear` in `.worktree.yml`.

### Setup

1. Generate a personal API key at https://linear.app/settings/api.
2. Export it in your shell environment:

   ```bash
   export LINEAR_API_KEY=lin_api_xxxxxxxxxxxx
   ```

3. In the repo, run `worktree init` and choose **Linear** when prompted (or edit `.worktree.yml` directly).

### Opening a Linear Issue

Use the full Linear identifier (team prefix + number):

```bash
worktree open LIN-123
worktree open LIN-123 "add-auth-middleware"
worktree open ENG-842 -w 3
worktree open ENG-842 --deploy-pool Researchers
```

The issue is validated against the Linear API before the worktree is created — a missing or unauthorized identifier is a hard error. Title, description, and labels are fetched and written into `CLAUDE.md` for every worker.

### Re-running `init`

Re-running `worktree init` on an existing config updates the ticketing provider without touching your other settings, so you can switch between GitHub and Linear per-repo at any time.

### Interactive Wizard Example

```bash
$ worktree open 123 -w 3

Creating worktree for issue #123...
✓ Worker 1 (Coordinator) assigned

Select archetype for Worker 2:
1) 🏗️  The Architect - System design & architecture
2) 🔍  The Detective - Debugging & edge cases
3) 🛠️  The Craftsman - Code quality & best practices
4) 🚀  The Explorer - Innovation & alternatives
5) 🎨  The Aesthete - Elegant solutions & simplicity
6) ⚔️  The Adversary - Adversarial review & red-teaming
Choice (1-6): 2

✓ Worker 2 assigned as The Detective

Select archetype for Worker 3:
...
```

## Tips

- Run `worktree init` in each repository to customize settings
- Use descriptive names with `worktree open` for better branch names
- For complex issues, use `-w` flag to spawn coordinated workers
- Choose complementary archetypes for better problem-solving coverage
- Use `--no-wizard` to skip archetype selection and use defaults
- Multiple Claude instances can work on different aspects of the same issue
- Both CLAUDE.md and WORKTREE_COORDINATION.md are automatically added to .gitignore
- Workers communicate through the coordination document to avoid conflicts
- Add `--watcher` for an overseer that monitors progress

## License

MIT
