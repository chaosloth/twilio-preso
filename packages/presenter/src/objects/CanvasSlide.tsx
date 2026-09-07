import { CANVAS_ASPECT, DEFAULT_FONT_SIZE, DEFAULT_TEXT_COLOR } from '@twilio-preso/shared';
import type { CanvasElement } from '@twilio-preso/shared';
import { FloatingText } from './FloatingText';
import { SlideImage } from './SlideImage';

/**
 * The slide region canvas fractions are mapped onto, in world units. Sized to
 * match what the existing 23 stages actually occupy at the camera's z=8 rather
 * than the whole frustum — an element at y=0 has to land where a stage headline
 * lands, or the canvas reads as a different slide size than every other slide.
 */
export const CANVAS_WIDTH = 12;
export const CANVAS_HEIGHT = CANVAS_WIDTH / CANVAS_ASPECT;

/** Canvas elements sit slightly in front of the stage scene they overlay. */
const CANVAS_Z = 0.6;

/**
 * Renders a stage's free-form elements. Drawn by the stage host for *every*
 * stage, like the image slot — so a presenter can drop a caption onto an
 * existing scene, not only onto the blank canvas template.
 */
export function CanvasSlide({ elements }: { elements: CanvasElement[] | undefined }) {
  if (!elements || elements.length === 0) return null;
  return (
    <group>
      {elements.map((element) => (
        <CanvasElementView key={element.id} element={element} />
      ))}
    </group>
  );
}

function CanvasElementView({ element }: { element: CanvasElement }) {
  const width = element.w * CANVAS_WIDTH;

  if (element.kind === 'image') {
    if (!element.url) return null;
    // Centre of the element's box. The image keeps its own aspect ratio, so `h`
    // is the presenter's intent for the box, not a stretch factor.
    return (
      <SlideImage
        url={element.url}
        position={[centreX(element), centreY(element), CANVAS_Z]}
        width={width}
      />
    );
  }

  if (!element.text) return null;

  const fontSize = (element.fontSize ?? DEFAULT_FONT_SIZE) * CANVAS_HEIGHT;
  // troika anchors at the alignment edge, so a left-aligned element starts at
  // its own left edge and a centred one at its middle.
  const x =
    element.align === 'left'
      ? (element.x - 0.5) * CANVAS_WIDTH
      : element.align === 'right'
        ? (element.x + element.w - 0.5) * CANVAS_WIDTH
        : centreX(element);

  return (
    <FloatingText
      position={[x, centreY(element), CANVAS_Z]}
      fontSize={fontSize}
      color={element.color ?? DEFAULT_TEXT_COLOR}
      bold={element.bold}
      heading={element.font === 'heading'}
      maxWidth={width}
      anchorX={element.align ?? 'center'}
    >
      {element.text}
    </FloatingText>
  );
}

function centreX(element: CanvasElement): number {
  return (element.x + element.w / 2 - 0.5) * CANVAS_WIDTH;
}

/** Canvas y grows downward (like every design tool); world y grows upward. */
function centreY(element: CanvasElement): number {
  return (0.5 - (element.y + element.h / 2)) * CANVAS_HEIGHT;
}
