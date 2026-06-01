import { existsSync, readFileSync } from 'fs';
import { load } from 'js-yaml';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { AiProvider } from './config.js';

export interface PoolConfig {
  description: string;
  coordinator?: {
    enable: boolean;
  };
  workers: string[];
  watcher?: {
    enable: boolean;
  };
}

export interface ArchetypePool extends PoolConfig {
  name: string;
}

export interface PoolsYaml {
  pools?: {
    [poolName: string]: PoolConfig;
  };
}

export class PoolManager {
  private pools: Map<string, ArchetypePool> = new Map();

  constructor(repoRoot: string, aiProvider: AiProvider = 'claude') {
    this.loadDefaultPools();
    this.loadUserPools(repoRoot, aiProvider);
  }

  private loadDefaultPools(): void {
    // Import default pools
    const defaultPools = this.getDefaultPools();
    for (const [name, config] of Object.entries(defaultPools)) {
      this.pools.set(name, { name, ...config });
    }
  }

  private getDefaultPools(): { [key: string]: PoolConfig } {
    return {
      Researchers: {
        description: 'Evaluate solutions, choose best approach, structure deployment',
        coordinator: { enable: true },
        workers: ['architect', 'explorer'],
        watcher: { enable: false }
      },
      Coders: {
        description: 'Implement from research output (add adversary later with split)',
        coordinator: { enable: true },
        workers: ['craftsman', 'aesthete'],
        watcher: { enable: false }
      },
      Reviewers: {
        description: 'Final code quality and security review',
        coordinator: { enable: true },
        workers: ['detective', 'adversary', 'sentinel'],
        watcher: { enable: false }
      }
    };
  }

  private loadUserPools(repoRoot: string, aiProvider: AiProvider): void {
    const homeDir = os.homedir();
    
    // Determine directory names to search (e.g. .gemini, .claude)
    const dirs = aiProvider === 'gemini' ? ['.gemini', '.claude'] : ['.claude'];

    // Search project-level pools
    for (const dir of dirs) {
      const projectPoolsPath = path.join(repoRoot, dir, 'archetype-groups.yml');
      if (existsSync(projectPoolsPath)) {
        this.mergePools(projectPoolsPath);
      }
    }

    // Search user-level pools
    for (const dir of dirs) {
      const userPoolsPath = path.join(homeDir, dir, 'archetype-groups.yml');
      if (existsSync(userPoolsPath)) {
        this.mergePools(userPoolsPath);
      }
    }
  }

  private mergePools(filePath: string): void {
    try {
      const content = readFileSync(filePath, 'utf8');
      const yaml = load(content) as PoolsYaml;

      if (yaml.pools) {
        for (const [name, config] of Object.entries(yaml.pools)) {
          this.pools.set(name, { name, ...config });
        }
      }
    } catch (error: any) {
      console.log(chalk.yellow(`⚠️  Failed to load pools from ${filePath}: ${error.message}`));
    }
  }

  getAllPools(): ArchetypePool[] {
    return Array.from(this.pools.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  getPool(name: string): ArchetypePool | null {
    return this.pools.get(name) || null;
  }

  poolExists(name: string): boolean {
    return this.pools.has(name);
  }

  validateWorkers(workers: string[]): boolean {
    // All worker names in pool should be valid archetype IDs
    const validIds = ['architect', 'detective', 'craftsman', 'explorer', 'aesthete', 'adversary', 'sentinel', 'scribe'];
    return workers.every(w => validIds.includes(w));
  }
}
