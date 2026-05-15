# Complete Worktree Command Reference

Full list of all `worktree` (or `wt`) CLI commands and actions.

## Command Summary

| Command | Purpose | Alias |
|---------|---------|-------|
| `wt open` | Create worktree & launch Claude | - |
| `wt split` | Add worker to existing worktree | - |
| `wt list` | Show all worktrees | - |
| `wt remove` | Delete worktree & window | `wt rm` |
| `wt init` | Setup .worktree.yml config | - |
| `wt tldr` | Quick reference | - |
| `wt completions` | Output shell completion script | - |

---

## 1. `wt open <issue-number> [description]`

**Create a new worktree, fetch Linear ticket, and launch Claude worker(s)**

### Basic Usage

```bash
# Single worker (default)
wt open SRE-526

# With custom descriptor for branch naming
wt open SRE-526 implement-feature

# Short syntax (number only)
wt open 526  # becomes SRE-526
```

### Options

#### `-w, --workers <number>`
Number of Claude workers to spawn (default: 1, max: 5)
```bash
wt open SRE-526 -w 1          # Single worker
wt open SRE-526 -w 2          # Two workers (coordinator + 1)
wt open SRE-526 -w 3 --wizard # Three workers, interactive archetype selection
```

#### `--deploy-pool <name>`
Deploy a pre-configured worker pool (mutually exclusive with `-w`)
```bash
wt open SRE-526 --deploy-pool                # Interactive pool selection
wt open SRE-526 --deploy-pool Researchers    # Deploy Researchers pool
wt open SRE-526 --deploy-pool Coders         # Deploy Coders pool
wt open SRE-526 --deploy-pool Reviewers      # Deploy Reviewers pool
```

#### `--watcher`
Spawn additional overseer worker to monitor progress
```bash
wt open SRE-526 --watcher                    # Single + watcher
wt open SRE-526 -w 2 --watcher               # Two workers + watcher
wt open SRE-526 --deploy-pool Researchers --watcher  # Pool + watcher
```

#### `--no-wizard`
Skip archetype selection wizard and use defaults
```bash
wt open SRE-526 -w 3 --no-wizard             # 3 workers, auto-assigned archetypes
wt open SRE-526 --deploy-pool Coders --no-wizard  # Pools already skip wizard
```

### What It Does

1. Validates ticket number (Linear format)
2. Fetches ticket from Linear API
3. Creates git branch from ticket number + descriptor
4. Creates git worktree at `.git/worktrees/<branch-name>`
5. Generates `CLAUDE.md` with ticket context
6. Generates `WORKTREE_COORDINATION.md` (if multi-worker)
7. Updates `.gitignore` to exclude context files
8. Switches to worktree directory
9. Launches Claude worker(s):
   - Worker 1: Coordinator (default prompt)
   - Workers 2+: Assigned archetypes (interactive or default)
   - Watcher: Independent oversight (if `--watcher`)

### Generated Files

```
<worktree>/
├── CLAUDE.md                    # Ticket context, description, comments
├── WORKTREE_COORDINATION.md     # Worker assignments (multi-worker only)
├── OVERSEER.md                  # Overseer notes (if --watcher)
└── .gitignore                   # Updated to ignore above files
```

### Exit Conditions

- ❌ Ticket not found in Linear
- ❌ Worktree already exists for that issue
- ❌ Invalid worker count (must be 1-5)
- ❌ Both `--deploy-pool` and `-w` specified

---

## 2. `wt split <issue-number>`

**Add a new Claude worker to existing worktree pane**

### Basic Usage

```bash
# Add worker (default archetype selected via wizard)
wt split SRE-526

# Add worker with specific archetype
wt split SRE-526 --archetype detective
wt split SRE-526 -a craftsman

# Add worker with vertical split
wt split SRE-526 -v
wt split SRE-526 --vertical
```

### Options

