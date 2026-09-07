import { useCallback, useEffect, useState } from 'react';
import type { PhonePoolUsage, SessionRecord } from '@twilio-preso/shared';
import { clearToken, type PresenterIdentity } from '../auth';
import {
  createSession,
  download,
  endSession,
  listSessions,
  setStatus,
} from '../sessions';
import { Shell, button, input, label } from './chrome';

interface SessionPickerProps {
  presenter: PresenterIdentity;
  onPicked: (session: SessionRecord) => void;
  onSignedOut: () => void;
}

const STATUS_COLOUR: Record<SessionRecord['status'], string> = {
  draft: '#7e869c',
  live: '#ef223a',
  ended: '#4d5777',
};

export function SessionPicker({ presenter, onPicked, onSignedOut }: SessionPickerProps) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [poolInUse, setPoolInUse] = useState<PhonePoolUsage[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSessions(await listSessions());
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setPoolInUse(null);
    try {
      await fn();
    } catch (err: any) {
      setError(err.message);
      // A 409 carries the sessions holding each pooled number, so the presenter
      // can go end the stale one instead of being told "no" with nowhere to go.
      if (err.inUse) setPoolInUse(err.inUse);
    } finally {
      setBusy(false);
    }
  }

  /** A session must be `live` before phones can register or respond, so going
   *  live is part of walking on stage rather than a separate chore. `isLive` —
   *  the outbound-Twilio gate — stays off until it is armed in the HUD. */
  function drive(session: SessionRecord) {
    void run(async () => {
      const ready = session.status === 'draft' ? await setStatus(session.id, 'live') : session;
      onPicked(ready);
    });
  }

  return (
    <Shell title="Sessions" wide>
      <p style={{ ...label, marginBottom: 20 }}>
        Signed in as {presenter.name} ({presenter.phone}) ·{' '}
        <button
          type="button"
          onClick={() => {
            clearToken();
            onSignedOut();
          }}
          style={{ background: 'none', border: 'none', color: '#ef223a', cursor: 'pointer', font: 'inherit' }}
        >
          sign out
        </button>
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const { session } = await createSession(title.trim());
            setTitle('');
            await refresh();
            onPicked(await setStatus(session.id, 'live'));
          });
        }}
        style={{ marginBottom: 28 }}
      >
        <label style={label} htmlFor="title">
          New session
        </label>
        <input
          id="title"
          style={input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Melbourne — August"
        />
        <button style={button} type="submit" disabled={busy || !title.trim()}>
          {busy ? 'Working…' : 'Create and start'}
        </button>
      </form>

      {error && <p style={{ color: '#ef223a', fontSize: 13 }}>{error}</p>}
      {poolInUse && (
        <ul style={{ ...label, textTransform: 'none', letterSpacing: 0 }}>
          {poolInUse.map((u) => (
            <li key={u.phoneNumber}>
              {u.phoneNumber} — {u.sessionTitle} {u.joinCode && `(${u.joinCode})`}
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sessions.length === 0 && <p style={label}>No sessions yet.</p>}
        {sessions.map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderRadius: 10,
              background: 'rgba(0,13,37,0.85)',
              border: '1px solid rgba(239,34,58,0.25)',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: '#7e869c' }}>
                {s.joinCode} · {s.phoneNumber} ·{' '}
                <span style={{ color: STATUS_COLOUR[s.status] }}>{s.status}</span>
              </div>
            </div>
            {s.status !== 'ended' && (
              <button
                style={{ ...button, width: 'auto', marginTop: 0 }}
                disabled={busy}
                onClick={() => drive(s)}
              >
                {s.status === 'live' ? 'Resume' : 'Start'}
              </button>
            )}
            {s.status !== 'ended' && (
              <button
                style={{
                  ...button,
                  width: 'auto',
                  marginTop: 0,
                  background: 'transparent',
                  border: '1px solid #4d5777',
                  color: '#babecc',
                }}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    if (!confirm(`End "${s.title}"? This deletes its Sync data.`)) return;
                    // The snapshot comes back with the call that destroys it, so
                    // it is downloaded here rather than trusted to a later export.
                    const { snapshot, csv, filenames } = await endSession(s.id);
                    download(filenames.json, JSON.stringify(snapshot, null, 2), 'application/json');
                    download(filenames.csv, csv, 'text/csv');
                    await refresh();
                  })
                }
              >
                End &amp; export
              </button>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}
