import { ParticleField, FloatingText } from '../objects';

export default function Stage03WhyWonder() {
  return (
    <group>
      <ParticleField count={800} spread={15} color="#ffffff" speed={0.05} size={0.015} />
      <ParticleField count={200} spread={12} color="#F22F46" speed={0.1} size={0.03} />

      <FloatingText position={[0, 1.5, 0]} fontSize={0.7} color="#ffffff" bold delay={0.2} maxWidth={10}>
        Why Wonder?
      </FloatingText>
      <FloatingText position={[0, -0.5, 0]} fontSize={0.18} color="#cccccc" delay={0.6} maxWidth={8}>
        Technology once inspired awe. Today, speed and automation risk flattening experiences into something invisible. Wonder reconnects technology to imagination.
      </FloatingText>
      <FloatingText position={[0, -2, 0]} fontSize={0.15} color="#F22F46" delay={1} maxWidth={8}>
        Behind every experience that feels like magic is someone who built it.
      </FloatingText>

      <pointLight position={[0, 5, 3]} intensity={0.5} color="#F22F46" />
    </group>
  );
}
