import {
  AUDIENCE_COUNTRY_CODES,
  DEFAULT_COUNTRY_CODE,
  DEFAULT_VERIFY_CHANNEL,
  DEMO_TRIGGER_IDS,
  VERIFY_CHANNELS,
  countryCodeFor,
  verifyChannelFor,
} from '@twilio-preso/shared';
import type { AdminApi } from '../useAdminApi';
import { useState } from 'react';
import { ActionButton, Row, SaveState, heading, panel, smallButton } from '../ui';

/**
 * Every trigger the backend implements, derived rather than listed: a hardcoded
 * subset here silently hid the whole WhatsApp half of the demo from the HUD.
 *
 * `voice-agent-connect` is the one exception — it calls one volunteer, so it
 * needs a participant and is fired from their row in the Participants tab.
 */
const MANUAL_TRIGGERS = DEMO_TRIGGER_IDS.filter((id) => id !== 'voice-agent-connect');

interface ControlsTabProps {
  api: AdminApi;
  joinCode: string;
  onToggleDemo: () => void;
}

export function ControlsTab({ api, joinCode, onToggleDemo }: ControlsTabProps) {
  const { demoEnabled, fireTrigger, session, setCountryCode, setCountryCodes, setVerifyChannel } =
    api;
  const channel = session ? verifyChannelFor(session) : DEFAULT_VERIFY_CHANNEL;
  const countryCode = session ? countryCodeFor(session) : DEFAULT_COUNTRY_CODE;
  const [channelSave, setChannelSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [codeSave, setCodeSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [listSave, setListSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [filter, setFilter] = useState('');
  /**
   * The presenter's own list, unresolved: an empty one means "offer everything",
   * which is what a new session and every session created before this panel
   * existed holds. Reading the resolved list here would tick all 197 boxes and
   * make the first untick look like it disabled 196 countries.
   */
  const enabled = session?.countryCodes ?? [];
  const allOffered = enabled.length === 0;
  const shown = filter.trim()
    ? AUDIENCE_COUNTRY_CODES.filter((c) =>
        `${c.country} ${c.code}`.toLowerCase().includes(filter.trim().toLowerCase())
      )
    : AUDIENCE_COUNTRY_CODES;

  const saveList = (codes: string[]) => void track(setListSave)(() => setCountryCodes(codes));
  const toggleCode = (code: string) => {
    // From "everything" the first tick has to mean *only* that code, not "all
    // but one" — the box was never really ticked, the list was simply empty.
    if (allOffered) return saveList([code]);
    saveList(enabled.includes(code) ? enabled.filter((c) => c !== code) : [...enabled, code]);
  };

  /** Save-on-change with something on screen while it is in flight: these two
   *  write to the session record, and a select that snaps back after a failed
   *  write with no word said is how a room registers on the wrong prefix. */
  const track =
    (set: (s: 'idle' | 'saving' | 'saved' | 'error') => void) =>
    async (run: () => Promise<void>) => {
      set('saving');
      try {
        await run();
        set('saved');
      } catch {
        set('error');
      }
    };

  return (
    <div>
      <h3 style={heading}>Demo Controls</h3>

      <div style={panel}>
        <Row>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Demo Mode</div>
            <div style={{ fontSize: 12, color: '#7e869c' }}>
              {demoEnabled
                ? 'SMS and calls will fire on demo stages'
                : 'All SMS and calls are suppressed'}
            </div>
          </div>
          <button
            onClick={onToggleDemo}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              fontSize: 13,
              fontWeight: 'bold',
              cursor: 'pointer',
              background: demoEnabled ? '#ef223a' : '#4d5777',
              color: 'white',
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
            }}
          >
            {demoEnabled ? 'LIVE' : 'REHEARSAL'}
          </button>
        </Row>
      </div>

      <div style={panel}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Manual Triggers</div>
        {/* Every one of these sends real SMS or places real calls, and the
            backend refuses them all with a 409 while the session is in
            rehearsal — so they are disabled rather than offered as a failure. */}
        {!demoEnabled && (
          <div style={{ fontSize: 12, color: '#7e869c', marginBottom: 8 }}>
            Rehearsal mode — switch to LIVE above to fire these.
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {MANUAL_TRIGGERS.map((trigger) => (
            <ActionButton
              key={trigger}
              disabled={!demoEnabled}
              disabledReason="Rehearsal mode — no SMS or calls are sent"
              pendingLabel={`${trigger}…`}
              onClick={async () => {
                if (confirm(`Fire ${trigger}?`)) await fireTrigger(trigger);
              }}
            >
              {trigger}
            </ActionButton>
          ))}
        </div>
      </div>

      {/* The door, not the demo: which channel carries the passcode decides
          whether anyone gets in at all, so it is a per-session switch rather than
          a build-time default. */}
      <div style={panel}>
        <Row style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Registration passcode</div>
          <SaveState state={channelSave} />
        </Row>
        <Row style={{ justifyContent: 'flex-start', gap: 8 }}>
          {VERIFY_CHANNELS.map((option) => (
            <button
              key={option}
              style={{
                ...smallButton,
                border: `1px solid ${channel === option ? '#ef223a' : '#4d5777'}`,
                color: channel === option ? '#ef223a' : '#babecc',
              }}
              onClick={() => void track(setChannelSave)(() => setVerifyChannel(option))}
            >
              {option === 'whatsapp' ? 'WhatsApp' : 'SMS'}
            </button>
          ))}
        </Row>
        <div style={{ fontSize: 12, color: '#7e869c', marginTop: 8 }}>
          What every phone is offered first. An attendee can still switch on their own screen, and a
          WhatsApp code that fails to send falls back to SMS per phone.
        </div>
      </div>

      {/* Also the door: a Singapore room typing local numbers against an
          Australian default registers nobody, and that cannot be fixed one
          phone at a time. */}
      <div style={panel}>
        <Row style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Audience country code</div>
          <SaveState state={codeSave} />
        </Row>
        <select
          value={countryCode}
          onChange={(e) => void track(setCodeSave)(() => setCountryCode(e.target.value))}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 6,
            background: '#000d25',
            border: '1px solid #4d5777',
            color: '#ffffff',
            fontSize: 13,
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
          }}
        >
          {AUDIENCE_COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.country} ({c.code})
            </option>
          ))}
        </select>
        <div style={{ fontSize: 12, color: '#7e869c', marginTop: 8 }}>
          Which code the registration screen starts on. An attendee can still pick another — this is
          what the room does not have to think about.
        </div>
      </div>

      {/* Which of them the screen offers at all. A room in Singapore has no use
          for two hundred options, and each one is a prefix an attendee can type
          a number Verify cannot reach. */}
      <div style={panel}>
        <Row style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Countries on the registration screen</div>
          <SaveState state={listSave} />
        </Row>
        <div style={{ fontSize: 12, color: '#7e869c', marginBottom: 8 }}>
          {allOffered
            ? `Every country (${AUDIENCE_COUNTRY_CODES.length}). Tick one to offer only the ones you pick.`
            : `${enabled.length} offered. The default (${countryCode}) is always offered, whatever is ticked here.`}
        </div>
        <Row style={{ marginBottom: 8, gap: 6 }}>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter countries"
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: 6,
              background: '#000d25',
              border: '1px solid #4d5777',
              color: '#ffffff',
              fontSize: 12,
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
            }}
          />
          <button style={smallButton} onClick={() => saveList([])}>
            Offer all
          </button>
          <button style={smallButton} onClick={() => saveList([countryCode])}>
            Only {countryCode}
          </button>
        </Row>
        <div
          style={{
            maxHeight: 240,
            overflowY: 'auto',
            border: '1px solid #4d5777',
            borderRadius: 6,
            padding: 6,
          }}
        >
          {shown.map((c) => (
            <label
              key={c.code}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '3px 4px',
                fontSize: 12,
                color: c.code === countryCode ? '#ffffff' : '#babecc',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={allOffered || enabled.includes(c.code) || c.code === countryCode}
                disabled={c.code === countryCode && !allOffered}
                onChange={() => toggleCode(c.code)}
              />
              <span>
                {c.flag} {c.country} ({c.code})
              </span>
            </label>
          ))}
          {shown.length === 0 && (
            <div style={{ fontSize: 12, color: '#7e869c', padding: 4 }}>No country matches that.</div>
          )}
        </div>
      </div>

      <div style={{ ...panel, marginBottom: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Audience URL</div>
        <div style={{ fontSize: 12, color: '#7e869c', wordBreak: 'break-all' }}>
          Join code {joinCode || '—'} · set VITE_AUDIENCE_URL to change the QR host
        </div>
      </div>
    </div>
  );
}
