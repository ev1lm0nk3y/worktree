import chalk from 'chalk';
import ora from 'ora';
import { GitOperations } from '../core/git.js';
import { getTerminalManager } from '../core/terminal-factory.js';
import { ConfigManager } from '../core/config.js';

export async function removeCommand(issueNumber: string): Promise<void> {
  const spinner = ora();
  
  try {
    const git = new GitOperations();
    const config = new ConfigManager(git.repoRoot);
    const tmux = getTerminalManager(config.getSessionName());
    
    // Find worktree for this issue
    const worktrees = git.listWorktrees();
    const worktree = worktrees.find(wt => 
      wt.branch.includes(`issue-${issueNumber}`) || 
      wt.path.includes(`issue-${issueNumber}`)
    );
    
    if (!worktree) {
      console.error(chalk.red(`Error: No worktree found for issue #${issueNumber}`));
      process.exit(1);
    }
    
    console.log(chalk.blue(`Found worktree: ${worktree.path}`));
    
    // Close tmux window if exists
    const windowName = `issue-${issueNumber}`;
    if (tmux.hasWindow(windowName)) {
      spinner.start(`Closing tmux window '${windowName}'...`);
      tmux.closeWindow(windowName);
      spinner.succeed(`Closed tmux window '${windowName}'`);
    }
    
    // Remove git worktree
    spinner.start('Removing git worktree...');
    git.removeWorktree(worktree.path);
    spinner.succeed('Removed git worktree');
    
    console.log(chalk.green(`\n✓ Successfully removed worktree for issue #${issueNumber}`));
    
    // Check if this was the last window
    const remainingWindows = tmux.listWindows();
    if (remainingWindows.length === 0 && tmux.hasSession()) {
      console.log(chalk.gray('\nNo more windows in session. Session will close automatically.'));
      if (tmux.cleanup) tmux.cleanup();
    }
    
  } catch (error: any) {
    spinner.fail();
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}