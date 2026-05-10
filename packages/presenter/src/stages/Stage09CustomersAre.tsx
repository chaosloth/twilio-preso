import { FloatingText, ParticleField, WordCloud3D, SceneAccents } from '../objects';
import { usePresenterStore } from '../store';
import { useMemo } from 'react';

export default function Stage09CustomersAre() {
  const results = usePresenterStore((s) => s.aggregateResults);
  const recentResponses = usePresenterStore((s) => s.recentResponses);

  const words = useMemo(() => {
    // Build words from aggregate results for stage 8 (index 8)
    if (results?.stageIndex === 8 && results.results) {
      return Object.entries(results.results).map(([text, count]) => ({ text, count }));
    }
    // Fallback: build from recent responses
    const wordMap: Record<string, number> = {};
    recentResponses
      .filter((r) => r.stageIndex === 8)
      .forEach((r) => {
        const word = r.value.toLowerCase();
        wordMap[word] = (wordMap[word] || 0) + 1;
      });
    return Object.entries(wordMap).map(([text, count]) => ({ text, count }));
  }, [results, recentResponses]);

  return (
    <group>
      <ParticleField count={100} spread={12} color="#ef223a" speed={0.1} size={0.015} />

      <FloatingText position={[0, 2.8, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2} maxWidth={10}>
        {'In one word, your biggest\nCX challenge?'}
      </FloatingText>

      <WordCloud3D words={words} spread={5} position={[0, 0, 0]} />

      <FloatingText position={[0, -3.5, 0]} fontSize={0.18} color="#7e869c" delay={0.5}>
        {`${words.length} responses`}
      </FloatingText>

      <pointLight position={[0, 0, 3]} color="#ef223a" intensity={1} distance={8} />
      <SceneAccents count={10} spread={12} seed={9} />
    </group>
  );
}
