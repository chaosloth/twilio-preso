import { useEffect } from 'react';
import { usePresenterStore } from '../store';
import { STAGES } from '@twilio-preso/shared';
import { publishStageAdvance, publishInteractionPrompt, triggerDemo } from '../sync';

export function useNavigation() {
  const advance = usePresenterStore((s) => s.advance);
  const back = usePresenterStore((s) => s.back);
  const currentStageIndex = usePresenterStore((s) => s.currentStageIndex);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'PageDown':
          e.preventDefault();
          advance();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          back();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [advance, back]);

  // Listen for go-to-stage from notes window
  useEffect(() => {
    const channel = new BroadcastChannel('presenter-sync');
    channel.onmessage = (event) => {
      if (event.data.type === 'go-to-stage') {
        usePresenterStore.getState().goTo(event.data.stageIndex);
      }
    };
    return () => channel.close();
  }, []);

  // Broadcast stage changes to Sync + BroadcastChannel + trigger demos
  useEffect(() => {
    const stage = STAGES[currentStageIndex];

    publishStageAdvance(currentStageIndex);

    // Broadcast to notes window
    const channel = new BroadcastChannel('presenter-sync');
    channel.postMessage({ type: 'stage-change', stageIndex: currentStageIndex });
    channel.close();

    // If stage has an interaction, publish the prompt
    if (stage.interaction) {
      publishInteractionPrompt(stage.interaction);
    }

    // If stage has a demo trigger, fire it
    if (stage.demoTrigger) {
      triggerDemo(stage.demoTrigger).catch((err) => {
        console.error(`Demo trigger failed for ${stage.demoTrigger}:`, err);
      });
    }
  }, [currentStageIndex]);
}
