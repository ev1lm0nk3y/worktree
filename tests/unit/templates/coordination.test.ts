import { describe, it, expect } from 'vitest';
import {
  generateWorkerPrompt,
  generateCoordinationMd,
  generateNewWorkerEntry,
  generateAdversaryAlert,
  generateAdversaryBroadcast,
} from '../../../src/templates/coordination.md.js';
import { ARCHETYPES } from '../../../src/core/archetypes.js';

const craftsman = ARCHETYPES.find(a => a.id === 'craftsman')!;
const detective = ARCHETYPES.find(a => a.id === 'detective')!;
const architect = ARCHETYPES.find(a => a.id === 'architect')!;

const baseContext = {
  issueNumber: '42',
  issueTitle: 'Fix the bug',
  issueBody: 'Something is broken',
  workerCount: 2,
  timestamp: '2024-01-01T00:00:00.000Z',
};

describe('generateWorkerPrompt', () => {
  describe('worker 1 (coordinator)', () => {
    it('identifies as coordinator', () => {
      expect(generateWorkerPrompt(1, 3, '42')).toContain('Worker 1 (Coordinator)');
    });

    it('includes the issue number', () => {
      expect(generateWorkerPrompt(1, 3, '42')).toContain('issue #42');
    });

    it('includes delegation protocol', () => {
      expect(generateWorkerPrompt(1, 3, '42')).toContain('DELEGATION PROTOCOL');
    });

    it('does not contain waiting state', () => {
      expect(generateWorkerPrompt(1, 3, '42')).not.toContain('WAITING STATE');
    });
  });

  describe('worker 2+ without archetype', () => {
    it('identifies the worker number', () => {
      expect(generateWorkerPrompt(2, 3, '42')).toContain('Worker 2');
    });

    it('includes the issue number', () => {
      expect(generateWorkerPrompt(2, 3, '42')).toContain('issue #42');
    });

    it('includes waiting state', () => {
      expect(generateWorkerPrompt(2, 3, '42')).toContain('WAITING STATE');
    });

    it('references the correct worker file', () => {
      expect(generateWorkerPrompt(2, 3, '42')).toContain('WORKTREE_WORKER_2.md');
    });

    it('references the correct file for worker 5', () => {
      expect(generateWorkerPrompt(5, 5, '99')).toContain('WORKTREE_WORKER_5.md');
    });
  });

  describe('worker 2+ with archetype', () => {
    it('includes the archetype name', () => {
      expect(generateWorkerPrompt(2, 3, '42', craftsman)).toContain(craftsman.name);
    });

    it('includes the archetype prompt text', () => {
      expect(generateWorkerPrompt(2, 3, '42', craftsman)).toContain(craftsman.prompt);
    });
  });
});

describe('generateCoordinationMd', () => {
  it('includes issue number and title', () => {
    const md = generateCoordinationMd(baseContext);
    expect(md).toContain('Issue #42');
    expect(md).toContain('Fix the bug');
  });

  it('includes issue body', () => {
    expect(generateCoordinationMd(baseContext)).toContain('Something is broken');
  });

  it('includes the timestamp', () => {
    expect(generateCoordinationMd(baseContext)).toContain('2024-01-01T00:00:00.000Z');
  });

  it('does not include Worker 3 section when workerCount is 2', () => {
    expect(generateCoordinationMd({ ...baseContext, workerCount: 2 })).not.toContain('### Worker 3');
  });

  it('includes Worker 3 section when workerCount is 3', () => {
    expect(generateCoordinationMd({ ...baseContext, workerCount: 3 })).toContain('### Worker 3');
  });

  it('includes Worker 4 section only when workerCount >= 4', () => {
    expect(generateCoordinationMd({ ...baseContext, workerCount: 3 })).not.toContain('### Worker 4');
    expect(generateCoordinationMd({ ...baseContext, workerCount: 4 })).toContain('### Worker 4');
  });

  it('uses archetype name in worker section when provided', () => {
    const md = generateCoordinationMd({
      ...baseContext,
      workerCount: 2,
      workerArchetypes: { 2: detective },
    });
    expect(md).toContain(detective.name);
  });
});

describe('generateNewWorkerEntry', () => {
  it('includes the worker number', () => {
    expect(generateNewWorkerEntry(3)).toContain('Worker 3');
  });

  it('includes archetype name and emoji when provided', () => {
    const entry = generateNewWorkerEntry(2, architect);
    expect(entry).toContain(architect.name);
    expect(entry).toContain(architect.emoji);
  });

  it('includes archetype short description when provided', () => {
    expect(generateNewWorkerEntry(2, architect)).toContain(architect.shortDescription);
  });
});

describe('generateAdversaryAlert', () => {
  it('includes the worker number', () => {
    expect(generateAdversaryAlert(4)).toContain('Worker 4');
  });

  it('contains BLOCK verdict text', () => {
    expect(generateAdversaryAlert(4)).toContain('BLOCK');
  });
});

describe('generateAdversaryBroadcast', () => {
  it('includes the issue number', () => {
    expect(generateAdversaryBroadcast('55')).toContain('#55');
  });
});
