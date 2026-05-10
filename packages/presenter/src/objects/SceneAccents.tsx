import { useMemo } from 'react';
import { HexRing } from './HexRing';
import { DataNode } from './DataNode';
import { FloatingOrb } from './FloatingOrb';
import { WireframeCube } from './WireframeCube';
import { TwilioGem } from './TwilioGem';

interface SceneAccentsProps {
  count?: number;
  spread?: number;
  color?: string;
  seed?: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function SceneAccents({
  count = 12,
  spread = 8,
  color = '#F22F46',
  seed = 42,
}: SceneAccentsProps) {
  const elements = useMemo(() => {
    const rng = seededRandom(seed);
    return Array.from({ length: count }, (_, i) => {
      const type = Math.floor(rng() * 5);
      const x = (rng() - 0.5) * spread;
      const y = (rng() - 0.5) * spread * 0.6;
      const z = -1 - rng() * 3;
      const scale = 0.1 + rng() * 0.35;
      const speed = 0.1 + rng() * 0.4;
      return { type, x, y, z, scale, speed, id: i };
    });
  }, [count, spread, seed]);

  return (
    <group>
      {elements.map((el) => {
        const pos: [number, number, number] = [el.x, el.y, el.z];
        switch (el.type) {
          case 0:
            return <TwilioGem key={el.id} position={pos} scale={el.scale} rotationSpeed={el.speed} emissiveIntensity={0.3} color={color} />;
          case 1:
            return <HexRing key={el.id} position={pos} scale={el.scale} rotationSpeed={el.speed} color={color} />;
          case 2:
            return <DataNode key={el.id} position={pos} scale={el.scale * 0.8} pulseSpeed={el.speed * 4} color={color} />;
          case 3:
            return <FloatingOrb key={el.id} position={pos} scale={el.scale * 0.6} speed={el.speed * 2} color={color} />;
          case 4:
            return <WireframeCube key={el.id} position={pos} scale={el.scale} rotationSpeed={el.speed} color={color} />;
          default:
            return null;
        }
      })}
    </group>
  );
}
