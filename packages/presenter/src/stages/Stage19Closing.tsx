import { FloatingText, ParticleField, TwilioGem } from '../objects';

export default function Stage19Closing() {
  return (
    <group>
      <TwilioGem scale={2} position={[0, 0, -1]} emissiveIntensity={0.6} rotationSpeed={0.08} />
      <ParticleField count={600} spread={12} color="#ef223a" speed={0.15} size={0.025} />
      <ParticleField count={200} spread={10} color="#ffffff" speed={0.05} size={0.015} />

      <FloatingText position={[0, 2, 0]} fontSize={0.6} color="#ffffff" bold delay={0.2}>
        Thank you.
      </FloatingText>

      <FloatingText position={[0, 0.5, 0]} fontSize={0.25} color="#ef223a" delay={0.6}>
        letsGoMichelangeloMode();
      </FloatingText>

      <FloatingText position={[0, -1.5, 0]} fontSize={0.12} color="#7e869c" delay={1}>
        Scan for resources and follow-up
      </FloatingText>

      <pointLight position={[0, 3, 3]} color="#ef223a" intensity={2} distance={10} />
      <pointLight position={[0, -2, 2]} color="#ffffff" intensity={0.5} distance={6} />
    </group>
  );
}
