import { GlowingPillar, FloatingText, ParticleField, BarChart3D } from '../objects';
import { usePresenterStore } from '../store';

export default function Stage16Innovation() {
  const results = usePresenterStore((s) => s.aggregateResults);
  const pollData = results?.stageIndex === 15 ? results.results : {};

  const maxVotes = Math.max(...Object.values(pollData), 1);

  return (
    <group>
      <FloatingText position={[0, 4, 0]} fontSize={0.35} color="#ffffff" bold delay={0.2} maxWidth={10}>
        Which product are you most excited to explore?
      </FloatingText>

      <GlowingPillar
        label="Orchestrator"
        sublabel={`${pollData['Conversation Orchestrator'] || 0} votes`}
        position={[-4, 0, 0]}
        intensity={(pollData['Conversation Orchestrator'] || 0) / maxVotes * 2 + 0.3}
      />
      <GlowingPillar
        label="Memory"
        sublabel={`${pollData['Conversation Memory'] || 0} votes`}
        position={[-1.3, 0, 0]}
        intensity={(pollData['Conversation Memory'] || 0) / maxVotes * 2 + 0.3}
      />
      <GlowingPillar
        label="Intelligence"
        sublabel={`${pollData['Conversation Intelligence'] || 0} votes`}
        position={[1.3, 0, 0]}
        intensity={(pollData['Conversation Intelligence'] || 0) / maxVotes * 2 + 0.3}
      />
      <GlowingPillar
        label="Agent Connect"
        sublabel={`${pollData['Agent Connect'] || 0} votes`}
        position={[4, 0, 0]}
        intensity={(pollData['Agent Connect'] || 0) / maxVotes * 2 + 0.3}
      />

      <ParticleField count={200} spread={14} color="#ef223a" speed={0.1} size={0.015} />
    </group>
  );
}
