# Twilio SIGNAL World Tour Interactive Presentation

## Overview

An interactive, cinematic presentation tool for the Twilio SIGNAL World Tour 2026. The presentation runs inside a continuous Three.js 3D environment where audience members participate in real-time via their phones, triggering live Twilio API demos that demonstrate Conversation Memory, Intelligence, Agent Connect, and Orchestrator to a contact centre professional audience.

Presenters: Christopher Connolly (Director, Solutions Engineering, Twilio APJ) and Nicholas Kontopoulos (VP Marketing, Twilio APJ).

Theme: "Wonder" — reconnecting technology to magic through builders.

## System Architecture

Three independent components communicating via Twilio Sync:

### 1. Presenter App (Stage Display)

The primary visual output rendered on the projector/screen. A full-screen React Three Fiber application where the entire presentation lives inside a 3D WebGL canvas.

- React 19 + Vite
- React Three Fiber as the primary rendering engine
- @react-three/drei (Text, Html, Environment, Effects)
- @react-three/postprocessing (bloom, DOF, vignette, chromatic aberration)
- GSAP for timeline sequencing within stages
- Zustand for state management
- troika-three-text for SDF text rendering
- 16:9 locked aspect ratio, full-screen mode
- Keyboard/remote-controlled navigation

### 2. Audience App (Mobile Web)

Lightweight responsive web app accessed via QR code scan.

- React + Vite (minimal bundle)
- Tailwind CSS for mobile-first styling
- Twilio Sync client SDK for real-time state synchronization
- Collects registration (name, phone, company, role)
- Shows interaction prompts pushed by presenter
- Receives Twilio SMS/WhatsApp messages as part of demo flow

### 3. Backend Server

Manages sessions, bridges presenter and audience, integrates Twilio APIs.

- Node.js + Fastify
- Twilio Sync SDK — real-time state synchronization between presenter, audience, and backend. Dogfoods Twilio's own product.
  - **Sync Streams** — publish events to all connected endpoints (audience responses, interaction triggers, stage advance commands). Fire-and-forget broadcast pattern for high-throughput event flow.
  - **Sync Documents** — shared mutable state (current stage index, active interaction config, aggregate results)
  - **Sync Maps** — audience session registry (keyed by participant ID, stores name, phone, responses)
- Twilio Node SDK (SMS, Voice, Conversations APIs)
- In-memory state (no database — live presentation context only)
- Aggregates audience data for real-time 3D visualizations

### 4. ConversationRelay Server

WebSocket server that handles the AI voice bot conversation during the mass outbound call demo.

- Node.js WebSocket server
- Receives audio/text events from Twilio ConversationRelay
- Looks up the caller by phone number (from Sync Map) to personalize the conversation
- Connects to an LLM (e.g., OpenAI or Anthropic) for conversational responses
- Returns text responses that Twilio converts to speech
- Demonstrates how fast you can deploy a voice AI agent with Twilio

### 5. Presenter Notes Window

Pop-out browser window on the presenter's laptop, synced to current stage.

- Same React app, different route, opened via window.open()
- Synced via BroadcastChannel API (zero-latency, no server round-trip)
- Shows: current stage name, speaker notes, next stage preview, timer, audience stats, manual interaction triggers, skip-to-stage controls

## 3D Visual Design

### Rendering Approach

The entire presentation exists within Three.js. Slides are "stages" — 3D scenes the camera navigates between along a defined spline path. This is not DOM slides with 3D effects; it is a 3D world with content embedded in it.

### Visual Language

Derived from the Twilio corporate template (dark mode, March 2026):

