import { useRef, useState } from 'react';
import {
  CANVAS_ASPECT,
  DEFAULT_FONT_SIZE,
  DEFAULT_TEXT_COLOR,
  STAGE_LIBRARY,
  clampElement,
  newCanvasElement,
} from '@twilio-preso/shared';
import type { CanvasElement, DeckStage } from '@twilio-preso/shared';
import { caption, dangerButton, smallButton, textInput } from '../ui';

interface CanvasEditorProps {
  deckStage: DeckStage;
  onChange: (patch: Partial<DeckStage>) => void;
}

/**
 * Direct manipulation of a slide's free-form elements: drag to move, corner to
 * resize, click to select and edit.
 *
 * The surface is a flat 16:9 box, the same fractions the presenter maps onto the
 * 3D stage, so where you put something here is where it lands on the projector.
 * Fractions rather than pixels are what make that true at any window size.
 */
export function CanvasEditor({ deckStage, onChange }: CanvasEditorProps) {
  const template = STAGE_LIBRARY[deckStage.stageId];
  const elements = deckStage.canvas ?? template?.canvas ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const surface = useRef<HTMLDivElement>(null);

  const selected = elements.find((e) => e.id === selectedId) ?? null;

  function commit(next: CanvasElement[]) {
    onChange({ canvas: next });
  }

  function update(id: string, patch: Partial<CanvasElement>) {
    commit(elements.map((e) => (e.id === id ? clampElement({ ...e, ...patch }) : e)));
  }

  function add(kind: 'text' | 'image') {
    const element = newCanvasElement(kind);
    commit([...elements, element]);
    setSelectedId(element.id);
  }

  function remove(id: string) {
    commit(elements.filter((e) => e.id !== id));
    setSelectedId(null);
  }

  /**
   * One pointer-capture drag for both moving and resizing. Deltas are converted
   * to fractions against the live surface size, so the drag tracks the cursor
   * whatever the window is doing.
   */
  function startDrag(
    event: React.PointerEvent,
    element: CanvasElement,
    mode: 'move' | 'resize'
  ) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(element.id);

    const box = surface.current?.getBoundingClientRect();
    if (!box) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { ...element };
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);

    function onMove(e: PointerEvent) {
      const dx = (e.clientX - startX) / box!.width;
      const dy = (e.clientY - startY) / box!.height;
      if (mode === 'move') {
        update(element.id, { x: origin.x + dx, y: origin.y + dy });
      } else {
        update(element.id, { w: origin.w + dx, h: origin.h + dy });
      }
    }
    function onUp() {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    }
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={caption}>Canvas</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={smallButton} onClick={() => add('text')}>
            + Text
          </button>
          <button style={smallButton} onClick={() => add('image')}>
            + Image
          </button>
        </div>
      </div>

      {/* Clicking the surface itself deselects, so the property panel is not
          stuck on an element you have stopped caring about. */}
      <div
        ref={surface}
        onPointerDown={() => setSelectedId(null)}
        style={{
          position: 'relative',
          aspectRatio: `${CANVAS_ASPECT}`,
          background: '#000d25',
          border: '1px solid rgba(239,34,58,0.4)',
          borderRadius: 10,
          overflow: 'hidden',
          touchAction: 'none',
          userSelect: 'none',
          // Makes `cqh` on element text resolve against this box, so type
          // scales with the surface exactly as it does with the slide.
          containerType: 'size',
        }}
      >
        {elements.map((element) => (
          <div
            key={element.id}
            onPointerDown={(e) => startDrag(e, element, 'move')}
            style={{
              position: 'absolute',
              left: `${element.x * 100}%`,
              top: `${element.y * 100}%`,
              width: `${element.w * 100}%`,
              height: `${element.h * 100}%`,
              border:
                element.id === selectedId
                  ? '1px solid #ef223a'
                  : '1px dashed rgba(126,134,156,0.5)',
              cursor: 'move',
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                element.align === 'left' ? 'flex-start' : element.align === 'right' ? 'flex-end' : 'center',
              overflow: 'hidden',
            }}
          >
            {element.kind === 'image' ? (
              element.url ? (
                <img
                  src={element.url}
                  alt=""
                  draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ fontSize: 10, color: '#7e869c' }}>no image URL</span>
              )
            ) : (
              <span
                style={{
                  // Type is a fraction of slide height on the projector too, so
                  // the editor scales it against its own height with `cqh`.
                  fontSize: `${(element.fontSize ?? DEFAULT_FONT_SIZE) * 100}cqh`,
                  color: element.color ?? DEFAULT_TEXT_COLOR,
                  fontFamily:
                    element.font === 'heading'
                      ? "'Tektur', system-ui, sans-serif"
                      : "'Space Grotesk', system-ui, sans-serif",
                  fontWeight: element.bold || element.font === 'heading' ? 700 : 400,
                  textAlign: element.align ?? 'center',
                  whiteSpace: 'pre-line',
                  lineHeight: 1.15,
                }}
              >
                {element.text}
              </span>
            )}

            {element.id === selectedId && (
              // Resize grip, bottom-right.
              <div
                onPointerDown={(e) => startDrag(e, element, 'resize')}
                style={{
                  position: 'absolute',
                  right: -4,
                  bottom: -4,
                  width: 10,
                  height: 10,
                  background: '#ef223a',
                  borderRadius: 2,
                  cursor: 'nwse-resize',
                }}
              />
            )}
          </div>
        ))}
      </div>

      {selected ? (
        <ElementFields element={selected} onChange={(patch) => update(selected.id, patch)} onRemove={() => remove(selected.id)} />
      ) : (
        <p style={{ fontSize: 11, color: '#7e869c', marginTop: 10 }}>
          {elements.length === 0
            ? 'Empty canvas. Add text or an image — they draw on top of whatever this stage already renders.'
            : 'Click an element to edit it. Drag to move, drag the red corner to resize.'}
        </p>
      )}
    </div>
  );
}

