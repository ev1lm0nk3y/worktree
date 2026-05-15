# Worktree: Capabilities & Skills

What this toolkit enables you to do.

---

## 🎯 Core Skills Provided

### 1. **Multi-Perspective Problem Solving**
Bring 3-6 different AI perspectives to a single problem simultaneously:
- Architect designs the solution
- Detective finds issues and edge cases
- Craftsman implements
- Explorer researches alternatives
- Aesthete optimizes for elegance and simplicity
- Adversary challenges assumptions
- Sentinel audits for security vulnerabilities
- Scribe captures decisions and documentation

**Skill:** Parallel problem solving with diverse expertise

---

### 2. **Ticket-Driven Development**
Every worktree automatically tied to a Linear ticket:
- Fetch full ticket context automatically
- All work scoped to specific issue
- Acceptance criteria available to all workers
- Comments and discussion integrated

**Skill:** Structured, traceable development workflow

---

### 3. **Isolated Workspace Management**
Each issue gets its own isolated git branch/worktree:
- No context switching between issues
- Clean commit history (one branch per issue)
- Easy cleanup after completion
- Safe parallel work on multiple issues

**Skill:** Branch management at scale

---

### 4. **Archetype-Based Specialization**
Assign Claude specific roles optimized for tasks:
- **Architect** - High-level design decisions
- **Detective** - Problem analysis & debugging
- **Craftsman** - Implementation & coding
- **Explorer** - Research & experimentation
- **Aesthete** - Elegant solutions & API design
- **Adversary** - Adversarial red-team review
- **Sentinel** - Security review & threat modeling
- **Scribe** - Documentation & knowledge capture
- **Guide** - Requirements gathering & task scoping

**Skill:** Expert role assignment for optimal output

---

### 5. **Collaborative AI Development**
Multiple Claude instances work on same issue:
- Shared context via `WORKTREE_COORDINATION.md`
- Coordination file tracks who's doing what
- Can add/remove workers as needed
- Natural workflow for multi-stage development

**Skill:** AI team coordination and hand-offs

---

### 6. **Structured Code Review & Validation**
Built-in adversary workflow:
1. Implement with Craftsman, Aesthete, Detective
2. Add Adversary when ready: `wt split SRE-526 -a adversary`
3. Adversary challenges implementation
4. Loop until adversary satisfied

**Skill:** Adversarial testing & security review

---

### 7. **Phase-Based Development**
Move through distinct development phases with different teams:

**Phase 1: Research** (Researchers pool)
- Architect, Explorer evaluate options
- Design best approach
- Structure solution

**Phase 2: Implementation** (Coders pool)
- Craftsman builds it
- Aesthete ensures elegance and simplicity

**Phase 3: Review** (Reviewers pool)
- Detective finds edge cases and tests
- Adversary red-teams the implementation
- Sentinel audits for security vulnerabilities

**Skill:** Structured multi-phase development

---

### 8. **Tmux Pane-Based Workflows**
Manage multiple Claude instances in single tmux window:
- Split panes (horizontal/vertical)
- Switch between workers easily
- All in same session/window
- Natural local development feel

**Skill:** Terminal-native multi-worker coordination

---

### 9. **Automatic Context Generation**
Every worktree gets rich context:
- `CLAUDE.md` - Full ticket details + comments
- `WORKTREE_COORDINATION.md` - Worker assignments
- `OVERSEER.md` - High-level progress tracking
- Auto-updated `.gitignore`

**Skill:** Context preparation & knowledge transfer

---

### 10. **Pre-Built Team Orchestration**
Deploy entire pre-configured teams instantly:
- Researchers pool (3 workers)
- Coders pool (3 workers + add Adversary later)
- Reviewers pool (3 workers)
- Custom pools for your workflow

**Skill:** Team configuration & deployment

---

### 11. **Independent Progress Monitoring**
Optional watcher/overseer worker:
- Monitors all other workers
- Tracks progress independently
- Provides oversight & guidance
- Can intervene if needed

**Skill:** Multi-worker progress oversight

---

### 12. **Linear Ticket Integration**
Direct integration with Linear API:
- Auto-fetch ticket by ID
- Pull title, description, acceptance criteria
- Fetch all comments
- Include priority, status, estimates

**Skill:** API-driven issue management

---

### 13. **Git Worktree Management**
Automatic branch/worktree creation:
- Create isolated worktree per issue
- Branch naming from ticket number + descriptor
- Clean removal when done
- Prevent accidental merges

**Skill:** Multi-branch development

---

### 14. **Project Configuration**
Extensible configuration system:
- Auto-detect build/test/lint commands
- Custom setup commands
- Multiple ticketing providers (Linear, GitHub)
- Custom worker pools
- Tmux layouts & iTerm settings

**Skill:** Project customization

---

### 15. **MacOS Integration** (iTerm2)
Native iTerm2 window management:
- Open windows vs tabs
- Focus new windows
- Integrated with tmux sessions

**Skill:** Cross-platform terminal orchestration

---

## 📊 Workflow Skills

### Sequential Development
```
Research → Implementation → Adversary Review → Final Review
```

### Parallel Exploration
```
Deploy multiple Explorers
Research different solutions in parallel
Compare results
```

### High-Velocity Coding
```
Craftsman codes
Aesthete polishes in parallel
Detective tests in parallel
All async, coordinated
```

### Security-First Development
```
Implement with Craftsman
Detect issues with Detective
Add Adversary for security
Loop until satisfied
```