- **Environment:** Deep navy/charcoal (#0D1B2A range)
- **Accent:** Twilio red (#F22F46) as glowing geometry, light sources, emphasis
- **Typography:** White, bold, rendered as SDF text meshes — crisp at any camera distance, animatable per-character
- **Signature shape:** The angular "gem" polygon from the corporate template — used as 3D wireframe containers, portals, frames
- **Photography:** Textured planes with parallax depth, soft glow edges, floating in space
- **Post-processing:** Bloom, depth of field, chromatic aberration for filmic quality

### Stage Types

1. **Hero stages** — dramatic 3D environments (particle fields, floating geometry, camera fly-throughs) for opening, product reveals, closing
2. **Content stages** — data/text rendered as floating panels in 3D space with depth, parallax, animated entrances
3. **Interactive stages** — audience data drives visuals: particles spawn per participant, geometry morphs in real-time, names float through space
4. **Demo stages** — Twilio product UI shown alongside 3D environment, triggered by live audience actions

### Transitions

Camera dolly along a spline path. Between stages: fog/depth transitions, particle dissolves, or portal fly-throughs using the Twilio gem shape.

### Performance

- LOD system — reduce particle counts and geometry complexity if frame rate drops
- Instanced meshes for repeated elements (audience name particles, data points)
- Offscreen stages culled from render pipeline
- Target: 60fps on a modern laptop with dedicated GPU

## Audience Interaction System

### Registration Flow

1. QR code displayed on intro stage links to audience web app
2. Audience enters their mobile phone number
3. Backend validates the number using **Twilio Lookup API** (confirms valid format, carrier info)
4. Backend sends an OTP via **Twilio Verify** to the number
5. Audience enters the OTP code to verify ownership
6. Once verified, audience provides name (and optionally company/role)
7. Backend creates session — participant is "live" and their verified phone number is stored for later demos
8. Participant presence feeds into 3D scene (particle count, floating name)

### Interaction Types

| Type | Audience sees | Stage shows |
|------|--------------|-------------|
| Poll | Multiple choice on phone | 3D bar chart / particle clusters forming in real-time |
| Text input | Free-form text field | Word cloud as 3D floating text, names streaming through space |
| Trigger | "Ready?" confirmation | Twilio sends SMS/WhatsApp/voice call live |
| Sentiment | Emoji/slider reaction | Color shifts in environment, particle mood changes |

### Interaction Lifecycle

1. Presenter advances to an interactive stage — stage index updated in a Sync Document
2. Backend publishes interaction prompt to a Sync Stream — all audience clients receive it
3. Audience responses published back via Sync Stream — presenter app subscribes and receives each event
4. Backend listens to the same stream, aggregates results, updates a Sync Document with running totals
5. Presenter app reacts to both: individual stream events (spawn particles per response) and document updates (aggregate visualizations)

## Twilio Product Demo Moments

| Narrative moment | Twilio product | Audience experience |
|---|---|---|
| "Patience is running low" (Act 2) | SMS/Messaging | Audience receives SMS: "You've been waiting 7 minutes..." — feel the problem |
| Conversation Orchestrator (Act 3) | Conversations API | WhatsApp message that references earlier SMS — cross-channel continuity |
| Conversation Memory (Act 3) | Conversation Memory API | Personalized SMS referencing their earlier text input by name |
| Conversation Intelligence (Act 3) | Conversation Intelligence API | Live sentiment/intent analysis of audience responses displayed in 3D |
| Agent Connect (Act 3) | Agent Connect / Voice | Volunteer gets AI voice call that hands off to presenter on stage |
| "Mass outbound call" (Act 4) | Voice / Agent Connect | Every audience member gets a simultaneous outbound call from an AI bot built live during the talk |
| Closing (Act 4) | All products | Final personalized SMS follow-up referencing all their interactions |

## Stage-by-Stage Narrative (18 Stages)

### ACT 1: "The Invisible Extraordinary"

**Stage 1 — Opening / QR Registration**
- Scene: Dark void, single Twilio gem polygon glowing, particles slowly emerging. QR code floats in space.
- Interaction: Audience scans, registers. Particles spawn per registration.

**Stage 2 — Speakers Intro**
- Scene: Camera pulls back revealing speaker photos as textured planes flanking the gem. Titles animate as SDF text.
- Interaction: Registration count glows beneath.

**Stage 3 — "Why Wonder?"**
- Scene: Camera flies into the gem (portal transition) into a vast particle field representing invisible technology.
- Interaction: None.

**Stage 4 — Wonder Story Arc**
- Scene: Six floating monoliths in a circle, each a story chapter. Camera orbits. Text labels emerge.
- Interaction: None.

### ACT 2: "The Problem"

**Stage 5 — "Who's getting on customers' nerves?"**
- Scene: Chaotic red particle storm — colliding, fragmenting.
- Interaction: Poll — "What frustrates YOUR customers most?" Results form 3D bar chart.

**Stage 6 — Patience Deficit**
- Scene: Floating clock geometry. Numbers materialize (+1 min, +7 min). Time dilation visual.
- Interaction: SMS Demo #1 — audience receives "You've been on hold for 7 minutes. Still waiting..."

**Stage 7 — "Think in channels"**
- Scene: Three glowing doors floating in space. Camera approaches.
- Interaction: None.

**Stage 8 — "The result is siloes"**
- Scene: Doors slam shut. Environment fractures into disconnected floating islands per channel.
- Interaction: None.

**Stage 9 — "Customers are..."**
- Scene: Frustrated silhouettes on each island calling across the void. Red particle streams blocked.
- Interaction: Text input — "In one word, describe your biggest CX challenge." Words form 3D word cloud.

### ACT 3: "The Solution"

**Stage 10 — "You're orchestrating the journey"**
- Scene: Camera rises above islands. Conductor silhouette appears. Red threads connect islands.
- Interaction: None.

**Stage 11 — Twilio Conversations Overview**
- Scene: Four products materialize as glowing pillars: Orchestrator, Memory, Intelligence, Agent Connect. Camera orbits.
- Interaction: None (hero reveal).

**Stage 12 — Conversation Orchestrator**
- Scene: Camera dives into first pillar. Continuous flowing thread — messages morph along a single glowing line.
- Interaction: SMS Demo #2 — WhatsApp message referencing earlier SMS.

**Stage 13 — Conversation Memory**
- Scene: Brain-like neural mesh, nodes lighting up. Customer profile floats with traits populating.
- Interaction: Personalized SMS: "Hey [name], you said '[their word]' was your biggest challenge."

**Stage 14 — Conversation Intelligence**
- Scene: Live waveform visualization. Text streams annotated with sentiment colors, intent labels.
- Interaction: Live analysis of word cloud responses from stage 9 — sentiment breakdown, intent clustering in 3D.

**Stage 15 — Agent Connect**
- Scene: AI agent avatars (abstract geometry) connecting to channel icons. Multiple LLM logos flowing into Twilio mesh.
- Interaction: Volunteer gets AI voice call, handoff to presenter on stage.

### ACT 4: "Building for Wonder"

**Stage 16 — "Innovation: wild ideas to results"**
- Scene: All pillars merge into Twilio logo. Audience registration particles stream into it.
- Interaction: Poll — "Which product are you most excited to explore?" Pillars glow proportionally.

**Stage 17 — "It's never been easier"**
- Scene: Camera pulls back. Full connected landscape — islands bridged, particles flowing, gem polygon encasing everything.
- Interaction: Aggregate stats: participants, interactions, messages sent during the talk.

**Stage 18 — "Mass Outbound Call"**
- Scene: Phone icons radiate outward from center in a burst pattern. A pulsing ring expands. Every audience member's phone rings simultaneously.
- Interaction: Mass outbound call to all registered participants connecting them to an AI bot. The bot was "just built" on stage — demonstrating how fast you can deploy with Twilio.

**Stage 19 — "letsGoMichelangeloMode();"**
- Scene: Code text in 3D space, cursor blinking. Environment pulses. Final QR for resources.
- Interaction: Final personalized SMS follow-up referencing all their responses. Memory in action one last time.

## Deployment

**Recommended topology for the world tour:**

- **Presenter App:** Runs locally on the stage machine (laptop). Built static files served by a local dev server. Ensures zero-latency 3D rendering independent of network.
- **Backend Server:** Cloud-hosted (Railway, Fly.io, or similar). Audience connects via internet (cellular or WiFi). Eliminates dependency on venue WiFi for the audience<>backend link.
- **Audience App:** Static files hosted alongside the backend (same domain). Accessed via QR code pointing to the cloud URL.
- **Twilio APIs:** Always cloud-to-cloud from the backend.

This means the presenter machine only needs internet access for the Twilio Sync connection — minimal bandwidth, resilient to poor venue WiFi.

## Tech Stack Summary

| Component | Stack |
|-----------|-------|
| Presenter 3D | TypeScript, React 19, Vite, React Three Fiber, drei, postprocessing, GSAP, Zustand, troika-three-text |
| Audience App | TypeScript, React 19, Vite, Tailwind CSS, Twilio Sync SDK |
| Presenter Notes | Same app as presenter, BroadcastChannel sync |
| Backend | TypeScript, Node.js, Fastify, Twilio SDK (Sync, SMS, Voice, Conversations) |
| Language | TypeScript throughout (strict mode) |
| Deployment | Cloud backend (Railway/Fly), local presenter app |

## Design Constraints

- TypeScript strict mode across all packages (presenter, audience, backend). Shared types for Sync document schemas and event payloads in a common package.
- Must work across variable venue sizes (50-200 people, skewing medium)
- Must degrade gracefully if audience WiFi/cellular is poor (3D show continues regardless, interactions are enhancement not requirement)
- Presenter app must maintain 60fps on a modern laptop with dedicated GPU
- Audience app must work on any modern mobile browser without app install
- All Twilio demos must use real APIs with real phone numbers (no mocks)
- Content must be easily updatable for different tour stops (stage content defined in data, not hardcoded in 3D scenes)
