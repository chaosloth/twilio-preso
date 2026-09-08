// --- Audience ---
export interface Participant {
  id: string;
  name: string;
  phone: string;
  company?: string;
  role?: string;
  registeredAt: number;
  /**
   * Answers keyed by **stage id**, so a re-answer replaces the old one and a
   * reordered deck still finds the right response. Never key this by index:
   * slide 10 is a different stage in a different deck.
   */
  responses: Record<string, ParticipantResponse>;
  /**
   * Their Twilio Conversation Memory Customer Profile, when memory is
   * configured. Optional and possibly absent even then — profile creation is
   * best-effort and must never fail a join.
   */
  memoryProfileId?: string;
}

export interface ParticipantResponse {
  /** The stage this answers. The key — stable across decks and reordering. */
  stageId: string;
  /** Deck position when the answer was given. Display ordering only. */
  stageIndex: number;
  type: InteractionType;
  value: string;
  timestamp: number;
}

// --- Interactions ---
/**
 * `call-cta` and `whatsapp-cta` are the inbound half of the demo: instead of
 * collecting an answer, the phone shows a button that opens a call or a WhatsApp
 * chat to the session's own claimed number. They publish no response — what they
 * produce is a real inbound conversation, which arrives over Twilio rather than
 * over Sync.
 */
export type InteractionType =
  | 'poll'
  | 'text'
  | 'trigger'
  | 'sentiment'
  | 'llm-prompt'
  | 'call-cta'
  | 'whatsapp-cta';

export interface InteractionConfig {
  /** Id of the stage this interaction belongs to. Stable across reordering. */
  stageId: string;
  type: InteractionType;
  prompt: string;
  options?: string[];
  allowFreeform?: boolean;
  /** Example prompt shown to the audience for `llm-prompt` interactions. */
  example?: string;
}

// --- Sync Document Schemas ---
export interface PresentationStateDoc {
  currentStageIndex: number;
  activeInteraction: InteractionConfig | null;
  totalParticipants: number;
  isLive: boolean;
}

export interface AggregateResultsDoc {
  /** Stage these tallies belong to. Empty before the first interaction. */
  stageId: string;
  /** Deck position. Display only. */
  stageIndex: number;
  type: InteractionType;
  results: Record<string, number>;
  totalResponses: number;
}

// --- Sync Stream Events ---
export interface StageAdvanceEvent {
  type: 'stage-advance';
  stageIndex: number;
  timestamp: number;
}

export interface InteractionPromptEvent {
  type: 'interaction-prompt';
  interaction: InteractionConfig;
  timestamp: number;
}

export interface AudienceResponseEvent {
  type: 'audience-response';
  participantId: string;
  participantName: string;
  stageId: string;
  /** Deck position it was answered at. Display ordering only — filter by stageId. */
  stageIndex: number;
  interactionType: InteractionType;
  value: string;
  timestamp: number;
}

export interface ParticipantJoinedEvent {
  type: 'participant-joined';
  participantId: string;
  name: string;
  timestamp: number;
}

/**
 * Emitted the moment an audience member submits a prompt, before the model has
 * answered — lets the presenter screen show their question with a thinking
 * animation. Superseded by the matching AiPromptResponseEvent.
 */
export interface AiPromptPendingEvent {
  type: 'ai-prompt-pending';
  participantId: string;
  participantName: string;
  stageId: string;
  stageIndex: number;
  prompt: string;
  timestamp: number;
}

export interface AiPromptResponseEvent {
  type: 'ai-prompt-response';
  participantId: string;
  participantName: string;
  stageId: string;
  stageIndex: number;
  prompt: string;
  response: string;
  timestamp: number;
}

export type SyncStreamEvent =
  | StageAdvanceEvent
  | InteractionPromptEvent
  | AudienceResponseEvent
  | ParticipantJoinedEvent
  | AiPromptPendingEvent
  | AiPromptResponseEvent;

// --- Twilio Demo Triggers ---
export interface SmsTrigger {
  type: 'sms';
  stageIndex: number;
  templateId: string;
}

export interface VoiceTrigger {
  type: 'voice';
  stageIndex: number;
  targetParticipantId: string;
}

export type DemoTrigger = SmsTrigger | VoiceTrigger;
