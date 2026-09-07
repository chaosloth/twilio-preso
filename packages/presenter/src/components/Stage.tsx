import { usePresenterStore } from '../store';
import { StageScene } from './StageScene';

const STAGE_SPACING = 50;

export { STAGE_SPACING };
// Re-exported from their own module now, so the HUD preview can provide the
// context without pulling in the whole stage container.
export { StageActiveContext, useIsStageActive } from './stageActive';

export function StageContainer() {
  const currentStageIndex = usePresenterStore((s) => s.currentStageIndex);
  const stages = usePresenterStore((s) => s.stages);

  return (
    <group>
      {stages.map((stage, i) => {
        if (Math.abs(i - currentStageIndex) > 1) return null;
        return (
          // Keyed by position as well as id: a deck may legitimately contain
          // the same stage twice, and a duplicate key silently drops one.
          <group key={`${stage.id}-${i}`} position={[0, 0, -i * STAGE_SPACING]}>
            <StageScene stage={stage} active={i === currentStageIndex} />
          </group>
        );
      })}
    </group>
  );
}
