import { Suspense, lazy, type ComponentType, createContext, useContext } from 'react';
import { usePresenterStore } from '../store';
import { SlotProvider } from '../hooks/useSlots';
import { SlideImage } from '../objects';

const STAGE_SPACING = 50;

const stageComponents: Record<string, React.LazyExoticComponent<ComponentType>> = {
  opening: lazy(() => import('../stages/Stage01Opening')),
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
  'mcp-server': lazy(() => import('../stages/Stage16MCPServer')),
  'ai-playground': lazy(() => import('../stages/Stage16AIPlayground')),
  innovation: lazy(() => import('../stages/Stage16Innovation')),
  'never-easier': lazy(() => import('../stages/Stage17NeverEasier')),
  'mass-call': lazy(() => import('../stages/Stage18MassCall')),
  closing: lazy(() => import('../stages/Stage19Closing')),
};

export { STAGE_SPACING };

export const StageActiveContext = createContext(false);
export function useIsStageActive() { return useContext(StageActiveContext); }

export function StageContainer() {
  const currentStageIndex = usePresenterStore((s) => s.currentStageIndex);
  const stages = usePresenterStore((s) => s.stages);

  return (
    <group>
      {stages.map((stage, i) => {
        if (Math.abs(i - currentStageIndex) > 1) return null;

        const StageComponent = stageComponents[stage.id];
        const isActive = i === currentStageIndex;
        return (
          // Keyed by position as well as id: a deck may legitimately contain
          // the same stage twice, and a duplicate key silently drops one.
          <group key={`${stage.id}-${i}`} position={[0, 0, -i * STAGE_SPACING]}>
            <StageActiveContext.Provider value={isActive}>
              <SlotProvider stage={stage}>
                <Suspense fallback={null}>
                  {StageComponent && <StageComponent />}
                  {/* The image slot is rendered here so it works on every
                      stage, including ones whose scene knows nothing about it. */}
                  <SlideImage url={stage.slots?.image ?? ''} />
                </Suspense>
              </SlotProvider>
            </StageActiveContext.Provider>
          </group>
        );
      })}
    </group>
  );
}
