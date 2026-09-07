import { resolveDeck, responseFor } from '@twilio-preso/shared';
import type { Participant, ResolvedStage, SessionRecord } from '@twilio-preso/shared';

export interface SessionSnapshot {
  session: Omit<SessionRecord, 'deck'> & { deck: SessionRecord['deck'] };
  exportedAt: number;
  participantCount: number;
  participants: Participant[];
}

export function buildSnapshot(
  session: SessionRecord,
  participants: Participant[]
): SessionSnapshot {
  return {
    session,
    exportedAt: Date.now(),
    participantCount: participants.length,
    participants,
  };
}

/** RFC 4180: quote everything, double interior quotes. Names and free-text
 *  answers routinely contain commas, and a company name with one silently
 *  shifted every later column in the ad-hoc exports this replaces. */
function csvCell(value: string | number | undefined | null): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

/**
 * One row per participant, one column per question this deck actually asked —
 * driven by the session's own deck, so a reordered or trimmed deck exports the
 * questions it showed rather than a fixed set.
 */
export function toCsv(session: SessionRecord, participants: Participant[]): string {
  const asked: ResolvedStage[] = resolveDeck(session.deck).filter(
    (stage) => stage.interaction && stage.interaction.type !== 'llm-prompt'
  );

  const header = [
    'Name',
    'Phone',
    'Company',
    'Role',
    ...asked.map((stage) => stage.interaction!.prompt || stage.title),
  ];

  const rows = participants.map((participant) => [
    participant.name,
    participant.phone,
    participant.company,
    participant.role,
    ...asked.map((stage) => responseFor(participant, stage.id)?.value ?? ''),
  ]);

  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

/** Filesystem-safe, sortable, and identifies the event without a lookup. */
export function snapshotFilename(session: SessionRecord, extension: string): string {
  const slug = session.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${slug || 'session'}-${session.joinCode}.${extension}`;
}
