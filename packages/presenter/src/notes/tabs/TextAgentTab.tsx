import { useCallback, useEffect, useState } from 'react';
import type { TextAgentConfig } from '@twilio-preso/shared';
import { fetchTextConfig, saveTextConfig } from '../../sessions';
import { ErrorText, Row, caption, heading, panel, smallButton, textInput } from '../ui';

const note = { ...caption, textTransform: 'none' as const, letterSpacing: 0, marginTop: 8 };

/**
 * The text agent, as the presenter configures it.
 *
 * Deliberately its own tab rather than a corner of the voice one: the settings a
 * call needs — voice, ASR provider, interruption, per-language rows, tool
 * sentinels, a spoken greeting — mean nothing in a thread, and half of that tab
 * is them. What the two share is the shape and the default wording, so this reads
 * as the same agent with the medium swapped.
 *
 * A local draft saved explicitly, like every other editor in the HUD: a
 * half-typed prompt must not reach the next attendee who texts the number.
 */
export function TextAgentTab({ sessionId }: { sessionId: string }) {
  const [draft, setDraft] = useState<TextAgentConfig | null>(null);
  const [saved, setSaved] = useState<TextAgentConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const config = await fetchTextConfig(sessionId);
        setDraft(config);
        setSaved(config);
      } catch (err: any) {
        setError(err?.message ?? 'Could not read the text settings');
      }
    })();
  }, [sessionId]);

  const set = useCallback(<K extends keyof TextAgentConfig>(key: K, value: TextAgentConfig[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setStatus('');
  }, []);

  async function save() {
    if (!draft) return;
    setError('');
    setStatus('Saving…');
    setBusy(true);
    try {
      const config = await saveTextConfig(sessionId, draft);
      setDraft(config);
      setSaved(config);
      setStatus('Saved — the next message uses these settings.');
    } catch (err: any) {
      setStatus('');
      setError(err?.message ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  if (!draft) {
    return error ? <ErrorText>{error}</ErrorText> : <p style={{ color: '#7e869c' }}>Loading…</p>;
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  return (
    <div>
      <div style={panel}>
        <Row style={{ marginBottom: 10 }}>
          <span style={heading}>Reachable by text</span>
          {dirty && <span style={{ ...caption, color: '#ef223a' }}>unsaved edits</span>}
        </Row>
        <p style={{ ...note, marginTop: 0 }}>
          Anyone who texts this session’s own number — SMS, RCS or WhatsApp — reaches this agent.
          It reads the same three things the voice agent does: this session’s answers, their
          Conversation Memory profile, and what the whole room voted. Replies go out on the channel
          they wrote from, so a WhatsApp message is answered in WhatsApp.
        </p>
      </div>

      <div style={panel}>
        <div style={heading}>Instructions</div>
        <textarea
          style={{ ...textInput, width: '100%', minHeight: 180, resize: 'vertical' }}
          value={draft.systemPrompt}
          onChange={(e) => set('systemPrompt', e.target.value)}
        />
        <p style={note}>
          <code>{'{{context}}'}</code> is replaced with what the agent knows about the sender — their
          name, this session’s answers, their profile’s traits and recent observations. Remove it and
          that block is appended at the end instead. The same placeholder the voice tab uses.
        </p>
      </div>

      <div style={panel}>
        <div style={heading}>What it knows</div>
        <label style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={draft.useMemory}
            onChange={(e) => set('useMemory', e.target.checked)}
          />{' '}
          Read their Conversation Memory profile before answering
        </label>
        <p style={{ ...note, marginTop: 0 }}>
          Looked up by phone number, so someone who came to a previous event — or texted without
          registering — is still known by name. Off leaves the agent with this session’s answers
          alone, which is worth being able to show.
        </p>
      </div>

      <div style={panel}>
        <div style={heading}>What the room decided</div>
        <label style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={draft.roomContext}
            onChange={(e) => set('roomContext', e.target.checked)}
          />{' '}
          Tell the agent the aggregate answers, not only this sender’s
        </label>
        <div style={caption}>How to use the majority</div>
        <textarea
          style={{
            ...textInput,
            width: '100%',
            minHeight: 80,
            resize: 'vertical',
            marginTop: 6,
            opacity: draft.roomContext ? 1 : 0.5,
          }}
          value={draft.outcomeInstruction}
          disabled={!draft.roomContext}
          onChange={(e) => set('outcomeInstruction', e.target.value)}
        />
        <p style={note}>
          Every poll the audience answered is tallied with its counts. Where the sender’s own answer
          lost, the agent is told so — the same block the voice agent gets.
        </p>
      </div>

      <div style={panel}>
        <div style={heading}>Limits</div>
        <Row style={{ justifyContent: 'flex-start', marginBottom: 10 }}>
          <label style={{ fontSize: 13 }}>Replies per thread</label>
          <input
            type="number"
            min={1}
            style={{ ...textInput, width: 70 }}
            value={draft.maxTurnsInbound}
            onChange={(e) => set('maxTurnsInbound', Number(e.target.value))}
          />
        </Row>
        <p style={{ ...note, marginTop: 0, marginBottom: 12 }}>
          A thread has no hang-up, so this is the only thing that ends it. Counted from the
          conversation itself, so a redeploy mid-event does not hand anyone a fresh allowance.
        </p>
        <div style={caption}>Fallback reply — sent if the model fails</div>
        <textarea
          style={{ ...textInput, width: '100%', minHeight: 50, resize: 'vertical', marginTop: 6 }}
          value={draft.fallbackReply}
          onChange={(e) => set('fallbackReply', e.target.value)}
        />
        <p style={note}>
          A failed turn with nothing sent reads as the agent ignoring them. Clear this box to choose
          silence instead.
        </p>
      </div>

      <div style={panel}>
        <div style={heading}>Model</div>
        <input
          style={{ ...textInput, width: '100%' }}
          placeholder="Leave empty to use the deployment’s own model"
          value={draft.model}
          onChange={(e) => set('model', e.target.value)}
        />
        <p style={note}>
          Overrides only the model, never the provider or the key — the text agent and the voice
          agent run on the same credential.
        </p>
      </div>

      <Row style={{ justifyContent: 'flex-start' }}>
        <button
          style={{ ...smallButton, border: '1px solid #ef223a', color: '#ef223a' }}
          onClick={save}
          disabled={busy || !dirty}
        >
          {busy ? 'Saving…' : 'Save text settings'}
        </button>
        {status && <span style={{ ...caption, textTransform: 'none', letterSpacing: 0 }}>{status}</span>}
      </Row>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}
