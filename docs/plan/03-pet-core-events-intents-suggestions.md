# Deliverable 03: Pet Core Event/Intent/Suggestion Contracts

**Deliverable ID:** `03-pet-core-events-intents-suggestions`  
**Status:** `not_started`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `02-architecture-capability-registry`, `02b-extension-framework-and-pack-sdk`  
**Blocks:** `04-openclaw-bridge-spec`, `07-state-system-extension-guide`, `08-test-and-acceptance-matrix`  
**Verification Gate:** `Pet core contracts are fully typed/directionally consistent and at least one runtime event-intent-suggestion pipeline slice is implemented and visible`

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
  - `MEDIA { playing, title, artist, confidence, source }`
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
  - `PET_ANNOUNCEMENT { reason, text, channel, priority, correlationId }`
- State awareness contracts:
  - `PET_STATE_CHANGED { fromState, toState, reason, ts }`
  - `STATE_CONTEXT_SNAPSHOT { state, summary, tags, ts }`
- Extension interaction events:
  - `EXT_PROP_SPAWNED`
  - `EXT_PROP_PLACED`
  - `EXT_PROP_INTERACTED`
  - `EXT_PROP_DRAGGED`
- Extension-origin intents:
  - `INTENT_PROP_FOCUS`
  - `INTENT_EXTENSION_STATE_ENTER`
  - `INTENT_PROP_INTERACTION`
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
- State transition authority remains local/deterministic and must not block on OpenClaw responses.

## Implementation Breakdown
1. Specify schema fields and required metadata.
2. Define producer/consumer for each contract.
3. Define idempotency/retry expectations.
4. Define ordering guarantees and timeout semantics.
5. Define backward-compatible evolution strategy.
6. Define canonical introspection payload fields:
   - Narrative mode context (`currentState`, `mood`, `currentMedia`, `recentHobby`).
   - Technical mode context (`currentState`, `lastSensorEvent`, `activeJobs`).
7. Define `MEDIA.source` enum and baseline expectation (`GSMTC` on Windows when available).
8. Define required context fields for bridge-bound requests:
   - `currentState`
   - `stateContextSummary` (bounded, optional when unavailable)
   - `activePropsSummary` (bounded, optional when unavailable)
   - `source` (`online` or `offline`)
9. Define arbitration priority insertion rules for extension-origin intents vs core/runtime intents.

## Verification Gate
Pass when all are true:
1. No ambiguous ownership of contract producers.
2. Contract examples exist for all core flows.
3. Contracts support degraded mode.
4. Schema evolution rules are documented.
5. Baseline state transitions and priority policy are represented with examples.
6. Sensor event contracts include media + idle + time-of-day + user command examples.
7. Conversation and introspection contracts cover both online (OpenClaw available) and degraded (offline/text-first) modes.
8. Proactive pet announcement contract is documented with bounded trigger classes and cooldown semantics.
9. Bridge-bound request schemas include read-only state awareness fields with offline-safe defaults.
10. Extension interaction events/intents and arbitration insertion rules are documented with ownership boundaries.
11. Runtime includes at least one implemented normalized event pipeline reaching deterministic state or UI output.
12. Runtime logs/output expose correlation IDs through one end-to-end flow.

## Tangible Acceptance Test (Doc-Level)
1. Contract examples include at least one full flow: `MEDIA.playing=true` -> state-intent path -> suggestion output.
2. Reviewer can locate and validate one example for each baseline state.
3. Reviewer can trace one complete dialogue flow in both modes:
   - OpenClaw online (`USER_MESSAGE` -> `PET_RESPONSE` + optional `VOICE_OUTPUT`)
   - OpenClaw offline (local fallback response via chat/bubble path)
4. Reviewer can validate one proactive message flow (`PET_ANNOUNCEMENT`) from trigger -> rendered bubble/chat output.
5. Reviewer can validate one state-awareness flow (`PET_STATE_CHANGED` -> bridge payload includes `currentState` and bounded context).
6. Reviewer can validate one extension prop flow (`EXT_PROP_SPAWNED` -> `INTENT_PROP_FOCUS` -> arbitration decision -> state transition intent).

## Implementation Slice (Mandatory)
- Implement event bus primitives (or equivalent routing layer) for events/intents/suggestions.
- Implement at least one normalized event source (for example `USER_COMMAND` or `MEDIA`) wired to a deterministic intent.
- Implement one suggestion output path to renderer/chat/bubble or diagnostic output with correlation ID.
- Implement bounded cooldown/debounce behavior for one proactive message class.

## Visible App Outcome
- Triggering a supported event produces a visible/logged intent transition and output response.
- Correlation ID appears across at least event + intent + output log entries.
- Offline/degraded mode still produces deterministic fallback output.

## Implementation Verification (Manual)
1. Trigger one supported event path and confirm event -> intent -> suggestion chain in logs/output.
2. Confirm state transition or visible output aligns with documented priority/ownership rules.
3. Disable upstream dependency and confirm degraded fallback path still emits deterministic output.
4. Confirm cooldown/debounce prevents spam for proactive message trigger class.

## Gate Status
- `Doc Gate`: `not_started`
- `Implementation Gate`: `not_started`
- `Overall`: `not_started`

## Open Questions
- Should suggestions carry explicit expiry and confidence defaults globally?

## Change Log
- `2026-02-26`: File created and seeded.
- `2026-02-26`: Updated for `spec + implementation slice` workflow with mandatory implementation/visible outcome sections and dual-gate status.
