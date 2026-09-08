import { describe, expect, it } from 'vitest';
import { CONTENT_TEMPLATES, contentVariables, renderTemplate } from '../contentTemplates.js';

/**
 * A WhatsApp template's body is approved by Meta and cannot be edited on the
 * fly, so the SMS copy has to be *rendered from the same template* rather than
 * written beside it — otherwise the two channels drift and only the WhatsApp half
 * is the one anybody reviewed.
 */
describe('content templates', () => {
  it('renders the SMS body from the template the WhatsApp send uses', () => {
    const body = renderTemplate('memory-recall', ['Billy', 'they run a support team of 40']);
    expect(body).toContain('Hey Billy');
    expect(body).toContain('they run a support team of 40');
    expect(body).not.toContain('{{');
  });

  it('numbers variables from 1, the way ContentVariables does', () => {
    expect(contentVariables(['Billy', 'chatbots'])).toEqual({ '1': 'Billy', '2': 'chatbots' });
  });

  it('declares an example for every variable its body uses', () => {
    for (const template of Object.values(CONTENT_TEMPLATES)) {
      const used = new Set([...template.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]));
      expect(Object.keys(template.variables).sort()).toEqual([...used].sort());
    }
  });

  it('covers every message this talk sends', () => {
    for (const key of ['welcome', 'patience', 'orchestrator', 'memory-recall', 'memory-answer', 'closing']) {
      expect(CONTENT_TEMPLATES[key]).toBeTruthy();
    }
  });

  it('leaves a variable that was not supplied visible rather than blank', () => {
    expect(renderTemplate('patience', [])).toBe(CONTENT_TEMPLATES.patience.body);
  });
});
