import { describe, it, expect } from 'vitest';
import { generateOverseerMd, generateOverseerPrompt } from '../../../src/templates/overseer.md.js';

describe('generateOverseerMd', () => {
  const context = {
    issueNumber: '77',
    issueTitle: 'Performance regression',
    timestamp: '2024-01-01T00:00:00.000Z',
  };

  it('contains the issue number', () => {
    expect(generateOverseerMd(context)).toContain('#77');
  });

  it('contains the issue title', () => {
    expect(generateOverseerMd(context)).toContain('Performance regression');
  });

  it('contains the timestamp', () => {
    expect(generateOverseerMd(context)).toContain('2024-01-01T00:00:00.000Z');
  });
});

describe('generateOverseerPrompt', () => {
  it('contains the issue number', () => {
    expect(generateOverseerPrompt('99')).toContain('#99');
  });

  it('contains PHASE 1 instructions', () => {
    expect(generateOverseerPrompt('1')).toContain('PHASE 1');
  });

  it('contains PHASE 2 instructions', () => {
    expect(generateOverseerPrompt('1')).toContain('PHASE 2');
  });
});
