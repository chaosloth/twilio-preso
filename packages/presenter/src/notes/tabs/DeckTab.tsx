import { useEffect, useMemo, useRef, useState } from 'react';
import { deckExportFilename, exportDeck, parseDeckTransfer, validateDeck } from '@twilio-preso/shared';
import type { Deck, DeckStage, ParsedDeckTransfer } from '@twilio-preso/shared';
import type { AdminApi } from '../useAdminApi';
import { SlideModal } from '../deck/SlideModal';
import { SlideRail } from '../deck/SlideRail';
import { Empty, ErrorText, Row, caption, heading, smallButton } from '../ui';

interface DeckTabProps {
  api: AdminApi;
  /** The slide the presentation window is currently on. */
  stageIndex: number;
  onGoTo: (index: number) => void;
}

/**
 * The deck editor: the slide list, with one slide's editor opening in an overlay.
 * The editor is large enough that inline it pushed the deck off a laptop screen.
 *
 * Edits are local until saved, so a half-finished reorder or an unfinished poll
 * option never reaches the running presentation; the presenter laptop only picks
 * up a deck change when it is committed.
 *
 * Warnings are advisory throughout — this previews `validateDeck` against the
 * draft so a bad order is visible *before* saving, and the backend returns its
 * own on commit. Neither blocks anything.
 */
