import { ParticleField, FloatingText, BarChart3D, SceneAccents } from '../objects';
import { usePresenterStore } from '../store';
import { useMemo } from 'react';

export default function Stage05CustomerNerves() {
  const recentResponses = usePresenterStore((s) => s.recentResponses);

  const pollData = useMemo(() => {
    const counts: Record<string, number> = {};
    recentResponses
      .filter((r) => r.stageIndex === 4 && r.interactionType === 'poll')
      .forEach((r) => {
        counts[r.value] = (counts[r.value] || 0) + 1;
      });
    return counts;
  }, [recentResponses]);

  const hasResponses = Object.keys(pollData).length > 0;

  return (
    <group>
      <ParticleField count={150} color="#ef223a" speed={0.8} spread={12} size={0.02} />
      <ParticleField count={60} color="#ffffff" speed={0.5} spread={8} size={0.015} />

      <FloatingText position={[0, 2.5, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2} maxWidth={10}>
        {"Who's getting on their\ncustomers' nerves?"}
      </FloatingText>

      {hasResponses ? (
        <BarChart3D data={pollData} position={[0, -0.5, 0]} maxHeight={2.5} barWidth={1.2} />
      ) : (
        <group>
          <FloatingText position={[0, 0, 0]} fontSize={0.2} color="#ef223a" delay={0.8}>
            Check your phone to vote
          </FloatingText>
          <FloatingText position={[0, -0.5, 0]} fontSize={0.14} color="#7e869c" delay={1}>
            Results will appear here in real-time
          </FloatingText>
        </group>
      )}

      <SceneAccents count={10} spread={10} seed={5} />
      <pointLight position={[3, 2, 3]} color="#ef223a" intensity={1.5} distance={10} />
      <pointLight position={[-3, -1, 2]} color="#ef223a" intensity={0.8} distance={8} />
    </group>
  );
}
