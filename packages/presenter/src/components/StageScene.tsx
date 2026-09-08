import { Suspense, lazy, type ComponentType } from 'react';
import type { ResolvedStage } from '@twilio-preso/shared';
import { SlotProvider } from '../hooks/useSlots';
import { CanvasSlide, SlideImage } from '../objects';
import { StageActiveContext } from './stageActive';

const stageComponents: Record<string, React.LazyExoticComponent<ComponentType>> = {
  opening: lazy(() => import('../stages/Stage01Opening')),
  'brand-poll': lazy(() => import('../stages/PollStage').then((m) => m.pollStage('brand-poll'))),
  'theme-poll': lazy(() => import('../stages/PollStage').then((m) => m.pollStage('theme-poll'))),
  'otp-poll': lazy(() => import('../stages/PollStage').then((m) => m.pollStage('otp-poll'))),
  'patience-poll': lazy(() => import('../stages/Stage02PatiencePoll')),
  speakers: lazy(() => import('../stages/Stage02Speakers')),
  'why-wonder': lazy(() => import('../stages/Stage03WhyWonder')),
  'story-arc': lazy(() => import('../stages/Stage04StoryArc')),
  'customer-nerves': lazy(() => import('../stages/Stage05CustomerNerves')),
  'patience-deficit': lazy(() => import('../stages/Stage06PatienceDeficit')),
  'impatient-customers': lazy(() => import('../stages/Stage07ImpatientCustomers')),
  'think-channels': lazy(() => import('../stages/Stage07ThinkChannels')),
  siloes: lazy(() => import('../stages/Stage08Siloes')),
  'customers-are': lazy(() => import('../stages/Stage09CustomersAre')),
  orchestrating: lazy(() => import('../stages/Stage10Orchestrating')),
  'conversations-overview': lazy(() => import('../stages/Stage11ConversationsOverview')),
  orchestrator: lazy(() => import('../stages/Stage12Orchestrator')),
  memory: lazy(() => import('../stages/Stage13Memory')),
  intelligence: lazy(() => import('../stages/Stage14Intelligence')),
  'agent-connect': lazy(() => import('../stages/Stage15AgentConnect')),
  'call-in': lazy(() => import('../stages/Stage20CallIn')),
  'whatsapp-invite': lazy(() => import('../stages/Stage21WhatsAppInvite')),
  'mcp-server': lazy(() => import('../stages/Stage16MCPServer')),
  'ai-playground': lazy(() => import('../stages/Stage16AIPlayground')),
  innovation: lazy(() => import('../stages/Stage16Innovation')),
  'never-easier': lazy(() => import('../stages/Stage17NeverEasier')),
  'mass-call': lazy(() => import('../stages/Stage18MassCall')),
  // The live-agent finale reuses the scripted finale's scene: same room-wide
  // call on screen, different thing answering the phone.
  'mass-call-agent': lazy(() => import('../stages/Stage18MassCall')),
  closing: lazy(() => import('../stages/Stage19Closing')),
  // 'canvas' has no component on purpose: a blank canvas slide is only ever the
  // elements the presenter placed on it.
};

/**
 * One slide's contents: its own scene, its image slot, and its canvas elements.
 *
 * Extracted from `StageContainer` so the HUD's rendered preview shows the real
 * thing rather than an approximation of it — a second renderer would drift from
 * this one the first time a stage changed.
 */
export function StageScene({ stage, active }: { stage: ResolvedStage; active: boolean }) {
  const StageComponent = stageComponents[stage.id];
  return (
    <StageActiveContext.Provider value={active}>
      <SlotProvider stage={stage}>
        <Suspense fallback={null}>
          {StageComponent && <StageComponent />}
          {/* Both of these are rendered here rather than by each of the 23 stage
              components, so they work on every slide including ones whose scene
              knows nothing about them. */}
          <SlideImage url={stage.slots?.image ?? ''} />
          <CanvasSlide elements={stage.canvas} />
        </Suspense>
      </SlotProvider>
    </StageActiveContext.Provider>
  );
}
