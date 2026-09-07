/**
 * Shared chrome for the boot screens that sit in front of the canvas. Inline
 * styles rather than Tailwind — the presenter app has no CSS framework, and the
 * visual rules (background #000d25, red #ef223a, Tektur for headlines only) are
 * strict enough to be worth stating in one place.
 */
import type { CSSProperties } from 'react';

export const input: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  marginBottom: 12,
  borderRadius: 8,
  border: '1px solid rgba(239,34,58,0.4)',
  background: 'rgba(0,13,37,0.85)',
  color: '#ffffff',
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: 18,
};

export const button: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  marginTop: 4,
  borderRadius: 8,
  border: 'none',
  background: '#ef223a',
  color: '#ffffff',
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
};

export const label: CSSProperties = {
  display: 'block',
  color: '#7e869c',
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: 12,
  letterSpacing: 1,
  textTransform: 'uppercase',
  marginBottom: 8,
};

export function Shell({
  title,
  children,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000d25',
        color: '#ffffff',
        fontFamily: "'Space Grotesk', sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: wide ? 720 : 400 }}>
        <h1 style={{ fontFamily: "'Tektur', sans-serif", fontSize: 28, marginBottom: 24 }}>
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}