function ElementFields({
  element,
  onChange,
  onRemove,
}: {
  element: CanvasElement;
  onChange: (patch: Partial<CanvasElement>) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
      {element.kind === 'text' ? (
        <>
          <textarea
            value={element.text ?? ''}
            onChange={(e) => onChange({ text: e.target.value })}
            rows={2}
            style={{ ...textInput, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ ...caption, display: 'flex', gap: 6, alignItems: 'center' }}>
              Size
              <input
                type="range"
                min={2}
                max={20}
                value={Math.round((element.fontSize ?? DEFAULT_FONT_SIZE) * 100)}
                onChange={(e) => onChange({ fontSize: parseInt(e.target.value, 10) / 100 })}
              />
            </label>
            <select
              value={element.font ?? 'body'}
              onChange={(e) => onChange({ font: e.target.value as 'heading' | 'body' })}
              style={textInput}
            >
              {/* Tektur is headlines only — that rule is enforced by there being
                  no other place to choose it. */}
              <option value="body">Space Grotesk</option>
              <option value="heading">Tektur (headlines)</option>
            </select>
            <select
              value={element.align ?? 'center'}
              onChange={(e) => onChange({ align: e.target.value as 'left' | 'center' | 'right' })}
              style={textInput}
            >
              <option value="left">Left</option>
              <option value="center">Centre</option>
              <option value="right">Right</option>
            </select>
            <input
              type="color"
              value={element.color ?? DEFAULT_TEXT_COLOR}
              onChange={(e) => onChange({ color: e.target.value })}
              style={{ width: 34, height: 28, background: 'transparent', border: '1px solid #4d5777', borderRadius: 4 }}
            />
          </div>
        </>
      ) : (
        <input
          value={element.url ?? ''}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://… image URL"
          style={textInput}
        />
      )}
      <div>
        <button style={dangerButton} onClick={onRemove}>
          Delete element
        </button>
      </div>
    </div>
  );
}
