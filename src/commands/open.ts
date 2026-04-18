import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { GitOperations } from '../lib/git.js';
import { getTicketOperations } from '../lib/ticketing.js';
import { TmuxOperations } from '../lib/tmux.js';
import { ConfigManager } from '../lib/config.js';
import { generateClaudeMd, ensureGitignore } from '../templates/claude.md.js';
import { generateCoordinationMd, generateWorkerPrompt } from '../templates/coordination.md.js';
import { generateOverseerMd, generateOverseerPrompt } from '../templates/overseer.md.js';
import { ARCHETYPES, Archetype, getDefaultArchetypeForWorker } from '../lib/archetypes.js';
import * as readline from 'readline';

interface OpenOptions {
  workers?: string;
  watcher?: boolean;
  wizard?: boolean;  // Note: --no-wizard sets this to false
}

async function selectArchetype(workerNumber: number): Promise<Archetype> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(chalk.cyan(`\nSelect archetype for Worker ${workerNumber}:`));
  ARCHETYPES.forEach((arch, index) => {
    console.log(`${index + 1}) ${arch.emoji}  ${arch.name} - ${arch.shortDescription}`);
  });

  const max = ARCHETYPES.length;
  return new Promise((resolve) => {
    const askQuestion = () => {
      rl.question(chalk.yellow(`Choice (1-${max}): `), (answer) => {
        const choice = parseInt(answer);
        if (choice >= 1 && choice <= max) {
          const archetype = ARCHETYPES[choice - 1];
          console.log(chalk.green(`✓ Worker ${workerNumber} assigned as ${archetype.name}`));
          rl.close();
          resolve(archetype);
        } else {
          console.log(chalk.red(`Invalid choice. Please select 1-${max}.`));
          askQuestion();
        }
      });
    };
    askQuestion();
  });
}

