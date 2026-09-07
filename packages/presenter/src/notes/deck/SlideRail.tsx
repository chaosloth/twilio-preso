import { STAGE_LIBRARY, STAGE_LIBRARY_ORDER } from '@twilio-preso/shared';
import type { DeckStage } from '@twilio-preso/shared';
import { caption, smallButton, textInput } from '../ui';
import { useState } from 'react';

interface SlideRailProps {
  draft: DeckStage[];
  /** Slide currently on the presentation screen, or -1 while edits are unsaved. */
  onScreen: number;
  /** Disabled while the draft is dirty — draft positions aren't live yet. */
  canActivate: boolean;
  onActivate: (index: number) => void;
  onEdit: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onDelete: (index: number) => void;
  onAdd: (stageId: string) => void;
}

/**
 * The deck as a list of slides, in the spirit of the thumbnail pane in Slides or
 * PowerPoint: the grip reorders by drag, clicking a slide opens its editor, and
 * each row can be put on the presentation screen directly.
 */
export function SlideRail({
  draft,
  onScreen,
  canActivate,
  onActivate,
  onEdit,
  onReorder,
  onDelete,
  onAdd,
}: SlideRailProps) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newStage, setNewStage] = useState(STAGE_LIBRARY_ORDER[0] ?? '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {draft.map((deckStage, i) => {
        const template = STAGE_LIBRARY[deckStage.stageId];
        return (
          <div
            key={`${deckStage.stageId}-${i}`}
            onClick={() => onEdit(i)}
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
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              opacity: dragging === i ? 0.5 : 1,
              background: '#0a1535',
              border: `1px solid ${i === onScreen ? '#ef223a' : 'transparent'}`,
            }}
          >
            {/* Only the grip is draggable, so a click anywhere else opens the editor. */}
            <div
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                setDragging(i);
              }}
              onDragEnd={() => setDragging(null)}
              title="Drag to reorder"
              style={{ cursor: 'grab', color: '#4d5777', userSelect: 'none', lineHeight: 1 }}
            >
              ⠿
            </div>
            {/* Number and title share one line: `nowrap` plus a min-width-0 flex
                item, or a long title wraps under its own number. */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 13,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <span style={{ color: '#7e869c', fontFamily: 'monospace' }}>{i + 1}. </span>
              {deckStage.title ?? template?.title ?? deckStage.stageId}
              {!template && <span style={{ color: '#ef223a' }}> (unknown stage)</span>}
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                style={i === onScreen ? { ...smallButton, borderColor: '#ef223a', color: '#ffffff' } : smallButton}
                disabled={!canActivate}
                title={canActivate ? 'Show this slide on the presentation screen' : 'Save the deck before activating a slide'}
                onClick={(e) => {
                  e.stopPropagation();
                  onActivate(i);
                }}
              >
                {i === onScreen ? 'on screen' : 'activate'}
              </button>
              <button
                style={smallButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(i);
                }}
              >
                edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(i);
                }}
                title="Remove slide"
                style={{ ...smallButton, border: 'none', color: '#4d5777' }}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}

      {adding ? (
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <select
            style={{ ...textInput, flex: 1, fontSize: 12 }}
            value={newStage}
            onChange={(e) => setNewStage(e.target.value)}
          >
            {STAGE_LIBRARY_ORDER.map((id) => (
              <option key={id} value={id}>
                {STAGE_LIBRARY[id].title}
              </option>
            ))}
          </select>
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
      ) : (
        <button style={{ ...smallButton, marginTop: 4 }} onClick={() => setAdding(true)}>
          + New slide
        </button>
      )}

      <div style={{ ...caption, marginTop: 4 }}>
        {draft.length} {draft.length === 1 ? 'slide' : 'slides'}
      </div>
    </div>
  );
}
