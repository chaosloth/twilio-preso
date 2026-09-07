import { useEffect, useRef, useState } from 'react';
import type { InteractionConfig } from '@twilio-preso/shared';
import { submitAiPrompt } from '../sync';

interface AIPromptProps {
  interaction: InteractionConfig;
  /** Deck position this prompt was shown at — reported with the response. */
  stageIndex: number;
  sessionId: string;
  participantId: string;
  name: string;
}

type Phase = 'input' | 'thinking' | 'answered';

/** How fast words are revealed once they've arrived from the stream. */
const WORD_INTERVAL_MS = 55;

export function AIPrompt({ interaction, stageIndex, sessionId, participantId, name }: AIPromptProps) {
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [shown, setShown] = useState('');
  const [asked, setAsked] = useState('');
  const [error, setError] = useState('');
  const [streamDone, setStreamDone] = useState(false);

  // Text received from the backend so far. The reveal loop below trails this,
  // releasing one word at a time so the answer reads as if it's being typed.
  const receivedRef = useRef('');
  const shownLenRef = useRef(0);

  useEffect(() => {
    if (phase !== 'answered') return;

    const timer = setInterval(() => {
      const received = receivedRef.current;
      if (shownLenRef.current >= received.length) return;

      // Advance past any whitespace, then to the end of the next word.
      let next = shownLenRef.current;
      while (next < received.length && /\s/.test(received[next])) next += 1;
      while (next < received.length && !/\s/.test(received[next])) next += 1;

      shownLenRef.current = next;
      setShown(received.slice(0, next));
    }, WORD_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [phase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const prompt = value.trim();
    if (!prompt || phase === 'thinking') return;

    setAsked(prompt);
    setPhase('thinking');
    setError('');
    setStreamDone(false);
    setShown('');
    receivedRef.current = '';
    shownLenRef.current = 0;

    try {
      await submitAiPrompt(sessionId, participantId, name, interaction.stageId, stageIndex, prompt, (delta) => {
        receivedRef.current += delta;
        // Flip to the answer view on the first token so streaming is visible.
        setPhase('answered');
      });
      setStreamDone(true);
    } catch (err) {
      // The backend distinguishes "the model is unreachable" from a transient
      // blip, so show what it said rather than one message for every cause.
      setError(err instanceof Error && err.message ? err.message : 'Something went wrong — try again.');
      setPhase('input');
    }
  }

  function askAnother() {
    setValue('');
    setShown('');
    setAsked('');
    setStreamDone(false);
    receivedRef.current = '';
    shownLenRef.current = 0;
    setPhase('input');
  }

  if (phase === 'answered') {
    const caughtUp = streamDone && shown.length >= receivedRef.current.length;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4">
          <div className="rounded-lg bg-white/5 border border-accent-3/30 p-4">
            <p className="text-xs uppercase tracking-wide text-accent-2 mb-1">You asked</p>
            <p className="text-white font-bold">{asked}</p>
          </div>
          <div className="rounded-lg bg-twilio-red/10 border border-twilio-red/40 p-4">
            <p className="text-xs uppercase tracking-wide text-twilio-red mb-1">AI agent</p>
            <p className="text-white leading-relaxed">
              {shown}
              {!caughtUp && <span className="inline-block ml-0.5 animate-pulse">▍</span>}
            </p>
          </div>
          {caughtUp && (
            <>
              <p className="text-center text-accent-2 text-sm">
                👆 Your question is up on the big screen!
              </p>
              <button
                onClick={askAnother}
                className="w-full py-3 rounded-lg bg-twilio-red text-white font-bold"
              >
                Ask another
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h2 className="text-xl font-bold text-center mb-2">{interaction.prompt}</h2>
      {interaction.example && (
        <p className="text-accent-2 text-sm text-center mb-6 italic">e.g. "{interaction.example}"</p>
      )}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={interaction.example || 'Type your prompt...'}
          autoFocus
          rows={3}
          disabled={phase === 'thinking'}
          className="w-full px-4 py-3 rounded-lg bg-white/5 border border-accent-3/30 text-white placeholder-accent-2 focus:outline-none focus:border-twilio-red text-lg resize-none disabled:opacity-50"
        />
        {error && <p className="text-twilio-red text-sm text-center">{error}</p>}
        <button
          type="submit"
          disabled={phase === 'thinking' || !value.trim()}
          className="w-full py-3 rounded-lg bg-twilio-red text-white font-bold disabled:opacity-50"
        >
          {phase === 'thinking' ? 'Thinking…' : 'Ask the agent'}
        </button>
      </form>
    </div>
  );
}
