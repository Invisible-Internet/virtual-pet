# Deliverable 03: Pet Core Event/Intent/Suggestion Contracts

**Deliverable ID:** `03-pet-core-events-intents-suggestions`  
**Status:** `not_started`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `02-architecture-capability-registry`  
**Blocks:** `04-openclaw-bridge-spec`, `07-state-system-extension-guide`, `08-test-and-acceptance-matrix`  
**Verification Gate:** `Pet core contracts are fully typed, directionally consistent, and validated against current runtime constraints`

## Objective
Define deterministic pet-core contracts separating facts, requests, and advisory outputs.

## In Scope
- Event schema.
- Intent schema.
- Suggestion schema.
- Routing direction and ownership.
- Priority/debounce/cooldown contract points.
- Explicit normalized sensor events:
  - `USER_COMMAND { type, payload }`
  - `MEDIA { playing, title, artist, confidence }`
  - `USER_IDLE { idleMs }`
  - `TIME_OF_DAY { bucket }`
- State transition contract coverage for baseline states:
  - `Idle`, `Roam`, `MusicChill`, `MusicDance`, `WatchMode`, `Sleep`
- State priority policy contract:
  - `Sleep > WatchMode > MusicMode > Roam > Idle`
- Roaming mode commands/events:
  - Desktop roaming mode
  - User-defined roam-zone mode
- Introspection request/response contracts:
  - Narrative status
  - Technical status (without raw chain-of-thought exposure)
- Conversation contracts:
  - `USER_MESSAGE { text, channel, correlationId }`
  - `PET_RESPONSE { text, mode, correlationId }`
  - `VOICE_INPUT { transcript, confidence, partial, correlationId }`
  - `VOICE_OUTPUT { text, audioRef|ttsMeta, fallbackMode, correlationId }`
- UI conversation surface contracts:
  - Speech bubble/thought balloon events.
  - Chatbox fallback command/query events.

## Out of Scope
- Full behavior implementation.
- Renderer migration.

## Dependencies
- D02 capability routing model.

## Decisions Locked
- Events represent facts.
- Intents represent work requests.
- Suggestions represent advisory outputs (not direct authority).

## Implementation Breakdown
1. Specify schema fields and required metadata.
2. Define producer/consumer for each contract.
3. Define idempotency/retry expectations.
4. Define ordering guarantees and timeout semantics.
5. Define backward-compatible evolution strategy.

## Verification Gate
Pass when all are true:
1. No ambiguous ownership of contract producers.
2. Contract examples exist for all core flows.
3. Contracts support degraded mode.
4. Schema evolution rules are documented.
5. Baseline state transitions and priority policy are represented with examples.
6. Sensor event contracts include media + idle + time-of-day + user command examples.
7. Conversation and introspection contracts cover both online (OpenClaw available) and degraded (offline/text-first) modes.

## Tangible Acceptance Test (Doc-Level)
1. Contract examples include at least one full flow: `MEDIA.playing=true` -> state-intent path -> suggestion output.
2. Reviewer can locate and validate one example for each baseline state.
3. Reviewer can trace one complete dialogue flow in both modes:
   - OpenClaw online (`USER_MESSAGE` -> `PET_RESPONSE` + optional `VOICE_OUTPUT`)
   - OpenClaw offline (local fallback response via chat/bubble path)

## Open Questions
- Should suggestions carry explicit expiry and confidence defaults globally?

## Change Log
- `2026-02-26`: File created and seeded.
