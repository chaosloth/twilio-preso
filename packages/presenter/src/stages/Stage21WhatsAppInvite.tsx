import { Html } from '@react-three/drei';
import { QRCodeSVG } from 'qrcode.react';
import { whatsappLink } from '@twilio-preso/shared';
import { FloatingText, ParticleField } from '../objects';
import { usePresenterStore } from '../store';
import { useSlots } from '../hooks/useSlots';

/**
 * Same number as the call-in stage, different channel. The QR encodes a `wa.me`
 * link rather than the number itself, so scanning opens WhatsApp with the chat
 * already addressed — nothing to type, and no contact to save.
 */
export default function Stage21WhatsAppInvite() {
  const slot = useSlots();
  const phoneNumber = usePresenterStore((s) => s.phoneNumber);

  return (
    <group>
      <ParticleField count={150} spread={12} color="#ef223a" speed={0.12} size={0.02} />

      <FloatingText position={[0, 2.6, 0]} fontSize={0.34} color="#ffffff" bold delay={0.1} maxWidth={12}>
        {slot('headline')}
      </FloatingText>
      <FloatingText position={[0, 1.95, 0]} fontSize={0.14} color="#7e869c" delay={0.3}>
        {slot('subhead')}
      </FloatingText>

      <Html position={[0, 0.1, 0]} center transform>
        <div style={{ background: 'white', padding: 20, borderRadius: 16, boxShadow: '0 0 60px rgba(239,34,58,0.4)' }}>
          <QRCodeSVG value={whatsappLink(phoneNumber)} size={200} level="M" />
        </div>
      </Html>

      {/* The number in text as well: anyone whose camera will not scan can still
          message it, and the presenter can read it out. */}
      <Html position={[0, -1.75, 0]} center transform>
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: 4,
            color: '#ffffff',
            background: '#1e3a5f',
            padding: '8px 20px',
            borderRadius: 10,
            whiteSpace: 'nowrap',
          }}
        >
          {phoneNumber}
        </div>
      </Html>
    </group>
  );
}
