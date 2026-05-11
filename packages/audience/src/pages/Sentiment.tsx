import { useState } from 'react';
import type { InteractionConfig } from '@twilio-preso/shared';

interface SentimentProps {
  interaction: InteractionConfig;
  onSubmit: (value: string) => void;
}

const EMOJIS = ['\u{1F624}', '\u{1F610}', '\u{1F642}', '\u{1F603}', '\u{1F929}'];

export function Sentiment({ interaction, onSubmit }: SentimentProps) {
  const [selected, setSelected] = useState<string | null>(null);

  function handleSelect(emoji: string) {
    if (selected) return;
    setSelected(emoji);
    onSubmit(emoji);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h2 className="text-xl font-bold text-center mb-8">{interaction.prompt}</h2>
      <div className="flex gap-4">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleSelect(emoji)}
            className={`text-4xl p-2 rounded-lg transition-all ${
              selected === emoji ? 'scale-150 bg-white/10' : selected ? 'opacity-30' : 'hover:scale-125'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
      {selected && <p className="text-accent-2 mt-6">Thanks!</p>}
    </div>
  );
}
