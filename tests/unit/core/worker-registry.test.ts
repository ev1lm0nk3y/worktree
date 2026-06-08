import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'fs';

vi.mock('fs');

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);

import { readRegistry, addWorker, getRegisteredPaneIds } from '../../../src/core/worker-registry.js';

const WORKTREE = '/tmp/worktree';

const singleWorkerRegistry = {
  issueNumber: '42',
  workers: { '1': { paneId: '%0', archetypeId: 'coordinator' } },
};

const twoWorkerRegistry = {
  issueNumber: '42',
  workers: {
    '1': { paneId: '%0', archetypeId: 'coordinator' },
    '2': { paneId: '%1', archetypeId: 'craftsman' },
  },
};

describe('readRegistry', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns null when the file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expect(readRegistry(WORKTREE)).toBeNull();
  });

  it('returns null on malformed JSON', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('not-valid-json' as any);
    expect(readRegistry(WORKTREE)).toBeNull();
  });

  it('returns the parsed registry on valid JSON', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(singleWorkerRegistry) as any);
    expect(readRegistry(WORKTREE)).toEqual(singleWorkerRegistry);
  });
});

describe('addWorker', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates a new registry when no file exists', () => {
    mockExistsSync.mockReturnValue(false);
    addWorker(WORKTREE, '42', 1, '%0', 'coordinator');

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.issueNumber).toBe('42');
    expect(written.workers['1']).toEqual({ paneId: '%0', archetypeId: 'coordinator' });
  });

  it('merges into an existing registry without clobbering other workers', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(singleWorkerRegistry) as any);

    addWorker(WORKTREE, '42', 2, '%1', 'craftsman');

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.workers['1']).toEqual({ paneId: '%0', archetypeId: 'coordinator' });
    expect(written.workers['2']).toEqual({ paneId: '%1', archetypeId: 'craftsman' });
  });
});

describe('getRegisteredPaneIds', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns an empty array when the registry does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expect(getRegisteredPaneIds(WORKTREE)).toEqual([]);
  });

  it('returns all pane IDs', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(twoWorkerRegistry) as any);
    expect(getRegisteredPaneIds(WORKTREE)).toEqual(expect.arrayContaining(['%0', '%1']));
  });

  it('excludes the specified worker number', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(twoWorkerRegistry) as any);
    const ids = getRegisteredPaneIds(WORKTREE, 1);
    expect(ids).not.toContain('%0');
    expect(ids).toContain('%1');
  });
});
