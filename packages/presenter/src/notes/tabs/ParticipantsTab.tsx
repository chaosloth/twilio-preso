import type { AdminApi } from '../useAdminApi';
import { Empty, Row, dangerButton, heading, smallButton } from '../ui';

export function ParticipantsTab({ api }: { api: AdminApi }) {
  const { participants, removeParticipant, resetSession } = api;

  return (
    <div>
      <Row style={{ marginBottom: 16 }}>
        <h3 style={{ ...heading, marginBottom: 0 }}>Participants ({participants.length})</h3>
        <button
          style={dangerButton}
          onClick={() => {
            if (confirm('Reset all participants and demo state?')) void resetSession();
          }}
        >
          Reset All
        </button>
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
              <button style={smallButton} onClick={() => void removeParticipant(p.id)}>
                Remove
              </button>
            </Row>
          ))}
        </div>
      )}
    </div>
  );
}
