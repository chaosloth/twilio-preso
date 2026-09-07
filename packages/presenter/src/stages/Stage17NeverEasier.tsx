import { FloatingText, ParticleField, TwilioGem, SceneAccents } from '../objects';
import { usePresenterStore } from '../store';
import { useSlots } from '../hooks/useSlots';

export default function Stage17NeverEasier() {
  const slot = useSlots();
  const participants = usePresenterStore((s) => s.totalParticipants);
  const responses = usePresenterStore((s) => s.recentResponses);

  return (
    <group>
      <TwilioGem scale={2.5} position={[0, 0, -2]} wireframe emissiveIntensity={0.3} rotationSpeed={0.05} />
      <ParticleField count={150} spread={15} color="#ef223a" speed={0.08} size={0.02} />
      <ParticleField count={100} spread={12} color="#ffffff" speed={0.05} size={0.015} />

      <FloatingText position={[0, 1.2, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2} maxWidth={14}>
        {slot('headline')}
      </FloatingText>

      {/* Stats */}
      <FloatingText position={[-3, -0.3, 0]} fontSize={0.8} color="#ef223a" bold delay={0.5}>
        {String(participants)}
      </FloatingText>
      <FloatingText position={[-3, -1, 0]} fontSize={0.2} color="#ffffff" delay={0.6}>
        participants
      </FloatingText>

      <FloatingText position={[0, -0.3, 0]} fontSize={0.8} color="#ef223a" bold delay={0.7}>
        {String(responses.length)}
      </FloatingText>
      <FloatingText position={[0, -1, 0]} fontSize={0.2} color="#ffffff" delay={0.8}>
        interactions
      </FloatingText>

      <FloatingText position={[3, -0.3, 0]} fontSize={0.8} color="#ef223a" bold delay={0.9}>
        20
      </FloatingText>
      <FloatingText position={[3, -1, 0]} fontSize={0.2} color="#ffffff" delay={1}>
        stages
      </FloatingText>

      <pointLight position={[0, 3, 3]} color="#ef223a" intensity={1.5} distance={10} />
      <SceneAccents count={12} spread={12} seed={17} />
    </group>
  );
}
