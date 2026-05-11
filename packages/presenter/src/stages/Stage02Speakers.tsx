import { TwilioGem, FloatingText, ParticleField, SceneAccents } from '../objects';

export default function Stage02Speakers() {
  return (
    <group>
      <TwilioGem scale={2} position={[0, 0, -3]} emissiveIntensity={0.4} rotationSpeed={0.08} wireframe />
      <ParticleField count={200} spread={14} color="#ef223a" speed={0.08} size={0.02} />

      <FloatingText position={[0, 1.5, 0]} fontSize={1} color="#ffffff" heading delay={0.2}>
        Wonder
      </FloatingText>
      <FloatingText position={[0, -0.2, 0]} fontSize={0.3} color="#babecc" delay={0.5}>
        Connecting technology to imagination
      </FloatingText>

      {/* Pill badge */}
      <group position={[0, -1.4, 0]}>
        <mesh>
          <planeGeometry args={[3.5, 0.55]} />
          <meshStandardMaterial color="#1e3a5f" transparent opacity={0.9} />
        </mesh>
        {/* Rounded edges via smaller planes on sides */}
        <mesh position={[-1.65, 0, 0]}>
          <circleGeometry args={[0.275, 32]} />
          <meshStandardMaterial color="#1e3a5f" transparent opacity={0.9} />
        </mesh>
        <mesh position={[1.65, 0, 0]}>
          <circleGeometry args={[0.275, 32]} />
          <meshStandardMaterial color="#1e3a5f" transparent opacity={0.9} />
        </mesh>
        <FloatingText position={[0, 0, 0.05]} fontSize={0.18} color="#babecc" delay={0.7}>
          Twilio World Tour 2026
        </FloatingText>
      </group>

      <SceneAccents count={8} spread={12} seed={2} />
      <pointLight position={[0, 3, 3]} color="#ef223a" intensity={1.5} distance={10} />
    </group>
  );
}
