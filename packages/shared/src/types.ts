// --- Audience ---
export interface Participant {
  id: string;
  name: string;
  phone: string;
  company?: string;
  role?: string;
  registeredAt: number;
  responses: Record<number, ParticipantResponse>;
}

export interface ParticipantResponse {
  stageIndex: number;
  type: InteractionType;
  value: string;
  timestamp: number;
}

// --- Interactions ---
export type InteractionType = 'poll' | 'text' | 'trigger' | 'sentiment';

export interface InteractionConfig {
  stageIndex: number;
  type: InteractionType;
  prompt: string;
  options?: string[];
  allowFreeform?: boolean;
}

// --- Sync Document Schemas ---
export interface PresentationStateDoc {
  currentStageIndex: number;
  activeInteraction: InteractionConfig | null;
  totalParticipants: number;
  isLive: boolean;
}

export interface AggregateResultsDoc {
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

export type SyncStreamEvent =
  | StageAdvanceEvent
  | InteractionPromptEvent
  | AudienceResponseEvent
  | ParticipantJoinedEvent;

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
