import { FloatingText, ParticleField } from '../objects';
import { Html } from '@react-three/drei';
import { useIsStageActive } from '../components/Stage';

const topics = [
  'Patience',
  'Customer Frustration',
  'Thinking in Silos',
  'New Generation',
  'Conversations',
  'Memory',
  'Intelligence',
  'Agent Connect',
];

export default function Stage04StoryArc() {
  const active = useIsStageActive();

  return (
    <group>
      <ParticleField count={60} spread={14} color="#ef223a" speed={0.05} size={0.012} />

      <FloatingText position={[0, 2.8, 0]} fontSize={0.45} color="#ffffff" bold delay={0} maxWidth={12}>
        Topics for today
      </FloatingText>

      {active && <Html center transform position={[0, -0.2, 0]}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
          {topics.map((topic, i) => (
            <div key={i} style={{
              width: 110,
              background: '#000d25',
              borderRadius: 8,
              padding: '8px 10px',
              border: '1px solid rgba(239, 34, 58, 0.4)',
              boxShadow: '0 0 8px rgba(239, 34, 58, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ef223a' }}>{i + 1}</span>
              <span style={{ fontSize: 8, color: '#ffffff', fontWeight: 500 }}>{topic}</span>
            </div>
          ))}
        </div>
      </Html>}

      <pointLight position={[0, 3, 3]} intensity={1} color="#ffffff" distance={10} />
    </group>
  );
}
