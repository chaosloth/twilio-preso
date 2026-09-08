import { useCallback, useEffect, useState } from 'react';
import {
  INTERRUPT_MODES,
  INTERRUPT_SENSITIVITIES,
  RELAY_TOOLS,
  SPEECH_MODELS,
  TRANSCRIPTION_PROVIDERS,
  TTS_PROVIDERS,
  VOICE_PRESETS,
  resolveRelayConfig,
} from '@twilio-preso/shared';
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
        {/* Provider first: it decides which voice ids and speech models are even
            valid, and a mismatched pair is not a validation error — it is a call
            that ends mid-sentence. */}
        <Select
          label="TTS provider"
          value={draft.ttsProvider}
          options={TTS_PROVIDERS.map((p) => ({ value: p, label: p }))}
          onChange={(v) => set('ttsProvider', v as RelayConfig['ttsProvider'])}
        />
        <Select
          label="TTS voice"
          hint="or type any voice id the provider knows"
          value={draft.voice}
          freeText
          options={VOICE_PRESETS[draft.ttsProvider].map((v) => ({ value: v.id, label: `${v.label} · ${v.id}` }))}
          onChange={(v) => set('voice', v)}
        />
        <Field label="Language (BCP-47)" value={draft.language} onChange={(v) => set('language', v)} hint="en-AU · en-GB · fr-FR · ja-JP" />
        <Select
          label="Transcription provider"
          value={draft.transcriptionProvider}
          options={TRANSCRIPTION_PROVIDERS.map((p) => ({ value: p, label: p }))}
          onChange={(v) => set('transcriptionProvider', v as RelayConfig['transcriptionProvider'])}
        />
        <Select
          label="Speech model"
          hint="leave on the provider default unless you have a reason"
          value={draft.speechModel}
          options={SPEECH_MODELS[draft.transcriptionProvider].map((m) => ({
            value: m,
            label: m || 'provider default (recommended)',
          }))}
          onChange={(v) => set('speechModel', v)}
        />
        <Field label="Model override" value={draft.model} onChange={(v) => set('model', v)} hint="blank uses VOICE_LLM_MODEL / LLM_MODEL" />
      </div>

      <div style={panel}>
        <div style={heading}>Call behaviour</div>
        <Row style={{ justifyContent: 'flex-start', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <Select
              label="Interruptible"
              hint="what stops the agent mid-sentence"
              value={draft.interruptible}
              options={INTERRUPT_MODES.map((m) => ({ value: m, label: MODE_LABELS[m] }))}
              onChange={(v) => set('interruptible', v as RelayConfig['interruptible'])}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Select
              label="Interrupt sensitivity"
              hint="lower it in a loud room"
              value={draft.interruptSensitivity}
              options={INTERRUPT_SENSITIVITIES.map((s) => ({ value: s, label: s }))}
              onChange={(v) => set('interruptSensitivity', v as RelayConfig['interruptSensitivity'])}
            />
          </div>
        </Row>
        <Row style={{ justifyContent: 'flex-start', gap: 20, marginBottom: 12 }}>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={draft.ignoreBackchannel} onChange={(e) => set('ignoreBackchannel', e.target.checked)} />{' '}
            Ignore backchannel (“yeah”, “uh-huh”)
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

const MODE_LABELS: Record<RelayConfig['interruptible'], string> = {
  any: 'speech or keypad',
  speech: 'speech only',
  dtmf: 'keypad only',
  none: 'never — let it finish',
};

/**
 * A dropdown over the values Twilio actually accepts.
 *
 * `freeText` adds a datalist instead of restricting to the list: a voice id is
 * an open set — ElevenLabs has thousands — while a provider or an interrupt mode
 * is closed, and offering a free-text box for a closed set is how an unaccepted
 * value reaches the TwiML.
 */
function Select({
  label,
  value,
  options,
  hint,
  freeText,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  hint?: string;
  freeText?: boolean;
  onChange: (value: string) => void;
}) {
  const listId = `${label.replace(/\W+/g, '-')}-options`;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={caption}>
        {label}
        {hint && <span style={{ textTransform: 'none', letterSpacing: 0 }}> · {hint}</span>}
      </div>
      {freeText ? (
        <>
          <input
            style={{ ...textInput, width: '100%', marginTop: 4 }}
            list={listId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <datalist id={listId}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </datalist>
        </>
      ) : (
        <select
          style={{ ...textInput, width: '100%', marginTop: 4 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} style={{ background: '#000d25' }}>
              {o.label}
            </option>
          ))}
        </select>
      )}
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
