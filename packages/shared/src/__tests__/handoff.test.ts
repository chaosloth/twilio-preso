import { describe, expect, it } from 'vitest';
import { HANDOFF_SUMMARY_MAX, parseHandoffData } from '../handoff.js';
import { resolveRelayConfig } from '../relayConfig.js';

describe('parseHandoffData', () => {
  it('reads what the relay writes', () => {
    expect(
      parseHandoffData(JSON.stringify({ reason: 'handoff_to_human', summary: ' s ', profileId: 'p' }))
    ).toEqual({ reason: 'handoff_to_human', summary: 's', profileId: 'p' });
  });

  it('treats anything malformed as no handoff rather than throwing', () => {
    expect(parseHandoffData(undefined)).toBeNull();
    expect(parseHandoffData('not json')).toBeNull();
    expect(parseHandoffData(JSON.stringify({ summary: 'no reason' }))).toBeNull();
  });

  it('copies only declared fields and bounds the summary', () => {
    const parsed = parseHandoffData(
      JSON.stringify({ reason: 'r', summary: 'x'.repeat(2000), extra: 'injected' })
    );
    expect(parsed).not.toHaveProperty('extra');
    expect(parsed!.summary!.length).toBe(HANDOFF_SUMMARY_MAX);
  });
});

describe('handoff config', () => {
  it('defaults to dialling a number, which is what shipped', () => {
    expect(resolveRelayConfig().handoffMode).toBe('phone');
  });

  it('rejects a mode, URL or application sid TwiML could not use', () => {
    const config = resolveRelayConfig({
      handoffMode: 'carrier-pigeon' as never,
      handoffTwimlUrl: 'javascript:alert(1)',
      handoffApplicationSid: 'AP123',
    });
    expect(config.handoffMode).toBe('phone');
    expect(config.handoffTwimlUrl).toBe('');
    expect(config.handoffApplicationSid).toBe('');
  });

  it('keeps a valid URL and application sid', () => {
    const sid = 'AP' + 'a'.repeat(32);
    const config = resolveRelayConfig({
      handoffMode: 'application',
      handoffTwimlUrl: ' https://x.example.com/t ',
      handoffApplicationSid: sid,
    });
    expect(config).toMatchObject({ handoffMode: 'application', handoffTwimlUrl: 'https://x.example.com/t', handoffApplicationSid: sid });
  });
});
