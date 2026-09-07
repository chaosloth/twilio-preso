import { FloatingText, ParticleField } from '../objects';
import { Html } from '@react-three/drei';
import { useIsStageActive } from '../components/Stage';
import { useSlots } from '../hooks/useSlots';

export default function Stage13Memory() {
  const slot = useSlots();
  const active = useIsStageActive();

  return (
    <group>
      <FloatingText position={[0, 3.2, 0]} fontSize={0.45} color="#ef223a" bold delay={0}>
        {slot('headline')}
      </FloatingText>


      {active && <Html center transform position={[0, -0.5, 0]}>
        <div style={{ position: 'relative', width: 320 }}>
          <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.1) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
          <img
            src="/images/conversation-memory.png"
            alt="Conversation Memory"
            style={{ width: 320, height: 'auto', display: 'block', position: 'relative', zIndex: 1 }}
          />
        </div>
      </Html>}

      <ParticleField count={100} spread={12} color="#ef223a" speed={0.05} size={0.012} />
      <pointLight position={[0, 2, 3]} color="#ef223a" intensity={0.8} distance={8} />
    </group>
  );
}
