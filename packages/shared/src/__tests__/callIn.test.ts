import { describe, expect, test } from 'vitest';
import { DEMO_TRIGGER_IDS, STAGE_LIBRARY } from '../stageLibrary.js';
import { DEFAULT_DECK, resolveDeck } from '../deck.js';

/**
 * The call-in half of the demo: the audience ringing *us*, rather than us
 * ringing them. Two stages put the session's own number on the big screen — one
 * for voice, one for WhatsApp — and one trigger calls every phone into the
 * ConversationRelay agent.
 */
describe('inbound call-in stages', () => {
  test('a mass outbound call into ConversationRelay is its own trigger', () => {
    // Kept separate from `voice-mass-outbound`, which stays the scripted bot:
    // both experiences have to be presentable from one deck.
    expect(DEMO_TRIGGER_IDS).toContain('voice-mass-relay');
    expect(DEMO_TRIGGER_IDS).toContain('voice-mass-outbound');
  });

  test('the call-in stage prompts each phone to dial the session number', () => {
    const stage = STAGE_LIBRARY['call-in'];
    expect(stage).toBeDefined();
    expect(stage.interaction).toMatchObject({ stageId: 'call-in', type: 'call-cta' });
  });

  test('the WhatsApp stage prompts each phone to open a chat', () => {
    const stage = STAGE_LIBRARY['whatsapp-invite'];
    expect(stage).toBeDefined();
    expect(stage.interaction).toMatchObject({ stageId: 'whatsapp-invite', type: 'whatsapp-cta' });
  });

  test('both are in the default deck', () => {
    const ids = resolveDeck(DEFAULT_DECK).map((s) => s.id);
    expect(ids).toContain('call-in');
    expect(ids).toContain('whatsapp-invite');
  });
});
