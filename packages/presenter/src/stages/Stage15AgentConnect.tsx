import { FloatingText, ParticleField, TwilioGem } from '../objects';

export default function Stage15AgentConnect() {
  const agents = [
    { label: 'Voice', x: -2.5, y: 1 },
    { label: 'Chat', x: 0, y: 1.5 },
    { label: 'SMS', x: 2.5, y: 1 },
    { label: 'WhatsApp', x: -1.5, y: -0.5 },
    { label: 'Email', x: 1.5, y: -0.5 },
  ];

  return (
    <group>
      <FloatingText position={[0, 3.5, 0]} fontSize={0.45} color="#ef223a" bold delay={0}>
        Agent Connect
      </FloatingText>
      <FloatingText position={[0, 2.7, 0]} fontSize={0.13} color="#7e869c" delay={0.3}>
        GA
      </FloatingText>

      <FloatingText position={[-3.5, -2, 0]} fontSize={0.14} color="#ffffff" delay={0.4} maxWidth={4} anchorX="left">
        Bring Your Own AI Runtime
      </FloatingText>
      <FloatingText position={[-3.5, -2.7, 0]} fontSize={0.14} color="#ffffff" delay={0.6} maxWidth={4} anchorX="left">
        Seamless Real-Time Interaction
      </FloatingText>
      <FloatingText position={[-3.5, -3.4, 0]} fontSize={0.14} color="#ffffff" delay={0.8} maxWidth={4} anchorX="left">
        Enrich AI with Context
      </FloatingText>

      {/* Agent nodes connecting to central Twilio */}
      <TwilioGem scale={0.6} position={[0, 0, 0]} emissiveIntensity={1} rotationSpeed={0.3} />

      {agents.map((agent, i) => (
        <group key={agent.label} position={[agent.x, agent.y, 0]}>
          <mesh>
            <octahedronGeometry args={[0.25]} />
            <meshStandardMaterial color="#ef223a" emissive="#ef223a" emissiveIntensity={0.8} />
          </mesh>
          <FloatingText position={[0, -0.5, 0]} fontSize={0.1} color="#ffffff" delay={0.4 + i * 0.1}>
            {agent.label}
          </FloatingText>
        </group>
      ))}

      <ParticleField count={150} spread={8} color="#ef223a" speed={0.15} size={0.015} />
      <pointLight position={[0, 0, 3]} color="#ef223a" intensity={2} distance={8} />
    </group>
  );
}
