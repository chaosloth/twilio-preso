import { useCallback, useEffect, useRef, useState } from 'react';
import {
  forgetSession,
  listSavedSessions,
  resolveJoinCode,
  type JoinedSession,
  type StoredSession,
} from '../session';

interface JoinProps {
  /** Code lifted from a `/j/:code` deep link, resolved on mount. */
  initialCode: string | null;
  onJoined: (session: JoinedSession) => void;
}

/** How often a `draft` session is re-checked while the audience waits. */
const DRAFT_POLL_MS = 5000;

const input =
  'w-full px-4 py-3 rounded-lg bg-white/5 border border-accent-3/30 text-white placeholder-accent-2 focus:outline-none focus:border-twilio-red text-center text-2xl tracking-[0.3em] uppercase';
const button = 'w-full py-3 rounded-lg bg-twilio-red text-white font-bold text-lg disabled:opacity-50';

export function Join({ initialCode, onJoined }: JoinProps) {
  const [code, setCode] = useState(initialCode ?? '');
  const [loading, setLoading] = useState(!!initialCode);
  const [error, setError] = useState('');
  /** A resolved session that isn't joinable yet or ever — draft or ended. */
  const [pending, setPending] = useState<JoinedSession | null>(null);
  const [saved, setSaved] = useState<StoredSession[]>(() => listSavedSessions());

  const attempt = useCallback(
    async (raw: string) => {
      setLoading(true);
      setError('');
      const result = await resolveJoinCode(raw);
      setLoading(false);

      if (!result.ok) {
        setPending(null);
        setError(result.error);
        return;
      }
      if (result.session.status === 'live') {
        onJoined(result.session);
        return;
      }
      // draft or ended: hold on a screen that explains which, rather than
      // dropping the audience into a registration form that would 409.
      setPending(result.session);
    },
    [onJoined]
  );

  // Deep link: resolve once, without making the audience read a code aloud.
  const attempted = useRef(false);
  useEffect(() => {
    if (initialCode && !attempted.current) {
      attempted.current = true;
      void attempt(initialCode);
    }
  }, [initialCode, attempt]);

  // A draft session is about to start — keep checking so the phone flips to the
  // form by itself when the presenter goes live.
  useEffect(() => {
    if (pending?.status !== 'draft') return;
    const timer = setInterval(() => void attempt(pending.joinCode), DRAFT_POLL_MS);
    return () => clearInterval(timer);
  }, [pending, attempt]);

  function reset() {
    setPending(null);
    setError('');
    setCode('');
  }

  if (pending?.status === 'ended') {
    return (
      <Shell title={pending.title}>
        <p className="text-accent-2 text-center">This session has finished. Thanks for joining.</p>
        <button type="button" className={button} onClick={reset}>
          Enter another code
        </button>
      </Shell>
    );
  }

  if (pending?.status === 'draft') {
    return (
      <Shell title={pending.title}>
        <p className="text-accent-2 text-center">Not started yet — hang tight.</p>
        <p className="text-accent-3 text-xs text-center">Checking every few seconds…</p>
      </Shell>
    );
  }

  return (
    <Shell title="Wonder — Twilio Live Demo">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void attempt(code);
        }}
      >
        <label className="block text-accent-2 text-sm text-center" htmlFor="join-code">
          Enter the code shown on screen
        </label>
        <input
          id="join-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={12}
          placeholder="CODE"
          className={input}
        />
        {error && <p className="text-twilio-red text-sm text-center">{error}</p>}
        <button type="submit" disabled={loading} className={button}>
          {loading ? 'Checking…' : 'Join'}
        </button>
      </form>

      {saved.length > 0 && (
        <div className="pt-4 space-y-2">
          <p className="text-accent-3 text-xs text-center">Rejoin</p>
          {saved.map((s) => (
            <div key={s.sessionId} className="flex gap-2">
              <button
                type="button"
                className="flex-1 py-2 rounded-lg border border-accent-3/30 text-white text-sm"
                onClick={() => void attempt(s.joinCode)}
              >
                {s.title} · {s.joinCode}
              </button>
              <button
                type="button"
                aria-label={`Forget ${s.title}`}
                className="px-3 py-2 rounded-lg border border-accent-3/30 text-accent-2 text-sm"
                onClick={() => {
                  forgetSession(s.sessionId);
                  setSaved(listSavedSessions());
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-3xl font-bold text-center">{title}</h1>
        {children}
      </div>
    </div>
  );
}
