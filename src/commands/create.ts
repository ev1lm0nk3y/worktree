import chalk from 'chalk';
import { GitOperations } from '../core/git.js';
import { getTerminalManager } from '../core/terminal-factory.js';
import { ConfigManager } from '../core/config.js';
import { WorktreeEngine } from '../core/engine.js';
import { CliLogger } from '../lib/cli-logger.js';
import * as readline from 'readline';

async function promptForTopic(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(chalk.yellow('What do you want to build or change? (brief description): '), (answer) => {
      rl.close();
      resolve(answer.trim() || 'new-task');
    });
  });
}

export async function createCommand(topic?: string): Promise<void> {
  const logger = new CliLogger();
  const git = new GitOperations();
  const config = new ConfigManager(git.repoRoot);
  const engine = new WorktreeEngine((sessionName) => getTerminalManager(sessionName), logger, git, config);

  try {
    const resolvedTopic = topic || await promptForTopic();
    await engine.create(resolvedTopic);
  } catch (error: any) {
    logger.error(`Error: ${error.message}`, error);
    process.exit(1);
  }
}
