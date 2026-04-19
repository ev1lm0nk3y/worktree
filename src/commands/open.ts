import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { LinearClient, extractActionKeywords, getPriorityLabel } from '../services/linear-client';
import { getConfig } from '../services/config';
import * as tmux from '../services/tmux';
import * as iterm2 from '../services/iterm2';
import * as prompt from '../services/prompt';
import { PoolManager } from '../lib/pools';
import { selectPoolInteractive } from '../lib/pool-selection';

export async function handleOpen(args: string[], options: any) {
  try {
    // Parse input
    const ticketInput = args[0];
    const customDescriptor = args[1];

    if (!ticketInput) {
      console.error(
        chalk.red('❌ Please provide a Linear ticket (e.g., LIN-123)')
      );
      process.exit(1);
    }

    // Validate format
    if (!ticketInput.match(/^(LIN-?)?\d+$/i)) {
      console.error(chalk.red('❌ Ticket must be in format LIN-123 or 123'));
      process.exit(1);
    }

    const ticketNumber = `LIN-${ticketInput.toUpperCase().replace(/^LIN-/, '')}`;

    // Fetch ticket from Linear
    console.log(chalk.blue(`📋 Fetching ${ticketNumber} from Linear...`));
    const linearClient = new LinearClient();
    let ticket;

    try {
      ticket = await linearClient.fetchTicket(ticketNumber);
      console.log(
        chalk.green(`✓ Fetched: "${ticket.title}"`)
      );
    } catch (error) {
      console.error(chalk.red(`❌ Failed to fetch ticket: ${error.message}`));
      process.exit(1);
    }

    // Handle worker pools vs. manual worker selection
    let deployedPool: any = null;
    let poolWorkerList: string[] = [];

    // Check mutually exclusive flags
    if (options.deployPool !== undefined && options.w !== '1') {
      console.error(chalk.red('❌ --deploy-pool and -w are mutually exclusive'));
      process.exit(1);
    }

    // Handle pool deployment
    if (options.deployPool !== undefined) {
      const repoRoot = execSync('git rev-parse --show-toplevel')
        .toString()
        .trim();
      const poolManager = new PoolManager(repoRoot);
      const allPools = poolManager.getAllPools();

      if (allPools.length === 0) {
        console.error(chalk.red('❌ No worker pools available'));
        process.exit(1);
      }

      if (options.deployPool === true || options.deployPool === '') {
        // No pool name specified - show interactive selection
        console.log(chalk.cyan('\nSelect a worker pool:\n'));
        deployedPool = await selectPoolInteractive(allPools);
      } else {
        // Pool name specified
        deployedPool = poolManager.getPool(options.deployPool);
        if (!deployedPool) {
          console.error(
            chalk.red(`❌ Pool "${options.deployPool}" not found`)
          );
          console.log(chalk.gray(`Available pools: ${allPools.map(p => p.name).join(', ')}`));
          process.exit(1);
        }
      }

      poolWorkerList = deployedPool.workers;
      console.log(chalk.green(`✓ Deploying pool: ${deployedPool.name}`));
      console.log(chalk.gray(`  Workers: ${poolWorkerList.join(', ')}`));

      // Pools bypass the wizard entirely
      options.wizard = false;
    }

    // Determine descriptor
    let finalDescriptor = customDescriptor;

    if (!finalDescriptor) {
      // Try to auto-suggest from title/description
      const keywords = extractActionKeywords(
        `${ticket.title}. ${ticket.description}`
      );

      if (keywords.length === 1) {
        // Clear single action - use it
        finalDescriptor = keywords[0];
        console.log(chalk.gray(`  Suggested descriptor: ${finalDescriptor}`));
      } else if (keywords.length > 1) {
        // Multiple options - let user choose
        console.log(chalk.gray('\nMultiple actions detected. Choose one:'));
        keywords.forEach((kw, i) => {
          console.log(`  ${i + 1}) ${kw}`);
        });
        console.log(`  ${keywords.length + 1}) Custom descriptor`);

        const choice = await prompt.promptUser(
          `Select (1-${keywords.length + 1}): `
        );
        const index = parseInt(choice) - 1;

        if (index === keywords.length) {
          finalDescriptor = await prompt.promptUser(
            'Enter custom descriptor (max 20 chars): '
          );
        } else {
          finalDescriptor = keywords[index];
        }
      } else {
        // No keywords - ask user
        finalDescriptor = await prompt.promptUser(
          'Enter descriptor (max 20 chars): '
        );
      }
    }

    // Validate and truncate descriptor
    if (!finalDescriptor || finalDescriptor.trim().length === 0) {
      console.error(chalk.red('❌ Descriptor cannot be empty'));
      process.exit(1);
    }

    finalDescriptor = finalDescriptor
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .substring(0, 20);

    // Create branch name
    const branchName = `${ticketNumber}-${finalDescriptor}`.toLowerCase();
    console.log(chalk.gray(`  Branch: ${branchName}`));

    // Create worktree
    console.log(chalk.blue(`\n🌳 Creating worktree...`));

    const repoRoot = execSync('git rev-parse --show-toplevel')
      .toString()
      .trim();
    const worktreePath = path.join(repoRoot, '.git', 'worktrees', branchName);

    // Check if already exists
    if (fs.existsSync(worktreePath)) {
      console.error(
        chalk.red(`❌ Worktree already exists at ${worktreePath}`)
      );
      process.exit(1);
    }

    // Create new branch and worktree
    try {
      execSync(`git branch ${branchName}`, { stdio: 'pipe' });
      console.log(chalk.green(`  ✓ Created branch: ${branchName}`));

      execSync(`git worktree add "${worktreePath}" "${branchName}"`, {
        stdio: 'pipe',
      });
      console.log(chalk.green(`  ✓ Created worktree: ${worktreePath}`));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to create worktree: ${error.message}`));
      process.exit(1);
    }

    // Generate CLAUDE.md with Linear context
    console.log(chalk.blue('\n📝 Generating context file...'));
    generateClaudeContextFromLinear(worktreePath, ticket);
    console.log(chalk.green(`  ✓ Created CLAUDE.md`));

    // Determine worker count and configuration
    let workerCount: number;
    let workerArchetypes: string[] = [];

    if (deployedPool) {
      // Using pool configuration
      workerCount = deployedPool.workers.length;
      workerArchetypes = deployedPool.workers;
    } else {
      // Using manual configuration
      workerCount = options.w ? parseInt(options.w) : 1;
    }

    // Generate coordination doc if multi-worker
    if (workerCount > 1) {
      generateCoordinationDoc(worktreePath, ticketNumber, workerCount, workerArchetypes);
      console.log(chalk.green(`  ✓ Created WORKTREE_COORDINATION.md`));
    }

    // Update .gitignore
    const gitignore = path.join(repoRoot, '.gitignore');
    const ignoreEntries = [
      'CLAUDE.md',
      'WORKTREE_COORDINATION.md',
      'OVERSEER.md',
    ];

    if (fs.existsSync(gitignore)) {
      const content = fs.readFileSync(gitignore, 'utf-8');
      ignoreEntries.forEach((entry) => {
        if (!content.includes(entry)) {
          fs.appendFileSync(gitignore, `\n${entry}`);
        }
      });
    } else {
      fs.writeFileSync(gitignore, ignoreEntries.join('\n') + '\n');
    }

    // Switch to worktree
    console.log(chalk.blue('\n🔄 Switching to worktree...\n'));

    try {
      process.chdir(worktreePath);
      console.log(chalk.green(`✓ Switched to: ${worktreePath}`));
      console.log(chalk.gray(`  Branch: ${branchName}\n`));

      // Show git status
      const status = execSync('git status --short').toString();
      if (status.trim()) {
        console.log(chalk.gray('Current status:'));
        console.log(status);
      }

      // Show recent commits on parent branch
      console.log(chalk.gray('\nRecent commits:'));
      const log = execSync('git log --oneline -3').toString();
      console.log(log);

      // Launch Claude if not multi-worker (multi-worker handles this separately)
      if (workerCount === 1 && !options['no-launch']) {
        console.log(chalk.blue('\n🤖 Launching Claude Code...\n'));
        launchClaude(branchName, undefined);
      } else if (workerCount > 1) {
        console.log(
          chalk.blue(
            `\n🤖 Launching Claude Code with ${workerCount} workers...\n`
          )
        );
        launchMultipleWorkers(
          branchName,
          worktreePath,
          workerCount,
          options
        );
      }
    } catch (error) {
      console.error(chalk.red(`Error during setup: ${error.message}`));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red(`Unexpected error: ${error.message}`));
    process.exit(1);
  }
}

function generateClaudeContextFromLinear(
  worktreePath: string,
  ticket: any
) {
  const config = getConfig();

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const claudeContent = `# ${ticket.title}

**Ticket:** [${ticket.number}](${ticket.url})
**Status:** ${ticket.status.name}
**Priority:** ${getPriorityLabel(ticket.priority)}
${ticket.estimate ? `**Estimate:** ${ticket.estimate} points` : ''}

## Description

${ticket.description || '*(No description provided)*'}

${
  ticket.acceptanceCriteria
    ? `## Acceptance Criteria

${ticket.acceptanceCriteria}`
    : ''
}

${
  ticket.comments && ticket.comments.length > 0
    ? `## Comments

${ticket.comments
  .map(
    (c: any) => `**${c.author}** - ${formatDate(c.createdAt)}

${c.body}`
  )
  .join('\n\n---\n\n')}`
    : ''
}

## Project Context

${config.claude_context}

## Available Commands

${Object.entries(config.commands || {})
  .map(([cmd, script]: [string, any]) => `- \`${cmd}\`: ${script}`)
  .join('\n')}

${
  config.setup_commands && config.setup_commands.length > 0
    ? `## Setup Commands

Run these once at the start:
${config.setup_commands.map((cmd) => `- \`${cmd}\``).join('\n')}`
    : ''
}

---

**Ready to work!** See CLAUDE.md details above and start implementing the solution.
`;

  fs.writeFileSync(
    path.join(worktreePath, 'CLAUDE.md'),
    claudeContent.trim()
  );
}

function generateCoordinationDoc(
  worktreePath: string,
  ticketNumber: string,
  workerCount: number,
  workerArchetypes: string[] = []
) {
  const coordinationContent = `# Worktree Coordination: ${ticketNumber}

**Created:** ${new Date().toISOString()}
**Active Workers:** ${workerCount}

## Worker Assignments

${Array.from({ length: workerCount })
  .map(
    (_, i) => {
      const archetype = workerArchetypes[i] || '(to be assigned)';
      return `### Worker ${i + 1}
- **Status:** Starting
- **Archetype:** ${archetype}
- **Tasks:**
  - [ ] Understanding the problem
  - [ ] (Add specific tasks)
- **Last Update:** Just started
- **Blockers:** None yet
`;
    }
  )
  .join('\n')}

## How to Collaborate

1. **Update Your Status**: Regularly update your status section with progress
2. **List Your Tasks**: Add specific tasks you're working on
3. **Avoid Duplication**: Check what other workers are doing before starting something
4. **Report Blockers**: If you hit an issue, note it here and discuss in the pane
5. **Coordinate Merges**: Before committing, coordinate with other workers

## Shared Context

See **CLAUDE.md** for the full ticket details, description, and acceptance criteria.

## Implementation Notes

(Add notes about the implementation approach as you work)

---

**Tips:**
- Use this doc as your collaboration hub
- Update timestamps to show active workers
- When done, mark status as "Complete" or "Ready for integration"
`;

  fs.writeFileSync(
    path.join(worktreePath, 'WORKTREE_COORDINATION.md'),
    coordinationContent.trim()
  );
}

function launchClaude(branchName: string, archetype?: string) {
  const isInTmux = !!process.env.TMUX;

  if (isInTmux) {
    const command = archetype
      ? `claude --archetype ${archetype}`
      : 'claude';
    execSync(`tmux send-keys -t ${process.env.TMUX_PANE} "${command}" Enter`, {
      stdio: 'inherit',
    });
  } else {
    const command = archetype
      ? `claude --archetype ${archetype}`
      : 'claude';
    console.log(chalk.gray(`Run: ${command}`));
  }
}

function launchMultipleWorkers(
  branchName: string,
  worktreePath: string,
  workerCount: number,
  options: any
) {
  // This integrates with existing tmux multi-worker logic
  // For now, guide user to run worktree commands
  console.log(chalk.yellow(`\n⚠️  Multi-worker setup:`));
  console.log(chalk.gray(`Run workers in separate panes/tabs:`));
  console.log();

  for (let i = 0; i < workerCount; i++) {
    console.log(chalk.gray(`  Worker ${i + 1}:`));
    if (i === 0) {
      console.log(chalk.cyan(`    claude`));
    } else {
      const archetypes = ['detective', 'architect', 'craftsman', 'explorer'];
      const arch = archetypes[i % archetypes.length];
      console.log(chalk.cyan(`    worktree split ${branchName.split('-')[0]}-${branchName.split('-')[1]} --archetype ${arch}`));
    }
  }

  console.log();
  console.log(
    chalk.gray(
      'Workers can coordinate through WORKTREE_COORDINATION.md'
    )
  );
}
