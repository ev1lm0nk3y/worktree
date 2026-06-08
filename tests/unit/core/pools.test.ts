import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';

vi.mock('fs');

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

import { PoolManager } from '../../../src/core/pools.js';

describe('PoolManager default pools', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  it('loads exactly three default pools', () => {
    expect(new PoolManager('/repo').getAllPools()).toHaveLength(3);
  });

  it('Researchers pool has the correct workers', () => {
    expect(new PoolManager('/repo').getPool('Researchers')?.workers).toEqual(['architect', 'explorer']);
  });

  it('Coders pool has the correct workers', () => {
    expect(new PoolManager('/repo').getPool('Coders')?.workers).toEqual(['craftsman', 'aesthete']);
  });

  it('Reviewers pool has the correct workers', () => {
    expect(new PoolManager('/repo').getPool('Reviewers')?.workers).toEqual(['detective', 'adversary', 'sentinel']);
  });

  it('getAllPools returns pools sorted alphabetically by name', () => {
    const names = new PoolManager('/repo').getAllPools().map(p => p.name);
    expect(names).toEqual([...names].sort());
  });

  it('getPool returns null for an unknown pool name', () => {
    expect(new PoolManager('/repo').getPool('DoesNotExist')).toBeNull();
  });
});

describe('PoolManager.validateWorkers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  it('accepts all eight valid archetype IDs', () => {
    const pm = new PoolManager('/repo');
    expect(pm.validateWorkers(['architect', 'detective', 'craftsman', 'explorer', 'aesthete', 'adversary', 'sentinel', 'scribe'])).toBe(true);
  });

  it('rejects a list containing an unknown archetype ID', () => {
    expect(new PoolManager('/repo').validateWorkers(['craftsman', 'not-an-archetype'])).toBe(false);
  });

  it('accepts a single valid archetype', () => {
    expect(new PoolManager('/repo').validateWorkers(['detective'])).toBe(true);
  });
});

describe('PoolManager custom YAML pools', () => {
  beforeEach(() => vi.resetAllMocks());

  it('merges a custom pool without removing defaults', () => {
    mockExistsSync.mockImplementation((p) =>
      String(p).endsWith('archetype-groups.yml')
    );
    mockReadFileSync.mockReturnValue(`
pools:
  MyTeam:
    description: Custom team
    workers:
      - craftsman
      - detective
` as any);

    const pm = new PoolManager('/repo');
    expect(pm.getPool('Researchers')).not.toBeNull();
    expect(pm.getPool('MyTeam')).not.toBeNull();
    expect(pm.getPool('MyTeam')?.workers).toEqual(['craftsman', 'detective']);
  });

  it('overrides a default pool when the custom YAML uses the same name', () => {
    mockExistsSync.mockImplementation((p) =>
      String(p).endsWith('archetype-groups.yml')
    );
    mockReadFileSync.mockReturnValue(`
pools:
  Coders:
    description: Overridden coders
    workers:
      - architect
` as any);

    const pm = new PoolManager('/repo');
    expect(pm.getPool('Coders')?.workers).toEqual(['architect']);
  });
});
