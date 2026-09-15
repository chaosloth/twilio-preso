import Twilio from 'twilio';
import { resolveRelayConfig } from '@twilio-preso/shared';
import { config } from '../config.js';
import { getSessionById } from './sessions.js';

/**
 * Whether this account can actually play a room tone under the agent's voice.
 *
 * `agentAmbientSound` is gated on an internal account flag (1267). Unflagged,
 * Twilio does not fail the call — it raises an **XML validation warning (12200)**
 * per attribute, discards both, and connects dry. So the knob in the voice tab
 * looks like it works, the room hears nothing, and the only evidence is two
 * warnings per call in a log nobody reads mid-talk. Worse, those warnings sit
 * beside every *real* problem an inbound call has, which is how a Connect media
 * timeout came to look like an ambient-sound bug.
 *
 * There is no API that reports the flag, so this reads the consequence instead:
 * the account's own recent 12200 alerts, matched on the attribute name. That
 * makes the check evidence rather than inference — it says "this account rejected
 * it, N times, most recently at …", which is the thing worth acting on.
 */

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);

/** How far back to look. A talk's worth of calls, not the account's history. */
const ALERT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface AmbientSoundStatus {
  /** The URL this session would send, or '' when ambience is off. */
  url: string;
  gain: number;
  /** 12200s naming the attribute, inside the window. */
  rejections: number;
  lastRejectedAt: string | null;
  /**
   * Whether the file is the one shape ConversationRelay accepts: uncompressed
   * 16-bit PCM, mono, 8 kHz RIFF/WAVE. Anything else is a 64111 at call time.
   * `null` when it could not be read at all.
   */
  fileOk: boolean | null;
  fileDetail: string;
}

export async function probeAmbientSound(sessionId?: string): Promise<AmbientSoundStatus> {
  const session = sessionId ? await getSessionById(sessionId).catch(() => null) : null;
  const relay = resolveRelayConfig(session?.relay);
  const url = relay.ambientSound;

  const [alerts, file] = await Promise.all([
    countRejections().catch(() => ({ rejections: 0, lastRejectedAt: null })),
    url ? describeWavFile(url) : Promise.resolve({ fileOk: null, fileDetail: 'No file set.' }),
  ]);

  return { url, gain: relay.ambientSoundGain, ...alerts, ...file };
}

/** The account's own verdict, read from its alerts rather than assumed. */
async function countRejections(): Promise<{ rejections: number; lastRejectedAt: string | null }> {
  const alerts = await client.monitor.v1.alerts.list({
    logLevel: 'warning',
    startDate: new Date(Date.now() - ALERT_WINDOW_MS),
    limit: 200,
  });
  // Counted as warnings, not calls: both attributes are emitted together, so a
  // rejected call raises two of these. `alertText` is a url-encoded query string
  // — the attribute name survives it verbatim, which is what this matches on.
  const matching = alerts.filter(
    (a) => a.errorCode === '12200' && (a.alertText ?? '').includes('agentAmbientSound')
  );
  const last = matching.map((a) => a.dateGenerated).sort((a, b) => b.getTime() - a.getTime())[0];
  return { rejections: matching.length, lastRejectedAt: last ? last.toISOString() : null };
}

/**
 * The file's own header, not its content type.
 *
 * A server that serves `audio/wav` for an mp3 is the 64111 (`not a RIFF/WAVE
 * file`) nobody can explain from the URL alone, so this reads the 44-byte
 * canonical header: `RIFF….WAVEfmt `, format 1 (PCM), one channel, 8000 Hz,
 * 16 bits. Range-requested, because the file may be megabytes and this runs on
 * every HUD refresh.
 */
async function describeWavFile(url: string): Promise<{ fileOk: boolean | null; fileDetail: string }> {
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-63' } });
    if (!res.ok) return { fileOk: false, fileDetail: `The file could not be fetched: HTTP ${res.status}.` };
    const head = Buffer.from(await res.arrayBuffer());
    if (head.length < 36 || head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8, 12) !== 'WAVE') {
      return { fileOk: false, fileDetail: 'Not a RIFF/WAVE file — Twilio answers this with a 64111.' };
    }
    const format = head.readUInt16LE(20);
    const channels = head.readUInt16LE(22);
    const rate = head.readUInt32LE(24);
    const bits = head.readUInt16LE(34);
    const shape = `${format === 1 ? 'PCM' : `format ${format}`}, ${channels === 1 ? 'mono' : `${channels} channels`}, ${rate} Hz, ${bits}-bit`;
    const ok = format === 1 && channels === 1 && rate === 8000 && bits === 16;
    return {
      fileOk: ok,
      fileDetail: ok
        ? `Correct format: ${shape}.`
        : `Wrong format: ${shape}. It must be uncompressed 16-bit PCM, mono, 8 kHz.`,
    };
  } catch (err: any) {
    return { fileOk: null, fileDetail: `The file could not be read: ${err?.message ?? 'unreachable'}.` };
  }
}
