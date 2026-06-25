import chalk from 'chalk';
import * as readline from 'readline';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, chmodSync } from 'fs';
import path from 'path';
import os from 'os';
import { GitOperations } from '../core/git.js';
import { ConfigManager } from '../core/config.js';
import { TicketProvider } from '../core/ticketing.js';

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

async function promptLinearApiKey(): Promise<string | null> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  // Mask input as it's typed
  const rlAny = rl as any;
  rlAny._writeToOutput = (s: string) => {
    if (s.includes('\n') || s.includes('\r')) {
      process.stdout.write(s);
    } else {
      process.stdout.write('*');
    }
  };

  return new Promise((resolve) => {
    rl.question(chalk.yellow('Paste Linear API key (lin_api_...) [enter to skip]: '), (answer) => {
      rl.close();
      process.stdout.write('\n');
      const trimmed = answer.trim();
      resolve(trimmed ? trimmed : null);
    });
  });
}

function persistLinearApiKey(apiKey: string): string {
  const envDir = path.join(os.homedir(), '.local', 'state', 'linear');
  const envFile = path.join(envDir, 'env');
  const exportLine = `export LINEAR_API_KEY=${apiKey}`;

  mkdirSync(envDir, { recursive: true });

  if (existsSync(envFile)) {
    const content = readFileSync(envFile, 'utf8');
    if (content.includes('LINEAR_API_KEY=')) {
      const updated = content.replace(/^export LINEAR_API_KEY=.*$/m, exportLine);
      writeFileSync(envFile, updated);
    } else {
      appendFileSync(envFile, (content.endsWith('\n') ? '' : '\n') + exportLine + '\n');
    }
  } else {
    writeFileSync(envFile, exportLine + '\n');
  }

  try { chmodSync(envFile, 0o600); } catch { /* best effort */ }
  return envFile;
}

function loadLinearApiKeyFromFile(): string | null {
  const envFile = path.join(os.homedir(), '.local', 'state', 'linear', 'env');
  if (!existsSync(envFile)) return null;
  try {
    const content = readFileSync(envFile, 'utf8');
    const match = content.match(/^\s*(?:export\s+)?LINEAR_API_KEY\s*=\s*["']?([^"'\n]+?)["']?\s*$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

async function ensureLinearApiKey(): Promise<void> {
  if (process.env.LINEAR_API_KEY) {
    console.log(chalk.green('✓ LINEAR_API_KEY is set in your environment'));
    return;
  }

  const cachedKey = loadLinearApiKeyFromFile();
  if (cachedKey) {
    const envFile = path.join(os.homedir(), '.local', 'state', 'linear', 'env');
    process.env.LINEAR_API_KEY = cachedKey;
    console.log(chalk.green(`✓ Loaded LINEAR_API_KEY from ${envFile}`));
    console.log(chalk.gray('   To load it in your shell: source ' + envFile));
    return;
  }

  console.log(chalk.yellow('\n⚠️  LINEAR_API_KEY is not set and no cached key found.'));
  console.log(chalk.gray('   Create one at: https://linear.app/settings/api'));

  const apiKey = await promptLinearApiKey();
  if (!apiKey) {
    console.log(chalk.gray('   Skipped. Export LINEAR_API_KEY before running `wt open`.'));
    return;
  }

  const envFile = persistLinearApiKey(apiKey);
  console.log(chalk.green(`✓ Saved to ${envFile} (chmod 600)`));
  console.log(chalk.gray('   To load it in your current shell: source ' + envFile));
  console.log(chalk.gray('   To load automatically, add to ~/.zshrc or ~/.bashrc:'));
  console.log(chalk.gray(`     [ -f ${envFile} ] && source ${envFile}`));
}

async function promptWorktreePath(defaultPath: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(chalk.yellow(`Worktree storage path [${defaultPath}]: `), (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed || defaultPath);
    });
  });
}

export async function initCommand(): Promise<void> {
  try {
    const git = new GitOperations();
    const config = new ConfigManager(git.repoRoot);
    const defaultWorktreePath = path.dirname(git.repoRoot);

    if (config.exists()) {
      const current = config.hasTicketingProvider() ? config.getTicketingProvider() : 'unset';
      console.log(chalk.yellow('⚠️  .worktree.yml already exists'));
      console.log(chalk.gray(`   Path: ${git.repoRoot}/.worktree.yml`));
      console.log(chalk.gray(`   Current ticketing: ${current}`));
      const provider = await promptTicketingProvider();
      config.setTicketingProvider(provider);
      const worktreePath = await promptWorktreePath(config.getWorktreeBasePath() || defaultWorktreePath);
      config.setWorktreeBasePath(worktreePath);
      console.log(chalk.green(`✓ Updated ticketing provider to ${provider}`));
      console.log(chalk.green(`✓ Updated worktree storage path to ${worktreePath}`));
      if (provider === 'linear') {
        await ensureLinearApiKey();
      }
      return;
    }

    console.log(chalk.blue('Initializing worktree configuration...'));

    const provider = await promptTicketingProvider();
    const worktreePath = await promptWorktreePath(defaultWorktreePath);
    config.createDefaultConfig(provider, worktreePath);

    if (provider === 'linear') {
      await ensureLinearApiKey();
    }

    console.log(chalk.green('\n✓ Configuration created successfully!'));
    console.log(chalk.gray('\nDetected project information:'));
    console.log(chalk.gray(`  Project:       ${config.getProjectName()}`));
    console.log(chalk.gray(`  Ticketing:     ${provider}`));
    console.log(chalk.gray(`  Worktree path: ${worktreePath}`));

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
