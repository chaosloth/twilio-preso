/**
 * Twilio Sync reports "already there" and "not there" with different codes
 * depending on whether the thing is an *object* (document, map, stream) or an
 * *item inside a map*. Matching only the object-level code — as this code did —
 * makes a duplicate map-item write throw a 500 instead of being handled: a
 * re-added presenter failed outright, and a lost race for a pool phone number
 * aborted instead of trying the next one.
 *
 * So membership tests here take the whole family, not a single code.
 */

/** Object unique name already taken. */
const OBJECT_EXISTS = 54301;
/** Map item key already present. */
const ITEM_EXISTS = 54208;

/** Object unique name not found. */
const OBJECT_NOT_FOUND = 54100;
/** Map item key not found. */
const ITEM_NOT_FOUND = 54201;
/**
 * Generic REST "resource not found". Deleting an absent map item returns this
 * rather than either Sync-specific code, so leaving it out made an idempotent
 * delete throw.
 */
const RESOURCE_NOT_FOUND = 20404;

export function isAlreadyExists(err: unknown): boolean {
  const code = (err as { code?: number })?.code;
  return code === OBJECT_EXISTS || code === ITEM_EXISTS;
}

export function isNotFound(err: unknown): boolean {
  const code = (err as { code?: number })?.code;
  return (
    code === OBJECT_NOT_FOUND || code === ITEM_NOT_FOUND || code === RESOURCE_NOT_FOUND
  );
}

/** Runs `fn`, swallowing one expected failure class and returning null for it. */
export async function ignoring<T>(
  matches: (err: unknown) => boolean,
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (!matches(err)) throw err;
    return null;
  }
}

/**
 * A conditional write lost the race — the document changed between the fetch
 * and the update. Sync answers `If-Match` with a plain 412, so match on the
 * status rather than a Sync error code.
 */
export function isRevisionMismatch(err: unknown): boolean {
  return (err as { status?: number })?.status === 412;
}
