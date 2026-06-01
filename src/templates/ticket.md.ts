import * as fs from 'fs';
import { TicketIssue, TicketProvider } from '../core/ticketing.js';
import { AiProvider } from '../core/config.js';

export interface AgentContext {
  issueNumber: string;
  branchName: string;
  issue?: TicketIssue;
  provider: TicketProvider;
  aiProvider: AiProvider;
  projectName: string;
  customContext?: string;
  commands?: {
    dev?: string;
    test?: string;
    lint?: string;
    build?: string;
    [key: string]: string | undefined;
  };
}

export function generateWorktreeTicket(context: AgentContext): string {
  const { issueNumber, branchName, issue, provider, aiProvider, projectName, customContext, commands } = context;
  const providerLabel = provider === 'linear' ? 'Linear' : 'GitHub';
  const ticketRef = provider === 'linear' ? issueNumber : `#${issueNumber}`;
  const aiProviderName = aiProvider === 'gemini' ? 'Gemini' : 'Claude';

  let content = `# ${projectName} - Issue ${ticketRef}

## Context
This is a worktree for working on ${providerLabel} issue ${ticketRef} using ${aiProviderName}.
Branch: ${branchName}
Created: ${new Date().toISOString()}

`;

  if (issue) {
    content += `## ${providerLabel} Issue Details
**Title:** ${issue.title}
**State:** ${issue.state}
**URL:** ${issue.url}
`;

    if (issue.assignee) {
      content += `**Assignee:** ${issue.assignee}\n`;
    }

    if (issue.labels.length > 0) {
      content += `**Labels:** ${issue.labels.join(', ')}\n`;
    }

    if (issue.body) {
      content += `\n### Description\n${issue.body}\n`;
    }

    content += '\n';
  }

  content += `## Instructions
1. Focus only on implementing the requirements for issue ${ticketRef}
2. Test all changes before committing
3. Keep commits focused and well-documented
4. Update the ${providerLabel} issue with progress as needed

`;

  if (provider === 'github') {
    content += `## Key Commands
- View issue: \`gh issue view ${issueNumber}\`
- Update issue: \`gh issue comment ${issueNumber} -b "Progress update..."\`
- Create PR: \`gh pr create --title "Fix #${issueNumber}: [description]" --body "Closes #${issueNumber}"\`
`;
  } else {
    content += `## Key References
- Linear issue: ${issue?.url || ticketRef}
- Reference ${ticketRef} in commit messages and PR descriptions so Linear auto-links them.
`;
  }

  content += `

## Before Starting Work
Always ensure you have the latest main code:
\`\`\`bash
git fetch origin main
git rebase origin/main
\`\`\`

## Before Creating a PR
Update with latest main to avoid merge conflicts:
\`\`\`bash
git fetch origin main
git rebase origin/main
# Resolve any conflicts if they arise
# Run tests to ensure everything still works
\`\`\`
`;

  // Add project context if provided
  if (customContext) {
    content += `\n## Project Context\n${customContext}\n`;
  }

  // Add development commands if provided
  if (commands && Object.keys(commands).length > 0) {
    content += '\n## Development Commands\n';
    
    for (const [name, command] of Object.entries(commands)) {
      if (command) {
        content += `- ${name}: \`${command}\`\n`;
      }
    }
  }

  // Add notes
  content += `
## Notes
- Remember to run package installation if needed (npm install, yarn, etc.)
- Check the development server to test changes
- Run linting and type checking before committing
- This file (WORKTREE_TICKET.md) is ignored by git and contains ticket context for the AI agent
`;

  return content;
}

export function ensureGitignore(worktreePath: string): void {
  const gitignorePath = `${worktreePath}/.gitignore`;

  let gitignoreContent = '';
  
  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  }
  
  let updated = false;
  const header = '\n# agent worktree context\n';
  
  // Check if WORKTREE_TICKET.md is already in .gitignore
  if (!gitignoreContent.includes('WORKTREE_TICKET.md')) {
    if (gitignoreContent && !gitignoreContent.endsWith('\n')) {
      gitignoreContent += '\n';
    }

    gitignoreContent += header + 'WORKTREE_TICKET.md\n';
    updated = true;
  }
  
  // Check if WORKTREE_COORDINATION.md is already in .gitignore
  if (!gitignoreContent.includes('WORKTREE_COORDINATION.md')) {
    if (gitignoreContent && !gitignoreContent.endsWith('\n')) {
      gitignoreContent += '\n';
    }
    
    if (!updated) {
      gitignoreContent += header;
    }
    
    gitignoreContent += 'WORKTREE_COORDINATION.md\n';
    updated = true;
  }
  
  // Check if OVERSEER.md is already in .gitignore
  if (!gitignoreContent.includes('OVERSEER.md')) {
    if (gitignoreContent && !gitignoreContent.endsWith('\n')) {
      gitignoreContent += '\n';
    }
    if (!updated) {
      gitignoreContent += header;
    }
    gitignoreContent += 'OVERSEER.md\n';
    updated = true;
  }

  // Check if WORKTREE_WORKERS.json is already in .gitignore
  if (!gitignoreContent.includes('WORKTREE_WORKERS.json')) {
    if (gitignoreContent && !gitignoreContent.endsWith('\n')) {
      gitignoreContent += '\n';
    }
    if (!updated) {
      gitignoreContent += header;
    }
    gitignoreContent += 'WORKTREE_WORKERS.json\n';
  }

  fs.writeFileSync(gitignorePath, gitignoreContent);
}
