import type { SessionRecord } from './session.js';

/**
 * A dialling code the audience registration screen can offer.
 *
 * The list exists because the phone number the attendee types is a *local*
 * number — Verify, Messaging and Conversation Memory all need E.164, and the
 * code in front is the only part they cannot guess. One list, shared by the
 * audience select and the HUD's per-session default, so the room's country is
 * chosen once by the presenter rather than by every phone in the room.
 */
export interface CountryCode {
  /** E.164 dialling prefix, `+` included. */
  code: string;
  country: string;
  /** Shown beside the code so a `+6…` prefix is not a guessing game. */
  flag: string;
}

/**
 * Every country this talk is given in, ordered the way the tour runs (APJ
 * first). A dialling code that is not here is an attendee who cannot register,
 * so additions belong here rather than in either UI.
 */
export const AUDIENCE_COUNTRY_CODES: readonly CountryCode[] = [
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '+852', country: 'Hong Kong', flag: '🇭🇰' },
  { code: '+66', country: 'Thailand', flag: '🇹🇭' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭' },
  { code: '+84', country: 'Vietnam', flag: '🇻🇳' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+1', country: 'United States', flag: '🇺🇸' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
];

export const COUNTRY_CODES: readonly string[] = AUDIENCE_COUNTRY_CODES.map((c) => c.code);

/** Australia — where the talk was built and rehearsed. */
export const DEFAULT_COUNTRY_CODE = '+61';

/** The label a select shows for a code, e.g. `🇸🇬 Singapore +65`. */
export function countryCodeLabel(code: string): string {
  const entry = AUDIENCE_COUNTRY_CODES.find((c) => c.code === code);
  return entry ? `${entry.flag} ${entry.country} ${entry.code}` : code;
}

/**
 * Resolved rather than read, like `verifyChannelFor`: the field is optional on
 * the record, and a code the select cannot offer would leave the first phone in
 * the room unable to correct it — so an unknown value is the default.
 */
export function countryCodeFor(session: SessionRecord): string {
  return COUNTRY_CODES.includes(session.countryCode ?? '')
    ? (session.countryCode as string)
    : DEFAULT_COUNTRY_CODE;
}
