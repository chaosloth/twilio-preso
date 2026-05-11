import { TwilioGem, FloatingText, ParticleField, SceneAccents } from '../objects';

export default function Stage02Speakers() {
  return (
    <group>
      <TwilioGem scale={2} position={[0, 0, -3]} emissiveIntensity={0.4} rotationSpeed={0.08} wireframe />
      <ParticleField count={200} spread={14} color="#ef223a" speed={0.08} size={0.02} />

      <FloatingText position={[0, 1.5, 0]} fontSize={0.65} color="#ef223a" heading delay={0.2}>
        Wonder
      </FloatingText>
      <FloatingText position={[0, 0.3, 0]} fontSize={0.2} color="#babecc" delay={0.5}>
        Reconnecting technology to imagination
      </FloatingText>
      <FloatingText position={[0, -0.5, 0]} fontSize={0.14} color="#7e869c" delay={0.7}>
        Twilio SIGNAL World Tour 2026
      </FloatingText>

      <SceneAccents count={8} spread={12} seed={2} />
      <pointLight position={[0, 3, 3]} color="#ef223a" intensity={1.5} distance={10} />
    </group>
  );
}
