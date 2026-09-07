import { STAGE_LIBRARY, STAGE_LIBRARY_ORDER } from '@twilio-preso/shared';
import type { DeckStage } from '@twilio-preso/shared';
import { caption, smallButton, textInput } from '../ui';
import { useState } from 'react';

interface SlideRailProps {
  draft: DeckStage[];
  selected: number;
  /** Slide currently on the presentation screen, outlined in the rail. */
  onScreen: number;
  onSelect: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onDelete: (index: number) => void;
  onAdd: (stageId: string) => void;
}

/**
 * The slide rail: the deck as a vertical strip, in the spirit of the thumbnail
 * pane in Slides or PowerPoint. Selecting a slide opens it in the editor; the
 * grip reorders by drag.
 */
export function SlideRail({ draft, selected, onScreen, onSelect, onReorder, onDelete, onAdd }: SlideRailProps) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newStage, setNewStage] = useState(STAGE_LIBRARY_ORDER[0] ?? '');

  return (
    <div style={{ width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {draft.map((deckStage, i) => {
        const template = STAGE_LIBRARY[deckStage.stageId];
        const isSelected = i === selected;
        return (
          <div
            key={`${deckStage.stageId}-${i}`}
            onClick={() => onSelect(i)}
            onDragOver={(e) => {
              // Without preventDefault the drop is refused and the row snaps back.
              e.preventDefault();
              if (dragging !== null && dragging !== i) {
                onReorder(dragging, i);
                setDragging(i);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              padding: '8px 8px',
              borderRadius: 6,
              cursor: 'pointer',
              opacity: dragging === i ? 0.5 : 1,
              background: isSelected ? '#12224a' : '#0a1535',
              border: `1px solid ${i === onScreen ? '#ef223a' : isSelected ? '#4d5777' : 'transparent'}`,
            }}
          >
            {/* Only the grip is draggable, so a click anywhere else selects. */}
            <div
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                setDragging(i);
              }}
              onDragEnd={() => setDragging(null)}
              title="Drag to reorder"
              style={{ cursor: 'grab', color: '#4d5777', userSelect: 'none', lineHeight: 1.2 }}
            >
              ⠿
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: '#7e869c', fontFamily: 'monospace' }}>{i + 1}</div>
              <div style={{ fontSize: 12, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {deckStage.title ?? template?.title ?? deckStage.stageId}
              </div>
              {!template && <div style={{ fontSize: 11, color: '#ef223a' }}>unknown stage</div>}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(i);
              }}
              title="Remove slide"
              style={{ ...smallButton, border: 'none', color: '#4d5777', padding: 2 }}
            >
              ✕
            </button>
          </div>
        );
      })}

      {adding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <select style={{ ...textInput, fontSize: 12 }} value={newStage} onChange={(e) => setNewStage(e.target.value)}>
            {STAGE_LIBRARY_ORDER.map((id) => (
              <option key={id} value={id}>
                {STAGE_LIBRARY[id].title}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              style={smallButton}
              onClick={() => {
                onAdd(newStage);
                setAdding(false);
              }}
            >
              Add
            </button>
            <button style={smallButton} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button style={smallButton} onClick={() => setAdding(true)}>
          + New slide
        </button>
      )}

      <div style={{ ...caption, marginTop: 4 }}>
        {draft.length} {draft.length === 1 ? 'slide' : 'slides'}
      </div>
    </div>
  );
}
