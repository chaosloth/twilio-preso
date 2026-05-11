import { useState } from 'react';
import type { InteractionConfig } from '@twilio-preso/shared';

interface PollProps {
  interaction: InteractionConfig;
  onSubmit: (value: string) => void;
}

export function Poll({ interaction, onSubmit }: PollProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [freeformValue, setFreeformValue] = useState('');

  function handleSelect(option: string) {
    if (submitted) return;
    setSelected(option);
    setSubmitted(true);
    onSubmit(option);
  }

  function handleFreeformSubmit() {
    if (submitted || !freeformValue.trim()) return;
    setSelected(freeformValue.trim());
    setSubmitted(true);
    onSubmit(freeformValue.trim());
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
        {interaction.allowFreeform && !submitted && (
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={freeformValue}
              onChange={(e) => setFreeformValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFreeformSubmit()}
              placeholder="Or type your answer..."
              className="flex-1 py-3 px-4 rounded-lg bg-white/5 text-white placeholder-accent-3 border border-white/10 focus:border-twilio-red focus:outline-none"
            />
            <button
              onClick={handleFreeformSubmit}
              className="px-4 py-3 rounded-lg bg-twilio-red text-white font-medium"
            >
              Send
            </button>
          </div>
        )}
        {interaction.allowFreeform && submitted && selected && !interaction.options?.includes(selected) && (
          <div className="w-full py-4 px-4 rounded-lg bg-twilio-red text-white font-medium">
            {selected}
          </div>
        )}
      </div>
      {submitted && (
        <p className="text-accent-2 mt-6 text-sm">Response recorded!</p>
      )}
    </div>
  );
}
