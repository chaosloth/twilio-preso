import { describe, expect, it } from 'vitest';
import { DEFAULT_DECK, resolveDeck } from '../deck.js';
import { STAGE_LIBRARY, STAGE_LIBRARY_ORDER } from '../stageLibrary.js';
import type { CanvasElement } from '../canvas.js';
import { CANVAS_ASPECT, clampElement, newCanvasElement } from '../canvas.js';

const textEl: CanvasElement = {
  id: 'a',
  kind: 'text',
  x: 0.1,
  y: 0.2,
  w: 0.5,
  h: 0.1,
  text: 'Hello',
};

describe('canvas stage template', () => {
  it('exists in the library as a blank slide', () => {
    expect(STAGE_LIBRARY.canvas).toBeDefined();
    expect(STAGE_LIBRARY.canvas.blank).toBe(true);
  });

  it('is offered by the library but kept out of the shipped deck', () => {
    expect(STAGE_LIBRARY_ORDER).toContain('canvas');
    expect(DEFAULT_DECK.stages.map((s) => s.stageId)).not.toContain('canvas');
  });
});

describe('resolveDeck canvas elements', () => {
  it('resolves an empty canvas for the blank template', () => {
    const [stage] = resolveDeck({ id: 'd', name: 'd', stages: [{ stageId: 'canvas' }] });
    expect(stage.canvas).toEqual([]);
  });

  it('carries a deck stage’s elements through', () => {
    const [stage] = resolveDeck({
      id: 'd',
      name: 'd',
      stages: [{ stageId: 'canvas', canvas: [textEl] }],
    });
    expect(stage.canvas).toEqual([textEl]);
  });

  it('lets any stage carry canvas elements, not only the blank one', () => {
    const [stage] = resolveDeck({
      id: 'd',
      name: 'd',
      stages: [{ stageId: 'opening', canvas: [textEl] }],
    });
    expect(stage.canvas).toEqual([textEl]);
  });

  it('leaves canvas off a stage that has none, so the shape is unchanged', () => {
    const [stage] = resolveDeck({ id: 'd', name: 'd', stages: [{ stageId: 'opening' }] });
    expect('canvas' in stage).toBe(false);
  });

  it('treats null as "no elements", the same rule as every other override', () => {
    const [stage] = resolveDeck({
      id: 'd',
      name: 'd',
      stages: [{ stageId: 'canvas', canvas: null }],
    });
    expect(stage.canvas).toEqual([]);
  });
});

describe('canvas geometry helpers', () => {
  it('is 16:9, matching the projector', () => {
    expect(CANVAS_ASPECT).toBeCloseTo(16 / 9);
  });

  it('clamps an element back inside the slide', () => {
    expect(clampElement({ ...textEl, x: -0.4, y: 1.2 })).toMatchObject({ x: 0, y: 0.9 });
  });

  it('keeps an element that is already inside untouched', () => {
    expect(clampElement(textEl)).toEqual(textEl);
  });

  it('gives a new element an id and a default size', () => {
    const el = newCanvasElement('text');
    expect(el.id).toBeTruthy();
    expect(el.w).toBeGreaterThan(0);
    expect(el.h).toBeGreaterThan(0);
    expect(newCanvasElement('text').id).not.toBe(el.id);
  });
});
