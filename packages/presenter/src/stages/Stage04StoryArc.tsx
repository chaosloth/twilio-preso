import { FloatingText, ParticleField, SceneAccents } from '../objects';

const chapters = [
  { title: 'The invisible\nextraordinary', subtitle: 'Amazing experiences exist' },
  { title: 'Wonder is\ndesigned', subtitle: 'You are an architect of wonder' },
  { title: 'The lineage\nof builders', subtitle: 'Learn from best builders' },
  { title: 'Foundations\nfor bold ideas', subtitle: 'Get the right tools' },
  { title: 'Build without\nwalls', subtitle: 'Own your own freedom' },
  { title: 'Building for\nwonder', subtitle: 'Create wonder' },
];

export default function Stage04StoryArc() {
  const totalWidth = chapters.length * 2.2;
  const startX = -totalWidth / 2 + 1.1;

  return (
    <group>
      <ParticleField count={100} spread={14} color="#F22F46" speed={0.05} size={0.015} />

      <FloatingText position={[0, 3, 0]} fontSize={0.45} color="#ffffff" bold delay={0}>
        Wonder Story Arc
      </FloatingText>

      {chapters.map((chapter, i) => {
        const x = startX + i * 2.2;
        return (
          <group key={i} position={[x, 0, 0]}>
            {/* Card background */}
            <mesh>
              <boxGeometry args={[1.9, 2.8, 0.05]} />
              <meshStandardMaterial
                color="#0f1525"
                emissive="#F22F46"
                emissiveIntensity={0.08}
              />
            </mesh>
            {/* Part number */}
            <FloatingText position={[0, 0.9, 0.05]} fontSize={0.12} color="#888888" delay={0.2 + i * 0.1}>
              {`Part ${i + 1}`}
            </FloatingText>
            {/* Title */}
            <FloatingText position={[0, 0.2, 0.05]} fontSize={0.14} color="#F22F46" bold delay={0.3 + i * 0.1} maxWidth={1.6}>
              {chapter.title}
            </FloatingText>
            {/* Subtitle */}
            <FloatingText position={[0, -0.8, 0.05]} fontSize={0.09} color="#888888" delay={0.4 + i * 0.1} maxWidth={1.6}>
              {chapter.subtitle}
            </FloatingText>
            {/* Divider line */}
            <mesh position={[0, 0.55, 0.05]}>
              <boxGeometry args={[1.5, 0.01, 0.01]} />
              <meshStandardMaterial color="#F22F46" emissive="#F22F46" emissiveIntensity={1} />
            </mesh>
          </group>
        );
      })}

      <SceneAccents count={8} spread={14} seed={4} />
      <pointLight position={[0, 3, 3]} intensity={1} color="#ffffff" distance={10} />
    </group>
  );
}
