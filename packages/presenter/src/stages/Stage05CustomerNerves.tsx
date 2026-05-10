import { ParticleField, FloatingText, BarChart3D } from '../objects';
import { usePresenterStore } from '../store';

export default function Stage05CustomerNerves() {
  const results = usePresenterStore((s) => s.aggregateResults);
  const pollData = results?.stageIndex === 4 ? results.results : {};

  return (
    <group>
      <ParticleField count={400} color="#F22F46" speed={1.2} spread={14} size={0.025} />
      <ParticleField count={100} color="#ffffff" speed={0.8} spread={10} size={0.015} />

      <FloatingText position={[0, 3.5, 0]} fontSize={0.35} color="#ffffff" bold delay={0.2} maxWidth={10}>
        {"Who's getting on their\ncustomers' nerves?"}
      </FloatingText>

      <BarChart3D data={pollData} position={[0, -0.5, 0]} maxHeight={2.5} barWidth={1.2} />

      <pointLight position={[3, 3, 2]} color="#F22F46" intensity={2} distance={10} />
      <pointLight position={[-3, -2, 2]} color="#F22F46" intensity={1} distance={8} />
    </group>
  );
}
