/**
 * Crockford base32. The excluded characters — I, L, O, U — are the ones that
 * get misread off a projector or mistyped on a phone. Crockford's rule is
 * asymmetric on purpose: never emit them, always accept them on input (see
 * `normalizeJoinCode`), so a misread code still resolves.
 */
export const JOIN_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 32^6 ≈ 1.07e9 codes. Ample against the handful live at any one time. */
export const JOIN_CODE_LENGTH = 6;

/** Attempts before `allocateJoinCode` gives up rather than spinning. */
const DEFAULT_MAX_ATTEMPTS = 10;

export function generateJoinCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    const index = Math.floor(random() * JOIN_CODE_ALPHABET.length);
    // Guards against a random source returning exactly 1.
    code += JOIN_CODE_ALPHABET[Math.min(index, JOIN_CODE_ALPHABET.length - 1)];
  }
  return code;
}

/**
 * Canonicalises whatever the audience actually typed. Always run this before
 * looking a code up — the `sessions` map is keyed by canonical codes only.
 */
export function normalizeJoinCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

/** True only for a canonical code. Deliberately rejects 'O' and lowercase. */
export function isValidJoinCode(code: string): boolean {
  if (code.length !== JOIN_CODE_LENGTH) return false;
  for (const char of code) {
    if (!JOIN_CODE_ALPHABET.includes(char)) return false;
  }
  return true;
}

export interface AllocateJoinCodeOptions {
  random?: () => number;
  maxAttempts?: number;
}

/**
 * Draws a code that `isTaken` says is free. Bounded: with a thousand live
 * sessions the collision probability per draw is under one in a million, so
 * exhausting the budget means something is wrong with `isTaken` (or the
 * `sessions` map is unreadable) — failing loudly beats looping.
 */
export async function allocateJoinCode(
  isTaken: (code: string) => Promise<boolean>,
  opts: AllocateJoinCodeOptions = {}
): Promise<string> {
  const { random = Math.random, maxAttempts = DEFAULT_MAX_ATTEMPTS } = opts;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateJoinCode(random);
    if (!(await isTaken(code))) return code;
  }

  throw new Error(
    `Could not allocate a free join code in ${maxAttempts} attempts.`
  );
}
