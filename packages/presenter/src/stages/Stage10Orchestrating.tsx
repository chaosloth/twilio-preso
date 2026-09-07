import { FloatingText, ParticleField } from '../objects';
import { useSlots } from '../hooks/useSlots';

export default function Stage10Orchestrating() {
  const slot = useSlots();
  return (
    <group>
      <ParticleField count={150} spread={12} color="#ef223a" speed={0.15} size={0.02} />

      <FloatingText position={[0, 0, 0]} fontSize={0.35} color="#ffffff" bold delay={0.2} maxWidth={12}>
        {slot('headline')}
      </FloatingText>
    </group>
  );
}
