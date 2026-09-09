import { describe, expect, it } from 'vitest';
import {
  AUDIENCE_COUNTRY_CODES,
  COUNTRY_CODES,
  DEFAULT_COUNTRY_CODE,
  countryCodeFor,
} from '../countryCodes.js';
import type { SessionRecord } from '../session.js';

const session = (countryCode?: string): SessionRecord =>
  ({ id: 's', countryCode }) as SessionRecord;

describe('audience country codes', () => {
  /** The rooms this talk is given in. A dialling code the audience cannot pick
   *  is an attendee who cannot register, which is the door closed. */
  it('covers every country the talk is given in', () => {
    const wanted: Record<string, string> = {
      Australia: '+61',
      Singapore: '+65',
      Malaysia: '+60',
      'Hong Kong': '+852',
      Thailand: '+66',
      India: '+91',
      Philippines: '+63',
      Vietnam: '+84',
      'United States': '+1',
      'New Zealand': '+64',
    };
    for (const [country, code] of Object.entries(wanted)) {
      const entry = AUDIENCE_COUNTRY_CODES.find((c) => c.country === country);
      expect(entry, country).toBeTruthy();
      expect(entry!.code).toBe(code);
    }
  });

  it('has no duplicate dialling codes, so a select cannot show one twice', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
  });
});

describe('countryCodeFor', () => {
  it('reads the session default', () => {
    expect(countryCodeFor(session('+65'))).toBe('+65');
  });

  /** A record from before the field existed, or one hand-edited to a code the
   *  select cannot offer: the door opens on the default rather than on a value
   *  no phone can correct. */
  it('falls back to the default for an absent or unknown code', () => {
    expect(countryCodeFor(session())).toBe(DEFAULT_COUNTRY_CODE);
    expect(countryCodeFor(session('+999'))).toBe(DEFAULT_COUNTRY_CODE);
  });
});
