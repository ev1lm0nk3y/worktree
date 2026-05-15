# Worker Pools - Quick Reference

## Basic Usage

```bash
# Interactive pool selection
wt open SRE-526 --deploy-pool

# Deploy specific pool
wt open SRE-526 --deploy-pool Researchers
wt open SRE-526 --deploy-pool Coders
wt open SRE-526 --deploy-pool Reviewers

# With watcher
wt open SRE-526 --deploy-pool Coders --watcher
```

## Default Pools

| Pool | Workers | Purpose |
|------|---------|---------|
| **Researchers** | architect, explorer | Evaluate solutions & design |
| **Coders** | craftsman, aesthete | Implement (add adversary later) |
| **Reviewers** | detective, adversary, sentinel | Final quality & security review |

## Common Workflows

### Option A: Sequential (Recommended)
```bash
# 1. Research
wt open SRE-526 --deploy-pool Researchers

# 2. Implement  
wt open SRE-526 --deploy-pool Coders

# 3. Add adversary when ready
wt split SRE-526 -a adversary

# 4. Final review
wt open SRE-526 --deploy-pool Reviewers
```

### Option B: Everything at Once
```bash
# All in one (use manual workers)
wt open SRE-526 -w 6
# Manually assign archetypes: architect, detective, explorer, craftsman, aesthete, adversary
```

### Option C: Research + Watcher
```bash
wt open SRE-526 --deploy-pool Researchers --watcher
```

## Custom Pools

Create `.claude/archetype-groups.yml`:
```yaml
pools:
  MyPool:
    description: "What this does"
    workers: [architect, craftsman, detective]
    coordinator: { enable: true }
    watcher: { enable: false }
```

## Important Notes

✅ **Can do:**
- `wt open SRE-526 --deploy-pool Coders`
- `wt open SRE-526 --deploy-pool Coders --watcher`
- `wt split SRE-526 -a adversary` (add to Coders pool)

❌ **Cannot do:**
- `wt open SRE-526 --deploy-pool Coders -w 2` (mutually exclusive)

## Archetype Names

```
architect, detective, craftsman, explorer, aesthete, adversary, sentinel, scribe, guide
```

The `-a` flag on `wt split` is case-insensitive and supports partial names (e.g. `Sentinel`, `sent`). Unrecognised input falls back to the interactive wizard.

## Generated Files

- `CLAUDE.md` - Ticket context
- `WORKTREE_COORDINATION.md` - Shows assigned workers
- `.gitignore` - Includes context files

---

See `WORKER_POOLS.md` for full documentation.
