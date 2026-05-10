import { FloatingText, ParticleField } from '../objects';

export default function Stage07ThinkChannels() {
  const doors = [
    { label: 'Phone', x: -3 },
    { label: 'Chat', x: 0 },
    { label: 'Email', x: 3 },
  ];

  return (
    <group>
      <ParticleField count={100} spread={12} color="#ffffff" speed={0.05} size={0.01} />

      <FloatingText position={[0, 3.5, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2} maxWidth={10}>
        We've learned to think in channels.
      </FloatingText>

      {doors.map((door, i) => (
        <group key={door.label} position={[door.x, 0, 0]}>
          {/* Door frame */}
          <mesh>
            <boxGeometry args={[1.5, 3, 0.1]} />
            <meshStandardMaterial
              color="#0D1B2A"
              emissive="#F22F46"
              emissiveIntensity={0.2}
            />
          </mesh>
          {/* Door panel */}
          <mesh position={[0, 0, 0.06]}>
            <boxGeometry args={[1.3, 2.8, 0.02]} />
            <meshStandardMaterial color="#1a1a3e" />
          </mesh>
          <FloatingText position={[0, -2, 0.1]} fontSize={0.15} color="#F22F46" delay={0.4 + i * 0.2}>
            {door.label}
          </FloatingText>
          <pointLight position={[0, 0, 1]} color="#F22F46" intensity={0.5} distance={3} />
        </group>
      ))}
    </group>
  );
}
