import { FloatingText } from '../objects';
import { Html } from '@react-three/drei';
import { useIsStageActive } from '../components/Stage';
import { useSlots } from '../hooks/useSlots';

const concepts = [
  { title: 'Conversation Intelligence', desc: 'Understand what customers mean, not just what they say' },
  { title: 'Conversation Memory', desc: 'Retain full context across every touchpoint' },
  { title: 'Conversation Orchestration', desc: 'Coordinate seamless journeys across channels' },
  { title: 'Agent Connect', desc: 'Bridge AI and human agents seamlessly' },
];

export default function Stage12Orchestrator() {
  const slot = useSlots();
  const active = useIsStageActive();

  return (
    <group>
      <FloatingText position={[0, 3, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2} maxWidth={12}>
        {slot('headline')}
      </FloatingText>

      {active && <Html center transform position={[0, 0, 0]}>
        <div style={{ display: 'flex', gap: 10, fontFamily: "'Space Grotesk', sans-serif" }}>
          {concepts.map((c, i) => (
            <div key={i} style={{
              width: 105,
              background: '#000d25',
              borderRadius: 10,
              padding: '14px 10px',
              border: '2px solid rgba(239, 34, 58, 0.4)',
              boxShadow: '0 0 12px rgba(239, 34, 58, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#ef223a', marginBottom: 6 }}>
                {c.title}
              </div>
              <div style={{ fontSize: 7.5, color: '#babecc', lineHeight: 1.4 }}>
                {c.desc}
              </div>
            </div>
          ))}
        </div>
      </Html>}

      <pointLight position={[0, 2, 3]} color="#ef223a" intensity={0.8} distance={8} />
    </group>
  );
}
