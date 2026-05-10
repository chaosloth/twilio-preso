import { ParticleField, FloatingText, SceneAccents } from '../objects';

export default function Stage03WhyWonder() {
  return (
    <group>
      <ParticleField count={600} spread={12} color="#ffffff" speed={0.05} size={0.015} />
      <ParticleField count={150} spread={8} color="#F22F46" speed={0.1} size={0.025} />

      <FloatingText position={[0, 2, 0]} fontSize={0.7} color="#ffffff" bold delay={0.2} maxWidth={10}>
        Why Wonder?
      </FloatingText>
      <FloatingText position={[0, 0, 0]} fontSize={0.24} color="#cccccc" delay={0.6} maxWidth={9}>
        Technology once inspired awe. Today, speed and automation risk flattening experiences into something invisible. Wonder reconnects technology to imagination.
      </FloatingText>
      <FloatingText position={[0, -2, 0]} fontSize={0.22} color="#F22F46" delay={1} maxWidth={9}>
        Behind every experience that feels like magic is someone who built it.
      </FloatingText>

      <SceneAccents count={14} spread={10} seed={3} />
      <pointLight position={[0, 3, 3]} intensity={0.8} color="#F22F46" />
    </group>
  );
}
