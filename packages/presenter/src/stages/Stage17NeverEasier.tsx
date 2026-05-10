import { FloatingText, ParticleField, TwilioGem } from '../objects';
import { usePresenterStore } from '../store';

export default function Stage17NeverEasier() {
  const participants = usePresenterStore((s) => s.totalParticipants);
  const responses = usePresenterStore((s) => s.recentResponses);

  return (
    <group>
      <TwilioGem scale={2.5} position={[0, 0, -2]} wireframe emissiveIntensity={0.3} rotationSpeed={0.05} />
      <ParticleField count={500} spread={15} color="#F22F46" speed={0.08} size={0.02} />
      <ParticleField count={300} spread={12} color="#ffffff" speed={0.05} size={0.015} />

      <FloatingText position={[0, 3, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2} maxWidth={10}>
        It's never been easier to build amazing engagement.
      </FloatingText>

      {/* Stats */}
      <FloatingText position={[-3, 0.5, 0]} fontSize={0.8} color="#F22F46" bold delay={0.5}>
        {String(participants)}
      </FloatingText>
      <FloatingText position={[-3, -0.2, 0]} fontSize={0.12} color="#ffffff" delay={0.6}>
        participants
      </FloatingText>

      <FloatingText position={[0, 0.5, 0]} fontSize={0.8} color="#F22F46" bold delay={0.7}>
        {String(responses.length)}
      </FloatingText>
      <FloatingText position={[0, -0.2, 0]} fontSize={0.12} color="#ffffff" delay={0.8}>
        interactions
      </FloatingText>

      <FloatingText position={[3, 0.5, 0]} fontSize={0.8} color="#F22F46" bold delay={0.9}>
        19
      </FloatingText>
      <FloatingText position={[3, -0.2, 0]} fontSize={0.12} color="#ffffff" delay={1}>
        stages
      </FloatingText>

      <pointLight position={[0, 3, 3]} color="#F22F46" intensity={1.5} distance={10} />
    </group>
  );
}
