import { Archetype } from '../core/archetypes.js';

export interface CoordinationContext {
  issueNumber: string;
  issueTitle: string;
  issueBody: string;
  workerCount: number;
  timestamp: string;
  workerArchetypes?: { [key: number]: Archetype };
}

export function generateCoordinationMd(context: CoordinationContext): string {
  const { issueNumber, issueTitle, issueBody, workerCount, timestamp, workerArchetypes } = context;
  
  return `# Worktree Coordination - Issue #${issueNumber}

## Overview
This document serves as the **Team Roster** and high-level status summary for issue #${issueNumber}.
Created: ${timestamp}

## Issue Details
**Title:** ${issueTitle}
**Description:**
${issueBody}

## Worker Roster

### Worker 1 (Coordinator)
- **Role:** Lead coordinator — does not write feature code
- **Responsibilities:**
  - Read WORKTREE_WORKERS.json to identify all deployed workers
  - Break the issue down into tasks
  - **Delegation:** Assign tasks by creating and writing to \`WORKTREE_WORKER_[X].md\` for each worker
  - Update this coordination document (\`WORKTREE_COORDINATION.md\`) as a high-level roster and status summary
  - Monitor progress and unblock workers via their individual worker files

### Worker 2${workerArchetypes?.[2] ? ` (${workerArchetypes[2].emoji} ${workerArchetypes[2].name})` : ''}
- **Role:** ${workerArchetypes?.[2] ? workerArchetypes[2].shortDescription : 'Supporting implementation and testing'}
- **Responsibilities:**
  - Wait for \`WORKTREE_WORKER_2.md\` to be created by the Coordinator
  - Follow instructions provided in \`WORKTREE_WORKER_2.md\`
  - Report progress and completion within \`WORKTREE_WORKER_2.md\`

${workerCount > 2 ? `### Worker 3${workerArchetypes?.[3] ? ` (${workerArchetypes[3].emoji} ${workerArchetypes[3].name})` : ''}
- **Role:** ${workerArchetypes?.[3] ? workerArchetypes[3].shortDescription : 'Quality assurance and optimization'}
- **Responsibilities:**
  - Wait for \`WORKTREE_WORKER_3.md\` to be created by the Coordinator
  - Follow instructions provided in \`WORKTREE_WORKER_3.md\`
` : ''}

${workerCount > 3 ? `### Worker 4${workerArchetypes?.[4] ? ` (${workerArchetypes[4].emoji} ${workerArchetypes[4].name})` : ''}
- **Role:** ${workerArchetypes?.[4] ? workerArchetypes[4].shortDescription : 'Additional support and testing'}
- **Responsibilities:**
  - Wait for \`WORKTREE_WORKER_4.md\` to be created by the Coordinator
  - Follow instructions provided in \`WORKTREE_WORKER_4.md\`
` : ''}

${workerCount > 4 ? `### Worker 5${workerArchetypes?.[5] ? ` (${workerArchetypes[5].emoji} ${workerArchetypes[5].name})` : ''}
- **Role:** ${workerArchetypes?.[5] ? workerArchetypes[5].shortDescription : 'Innovation and exploration'}
- **Responsibilities:**
  - Wait for \`WORKTREE_WORKER_5.md\` to be created by the Coordinator
  - Follow instructions provided in \`WORKTREE_WORKER_5.md\`
` : ''}

## Team Status
- Worker 1: [Starting analysis...]
- Worker 2: [Waiting for WORKTREE_WORKER_2.md...]
${workerCount > 2 ? '- Worker 3: [Waiting for WORKTREE_WORKER_3.md...]' : ''}
${workerCount > 3 ? '- Worker 4: [Waiting for WORKTREE_WORKER_4.md...]' : ''}
${workerCount > 4 ? '- Worker 5: [Waiting for WORKTREE_WORKER_5.md...]' : ''}

## Communication Protocol
1. **Delegation:** All task assignments must come from Worker 1 via \`WORKTREE_WORKER_X.md\`.
2. **Reporting:** Report progress and blockers within your individual \`WORKTREE_WORKER_X.md\`.
3. **Collaboration:** Use this document (\`WORKTREE_COORDINATION.md\`) to track overall team status and discovered implementation notes.

## Implementation Notes
*Shared discoveries or major architectural decisions*

## Blockers & Cross-Team Issues
*Document any issues that require coordination between multiple workers*

---
Remember: Worker 1 orchestrates the workflow. Follow the instructions in your specific worker file!
`;
}

