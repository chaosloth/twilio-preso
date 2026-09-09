import { TwilioGem, ParticleField, FloatingText } from '../objects';
import { Html } from '@react-three/drei';
import { usePresenterStore } from '../store';
import { QRCodeSVG } from 'qrcode.react';
import { useSlots } from '../hooks/useSlots';

const AUDIENCE_URL = import.meta.env.VITE_AUDIENCE_URL || 'http://localhost:3002';

/**
 * The QR code and the instruction that goes with it — nothing else. No presenter
 * photo, name or title: the person is on stage beside the screen, and the only
 * thing the room has to act on is the scan.
 */
export default function Stage01Opening() {
  const slot = useSlots();
  const participants = usePresenterStore((s) => s.totalParticipants);
  const joinCode = usePresenterStore((s) => s.joinCode);
  // The deep link, so a scan lands on this session rather than a code prompt.
  const joinUrl = `${AUDIENCE_URL}/j/${joinCode}`;

  return (
    <group>
      <TwilioGem scale={2.4} emissiveIntensity={0.6} rotationSpeed={0.1} position={[0, 0, -6]} />
      <ParticleField count={Math.min(participants * 10 + 80, 600)} spread={12} size={0.02} speed={0.15} />

      <FloatingText position={[0, 3.1, 0]} fontSize={0.42} color="#ffffff" bold delay={0.2}>
        {slot('headline')}
      </FloatingText>

      <Html position={[0, 0.45, 0]} center transform scale={0.58}>
        <div style={{ background: 'white', padding: 24, borderRadius: 16, boxShadow: '0 0 60px rgba(242,47,70,0.4)' }}>
          <QRCodeSVG value={joinUrl} size={240} level="M" />
        </div>
      </Html>

      {/* The code in text for anyone who cannot scan. Space Grotesk, not
          Tektur — it is a value, not a headline. */}
      <Html position={[0, -2.55, 0]} center transform scale={0.42}>
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: 9,
            color: '#ffffff',
            background: '#1e3a5f',
            padding: '10px 20px',
            borderRadius: 10,
            whiteSpace: 'nowrap',
          }}
        >
          {joinCode}
        </div>
      </Html>

      <FloatingText position={[0, -3.3, 0]} fontSize={0.22} color="#ef223a" delay={0.8}>
        {`${participants} connected`}
      </FloatingText>

      <pointLight position={[0, 2, 3]} color="#ef223a" intensity={1.5} distance={10} />
      <pointLight position={[0, -2, 3]} color="#ffffff" intensity={0.5} distance={6} />
    </group>
  );
}
