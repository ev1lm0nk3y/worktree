#!/usr/bin/env node

import { Command } from 'commander';
import { openCommand } from './commands/open.js';
import { createCommand } from './commands/create.js';
import { splitCommand } from './commands/split.js';
import { listCommand } from './commands/list.js';
import { removeCommand } from './commands/remove.js';
import { initCommand } from './commands/init.js';
import { tldrCommand } from './commands/tldr.js';

const program = new Command();

program
  .name('worktree')
  .description('CLI tool for managing Git worktrees with GitHub issues and Claude Code integration')
  .version('0.5.0');

program
  .command('open <issue-number> [description]')
  .description('Create or switch to a worktree for a GitHub issue')
  .option('-w, --workers <number>', 'Number of Claude workers to spawn (default: 1)')
  .option('--deploy-pool [name]', 'Deploy a pre-configured worker pool (interactive selection if no name given)')
  .option('--watcher', 'Spawn an additional overseer worker to monitor progress')
  .option('--no-wizard', 'Skip archetype selection wizard and use defaults')
  .action(openCommand);

program
  .command('create [topic]')
  .description('Start a new worktree without a ticket using a Guide to help define the task')
  .action(createCommand);

program
  .command('split <issue-number>')
  .description('Split current tmux pane with new Claude instance')
  .option('-v, --vertical', 'Split vertically instead of horizontally')
  .option('-f, --focus', 'Focus the new pane after creation')
  .option('-a, --archetype <id>', 'Assign archetype role: architect|detective|craftsman|explorer|aesthete|adversary')
  .option('--no-wizard', 'Skip the archetype selection wizard')
  .action(splitCommand);

program
  .command('list')
  .description('List all worktrees and their status')
  .action(listCommand);

program
  .command('remove <issue-number>')
  .alias('rm')
  .description('Remove a worktree and close its tmux window')
  .action(removeCommand);

program
  .command('init')
  .description('Initialize worktree configuration for current repository')
  .action(initCommand);

program
  .command('tldr')
  .description('Show quick examples and common usage patterns')
  .action(tldrCommand);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}