import { GitOperations } from '../core/git.js';
import { getTerminalManager } from '../core/terminal-factory.js';
import { ConfigManager } from '../core/config.js';
import { existsSync, statSync } from 'fs';
import path from 'path';

export async function listCommand(): Promise<void> {
  try {
    const git = new GitOperations();
    const config = new ConfigManager(git.repoRoot);

    const worktrees = git.listWorktrees();

    if (worktrees.length === 0) {
      console.log('No worktrees found');
      return;
    }

    console.log('\nWorktrees:\n');

    let liveSessions = 0;
    let totalWorktrees = 0;

    for (const worktree of worktrees) {
      if (worktree.path === git.repoRoot) continue;
      totalWorktrees++;

      const issueMatch = worktree.branch.match(/issue-(\d+)/);
      const issueNumber = issueMatch ? issueMatch[1] : null;

      const terminal = issueNumber
        ? getTerminalManager(config.getWorktreeSessionName(issueNumber))
        : null;
      const isLive = terminal ? terminal.hasSession() : false;
      if (isLive) liveSessions++;

      const paneCount = isLive && terminal?.countPanes && issueNumber
        ? terminal.countPanes(`issue-${issueNumber}`)
        : 0;

      let lastModified = 'Unknown';
      const claudePath = path.join(worktree.path, 'WORKTREE_TICKET.md');
      if (existsSync(claudePath)) {
        const stats = statSync(claudePath);
        const now = new Date();
        const diff = now.getTime() - stats.mtime.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (days > 0) lastModified = `${days}d ago`;
        else if (hours > 0) lastModified = `${hours}h ago`;
        else lastModified = 'Recently';
      }

      const status = issueNumber ? `Issue #${issueNumber}` : worktree.branch;

      let tmuxStatus = 'No session';
      if (isLive) {
        tmuxStatus = 'Session active';
        if (paneCount > 1) tmuxStatus += ` [${paneCount} panes]`;
      }

      console.log(`${status} - ${path.basename(worktree.path)}`);
      console.log(`  Path: ${worktree.path}`);
      console.log(`  Tmux: ${tmuxStatus}`);
      console.log(`  Modified: ${lastModified}`);
      console.log('');
    }

    console.log(`Active sessions: ${liveSessions} / ${totalWorktrees}`);

  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}