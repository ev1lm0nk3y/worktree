export interface OverseerContext {
  issueNumber: string;
  issueTitle: string;
  timestamp: string;
}

export function generateOverseerMd(context: OverseerContext): string {
  const { issueNumber, issueTitle, timestamp } = context;
  
  return `# Overseer Report - Issue #${issueNumber}

## Overview
This document tracks the progress and provides recommendations for issue #${issueNumber}.
Created: ${timestamp}

## Issue Details
**Issue #${issueNumber}:** ${issueTitle}

## Definition of Done
*Populate BEFORE workers begin implementation. If the ticket lacks sufficient context, poll non-coordinator workers for their interpretation, synthesize consensus, and escalate to the user if ambiguity remains.*

- [ ] Acceptance criteria identified
- [ ] Workers aligned on success criteria
- [ ] Green light signaled via WORKTREE_COORDINATION.md

## Monitoring Schedule
- Check progress every 60 seconds
- Update this document with observations
- Monitor until the GitHub issue is closed

## Progress Tracking

### ${new Date().toLocaleTimeString()} - Initial Status
- Workers spawned, coordination beginning
- Monitoring git diff and WORKTREE_COORDINATION.md

## Observations
*Updated automatically during monitoring*

## Recommendations
*Based on observed progress and potential issues*

## Git Activity
*Track significant changes*

## Worker Coordination Status
*Monitor task assignments and completion*

## Potential Issues
*Flag any blockers or concerns*

## Quality Metrics
- Code changes aligned with issue requirements: TBD
- Test coverage: TBD
- Coordination effectiveness: TBD

---
*This document is automatically updated by the Overseer worker*
`;
}

export function generateOverseerPrompt(issueNumber: string): string {
  return `You are the Overseer for issue #${issueNumber} and the ticket maintainer.

PHASE 1 — Establish "what good looks like" BEFORE workers make changes:
1. Read the GitHub issue and any linked context. Determine the concrete acceptance criteria: what outputs, behaviors, or artifacts signal success?
2. If the ticket has sufficient context, write the success criteria into OVERSEER.md under a "Definition of Done" section and signal workers (via WORKTREE_COORDINATION.md) that they may proceed.
3. If context is insufficient to determine success criteria:
   a. Ask each non-coordinator worker (via WORKTREE_COORDINATION.md or direct tmux message) what they believe the task involves. Collect their interpretations.
   b. Synthesize consensus across their responses. If the interpretations converge, record the agreed-upon Definition of Done and proceed.
   c. If questions remain unresolved after gathering worker input, STOP and ask the user directly before allowing any code changes. Do not let workers begin implementation on ambiguous requirements.

PHASE 2 — Monitor execution:
Once the Definition of Done is locked in, monitor progress by checking git diff, WORKTREE_COORDINATION.md, and the original issue every 60 seconds. Update OVERSEER.md with observations, recommendations, and potential issues. Continue until the GitHub issue is closed. Focus on: progress tracking, quality assurance, coordination effectiveness, identifying blockers, and verifying work against the Definition of Done.`;
}