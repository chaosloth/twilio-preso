import { STAGE_LIBRARY } from '@twilio-preso/shared';
import type { DeckStage } from '@twilio-preso/shared';
import { caption } from '../ui';

/**
 * A flat preview of a slide's edited content, in the presentation's colours and
 * fonts. It is deliberately *not* the 3D scene — reproducing the stage here
 * would be a second renderer to keep in step, and the thing being checked is the
 * copy, the image URL and the poll options. "Activate slide" is how you see the
 * real thing on the big screen.
 */
export function SlidePreview({ deckStage }: { deckStage: DeckStage }) {
  const template = STAGE_LIBRARY[deckStage.stageId];
  if (!template) return null;

  function slot(key: string): string {
    const def = template!.slots?.find((s) => s.key === key);
    if (!def) return '';
    const override = deckStage.slots?.[key];
    return override === undefined ? def.default : (override ?? '');
  }

  const interaction =
    deckStage.interaction === undefined ? template.interaction : deckStage.interaction;

  // Slots the mock lays out itself; anything else is listed underneath so no
  // edited copy is silently invisible here.
  const laidOut = ['headline', 'subhead', 'image'];
  const others = (template.slots ?? []).filter((d) => !laidOut.includes(d.key) && slot(d.key));

  return (
    <div>
      <div style={{ ...caption, marginBottom: 8 }}>Preview</div>
      <div
        style={{
          background: '#000d25',
          border: '1px solid rgba(239,34,58,0.4)',
          borderRadius: 10,
          boxShadow: '0 0 24px rgba(239,34,58,0.15)',
          aspectRatio: '16 / 9',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        {slot('headline') && (
          <div
            style={{
              fontFamily: "'Tektur', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: 20,
              color: '#ffffff',
              whiteSpace: 'pre-line',
            }}
          >
            {slot('headline')}
          </div>
        )}
        {slot('subhead') && (
          <div style={{ fontSize: 13, color: '#babecc', whiteSpace: 'pre-line' }}>{slot('subhead')}</div>
        )}
        {slot('image') && (
          <img
            src={slot('image')}
            alt=""
            style={{ maxHeight: 120, maxWidth: '100%', objectFit: 'contain' }}
          />
        )}
        {interaction && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 12, color: '#7e869c', marginBottom: 6 }}>{interaction.prompt}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {(interaction.options ?? []).map((option, i) => (
                <span
                  key={i}
                  style={{
                    background: '#1e3a5f',
                    color: '#ffffff',
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 999,
                  }}
                >
                  {option || <span style={{ color: '#ef223a' }}>empty option</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {others.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {others.map((def) => (
            <div key={def.key} style={{ fontSize: 11, color: '#7e869c', marginBottom: 3 }}>
              {def.label}: <span style={{ color: '#babecc' }}>{slot(def.key)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
