import { describe, expect, it } from 'vitest';
import { requireTokens } from '../stream.js';

async function* yields(...items: string[]) {
  for (const item of items) yield item;
}

/**
 * A stream that ends without producing a token is the worst failure shape on a
 * phone call: no exception to log, no words to speak, and a caller holding
 * silence that is indistinguishable from a dropped call. This is not
 * hypothetical — a network that redirects the API host (a corporate proxy sat in
 * front of OpenRouter) ends the SSE iteration with zero chunks and no error.
 */
describe('requireTokens', () => {
  it('passes tokens straight through', async () => {
    const seen: string[] = [];
    for await (const token of requireTokens(yields('a', 'b'), 'openai')) seen.push(token);
    expect(seen).toEqual(['a', 'b']);
  });

  it('throws when the stream ends without a single token', async () => {
    await expect(async () => {
      for await (const _ of requireTokens(yields(), 'openai')) void _;
    }).rejects.toThrow(/openai/);
  });

  it('lets the underlying error surface unchanged', async () => {
    async function* broken() {
      yield 'a';
      throw new Error('upstream exploded');
    }
    await expect(async () => {
      for await (const _ of requireTokens(broken(), 'openai')) void _;
    }).rejects.toThrow('upstream exploded');
  });
});
