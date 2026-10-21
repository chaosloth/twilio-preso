import { describe, expect, it } from 'vitest';
import { clientIp } from '../rateLimit.js';

const req = (ip: string, flyClientIp?: string) => ({
  ip,
  headers: flyClientIp ? { 'fly-client-ip': flyClientIp } : {},
});

describe('clientIp', () => {
  /** What every production request looks like: Fly's proxy on the socket. */
  it("keys on the attendee, not on Fly's proxy", () => {
    expect(clientIp(req('172.16.33.154', '203.0.113.7'))).toBe('203.0.113.7');
    expect(clientIp(req('fdaa:0:1:a7b::2', '203.0.113.8'))).toBe('203.0.113.8');
  });

  /** A header anyone can write is a rate limit anyone can step around. */
  it('ignores the header from a public address', () => {
    expect(clientIp(req('198.51.100.4', '203.0.113.7'))).toBe('198.51.100.4');
  });

  it('falls back to the socket when the header is absent', () => {
    expect(clientIp(req('172.16.33.154'))).toBe('172.16.33.154');
  });
});