export async function openCommand(issueNumber: string, description?: string, options?: OpenOptions): Promise<void> {
  const spinner = ora();

  // Initialize operations
  const git = new GitOperations();
  const config = new ConfigManager(git.repoRoot);
  const provider = config.getTicketingProvider();
  const tickets = await getTicketOperations(provider);
  const tmux = new TmuxOperations(config.getSessionName());
  const providerLabel = provider === 'linear' ? 'Linear' : 'GitHub';

  const workerCount = options?.workers !== undefined
    ? parseInt(options.workers, 10)
    : config.getDefaultWorkers();

  if (workerCount < 1 || workerCount > 5) {
    console.error(chalk.red('Error: Workers must be between 1 and 5'));
    process.exit(1);
  }

  try {

    if (!config.hasTicketingProvider()) {
      console.log(chalk.yellow(`⚠️  No "ticketing" field in .worktree.yml — defaulting to ${providerLabel}. Run \`wt init\` to change.`));
    } else {
      console.log(chalk.gray(`Ticketing provider: ${providerLabel}`));
    }
    
    // Check if worktree already exists
    const worktreePath = git.getWorktreePath(issueNumber, description);
    const windowName = `issue-${issueNumber}`;
    
    if (git.worktreeExists(worktreePath)) {
      console.log(chalk.yellow(`⚠️  Worktree already exists at: ${worktreePath}`));
      
      // Check if tmux window exists
      if (tmux.hasWindow(windowName)) {
        console.log(chalk.yellow(`⚠️  Window '${windowName}' already exists in session '${config.getSessionName()}'`));
        console.log(chalk.blue('→ Switching to existing window...'));
        
        const windows = tmux.listWindows();
        const window = windows.find(w => w.name === windowName);
        if (window) {
          tmux.openITerm(window.index, config.getItermOpenMode(), config.getItermFocus());
          tmux.switchToWindow(windowName);
        }
        
        console.log(chalk.gray('\n💡 Tip: To open another Claude instance for this issue:'));
        console.log(chalk.gray(`   wt split ${issueNumber}         # Split current pane`));
        console.log(chalk.gray(`   wt split ${issueNumber} -v      # Split vertically`));
        
        return;
      }
    } else {
      // Create worktree
      spinner.start(`Creating worktree for issue #${issueNumber}...`);
      git.createWorktree(issueNumber, description);
      spinner.succeed(`Created worktree at: ${worktreePath}`);
    }
    
    // Fetch issue details from the configured provider
    spinner.start(`Fetching issue details from ${providerLabel}...`);
    const issue = await tickets.fetchIssue(issueNumber);
    if (issue) {
      spinner.succeed(`Fetched issue details from ${providerLabel}`);
    } else {
      spinner.fail(`${providerLabel} issue ${issueNumber} not found`);
      console.error(chalk.red(`\n❌ Error: Issue must exist on ${providerLabel} before creating a worktree`));
      if (provider === 'github') {
        console.log(chalk.gray('Create the issue first with: gh issue create'));
      } else {
        console.log(chalk.gray('Ensure LINEAR_API_KEY is set and the identifier (e.g. LIN-123) is correct'));
      }
      process.exit(1);
    }
    
    // Generate CLAUDE.md
    const claudeContent = generateClaudeMd({
      issueNumber,
      branchName: git.createBranchName(issueNumber, description),
      issue: issue || undefined,
      provider,
      projectName: config.getProjectName(),
      customContext: config.getClaudeContext(),
      commands: config.getCommands()
    });
    
    const claudePath = path.join(worktreePath, 'CLAUDE.md');
    writeFileSync(claudePath, claudeContent);
    console.log(chalk.green('✓ Created CLAUDE.md with issue context'));
    
    // Store coordination path for later use
    const coordinationPath = path.join(worktreePath, 'WORKTREE_COORDINATION.md');
    
    // Create OVERSEER.md if watcher option is enabled
    if (options?.watcher) {
      const overseerContent = generateOverseerMd({
        issueNumber,
        issueTitle: issue.title,
        timestamp: new Date().toISOString()
      });
      
      const overseerPath = path.join(worktreePath, 'OVERSEER.md');
      writeFileSync(overseerPath, overseerContent);
      console.log(chalk.green('✓ Created OVERSEER.md for progress monitoring'));
    }
    
    // Ensure CLAUDE.md, WORKTREE_COORDINATION.md, and OVERSEER.md are in .gitignore
    ensureGitignore(worktreePath);
    console.log(chalk.green('✓ Added context files to .gitignore'));
    
    // Run setup commands if any
    const setupCommands = config.getSetupCommands();
    if (setupCommands.length > 0) {
      console.log(chalk.blue('\nRunning setup commands...'));
      for (const command of setupCommands) {
        spinner.start(`Running: ${command}`);
        try {
          execSync(command, { cwd: worktreePath, stdio: 'ignore' });
          spinner.succeed(`Completed: ${command}`);
        } catch (error) {
          spinner.fail(`Failed: ${command}`);
        }
      }
    }
    
    // Launch Claude workers
    if (workerCount === 1) {
      console.log(chalk.blue('\nOpening Claude Code...'));
      const singleWorkerPrompt = `Solve the issue described in CLAUDE.md`;
      console.log(chalk.gray('\nPrompt:'));
      console.log(chalk.gray(singleWorkerPrompt));
      tmux.launchClaude(windowName, worktreePath, issueNumber);
    } else {
      console.log(chalk.blue(`\nOpening ${workerCount} Claude workers...`));
      
      // Store selected archetypes for coordination file
      const workerArchetypes: { [key: number]: Archetype } = {};
      
      // Get archetypes for workers 2+
      if (options?.wizard !== false && workerCount > 1) {
        // Interactive wizard mode
        for (let i = 2; i <= workerCount; i++) {
          workerArchetypes[i] = await selectArchetype(i);
        }
      } else if (workerCount > 1) {
        // No-wizard mode: use defaults
        console.log(chalk.gray('Using default archetype assignments...\n'));
        for (let i = 2; i <= workerCount; i++) {
          workerArchetypes[i] = getDefaultArchetypeForWorker(i);
          console.log(chalk.green(`✓ Worker ${i} assigned as ${workerArchetypes[i].name}`));
        }
      }
      
      // Create/update coordination file with archetypes
      if (workerCount > 1) {
        const coordinationContent = generateCoordinationMd({
          issueNumber,
          issueTitle: issue.title,
          issueBody: issue.body,
          workerCount,
          timestamp: new Date().toISOString(),
          workerArchetypes
        });
        
        writeFileSync(coordinationPath, coordinationContent);
        console.log(chalk.green('✓ Created WORKTREE_COORDINATION.md with worker archetypes'));
      }
      
      // Launch first worker in main window
      const worker1Prompt = generateWorkerPrompt(1, workerCount, issueNumber);
      console.log(chalk.gray('\nWorker 1 prompt:'));
      console.log(chalk.gray(worker1Prompt));
      tmux.launchClaudeWithPrompt(
        windowName, 
        worktreePath, 
        worker1Prompt
      );
      
      // Launch additional workers in split panes
      for (let i = 2; i <= workerCount; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between splits
        const vertical = i % 2 === 0; // Alternate between horizontal and vertical splits
        const archetype = workerArchetypes[i];
        const workerPrompt = generateWorkerPrompt(i, workerCount, issueNumber, archetype);
        console.log(chalk.gray(`\nWorker ${i} prompt:`));
        console.log(chalk.gray(workerPrompt));
        tmux.launchClaudeInPaneWithPrompt(
          windowName,
          worktreePath,
          workerPrompt,
          vertical,
          i
        );
      }
    }
    
    // Launch watcher if requested
    if (options?.watcher) {
      console.log(chalk.blue('\nSpawning Overseer worker...'));
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Always use vertical split for the watcher to keep it separate
      const overseerPrompt = generateOverseerPrompt(issueNumber);
      console.log(chalk.gray('\nOverseer prompt:'));
      console.log(chalk.gray(overseerPrompt));
      tmux.launchClaudeInPaneWithPrompt(
        windowName,
        worktreePath,
        overseerPrompt,
        true,  // vertical split
        0      // Special worker number 0 for overseer
      );
    }
    
    // Apply tmux layout if configured (and we have multiple panes)
    const layout = config.getLayout();
    const totalPanes = workerCount + (options?.watcher ? 1 : 0);
    if (layout && totalPanes > 1) {
      tmux.selectLayout(windowName, layout);
      console.log(chalk.gray(`Applied tmux layout: ${layout}`));
    }

    // Open iTerm
    const windows = tmux.listWindows();
    const window = windows.find(w => w.name === windowName);
    if (window) {
      tmux.openITerm(window.index, config.getItermOpenMode(), config.getItermFocus());
    }
    
    console.log(chalk.green('\n✓ Claude Code launched successfully'));
    console.log(chalk.gray(`\nSession: ${config.getSessionName()}`));
    console.log(chalk.gray(`Window: ${windowName}`));
    console.log(chalk.gray(`Worktree: ${worktreePath}`));
    
  } catch (error: any) {
    spinner.fail();
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}