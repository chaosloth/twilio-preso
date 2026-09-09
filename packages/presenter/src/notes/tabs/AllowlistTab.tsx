import { useCallback, useEffect, useState } from 'react';
import type { Presenter } from '@twilio-preso/shared';
import { whoAmI } from '../../auth';
import { addPresenter, listPresenters, removePresenter } from '../../sessions';
import { Empty, ErrorText, Row, caption, dangerButton, heading, smallButton, textInput } from '../ui';

/**
 * The presenter allowlist — the only thing that decides who may present.
 *
 * Entries are keyed by the E.164 number Verify reports back, so the backend
 * runs a lookup on add rather than trusting what was typed. It also refuses to
 * remove the signed-in presenter's own entry, which is why no guard for that
 * case is needed here: the 400 is surfaced like any other error.
 */
export function AllowlistTab() {
  const [presenters, setPresenters] = useState<Presenter[]>([]);
  /** This window is its own React root, so it asks who it is signed in as
   *  rather than being told — it needs the phone to grey out self-removal. */
  const [selfPhone, setSelfPhone] = useState<string | undefined>();
  const [phone, setPhone] = useState('+61');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setPresenters(await listPresenters());
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    whoAmI().then((me) => setSelfPhone(me?.phone));
  }, [refresh]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 style={heading}>Presenters ({presenters.length})</h3>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await addPresenter(phone.trim(), name.trim());
            setName('');
            setPhone('+61');
          });
        }}
        style={{ display: 'flex', gap: 8, marginBottom: 8 }}
      >
        <input
          style={{ ...textInput, width: 150 }}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          aria-label="Phone, with country code"
        />
        <input
          style={{ ...textInput, flex: 1 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          aria-label="Name"
        />
        <button style={smallButton} type="submit" disabled={busy || !phone.trim() || !name.trim()}>
          {busy ? 'Working…' : 'Add'}
        </button>
      </form>
      <div style={{ ...caption, marginBottom: 16 }}>Include the country code, e.g. +61…</div>

      {error && <ErrorText>{error}</ErrorText>}

      {presenters.length === 0 ? (
        <Empty>No presenters listed.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {presenters.map((p) => (
            <Row key={p.phone} style={{ padding: '8px 12px', background: '#0a1535', borderRadius: 6 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {p.name}
                  {p.phone === selfPhone && <span style={{ color: '#7e869c' }}> · you</span>}
                </div>
                <div style={{ fontSize: 11, color: '#7e869c' }}>
                  {p.phone} · added by {p.addedBy}
                </div>
              </div>
              {p.phone !== selfPhone && (
                <button
                  style={dangerButton}
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Remove ${p.name}'s access?`)) {
                      void run(() => removePresenter(p.phone));
                    }
                  }}
                >
                  Remove
                </button>
              )}
            </Row>
          ))}
        </div>
      )}
    </div>
  );
}
