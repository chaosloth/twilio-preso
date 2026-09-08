import type { InteractionConfig } from './types.js';
import type { CanvasElement } from './canvas.js';

/**
 * Every demo trigger the backend knows how to fire. Named so that deck
 * overrides and the backend's trigger switch share one definition.
 */
export const DEMO_TRIGGER_IDS = [
  'sms-patience',
  'sms-orchestrator',
  'sms-memory',
  // The same four messages over WhatsApp. A `whatsapp-` trigger falls back to
  // SMS per recipient when WhatsApp cannot deliver — an unset sender, an
  // attendee outside the 24-hour window — so choosing one never risks the
  // message not arriving. Kept as separate ids rather than a channel flag so a
  // deck records which channel the talk demonstrates on that slide.
  'whatsapp-patience',
  'whatsapp-orchestrator',
  'whatsapp-memory',
  'whatsapp-closing',
  'intelligence-analysis',
  'voice-agent-connect',
  'voice-mass-outbound',
  'sms-closing',
] as const;

export type DemoTriggerId = (typeof DEMO_TRIGGER_IDS)[number];

/** What kind of editor the HUD offers for a slot. */
export type SlotKind = 'text' | 'multiline' | 'image';

/**
 * One editable piece of a stage: a headline, a caption, an image URL. The
 * template names the slot and carries the copy that shipped as its default, so
 * a stage stays exactly as designed until someone edits it.
 */
export interface SlotDef {
  key: string;
  label: string;
  kind: SlotKind;
  default: string;
}

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
  /** Editable copy and images. Absent means the component has no editable slots yet. */
  slots?: SlotDef[];
  /** Stage ids whose responses this stage's trigger reads. Drives validation. */
  dependsOn?: string[];
  /**
   * Free-form elements the template ships with. A template that declares this
   * (even as `[]`) is canvas-editable from the start; any other stage becomes
   * canvas-editable the moment a deck stage adds elements to it.
   */
  canvas?: CanvasElement[];
  /**
   * An empty starting point for the slide editor rather than presentation
   * content. Offered in the library, excluded from DEFAULT_DECK — a blank slide
   * in the shipped deck is a black screen partway through the talk.
   */
  blank?: boolean;
}

