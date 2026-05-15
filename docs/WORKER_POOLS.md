# Worker Pools

Worker pools are pre-configured groupings of Claude archetypes designed for specific tasks. Instead of manually selecting workers and their archetypes, you can deploy an entire pool with a single flag.

## Quick Start

```bash
# Deploy a predefined pool (interactive selection)
wt open SRE-526 --deploy-pool

# Deploy a specific pool by name
wt open SRE-526 --deploy-pool Coders

# Combine with other flags
wt open SRE-526 --deploy-pool Researchers --watcher
```

## Default Pools

### Researchers 🔬
**Purpose:** Evaluate solutions, choose best approach, structure deployment

**Workers:**
1. Architect - High-level design and structure thinking
2. Explorer - Experimentation and new ideas

**Use when:**
- Solving complex problems with multiple solution paths
- Designing system architecture or large features
- Evaluating trade-offs and picking the best approach
- Exploring new technologies or patterns

**Example:**
```bash
wt open SRE-526 --deploy-pool Researchers
```

---

### Coders 👨‍💻
**Purpose:** Implement from research output (add adversary later via split)

**Workers:**
1. Craftsman - Implementation and coding
2. Aesthete - Elegant design & API quality

**Use when:**
- Implementing a well-defined task from Linear
- Building features based on architecture/research
- Need iterative development with quality gates

**Special notes:**
- Add Adversary later when ready: `wt split SRE-526 -a adversary`
- Adversary will provide feedback and challenge assumptions
- Loop until adversary is satisfied (default: 5 iterations)

**Example:**
```bash
wt open SRE-526 --deploy-pool Coders
# ... implement with Craftsman, Aesthete, Detective
# When ready for adversary review:
wt split SRE-526 -a adversary
```

---

### Reviewers 👀
**Purpose:** Final code quality and security review

**Workers:**
1. Detective - Edge case analysis & testing
2. Adversary - Adversarial red-team review
3. Sentinel - Dedicated security & threat modeling

**Use when:**
- Final review before merge
- Security audit of changes
- Code quality enforcement
- All implementation is complete

**Example:**
```bash
wt open SRE-526 --deploy-pool Reviewers
```

---

## Custom Pools

Add your own pools in your project or home directory.

### Project-Level Pools

Create `.claude/archetype-groups.yml` in your repository:

```yaml
pools:
  CustomTeam:
    description: "Description of what this pool does"
    coordinator: { enable: true }          # Deploy coordinator (optional, default: true)
    workers: [architect, craftsman]
    watcher: { enable: false }             # Include watcher (optional, default: false)
  
  AnotherPool:
    description: "Another pool"
    workers: [aesthete, detective, explorer]
```

### User-Level Pools

Create `~/.claude/archetype-groups.yml` to define custom pools for all repositories:

```yaml
pools:
  MyTeam:
    description: "My custom worker team"
    workers: [architect, detective, craftsman, aesthete]
```

**Priority:** Project-level pools override user-level pools.

## CLI Usage

### Deploy Interactive Selection

```bash
wt open SRE-526 --deploy-pool
```

Shows interactive menu:
```
Available pools:

1. Researchers    - Evaluate solutions, choose best approach, structure deployment
2. Coders         - Implement from research output (add adversary later via split)
3. Reviewers      - Final code quality and security review
```

Select with:
- Arrow keys to navigate
- Number to select
- fzf (if installed) for fuzzy search

### Deploy Specific Pool

```bash
wt open SRE-526 --deploy-pool Coders
```

### Combine with Other Flags

```bash
# Add watcher
wt open SRE-526 --deploy-pool Researchers --watcher

# Cannot combine: --deploy-pool and -w are mutually exclusive
wt open SRE-526 --deploy-pool Coders -w 2  # ❌ Error
```

## Archetype Roles

When a pool is deployed, each worker gets assigned an archetype:

