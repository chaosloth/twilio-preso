import { FloatingText, ParticleField } from '../objects';

export default function Stage18MassCall() {
  return (
    <group>
      <ParticleField count={150} spread={12} color="#ef223a" speed={0.15} size={0.02} />

      <FloatingText position={[0, 0, 0]} fontSize={0.35} color="#ffffff" bold delay={0.2} maxWidth={12}>
        Imagine being able to speak to all of your customers at once...
      </FloatingText>
    </group>
  );
}
