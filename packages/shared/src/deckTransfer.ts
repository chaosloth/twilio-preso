import type { Deck, DeckStage } from './deck.js';
import { resolveRelayConfig } from './relayConfig.js';
import type { RelayConfig } from './relayConfig.js';
import { VERIFY_CHANNELS } from './session.js';
import type { VerifyChannel } from './session.js';
import { STAGE_LIBRARY } from './stageLibrary.js';
import { resolveTextConfig } from './textConfig.js';
import type { TextAgentConfig } from './textConfig.js';

/**
 * Moving a deck between environments.
 *
 * A deck is already a self-contained snapshot — a list of library stage ids plus
 * overrides — so copying one from a rehearsal account to the account running the
 * event is just moving that JSON. What this module adds is the envelope and the
 * checks: a file the HUD can identify, refuse when it is from a newer build, and
 * accept as a *draft* for review rather than something that silently replaces a
 * live presentation.
 *
 * Parsing is strict about shape and lenient about content. An unknown key is
 * dropped, because a foreign file must not smuggle fields into a record the
 * presenter is about to commit; an unknown *stage id* is only warned about,
 * because the two environments may be on different builds and the presenter is
 * the one who should decide whether that slide matters.
 */

export const DECK_TRANSFER_KIND = 'twilio-preso-deck';
/**
 * 2 added the agent configs and the door settings. A version 1 file is still
 * read — it is what earlier builds wrote — it simply carries the deck alone.
 */
export const DECK_TRANSFER_VERSION = 2;

/**
 * Session settings that belong to the room rather than to the slides: which
 * channel the passcode goes out on and which dialling codes registration offers.
 * They are part of a rehearsed presentation — a Singapore room whose export
 * forgets `+65` registers nobody — so they travel with it.
 */
export interface PresentationSettings {
  verifyChannel?: VerifyChannel;
  countryCode?: string;
  countryCodes?: string[];
}

/** Everything an export carries besides the deck itself. */
export interface PresentationExtras {
  relay?: Partial<RelayConfig>;
  text?: Partial<TextAgentConfig>;
  settings?: PresentationSettings;
}

export interface DeckTransferFile {
  kind: typeof DECK_TRANSFER_KIND;
  version: number;
  /** ISO timestamp, for telling two exports of the same deck apart. */
  exportedAt: string;
  /** Where it came from, so an imported deck can be traced back. */
  sourceTitle?: string;
  deck: Deck;
  /**
   * The agent personas, **resolved** rather than as the stored partial: the file
   * has to state what the presenter actually heard in rehearsal, which a partial
   * only does in combination with the build that wrote it.
   */
  relay?: RelayConfig;
  text?: TextAgentConfig;
  settings?: PresentationSettings;
}

export function exportDeck(
  deck: Deck,
  sourceTitle?: string,
  extras?: PresentationExtras
): DeckTransferFile {
  return {
    kind: DECK_TRANSFER_KIND,
    version: DECK_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    ...(sourceTitle ? { sourceTitle } : {}),
    // Deep-copied: the caller's deck is usually a live editor draft, and an
    // export must be the deck as it was at that moment.
    deck: structuredClone(deck),
    ...(extras?.relay ? { relay: resolveRelayConfig(extras.relay) } : {}),
    ...(extras?.text ? { text: resolveTextConfig(extras.text) } : {}),
    ...(extras?.settings ? { settings: cleanSettings(extras.settings) } : {}),
  };
}

/** Filename for a downloaded presentation. Dated, so a folder of them is sortable. */
export function deckExportFilename(title: string): string {
  const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck';
  return `${slug}-presentation-${new Date().toISOString().slice(0, 10)}.json`;
}

export interface ParsedDeckTransfer {
  deck: Deck;
  /**
   * Present only when the file carried them, so a caller can tell "the file said
   * keep the defaults" from "the file said nothing" — the second must leave the
   * session's own personas alone.
   */
  relay?: RelayConfig;
  text?: TextAgentConfig;
  settings?: PresentationSettings;
  /** Things the presenter should see before committing — never hard errors. */
  warnings: string[];
}

/**
 * Reads an exported deck, a bare `Deck`, or a bare array of stages.
 *
 * Throws with a message meant to be shown to the presenter as-is: an import is
 * something a person does by hand under time pressure, so "this file is from a
 * newer version" beats a schema dump.
 */
