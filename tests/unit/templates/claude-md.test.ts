import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'fs';

vi.mock('fs');

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);

import { generateWorktreeTicket, ensureGitignore } from '../../../src/templates/claude.md.js';

const baseGithub = {
  issueNumber: '42',
  branchName: 'issue-42-fix',
  provider: 'github' as const,
  projectName: 'my-project',
};

const baseLinear = {
  issueNumber: 'ABC-123',
  branchName: 'abc-123-fix',
  provider: 'linear' as const,
  projectName: 'my-project',
};

describe('generateWorktreeTicket', () => {
  describe('GitHub provider', () => {
    it('uses #N ref format', () => {
      expect(generateWorktreeTicket(baseGithub)).toContain('#42');
    });

    it('includes gh issue view command', () => {
      expect(generateWorktreeTicket(baseGithub)).toContain('gh issue view 42');
    });

    it('includes gh pr create command', () => {
      expect(generateWorktreeTicket(baseGithub)).toContain('gh pr create');
    });
  });

  describe('Linear provider', () => {
    it('uses bare ref format', () => {
      expect(generateWorktreeTicket(baseLinear)).toContain('ABC-123');
    });

    it('does not include gh issue view command', () => {
      expect(generateWorktreeTicket(baseLinear)).not.toContain('gh issue view');
    });
  });

  describe('with full issue details', () => {
    const withIssue = {
      ...baseGithub,
      issue: {
        title: 'Fix the login bug',
        state: 'open',
        url: 'https://github.com/org/repo/issues/42',
        assignee: 'alice',
        labels: ['bug', 'urgent'],
        body: 'The login page is broken',
      },
    };

    it('includes issue title', () => {
      expect(generateWorktreeTicket(withIssue)).toContain('Fix the login bug');
    });

    it('includes assignee', () => {
      expect(generateWorktreeTicket(withIssue)).toContain('alice');
    });

    it('includes labels', () => {
      expect(generateWorktreeTicket(withIssue)).toContain('bug, urgent');
    });

    it('includes issue body', () => {
      expect(generateWorktreeTicket(withIssue)).toContain('The login page is broken');
    });

    it('includes issue URL', () => {
      expect(generateWorktreeTicket(withIssue)).toContain('https://github.com/org/repo/issues/42');
    });
  });

  describe('with commands', () => {
    it('renders all provided commands', () => {
      const content = generateWorktreeTicket({
        ...baseGithub,
        commands: { dev: 'npm run dev', test: 'npm test', build: 'npm run build' },
      });
      expect(content).toContain('npm run dev');
      expect(content).toContain('npm test');
      expect(content).toContain('npm run build');
    });
  });

  describe('with custom context', () => {
    it('includes the custom context string', () => {
      expect(generateWorktreeTicket({ ...baseGithub, customContext: 'Uses React 18' }))
        .toContain('Uses React 18');
    });
  });
});

describe('ensureGitignore', () => {
  const WORKTREE = '/tmp/worktree';
  const ENTRIES = ['WORKTREE_TICKET.md', 'WORKTREE_COORDINATION.md', 'OVERSEER.md', 'WORKTREE_WORKERS.json'];

  beforeEach(() => vi.resetAllMocks());

  it('creates a new gitignore containing all four entries', () => {
    mockExistsSync.mockReturnValue(false);
    ensureGitignore(WORKTREE);

    const written = mockWriteFileSync.mock.calls[0][1] as string;
    for (const entry of ENTRIES) {
      expect(written).toContain(entry);
    }
  });

  it('appends only missing entries to an existing gitignore', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('WORKTREE_TICKET.md\n' as any);

    ensureGitignore(WORKTREE);
    const written = mockWriteFileSync.mock.calls[0][1] as string;

    expect(written).toContain('WORKTREE_COORDINATION.md');
    expect(written).toContain('OVERSEER.md');
    expect(written).toContain('WORKTREE_WORKERS.json');
  });

  it('does not duplicate entries already present', () => {
    const full = ENTRIES.join('\n') + '\n';
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(full as any);

    ensureGitignore(WORKTREE);
    const written = mockWriteFileSync.mock.calls[0][1] as string;

    for (const entry of ENTRIES) {
      const count = (written.match(new RegExp(entry.replace('.', '\\.'), 'g')) ?? []).length;
      expect(count, `${entry} appears ${count} times`).toBe(1);
    }
  });
});
