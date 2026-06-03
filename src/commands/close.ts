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
    const tmux = getTerminalManager(config.getWorktreeSessionName(issueNumber));

    if (!tmux.hasSession()) {
      console.log(chalk.yellow(`No session found for issue #${issueNumber}`));
      process.exit(0);
    }

    spinner.start(`Closing session for issue #${issueNumber}...`);
    if (tmux.killSession) tmux.killSession();
    spinner.succeed(`Closed session for issue #${issueNumber}`);

    const worktrees = git.listWorktrees();
    const worktree = worktrees.find(wt =>
      wt.branch.includes(`issue-${issueNumber}`) ||
      wt.path.includes(`issue-${issueNumber}`)
    );

    if (worktree) {
      console.log(chalk.gray(`Worktree retained at: ${worktree.path}`));
      console.log(chalk.gray(`Reopen with: wt open ${issueNumber}`));
    }

    console.log(chalk.green(`\n✓ Closed session for issue #${issueNumber}`));

  } catch (error: any) {
    spinner.fail();
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
