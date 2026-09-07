import { FloatingText, ParticleField } from '../objects';
import { Html } from '@react-three/drei';
import { useIsStageActive } from '../components/Stage';
import { useSlots } from '../hooks/useSlots';

const stats = [
  { pct: '36%', label: 'try to fix it themselves' },
  { pct: '34%', label: 'jump to another channel' },
  { pct: '30%', label: 'give up altogether' },
];

export default function Stage07ImpatientCustomers() {
  const slot = useSlots();
  const active = useIsStageActive();

  return (
    <group>
      <ParticleField count={60} color="#ef223a" speed={0.04} spread={12} size={0.012} />

      <FloatingText position={[0, 2.8, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2} maxWidth={10}>
        {slot('headline')}
      </FloatingText>

      {active && <Html center transform position={[0, 0, 0]}>
        <div style={{
          display: 'flex',
          gap: 24,
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              width: 90,
              background: '#000d25',
              border: '1px solid rgba(239, 34, 58, 0.4)',
              borderRadius: 8,
              padding: '12px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(239, 34, 58, 0.15)',
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ef223a', marginBottom: 4 }}>
                {s.pct}
              </div>
              <div style={{ fontSize: 8, color: '#babecc', textAlign: 'center', lineHeight: 1.4 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </Html>}

      <FloatingText position={[0, -2.8, 0]} fontSize={0.1} color="#4d5777" delay={1.5}>
        {slot('footnote')}
      </FloatingText>

      <pointLight position={[0, 2, 3]} color="#ef223a" intensity={0.8} distance={8} />
    </group>
  );
}
