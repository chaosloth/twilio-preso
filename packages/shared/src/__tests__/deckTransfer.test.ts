import { describe, expect, it } from 'vitest';
import { DEFAULT_DECK } from '../deck.js';
import { DECK_TRANSFER_KIND, DECK_TRANSFER_VERSION, exportDeck, parseDeckTransfer } from '../deckTransfer.js';
import { DEFAULT_RELAY_CONFIG } from '../relayConfig.js';
import { DEFAULT_TEXT_CONFIG } from '../textConfig.js';

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

/**
 * An export is how a rehearsed presentation moves to the account running the
 * event, so it has to carry the things a rehearsal actually changed — the agent
 * personas and the door settings — not only the slides. A file that carries the
 * deck alone is how a presenter discovers on stage that the voice agent is back
 * to its shipped prompt.
 */
describe('a whole presentation, not only its slides', () => {
  const extras = {
    relay: { systemPrompt: 'rehearsed voice persona', voice: 'my-voice' },
    text: { systemPrompt: 'rehearsed text persona', maxTurnsInbound: 4 },
    settings: { verifyChannel: 'sms' as const, countryCode: '+65', countryCodes: ['+65', '+61'] },
  };

  it('writes the agent settings and the door settings alongside the deck', () => {
    const file = exportDeck(DEFAULT_DECK, 'Rehearsal', extras);
    expect(file.relay?.systemPrompt).toBe('rehearsed voice persona');
    expect(file.text?.systemPrompt).toBe('rehearsed text persona');
    expect(file.settings).toEqual(extras.settings);
  });

  /** Resolved, not the stored partial: the file has to say what the presenter
   *  actually heard, whatever this build's defaults happen to be. */
  it('writes every agent field, not only the ones that were overridden', () => {
    const file = exportDeck(DEFAULT_DECK, 'Rehearsal', extras);
    expect(file.relay?.transcriptionProvider).toBe(DEFAULT_RELAY_CONFIG.transcriptionProvider);
    expect(file.text?.fallbackReply).toBe(DEFAULT_TEXT_CONFIG.fallbackReply);
  });

  it('reads them all back', () => {
    const result = parseDeckTransfer(JSON.stringify(exportDeck(DEFAULT_DECK, 'R', extras)));
    expect(result.relay?.systemPrompt).toBe('rehearsed voice persona');
    expect(result.relay?.voice).toBe('my-voice');
    expect(result.text?.maxTurnsInbound).toBe(4);
    expect(result.settings).toEqual(extras.settings);
  });

  /** Same rule as the deck itself: the keys an import can introduce are the ones
   *  this build declares, so a hand-edited file cannot smuggle any in. */
  it('ignores keys the agent configs do not declare', () => {
    const result = parseDeckTransfer(
      JSON.stringify({
        kind: DECK_TRANSFER_KIND,
        version: DECK_TRANSFER_VERSION,
        exportedAt: '',
        deck: { id: 'x', name: 'X', stages: [{ stageId: 'opening' }] },
        relay: { hacked: true, voice: 'v' },
        text: { hacked: true },
      })
    );
    expect('hacked' in (result.relay as object)).toBe(false);
    expect('hacked' in (result.text as object)).toBe(false);
  });

  /** A field this build added since the file was written arrives as its new
   *  default rather than as undefined — the same reason the record stores a
   *  partial and resolves on read. */
  it('fills in a field the file does not mention', () => {
    const result = parseDeckTransfer(
      JSON.stringify({
        kind: DECK_TRANSFER_KIND,
        version: DECK_TRANSFER_VERSION,
        exportedAt: '',
        deck: { id: 'x', name: 'X', stages: [{ stageId: 'opening' }] },
        relay: { systemPrompt: 'p' },
      })
    );
    expect(result.relay?.interruptible).toBe(DEFAULT_RELAY_CONFIG.interruptible);
  });

  it('drops a door setting this build would refuse', () => {
    const result = parseDeckTransfer(
      JSON.stringify({
        kind: DECK_TRANSFER_KIND,
        version: DECK_TRANSFER_VERSION,
        exportedAt: '',
        deck: { id: 'x', name: 'X', stages: [{ stageId: 'opening' }] },
        settings: { verifyChannel: 'carrier-pigeon', countryCode: 5, countryCodes: ['+61', 7] },
      })
    );
    expect(result.settings?.verifyChannel).toBeUndefined();
    expect(result.settings?.countryCode).toBeUndefined();
    expect(result.settings?.countryCodes).toEqual(['+61']);
  });

  /** A deck-only file is still valid — it is what earlier builds wrote — but the
   *  presenter should know the personas are not in it before they commit. */
  it('says so when a file carries no agent settings', () => {
    const result = parseDeckTransfer(JSON.stringify(exportDeck(DEFAULT_DECK, 'R')));
    expect(result.relay).toBeUndefined();
    expect(result.warnings.join(' ')).toMatch(/no voice or text agent settings/i);
  });
});
