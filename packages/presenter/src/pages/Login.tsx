import { useState } from 'react';
import { completeLogin, startLogin, type PresenterIdentity } from '../auth';
import { Shell, button, input, label } from './chrome';

interface LoginProps {
  onSignedIn: (identity: PresenterIdentity) => void;
}

export function Login({ onSignedIn }: LoginProps) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('+61');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Presenter sign-in">
      {step === 'phone' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await startLogin(phone);
              setStep('code');
            });
          }}
        >
          <label style={label} htmlFor="phone">
            Mobile number, with country code
          </label>
          <input
            id="phone"
            style={input}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoFocus
            inputMode="tel"
          />
          {error && <Error>{error}</Error>}
          <button style={button} disabled={busy} type="submit">
            {busy ? 'Sending…' : 'Send code'}
          </button>
          {/* Deliberate: the backend reports success either way, so it cannot be
              used to discover who is allowed to present. */}
          <p style={{ ...label, marginTop: 12 }}>
            A code arrives only if this number is on the presenter allowlist.
          </p>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => onSignedIn(await completeLogin(phone, code)));
          }}
        >
          <label style={label} htmlFor="code">
            6-digit code sent to {phone}
          </label>
          <input
            id="code"
            style={{ ...input, letterSpacing: 8, textAlign: 'center' }}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            inputMode="numeric"
            maxLength={6}
          />
          {error && <Error>{error}</Error>}
          <button style={button} disabled={busy} type="submit">
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button
            style={{ ...button, background: 'transparent', border: '1px solid #4d5777' }}
            type="button"
            onClick={() => {
              setStep('phone');
              setCode('');
              setError('');
            }}
          >
            Use a different number
          </button>
        </form>
      )}
    </Shell>
  );
}

function Error({ children }: { children: React.ReactNode }) {
  return <p style={{ color: '#ef223a', fontSize: 13, margin: '10px 0 0' }}>{children}</p>;
}
