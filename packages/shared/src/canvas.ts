/**
 * Free-form slide elements — the canvas half of the slide editor.
 *
 * Positions and sizes are **fractions of the slide, 0–1**, never pixels or world
 * units. The same element has to land in the right place in a 3D scene on a
 * projector, in a flat HTML preview, and in the editor, and only a fraction
 * survives all three. The presenter maps them onto a 16:9 region of the stage.
 *
 * Elements live on a `DeckStage`, so they are part of the deck snapshot inside
 * the session's Sync map item — which caps at 16 KB. Images are URLs for that
 * reason; text is the only thing here that grows.
 */

/** Slide aspect. Matches the projector, and the preview and editor surfaces. */
export const CANVAS_ASPECT = 16 / 9;

export type CanvasElementKind = 'text' | 'image';

export interface CanvasElement {
  id: string;
  kind: CanvasElementKind;
  /** Top-left corner, as a fraction of slide width/height. */
  x: number;
  y: number;
  /** Size as a fraction of slide width/height. */
  w: number;
  h: number;
  /** Text content, for `kind: 'text'`. */
  text?: string;
  /** Image URL, for `kind: 'image'`. Pasted, never uploaded. */
  url?: string;
  /** Fraction of slide height, so type scales with the surface. */
  fontSize?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** Tektur is headlines only — never numbers or small labels. */
  font?: 'heading' | 'body';
  bold?: boolean;
}

export const DEFAULT_TEXT_COLOR = '#ffffff';
/** Fraction of slide height. ~0.07 is body copy, ~0.12 a headline. */
export const DEFAULT_FONT_SIZE = 0.07;

/** Keeps an element's box inside the slide. Applied on every drag and resize:
 *  an element dragged off the edge is simply lost on the projector. */
export function clampElement(element: CanvasElement): CanvasElement {
  const w = clamp(element.w, 0.02, 1);
  const h = clamp(element.h, 0.02, 1);
  return {
    ...element,
    w,
    h,
    x: clamp(element.x, 0, 1 - w),
    y: clamp(element.y, 0, 1 - h),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

let elementCounter = 0;

/** A new element, centred-ish and large enough to grab. Ids only need to be
 *  unique within one slide — they are React keys and selection handles. */
export function newCanvasElement(kind: CanvasElementKind): CanvasElement {
  const id = `el-${Date.now().toString(36)}-${(elementCounter++).toString(36)}`;
  if (kind === 'image') {
    return { id, kind, x: 0.35, y: 0.35, w: 0.3, h: 0.3, url: '' };
  }
  return {
    id,
    kind,
    x: 0.15,
    y: 0.4,
    w: 0.7,
    h: 0.12,
    text: 'New text',
    fontSize: DEFAULT_FONT_SIZE,
    color: DEFAULT_TEXT_COLOR,
    align: 'center',
    font: 'body',
  };
}
