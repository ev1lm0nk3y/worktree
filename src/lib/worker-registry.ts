import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

export const REGISTRY_FILENAME = '.worktree-workers.json';

export interface WorkerEntry {
  paneId: string;
  archetypeId: string; // 'coordinator', 'overseer', or an archetype id
}

export interface WorkerRegistry {
  issueNumber: string;
  workers: { [workerNumber: string]: WorkerEntry };
}

function registryPath(worktreePath: string): string {
  return path.join(worktreePath, REGISTRY_FILENAME);
}

export function readRegistry(worktreePath: string): WorkerRegistry | null {
  const p = registryPath(worktreePath);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as WorkerRegistry;
  } catch {
    return null;
  }
}

export function addWorker(
  worktreePath: string,
  issueNumber: string,
  workerNumber: number,
  paneId: string,
  archetypeId: string
): void {
  const registry = readRegistry(worktreePath) ?? { issueNumber, workers: {} };
  registry.workers[String(workerNumber)] = { paneId, archetypeId };
  writeFileSync(registryPath(worktreePath), JSON.stringify(registry, null, 2), 'utf8');
}

// Returns pane IDs for all registered workers, optionally excluding one worker number.
export function getRegisteredPaneIds(worktreePath: string, exclude?: number): string[] {
  const registry = readRegistry(worktreePath);
  if (!registry) return [];
  return Object.entries(registry.workers)
    .filter(([num]) => exclude === undefined || Number(num) !== exclude)
    .map(([, entry]) => entry.paneId);
}
