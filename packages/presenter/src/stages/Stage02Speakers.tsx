import { TwilioGem, FloatingText, ParticleField, SceneAccents } from '../objects';

export default function Stage02Speakers() {
  return (
    <group>
      <TwilioGem scale={2} position={[0, 0, -3]} emissiveIntensity={0.4} rotationSpeed={0.08} wireframe />
      <ParticleField count={200} spread={14} color="#F22F46" speed={0.08} size={0.02} />

      <FloatingText position={[0, 1.5, 0]} fontSize={0.55} color="#F22F46" heading delay={0.2}>
        SIGNAL
      </FloatingText>
      <FloatingText position={[0, 0.5, 0]} fontSize={0.45} color="#ffffff" bold delay={0.4}>
        World Tour 2026
      </FloatingText>
      <FloatingText position={[0, -0.8, 0]} fontSize={0.16} color="#888888" delay={0.7}>
        Wonder — reconnecting technology to imagination
      </FloatingText>

      <SceneAccents count={8} spread={12} seed={2} />
      <pointLight position={[0, 3, 3]} color="#F22F46" intensity={1.5} distance={10} />
    </group>
  );
}
