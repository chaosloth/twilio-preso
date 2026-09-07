import { describe, expect, it } from 'vitest';
import {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  allocateJoinCode,
  generateJoinCode,
  isValidJoinCode,
  normalizeJoinCode,
} from '../joinCode.js';

/** Deterministic stand-in for Math.random: replays a fixed list of values. */
function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe('the alphabet', () => {
  it('excludes the characters people confuse when reading a code off a screen', () => {
    for (const ambiguous of ['I', 'L', 'O', 'U']) {
      expect(JOIN_CODE_ALPHABET).not.toContain(ambiguous);
    }
  });

  it('is Crockford base32 — 32 distinct characters, digits then letters', () => {
    expect(JOIN_CODE_ALPHABET).toBe('0123456789ABCDEFGHJKMNPQRSTVWXYZ');
    expect(new Set(JOIN_CODE_ALPHABET).size).toBe(32);
  });
});

describe('generateJoinCode', () => {
  it('produces a code of the advertised length', () => {
    expect(generateJoinCode()).toHaveLength(JOIN_CODE_LENGTH);
  });

  it('draws every character from the alphabet', () => {
    // 200 codes is 1200 characters — enough that a stray character from a
    // wider alphabet would almost certainly show up.
    for (let i = 0; i < 200; i++) {
      for (const char of generateJoinCode()) {
        expect(JOIN_CODE_ALPHABET).toContain(char);
      }
    }
  });

  it('maps the random source across the whole alphabet, not just its start', () => {
    expect(generateJoinCode(() => 0)).toBe('000000');
    // 0.999… must land on the last character, not overflow past it.
    expect(generateJoinCode(() => 0.9999999)).toBe('ZZZZZZ');
  });

  it('varies between calls', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateJoinCode()));
    expect(codes.size).toBeGreaterThan(45);
  });
});

describe('normalizeJoinCode', () => {
  it('upper-cases, so a phone keyboard’s lowercase still resolves', () => {
    expect(normalizeJoinCode('a1b2c3')).toBe('A1B2C3');
  });

  it('folds the excluded characters onto the ones they look like', () => {
    // Crockford's rule: never emit these, always accept them on input.
    expect(normalizeJoinCode('OIL')).toBe('011');
    expect(normalizeJoinCode('oil')).toBe('011');
  });

  it('strips whitespace and hyphens people add for readability', () => {
    expect(normalizeJoinCode(' A1B-2C3 ')).toBe('A1B2C3');
  });

  it('leaves an already-canonical code untouched', () => {
    expect(normalizeJoinCode('9GHJKM')).toBe('9GHJKM');
  });
});

describe('isValidJoinCode', () => {
  it('accepts a canonical code', () => {
    expect(isValidJoinCode('9GHJKM')).toBe(true);
  });

  it('rejects wrong lengths', () => {
    expect(isValidJoinCode('9GHJK')).toBe(false);
    expect(isValidJoinCode('9GHJKMN')).toBe(false);
  });

  it('rejects characters outside the alphabet, including the folded ones', () => {
    // Callers normalize first; a raw 'O' reaching a lookup is a bug, not a hit.
    expect(isValidJoinCode('9GHJKO')).toBe(false);
    expect(isValidJoinCode('9ghjkm')).toBe(false);
    expect(isValidJoinCode('9GHJK-')).toBe(false);
  });
});

describe('allocateJoinCode', () => {
  it('returns the first code when nothing is taken', async () => {
    const code = await allocateJoinCode(async () => false);
    expect(isValidJoinCode(code)).toBe(true);
  });

  it('retries past a collision and returns the free code', async () => {
    const taken = new Set(['000000']);
    // Six draws make one code: the first yields '000000' and collides, the
    // second yields 'ZZZZZZ' and doesn't.
    const random = sequence([...Array(6).fill(0), ...Array(6).fill(0.9999999)]);
    const code = await allocateJoinCode(async (c) => taken.has(c), { random });
    expect(code).toBe('ZZZZZZ');
  });

  it('gives up rather than looping forever when every code collides', async () => {
    let checks = 0;
    await expect(
      allocateJoinCode(async () => {
        checks++;
        return true;
      })
    ).rejects.toThrow(/join code/i);
    // Bounded, and it did actually try more than once.
    expect(checks).toBeGreaterThan(1);
    expect(checks).toBeLessThanOrEqual(20);
  });

  it('honours an explicit attempt budget', async () => {
    let checks = 0;
    await expect(
      allocateJoinCode(
        async () => {
          checks++;
          return true;
        },
        { maxAttempts: 3 }
      )
    ).rejects.toThrow(/join code/i);
    expect(checks).toBe(3);
  });
});
