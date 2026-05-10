import type { InteractionConfig } from './types.js';

export interface StageDefinition {
  index: number;
  id: string;
  title: string;
  act: 1 | 2 | 3 | 4;
  notes: string;
  interaction: InteractionConfig | null;
  demoTrigger?: 'sms-patience' | 'sms-orchestrator' | 'sms-memory' | 'intelligence-analysis' | 'voice-agent-connect' | 'voice-mass-outbound' | 'sms-closing';
}

export const STAGES: StageDefinition[] = [
  // ACT 1
  { index: 0, id: 'opening', title: 'Opening / QR Registration', act: 1, notes: 'Welcome audience. QR code is displayed. Encourage scanning. Wait for registration count to build.', interaction: null },
  { index: 1, id: 'speakers', title: 'Speakers Intro', act: 1, notes: 'Introduce Nicholas and Christopher. Mention roles and the "Wonder" theme.', interaction: null },
  { index: 2, id: 'why-wonder', title: 'Why Wonder?', act: 1, notes: 'Technology once inspired awe. Wonder reconnects tech to imagination. Builders are the magic makers.', interaction: null },
  { index: 3, id: 'story-arc', title: 'Wonder Story Arc', act: 1, notes: 'Six parts of the story. Each speaker owns a chapter. Ideas stack over time.', interaction: null },

  // ACT 2
  { index: 4, id: 'customer-nerves', title: "Who's getting on customers' nerves?", act: 2, notes: 'Transition to the problem. Launch the poll. Wait for responses to build the 3D bar chart.', interaction: { stageIndex: 4, type: 'poll', prompt: 'What frustrates YOUR customers most?', options: ['Long wait times', 'Repeating information', 'Channel switching', 'No resolution'] } },
  { index: 5, id: 'patience-deficit', title: 'Patience Deficit', act: 2, notes: 'Trigger the SMS demo. Audience feels the frustration firsthand. Reference the Decoding Digital Patience report.', interaction: null, demoTrigger: 'sms-patience' },
  { index: 6, id: 'think-channels', title: 'Think in Channels', act: 2, notes: 'We have learned to think in channels. Three doors — each a separate silo.', interaction: null },
  { index: 7, id: 'siloes', title: 'The Result is Siloes', act: 2, notes: 'Doors slam. The environment fractures. Dramatic moment — let the visual do the work.', interaction: null },
  { index: 8, id: 'customers-are', title: 'Customers Are...', act: 2, notes: 'Launch text input. Ask for their biggest CX challenge. Watch the word cloud form in real-time.', interaction: { stageIndex: 8, type: 'text', prompt: 'In one word, describe your biggest CX challenge right now.' } },

  // ACT 3
  { index: 9, id: 'orchestrating', title: "You're Orchestrating the Journey", act: 3, notes: 'The turn. From chaos to order. The conductor metaphor. Red threads weave the islands together.', interaction: null },
  { index: 10, id: 'conversations-overview', title: 'Twilio Conversations Overview', act: 3, notes: 'The four pillars materialize. Hero reveal moment. Let the audience absorb each product.', interaction: null },
  { index: 11, id: 'orchestrator', title: 'Conversation Orchestrator', act: 3, notes: 'Trigger WhatsApp message. Shows cross-channel continuity — references the earlier SMS.', interaction: null, demoTrigger: 'sms-orchestrator' },
  { index: 12, id: 'memory', title: 'Conversation Memory', act: 3, notes: "Trigger personalized SMS using their name and their word from stage 9. The 'wow' moment.", interaction: null, demoTrigger: 'sms-memory' },
  { index: 13, id: 'intelligence', title: 'Conversation Intelligence', act: 3, notes: 'Show live analysis of the word cloud responses. Sentiment breakdown, intent clustering visualized in 3D.', interaction: null, demoTrigger: 'intelligence-analysis' },
  { index: 14, id: 'agent-connect', title: 'Agent Connect', act: 3, notes: 'Volunteer gets the AI voice call. It handles their question then hands off to you on stage. Pick up the phone dramatically.', interaction: null, demoTrigger: 'voice-agent-connect' },

  // ACT 4
  { index: 15, id: 'innovation', title: 'Innovation: Wild Ideas to Results', act: 4, notes: 'Launch final poll. Which product excites them most? Pillars glow proportionally.', interaction: { stageIndex: 15, type: 'poll', prompt: 'Which product are you most excited to explore?', options: ['Conversation Orchestrator', 'Conversation Memory', 'Conversation Intelligence', 'Agent Connect'] } },
  { index: 16, id: 'never-easier', title: "It's Never Been Easier", act: 4, notes: 'Show aggregate stats. How many people participated, how many messages sent. The presentation itself was the demo.', interaction: null },
  { index: 17, id: 'mass-call', title: 'Mass Outbound Call', act: 4, notes: "The big finale demo. Every phone in the room rings simultaneously — connected to the AI bot we just 'built' on stage. Maximum wow factor.", interaction: null, demoTrigger: 'voice-mass-outbound' },
  { index: 18, id: 'closing', title: 'letsGoMichelangeloMode();', act: 4, notes: 'Final SMS to all participants. Personalized follow-up. Thank the audience. QR for resources.', interaction: null, demoTrigger: 'sms-closing' },
];

export const TOTAL_STAGES = STAGES.length;
