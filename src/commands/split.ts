import chalk from 'chalk';
import * as readline from 'readline';
import { GitOperations } from '../lib/git';
import { TmuxOperations } from '../lib/tmux';
import { ConfigManager } from '../lib/config';
import { ARCHETYPES, Archetype, getArchetypeById, getDefaultArchetypeForWorker } from '../lib/archetypes';
import { generateWorkerPrompt } from '../templates/coordination.md';

interface SplitOptions {
  vertical?: boolean;
  focus?: boolean;
  archetype?: string;
  wizard?: boolean;  // --no-wizard sets this to false
}

async function selectArchetype(workerNumber: number): Promise<Archetype> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(chalk.cyan(`\nSelect archetype for Worker ${workerNumber}:`));
  ARCHETYPES.forEach((arch, index) => {
    console.log(`${index + 1}) ${arch.emoji}  ${arch.name} - ${arch.shortDescription}`);
  });

  const max = ARCHETYPES.length;
  return new Promise((resolve) => {
    const ask = () => {
      rl.question(chalk.yellow(`Choice (1-${max}): `), (answer) => {
        const choice = parseInt(answer);
        if (choice >= 1 && choice <= max) {
          const archetype = ARCHETYPES[choice - 1];
          console.log(chalk.green(`✓ Worker ${workerNumber} assigned as ${archetype.name}`));
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

export async function splitCommand(issueNumber: string, options: SplitOptions): Promise<void> {
  try {
    const git = new GitOperations();
    const config = new ConfigManager(git.repoRoot);
    const tmux = new TmuxOperations(config.getSessionName());

    const worktrees = git.listWorktrees();
    const worktree = worktrees.find(wt =>
      wt.branch.includes(`issue-${issueNumber}`) ||
      wt.path.includes(`issue-${issueNumber}`)
    );

    if (!worktree) {
      console.error(chalk.red(`Error: No worktree found for issue #${issueNumber}`));
      console.log(chalk.gray(`\nRun 'wt open ${issueNumber}' to create the worktree first`));
      process.exit(1);
    }

    const windowName = `issue-${issueNumber}`;

    if (!tmux.hasWindow(windowName)) {
      console.error(chalk.red(`Error: No tmux window found for issue #${issueNumber}`));
      console.log(chalk.gray(`\nRun 'wt open ${issueNumber}' to create the window first`));
      process.exit(1);
    }

    console.log(chalk.blue(`✓ Found worktree: ${worktree.path}`));

    // Resolve archetype: explicit flag > wizard > default
    const existingPanes = tmux.countPanes(windowName);
    const workerNumber = existingPanes + 1;

    let archetype: Archetype | undefined;
    if (options.archetype) {
      archetype = getArchetypeById(options.archetype.toLowerCase());
      if (!archetype) {
        console.error(chalk.red(`Error: Unknown archetype "${options.archetype}"`));
        console.log(chalk.gray(`Valid options: ${ARCHETYPES.map(a => a.id).join(', ')}`));
        process.exit(1);
      }
      console.log(chalk.green(`✓ Worker ${workerNumber} assigned as ${archetype.name}`));
    } else if (options.wizard !== false) {
      archetype = await selectArchetype(workerNumber);
    } else {
      archetype = getDefaultArchetypeForWorker(workerNumber);
      console.log(chalk.green(`✓ Worker ${workerNumber} assigned as ${archetype.name} (default)`));
    }

    const splitType = options.vertical ? 'vertically' : 'horizontally';
    console.log(chalk.blue(`✓ Splitting current pane ${splitType}...`));

    // Generate coordination-aware prompt for this worker
    const prompt = generateWorkerPrompt(workerNumber, workerNumber, issueNumber, archetype);
    console.log(chalk.gray(`\nWorker ${workerNumber} prompt:`));
    console.log(chalk.gray(prompt));

    tmux.launchClaudeInPaneWithPrompt(
      windowName,
      worktree.path,
      prompt,
      options.vertical || false,
      workerNumber
    );

    if (options.focus) {
      console.log(chalk.gray('(New pane has focus)'));
    }

    console.log(chalk.green('\n✓ Claude Code launched in new pane'));

  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
