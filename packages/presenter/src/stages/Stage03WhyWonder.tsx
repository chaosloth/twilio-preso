import { ParticleField, FloatingText, SceneAccents } from '../objects';

export default function Stage03WhyWonder() {
  return (
    <group>
      <ParticleField count={400} spread={12} color="#ffffff" speed={0.05} size={0.012} />
      <ParticleField count={100} spread={8} color="#ef223a" speed={0.1} size={0.02} />

      <FloatingText position={[0, 2.8, 0]} fontSize={0.8} color="#ffffff" bold delay={0.2} maxWidth={10}>
        Why Wonder?
      </FloatingText>

      {/* Content box as 3D mesh — won't bleed into other stages */}
      <group position={[0, -0.2, 0]}>
        <mesh position={[0, 0, -0.05]}>
          <planeGeometry args={[9, 3.5]} />
          <meshStandardMaterial color="#000d25" transparent opacity={0.9} />
        </mesh>
        {/* Border effect */}
        <mesh position={[0, 0, -0.04]}>
          <planeGeometry args={[9.05, 3.55]} />
          <meshStandardMaterial color="#1e3a5f" transparent opacity={0.3} />
        </mesh>

        <FloatingText position={[0, 0.5, 0]} fontSize={0.22} color="#babecc" delay={0.6} maxWidth={7.5}>
          Technology once inspired awe. Today, speed and automation risk flattening experiences into something invisible. Wonder connects technology to imagination.
        </FloatingText>
        <FloatingText position={[0, -1, 0]} fontSize={0.2} color="#ef223a" delay={1} maxWidth={7.5}>
          Behind every experience that feels like magic is someone who built it.
        </FloatingText>
      </group>

      <SceneAccents count={8} spread={12} seed={3} />
      <pointLight position={[0, 3, 3]} intensity={0.8} color="#ef223a" />
    </group>
  );
}
