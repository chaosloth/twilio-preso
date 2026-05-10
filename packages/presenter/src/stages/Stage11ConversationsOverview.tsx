import { GlowingPillar, FloatingText, ParticleField } from '../objects';

export default function Stage11ConversationsOverview() {
  return (
    <group>
      <FloatingText position={[0, 4, 0]} fontSize={0.5} color="#F22F46" bold delay={0}>
        Twilio Conversations
      </FloatingText>
      <FloatingText position={[0, 3.2, 0]} fontSize={0.15} color="#cccccc" delay={0.3} maxWidth={10}>
        A foundation for driving customer lifetime value through every interaction
      </FloatingText>

      <GlowingPillar label="Orchestrator" sublabel="Coordination" position={[-4, 0, 0]} intensity={1.2} />
      <GlowingPillar label="Memory" sublabel="Context" position={[-1.3, 0, 0]} intensity={1.2} />
      <GlowingPillar label="Intelligence" sublabel="Actionability" position={[1.3, 0, 0]} intensity={1.2} />
      <GlowingPillar label="Agent Connect" sublabel="Connection" position={[4, 0, 0]} intensity={1.2} />

      <ParticleField count={200} spread={14} color="#F22F46" speed={0.08} size={0.015} />
    </group>
  );
}
