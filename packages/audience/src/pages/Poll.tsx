import { useState } from 'react';
import type { InteractionConfig } from '@twilio-preso/shared';

interface PollProps {
  interaction: InteractionConfig;
  onSubmit: (value: string) => void;
}

export function Poll({ interaction, onSubmit }: PollProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleSelect(option: string) {
    if (submitted) return;
    setSelected(option);
    setSubmitted(true);
    onSubmit(option);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h2 className="text-xl font-bold text-center mb-6">{interaction.prompt}</h2>
      <div className="w-full max-w-sm space-y-3">
        {interaction.options?.map((option) => (
          <button
            key={option}
            onClick={() => handleSelect(option)}
            className={`w-full py-4 px-4 rounded-lg text-left font-medium transition-all ${
              selected === option
                ? 'bg-twilio-red text-white scale-[1.02]'
                : submitted
                  ? 'bg-white/5 text-accent-3'
                  : 'bg-white/5 text-white hover:bg-white/10'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      {submitted && (
        <p className="text-accent-2 mt-6 text-sm">Response recorded!</p>
      )}
    </div>
  );
}
