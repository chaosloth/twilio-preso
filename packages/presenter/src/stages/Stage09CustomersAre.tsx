import { FloatingText, ParticleField, WordCloud3D, SceneAccents } from '../objects';
import { usePresenterStore } from '../store';
import { useMemo } from 'react';
import { useSlots } from '../hooks/useSlots';

export default function Stage09CustomersAre() {
  const slot = useSlots();
  const recentResponses = usePresenterStore((s) => s.recentResponses);

  const words = useMemo(() => {
    const wordMap: Record<string, number> = {};
    recentResponses
      .filter((r) => r.stageId === 'customers-are' && r.interactionType === 'text')
      .forEach((r) => {
        const word = r.value.toLowerCase();
        wordMap[word] = (wordMap[word] || 0) + 1;
      });
    return Object.entries(wordMap).map(([text, count]) => ({ text, count }));
  }, [recentResponses]);

  return (
    <group>
      <ParticleField count={100} spread={12} color="#ef223a" speed={0.1} size={0.015} />

      <FloatingText position={[0, 2.8, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2} maxWidth={14}>
        {slot('headline')}
      </FloatingText>

      {words.length > 0 ? (
        <WordCloud3D words={words} spread={5} position={[0, 0, 0]} />
      ) : (
        <group>
          <FloatingText position={[0, 0, 0]} fontSize={0.2} color="#ef223a" delay={0.8}>
            {slot('waiting')}
          </FloatingText>
          <FloatingText position={[0, -0.5, 0]} fontSize={0.14} color="#7e869c" delay={1}>
            {slot('waitingHint')}
          </FloatingText>
        </group>
      )}

      <FloatingText position={[0, -2.8, 0]} fontSize={0.18} color="#7e869c" delay={0.5}>
        {`${words.length} responses`}
      </FloatingText>

      <pointLight position={[0, 0, 3]} color="#ef223a" intensity={1} distance={8} />
      <SceneAccents count={10} spread={12} seed={9} />
    </group>
  );
}
