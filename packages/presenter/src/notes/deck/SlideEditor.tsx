import { STAGE_LIBRARY, DEMO_TRIGGER_IDS } from '@twilio-preso/shared';
import type { DeckStage, InteractionConfig, InteractionType, SlotDef } from '@twilio-preso/shared';
import { caption, dangerButton, smallButton, textInput } from '../ui';

const INTERACTION_TYPES: InteractionType[] = ['poll', 'text', 'trigger', 'sentiment', 'llm-prompt'];

interface SlideEditorProps {
  index: number;
  deckStage: DeckStage;
  onChange: (patch: Partial<DeckStage>) => void;
}

/**
 * The editing pane for one slide: its title, speaker notes, on-screen copy and
 * image, its demo trigger, and its audience interaction (including poll
 * options). Everything here writes into the deck draft — nothing reaches the
 * running presentation until the deck is saved.
 */
export function SlideEditor({ index, deckStage, onChange }: SlideEditorProps) {
  const template = STAGE_LIBRARY[deckStage.stageId];

  if (!template) {
    return (
      <div style={{ flex: 1 }}>
        <p style={{ color: '#ef223a', fontSize: 13 }}>
          `{deckStage.stageId}` is not in the stage library, so it cannot be edited or shown.
          Remove it, or add the matching presenter component.
        </p>
      </div>
    );
  }

  // `undefined` inherits from the template, explicit `null` disables.
  const trigger = deckStage.demoTrigger === undefined ? template.demoTrigger : deckStage.demoTrigger;
  const interaction = deckStage.interaction === undefined ? template.interaction : deckStage.interaction;

  /** `undefined` removes the override, so the slot goes back to the template. */
  function setSlot(key: string, value: string | null | undefined) {
    const slots = { ...deckStage.slots };
    if (value === undefined) delete slots[key];
    else slots[key] = value;
    onChange({ slots });
  }

  function slotValue(def: SlotDef): string {
    const override = deckStage.slots?.[def.key];
    return override === undefined ? def.default : (override ?? '');
  }

  function setInteraction(patch: Partial<InteractionConfig>) {
    if (!interaction) return;
    onChange({ interaction: { ...interaction, ...patch } });
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ ...caption, marginBottom: 6 }}>
          Slide {index + 1} · {deckStage.stageId}
        </div>
        <input
          style={{ ...textInput, width: '100%', fontSize: 15 }}
          value={deckStage.title ?? template.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>

      <Section label="On-screen content">
        {template.slots?.length ? (
          template.slots.map((def) => (
            <Field key={def.key} label={def.label}>
              {def.kind === 'multiline' ? (
                <textarea
                  style={{ ...textInput, width: '100%', minHeight: 60, resize: 'vertical' }}
                  value={slotValue(def)}
                  onChange={(e) => setSlot(def.key, e.target.value)}
                />
              ) : (
                <input
                  style={{ ...textInput, width: '100%' }}
                  placeholder={def.kind === 'image' ? 'https://… (leave blank for no image)' : def.default}
                  value={slotValue(def)}
                  onChange={(e) => setSlot(def.key, e.target.value)}
                />
              )}
              {def.kind === 'image' && slotValue(def) && (
                // A pasted URL is the thing most likely to be wrong, so show it
                // here rather than letting the stage be the first place it fails.
                <img
                  src={slotValue(def)}
                  alt=""
                  style={{ marginTop: 6, maxHeight: 90, maxWidth: '100%', borderRadius: 4, border: '1px solid #1a2540' }}
                />
              )}
              {slotValue(def) !== def.default && (
                <button style={{ ...smallButton, marginTop: 4 }} onClick={() => setSlot(def.key, undefined)}>
                  Reset to default
                </button>
              )}
            </Field>
          ))
        ) : (
          <p style={{ fontSize: 12, color: '#7e869c' }}>This stage has no editable copy yet.</p>
        )}
      </Section>

      <Section label="Speaker notes">
        <textarea
          style={{ ...textInput, width: '100%', minHeight: 70, resize: 'vertical' }}
          value={deckStage.notes ?? template.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </Section>

      <Section label="Demo trigger">
        <select
          style={{ ...textInput, width: '100%' }}
          value={deckStage.demoTrigger === undefined ? '__inherit' : (deckStage.demoTrigger ?? '__off')}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              demoTrigger: v === '__inherit' ? undefined : v === '__off' ? null : (v as typeof trigger),
            });
          }}
        >
          <option value="__inherit">
            Template default {template.demoTrigger ? `(${template.demoTrigger})` : '(none)'}
          </option>
          <option value="__off">Off — keep the slide, send nothing</option>
          {DEMO_TRIGGER_IDS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 11, color: '#7e869c', margin: '6px 0 0' }}>
          {trigger
            ? `Reaching this slide fires ${trigger} — real SMS or calls, but only while the session is armed.`
            : 'This slide sends nothing.'}
        </p>
      </Section>

      <Section label="Audience interaction">
        {interaction ? (
          <>
            <Field label="Type">
              <select
                style={{ ...textInput, width: '100%' }}
                value={interaction.type}
                onChange={(e) => setInteraction({ type: e.target.value as InteractionType })}
              >
                {INTERACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prompt shown on phones">
              <textarea
                style={{ ...textInput, width: '100%', minHeight: 50, resize: 'vertical' }}
                value={interaction.prompt}
                onChange={(e) => setInteraction({ prompt: e.target.value })}
              />
            </Field>
            <Field label="Options">
              {(interaction.options ?? []).map((option, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input
                    style={{ ...textInput, flex: 1 }}
                    value={option}
                    onChange={(e) => {
                      const options = [...(interaction.options ?? [])];
                      options[i] = e.target.value;
                      setInteraction({ options });
                    }}
                  />
                  <button
                    style={dangerButton}
                    onClick={() =>
                      setInteraction({ options: (interaction.options ?? []).filter((_, j) => j !== i) })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                style={smallButton}
                onClick={() => setInteraction({ options: [...(interaction.options ?? []), ''] })}
              >
                + Option
              </button>
              {interaction.type === 'poll' && (interaction.options ?? []).length === 0 && (
                <p style={{ fontSize: 11, color: '#ef223a', margin: '6px 0 0' }}>
                  A poll with no options gives phones nothing to tap.
                </p>
              )}
            </Field>
            <button style={dangerButton} onClick={() => onChange({ interaction: null })}>
              Remove interaction
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 12, color: '#7e869c', margin: '0 0 8px' }}>
              Phones stay on the waiting screen for this slide.
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                style={smallButton}
                onClick={() =>
                  onChange({
                    interaction: {
                      stageId: deckStage.stageId,
                      type: 'poll',
                      prompt: '',
                      options: ['', ''],
                    },
                  })
                }
              >
                Add a poll
              </button>
              {template.interaction && (
                <button style={smallButton} onClick={() => onChange({ interaction: undefined })}>
                  Restore template interaction
                </button>
              )}
            </div>
          </>
        )}
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid #1a2540', paddingTop: 12 }}>
      <div style={{ ...caption, marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: '#babecc', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
