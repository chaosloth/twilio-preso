import { DEMO_TRIGGER_IDS } from '@twilio-preso/shared';
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
  const { demoEnabled, fireTrigger } = api;

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

      <div style={{ ...panel, marginBottom: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Audience URL</div>
        <div style={{ fontSize: 12, color: '#7e869c', wordBreak: 'break-all' }}>
          Join code {joinCode || '—'} · set VITE_AUDIENCE_URL to change the QR host
        </div>
      </div>
    </div>
  );
}