const templates: StageTemplate[] = [
  // ACT 1
  {
    id: 'opening',
    title: 'Opening / QR Registration',
    act: 1,
    notes: 'Welcome audience. QR code is displayed. Encourage scanning. Wait for registration count to build.',
    interaction: null,
    slots: [
      { key: 'presenter', label: 'Presenter name', kind: 'text', default: 'Christopher Connolly' },
      { key: 'presenterRole', label: 'Presenter role', kind: 'text', default: 'Director, Solutions Engineering, Twilio APJ' },
      { key: 'headline', label: 'Headline', kind: 'text', default: 'Scan to Join' },
      { key: 'subhead', label: 'Sub-headline', kind: 'text', default: 'Be part of the live demo' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  // The three mandatory polls. Deliberately first, before any other
  // interaction: they choose the brand, the palette and the OTP channel that
  // the rest of the talk — and every outbound message — is built around, so
  // they have to be answered before anything downstream is shown. Each answer
  // is written to the attendee's `live-presentation` trait group as well as to
  // Sync, which is what lets a later session recognise their choices.
  {
    id: 'brand-poll',
    title: 'Brand Name',
    act: 1,
    notes: 'Mandatory poll. Which brand are we building for? TwilioCupcakes or TwilioTours.',
    interaction: {
      stageId: 'brand-poll',
      type: 'poll',
      prompt: 'Which brand are we building today?',
      options: ['Cup Cakes Store', 'Guided Tour Package'],
    },
    slots: [
      { key: 'headline', label: 'Question', kind: 'multiline', default: 'Which brand are we building today?' },
      { key: 'waiting', label: 'Waiting prompt', kind: 'text', default: 'Check your phone to vote' },
      { key: 'waitingHint', label: 'Waiting hint', kind: 'text', default: 'Results will appear here in real-time' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'theme-poll',
    title: 'Theme',
    act: 1,
    notes: 'Mandatory poll. Which palette the build takes on.',
    interaction: {
      stageId: 'theme-poll',
      type: 'poll',
      prompt: 'Pick the theme',
      options: ['Modern Sunset (Red)', 'Nordic Forest (Green)'],
    },
    slots: [
      { key: 'headline', label: 'Question', kind: 'multiline', default: 'Pick the theme' },
      { key: 'waiting', label: 'Waiting prompt', kind: 'text', default: 'Check your phone to vote' },
      { key: 'waitingHint', label: 'Waiting hint', kind: 'text', default: 'Results will appear here in real-time' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'otp-poll',
    title: 'Default OTP Method',
    act: 1,
    notes: 'Mandatory poll. Which channel one-time passcodes go out on.',
    interaction: {
      stageId: 'otp-poll',
      type: 'poll',
      prompt: 'How should we send your one-time passcode?',
      options: ['SMS/RCS', 'WhatsApp'],
    },
    slots: [
      { key: 'headline', label: 'Question', kind: 'multiline', default: 'How should we send your one-time passcode?' },
      { key: 'waiting', label: 'Waiting prompt', kind: 'text', default: 'Check your phone to vote' },
      { key: 'waitingHint', label: 'Waiting hint', kind: 'text', default: 'Results will appear here in real-time' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
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
    slots: [
      { key: 'headline', label: 'Question', kind: 'multiline', default: 'How much patience do you have for bad Customer Experience?' },
      { key: 'waiting', label: 'Waiting prompt', kind: 'text', default: 'Check your phone to vote' },
      { key: 'waitingHint', label: 'Waiting hint', kind: 'text', default: 'Results will appear here in real-time' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'speakers',
    title: 'Speakers Intro',
    act: 1,
    notes: 'Introduce Nicholas and Christopher. Mention roles and the "Wonder" theme.',
    interaction: null,
    slots: [
      { key: 'headline', label: 'Headline', kind: 'text', default: 'Wonder' },
      { key: 'subhead', label: 'Sub-headline', kind: 'text', default: 'Connecting technology to imagination' },
      { key: 'badge', label: 'Badge', kind: 'text', default: 'Twilio World Tour 2026' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'why-wonder',
    title: 'Why Wonder?',
    act: 1,
    notes: 'Technology once inspired awe. Wonder reconnects tech to imagination. Builders are the magic makers.',
    interaction: null,
    slots: [
      { key: 'headline', label: 'Headline', kind: 'text', default: 'Why Wonder?' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'story-arc',
    title: 'Topics for Today',
    act: 1,
    notes: 'Overview of the topics we will cover today.',
    interaction: null,
    slots: [
      { key: 'headline', label: 'Headline', kind: 'text', default: 'Topics for today' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
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
    slots: [
      { key: 'headline', label: 'Question', kind: 'multiline', default: 'What\'s getting on YOUR\ncustomers nerves the most?' },
      { key: 'waiting', label: 'Waiting prompt', kind: 'text', default: 'Check your phone to vote' },
      { key: 'waitingHint', label: 'Waiting hint', kind: 'text', default: 'Results will appear here in real-time' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'patience-deficit',
    title: 'Patience Deficit',
    act: 2,
    notes: "If you're in line with the cross-industry average, you're probably taking a full minute longer than customers expect to resolve financial disputes.\n\nAnd seven minutes longer than customers expect when troubleshooting.",
    interaction: null,
    demoTrigger: 'sms-patience',
    slots: [
      { key: 'headline', label: 'Headline', kind: 'text', default: 'The Patience Deficit' },
      { key: 'footnote', label: 'Footnote', kind: 'text', default: 'Source: Decoding Digital Patience Report, Twilio' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'impatient-customers',
    title: 'When Customers Get Impatient',
    act: 2,
    notes: "Now, let's have a look at what happens when we do get on customers' nerves.\n36% try to fix it themselves\n34% jump to another channel\n30% give up altogether",
    interaction: null,
    slots: [
      { key: 'headline', label: 'Headline', kind: 'text', default: 'When customers get impatient…' },
      { key: 'footnote', label: 'Footnote', kind: 'text', default: 'Source: Decoding Digital Patience Report, Twilio' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'think-channels',
    title: 'Think in Channels',
    act: 2,
    notes: 'We have learned to think in channels. Three doors — each a separate silo.',
    interaction: null,
    slots: [
      { key: 'headline', label: 'Headline', kind: 'multiline', default: 'We\'ve learned to think in channels.' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'siloes',
    title: 'The Result is Siloes',
    act: 2,
    notes: 'When the experience is disjointed, customers think twice about repeat purchases.',
    interaction: null,
    slots: [
      { key: 'headline', label: 'Headline', kind: 'multiline', default: 'The result for employees\nand customers is siloes.' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
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
    slots: [
      { key: 'headline', label: 'Question', kind: 'multiline', default: 'In one word, your biggest CX challenge?' },
      { key: 'waiting', label: 'Waiting prompt', kind: 'text', default: 'Check your phone to respond' },
      { key: 'waitingHint', label: 'Waiting hint', kind: 'text', default: 'Words will appear here as they come in' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },

  // ACT 3
  {
    id: 'orchestrating',
    title: "You're Orchestrating the Journey",
    act: 3,
    notes: 'The turn. From chaos to order. The conductor metaphor. Red threads weave the islands together.',
    interaction: null,
    slots: [
      { key: 'headline', label: 'Headline', kind: 'multiline', default: 'What if we could answer every call, text and post?' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'conversations-overview',
    title: 'Twilio Conversations Overview',
    act: 3,
    notes: 'The four pillars materialize. Hero reveal moment. Let the audience absorb each product.',
    interaction: null,
    slots: [
      { key: 'headline', label: 'Headline', kind: 'text', default: 'Twilio Conversations' },
      { key: 'subhead', label: 'Sub-headline', kind: 'multiline', default: 'A foundation for driving customer lifetime value through every interaction' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'orchestrator',
    title: 'Conversation Orchestrator',
    act: 3,
    notes: 'Trigger WhatsApp message. Shows cross-channel continuity — references the earlier SMS.',
    interaction: null,
    demoTrigger: 'sms-orchestrator',
    slots: [
      { key: 'headline', label: 'Headline', kind: 'text', default: 'Introducing Twilio Conversations' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'memory',
    title: 'Conversation Memory',
    act: 3,
    notes: "Trigger personalized SMS using their name and their word from stage 9. The 'wow' moment.",
    interaction: null,
    demoTrigger: 'sms-memory',
    dependsOn: ['customers-are'],
    slots: [
      { key: 'headline', label: 'Headline', kind: 'text', default: 'Conversation Memory' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'intelligence',
    title: 'Conversation Intelligence',
    act: 3,
    notes: 'Show live analysis of the word cloud responses. Sentiment breakdown, intent clustering visualized in 3D.',
    interaction: null,
    demoTrigger: 'intelligence-analysis',
    dependsOn: ['customers-are'],
    slots: [
      { key: 'headline', label: 'Headline', kind: 'text', default: 'Conversation Intelligence' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'agent-connect',
    title: 'Agent Connect',
    act: 3,
    notes: 'Volunteer gets the AI voice call. It handles their question then hands off to you on stage. Pick up the phone dramatically.',
    interaction: null,
    demoTrigger: 'voice-agent-connect',
    slots: [
      { key: 'headline', label: 'Headline', kind: 'text', default: 'Agent Connect' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'mcp-server',
    title: 'Twilio MCP Server',
    act: 3,
    notes: "How did we build all of this so fast? The Twilio MCP server wires your AI coding agent straight into Twilio's full API surface — 1,800+ endpoints across 30+ products. No more tab-switching between docs and your IDE. Search-then-retrieve keeps context lean. No auth, no install — just point your agent at mcp.twilio.com/docs. Public Beta.",
    interaction: null,
    slots: [
      { key: 'headline', label: 'Headline', kind: 'text', default: 'Twilio MCP Server' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
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
    slots: [
      { key: 'headline', label: 'Headline', kind: 'text', default: 'Ask the Agent' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
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
    slots: [
      { key: 'headline', label: 'Question', kind: 'multiline', default: 'Where do you need this to run?' },
      { key: 'waiting', label: 'Waiting prompt', kind: 'text', default: 'Check your phone to vote' },
      { key: 'waitingHint', label: 'Waiting hint', kind: 'text', default: 'Results will appear here in real-time' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'never-easier',
    title: "It's Never Been Easier",
    act: 4,
    notes: 'Show aggregate stats. How many people participated, how many messages sent. The presentation itself was the demo.',
    interaction: null,
    slots: [
      { key: 'headline', label: 'Headline', kind: 'multiline', default: 'It\'s never been easier to build amazing engagement.' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'mass-call',
    title: 'Mass Outbound Call',
    act: 4,
    notes: "The big finale demo. Every phone in the room rings simultaneously — connected to the AI bot we just 'built' on stage. Maximum wow factor.",
    interaction: null,
    demoTrigger: 'voice-mass-outbound',
    slots: [
      { key: 'headline', label: 'Headline', kind: 'multiline', default: 'Imagine being able to speak to all of your customers at once...' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    id: 'closing',
    title: 'letsGoMichelangeloMode();',
    act: 4,
    notes: 'Thank the audience. SMS with link goes out.',
    interaction: null,
    demoTrigger: 'sms-closing',
    slots: [
      { key: 'headline', label: 'Headline', kind: 'multiline', default: 'Thank you for being part of the experience.' },
      { key: 'subhead', label: 'Sub-headline', kind: 'multiline', default: 'We can\'t wait to see what you build with Twilio.' },
      { key: 'image', label: 'Image URL', kind: 'image', default: '' },
    ],
  },
  {
    // Deliberately last and `blank`: it is what you reach for to build a slide
    // that isn't in the library, and it has no scene of its own — everything on
    // it comes from the canvas elements the presenter places.
    id: 'canvas',
    title: 'Blank canvas',
    act: 1,
    notes: 'Free-form slide. Add text and images in the HUD deck editor.',
    interaction: null,
    blank: true,
    canvas: [],
  },
];

/** Every stage that exists as a presenter component, keyed by id. */
export const STAGE_LIBRARY: Record<string, StageTemplate> = Object.fromEntries(
  templates.map((t) => [t.id, t]),
);

/** Library order — the order DEFAULT_DECK presents them in. */
export const STAGE_LIBRARY_ORDER: string[] = templates.map((t) => t.id);

/**
 * The polls the presentation always asks, in the order it asks them. Their
 * answers are stored as declared traits on the attendee's Customer Profile, so
 * these ids are referenced by the backend's trait mapping — renaming one here
 * without renaming it there silently stops the trait being written.
 */
export const MANDATORY_POLL_STAGE_IDS = ['brand-poll', 'theme-poll', 'otp-poll'] as const;
