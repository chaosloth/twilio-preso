import { useState } from 'react';
import type { InteractionConfig } from '@twilio-preso/shared';

interface TextInputProps {
  interaction: InteractionConfig;
  onSubmit: (value: string) => void;
}

export function TextInput({ interaction, onSubmit }: TextInputProps) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || submitted) return;
    setSubmitted(true);
    onSubmit(value.trim());
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h2 className="text-xl font-bold text-center mb-6">{interaction.prompt}</h2>
      {!submitted ? (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type your answer..."
            autoFocus
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-accent-3/30 text-white placeholder-accent-2 focus:outline-none focus:border-twilio-red text-lg"
          />
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-twilio-red text-white font-bold"
          >
            Send
          </button>
        </form>
      ) : (
        <div className="text-center">
          <p className="text-2xl font-bold text-twilio-red">{value}</p>
          <p className="text-accent-2 mt-2">Sent!</p>
        </div>
      )}
    </div>
  );
}