export function DeckTab({ api, stageIndex, onGoTo }: DeckTabProps) {
  const { session, warnings, commitDeck, applyImport } = api;
  const [draft, setDraft] = useState<DeckStage[]>([]);
  /** Index of the slide open in the editor overlay, or null when closed. */
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** What an import said about the file, shown until the next edit. */
  const [importNote, setImportNote] = useState<string[]>([]);
  /**
   * The rest of an imported file — the agent personas and the door settings —
   * held until Save, so the whole presentation lands in one deliberate action
   * and a presenter who changes their mind has changed nothing.
   */
  const [imported, setImported] = useState<ParsedDeckTransfer | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session) setDraft(session.deck.stages);
  }, [session]);

  /**
   * `imported` counts: a file may carry the same slides with a different voice
   * persona, and then the deck comparison says nothing changed while there is
   * still something waiting to be saved.
   */
  const dirty = useMemo(
    () =>
      !!session &&
      (!!imported || JSON.stringify(draft) !== JSON.stringify(session.deck.stages)),
    [draft, imported, session]
  );

  const preview = useMemo(
    () => (session ? validateDeck({ ...session.deck, stages: draft }) : []),
    [draft, session]
  );

  const shown = dirty ? preview : warnings;

  /**
   * The deck is stored inside a Twilio Sync map item, which caps at 16 KB of
   * data — edited copy is the only thing here that grows without bound, so say
   * so before a save starts failing. Images are URLs for the same reason.
   */
  const deckBytes = useMemo(() => new Blob([JSON.stringify(draft)]).size, [draft]);
  const nearLimit = deckBytes > 12 * 1024;

  if (!session) return <Empty>Loading deck…</Empty>;

  function edit(index: number, patch: Partial<DeckStage>) {
    setDraft((d) => d.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  /** Pulls the dragged slide out and reinserts it, rather than swapping a pair. */
  function reorder(from: number, to: number) {
    if (from === to) return;
    setDraft((d) => {
      const next = [...d];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });
  }

  /**
   * Downloads the deck as JSON. The *draft*, not the saved record: what you are
   * looking at is what you meant to copy, and an export is read-only anyway.
   */
  function exportToFile() {
    // Everything a rehearsal changed, not only the slides: the personas, and the
    // door settings the room depends on. Resolved by `exportDeck`, so the file
    // states what this session actually does rather than only its overrides.
    const file = exportDeck({ ...session!.deck, stages: draft }, session!.title, {
      relay: session!.relay ?? {},
      text: session!.text ?? {},
      settings: {
        verifyChannel: session!.verifyChannel,
        countryCode: session!.countryCode,
        countryCodes: session!.countryCodes,
      },
    });
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = deckExportFilename(session!.title);
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Loads a deck file into the draft — never straight into the session.
   *
   * An import from another environment is exactly the case where you want to look
   * before committing: the warnings it produces (a stage this build has no
   * component for, a trigger whose dependency is now out of order) are the
   * reason for the review, and `Save deck` is still the only thing that reaches
   * the running presentation.
   */
  async function importFromFile(file: File) {
    setError('');
    setImportNote([]);
    try {
      const parsed = parseDeckTransfer(await file.text());
      setDraft(parsed.deck.stages);
      setImported(parsed);
      const carried = [
        parsed.relay && 'voice agent',
        parsed.text && 'text agent',
        Object.keys(parsed.settings ?? {}).length > 0 && 'registration settings',
      ].filter(Boolean) as string[];
      setImportNote([
        `Loaded ${parsed.deck.stages.length} slides from ${file.name} — review, then Save deck.`,
        ...(carried.length ? [`Also carries ${carried.join(', ')} — saved with the deck.`] : []),
        ...parsed.warnings,
      ]);
    } catch (err: any) {
      setError(err?.message ?? 'Could not read that deck file.');
    }
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const deck: Deck = { ...session!.deck, stages: draft };
      if (imported) {
        await applyImport(imported, deck);
        setImported(null);
      } else {
        await commitDeck(deck);
      }
      // Tell the presentation window to re-read the record, so a saved edit
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
        <h3 style={{ ...heading, marginBottom: 0 }}>Deck</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={smallButton} onClick={exportToFile}>
            Export
          </button>
          <button style={smallButton} onClick={() => fileInput.current?.click()}>
            Import
          </button>
          {/* Hidden input rather than a drop zone: this is a laptop backstage,
              and a file picker is the thing that works with a trackpad. */}
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Cleared so re-picking the same file after an edit still fires.
              e.target.value = '';
              if (file) void importFromFile(file);
            }}
          />
          <button
            style={smallButton}
            disabled={!dirty}
            onClick={() => {
              setDraft(session.deck.stages);
              setImportNote([]);
              setImported(null);
            }}
          >
            Revert
          </button>
          <button
            style={{
              ...smallButton,
              borderColor: '#ef223a',
              color: dirty ? '#ffffff' : '#7e869c',
              background: dirty ? '#ef223a' : 'transparent',
            }}
            disabled={!dirty || busy}
            onClick={() => void save()}
          >
            {busy ? 'Saving…' : 'Save deck'}
          </button>
        </div>
      </Row>

      <div style={{ ...caption, marginBottom: 16 }}>
        Export carries the whole presentation — slide order, titles, speaker notes, copy,
        interactions and triggers, plus the voice and text agent settings and the registration
        channel and dialling codes. Import loads it as a draft; Save writes all of it.
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      {importNote.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: 'rgba(30,58,95,0.5)',
            border: '1px solid rgba(186,190,204,0.25)',
            borderRadius: 8,
          }}
        >
          {importNote.map((note, i) => (
            <div key={i} style={{ fontSize: 12, color: i === 0 ? '#ffffff' : '#babecc', marginBottom: 4 }}>
              {note}
            </div>
          ))}
        </div>
      )}

      {nearLimit && (
        <ErrorText>
          This deck is {(deckBytes / 1024).toFixed(1)} KB of the 16 KB a session record holds. Shorten
          edited copy or split the deck before it stops saving.
        </ErrorText>
      )}

      {shown.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: 'rgba(239,34,58,0.08)',
            border: '1px solid rgba(239,34,58,0.25)',
            borderRadius: 8,
          }}
        >
          <div style={{ ...caption, color: '#ef223a', marginBottom: 6 }}>
            {dirty ? 'Unsaved changes' : 'Saved deck'} — {shown.length}{' '}
            {shown.length === 1 ? 'warning' : 'warnings'}
          </div>
          {shown.map((w, i) => (
            <div key={i} style={{ fontSize: 12, color: '#babecc', marginBottom: 4 }}>
              {w.message}
            </div>
          ))}
        </div>
      )}

      <SlideRail
        draft={draft}
        onScreen={dirty ? -1 : stageIndex}
        canActivate={!dirty}
        onActivate={onGoTo}
        onEdit={setEditing}
        onReorder={reorder}
        onDelete={(i) => {
          setDraft((d) => d.filter((_, j) => j !== i));
          setEditing(null);
        }}
        onAdd={(stageId) => {
          setDraft((d) => [...d, { stageId }]);
          setEditing(draft.length);
        }}
      />

      {draft.length === 0 && <Empty>Empty deck — add a slide with “+ New slide”.</Empty>}

      {editing !== null && draft[editing] && (
        <SlideModal
          index={editing}
          deckStage={draft[editing]}
          onChange={(patch) => edit(editing, patch)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
