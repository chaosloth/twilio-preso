import type { InteractionConfig } from './types.js';

/**
 * Every demo trigger the backend knows how to fire. Named so that deck
 * overrides and the backend's trigger switch share one definition.
 */
export type DemoTriggerId =
  | 'sms-patience'
  | 'sms-orchestrator'
  | 'sms-memory'
  | 'intelligence-analysis'
  | 'voice-agent-connect'
  | 'voice-mass-outbound'
  | 'sms-closing';

/**
 * A stage that exists as a presenter component. Deliberately has no `index` —
 * position is a property of a deck, not of the stage itself.
 */
export interface StageTemplate {
  /** Also the presenter component key. */
  id: string;
  title: string;
  act: 1 | 2 | 3 | 4;
  notes: string;
  interaction: InteractionConfig | null;
  demoTrigger?: DemoTriggerId;
  /** Stage ids whose responses this stage's trigger reads. Drives validation. */
  dependsOn?: string[];
}

const templates: StageTemplate[] = [
  // ACT 1
  {
    id: 'opening',
    title: 'Opening / QR Registration',
    act: 1,
    notes: 'Welcome audience. QR code is displayed. Encourage scanning. Wait for registration count to build.',
    interaction: null,
  },
  {
    id: 'patience-poll',
    title: 'Patience Poll',
    act: 1,
    notes: 'Ice-breaker poll. Get the audience engaged early.',
    interaction: {
      stageId: 'patience-poll',
      type: 'poll',
      prompt: 'How much patience do you have for bad Customer Experience?',
      options: ['A lot', 'A little', 'None'],
    },
  },
  {
    id: 'speakers',
    title: 'Speakers Intro',
    act: 1,
    notes: 'Introduce Nicholas and Christopher. Mention roles and the "Wonder" theme.',
    interaction: null,
  },
  {
    id: 'why-wonder',
    title: 'Why Wonder?',
    act: 1,
    notes: 'Technology once inspired awe. Wonder reconnects tech to imagination. Builders are the magic makers.',
    interaction: null,
  },
  {
    id: 'story-arc',
    title: 'Topics for Today',
    act: 1,
    notes: 'Overview of the topics we will cover today.',
    interaction: null,
  },

  // ACT 2
  {
    id: 'customer-nerves',
    title: "Who's getting on customers' nerves?",
    act: 2,
    notes: 'Transition to the problem. Launch the poll. Wait for responses to build the 3D bar chart.',
    interaction: {
      stageId: 'customer-nerves',
      type: 'poll',
      prompt: 'What frustrates YOUR customers most?',
      options: ['Long wait times', 'Repeating information', 'Channel switching', 'No resolution'],
    },
  },
  {
    id: 'patience-deficit',
    title: 'Patience Deficit',
    act: 2,
    notes: "If you're in line with the cross-industry average, you're probably taking a full minute longer than customers expect to resolve financial disputes.\n\nAnd seven minutes longer than customers expect when troubleshooting.",
    interaction: null,
    demoTrigger: 'sms-patience',
  },
  {
    id: 'impatient-customers',
    title: 'When Customers Get Impatient',
    act: 2,
    notes: "Now, let's have a look at what happens when we do get on customers' nerves.\n36% try to fix it themselves\n34% jump to another channel\n30% give up altogether",
    interaction: null,
  },
  {
    id: 'think-channels',
    title: 'Think in Channels',
    act: 2,
    notes: 'We have learned to think in channels. Three doors — each a separate silo.',
    interaction: null,
  },
  {
    id: 'siloes',
    title: 'The Result is Siloes',
    act: 2,
    notes: 'When the experience is disjointed, customers think twice about repeat purchases.',
    interaction: null,
  },
  {
    id: 'customers-are',
    title: 'Customers Are...',
    act: 2,
    notes: 'Launch text input. Ask for their biggest CX challenge. Watch the word cloud form in real-time.',
    interaction: {
      stageId: 'customers-are',
      type: 'text',
      prompt: 'In one word, describe your biggest CX challenge right now.',
    },
  },

  // ACT 3
  {
    id: 'orchestrating',
    title: "You're Orchestrating the Journey",
    act: 3,
    notes: 'The turn. From chaos to order. The conductor metaphor. Red threads weave the islands together.',
    interaction: null,
  },
  {
    id: 'conversations-overview',
    title: 'Twilio Conversations Overview',
    act: 3,
    notes: 'The four pillars materialize. Hero reveal moment. Let the audience absorb each product.',
    interaction: null,
  },
  {
    id: 'orchestrator',
    title: 'Conversation Orchestrator',
    act: 3,
    notes: 'Trigger WhatsApp message. Shows cross-channel continuity — references the earlier SMS.',
    interaction: null,
    demoTrigger: 'sms-orchestrator',
  },
  {
    id: 'memory',
    title: 'Conversation Memory',
    act: 3,
    notes: "Trigger personalized SMS using their name and their word from stage 9. The 'wow' moment.",
    interaction: null,
    demoTrigger: 'sms-memory',
    dependsOn: ['customers-are'],
  },
  {
    id: 'intelligence',
    title: 'Conversation Intelligence',
    act: 3,
    notes: 'Show live analysis of the word cloud responses. Sentiment breakdown, intent clustering visualized in 3D.',
    interaction: null,
    demoTrigger: 'intelligence-analysis',
    dependsOn: ['customers-are'],
  },
  {
    id: 'agent-connect',
    title: 'Agent Connect',
    act: 3,
    notes: 'Volunteer gets the AI voice call. It handles their question then hands off to you on stage. Pick up the phone dramatically.',
    interaction: null,
    demoTrigger: 'voice-agent-connect',
  },
  {
    id: 'mcp-server',
    title: 'Twilio MCP Server',
    act: 3,
    notes: "How did we build all of this so fast? The Twilio MCP server wires your AI coding agent straight into Twilio's full API surface — 1,800+ endpoints across 30+ products. No more tab-switching between docs and your IDE. Search-then-retrieve keeps context lean. No auth, no install — just point your agent at mcp.twilio.com/docs. Public Beta.",
    interaction: null,
  },
  {
    id: 'ai-playground',
    title: 'Ask the Agent',
    act: 3,
    notes: "Hand the mic to the audience. Everyone's phone now has a prompt box wired to a live Claude-powered agent. Have them ask it anything — their questions and the AI's replies stream onto this screen in real time. This is the MCP-built agent, live.",
    interaction: {
      stageId: 'ai-playground',
      type: 'llm-prompt',
      prompt: 'Ask our live AI agent anything about Twilio 👇',
      example: 'How would I send a WhatsApp message with Twilio?',
    },
  },

  // ACT 4
  {
    id: 'innovation',
    title: 'Where Do You Need This to Run?',
    act: 4,
    notes: 'Launch poll with freeform option. Where does the audience need this to run?',
    interaction: {
      stageId: 'innovation',
      type: 'poll',
      prompt: 'Where do you need this to run?',
      options: ['AWS', 'Google', 'Microsoft', 'On Premise'],
      allowFreeform: true,
    },
  },
  {
    id: 'never-easier',
    title: "It's Never Been Easier",
    act: 4,
    notes: 'Show aggregate stats. How many people participated, how many messages sent. The presentation itself was the demo.',
    interaction: null,
  },
  {
    id: 'mass-call',
    title: 'Mass Outbound Call',
    act: 4,
    notes: "The big finale demo. Every phone in the room rings simultaneously — connected to the AI bot we just 'built' on stage. Maximum wow factor.",
    interaction: null,
    demoTrigger: 'voice-mass-outbound',
  },
  {
    id: 'closing',
    title: 'letsGoMichelangeloMode();',
    act: 4,
    notes: 'Thank the audience. SMS with link goes out.',
    interaction: null,
    demoTrigger: 'sms-closing',
  },
];

/** Every stage that exists as a presenter component, keyed by id. */
export const STAGE_LIBRARY: Record<string, StageTemplate> = Object.fromEntries(
  templates.map((t) => [t.id, t]),
);

/** Library order — the order DEFAULT_DECK presents them in. */
export const STAGE_LIBRARY_ORDER: string[] = templates.map((t) => t.id);
