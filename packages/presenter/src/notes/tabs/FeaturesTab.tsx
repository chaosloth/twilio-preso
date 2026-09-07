import { useCallback, useEffect, useState } from 'react';
import type { FeatureReport, FeatureState } from '@twilio-preso/shared';
import { presenterFetch } from '../../auth';
import { caption, Empty, ErrorText, heading, panel, smallButton } from '../ui';

/**
 * Pre-flight: what is actually configured, and what state it is in right now.
 *
 * Every integration in this app degrades quietly on purpose — an unset memory
 * store, an absent relay URL, a session still in rehearsal — so the only place
 * the truth shows up is here. Fetched on demand rather than polled: it makes
 * live API calls against Sync, Verify, Messaging and Memory to prove each one is
 * reachable, not merely present in the env.
 */
export function FeaturesTab({ sessionId }: { sessionId: string }) {
  const [report, setReport] = useState<FeatureReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** Which action is in flight, and what the last one said. */
  const [acting, setActing] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await presenterFetch(
        `/api/features${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      setReport((await res.json()) as FeatureReport);
    } catch (err: any) {
      setError(err?.message ?? 'failed to load');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const runAction = useCallback(
    async (id: string, path: string) => {
      setActing(id);
      setActionResult(null);
      try {
        const res = await presenterFetch(path, { method: 'POST' });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? `status ${res.status}`);
        setActionResult(
          Array.isArray(body?.created) && body.created.length > 0
            ? `Declared ${body.created.join(', ')}.`
            : 'Nothing left to do.'
        );
      } catch (err: any) {
        setActionResult(err?.message ?? 'failed');
      } finally {
        setActing(null);
        // The button's own answer is whatever the next check says, not what the
        // POST returned — the control plane indexes asynchronously.
        await load();
      }
    },
    [load]
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ ...heading, marginBottom: 0 }}>Configuration</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {report && (
            <span style={caption}>
              checked {new Date(report.generatedAt).toLocaleTimeString()}
            </span>
          )}
          <button style={smallButton} onClick={() => void load()} disabled={loading}>
            {loading ? 'checking…' : 'Re-check'}
          </button>
        </div>
      </div>

      {error && <ErrorText>Could not read configuration: {error}</ErrorText>}
      {!report && !error && <Empty>Checking services…</Empty>}

      {report?.features.map((feature) => (
        <div key={feature.id} style={{ ...panel, marginBottom: 10, borderLeft: `3px solid ${stateColor(feature.state)}` }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Badge state={feature.state} />
            <span style={{ fontSize: 14, fontWeight: 'bold' }}>{feature.label}</span>
          </div>
          <p style={{ fontSize: 12, color: '#babecc', margin: '8px 0 0' }}>{feature.detail}</p>
          {feature.values && feature.values.length > 0 && (
            <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>
              {feature.values.map((v) => (
                <div key={v.label} style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                  <span style={{ color: '#7e869c', minWidth: 130 }}>{v.label}</span>
                  {/* Sids and URLs are read aloud or pasted from here, so they
                      are selectable monospace rather than truncated. */}
                  <span style={{ fontFamily: 'monospace', wordBreak: 'break-all', color: '#ffffff' }}>
                    {v.value}
                  </span>
                </div>
              ))}
            </div>
          )}
          {feature.action && (
            <button
              style={{ ...smallButton, marginTop: 10 }}
              onClick={() => void runAction(feature.id, feature.action!.path)}
              disabled={acting !== null}
            >
              {acting === feature.id ? 'working…' : feature.action.label}
            </button>
          )}
        </div>
      ))}

      {actionResult && <p style={{ ...caption, marginBottom: 10 }}>{actionResult}</p>}

      {report && (
        <div style={panel}>
          <h4 style={{ ...heading, fontSize: 14 }}>Phone pool</h4>
          {report.phonePool.length === 0 ? (
            <Empty>No numbers configured.</Empty>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {report.phonePool.map((entry) => (
                <div key={entry.phoneNumber} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 12 }}>
                  <span style={{ fontFamily: 'monospace', color: entry.isThisSession ? '#ffffff' : '#babecc' }}>
                    {entry.phoneNumber}
                  </span>
                  {entry.isThisSession && (
                    <span style={{ color: '#ef223a', fontSize: 10, letterSpacing: 1 }}>THIS SESSION</span>
                  )}
                  <span style={{ color: '#7e869c' }}>
                    {entry.sessionId
                      ? `claimed by ${entry.sessionTitle}${entry.joinCode ? ` (${entry.joinCode})` : ''}`
                      : 'free'}
                  </span>
                </div>
              ))}
            </div>
          )}
          {/* One number per concurrent session, because the voice agent resolves
              a session from the number that was called. */}
          <p style={{ fontSize: 11, color: '#7e869c', margin: '10px 0 0' }}>
            One number per concurrent session — a free number is a session you can still run.
          </p>
        </div>
      )}
    </div>
  );
}

function stateColor(state: FeatureState): string {
  if (state === 'ok') return '#3ddc97';
  if (state === 'warn') return '#f0a83c';
  if (state === 'error') return '#ef223a';
  return '#4d5777';
}

const STATE_LABEL: Record<FeatureState, string> = {
  ok: 'ON',
  off: 'OFF',
  warn: 'CHECK',
  error: 'BROKEN',
};

function Badge({ state }: { state: FeatureState }) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 10,
        fontSize: 10,
        letterSpacing: 1,
        fontWeight: 'bold',
        background: state === 'off' ? '#1e3a5f' : stateColor(state),
        color: state === 'off' ? '#babecc' : '#000d25',
      }}
    >
      {STATE_LABEL[state]}
    </span>
  );
}
