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

  /** The talk travels, and the tour list stopped being the list of rooms it is
   *  given in. Every country is offered so no attendee is turned away at the
   *  door for a prefix nobody thought of. */
  it('covers the whole world, not only the tour', () => {
    expect(AUDIENCE_COUNTRY_CODES.length).toBeGreaterThan(190);
    const wanted: Record<string, string> = {
      Brazil: '+55',
      Germany: '+49',
      Nigeria: '+234',
      Egypt: '+20',
      Fiji: '+679',
      Mexico: '+52',
      'Saudi Arabia': '+966',
      Ukraine: '+380',
      Iceland: '+354',
      Peru: '+51',
    };
    for (const [country, code] of Object.entries(wanted)) {
      const entry = AUDIENCE_COUNTRY_CODES.find((c) => c.country === country);
      expect(entry, country).toBeTruthy();
      expect(entry!.code).toBe(code);
    }
  });

  /** The tour still opens the list: APJ first, so the room the talk is in is
   *  usually the first thing in the select rather than something to scroll for. */
  it('keeps the tour countries at the top, in tour order', () => {
    expect(AUDIENCE_COUNTRY_CODES.slice(0, 4).map((c) => c.country)).toEqual([
      'Australia',
      'New Zealand',
      'Singapore',
      'Malaysia',
    ]);
  });

  /** A code with no flag reads as a broken glyph in a select on a phone, and the
   *  flag is the only reason the list is scannable at all. */
  it('gives every country a flag', () => {
    for (const entry of AUDIENCE_COUNTRY_CODES) {
      expect(entry.flag, entry.country).toMatch(/^[\u{1F1E6}-\u{1F1FF}]{2}$/u);
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
