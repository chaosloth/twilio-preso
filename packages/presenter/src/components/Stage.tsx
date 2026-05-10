import { Suspense, lazy, type ComponentType, useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { STAGES } from '@twilio-preso/shared';
import { usePresenterStore } from '../store';
import gsap from 'gsap';
import type { Group } from 'three';

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

const TRANSITION_TYPES = ['fade', 'pushLeft', 'pushRight', 'zoomOut', 'morphIn'] as const;
type TransitionType = (typeof TRANSITION_TYPES)[number];

function getTransition(fromIndex: number, toIndex: number): TransitionType {
  const forward = toIndex > fromIndex;
  const stageAct = STAGES[toIndex]?.act;
  const prevAct = STAGES[fromIndex]?.act;

  if (stageAct !== prevAct) return 'zoomOut';
  if (toIndex === 0) return 'fade';
  if (forward && toIndex % 3 === 0) return 'morphIn';
  if (forward) return 'pushLeft';
  return 'pushRight';
}

export function StageContainer() {
  const currentStageIndex = usePresenterStore((s) => s.currentStageIndex);
  const [visibleIndex, setVisibleIndex] = useState(currentStageIndex);
  const [transitioning, setTransitioning] = useState(false);
  const currentRef = useRef<Group>(null);
  const prevRef = useRef<Group>(null);
  const prevIndex = useRef(currentStageIndex);

  useEffect(() => {
    if (currentStageIndex === prevIndex.current) return;

    const transition = getTransition(prevIndex.current, currentStageIndex);
    setTransitioning(true);

    // Animate out the current (now previous) stage
    if (prevRef.current) {
      const outTarget: gsap.TweenVars = { duration: 0.6, ease: 'power2.in' };
      switch (transition) {
        case 'fade':
          outTarget.opacity = 0;
          gsap.to(prevRef.current.scale, { x: 0.95, y: 0.95, z: 0.95, ...outTarget });
          break;
        case 'pushLeft':
          gsap.to(prevRef.current.position, { x: -8, ...outTarget });
          gsap.to(prevRef.current.scale, { x: 0.8, y: 0.8, z: 0.8, ...outTarget });
          break;
        case 'pushRight':
          gsap.to(prevRef.current.position, { x: 8, ...outTarget });
          gsap.to(prevRef.current.scale, { x: 0.8, y: 0.8, z: 0.8, ...outTarget });
          break;
        case 'zoomOut':
          gsap.to(prevRef.current.position, { z: -10, ...outTarget });
          gsap.to(prevRef.current.scale, { x: 0.3, y: 0.3, z: 0.3, ...outTarget });
          break;
        case 'morphIn':
          gsap.to(prevRef.current.position, { z: 5, ...outTarget });
          gsap.to(prevRef.current.scale, { x: 1.5, y: 1.5, z: 1.5, ...outTarget });
          break;
      }
    }

    // After a short delay, swap visible stage and animate in
    setTimeout(() => {
      setVisibleIndex(currentStageIndex);
      prevIndex.current = currentStageIndex;

      requestAnimationFrame(() => {
        if (currentRef.current) {
          const inTarget: gsap.TweenVars = { duration: 0.8, ease: 'power2.out' };
          switch (transition) {
            case 'fade':
              currentRef.current.position.set(0, 0, 0);
              currentRef.current.scale.set(1.05, 1.05, 1.05);
              gsap.to(currentRef.current.scale, { x: 1, y: 1, z: 1, ...inTarget });
              break;
            case 'pushLeft':
              currentRef.current.position.set(8, 0, 0);
              currentRef.current.scale.set(0.8, 0.8, 0.8);
              gsap.to(currentRef.current.position, { x: 0, ...inTarget });
              gsap.to(currentRef.current.scale, { x: 1, y: 1, z: 1, ...inTarget });
              break;
            case 'pushRight':
              currentRef.current.position.set(-8, 0, 0);
              currentRef.current.scale.set(0.8, 0.8, 0.8);
              gsap.to(currentRef.current.position, { x: 0, ...inTarget });
              gsap.to(currentRef.current.scale, { x: 1, y: 1, z: 1, ...inTarget });
              break;
            case 'zoomOut':
              currentRef.current.position.set(0, 0, -10);
              currentRef.current.scale.set(0.3, 0.3, 0.3);
              gsap.to(currentRef.current.position, { z: 0, ...inTarget });
              gsap.to(currentRef.current.scale, { x: 1, y: 1, z: 1, ...inTarget });
              break;
            case 'morphIn':
              currentRef.current.position.set(0, 0, 5);
              currentRef.current.scale.set(0.5, 0.5, 0.5);
              gsap.to(currentRef.current.position, { z: 0, ...inTarget });
              gsap.to(currentRef.current.scale, { x: 1, y: 1, z: 1, ...inTarget });
              break;
          }
        }
        setTransitioning(false);
      });
    }, 500);
  }, [currentStageIndex]);

  const stage = STAGES[visibleIndex];
  const StageComponent = stage ? stageComponents[stage.id] : null;

  return (
    <group ref={currentRef}>
      <Suspense fallback={null}>
        {StageComponent && <StageComponent />}
      </Suspense>
    </group>
  );
}
