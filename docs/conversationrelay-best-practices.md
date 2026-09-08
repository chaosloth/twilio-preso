# ConversationRelay best practices — notes and what this repo does

Source: <https://www.twilio.com/docs/voice/conversationrelay/best-practices>, checked 2026-09-08.
Kept as notes rather than prose in CLAUDE.md because most of it was already true here; what
follows is the audit, so the next person can see which lines are load-bearing and which were gaps.

## Already satisfied

| Practice | Where |
|---|---|
| **Stream the reply.** Send partial tokens as `{type:'text', last:false}` and close the turn with `last:true`, so TTS starts before the model finishes. | `packages/conversation-relay/src/handler.ts` — every turn goes out through `SentinelSafeStream`; a buffered `complete()` was the pause the first real call had. |
| **Keep replies short and speakable.** | `DEFAULT_RELAY_CONFIG.systemPrompt` |
| **Monitor errors.** The `error` event carries `description`, not `errorMessage`. | Reading the wrong field is why the only log line was `ConversationRelay error: undefined`. |
| **Handle interruptions.** Trim the assistant turn to what was actually spoken. | `interrupt` → `utteranceUntilInterrupt`; `reportInputDuringAgentSpeech` follows `interruptible` because a streamed turn is several `text` messages. |
| **Give each language its own voice** (and, here, its own ASR provider — `<Language>` inherits neither from the parent). | `packages/shared/src/relayConfig.ts` `resolvedLanguages`, `packages/shared/src/languages.ts` |
| **Choose the ASR provider and model deliberately**; leave the speech model unpinned so Twilio matches one per language. | Voice tab dropdowns; `speechModel: ''` |
| **Never let a failed turn become silence.** | `turnTail` speaks a stumble line; `requireTokens` turns an empty stream into an error. |

## Gaps, now closed

1. **`elevenlabsTextNormalization`** — `off` | `auto` | `on`, Twilio's default `off`. Decides whether
   the TTS reads "$20.50" and "Dr." as the words a person would say. Now `RelayConfig.textNormalization`,
   shipped `off`: normalization runs before a single word is spoken, and this is a live demo where the
   pause is the thing an audience notices. Emitted **only beside an ElevenLabs voice** — the other
   providers ignore it, and an attribute describing a pairing that does not exist is noise in the TwiML.
2. **`intelligenceService`** — a Conversation Intelligence (classic) service sid or unique name;
   set it and Twilio attaches transcripts and operators to every call the agent takes. Now
   `RelayConfig.intelligenceService`, blank by default and **omitted entirely** when blank: an empty
   attribute is a 64101 that fails the call, not an unused feature.
3. **Normalization in the prompt, not only in the provider.** The model writes the words TTS reads, so
   asking it for "twenty dollars fifty" and "Doctor" is the one mechanism that also works on Google and
   Amazon voices — and it costs no latency. A paragraph in `DEFAULT_RELAY_CONFIG.systemPrompt`.

Both attributes are per-session (voice tab → `PUT /api/sessions/:id/relay`), like every other knob,
and validated in `resolveRelayConfig` rather than trusted from the record.
