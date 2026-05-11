import chalk from 'chalk';
import ora from 'ora';
import { GitOperations } from '../lib/git.js';
import { TmuxOperations } from '../lib/tmux.js';
import { ConfigManager } from '../lib/config.js';

export async function closeCommand(issueNumber: string): Promise<void> {
  const spinner = ora();

  try {
    const git = new GitOperations();
    const config = new ConfigManager(git.repoRoot);
    const tmux = new TmuxOperations(config.getSessionName());

    const windowName = `issue-${issueNumber}`;

    if (!tmux.hasWindow(windowName)) {
      console.log(chalk.yellow(`No tmux window '${windowName}' found in session '${config.getSessionName()}'`));
      process.exit(0);
    }

    spinner.start(`Closing tmux window '${windowName}'...`);
    tmux.closeWindow(windowName);
    spinner.succeed(`Closed tmux window '${windowName}'`);

    const worktrees = git.listWorktrees();
    const worktree = worktrees.find(wt =>
      wt.branch.includes(`issue-${issueNumber}`) ||
      wt.path.includes(`issue-${issueNumber}`)
    );

    if (worktree) {
      console.log(chalk.gray(`Worktree retained at: ${worktree.path}`));
      console.log(chalk.gray(`Reopen with: wt open ${issueNumber}`));
    }

    const remainingWindows = tmux.listWindows();
    if (remainingWindows.length === 0 && tmux.hasSession()) {
      tmux.cleanupMarkerFile();
    }

    console.log(chalk.green(`\n✓ Closed tmux session for issue #${issueNumber}`));

  } catch (error: any) {
    spinner.fail();
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
