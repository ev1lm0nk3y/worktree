import chalk from 'chalk';
import { GitOperations } from '../core/git.js';
import { getTerminalManager } from '../core/terminal-factory.js';
import { ConfigManager } from '../core/config.js';
import { ARCHETYPES, Archetype, resolveArchetype } from '../core/archetypes.js';
import { ArchetypePool } from '../core/pools.js';
import { selectPoolInteractive } from '../lib/pool-selection.js';
import { WorktreeEngine } from '../core/engine.js';
import { CliLogger } from '../lib/cli-logger.js';
import { PoolManager } from '../core/pools.js';
import * as readline from 'readline';

interface OpenOptions {
  workers?: string;
  watcher?: boolean;
  wizard?: boolean;
  deployPool?: string | boolean;
  archetypes?: string;
}

async function selectArchetype(workerNumber: number): Promise<Archetype> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(chalk.cyan(`\nSelect archetype for Worker ${workerNumber}:`));
  ARCHETYPES.forEach((arch, index) => {
    console.log(`${index + 1}) ${arch.emoji}  ${arch.name} - ${arch.shortDescription}`);
  });

  const max = ARCHETYPES.length;
  return new Promise((resolve) => {
    const askQuestion = () => {
      rl.question(chalk.yellow(`Choice (1-${max}): `), (answer) => {
        const choice = parseInt(answer);
        if (choice >= 1 && choice <= max) {
          const archetype = ARCHETYPES[choice - 1];
          console.log(chalk.green(`✓ Worker ${workerNumber} assigned as ${archetype.name}`));
          rl.close();
          resolve(archetype);
        } else {
          console.log(chalk.red(`Invalid choice. Please select 1-${max}.`));
          askQuestion();
        }
      });
    };
    askQuestion();
  });
}

export async function openCommand(issueNumber: string, description?: string, options?: OpenOptions): Promise<void> {
  const logger = new CliLogger();
  const git = new GitOperations();
  const config = new ConfigManager(git.repoRoot);
  const engine = new WorktreeEngine((sessionName) => getTerminalManager(sessionName), logger, git, config);

  // Mutually exclusive: --deploy-pool and --workers
  if (options?.deployPool !== undefined && options?.workers !== undefined) {
    console.error(chalk.red('Error: --deploy-pool and --workers (-w) are mutually exclusive'));
    process.exit(1);
  }

  // Mutually exclusive: --deploy-pool and --archetypes
  if (options?.deployPool !== undefined && options?.archetypes !== undefined) {
    console.error(chalk.red('Error: --deploy-pool and --archetypes are mutually exclusive'));
    process.exit(1);
  }

  // Resolve explicit archetypes list (comma-delimited, applies to workers 2..N)
  let explicitArchetypes: Archetype[] | undefined;
  if (options?.archetypes !== undefined) {
    explicitArchetypes = options.archetypes.split(',').map((raw) => {
      const name = raw.trim();
      const archetype = resolveArchetype(name);
      if (!archetype) {
        console.error(chalk.red(`Error: Unknown archetype "${name}"`));
        console.log(chalk.gray(`Available archetypes: ${ARCHETYPES.map(a => a.id).join(', ')}`));
        process.exit(1);
      }
      return archetype;
    });
  }

  try {
    // Resolve pool
    let deployedPool: ArchetypePool | undefined;
    if (options?.deployPool !== undefined) {
      const poolManager = new PoolManager(git.repoRoot);
      const allPools = poolManager.getAllPools();

      if (allPools.length === 0) {
        console.error(chalk.red('Error: No worker pools available'));
        process.exit(1);
      }

      if (options.deployPool === true || options.deployPool === '') {
        console.log(chalk.cyan('\nSelect a worker pool:\n'));
        deployedPool = await selectPoolInteractive(allPools) || undefined;
      } else {
        const pool = poolManager.getPool(options.deployPool as string);
        if (!pool) {
          console.error(chalk.red(`Error: Pool "${options.deployPool}" not found`));
          console.log(chalk.gray(`Available pools: ${allPools.map(p => p.name).join(', ')}`));
          process.exit(1);
        }
        deployedPool = pool;
      }

      if (!poolManager.validateWorkers(deployedPool.workers)) {
        console.error(chalk.red(`Error: Pool "${deployedPool.name}" contains invalid archetype IDs`));
        process.exit(1);
      }

      console.log(chalk.green(`✓ Deploying pool: ${deployedPool.name}`));
    }

    const poolHasCoordinator = deployedPool ? deployedPool.coordinator?.enable !== false : false;
    const workerCount = deployedPool
      ? deployedPool.workers.length + (poolHasCoordinator ? 1 : 0)
      : (options?.workers !== undefined
          ? parseInt(options.workers, 10)
          : (explicitArchetypes !== undefined ? explicitArchetypes.length + 1 : config.getDefaultWorkers()));

    if (explicitArchetypes !== undefined && explicitArchetypes.length > workerCount - 1) {
      console.error(chalk.red(`Error: --archetypes lists ${explicitArchetypes.length} archetype(s) but only ${workerCount - 1} worker slot(s) (2..${workerCount}) are available`));
      process.exit(1);
    }

    // Archetypes: explicit list takes priority, then interactive wizard for any remaining workers
    const archetypes: { [key: number]: Archetype } = {};
    if (!deployedPool) {
      explicitArchetypes?.forEach((archetype, index) => {
        archetypes[index + 2] = archetype;
      });

      if (options?.wizard !== false && workerCount > 1) {
        for (let i = 2; i <= workerCount; i++) {
          if (!archetypes[i]) {
            archetypes[i] = await selectArchetype(i);
          }
        }
      }
    }

    await engine.open({
      issueNumber,
      description,
      workerCount,
      watcher: options?.watcher,
      archetypes,
      deployedPool
    });

  } catch (error: any) {
    logger.error(`Error: ${error.message}`, error);
    process.exit(1);
  }
}