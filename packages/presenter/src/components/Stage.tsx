import { Suspense, lazy, type ComponentType } from 'react';
import { STAGES } from '@twilio-preso/shared';

const STAGE_SPACING = 20;

const stageComponents: Record<string, React.LazyExoticComponent<ComponentType>> = {
  opening: lazy(() => import('../stages/Stage01Opening')),
  speakers: lazy(() => import('../stages/Stage02Speakers')),
  'why-wonder': lazy(() => import('../stages/Stage03WhyWonder')),
  'story-arc': lazy(() => import('../stages/Stage04StoryArc')),
  'customer-nerves': lazy(() => import('../stages/Stage05CustomerNerves')),
  'patience-deficit': lazy(() => import('../stages/Stage06PatienceDeficit')),
  'think-channels': lazy(() => import('../stages/Stage07ThinkChannels')),
  siloes: lazy(() => import('../stages/Stage08Siloes')),
  'customers-are': lazy(() => import('../stages/Stage09CustomersAre')),
  orchestrating: lazy(() => import('../stages/Stage10Orchestrating')),
  'conversations-overview': lazy(() => import('../stages/Stage11ConversationsOverview')),
  orchestrator: lazy(() => import('../stages/Stage12Orchestrator')),
  memory: lazy(() => import('../stages/Stage13Memory')),
  intelligence: lazy(() => import('../stages/Stage14Intelligence')),
  'agent-connect': lazy(() => import('../stages/Stage15AgentConnect')),
  innovation: lazy(() => import('../stages/Stage16Innovation')),
  'never-easier': lazy(() => import('../stages/Stage17NeverEasier')),
  'mass-call': lazy(() => import('../stages/Stage18MassCall')),
  closing: lazy(() => import('../stages/Stage19Closing')),
};

export function StageContainer() {
  return (
    <group>
      {STAGES.map((stage, i) => {
        const StageComponent = stageComponents[stage.id];
        return (
          <group key={stage.id} position={[0, 0, -i * STAGE_SPACING]}>
            <Suspense fallback={null}>
              {StageComponent && <StageComponent />}
            </Suspense>
          </group>
        );
      })}
    </group>
  );
}
