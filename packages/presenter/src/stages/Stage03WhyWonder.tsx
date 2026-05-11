import { ParticleField, FloatingText, SceneAccents } from '../objects';
import { Html } from '@react-three/drei';

export default function Stage03WhyWonder() {
  return (
    <group>
      <ParticleField count={600} spread={12} color="#ffffff" speed={0.05} size={0.015} />
      <ParticleField count={150} spread={8} color="#ef223a" speed={0.1} size={0.025} />

      <FloatingText position={[0, 2.5, 0]} fontSize={0.8} color="#ffffff" bold delay={0.2} maxWidth={10}>
        Why Wonder?
      </FloatingText>

      {/* Content box with rounded corners */}
      <Html position={[0, -0.3, 0]} center transform>
        <div style={{
          background: 'rgba(10, 20, 50, 0.85)',
          borderRadius: 20,
          padding: '36px 44px',
          maxWidth: 700,
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(186, 190, 204, 0.1)',
        }}>
          <p style={{
            color: '#babecc',
            fontSize: 22,
            lineHeight: 1.7,
            margin: 0,
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            Technology once inspired awe. Today, speed and automation risk flattening experiences into something invisible. Wonder connects technology to imagination.
          </p>
          <p style={{
            color: '#ef223a',
            fontSize: 20,
            lineHeight: 1.6,
            marginTop: 20,
            marginBottom: 0,
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 500,
          }}>
            Behind every experience that feels like magic is someone who built it.
          </p>
        </div>
      </Html>

      <SceneAccents count={10} spread={12} seed={3} />
      <pointLight position={[0, 3, 3]} intensity={0.8} color="#ef223a" />
    </group>
  );
}
