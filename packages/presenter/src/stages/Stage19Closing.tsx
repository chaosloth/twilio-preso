import { FloatingText, ParticleField, TwilioGem } from '../objects';
import { Html } from '@react-three/drei';
import { useIsStageActive } from '../components/Stage';
import { useSlots } from '../hooks/useSlots';

export default function Stage19Closing() {
  const slot = useSlots();
  const active = useIsStageActive();
  return (
    <group>
      <TwilioGem scale={2} position={[0, 0, -1]} emissiveIntensity={0.6} rotationSpeed={0.08} />
      <ParticleField count={150} spread={12} color="#ef223a" speed={0.15} size={0.025} />
      <ParticleField count={100} spread={10} color="#ffffff" speed={0.05} size={0.015} />

      <FloatingText position={[0, 0.5, 0]} fontSize={0.5} color="#ffffff" bold delay={0.2} maxWidth={12}>
        {slot('headline')}
      </FloatingText>

      <FloatingText position={[0, -0.8, 0]} fontSize={0.25} color="#ef223a" bold delay={1} maxWidth={12}>
        {slot('subhead')}
      </FloatingText>

      {active && <Html center transform position={[0, -2, 0]}>
        <img src="/images/twilio-logo-full.png" alt="Twilio" style={{ width: 60, height: 'auto' }} />
      </Html>}

      <pointLight position={[0, 3, 3]} color="#ef223a" intensity={2} distance={10} />
      <pointLight position={[0, -2, 2]} color="#ffffff" intensity={0.5} distance={6} />
    </group>
  );
}
