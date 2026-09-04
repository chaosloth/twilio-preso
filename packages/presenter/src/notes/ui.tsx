/**
 * Shared styling for the HUD tabs. Inline styles, matching the rest of the
 * presenter app — background #000d25, panels #0a1535, red #ef223a, and Tektur
 * reserved for headlines.
 */
import type { CSSProperties, ReactNode } from 'react';

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
