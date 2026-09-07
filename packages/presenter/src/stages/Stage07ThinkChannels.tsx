import { FloatingText } from '../objects';
import { Html } from '@react-three/drei';
import { useIsStageActive } from '../components/Stage';
import { useSlots } from '../hooks/useSlots';

const channels = ['SMS', 'Voice', 'Email', 'Chat', 'Social'];

export default function Stage07ThinkChannels() {
  const slot = useSlots();
  const active = useIsStageActive();

  return (
    <group>
      <FloatingText position={[0, 2.8, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2} maxWidth={10}>
        {slot('headline')}
      </FloatingText>

      {active && <Html center transform position={[0, 0, 0]}>
        <div style={{ display: 'flex', gap: 16, fontFamily: "'Space Grotesk', sans-serif" }}>
          {channels.map((label, i) => (
            <div key={label} style={{
              width: 70,
              height: 60,
              background: '#000d25',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(239, 34, 58, 0.4)',
              boxShadow: '0 0 12px rgba(239, 34, 58, 0.2)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#ef223a' }}>{label}</span>
            </div>
          ))}
        </div>
      </Html>}
    </group>
  );
}