#### `-a, --archetype <id>`
Assign specific archetype role. Matching is case-insensitive and supports partial names; unrecognised input falls back to the interactive wizard.
```bash
wt split SRE-526 -a architect
wt split SRE-526 -a detective
wt split SRE-526 -a craftsman
wt split SRE-526 -a explorer
wt split SRE-526 -a aesthete
wt split SRE-526 -a adversary
wt split SRE-526 -a sentinel
wt split SRE-526 -a scribe
wt split SRE-526 -a Sentinel   # case-insensitive
wt split SRE-526 -a sent       # partial match
```

#### `-v, --vertical`
Split pane vertically instead of horizontally
```bash
wt split SRE-526 -v            # Vertical
wt split SRE-526               # Horizontal (default)
```

#### `-f, --focus`
Focus the new pane after creation
```bash
wt split SRE-526 -f            # New pane gets focus
```

#### `--no-wizard`
Skip archetype selection wizard (requires `-a` or uses default)
```bash
wt split SRE-526 -a adversary --no-wizard
wt split SRE-526 --no-wizard   # Uses default archetype
```

### What It Does

1. Finds existing worktree for issue number
2. Checks tmux window exists
3. Splits current pane (horizontal or vertical)
4. Assigns archetype (explicit flag, wizard, or default)
5. Launches Claude in new pane with archetype
6. Updates `WORKTREE_COORDINATION.md` if multi-worker

### Common Workflows

```bash
# Implement feature
wt open SRE-526 --deploy-pool Coders

# When ready for adversary review
wt split SRE-526 -a adversary

# Add more reviewers
wt split SRE-526 -a aesthete -v

# Horizontal split for quality specialist
wt split SRE-526 -a explorer
```

### Exit Conditions

- ❌ Worktree not found for issue
- ❌ Tmux window not found
- ⚠️ Unrecognised archetype → falls back to interactive wizard

---

## 3. `wt list`

**Show all active worktrees and their status**

### Basic Usage

```bash
# List all worktrees
wt list
```

### Output Example

```
Worktrees:

Issue #123 - issue-123-fix-bug
  Path: /Users/ryan/git/repo/.git/worktrees/SRE-123-fix-bug
  Tmux: Window 1
  Modified: Recently

Issue #526 - issue-526-implement-feature
  Path: /Users/ryan/git/repo/.git/worktrees/SRE-526-implement-feature
  Tmux: Window 2 (active) [3 panes]
  Modified: 2h ago

Tmux session: repo_workers
Active windows: 2
```

### What It Shows

- Issue number
- Worktree path
- Tmux window status (active/inactive, number of panes)
- Last modified time
- CLAUDE.md existence

### Exit Conditions

- ✅ Always succeeds (shows empty if no worktrees)

---

## 4. `wt remove <issue-number>`

**Delete worktree and close tmux window**

### Basic Usage

```bash
# Remove worktree
wt remove SRE-526

# Alias syntax
wt rm SRE-526
```

### What It Does

1. Finds worktree for issue number
2. Removes git worktree (cleans up `.git/worktrees/<branch>`)
3. Deletes tmux window
4. Cleans up context files

### Exit Conditions

- ❌ Worktree not found for issue
- ⚠️ May fail if worktree is locked or has uncommitted changes

---

## 5. `wt init`

**Initialize .worktree.yml configuration for repository**

### Basic Usage

```bash
# Create default config
wt init
```

### Generated File

Creates `.worktree.yml` with template:

```yaml
# Project metadata
name: my-repo
session: my-repo_workers

# Ticketing system
ticketing: linear

# iTerm settings (macOS)
iterm:
  open: window      # window | tab | current
  focus: true

# Tmux layout
layout: main-vertical

# Default worker count
workers: 1

# Build commands (auto-detected from package.json if not set)
commands:
  dev: npm run dev
  test: npm test
  lint: npm run lint
  build: npm run build

# Setup commands run in new worktree
setup_commands:
  - npm install
```

### What It Does

