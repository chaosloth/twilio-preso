import { useEffect, useMemo, useState } from 'react';
import { STAGE_LIBRARY, STAGE_LIBRARY_ORDER, validateDeck } from '@twilio-preso/shared';
import type { Deck, DeckStage } from '@twilio-preso/shared';
import type { AdminApi } from '../useAdminApi';
import { Empty, ErrorText, Row, caption, dangerButton, heading, smallButton, textInput } from '../ui';

interface DeckTabProps {
  api: AdminApi;
  /** The slide the presentation window is currently on, for the Activate button. */
  stageIndex: number;
  onGoTo: (index: number) => void;
}

/**
 * Running-order editor. Edits are local until saved, so a half-finished reorder
 * never reaches the running presentation; the presenter laptop only picks up a
 * deck change when it is committed.
 *
 * Warnings are advisory throughout — this preview runs `validateDeck` on the
 * draft so a bad order is visible *before* saving, and the backend returns its
 * own on commit. Neither blocks anything.
 */
export function DeckTab({ api, stageIndex, onGoTo }: DeckTabProps) {
  const { session, warnings, commitDeck } = api;
  const [draft, setDraft] = useState<DeckStage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** Index of the row being dragged, or null. Drag state only — not persisted. */
  const [dragging, setDragging] = useState<number | null>(null);

  useEffect(() => {
    if (session) setDraft(session.deck.stages);
  }, [session]);

  const dirty = useMemo(
    () => !!session && JSON.stringify(draft) !== JSON.stringify(session.deck.stages),
    [draft, session]
  );

  const preview = useMemo(
    () => (session ? validateDeck({ ...session.deck, stages: draft }) : []),
    [draft, session]
  );

  const shown = dirty ? preview : warnings;

  if (!session) return <Empty>Loading deck…</Empty>;

  function edit(index: number, patch: Partial<DeckStage>) {
    setDraft((d) => d.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  /** Pulls the dragged row out and re-inserts it at `to`, unlike `move`'s swap. */
  function reorder(from: number, to: number) {
    if (from === to) return;
    setDraft((d) => {
      const next = [...d];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });
  }

  function move(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= draft.length) return;
    setDraft((d) => {
      const next = [...d];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const deck: Deck = { ...session!.deck, stages: draft };
      await commitDeck(deck);
      // Tell the presentation window to re-read the record, so a saved reorder
      // takes effect on the big screen without restarting the session.
      const channel = new BroadcastChannel(`presenter-sync:${session!.id}`);
      channel.postMessage({ type: 'deck-change' });
      channel.close();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Row style={{ marginBottom: 16 }}>
        <h3 style={{ ...heading, marginBottom: 0 }}>
          Running order ({draft.length} {draft.length === 1 ? 'stage' : 'stages'})
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={smallButton} disabled={!dirty} onClick={() => setDraft(session.deck.stages)}>
            Revert
          </button>
          <button
            style={{ ...smallButton, borderColor: '#ef223a', color: dirty ? '#ffffff' : '#7e869c', background: dirty ? '#ef223a' : 'transparent' }}
            disabled={!dirty || busy}
            onClick={() => void save()}
          >
            {busy ? 'Saving…' : 'Save deck'}
          </button>
        </div>
      </Row>

      {error && <ErrorText>{error}</ErrorText>}

      {shown.length > 0 && (
        <div style={{ marginBottom: 16, padding: 12, background: 'rgba(239,34,58,0.08)', border: '1px solid rgba(239,34,58,0.25)', borderRadius: 8 }}>
          <div style={{ ...caption, color: '#ef223a', marginBottom: 6 }}>
            {dirty ? 'Unsaved order' : 'Saved deck'} — {shown.length}{' '}
            {shown.length === 1 ? 'warning' : 'warnings'}
          </div>
          {shown.map((w, i) => (
            <div key={i} style={{ fontSize: 12, color: '#babecc', marginBottom: 4 }}>
              {w.message}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {draft.map((deckStage, i) => {
          const template = STAGE_LIBRARY[deckStage.stageId];
          // `undefined` inherits from the template, explicit `null` disables.
          const trigger =
            deckStage.demoTrigger === undefined ? template?.demoTrigger : deckStage.demoTrigger;
          const interaction =
            deckStage.interaction === undefined ? template?.interaction : deckStage.interaction;

          return (
            <div
              key={`${deckStage.stageId}-${i}`}
              onDragOver={(e) => {
                // Without this the drop is refused and the row snaps back.
                e.preventDefault();
                if (dragging !== null && dragging !== i) reorder(dragging, i);
                setDragging(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(null);
              }}
              style={{
                padding: '10px 12px',
                background: '#0a1535',
                borderRadius: 6,
                opacity: dragging === i ? 0.5 : 1,
                border: i === stageIndex && !dirty ? '1px solid #ef223a' : '1px solid transparent',
              }}
            >
              <Row>
                {/* Only the handle is draggable, so the row's own buttons and any
                    text inside it still take clicks normally. */}
                <div
                  draggable
                  onDragStart={() => setDragging(i)}
                  onDragEnd={() => setDragging(null)}
                  title="Drag to reorder"
                  style={{ cursor: 'grab', color: '#4d5777', fontSize: 14, lineHeight: 1, padding: '0 2px', userSelect: 'none' }}
                >
                  ⠿
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    <span style={{ color: '#7e869c', fontFamily: 'monospace' }}>{i + 1}. </span>
                    {deckStage.title ?? template?.title ?? deckStage.stageId}
                    {!template && <span style={{ color: '#ef223a' }}> (unknown stage)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#7e869c' }}>
                    {deckStage.stageId}
                    {interaction && ` · ${interaction.type}`}
                    {trigger && ` · ${trigger}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {/* Jumps the big screen to this slide. Draft indices don't
                      match the running deck until the reorder is saved, so
                      activating mid-edit would land on the wrong slide. */}
                  <button
                    style={i === stageIndex && !dirty ? { ...smallButton, borderColor: '#ef223a', color: '#ffffff' } : smallButton}
                    disabled={dirty}
                    title={dirty ? 'Save the deck before activating a slide' : 'Show this slide on the presentation screen'}
                    onClick={() => onGoTo(i)}
                  >
                    {i === stageIndex && !dirty ? 'on screen' : 'activate'}
                  </button>
                  <button style={smallButton} disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button
                    style={smallButton}
                    disabled={i === draft.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                  {template?.demoTrigger && (
                    <button
                      style={deckStage.demoTrigger === null ? smallButton : dangerButton}
                      title="Suppress this stage's real SMS/call without removing the slide"
                      onClick={() =>
                        edit(i, { demoTrigger: deckStage.demoTrigger === null ? undefined : null })
                      }
                    >
                      {deckStage.demoTrigger === null ? 'trigger off' : 'trigger on'}
                    </button>
                  )}
                  <button style={dangerButton} onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                </div>
              </Row>
            </div>
          );
        })}
        {draft.length === 0 && <Empty>Empty deck — add a stage below.</Empty>}
      </div>

      <AddStage onAdd={(stageId) => setDraft((d) => [...d, { stageId }])} />
    </div>
  );
}

function AddStage({ onAdd }: { onAdd: (stageId: string) => void }) {
  const [stageId, setStageId] = useState(STAGE_LIBRARY_ORDER[0] ?? '');

  return (
    <div style={{ borderTop: '1px solid #1a2540', paddingTop: 14 }}>
      <div style={{ ...caption, marginBottom: 8 }}>Add from stage library</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <select
          style={{ ...textInput, flex: 1 }}
          value={stageId}
          onChange={(e) => setStageId(e.target.value)}
        >
          {STAGE_LIBRARY_ORDER.map((id) => (
            <option key={id} value={id}>
              {STAGE_LIBRARY[id].title}
            </option>
          ))}
        </select>
        <button style={smallButton} disabled={!stageId} onClick={() => onAdd(stageId)}>
          Add
        </button>
      </div>
    </div>
  );
}
