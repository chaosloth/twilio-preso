import { Html } from '@react-three/drei';
import { FloatingText, ParticleField } from '../objects';
import { usePresenterStore } from '../store';
import { useSlots } from '../hooks/useSlots';

/**
 * The inbound half of the voice demo: the room calls us. The number is read off
 * this screen, so it is the largest thing on it — and it comes from the session's
 * own claimed pool number, never a constant, because the relay identifies which
 * session a caller belongs to by the number they dialled.
 */
export default function Stage20CallIn() {
  const slot = useSlots();
  const phoneNumber = usePresenterStore((s) => s.phoneNumber);

  return (
    <group>
      <ParticleField count={180} spread={12} color="#ef223a" speed={0.12} size={0.02} />

      <FloatingText position={[0, 2.6, 0]} fontSize={0.34} color="#ffffff" bold delay={0.1} maxWidth={12}>
        {slot('headline')}
      </FloatingText>
      <FloatingText position={[0, 1.9, 0]} fontSize={0.14} color="#7e869c" delay={0.3}>
        {slot('subhead')}
      </FloatingText>

      {/* Space Grotesk, not Tektur: a phone number is a value, not a headline. */}
      <Html position={[0, 0.2, 0]} center transform>
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 88,
            fontWeight: 700,
            letterSpacing: 4,
            color: '#ffffff',
            background: '#000d25',
            border: '2px solid rgba(239,34,58,0.4)',
            borderRadius: 12,
            padding: '18px 40px',
            boxShadow: '0 0 60px rgba(239,34,58,0.35)',
            whiteSpace: 'nowrap',
          }}
        >
          {phoneNumber}
        </div>
      </Html>

      <FloatingText position={[0, -1.9, 0]} fontSize={0.16} color="#babecc" delay={0.5} maxWidth={11}>
        Tap “Call now” on your phone, or dial it yourself
      </FloatingText>
    </group>
  );
}
