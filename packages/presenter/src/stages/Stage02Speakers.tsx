import { TwilioGem, FloatingText, ParticleField } from '../objects';

export default function Stage02Speakers() {
  return (
    <group>
      <TwilioGem scale={0.8} position={[0, 0, -1]} emissiveIntensity={0.4} rotationSpeed={0.05} />
      <ParticleField count={100} spread={12} color="#F22F46" speed={0.1} size={0.015} />

      {/* Left speaker */}
      <group position={[-2.5, 0, 0]}>
        <mesh>
          <planeGeometry args={[2, 2.5]} />
          <meshStandardMaterial color="#1a1a3e" emissive="#F22F46" emissiveIntensity={0.05} />
        </mesh>
        <FloatingText position={[0, -1.8, 0]} fontSize={0.18} color="#ffffff" bold delay={0.3}>
          Nicholas Kontopoulos
        </FloatingText>
        <FloatingText position={[0, -2.2, 0]} fontSize={0.1} color="#888888" delay={0.5}>
          VP of Marketing, Twilio APJ
        </FloatingText>
      </group>

      {/* Right speaker */}
      <group position={[2.5, 0, 0]}>
        <mesh>
          <planeGeometry args={[2, 2.5]} />
          <meshStandardMaterial color="#1a1a3e" emissive="#F22F46" emissiveIntensity={0.05} />
        </mesh>
        <FloatingText position={[0, -1.8, 0]} fontSize={0.18} color="#ffffff" bold delay={0.4}>
          Christopher Connolly
        </FloatingText>
        <FloatingText position={[0, -2.2, 0]} fontSize={0.1} color="#888888" delay={0.6}>
          Director, Solutions Engineering, Twilio APJ
        </FloatingText>
      </group>

      <pointLight position={[0, 3, 2]} intensity={1} color="#ffffff" />
    </group>
  );
}
