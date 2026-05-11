import { FloatingText, ParticleField } from '../objects';
import { Html } from '@react-three/drei';
import { useIsStageActive } from '../components/Stage';

export default function Stage14Intelligence() {
  const active = useIsStageActive();

  return (
    <group>
      <FloatingText position={[0, 3.2, 0]} fontSize={0.45} color="#ef223a" bold delay={0}>
        Conversation Intelligence
      </FloatingText>

      {/* Left side numbered list */}
      {active && <Html transform position={[-3, 0, 0]}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { num: '1', text: 'Real-time Reasoning Engine' },
            { num: '2', text: 'Persistent Customer Context' },
            { num: '3', text: 'Customer and Business Aware Guidance' },
          ].map((item) => (
            <div key={item.num} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#ef223a', minWidth: 20 }}>{item.num}</span>
              <span style={{ fontSize: 9, color: '#ffffff', fontWeight: 500 }}>{item.text}</span>
            </div>
          ))}
        </div>
      </Html>}

      {/* Right side graphic */}
      {active && <Html center transform position={[2.5, -0.3, 0]}>
        <div style={{ position: 'relative', width: 155 }}>
          <div style={{ position: 'absolute', inset: -15, borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.1) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
          <img
            src="/images/conversation-intelligence.png"
            alt="Conversation Intelligence"
            style={{ width: 155, height: 'auto', display: 'block', position: 'relative', zIndex: 1 }}
          />
        </div>
      </Html>}

      <ParticleField count={100} spread={12} color="#ef223a" speed={0.05} size={0.012} />
      <pointLight position={[0, 2, 3]} color="#ef223a" intensity={0.8} distance={8} />
    </group>
  );
}