### Code Quality Gates
```
Implement
Aesthete reviews quality
Adversary reviews security
All gates must pass
```

---

## 🎓 Learning & Knowledge Transfer

### Skill: Structured Debugging
```
1. Detective investigates issue
2. Explorer researches solutions
3. Architect designs fix
4. Craftsman implements
5. Adversary tests edge cases
```

### Skill: Architecture Review
```
1. Architect proposes design
2. Craftsman identifies implementation concerns
3. Detective analyzes risks
4. Aesthete ensures quality
5. Adversary finds security gaps
```

### Skill: Knowledge Dissemination
```
Research pool explores options
Generates WORKTREE_COORDINATION.md
Coders pool uses that context
Implement with full background
```

---

## 💡 Innovation Skills

### Parallel Experimentation
```
Deploy Researchers pool
Multiple Explorers try different approaches simultaneously
Gather results
Choose best path
```

### Rapid Prototyping
```
Deploy Explorers + Craftsman
Build quick POCs
Test viability
Scale to full implementation
```

### Cross-Domain Learning
```
Explorer researches new tech
Architect applies to your domain
Craftsman implements
Transfer knowledge to codebase
```

---

## 🔒 Quality & Security Skills

### Comprehensive Code Review
Reviewers pool covers:
- Detective: Testing, edge cases, bugs
- Adversary: Red-team review, assumptions, exploits
- Sentinel: Security audit, OWASP/CWE coverage, severity-rated findings

### Iterative Refinement
With Adversary loop (default: 5 iterations):
1. Initial implementation
2. Adversary identifies issues
3. Craftsman fixes
4. Repeat until satisfied

### Security Testing
Adversary specifically challenges:
- Security assumptions
- Edge cases
- Boundary conditions
- Failure modes
- Attack vectors

---

## 📈 Productivity Skills

### Context Preservation
- Automatic context generation
- No manual documentation needed
- Full ticket history available
- Comments integrated

### Reduced Context Switching
- One issue = one worktree
- Switch with `wt list`
- All context isolated
- Clean separation

### Parallel Issue Handling
```
Issue 1: wt open SRE-526
Issue 2: wt open SRE-527
Issue 3: wt open SRE-528
(In different worktrees, all parallel)
```

### Batch Operations
- Deploy pools for multiple issues
- Coordinate across many workers
- Manage 6+ Claude instances
- Single command: `wt open --deploy-pool`

---

## 🎯 Problem-Solving Skills

### Breaking Down Complex Problems
Research pool evaluates multiple approaches:
1. Architect designs each option
2. Detective analyzes each design
3. Explorer studies implications
4. Choose best approach
5. Implement in Coders phase

### Iterative Refinement
Loop-based development:
1. Implement (Coders pool)
2. Adversary reviews (add with split)
3. Fix issues (Coders loop back)
4. Repeat until satisfied

### Risk Mitigation
Adversary archetype finds risks:
- Security vulnerabilities
- Edge cases
- Performance problems
- Scalability issues

---

## 🚀 Scale Skills

### From 1 to 6 Workers
```bash
wt open SRE-526                         # 1 worker
wt open SRE-526 -w 2                    # 2 workers
wt open SRE-526 --deploy-pool Coders    # 3 workers
wt split SRE-526 -a adversary           # + 1 more = 4
```

### Multi-Issue Orchestration
```bash
wt open SRE-526
wt open SRE-527
wt open SRE-528
# 3 issues, 3+ workers each, coordinated
```

### Custom Team Composition
Create `.claude/archetype-groups.yml`:
```yaml
pools:
  DataTeam:
    workers: [architect, detective, explorer, craftsman]
  SecurityTeam:
    workers: [detective, adversary, aesthete]
```

---

## Summary: 15+ Capabilities

| # | Skill | Enables |
|----|-----|----|
| 1 | Multi-perspective solving | Diverse AI expertise on single problem |
| 2 | Ticket-driven dev | Issue tracking & scoping |
| 3 | Workspace isolation | Clean branch management |
| 4 | Archetype specialization | Role-optimized AI workers |
| 5 | AI collaboration | Multi-agent coordination |
| 6 | Adversarial review | Security & edge case testing |
| 7 | Phase-based development | Research → Code → Review workflow |
| 8 | Terminal-native workflows | Tmux pane-based coordination |
| 9 | Context automation | Auto-generated docs & context |
| 10 | Team orchestration | Pre-built worker pools |
| 11 | Progress monitoring | Independent oversight |
| 12 | API integration | Linear ticket automation |
| 13 | Branch management | Isolated worktrees per issue |
| 14 | Project configuration | Customizable setup |
| 15 | MacOS integration | Native iTerm2 support |
| 16 | Parallel development | Multiple issues simultaneously |
| 17 | Rapid iteration | Loop-based refinement |
| 18 | Knowledge transfer | Context-rich handoffs |

---

## The Bigger Picture

You can now:

✅ Deploy entire AI teams instantly  
✅ Work on multiple issues in parallel  
✅ Get diverse perspectives on problems  
✅ Automate code review & security testing  
✅ Move through structured development phases  
✅ Scale from 1 to 6+ AI workers  
✅ Keep everything ticket-driven  
✅ Maintain isolated, clean workflows  
✅ Coordinate complex multi-worker projects  
✅ Catch security issues before merge  

**This is enterprise-grade AI-assisted development orchestration.** 🚀

---

See `COMPLETE_COMMAND_REFERENCE.md` for all commands and options.
