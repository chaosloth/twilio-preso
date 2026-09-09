import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  isSignatureBypassed,
  jsonSignatureValid,
  setSignatureBypass,
} from '../twilioSignature.js';

/**
 * Conversation Orchestrator's callbacks carry a JSON body, and Twilio signs them
 * differently from a form-encoded TwiML webhook: the HMAC-SHA1 is taken over the
 * URL with `?bodySHA256=<sha256 hex of the raw body>` appended — a query string
 * Twilio never actually sends, so it cannot be read off the request.
 *
 * The expected signatures below were computed once against this token and pinned,
 * rather than recomputed by the test with the same code under test, which would
 * pass whatever scheme the implementation happened to use. The scheme itself was
 * confirmed against real captured callbacks from the account.
 */
const TOKEN = 'test-token-12345';
const BARE_URL = 'https://example.test/api/orchestrator/webhook';
const BODY =
  '{"eventType":"COMMUNICATION_CREATED","data":{"content":{"type":"TEXT","text":"Test"}}}';
/**
 * Twilio sends `bodySHA256` itself, on the request line — which is what the log
 * of a rejected callback showed. So the URL the signature is checked against is
 * the one that arrived, appended to nothing.
 */
const URL_ = `${BARE_URL}?bodySHA256=${createHash('sha256').update(BODY).digest('hex')}`;
const SIGNATURE = 'brixlD+my4IipC4fO7a8TdOZfuE=';

describe('jsonSignatureValid', () => {
  it('accepts the signature Twilio computes over the URL and the body hash', () => {
    expect(jsonSignatureValid(TOKEN, SIGNATURE, URL_, BODY)).toBe(true);
  });

  /** The whole point: a body edited in flight no longer matches, even though the
   *  URL and the signature are untouched. */
  it('rejects a body that was altered after signing', () => {
    const tampered = BODY.replace('Test', 'Send money');
    expect(jsonSignatureValid(TOKEN, SIGNATURE, URL_, tampered)).toBe(false);
  });

  /** The signature covers scheme and host, which is why PUBLIC_BASE_URL has to be
   *  the origin Twilio was given rather than whatever the proxy reports. */
  it('rejects a different URL', () => {
    expect(jsonSignatureValid(TOKEN, SIGNATURE, `${BARE_URL}/x`, BODY)).toBe(false);
  });

  /**
   * The bug this replaced: `bodySHA256` was appended to the URL that already
   * carried it, so the string hashed was `…?bodySHA256=x?bodySHA256=x` and every
   * real callback was rejected with the request line right there in the log.
   */
  it('rejects a URL missing the body hash rather than adding one', () => {
    expect(jsonSignatureValid(TOKEN, SIGNATURE, BARE_URL, BODY)).toBe(false);
  });

  it('rejects another account’s token', () => {
    expect(jsonSignatureValid('some-other-token', SIGNATURE, URL_, BODY)).toBe(false);
  });

  /** A missing header must not be treated as a match, and an unset auth token must
   *  not make everything valid. */
  it('rejects an empty signature or an empty token', () => {
    expect(jsonSignatureValid(TOKEN, '', URL_, BODY)).toBe(false);
    expect(jsonSignatureValid('', SIGNATURE, URL_, BODY)).toBe(false);
  });
});

/**
 * The bypass exists because a rejected callback is indistinguishable from a
 * broken agent: the message arrives, nothing replies, and the log line is a 403.
 * It is off unless somebody turns it on, and it is a run-time toggle rather than
 * a stored setting — a restart has to close it again.
 */
describe('signature bypass', () => {
  afterEach(() => setSignatureBypass(false));

  it('is off out of the box', () => {
    expect(isSignatureBypassed()).toBe(false);
  });

  it('turns on and off again', () => {
    setSignatureBypass(true);
    expect(isSignatureBypassed()).toBe(true);
    setSignatureBypass(false);
    expect(isSignatureBypassed()).toBe(false);
  });
});
