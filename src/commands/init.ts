import chalk from 'chalk';
import * as readline from 'readline';
import { GitOperations } from '../lib/git.js';
import { ConfigManager } from '../lib/config.js';
import { TicketProvider } from '../lib/ticketing.js';

async function promptTicketingProvider(): Promise<TicketProvider> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(chalk.cyan('\nWhich ticketing system does this repo use?'));
  console.log('1) GitHub Issues (requires: gh CLI)');
  console.log('2) Linear (requires: LINEAR_API_KEY env var)');

  return new Promise((resolve) => {
    const ask = () => {
      rl.question(chalk.yellow('Choice (1-2) [1]: '), (answer) => {
        const choice = answer.trim() || '1';
        if (choice === '1') {
          rl.close();
          resolve('github');
        } else if (choice === '2') {
          rl.close();
          resolve('linear');
        } else {
          console.log(chalk.red('Invalid choice. Please select 1 or 2.'));
          ask();
        }
      });
    };
    ask();
  });
}

export async function initCommand(): Promise<void> {
  try {
    const git = new GitOperations();
    const config = new ConfigManager(git.repoRoot);

    if (config.exists()) {
      const current = config.hasTicketingProvider() ? config.getTicketingProvider() : 'unset';
      console.log(chalk.yellow('⚠️  .worktree.yml already exists'));
      console.log(chalk.gray(`   Path: ${git.repoRoot}/.worktree.yml`));
      console.log(chalk.gray(`   Current ticketing: ${current}`));
      const provider = await promptTicketingProvider();
      config.setTicketingProvider(provider);
      console.log(chalk.green(`✓ Updated ticketing provider to ${provider}`));
      return;
    }

    console.log(chalk.blue('Initializing worktree configuration...'));

    const provider = await promptTicketingProvider();
    config.createDefaultConfig(provider);

    console.log(chalk.green('\n✓ Configuration created successfully!'));
    console.log(chalk.gray('\nDetected project information:'));
    console.log(chalk.gray(`  Project:   ${config.getProjectName()}`));
    console.log(chalk.gray(`  Session:   ${config.getSessionName()}`));
    console.log(chalk.gray(`  Ticketing: ${provider}`));

    const commands = config.getCommands();
    if (commands && Object.keys(commands).length > 0) {
      console.log(chalk.gray('\nDetected commands:'));
      for (const [name, command] of Object.entries(commands)) {
        if (command) {
          console.log(chalk.gray(`  ${name}: ${command}`));
        }
      }
    }

    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('1. Edit .worktree.yml to add project-specific context'));
    if (provider === 'linear') {
      console.log(chalk.gray('2. Export LINEAR_API_KEY in your shell (https://linear.app/settings/api)'));
      console.log(chalk.gray('3. Run `wt open <TEAM-123>` to create your first worktree'));
    } else {
      console.log(chalk.gray('2. Run `wt open <issue-number>` to create your first worktree'));
    }

  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
