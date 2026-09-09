import type { AdminApi } from '../useAdminApi';
import { ActionButton, Empty, Row, dangerButton, heading } from '../ui';

export function ParticipantsTab({ api }: { api: AdminApi }) {
  const { participants, removeParticipant, resetSession, fireTrigger, demoEnabled } = api;
  /**
   * Rehearsal is not a soft gate: `/api/trigger` refuses outright with a 409 when
   * the session is not armed, so a Call button offered here can only fail. The
   * tooltip says which switch to flip rather than leaving a red error on stage.
   */
  const rehearsal = !demoEnabled;

  return (
    <div>
      <Row style={{ marginBottom: 16 }}>
        <h3 style={{ ...heading, marginBottom: 0 }}>Participants ({participants.length})</h3>
        <ActionButton
          style={dangerButton}
          pendingLabel="Resetting…"
          onClick={async () => {
            if (confirm('Reset all participants and demo state?')) await resetSession();
          }}
        >
          Reset All
        </ActionButton>
      </Row>

      {participants.length === 0 ? (
        <Empty>No participants yet. Share the QR code to get started.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {participants.map((p) => (
            <Row key={p.id} style={{ padding: '8px 12px', background: '#0a1535', borderRadius: 6 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#7e869c' }}>
                  {p.phone} {p.company && `· ${p.company}`}
                </div>
              </div>
              <Row style={{ gap: 6, flex: '0 0 auto' }}>
                {/* The only way to fire `voice-agent-connect`: it calls one
                    volunteer, so it needs the participant a button row can name. */}
                <ActionButton
                  disabled={rehearsal}
                  disabledReason="Rehearsal mode — arm the session in Controls to place real calls"
                  pendingLabel="Calling…"
                  onClick={async () => {
                    if (confirm(`Call ${p.name} on ${p.phone} with the voice agent?`)) {
                      await fireTrigger('voice-agent-connect', p.id);
                    }
                  }}
                >
                  Call
                </ActionButton>
                <ActionButton pendingLabel="Removing…" onClick={() => removeParticipant(p.id)}>
                  Remove
                </ActionButton>
              </Row>
            </Row>
          ))}
        </div>
      )}
    </div>
  );
}
