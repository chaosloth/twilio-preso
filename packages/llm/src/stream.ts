/**
 * Guards a token stream against ending silently.
 *
 * A provider that answers with a redirect, an empty body, or a filtered
 * completion ends the SSE iteration with no tokens and no exception. That is
 * fine in a text UI and disastrous on a phone call, where the caller cannot tell
 * a thinking agent from a dead one — so an empty stream is turned into the error
 * it should have been, and the caller's fallback line gets spoken.
 */
export async function* requireTokens(
  source: AsyncIterable<string>,
  provider: string
): AsyncIterable<string> {
  let yielded = false;
  for await (const token of source) {
    yielded = true;
    yield token;
  }
  if (!yielded) {
    throw new Error(`${provider} stream ended without producing any tokens`);
  }
}
