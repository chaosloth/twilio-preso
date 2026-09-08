import { useMemo, type ComponentType } from 'react';
import { FloatingText, ParticleField, BarChart3D } from '../objects';
import { usePresenterStore } from '../store';
import { useSlots } from '../hooks/useSlots';

/**
 * A poll slide: the question, then the live tally as answers arrive. Shared by
 * every mandatory poll — three copies of the same scene would drift the first
 * time one of them was restyled, and these three are deliberately identical so
 * the audience recognises the pattern by the second question.
 */
export function PollStage({ stageId }: { stageId: string }) {
  const slot = useSlots();
  const recentResponses = usePresenterStore((s) => s.recentResponses);

  const pollData = useMemo(() => {
    const counts: Record<string, number> = {};
    recentResponses
      .filter((r) => r.stageId === stageId && r.interactionType === 'poll')
      .forEach((r) => {
        counts[r.value] = (counts[r.value] || 0) + 1;
      });
    return counts;
  }, [recentResponses, stageId]);

  const hasResponses = Object.keys(pollData).length > 0;

  return (
    <group>
      <ParticleField count={60} color="#ef223a" speed={0.3} spread={14} size={0.015} />

      <FloatingText position={[0, 2.8, 0]} fontSize={0.35} color="#ffffff" bold delay={0.2} maxWidth={12}>
        {slot('headline')}
      </FloatingText>

      {hasResponses ? (
        <BarChart3D data={pollData} position={[0, -0.8, 0]} maxHeight={2.5} barWidth={1.5} />
      ) : (
        <group>
          <FloatingText position={[0, 0, 0]} fontSize={0.22} color="#ef223a" delay={0.8}>
            {slot('waiting')}
          </FloatingText>
          <FloatingText position={[0, -0.6, 0]} fontSize={0.15} color="#7e869c" delay={1}>
            {slot('waitingHint')}
          </FloatingText>
        </group>
      )}

      <pointLight position={[0, 2, 3]} color="#ef223a" intensity={1} distance={10} />
    </group>
  );
}

/** `lazy()` wants a module with a default export; this binds one poll's id. */
export function pollStage(stageId: string): { default: ComponentType } {
  return { default: () => <PollStage stageId={stageId} /> };
}
