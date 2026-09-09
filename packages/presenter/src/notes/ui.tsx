/**
 * Shared styling for the HUD tabs. Inline styles, matching the rest of the
 * presenter app — background #000d25, panels #0a1535, red #ef223a, and Tektur
 * reserved for headlines.
 */
import { useState, type CSSProperties, type ReactNode } from 'react';

export const panel: CSSProperties = {
  padding: 16,
  background: '#0a1535',
  borderRadius: 8,
  marginBottom: 16,
};

export const heading: CSSProperties = {
  fontSize: 16,
  fontWeight: 'bold',
  marginBottom: 16,
};

export const smallButton: CSSProperties = {
  padding: '6px 10px',
  borderRadius: 4,
  border: '1px solid #4d5777',
  background: 'transparent',
  color: '#babecc',
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: "'Space Grotesk', system-ui, sans-serif",
};

export const dangerButton: CSSProperties = {
  ...smallButton,
  border: '1px solid #ef223a',
  color: '#ef223a',
};

export const textInput: CSSProperties = {
  padding: '7px 10px',
  borderRadius: 4,
  border: '1px solid #4d5777',
  background: '#000d25',
  color: '#ffffff',
  fontFamily: "'Space Grotesk', system-ui, sans-serif",
  fontSize: 13,
};

export const caption: CSSProperties = {
  fontSize: 11,
  color: '#7e869c',
  letterSpacing: 1,
  textTransform: 'uppercase',
};

export function Row({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p style={{ color: '#7e869c', fontSize: 14 }}>{children}</p>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p style={{ color: '#ef223a', fontSize: 12, margin: '8px 0 0' }}>{children}</p>;
}

/**
 * A button for anything that talks to the backend.
 *
 * Every action in this HUD is a round trip — a trigger that places calls, a deck
 * commit, an allowlist write — and until now a press did nothing visible until it
 * finished. On stage that reads as a dead button, so it gets pressed again: a
 * second identical trigger, or a save racing its own predecessor. So the press
 * disables the button, says what it is doing, and reports a failure in place
 * rather than only in the console.
 */
export function ActionButton({
  children,
  onClick,
  style,
  disabled,
  disabledReason,
  pendingLabel = 'Working…',
}: {
  children: ReactNode;
  onClick: () => void | Promise<void>;
  style?: CSSProperties;
  disabled?: boolean;
  /** Shown as the button's tooltip when disabled — why, not just that. */
  disabledReason?: string;
  pendingLabel?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const off = pending || disabled === true;

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <button
        style={{
          ...smallButton,
          ...style,
          opacity: off ? 0.45 : 1,
          cursor: off ? 'not-allowed' : 'pointer',
        }}
        disabled={off}
        title={disabled ? disabledReason : undefined}
        onClick={async () => {
          setError(null);
          setPending(true);
          try {
            await onClick();
          } catch (err: any) {
            setError(err?.message || 'failed');
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? pendingLabel : children}
      </button>
      {error && <span style={{ color: '#ef223a', fontSize: 10 }}>{error}</span>}
    </span>
  );
}

/** A quiet "saved"/"saving…" marker for controls that save on change. */
export function SaveState({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') return null;
  const label = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save failed';
  return (
    <span style={{ fontSize: 11, color: state === 'error' ? '#ef223a' : '#7e869c' }}>{label}</span>
  );
}
