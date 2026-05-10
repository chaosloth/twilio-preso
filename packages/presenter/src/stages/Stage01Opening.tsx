import { TwilioGem, ParticleField, FloatingText } from '../objects';
import { Html } from '@react-three/drei';
import { usePresenterStore } from '../store';

export default function Stage01Opening() {
  const participants = usePresenterStore((s) => s.totalParticipants);

  return (
    <group>
      <TwilioGem scale={1.8} emissiveIntensity={1} rotationSpeed={0.15} />
      <ParticleField count={Math.min(participants * 10 + 50, 600)} spread={10} size={0.025} speed={0.2} />
      <FloatingText position={[0, 3.2, 0]} fontSize={0.18} color="#888888" delay={0.5}>
        Scan to join the experience
      </FloatingText>
      <FloatingText position={[0, -3.2, 0]} fontSize={0.25} color="#F22F46" delay={0.8}>
        {`${participants} connected`}
      </FloatingText>
      <Html position={[0, -1.8, 0]} center transform>
        <div style={{ background: 'white', padding: 16, borderRadius: 12, boxShadow: '0 0 40px rgba(242,47,70,0.3)' }}>
          <div style={{ width: 130, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#666' }}>
            QR CODE
          </div>
        </div>
      </Html>
      <pointLight position={[0, 0, 2]} color="#F22F46" intensity={2} distance={8} />
    </group>
  );
}