1. Auto-detects build/test/lint commands from `package.json`, `Cargo.toml`, etc.
2. Creates `.worktree.yml` with sensible defaults
3. Sets ticketing provider to Linear

### Exit Conditions

- ⚠️ Warns if `.worktree.yml` already exists
- ✅ Creates or updates config

---

## 6. `wt tldr`

**Show quick reference and common examples**

### Basic Usage

```bash
# Show quick reference
wt tldr
```

### Output

Shows common command examples and quick reference patterns.

---

## Complete Feature Matrix

| Feature | Command | Status |
|---------|---------|--------|
| Create worktree | `wt open` | ✅ |
| Fetch Linear tickets | `wt open` | ✅ |
| Single worker launch | `wt open -w 1` | ✅ |
| Multi-worker launch | `wt open -w N` | ✅ |
| Worker archetypes | `wt open -w N`, `wt split -a` | ✅ |
| Worker pools | `wt open --deploy-pool` | ✅ |
| Watcher/overseer | `wt open --watcher` | ✅ |
| Tmux integration | `wt split`, windows/panes | ✅ |
| iTerm2 integration | `wt open` (macOS) | ✅ |
| Configuration | `wt init` | ✅ |
| List worktrees | `wt list` | ✅ |
| Remove worktree | `wt remove` | ✅ |
| Custom pools | `.claude/archetype-groups.yml` | ✅ |
| Auto-detect build commands | `wt init` | ✅ |

---

## Archetype Roles (9 types)

Each can be assigned to workers via `wt split -a <archetype>` or `wt open -w N`. The `-a` flag is case-insensitive and supports partial names.

| Archetype | Emoji | Purpose | Best For |
|-----------|-------|---------|----------|
| architect | 🏗️ | High-level design & structure | System architecture |
| detective | 🔍 | Investigation & problem analysis | Debugging, edge cases |
| craftsman | 🔧 | Implementation & coding | Feature development |
| explorer | 🗺️ | Experimentation & learning | R&D, new approaches |
| aesthete | ✨ | Elegant solutions & API design | Simplicity, DX |
| adversary | ⚔️ | Adversarial red-team review | Challenge assumptions, find gaps |
| sentinel | 🛡️ | Security review & threat modeling | OWASP/CWE, severity-rated findings |
| scribe | 📝 | Documentation & knowledge capture | README, API docs, ADRs |
| guide | 🧭 | Requirements gathering & scoping | Translating ideas to acceptance criteria |

---

## Worker Pools (3 default)

Pre-configured groupings deployable via `wt open --deploy-pool <name>`:

| Pool | Workers | Purpose |
|------|---------|---------|
| **Researchers** | architect, explorer | Evaluate solutions & design |
| **Coders** | craftsman, aesthete | Implement (add adversary later) |
| **Reviewers** | detective, adversary, sentinel | Final quality & security |

---

## Full Workflow Example

```bash
# 1. Research phase
wt open SRE-526 --deploy-pool Researchers --watcher

# 2. Implement from research
wt remove SRE-526
wt open SRE-526 --deploy-pool Coders

# 3. Add security review when ready
wt split SRE-526 -a adversary

# 4. Final review
wt remove SRE-526
wt open SRE-526 --deploy-pool Reviewers

# 5. Clean up
wt remove SRE-526

# 6. View all at once
wt list
```

---

## Quick Reference by Use Case

### Just fetch and read
```bash
wt open SRE-526
# Single Claude instance with ticket context
```

### Collaborative coding
```bash
wt open SRE-526 --deploy-pool Coders -w 3
# Or manual: wt open SRE-526 -w 3 --no-wizard
```

### Security review
```bash
wt open SRE-526 --deploy-pool Reviewers
```

### Quick exploration
```bash
wt open SRE-526 --deploy-pool Researchers
```

### Add expert later
```bash
wt split SRE-526 -a <archetype>
```

### See everything
```bash
wt list
```

### Clean up
```bash
wt remove SRE-526
# or: wt rm SRE-526
```

---

**That's the complete toolkit!** 🎉
