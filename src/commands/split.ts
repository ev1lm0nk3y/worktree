import chalk from 'chalk';
import * as readline from 'readline';
import { existsSync, appendFileSync } from 'fs';
import path from 'path';
import { GitOperations } from '../lib/git.js';
import { TmuxOperations, ClaudeInstanceConfig } from '../lib/tmux.js';
import { ConfigManager } from '../lib/config.js';
import { ARCHETYPES, Archetype, resolveArchetype } from '../lib/archetypes.js';
import { generateWorkerPrompt, generateNewWorkerEntry, generateAdversaryAlert, generateAdversaryBroadcast } from '../templates/coordination.md.js';
import { addWorker, getRegisteredPaneIds } from '../lib/worker-registry.js';

interface SplitOptions {
  vertical?: boolean;
  focus?: boolean;
  archetype?: string;
  wizard?: boolean;
}

async function selectArchetype(): Promise<Archetype> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(chalk.cyan('\nSelect archetype for the new worker:'));
  ARCHETYPES.forEach((arch, index) => {
    console.log(`${index + 1}) ${arch.emoji}  ${arch.name} - ${arch.shortDescription}`);
  });

  const max = ARCHETYPES.length;
  return new Promise((resolve) => {
    const ask = () => {
      rl.question(chalk.yellow(`Choice (1-${max}): `), (answer) => {
        const choice = parseInt(answer, 10);
        if (choice >= 1 && choice <= max) {
          const archetype = ARCHETYPES[choice - 1];
          console.log(chalk.green(`✓ Assigned as ${archetype.name}`));
          rl.close();
          resolve(archetype);
        } else {
          console.log(chalk.red(`Invalid choice. Please select 1-${max}.`));
          ask();
        }
      });
    };
    ask();
  });
}

export async function splitCommand(issueNumber: string, options?: SplitOptions): Promise<void> {
  const git = new GitOperations();
  const config = new ConfigManager(git.repoRoot);
  const tmux = new TmuxOperations(config.getSessionName());
  const windowName = `issue-${issueNumber}`;

  if (!tmux.hasWindow(windowName)) {
    console.error(chalk.red(`Error: No tmux window '${windowName}' in session '${config.getSessionName()}'.`));
    console.error(chalk.gray(`Run: wt open ${issueNumber}  first.`));
    process.exit(1);
  }

  const worktrees = git.listWorktrees();
  const match = worktrees.find(w => w.path.includes(`issue-${issueNumber}`));
  if (!match) {
    console.error(chalk.red(`Error: No worktree found for issue ${issueNumber}.`));
    process.exit(1);
  }
  const worktreePath = match.path;
  const coordinationPath = path.join(worktreePath, 'WORKTREE_COORDINATION.md');

  let archetype: Archetype | undefined;
  if (options?.archetype) {
    archetype = resolveArchetype(options.archetype);
    if (!archetype) {
      console.log(chalk.yellow(`⚠️  Could not match archetype "${options.archetype}" — select one below:`));
      archetype = await selectArchetype();
    } else {
      console.log(chalk.green(`✓ Archetype: ${archetype.emoji} ${archetype.name}`));
    }
  } else if (options?.wizard !== false) {
    archetype = await selectArchetype();
  }

  // Read existing pane IDs from the registry before adding the new worker
  const existingPaneIds = archetype?.id === 'adversary' ? getRegisteredPaneIds(worktreePath) : [];

  const paneCount = tmux.countPanes(windowName);
  const workerNumber = paneCount + 1;
  const vertical = options?.vertical ?? (workerNumber % 2 !== 0);

  // Update WORKTREE_COORDINATION.md with the new worker entry
  if (existsSync(coordinationPath)) {
    const isAdversary = archetype?.id === 'adversary';
    const workerEntry = generateNewWorkerEntry(workerNumber, archetype);
    const adversaryAlert = isAdversary ? generateAdversaryAlert(workerNumber) : '';
    appendFileSync(coordinationPath, workerEntry + adversaryAlert, 'utf8');
    console.log(chalk.green(`✓ Updated WORKTREE_COORDINATION.md with Worker ${workerNumber}`));
    if (isAdversary) {
      console.log(chalk.yellow('⚔️  Adversary alert written — existing workers will be notified'));
    }
  }

  const prompt = generateWorkerPrompt(workerNumber, workerNumber, issueNumber, archetype);
  console.log(chalk.gray('\nPrompt:'));
  console.log(chalk.gray(prompt));

  const instanceConfig: ClaudeInstanceConfig | undefined = archetype
    ? { instanceName: `${archetype.emoji} ${archetype.name}`, color: archetype.color }
    : undefined;
  const newPaneId = tmux.launchClaudeInPaneWithPrompt(windowName, worktreePath, prompt, vertical, workerNumber, instanceConfig);
  addWorker(worktreePath, issueNumber, workerNumber, newPaneId, archetype?.id ?? 'unknown');

  // Broadcast Adversary notification to all pre-existing panes
  if (archetype?.id === 'adversary' && existingPaneIds.length > 0) {
    const broadcastMessage = generateAdversaryBroadcast(issueNumber);
    // Delay until after the new pane's Claude has started initialising, so the
    // broadcasts don't race with the split-window terminal resize events.
    setTimeout(() => {
      console.log(chalk.yellow(`⚔️  Broadcasting Adversary alert to ${existingPaneIds.length} existing worker(s)...`));
      for (const paneId of existingPaneIds) {
        tmux.broadcastToPane(paneId, broadcastMessage);
      }
    }, 2000);
  }

  if (options?.focus) {
    tmux.switchToWindow(windowName);
  }
}
