import { FloatingText, ParticleField, BarChart3D } from '../objects';
import { usePresenterStore } from '../store';
import { useMemo } from 'react';

export default function Stage16Innovation() {
  const recentResponses = usePresenterStore((s) => s.recentResponses);

  const pollData = useMemo(() => {
    const counts: Record<string, number> = {};
    recentResponses
      .filter((r) => r.stageIndex === 19 && r.interactionType === 'poll')
      .forEach((r) => {
        counts[r.value] = (counts[r.value] || 0) + 1;
      });
    return counts;
  }, [recentResponses]);

  const hasResponses = Object.keys(pollData).length > 0;

  return (
    <group>
      <FloatingText position={[0, 2.8, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2} maxWidth={12}>
        Where do you need this to run?
      </FloatingText>

      {hasResponses ? (
        <BarChart3D data={pollData} position={[0, -0.8, 0]} maxHeight={2.5} barWidth={1.5} />
      ) : (
        <group>
          <FloatingText position={[0, 0, 0]} fontSize={0.22} color="#ef223a" delay={0.8}>
            Check your phone to vote
          </FloatingText>
          <FloatingText position={[0, -0.6, 0]} fontSize={0.15} color="#7e869c" delay={1}>
            Results will appear here in real-time
          </FloatingText>
        </group>
      )}

      <ParticleField count={100} spread={14} color="#ef223a" speed={0.08} size={0.015} />
      <pointLight position={[0, 2, 3]} color="#ef223a" intensity={1} distance={10} />
    </group>
  );
}