export function generateNewWorkerEntry(workerNumber: number, archetype?: Archetype): string {
  const timestamp = new Date().toISOString();
  const header = archetype
    ? `### Worker ${workerNumber} (${archetype.emoji} ${archetype.name}) — joined ${timestamp}`
    : `### Worker ${workerNumber} — joined ${timestamp}`;

  const role = archetype?.shortDescription ?? 'Supporting implementation';
  const focus = archetype?.focus ?? 'Additional support';
  const traits = archetype?.traits.slice(0, 4).map(t => `  - ${t}`).join('\n') ?? '  - Provide additional support';

  return `\n${header}\n- **Role:** ${role}\n- **Focus:** ${focus}\n- **Responsibilities:**\n${traits}\n`;
}

export function generateAdversaryAlert(workerNumber: number): string {
  const timestamp = new Date().toISOString();
  return `\n---\n\n## ⚔️ ADVERSARY REVIEW IN PROGRESS (Worker ${workerNumber})\n\n**Started:** ${timestamp}\n\n**ALL WORKERS — ACTION REQUIRED:**\n1. **Coordinator (Worker 1):** Ensure all changes are committed before the Adversary begins review\n2. **All workers:** Check this document every 3 minutes for Adversary findings\n3. Address any flagged issues and mark them resolved in the Findings section below\n4. Do not consider the issue done until The Adversary posts a PASS verdict\n\n### Adversary Findings\n*Review in progress — check back in 3 minutes*\n\n### Adversary Verdict\n*Pending — treat as BLOCK until updated*\n`;
}

export function generateAdversaryBroadcast(issueNumber: string): string {
  return `⚔️ The Adversary has joined this session and is reviewing all code changes for issue #${issueNumber}. Commit any uncommitted work now, then check WORKTREE_COORDINATION.md every 3 minutes for findings that require your attention. Resume work on any items the Adversary flags as needing fixes. Do not close your session until The Adversary posts a PASS verdict.`;
}

export function generateWorkerPrompt(workerNumber: number, totalWorkers: number, issueNumber: string, archetype?: Archetype): string {
  if (workerNumber === 1) {
    return `You are Worker 1 (Coordinator) of ${totalWorkers} Claude workers on issue #${issueNumber}. 

FIRST: Read WORKTREE_WORKERS.json — it lists every deployed worker and their archetype.
SECOND: Read WORKTREE_TICKET.md to understand the goal.
THIRD: Coordinate the team by breaking down the work and DELEGATING to sub-workers.

DELEGATION PROTOCOL:
- You assign tasks by creating a file named \`WORKTREE_WORKER_[X].md\` for the corresponding worker (e.g., WORKTREE_WORKER_2.md).
- Sub-workers are currently idling, waiting for their specific file to exist. They will not act until you create it.
- Update WORKTREE_COORDINATION.md as a high-level roster/status summary, but use the individual WORKTREE_WORKER_X.md files for direct instructions.
- Do not write feature code yourself. Focus entirely on orchestration.`;
  } else {
    const roleName = archetype ? ` (${archetype.name})` : '';
    const archetypePrompt = archetype ? ` ${archetype.prompt}` : '';
    return `You are Worker ${workerNumber}${roleName} of ${totalWorkers} Claude workers on issue #${issueNumber}.${archetypePrompt}

PRE-WORK CONTEXT PASS (do this once, before waiting):
- Read WORKTREE_TICKET.md to understand the goal, then read-only explore the codebase for the systems, files, and topics it mentions.
- Build a mental model of the relevant environment: what modules/services are involved, how they currently work, and where related code lives.
- Do NOT write, edit, or create any files during this pass — this is reconnaissance only, so you're ready to move fast once tasked.
- This pass is bounded: once you have a working understanding of the ticket's context, stop and move to the waiting state below. Do not keep exploring indefinitely.

WAITING STATE:
- Do NOT start working yet.
- You must wait for Worker 1 (Coordinator) to create a file named \`WORKTREE_WORKER_${workerNumber}.md\` in the root of the worktree.
- Check for this file's existence every 30 seconds.
- Once \`WORKTREE_WORKER_${workerNumber}.md\` exists, read it and WORKTREE_TICKET.md to understand your specific assignments.
- Report your progress and completions inside your \`WORKTREE_WORKER_${workerNumber}.md\` file.`;
  }
}