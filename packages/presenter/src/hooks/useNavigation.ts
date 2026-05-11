import { useEffect, useRef } from 'react';
import { usePresenterStore } from '../store';
import { STAGES } from '@twilio-preso/shared';
import { publishStageAdvance, publishInteractionPrompt, triggerDemo, isSyncConnected } from '../sync';

export function useNavigation() {
  const advance = usePresenterStore((s) => s.advance);
  const back = usePresenterStore((s) => s.back);
  const currentStageIndex = usePresenterStore((s) => s.currentStageIndex);
  const lastPublishedIndex = useRef(-1);
  const demoEnabled = usePresenterStore((s) => s.isLive);

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

  // When stage changes locally (from keyboard), publish to Sync so all windows follow
  useEffect(() => {
    // Prevent re-publishing if we just received this from Sync
    if (currentStageIndex === lastPublishedIndex.current) return;
    lastPublishedIndex.current = currentStageIndex;

    const stage = STAGES[currentStageIndex];

    // Publish to Sync (all presenter windows + audience apps receive this)
    publishStageAdvance(currentStageIndex);

    // Broadcast to local notes window
    const channel = new BroadcastChannel('presenter-sync');
    channel.postMessage({ type: 'stage-change', stageIndex: currentStageIndex });
    channel.close();

    // If stage has an interaction, publish the prompt
    if (stage.interaction) {
      publishInteractionPrompt(stage.interaction);
    }

    // If stage has a demo trigger AND demos are enabled, fire it
    if (stage.demoTrigger && demoEnabled) {
      triggerDemo(stage.demoTrigger).catch((err) => {
        console.error(`Demo trigger failed for ${stage.demoTrigger}:`, err);
      });
    }
  }, [currentStageIndex, demoEnabled]);
}
