import { FloatingText, ParticleField } from '../objects';
import { Html } from '@react-three/drei';
import { useIsStageActive } from '../components/Stage';
import { useSlots } from '../hooks/useSlots';

const quotes = [
  "Why do your emails get me, but your agent doesn't?",
  "I called three times already, don't you know this?",
];

export default function Stage08Siloes() {
  const slot = useSlots();
  const active = useIsStageActive();

  return (
    <group>
      <FloatingText position={[0, 2.8, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2} maxWidth={10}>
        {slot('headline')}
      </FloatingText>

      {active && <Html center transform position={[0, 0, 0]}>
        <div style={{ display: 'flex', gap: 14, fontFamily: "'Space Grotesk', sans-serif" }}>
          {quotes.map((quote, i) => (
            <div key={i} style={{
              maxWidth: 180,
              background: '#0a1535',
              borderRadius: 8,
              padding: '10px 12px',
              border: '1px solid rgba(186, 190, 204, 0.2)',
            }}>
              <span style={{ fontSize: 9, color: '#babecc', lineHeight: 1.5, display: 'block' }}>
                "{quote}"
              </span>
            </div>
          ))}
        </div>
      </Html>}

      <ParticleField count={60} spread={10} color="#ef223a" speed={0.02} size={0.012} />
      <pointLight position={[0, 0, 3]} color="#ef223a" intensity={0.6} distance={8} />
    </group>
  );
}
