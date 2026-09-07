import { useEffect, useState } from 'react';
import type { DeckStage } from '@twilio-preso/shared';
import { SlideEditor } from './SlideEditor';
import { SlidePreview } from './SlidePreview';
import { RenderedPreview } from './RenderedPreview';
import { CanvasEditor } from './CanvasEditor';
import { smallButton } from '../ui';

/** Flat is the fast read of the copy; rendered is what the projector shows. */
const PREVIEW_MODES = ['flat', 'rendered'] as const;
type PreviewMode = (typeof PREVIEW_MODES)[number];

interface SlideModalProps {
  index: number;
  deckStage: DeckStage;
  onChange: (patch: Partial<DeckStage>) => void;
  onClose: () => void;
}

/**
 * The editor as an overlay, so the deck list stays readable on a laptop screen.
 * Edits still go straight into the deck draft — closing this is not a save, and
 * "Save deck" in the tab remains the only thing that reaches the audience.
 */
export function SlideModal({ index, deckStage, onChange, onClose }: SlideModalProps) {
  /** Flat by default: it is instant, and most edits are copy. The rendered tab
   *  mounts a real r3f canvas, so it is opened deliberately. */
  const [preview, setPreview] = useState<PreviewMode>('flat');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Escape closes; the HUD's own arrow-key navigation already ignores inputs.
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 13, 37, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#000d25',
          border: '1px solid #1a2540',
          borderRadius: 10,
          width: 'min(1000px, 100%)',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #1a2540',
          }}
        >
          <span style={{ fontSize: 13, color: '#babecc' }}>Editing slide {index + 1}</span>
          <button style={smallButton} onClick={onClose}>
            Done
          </button>
        </div>

        {/* The one scrolling element in the overlay; `wrap` puts the preview
            under the fields instead of squeezing both on a narrow window. */}
        <div style={{ overflowY: 'auto', padding: 16, display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ flex: '1 1 340px', minWidth: 300 }}>
            <SlideEditor index={index} deckStage={deckStage} onChange={onChange} />
            <div style={{ marginTop: 20 }}>
              <CanvasEditor deckStage={deckStage} onChange={onChange} />
            </div>
          </div>
          <div style={{ flex: '1 1 280px', minWidth: 260 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {PREVIEW_MODES.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPreview(mode)}
                  style={{
                    ...smallButton,
                    color: preview === mode ? '#ffffff' : '#babecc',
                    borderColor: preview === mode ? '#ef223a' : '#4d5777',
                    textTransform: 'capitalize',
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
            {preview === 'flat' ? (
              <SlidePreview deckStage={deckStage} />
            ) : (
              <RenderedPreview deckStage={deckStage} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
