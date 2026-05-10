import { useMemo } from 'react';
import { Text } from '@react-three/drei';

interface WordCloud3DProps {
  words: Array<{ text: string; count: number }>;
  spread?: number;
  position?: [number, number, number];
}

export function WordCloud3D({ words, spread = 4, position = [0, 0, 0] }: WordCloud3DProps) {
  const positions = useMemo(() => {
    return words.map((_, i) => {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / Math.max(words.length, 1));
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      return {
        x: Math.sin(phi) * Math.cos(theta) * spread * 0.8,
        y: Math.sin(phi) * Math.sin(theta) * spread * 0.5,
        z: (Math.cos(phi) - 1) * spread * 0.2,
      };
    });
  }, [words.length, spread]);

  const maxCount = Math.max(...words.map((w) => w.count), 1);

  return (
    <group position={position}>
      {words.map((word, i) => {
        const scale = 0.15 + (word.count / maxCount) * 0.35;
        const pos = positions[i];
        if (!pos) return null;
        return (
          <Text
            key={`${word.text}-${i}`}
            position={[pos.x, pos.y, pos.z]}
            fontSize={scale}
            color={word.count > maxCount * 0.5 ? '#F22F46' : '#ffffff'}
            anchorX="center"
            anchorY="middle"
          >
            {word.text}
          </Text>
        );
      })}
    </group>
  );
}
