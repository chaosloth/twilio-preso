# Twilio Preso

An interactive presentation platform where the presentation itself is the demo. Audience members register via QR code on their phones and participate in real-time polls, text prompts, SMS messages, and AI-powered voice calls — all orchestrated live on stage using Twilio APIs.

## Architecture

This is a pnpm monorepo with five packages:

| Package | Stack | Purpose |
|---------|-------|---------|
| `presenter` | React + React Three Fiber + GSAP | 3D stage visuals shown on the big screen |
| `audience` | React + Tailwind | Mobile web app for audience participation |
| `backend` | Fastify + Twilio SDK | API server, Twilio Sync state management, SMS/Voice orchestration |
| `conversation-relay` | WebSocket + Anthropic Claude | AI voice agent via Twilio ConversationRelay |
| `shared` | TypeScript | Stage definitions, types, and interfaces shared across packages |

## How It Works

The presentation is structured into 21 stages across 4 acts. Twilio Sync keeps the presenter, audience, and backend in lockstep:

1. **Audience registers** by scanning a QR code and entering their details
2. **Presenter advances stages** — Sync broadcasts state changes to all connected clients
3. **Interactions fire** at specific stages: polls, free-text prompts, SMS triggers, and voice calls
4. **Demo triggers** send real Twilio messages/calls to the audience mid-presentation (e.g. personalized SMS using their earlier responses, mass outbound AI voice calls)

## Prerequisites

- Node.js 20+
- pnpm
- A Twilio account with Sync, Verify, Messaging, and Voice configured
- An Anthropic API key (for the ConversationRelay AI agent)

## Setup

```bash
pnpm install
cp .env.example .env
# Fill in your Twilio credentials and Anthropic API key
```

## Development

```bash
# Run everything (backend + presenter + audience + conversation-relay)
pnpm dev

# Or run individually
pnpm dev:backend      # Fastify API on :3001
pnpm dev:presenter    # Vite dev server (stage display)
pnpm dev:audience     # Vite dev server (mobile audience app)
pnpm dev:relay        # ConversationRelay WebSocket server on :3003
```

## Deployment

The backend is deployed to [Fly.io](https://fly.io) in the `syd` region. The audience app is built as static files served alongside it. The presenter runs locally on the stage machine.

```bash
pnpm build
fly deploy
```

## Environment Variables

See `.env.example` for the full list. Key variables:

- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` — primary Twilio credentials
- `TWILIO_SYNC_SERVICE_SID` — powers real-time state sync
- `TWILIO_MESSAGING_SERVICE_SID` — for SMS triggers
- `ANTHROPIC_API_KEY` — Claude-powered voice agent
- `PRESENTER_PHONE` — phone number for live call handoff on stage
