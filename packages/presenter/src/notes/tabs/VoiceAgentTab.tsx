import { useCallback, useEffect, useState } from 'react';
import { RELAY_TOOLS, resolveRelayConfig } from '@twilio-preso/shared';
import type { RelayConfig, RelayToolId } from '@twilio-preso/shared';
import { fetchRelayConfig, placeTestCall, saveRelayConfig } from '../../sessions';
import { ErrorText, Row, caption, heading, panel, smallButton, textInput } from '../ui';

/**
 * The voice agent, as the presenter configures it: instructions, greeting,
 * tools, TTS voice and language, ASR provider, and turn limits — plus the one
 * button that rings your own phone so you can hear all of it before an audience
 * does.
 *
 * A local draft, saved explicitly. Every field here changes what a live call
 * sounds like, and a half-typed prompt reaching a ringing phone is the failure
 * this avoids — same reason the deck editor works this way.
 */
export function VoiceAgentTab({ sessionId }: { sessionId: string }) {
  const [draft, setDraft] = useState<RelayConfig | null>(null);
  const [saved, setSaved] = useState<RelayConfig | null>(null);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [testNumber, setTestNumber] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const config = await fetchRelayConfig(sessionId);
        setDraft(config);
        setSaved(config);
      } catch (err: any) {
        setError(err?.message ?? 'Could not read the voice settings');
      }
    })();
  }, [sessionId]);

  const set = useCallback(<K extends keyof RelayConfig>(key: K, value: RelayConfig[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setStatus('');
  }, []);

  function setTool(id: RelayToolId, patch: { enabled?: boolean; whenToUse?: string }) {
    setDraft((d) =>
      d ? { ...d, tools: d.tools.map((t) => (t.id === id ? { ...t, ...patch } : t)) } : d
    );
    setStatus('');
  }

  async function save() {
    if (!draft) return;
    setError('');
    try {
      const config = await saveRelayConfig(sessionId, draft);
      setDraft(config);
      setSaved(config);
      setStatus('Saved — the next call uses these settings.');
    } catch (err: any) {
      setError(err?.message ?? 'Save failed');
    }
  }

  async function testCall() {
    setError('');
    setStatus('Calling…');
    try {
      const result = await placeTestCall(sessionId, testNumber.trim());
      setStatus(`Calling ${result.to} from ${result.from} — answer it.`);
    } catch (err: any) {
      setStatus('');
      setError(err?.message ?? 'Call failed');
    }
  }

  if (!draft) {
    return error ? <ErrorText>{error}</ErrorText> : <p style={{ color: '#7e869c' }}>Loading…</p>;
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  return (
    <div>
      {/* The test call sits first: it is the thing you reach for after every
          other edit on this tab. */}
      <div style={panel}>
        <Row style={{ marginBottom: 10 }}>
          <span style={heading}>End-to-end test call</span>
          {dirty && <span style={{ ...caption, color: '#ef223a' }}>unsaved edits</span>}
        </Row>
        <Row style={{ justifyContent: 'flex-start' }}>
          <input
            style={{ ...textInput, flex: 1 }}
            placeholder="Your own number (default) — E.164"
            value={testNumber}
            onChange={(e) => setTestNumber(e.target.value)}
          />
          <button style={{ ...smallButton, border: '1px solid #ef223a', color: '#ef223a' }} onClick={testCall}>
            Call me
          </button>
        </Row>
        <p style={{ ...caption, textTransform: 'none', letterSpacing: 0, marginTop: 8 }}>
          Rings from this session’s own number, straight into the agent with the settings below.
          In rehearsal it will only call your own number; arming the session lets you call anyone.
        </p>
      </div>

      <div style={panel}>
        <div style={heading}>Instructions</div>
        <textarea
          style={{ ...textInput, width: '100%', minHeight: 180, resize: 'vertical' }}
          value={draft.systemPrompt}
          onChange={(e) => set('systemPrompt', e.target.value)}
        />
        <p style={{ ...caption, textTransform: 'none', letterSpacing: 0, marginTop: 8 }}>
          <code>{'{{context}}'}</code> is replaced with what the agent knows about the caller — their
          name, this session’s answers, and their Conversation Memory profile. Remove it and that
          block is appended at the end instead.
        </p>
      </div>

      <div style={panel}>
        <div style={heading}>Greeting</div>
        <Row style={{ justifyContent: 'flex-start', marginBottom: 10 }}>
          <label style={{ fontSize: 13 }}>
            <input
              type="checkbox"
              checked={draft.generateGreeting}
              onChange={(e) => set('generateGreeting', e.target.checked)}
            />{' '}
            Write the opening line with the model
          </label>
        </Row>
        <div style={caption}>Opening-turn instruction</div>
        <textarea
          style={{ ...textInput, width: '100%', minHeight: 60, resize: 'vertical', margin: '6px 0 12px' }}
          value={draft.greetingInstruction}
          onChange={(e) => set('greetingInstruction', e.target.value)}
        />
        <div style={caption}>Fallback greeting — always spoken if the model gives nothing</div>
        <textarea
          style={{ ...textInput, width: '100%', minHeight: 60, resize: 'vertical', marginTop: 6 }}
          value={draft.staticGreeting}
          onChange={(e) => set('staticGreeting', e.target.value)}
        />
        <p style={{ ...caption, textTransform: 'none', letterSpacing: 0, marginTop: 8 }}>
          <code>{'{{name}}'}</code> becomes the caller’s name.
        </p>
      </div>

      <div style={panel}>
        <div style={heading}>Tools</div>
        {draft.tools.map((tool) => (
          <div key={tool.id} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 'bold' }}>
              <input
                type="checkbox"
                checked={tool.enabled}
                onChange={(e) => setTool(tool.id, { enabled: e.target.checked })}
              />{' '}
              {tool.id}
            </label>
            <input
              style={{ ...textInput, width: '100%', marginTop: 6, opacity: tool.enabled ? 1 : 0.5 }}
              value={tool.whenToUse}
              disabled={!tool.enabled}
              onChange={(e) => setTool(tool.id, { whenToUse: e.target.value })}
            />
          </div>
        ))}
        <div style={caption}>Transfer destination for handoff_to_human</div>
        <input
          style={{ ...textInput, width: '100%', marginTop: 6 }}
          placeholder="E.164 — defaults to the presenter who created the session"
          value={draft.handoffNumber}
          onChange={(e) => set('handoffNumber', e.target.value)}
        />
      </div>

      <div style={panel}>
        <div style={heading}>Voice &amp; language</div>
        <Field label="TTS voice" value={draft.voice} onChange={(v) => set('voice', v)} />
        <Field label="TTS provider" value={draft.ttsProvider} onChange={(v) => set('ttsProvider', v)} hint="Google · Amazon · ElevenLabs" />
        <Field label="Language (BCP-47)" value={draft.language} onChange={(v) => set('language', v)} hint="en-AU · en-GB · fr-FR · ja-JP" />
        <Field label="Transcription provider" value={draft.transcriptionProvider} onChange={(v) => set('transcriptionProvider', v)} hint="Google · Deepgram" />
        <Field label="Speech model" value={draft.speechModel} onChange={(v) => set('speechModel', v)} hint="blank uses the provider default" />
        <Field label="Model override" value={draft.model} onChange={(v) => set('model', v)} hint="blank uses VOICE_LLM_MODEL / LLM_MODEL" />
      </div>

      <div style={panel}>
        <div style={heading}>Call behaviour</div>
        <Row style={{ justifyContent: 'flex-start', gap: 20, marginBottom: 12 }}>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={draft.interruptible} onChange={(e) => set('interruptible', e.target.checked)} />{' '}
            Interruptible
          </label>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={draft.dtmfDetection} onChange={(e) => set('dtmfDetection', e.target.checked)} />{' '}
            DTMF detection
          </label>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={draft.useMemory} onChange={(e) => set('useMemory', e.target.checked)} />{' '}
            Read Conversation Memory
          </label>
        </Row>
        <Row style={{ justifyContent: 'flex-start' }}>
          <NumberField label="Turns — inbound" value={draft.maxTurnsInbound} onChange={(v) => set('maxTurnsInbound', v)} />
          <NumberField label="Turns — outbound finale" value={draft.maxTurnsOutbound} onChange={(v) => set('maxTurnsOutbound', v)} />
        </Row>
      </div>

      <Row style={{ justifyContent: 'flex-start' }}>
        <button
          style={{ ...smallButton, border: '1px solid #ef223a', color: dirty ? '#ef223a' : '#7e869c' }}
          onClick={save}
          disabled={!dirty}
        >
          Save settings
        </button>
        <button style={smallButton} onClick={() => setDraft(saved)} disabled={!dirty}>
          Discard
        </button>
        <button style={smallButton} onClick={() => setDraft(resolveRelayConfig({ tools: RELAY_TOOLS }))}>
          Reset to defaults
        </button>
        {status && <span style={{ fontSize: 12, color: '#babecc' }}>{status}</span>}
      </Row>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

function Field({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  hint?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={caption}>
        {label}
        {hint && <span style={{ textTransform: 'none', letterSpacing: 0 }}> · {hint}</span>}
      </div>
      <input style={{ ...textInput, width: '100%', marginTop: 4 }} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div style={caption}>{label}</div>
      <input
        type="number"
        min={1}
        style={{ ...textInput, width: 90, marginTop: 4 }}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 1)}
      />
    </div>
  );
}