| Archetype | Role | Best For |
|-----------|------|----------|
| **Architect** 🏗️ | High-level design & structure | System design, architecture decisions |
| **Detective** 🔍 | Investigation & analysis | Problem analysis, debugging, edge cases |
| **Craftsman** 🔧 | Implementation & coding | Writing code, feature development |
| **Explorer** 🗺️ | Experimentation & learning | Research, new approaches, POCs |
| **Aesthete** ✨ | Elegant solutions & API design | Simplicity, DX, "less is more" |
| **Adversary** ⚔️ | Adversarial red-team review | Challenge assumptions, find gaps |
| **Sentinel** 🛡️ | Security review & threat modeling | OWASP/CWE coverage, severity-rated findings |
| **Scribe** 📝 | Documentation & knowledge capture | README, API docs, ADRs |
| **Guide** 🧭 | Requirements gathering & scoping | Translating vague ideas to acceptance criteria |

## Workflow Examples

### Full Development Cycle

```bash
# 1. Research phase
wt open SRE-526 --deploy-pool Researchers

# ... Researchers evaluate solutions and design approach ...
# They update WORKTREE_COORDINATION.md with recommendation

# 2. Implementation phase (new worktree or same)
wt open SRE-526 --deploy-pool Coders

# ... Craftsman implements, Aesthete polishes, Detective tests ...
# Implementation ready, but needs security review

# 3. Add security review (add to existing worktree)
wt split SRE-526 -a adversary

# ... Adversary challenges assumptions and finds edge cases ...
# Coders fix issues and respond to feedback
# Loop until adversary is satisfied

# 4. Final review phase (new worktree or same)
wt open SRE-526 --deploy-pool Reviewers

# ... Final quality and security check before merge ...
```

### Research Only

```bash
wt open SRE-526 --deploy-pool Researchers --watcher
# Researchers + Overseer who monitors progress
```

### Quick Implementation

```bash
wt open SRE-526 --deploy-pool Coders
# Implement without watcher (can add later if needed)
```

## Generated Files

When you deploy a pool, the worktree includes:

- **CLAUDE.md** - Linear ticket context
- **WORKTREE_COORDINATION.md** - Shows assigned archetypes from the pool
- **.gitignore** - Ignores context files

## Advanced: Coordinator Control

The coordinator (Worker 1) can:
- Monitor progress via WORKTREE_COORDINATION.md
- Add workers: `wt split SRE-526 -a <archetype>`
- Request focus on specific areas
- Decide when to move to next phase

For Coders pool specifically:
- Decides when Adversary should be added for review

## Fallback Selection

If `fzf` is not installed:
- CLI shows numeric menu instead
- Arrow keys not supported
- Type number and Enter to select

**Recommendation:** Install fzf for better experience:
```bash
# macOS
brew install fzf

# Linux (Debian/Ubuntu)
sudo apt-get install fzf

# Linux (Fedora/RHEL)
sudo dnf install fzf
```

## Troubleshooting

### "No worker pools available"
- Check `.claude/archetype-groups.yml` exists
- Check YAML syntax is valid
- Restart your terminal to pick up new files

### "Pool 'X' not found"
- List available pools: `wt open SRE-526 --deploy-pool` (interactive mode)
- Check spelling of pool name
- Check pool is defined in `.claude/archetype-groups.yml`

### "Cannot combine --deploy-pool and -w"
- These flags are mutually exclusive
- Use: `wt open SRE-526 --deploy-pool PoolName`
- Or: `wt open SRE-526 -w 3`
- Not: `wt open SRE-526 --deploy-pool PoolName -w 3`

### Archetypes not assigned correctly
- Verify pool definition has correct archetype names
- Valid archetypes: `architect`, `detective`, `craftsman`, `explorer`, `aesthete`, `adversary`, `sentinel`, `scribe`, `guide`
- Check for typos in `.claude/archetype-groups.yml`
- Note: `-a` flag on `wt split` accepts case-insensitive and partial names; unrecognised input falls back to the interactive wizard

## Next Steps

After deploying a pool:
1. Claude instances launch with their assigned archetypes
2. Each has access to CLAUDE.md (ticket context)
3. Coordination happens via WORKTREE_COORDINATION.md
4. Add more workers with: `wt split SRE-526 -a <archetype>`
5. Switch between roles/phases by opening new worktrees with different pools

---

**Ready?** Try: `wt open SRE-526 --deploy-pool Researchers`
