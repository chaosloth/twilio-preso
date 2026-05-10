import { useState } from 'react';
import type { InteractionConfig } from '@twilio-preso/shared';

interface TriggerProps {
  interaction: InteractionConfig;
  onSubmit: (value: string) => void;
}

export function Trigger({ interaction, onSubmit }: TriggerProps) {
  const [triggered, setTriggered] = useState(false);

  function handleTrigger() {
    setTriggered(true);
    onSubmit('ready');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h2 className="text-xl font-bold text-center mb-6">{interaction.prompt}</h2>
      {!triggered ? (
        <button
          onClick={handleTrigger}
          className="px-8 py-4 rounded-full bg-twilio-red text-white font-bold text-lg animate-pulse"
        >
          I'm Ready
        </button>
      ) : (
        <p className="text-gray-400">Something's coming to your phone...</p>
      )}
    </div>
  );
}
