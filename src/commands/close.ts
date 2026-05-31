import chalk from 'chalk';
import ora from 'ora';
import { GitOperations } from '../core/git.js';
import { ConfigManager } from '../core/config.js';
import { getTerminalManager } from '../core/terminal-factory.js';

export async function closeCommand(issueNumber: string): Promise<void> {
  const spinner = ora();

  try {
    const git = new GitOperations();
    const config = new ConfigManager(git.repoRoot);
    const tmux = getTerminalManager(config.getSessionName());

    const windowName = `issue-${issueNumber}`;

    if (!tmux.hasWindow(windowName)) {
      console.log(chalk.yellow(`No window '${windowName}' found`));
      process.exit(0);
    }

    spinner.start(`Closing window '${windowName}'...`);
    tmux.closeWindow(windowName);
    spinner.succeed(`Closed window '${windowName}'`);

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
      if (tmux.cleanup) tmux.cleanup();
    }

    console.log(chalk.green(`\n✓ Closed session for issue #${issueNumber}`));

  } catch (error: any) {
    spinner.fail();
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
