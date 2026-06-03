import chalk from 'chalk';
import * as readline from 'readline';
import { GitOperations } from '../core/git.js';
import { getTerminalManager } from '../core/terminal-factory.js';
import { ConfigManager } from '../core/config.js';
import { ARCHETYPES, Archetype, resolveArchetype } from '../core/archetypes.js';
import { WorktreeEngine } from '../core/engine.js';
import { CliLogger } from '../lib/cli-logger.js';

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
  const logger = new CliLogger();
  const git = new GitOperations();
  const config = new ConfigManager(git.repoRoot);
  const engine = new WorktreeEngine((sessionName) => getTerminalManager(sessionName), logger, git, config);

  try {
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

    await engine.split(issueNumber, {
      vertical: options?.vertical,
      archetype
    });

    if (options?.focus) {
      getTerminalManager(config.getWorktreeSessionName(issueNumber)).switchToWindow(`issue-${issueNumber}`);
    }

  } catch (error: any) {
    logger.error(`Error: ${error.message}`, error);
    process.exit(1);
  }
}
