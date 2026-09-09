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
import { Row, heading, panel, smallButton } from '../ui';

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
  const { demoEnabled, fireTrigger, session, setCountryCode, setVerifyChannel } = api;
  const channel = session ? verifyChannelFor(session) : DEFAULT_VERIFY_CHANNEL;
  const countryCode = session ? countryCodeFor(session) : DEFAULT_COUNTRY_CODE;

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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {MANUAL_TRIGGERS.map((trigger) => (
            <button
              key={trigger}
              style={smallButton}
              onClick={() => {
                if (confirm(`Fire ${trigger}?`)) void fireTrigger(trigger);
              }}
            >
              {trigger}
            </button>
          ))}
        </div>
      </div>

      {/* The door, not the demo: which channel carries the passcode decides
          whether anyone gets in at all, so it is a per-session switch rather than
          a build-time default. */}
      <div style={panel}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Registration passcode</div>
        <Row style={{ justifyContent: 'flex-start', gap: 8 }}>
          {VERIFY_CHANNELS.map((option) => (
            <button
              key={option}
              style={{
                ...smallButton,
                border: `1px solid ${channel === option ? '#ef223a' : '#4d5777'}`,
                color: channel === option ? '#ef223a' : '#babecc',
              }}
              onClick={() => void setVerifyChannel(option)}
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
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Audience country code</div>
        <select
          value={countryCode}
          onChange={(e) => void setCountryCode(e.target.value)}
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

      <div style={{ ...panel, marginBottom: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Audience URL</div>
        <div style={{ fontSize: 12, color: '#7e869c', wordBreak: 'break-all' }}>
          Join code {joinCode || '—'} · set VITE_AUDIENCE_URL to change the QR host
        </div>
      </div>
    </div>
  );
}
