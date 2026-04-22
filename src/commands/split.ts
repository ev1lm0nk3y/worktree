import chalk from 'chalk';
import * as readline from 'readline';
import { GitOperations } from '../lib/git.js';
import { TmuxOperations } from '../lib/tmux.js';
import { ConfigManager } from '../lib/config.js';
import { ARCHETYPES, Archetype, getArchetypeById } from '../lib/archetypes.js';
import { generateWorkerPrompt } from '../templates/coordination.md.js';

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

  let archetype: Archetype | undefined;
  if (options?.archetype) {
    archetype = getArchetypeById(options.archetype);
    if (!archetype) {
      console.error(chalk.red(`Invalid archetype: ${options.archetype}`));
      console.error(chalk.gray(`Valid: ${ARCHETYPES.map(a => a.id).join(', ')}`));
      process.exit(1);
    }
    console.log(chalk.green(`✓ Archetype: ${archetype.emoji} ${archetype.name}`));
  } else if (options?.wizard !== false) {
    archetype = await selectArchetype();
  }

  const paneCount = tmux.hasWindow(windowName) ? 1 : 0;
  const workerNumber = paneCount + 1;
  const vertical = options?.vertical ?? (workerNumber % 2 !== 0);

  const prompt = generateWorkerPrompt(workerNumber, workerNumber, issueNumber, archetype);
  console.log(chalk.gray('\nPrompt:'));
  console.log(chalk.gray(prompt));

  tmux.launchClaudeInPaneWithPrompt(windowName, worktreePath, prompt, vertical, workerNumber);

  if (options?.focus) {
    tmux.switchToWindow(windowName);
  }
}
