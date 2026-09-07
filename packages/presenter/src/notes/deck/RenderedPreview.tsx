import { Canvas } from '@react-three/fiber';
import { Component, type ReactNode } from 'react';
import { resolveDeck } from '@twilio-preso/shared';
import type { DeckStage } from '@twilio-preso/shared';
import { StageScene } from '../../components/StageScene';
import { caption } from '../ui';

/**
 * The slide as the projector will actually draw it: the real stage component,
 * the real slots, the real canvas elements, in a small r3f canvas.
 *
 * It runs the same `StageScene` the presentation window does, so it cannot drift
 * from the big screen. The camera matches the presentation's (z=8, default fov)
 * for the same reason.
 */
export function RenderedPreview({ deckStage }: { deckStage: DeckStage }) {
  // Resolved through the shared resolver rather than by hand, so inheritance and
  // the null-clears rule behave identically to the running deck.
  const [stage] = resolveDeck({ id: 'preview', name: 'preview', stages: [deckStage] });

  if (!stage) {
    return (
      <p style={{ color: '#ef223a', fontSize: 12 }}>
        `{deckStage.stageId}` is not in the stage library, so there is nothing to render.
      </p>
    );
  }

  return (
    <div>
      <div style={{ ...caption, marginBottom: 8 }}>Rendered</div>
      <div
        style={{
          aspectRatio: '16 / 9',
          background: '#000d25',
          border: '1px solid rgba(239,34,58,0.4)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <SceneBoundary>
          <Canvas camera={{ position: [0, 0, 8], fov: 75 }} gl={{ antialias: true }}>
            <color attach="background" args={['#000d25']} />
            <ambientLight intensity={0.2} />
            {/* Active, so stages that hold back their `<Html>` cards until they
                are on screen actually show them here. */}
            <StageScene stage={stage} active />
          </Canvas>
        </SceneBoundary>
      </div>
      <p style={{ fontSize: 11, color: '#7e869c', margin: '8px 0 0' }}>
        Live data (poll tallies, participant count) is empty here — this window has its own store.
      </p>
    </div>
  );
}

/**
 * A stage scene that throws must not take the HUD down with it. The editor is
 * where half-finished content lives, so a bad image URL or an unbuilt stage is
 * expected rather than exceptional.
 */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div style={{ padding: 16, fontSize: 12, color: '#ef223a' }}>
          This stage could not be rendered here. “Activate slide” still shows it on the big screen.
        </div>
      );
    }
    return this.props.children;
  }
}
