import { useEffect, useState } from 'react';
import {
  SAY_MAX_LOOP,
  SAY_MAX_MESSAGE,
  SAY_MAX_PAUSE_SECONDS,
  SAY_PROVIDERS,
  SAY_VOICE_PRESETS,
  resolveSayConfig,
  sayVoiceAttribute,
} from '@twilio-preso/shared';
import type { SayConfig, SayProvider } from '@twilio-preso/shared';
import { fetchSayConfig, saveSayConfig } from '../../sessions';
import { ErrorText, Row, caption, heading, panel, smallButton, textInput } from '../ui';

/**
 * The scripted mass call — `voice-mass-outbound` — as the presenter configures
 * it: the `<Say>` voice, language, loop, pause and the words every phone hears.
 *
 * A sub-tab of its own beside "Calls in" / "Calls out", because it belongs to
 * neither direction: it is a fixed script, not the agent, and its voice is
 * separate from the agent's on purpose. A local draft saved explicitly, like
 * every editor in the HUD — this is what a whole room hears at once.
 */
export function ScriptedCallPanel({ sessionId }: { sessionId: string }) {
  const [draft, setDraft] = useState<SayConfig | null>(null);
  const [saved, setSaved] = useState<SayConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    fetchSayConfig(sessionId)
      .then((config) => {
        if (!current) return;
        setDraft(config);
        setSaved(config);
      })
      .catch((err) => current && setError(err?.message ?? 'Could not read the scripted call'));
    return () => {
      current = false;
    };
  }, [sessionId]);

  if (!draft) return error ? <ErrorText>{error}</ErrorText> : <p style={{ color: '#7e869c' }}>Loading…</p>;

  const set = <K extends keyof SayConfig>(key: K, value: SayConfig[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setStatus('');
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  // What the backend will actually store — shown, so a typo that resolves to the
  // default is visible before it reaches a room of phones.
  const resolved = resolveSayConfig(draft);
  const voiceFellBack = draft.voice.trim() !== '' && resolved.voice !== draft.voice.trim();
  const languageDropped = draft.language.trim() !== '' && resolved.language === '';

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError('');
    try {
      const config = await saveSayConfig(sessionId, draft);
      setDraft(config);
      setSaved(config);
      setStatus('Saved — the next voice-mass-outbound uses it.');
    } catch (err: any) {
      setError(err?.message ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={panel}>
        <div style={heading}>Scripted mass call</div>
        <p style={{ ...caption, textTransform: 'none', letterSpacing: 0, marginBottom: 10 }}>
          What every phone hears when <code>voice-mass-outbound</code> fires. A fixed script read by
          TwiML <code>&lt;Say&gt;</code> — not the live agent, and separate from the agent’s voice.
        </p>

        <Row style={{ justifyContent: 'flex-start', alignItems: 'flex-start', gap: 16, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={caption}>Provider</div>
            <select
              style={{ ...textInput, width: '100%', marginTop: 4 }}
              value={draft.provider}
              onChange={(e) => {
                const provider = e.target.value as SayProvider;
                // A voice id belongs to its provider — carrying it across is a
                // voice that does not exist, so switch to that provider's preset.
                setDraft((d) => (d ? { ...d, provider, voice: SAY_VOICE_PRESETS[provider][0].id } : d));
                setStatus('');
              }}
            >
              {SAY_PROVIDERS.map((p) => (
                <option key={p} value={p} style={{ background: '#000d25' }}>
                  {p === 'Polly' ? 'Amazon Polly' : p}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 2 }}>
            <div style={caption}>
              Voice<span style={{ textTransform: 'none', letterSpacing: 0 }}> · or type any id the provider knows</span>
            </div>
            <input
              style={{ ...textInput, width: '100%', marginTop: 4 }}
              list="say-voice-presets"
              value={draft.voice}
              onChange={(e) => set('voice', e.target.value)}
            />
            <datalist id="say-voice-presets">
              {SAY_VOICE_PRESETS[draft.provider].map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </datalist>
          </div>
        </Row>
        {voiceFellBack && (
          <div style={{ margin: '-4px 0 10px' }}>
            <ErrorText>That is not a voice id — it will be saved as {resolved.voice}.</ErrorText>
          </div>
        )}

        <Row style={{ justifyContent: 'flex-start', alignItems: 'flex-start', gap: 16, marginBottom: 10 }}>
          <div style={{ flex: 2 }}>
            <div style={caption}>
              Language<span style={{ textTransform: 'none', letterSpacing: 0 }}> · BCP-47, blank for the voice’s own</span>
            </div>
            <input
              style={{ ...textInput, width: '100%', marginTop: 4 }}
              placeholder="e.g. en-AU"
              value={draft.language}
              onChange={(e) => set('language', e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={caption}>Repeat</div>
            <input
              type="number"
              min={1}
              max={SAY_MAX_LOOP}
              style={{ ...textInput, width: 80, marginTop: 4 }}
              value={draft.loop}
              onChange={(e) => set('loop', parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={caption}>End pause (s)</div>
            <input
              type="number"
              min={0}
              max={SAY_MAX_PAUSE_SECONDS}
              style={{ ...textInput, width: 80, marginTop: 4 }}
              value={draft.pauseSeconds}
              onChange={(e) => set('pauseSeconds', Math.max(0, parseInt(e.target.value, 10) || 0))}
            />
          </div>
        </Row>
        {languageDropped && (
          <div style={{ margin: '-4px 0 10px' }}>
            <ErrorText>Not a BCP-47 tag — it will be left off.</ErrorText>
          </div>
        )}

        <div style={caption}>
          Message<span style={{ textTransform: 'none', letterSpacing: 0 }}> · {draft.message.length}/{SAY_MAX_MESSAGE}</span>
        </div>
        <textarea
          style={{ ...textInput, width: '100%', minHeight: 140, resize: 'vertical', marginTop: 4 }}
          maxLength={SAY_MAX_MESSAGE}
          value={draft.message}
          onChange={(e) => set('message', e.target.value)}
        />

        <p style={{ ...caption, textTransform: 'none', letterSpacing: 0, marginTop: 8 }}>
          Sent as <code>&lt;Say voice="{sayVoiceAttribute(resolved)}"
          {resolved.language ? ` language="${resolved.language}"` : ''}
          {resolved.loop !== 1 ? ` loop="${resolved.loop}"` : ''}&gt;</code>
        </p>

        <Row style={{ justifyContent: 'flex-start', gap: 8, marginTop: 10 }}>
          <button style={smallButton} onClick={save} disabled={busy || !dirty}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button style={smallButton} onClick={() => saved && setDraft(saved)} disabled={busy || !dirty}>
            Revert
          </button>
          {status && <span style={{ fontSize: 13, color: '#babecc' }}>{status}</span>}
        </Row>
        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </div>
  );
}
