import { ParticleField, FloatingText, SceneAccents } from '../objects';
import { Html } from '@react-three/drei';

export default function Stage03WhyWonder() {
  return (
    <group>
      <ParticleField count={400} spread={12} color="#ffffff" speed={0.05} size={0.012} />
      <ParticleField count={100} spread={8} color="#ef223a" speed={0.1} size={0.02} />

      <FloatingText position={[0, 2.8, 0]} fontSize={0.8} color="#ffffff" bold delay={0.2} maxWidth={10}>
        Why Wonder?
      </FloatingText>

      {/* Content box */}
      <Html position={[0, -0.3, 0]} center transform>
        <div style={{
          background: '#000d25',
          borderRadius: 16,
          padding: '32px 40px',
          maxWidth: 580,
          border: '2px solid rgba(239, 34, 58, 0.3)',
          boxShadow: '0 0 20px rgba(239, 34, 58, 0.1)',
        }}>
          <p style={{
            color: '#babecc',
            fontSize: 18,
            lineHeight: 1.7,
            margin: 0,
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            Technology once inspired awe. Today, speed and automation risk flattening experiences into something invisible. Wonder connects technology to imagination.
          </p>
          <p style={{
            color: '#ef223a',
            fontSize: 16,
            lineHeight: 1.6,
            marginTop: 16,
            marginBottom: 0,
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 500,
          }}>
            Behind every experience that feels like magic is someone who built it.
          </p>
        </div>
      </Html>

      <SceneAccents count={8} spread={12} seed={3} />
      <pointLight position={[0, 3, 3]} intensity={0.8} color="#ef223a" />
    </group>
  );
}
