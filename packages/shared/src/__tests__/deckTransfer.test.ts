import { describe, expect, it } from 'vitest';
import { DEFAULT_DECK } from '../deck.js';
import { DECK_TRANSFER_KIND, DECK_TRANSFER_VERSION, exportDeck, parseDeckTransfer } from '../deckTransfer.js';

describe('exportDeck', () => {
  it('wraps the deck in a versioned, identifiable envelope', () => {
    const file = exportDeck(DEFAULT_DECK);
    expect(file.kind).toBe(DECK_TRANSFER_KIND);
    expect(file.version).toBe(DECK_TRANSFER_VERSION);
    expect(file.deck.stages).toEqual(DEFAULT_DECK.stages);
  });

  it('copies the deck rather than aliasing it, so an edit after export cannot change the file', () => {
    const deck = { id: 'd', name: 'D', stages: [{ stageId: 'opening' }] };
    const file = exportDeck(deck);
    deck.stages.push({ stageId: 'closing' });
    expect(file.deck.stages).toHaveLength(1);
  });
});

describe('parseDeckTransfer', () => {
  it('round-trips an exported deck', () => {
    const text = JSON.stringify(exportDeck(DEFAULT_DECK));
    expect(parseDeckTransfer(text).deck.stages).toEqual(DEFAULT_DECK.stages);
  });

  it('accepts a bare deck object, which is what a hand-edited file looks like', () => {
    const result = parseDeckTransfer(JSON.stringify({ id: 'x', name: 'X', stages: [{ stageId: 'opening' }] }));
    expect(result.deck.stages).toEqual([{ stageId: 'opening' }]);
  });

  it('accepts a bare array of stages', () => {
    const result = parseDeckTransfer(JSON.stringify([{ stageId: 'opening' }]));
    expect(result.deck.stages).toEqual([{ stageId: 'opening' }]);
  });

  it('rejects text that is not JSON', () => {
    expect(() => parseDeckTransfer('not json')).toThrow(/not valid JSON/i);
  });

  it('rejects a file with no stages', () => {
    expect(() => parseDeckTransfer(JSON.stringify({ id: 'x', name: 'X', stages: [] }))).toThrow(/no stages/i);
  });

  it('rejects a stage with no stageId', () => {
    expect(() => parseDeckTransfer(JSON.stringify([{ title: 'orphan' }]))).toThrow(/stageId/);
  });

  it('rejects a newer version rather than guessing at its shape', () => {
    const file = { ...exportDeck(DEFAULT_DECK), version: DECK_TRANSFER_VERSION + 1 };
    expect(() => parseDeckTransfer(JSON.stringify(file))).toThrow(/newer/i);
  });

  it('warns about a stage this build has no component for instead of refusing the import', () => {
    const result = parseDeckTransfer(JSON.stringify([{ stageId: 'opening' }, { stageId: 'from-the-future' }]));
    expect(result.deck.stages).toHaveLength(2);
    expect(result.warnings.join(' ')).toMatch(/from-the-future/);
  });

  it('drops keys that are not part of a deck stage, so a foreign file cannot smuggle fields in', () => {
    const result = parseDeckTransfer(
      JSON.stringify([{ stageId: 'opening', title: 'Hello', somethingElse: 'nope' }])
    );
    expect(result.deck.stages[0]).toEqual({ stageId: 'opening', title: 'Hello' });
  });

  it('preserves an explicit null override, which means "disabled" and not "absent"', () => {
    const result = parseDeckTransfer(JSON.stringify([{ stageId: 'mass-call', demoTrigger: null }]));
    expect(result.deck.stages[0].demoTrigger).toBeNull();
  });
});
