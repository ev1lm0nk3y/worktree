import { describe, it, expect } from 'vitest';
import {
  ARCHETYPES,
  getArchetypeById,
  resolveArchetype,
  getDefaultArchetypeForWorker,
} from '../../../src/core/archetypes.js';

describe('ARCHETYPES', () => {
  it('contains 9 archetypes', () => {
    expect(ARCHETYPES).toHaveLength(9);
  });

  it('all archetypes have required fields', () => {
    for (const a of ARCHETYPES) {
      expect(a.id, `${a.id}: missing id`).toBeTruthy();
      expect(a.name, `${a.id}: missing name`).toBeTruthy();
      expect(a.emoji, `${a.id}: missing emoji`).toBeTruthy();
      expect(a.prompt, `${a.id}: missing prompt`).toBeTruthy();
      expect(a.color, `${a.id}: missing color`).toBeTruthy();
      expect(Array.isArray(a.traits), `${a.id}: traits must be array`).toBe(true);
      expect(a.traits.length, `${a.id}: traits must not be empty`).toBeGreaterThan(0);
    }
  });

  it('has no duplicate IDs', () => {
    const ids = ARCHETYPES.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains the expected archetypes', () => {
    const ids = ARCHETYPES.map(a => a.id);
    for (const expected of ['architect', 'detective', 'craftsman', 'explorer', 'aesthete', 'adversary', 'sentinel', 'scribe', 'guide']) {
      expect(ids).toContain(expected);
    }
  });
});

describe('getArchetypeById', () => {
  it('returns the correct archetype for a known id', () => {
    const a = getArchetypeById('craftsman');
    expect(a?.id).toBe('craftsman');
  });

  it('returns undefined for an unknown id', () => {
    expect(getArchetypeById('nonexistent')).toBeUndefined();
  });
});

describe('resolveArchetype', () => {
  it('matches by exact id', () => {
    expect(resolveArchetype('detective')?.id).toBe('detective');
  });

  it('matches case-insensitively', () => {
    expect(resolveArchetype('DETECTIVE')?.id).toBe('detective');
    expect(resolveArchetype('Detective')?.id).toBe('detective');
  });

  it('matches by partial id prefix', () => {
    expect(resolveArchetype('arch')?.id).toBe('architect');
  });

  it('matches by name substring', () => {
    expect(resolveArchetype('craftsman')?.id).toBe('craftsman');
  });

  it('returns undefined for an unrecognised input', () => {
    expect(resolveArchetype('zzz-no-match')).toBeUndefined();
  });
});

describe('getDefaultArchetypeForWorker', () => {
  it('returns detective for worker 2', () => {
    expect(getDefaultArchetypeForWorker(2).id).toBe('detective');
  });

  it('returns craftsman for worker 3', () => {
    expect(getDefaultArchetypeForWorker(3).id).toBe('craftsman');
  });

  it('returns a valid archetype for workers 2–5', () => {
    for (let i = 2; i <= 5; i++) {
      const a = getDefaultArchetypeForWorker(i);
      expect(ARCHETYPES.some(x => x.id === a.id)).toBe(true);
    }
  });
});
