import { execSync } from 'child_process';
import * as readline from 'readline';
import chalk from 'chalk';
import { ArchetypePool } from '../core/pools.js';

export async function selectPoolInteractive(pools: ArchetypePool[]): Promise<ArchetypePool> {
  // Try fzf first
  const pool = tryFzfSelection(pools);
  if (pool) {
    return pool;
  }

  // Fall back to readline
  console.log(chalk.yellow('⚠️  fzf not found. Install with: brew install fzf (or apt-get install fzf)'));
  console.log(chalk.gray('   For better selection experience, fzf is recommended\n'));
  return readlineSelection(pools);
}

function tryFzfSelection(pools: ArchetypePool[]): ArchetypePool | null {
  try {
    // Check if fzf is available
    execSync('which fzf', { stdio: 'ignore' });

    // Run fzf
    const input = pools
      .map((p, i) => `${i + 1} ${p.name}`)
      .join('\n');

    const selected = execSync(`echo '${input.replace(/'/g, "'\\''")}'  | fzf --height 10 --reverse --with-nth=2 --preview ''`, {
      encoding: 'utf8'
    }).trim();

    if (!selected) {
      return null;
    }

    const poolName = selected.split(' ')[1];
    const pool = pools.find(p => p.name === poolName);
    return pool || null;
  } catch {
    return null;
  }
}

async function readlineSelection(pools: ArchetypePool[]): Promise<ArchetypePool> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(chalk.cyan('\nSelect a worker pool:\n'));
  pools.forEach((pool, index) => {
    console.log(`${index + 1}. ${chalk.bold(pool.name)}`);
    console.log(`   ${pool.description}`);
    console.log(`   Workers: ${pool.workers.join(', ')}`);
    if (pool.watcher?.enable) {
      console.log(`   Includes: Watcher`);
    }
    console.log('');
  });

  return new Promise((resolve) => {
    const ask = () => {
      rl.question(chalk.yellow(`Select pool (1-${pools.length}): `), (answer) => {
        const choice = parseInt(answer, 10);
        if (choice >= 1 && choice <= pools.length) {
          const pool = pools[choice - 1];
          console.log(chalk.green(`✓ Selected: ${pool.name}`));
          rl.close();
          resolve(pool);
        } else {
          console.log(chalk.red(`Invalid choice. Please select 1-${pools.length}.`));
          ask();
        }
      });
    };
    ask();
  });
}
