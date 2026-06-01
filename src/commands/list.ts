import { GitOperations } from '../core/git.js';
import { getTerminalManager } from '../core/terminal-factory.js';
import { ConfigManager } from '../core/config.js';
import { existsSync, statSync } from 'fs';
import path from 'path';

export async function listCommand(): Promise<void> {
  try {
    const git = new GitOperations();
    const config = new ConfigManager(git.repoRoot);
    const tmux = getTerminalManager(config.getSessionName());

    const worktrees = git.listWorktrees();
    const tmuxWindows = tmux.listWindows();

    if (worktrees.length === 0) {
      console.log('No worktrees found');
      return;
    }

    console.log('\nWorktrees:\n');

    for (const worktree of worktrees) {
      if (worktree.path === git.repoRoot) continue;

      const issueMatch = worktree.branch.match(/issue-(\d+)/);
      const issueNumber = issueMatch ? issueMatch[1] : null;

      const windowName = issueNumber ? `issue-${issueNumber}` : null;
      const hasWindow = windowName ? tmuxWindows.some(w => w.name === windowName) : false;
      const window = hasWindow ? tmuxWindows.find(w => w.name === windowName) : null;

      let lastModified = 'Unknown';
      const claudePath = path.join(worktree.path, 'WORKTREE_TICKET.md');
      if (existsSync(claudePath)) {
        const stats = statSync(claudePath);
        const now = new Date();
        const diff = now.getTime() - stats.mtime.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (days > 0) {
          lastModified = `${days}d ago`;
        } else if (hours > 0) {
          lastModified = `${hours}h ago`;
        } else {
          lastModified = 'Recently';
        }
      }

      const status = issueNumber ? `Issue #${issueNumber}` : worktree.branch;

      let tmuxStatus = 'No window';
      if (hasWindow && window) {
        tmuxStatus = `Window ${window.index}`;
        if (window.active) {
          tmuxStatus += ' (active)';
        }
        if (window.panes > 1) {
          tmuxStatus += ` [${window.panes} panes]`;
        }
      }

      console.log(`${status} - ${path.basename(worktree.path)}`);
      console.log(`  Path: ${worktree.path}`);
      console.log(`  Tmux: ${tmuxStatus}`);
      console.log(`  Modified: ${lastModified}`);
      console.log('');
    }

    if (tmux.hasSession()) {
      console.log(`\nTmux session: ${config.getSessionName()}`);
      console.log(`Active windows: ${tmuxWindows.length}`);
    }

  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}