export function parseDeckTransfer(text: string): ParsedDeckTransfer {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }

  const warnings: string[] = [];
  const { deck, extras } = extractDeck(parsed);

  if (!Array.isArray(deck.stages) || deck.stages.length === 0) {
    throw new Error('That file has no stages in it.');
  }

  const stages = deck.stages.map((stage, i) => normalizeStage(stage, i, warnings));

  // Resolved field by field, which is both the validation and the migration: a
  // key this build does not declare is dropped, and a field the file predates
  // arrives as this build's default rather than as undefined.
  const relay = extras.relay ? resolveRelayConfig(extras.relay) : undefined;
  const textAgent = extras.text ? resolveTextConfig(extras.text) : undefined;
  const settings = extras.settings ? cleanSettings(extras.settings) : undefined;

  if (!relay && !textAgent) {
    warnings.push(
      'This file has no voice or text agent settings in it — the session keeps its own.'
    );
  }

  return {
    ...(relay ? { relay } : {}),
    ...(textAgent ? { text: textAgent } : {}),
    ...(settings ? { settings } : {}),
    deck: {
      id: typeof deck.id === 'string' && deck.id ? deck.id : 'imported',
      name: typeof deck.name === 'string' && deck.name ? deck.name : 'Imported deck',
      stages,
    },
    warnings,
  };
}

type RawDeck = { id?: unknown; name?: unknown; stages?: unknown[] };

function extractDeck(parsed: unknown): { deck: RawDeck; extras: PresentationExtras } {
  if (Array.isArray(parsed)) return { deck: { stages: parsed }, extras: {} };
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('That file does not look like a deck.');
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.kind === DECK_TRANSFER_KIND) {
    // A newer file may use keys this build does not understand, and importing
    // half of it is worse than refusing: the missing half is silent.
    if (typeof obj.version === 'number' && obj.version > DECK_TRANSFER_VERSION) {
      throw new Error(
        `That deck was exported by a newer version of this app (format ${obj.version}, this build reads ${DECK_TRANSFER_VERSION}).`
      );
    }
    const deck = obj.deck;
    if (!deck || typeof deck !== 'object') throw new Error('That export has no deck in it.');
    return {
      deck: deck as RawDeck,
      extras: {
        relay: object(obj.relay) as Partial<RelayConfig> | undefined,
        text: object(obj.text) as Partial<TextAgentConfig> | undefined,
        settings: object(obj.settings) as PresentationSettings | undefined,
      },
    };
  }

  return { deck: obj as RawDeck, extras: {} };
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * The door settings, copied one key at a time.
 *
 * A value this build would refuse is dropped rather than corrected: an unknown
 * verify channel becomes "the session keeps what it had", which is recoverable,
 * where guessing one sends every passcode down a channel nobody chose.
 */
function cleanSettings(raw: PresentationSettings): PresentationSettings {
  const out: PresentationSettings = {};
  if (VERIFY_CHANNELS.includes(raw.verifyChannel as VerifyChannel)) {
    out.verifyChannel = raw.verifyChannel;
  }
  if (typeof raw.countryCode === 'string' && raw.countryCode.trim()) {
    out.countryCode = raw.countryCode.trim();
  }
  if (Array.isArray(raw.countryCodes)) {
    const codes = raw.countryCodes.filter((c): c is string => typeof c === 'string' && !!c.trim());
    if (codes.length) out.countryCodes = codes.map((c) => c.trim());
  }
  return out;
}

function normalizeStage(stage: unknown, index: number, warnings: string[]): DeckStage {
  if (!stage || typeof stage !== 'object' || Array.isArray(stage)) {
    throw new Error(`Stage ${index + 1} in that file is not an object.`);
  }

  const source = stage as Record<string, unknown>;
  const stageId = source.stageId;
  if (typeof stageId !== 'string' || !stageId.trim()) {
    throw new Error(`Stage ${index + 1} in that file has no stageId.`);
  }

  if (!STAGE_LIBRARY[stageId]) {
    warnings.push(
      `Stage "${stageId}" (position ${index + 1}) has no component in this build — it will render as a blank slide.`
    );
  }

  // Copied field by field rather than spread-and-delete, so the set of keys an
  // import can introduce is this list and nothing else. `undefined` inherits and
  // `null` disables, so a key that is present and null is kept verbatim.
  const out: DeckStage = { stageId };
  if (typeof source.title === 'string') out.title = source.title;
  if (typeof source.notes === 'string') out.notes = source.notes;
  if ('interaction' in source && source.interaction !== undefined) {
    out.interaction = source.interaction as DeckStage['interaction'];
  }
  if ('demoTrigger' in source && source.demoTrigger !== undefined) {
    out.demoTrigger = source.demoTrigger as DeckStage['demoTrigger'];
  }
  if ('slots' in source && source.slots !== undefined) {
    out.slots = source.slots as DeckStage['slots'];
  }
  if ('canvas' in source && source.canvas !== undefined) {
    out.canvas = source.canvas as DeckStage['canvas'];
  }
  return out;
}
