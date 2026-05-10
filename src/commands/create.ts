import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync } from 'fs';
import path from 'path';
import { GitOperations } from '../lib/git.js';
import { TmuxOperations } from '../lib/tmux.js';
import { ConfigManager } from '../lib/config.js';
import { generateClaudeMd, ensureGitignore } from '../templates/claude.md.js';
import { getArchetypeById } from '../lib/archetypes.js';
import * as readline from 'readline';

async function promptForTopic(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(chalk.yellow('What are you working on today? (short topic for branch name): '), (answer) => {
      rl.close();
      resolve(answer.trim() || 'new-feature');
    });
  });
}

export async function createCommand(topic?: string): Promise<void> {
  const spinner = ora();

  // Initialize operations
  const git = new GitOperations();
  const config = new ConfigManager(git.repoRoot);
  const tmux = new TmuxOperations(config.getSessionName());

  try {
    // 1. Get topic for branch name if not provided
    const resolvedTopic = topic || await promptForTopic();
    const slugifiedTopic = resolvedTopic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const issueNumber = `dynamic-${slugifiedTopic}`;
    const worktreePath = git.getWorktreePath(issueNumber, resolvedTopic);
    const windowName = `issue-${issueNumber}`;

    // 2. Check if worktree already exists
    if (git.worktreeExists(worktreePath)) {
      console.log(chalk.yellow(`⚠️  Worktree already exists at: ${worktreePath}`));
      if (tmux.hasWindow(windowName)) {
        console.log(chalk.blue('→ Switching to existing window...'));
        tmux.switchToWindow(windowName);
        return;
      }
    }

    // 3. Create worktree
    spinner.start(`Creating worktree for topic: ${resolvedTopic}...`);
    // Note: We need a custom version of createWorktree or handle branch creation manually here
    // since GitOperations.createWorktree usually expects an issueNumber for the branch name.
    // For now, let's assume we can pass the branchName directly or adapt the lib.
    
    // We'll use a slightly different approach: manually run the git commands if the lib doesn't support custom branch names.
    // But looking at GitOperations, let's see if we can use it.
    git.createWorktree(issueNumber, resolvedTopic);
    spinner.succeed(`Created worktree at: ${worktreePath}`);

    // 4. Generate CLAUDE.md (minimal version since no ticket exists)
    const claudeContent = generateClaudeMd({
      issueNumber,
      branchName: git.createBranchName(issueNumber, resolvedTopic),
      issue: {
        identifier: issueNumber,
        title: resolvedTopic,
        body: 'Dynamic task created via `wt create`. Use The Guide to define requirements.',
        url: '',
        labels: [],
        state: 'open'
      },
      provider: 'github', // default
      projectName: config.getProjectName(),
      customContext: config.getClaudeContext(),
      commands: config.getCommands()
    });

    const claudePath = path.join(worktreePath, 'CLAUDE.md');
    writeFileSync(claudePath, claudeContent);
    console.log(chalk.green('✓ Created CLAUDE.md'));

    // 5. Ensure .gitignore
    ensureGitignore(worktreePath);
    console.log(chalk.green('✓ Added context files to .gitignore'));

    // 6. Launch The Guide
    const guideArchetype = getArchetypeById('guide');
    if (!guideArchetype) {
        throw new Error('Guide archetype not found');
    }

    console.log(chalk.blue('\nOpening The Guide...'));
    const guidePrompt = `${guideArchetype.prompt}\n\nObjective: ${resolvedTopic}`;
    
    console.log(chalk.gray('\nPrompt:'));
    console.log(chalk.gray(guidePrompt));

    tmux.launchClaudeWithPrompt(windowName, worktreePath, guidePrompt);

    // 7. Open iTerm
    const windows = tmux.listWindows();
    const window = windows.find(w => w.name === windowName);
    if (window) {
      tmux.openITerm(window.index, config.getItermOpenMode(), config.getItermFocus());
    }

    console.log(chalk.green('\n✓ The Guide has been launched!'));
    console.log(chalk.gray(`\nSession: ${config.getSessionName()}`));
    console.log(chalk.gray(`Window: ${windowName}`));
    console.log(chalk.gray(`Worktree: ${worktreePath}`));

  } catch (error: any) {
    spinner.fail();
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
