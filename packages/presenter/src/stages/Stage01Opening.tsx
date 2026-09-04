import { TwilioGem, ParticleField, FloatingText } from '../objects';
import { Html, useTexture } from '@react-three/drei';
import { usePresenterStore } from '../store';
import { QRCodeSVG } from 'qrcode.react';

const AUDIENCE_URL = import.meta.env.VITE_AUDIENCE_URL || 'http://localhost:3002';

function PresenterPhoto() {
  const texture = useTexture('/images/connolly.png');
  return (
    <mesh>
      <planeGeometry args={[3, 3.5]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
}

export default function Stage01Opening() {
  const participants = usePresenterStore((s) => s.totalParticipants);
  const joinCode = usePresenterStore((s) => s.joinCode);
  // The deep link, so a scan lands on this session rather than a code prompt.
  const joinUrl = `${AUDIENCE_URL}/j/${joinCode}`;

  return (
    <group>
      <TwilioGem scale={1.2} emissiveIntensity={0.6} rotationSpeed={0.1} position={[0, 0, -2]} />
      <ParticleField count={Math.min(participants * 10 + 80, 600)} spread={12} size={0.02} speed={0.15} />

      {/* Left side: Speaker photo + info */}
      <group position={[-3, 0, 0]}>
        <PresenterPhoto />
        <FloatingText position={[0, -2.4, 0.1]} fontSize={0.24} color="#ffffff" bold delay={0.3}>
          Christopher Connolly
        </FloatingText>
        <FloatingText position={[0, -3, 0.1]} fontSize={0.12} color="#7e869c" delay={0.5}>
          Director, Solutions Engineering, Twilio APJ
        </FloatingText>
      </group>

      {/* Right side: QR + join */}
      <group position={[3, 0, 0]}>
        <FloatingText position={[0, 2.2, 0]} fontSize={0.32} color="#ffffff" bold delay={0.2}>
          Scan to Join
        </FloatingText>
        <FloatingText position={[0, 1.6, 0]} fontSize={0.14} color="#7e869c" delay={0.4}>
          Be part of the live demo
        </FloatingText>
        <Html position={[0, -0.3, 0]} center transform>
          <div style={{ background: 'white', padding: 20, borderRadius: 16, boxShadow: '0 0 60px rgba(242,47,70,0.4)' }}>
            <QRCodeSVG value={joinUrl} size={180} level="M" />
          </div>
        </Html>
        {/* The code in text for anyone who cannot scan. Space Grotesk, not
            Tektur — it is a value, not a headline. */}
        <Html position={[0, -1.9, 0]} center transform>
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: 8,
              color: '#ffffff',
              background: '#1e3a5f',
              padding: '8px 18px',
              borderRadius: 10,
              whiteSpace: 'nowrap',
            }}
          >
            {joinCode}
          </div>
        </Html>
        <FloatingText position={[0, -2.8, 0]} fontSize={0.22} color="#ef223a" delay={0.8}>
          {`${participants} connected`}
        </FloatingText>
      </group>

      <pointLight position={[0, 2, 3]} color="#ef223a" intensity={1.5} distance={10} />
      <pointLight position={[0, -2, 3]} color="#ffffff" intensity={0.5} distance={6} />
    </group>
  );
}
