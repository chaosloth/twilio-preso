import { useEffect, useRef } from 'react';
import { usePresenterStore } from '../store';
import { STAGES } from '@twilio-preso/shared';
import { publishStageAdvance, publishInteractionPrompt, triggerDemo } from '../sync';

let suppressNextPublish = false;

export function suppressPublish() {
  suppressNextPublish = true;
}

export function useNavigation() {
  const advance = usePresenterStore((s) => s.advance);
  const back = usePresenterStore((s) => s.back);
  const currentStageIndex = usePresenterStore((s) => s.currentStageIndex);
  const isLive = usePresenterStore((s) => s.isLive);
  const prevStageIndex = useRef(currentStageIndex);

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
        case 'n':
        case 'N':
          if (!e.repeat) {
            window.open('/notes', 'presenter-notes', 'width=500,height=700,menubar=no,toolbar=no');
          }
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [advance, back]);

  // Listen for go-to-stage and demo-toggle from notes window (same browser)
  useEffect(() => {
    const channel = new BroadcastChannel('presenter-sync');
    channel.onmessage = (event) => {
      if (event.data.type === 'go-to-stage') {
        usePresenterStore.getState().goTo(event.data.stageIndex);
      } else if (event.data.type === 'demo-toggle') {
        usePresenterStore.getState().setLive(event.data.enabled);
      }
    };
    return () => channel.close();
  }, []);

  // When stage changes, publish to Sync and trigger demos
  useEffect(() => {
    if (currentStageIndex === prevStageIndex.current) return;
    prevStageIndex.current = currentStageIndex;

    const stage = STAGES[currentStageIndex];
    const shouldPublish = !suppressNextPublish;
    suppressNextPublish = false;

    if (shouldPublish) {
      // Publish to Sync (updates document with stage + interaction, all windows + audience follow)
      publishStageAdvance(currentStageIndex, stage.interaction);

      // Also publish interaction as stream event for real-time audience updates
      if (stage.interaction) {
        publishInteractionPrompt(stage.interaction);
      }

      // Broadcast to local notes window
      const channel = new BroadcastChannel('presenter-sync');
      channel.postMessage({ type: 'stage-change', stageIndex: currentStageIndex });
      channel.close();

      // If stage has a demo trigger AND demos are enabled, fire it
      if (stage.demoTrigger && isLive) {
        triggerDemo(stage.demoTrigger).catch((err) => {
          console.error(`Demo trigger failed for ${stage.demoTrigger}:`, err);
        });
      }
    }
  }, [currentStageIndex, isLive]);
}
