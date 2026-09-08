/**
 * A ConversationRelay client, for debugging without a phone.
 *
 * The real loop — place a call, wait for it to ring, speak, read Twilio's logs —
 * is a minute per iteration and tells you almost nothing when it fails. This
 * speaks the same WebSocket protocol Twilio speaks: it sends a `setup` frame
 * built to look like a real call, then whatever prompts you type, and prints
 * every frame the agent sends back with its timing. Latency, malformed messages,
 * sentinels leaking into speech, and turn limits are all visible here.
 *
 *   pnpm --filter @twilio-preso/conversation-relay simulate \
 *     --url ws://localhost:3003 --session <sessionId> --from +61400000000
 *
 * Add `--say "hello"` (repeatable) to run non-interactively, or omit it and type
 * at the prompt. `--inbound=false` simulates the outbound finale instead, which
 * is where the three-turn limit and the hang-up live.
 */
import { createInterface } from 'node:readline/promises';
import WebSocket from 'ws';

interface Args {
  url: string;
  session: string;
  from: string;
  to: string;
  inbound: boolean;
  say: string[];
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    url: process.env.RELAY_URL || 'ws://localhost:3003',
    session: '',
    from: '+61400000001',
    to: '+61400000002',
    inbound: true,
    say: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inlineValue] = argv[i].split('=');
    const value = inlineValue ?? argv[++i];
    switch (flag) {
      case '--url': args.url = value; break;
      case '--session': args.session = value; break;
      case '--from': args.from = value; break;
      case '--to': args.to = value; break;
      case '--inbound': args.inbound = value !== 'false'; break;
      case '--say': args.say.push(value); break;
      default: console.warn(`Ignoring unknown flag ${flag}`);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const ws = new WebSocket(args.url);

/** When the last prompt was sent, so the wait before the first spoken word —
 *  the thing that felt slow on the real call — is measured, not guessed. */
let promptSentAt = 0;
let firstTokenLogged = false;
/** Resolved when the agent ends the session, so a scripted run stops there. */
let ended: (() => void) | undefined;

ws.on('open', () => {
  console.log(`→ connected to ${args.url}`);
  // The field names are Twilio's own. `direction` decides which end of the call
  // the pool number is, so getting it wrong here silently tests the wrong path.
  send({
    type: 'setup',
    sessionId: `VX${Date.now()}`,
    callSid: `CA${Date.now()}`,
    from: args.inbound ? args.from : args.to,
    to: args.inbound ? args.to : args.from,
    direction: args.inbound ? 'inbound' : 'outbound-api',
    callStatus: 'in-progress',
    customParameters: args.session ? { sessionId: args.session } : {},
  });
});

ws.on('message', (data) => {
  const raw = data.toString();
  let frame: any;
  try {
    frame = JSON.parse(raw);
  } catch {
    console.log(`← (not JSON) ${raw}`);
    return;
  }

  if (frame.type === 'text') {
    const elapsed = promptSentAt ? `${Date.now() - promptSentAt}ms` : '—';
    const marker = !firstTokenLogged && promptSentAt ? ` [first token after ${elapsed}]` : '';
    firstTokenLogged = true;
    console.log(`← text${frame.last ? ' (last)' : ''}: ${JSON.stringify(frame.token)}${marker}`);
    if (frame.token && /\[\[/.test(frame.token)) {
      console.error('   ⚠ a tool sentinel reached the caller — this would be spoken aloud');
    }
    for (const key of Object.keys(frame)) {
      if (!['type', 'token', 'last', 'lang', 'interruptible', 'preemptible'].includes(key)) {
        console.error(`   ⚠ unknown attribute "${key}" — Twilio discards this message (64107)`);
      }
    }
  } else if (frame.type === 'end') {
    console.log(`← end: ${frame.handoffData}`);
    ended?.();
  } else {
    console.log(`← ${raw}`);
  }
});

ws.on('close', (code) => {
  console.log(`→ closed (${code})`);
  process.exit(0);
});
ws.on('error', (err) => {
  console.error('→ socket error:', err.message);
  process.exit(1);
});

function send(frame: Record<string, unknown>): void {
  console.log(`→ ${frame.type}: ${JSON.stringify(frame).slice(0, 200)}`);
  ws.send(JSON.stringify(frame));
}

function prompt(text: string): void {
  promptSentAt = Date.now();
  firstTokenLogged = false;
  send({ type: 'prompt', voicePrompt: text, lang: 'en-AU', last: true });
}

async function run(): Promise<void> {
  await new Promise<void>((resolve) => ws.once('open', resolve));
  // The greeting is generated at setup; give it a moment before talking over it.
  await new Promise((r) => setTimeout(r, 2500));

  if (args.say.length) {
    for (const line of args.say) {
      prompt(line);
      await new Promise((r) => setTimeout(r, 6000));
    }
    // The agent hangs up *after* its goodbye has had time to be spoken, so
    // closing at the last prompt would hide the one message that ends the call.
    console.log('→ waiting up to 20s for the agent to hang up…');
    await Promise.race([
      new Promise<void>((resolve) => ws.once('close', () => resolve())),
      new Promise<void>((resolve) => { ended = resolve; }),
      new Promise((r) => setTimeout(r, 20000)),
    ]);
    ws.close();
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('Type a prompt and press enter. "/interrupt <heard so far>" or "/quit".');
  for (;;) {
    const line = (await rl.question('you> ')).trim();
    if (!line) continue;
    if (line === '/quit') break;
    if (line.startsWith('/interrupt')) {
      send({
        type: 'interrupt',
        utteranceUntilInterrupt: line.slice('/interrupt'.length).trim(),
        durationUntilInterruptMs: 1200,
      });
      continue;
    }
    prompt(line);
  }
  rl.close();
  ws.close();
}

void run();
