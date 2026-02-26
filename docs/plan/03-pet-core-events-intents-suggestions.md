# Deliverable 03: Pet Core Event/Intent/Suggestion Contracts

**Deliverable ID:** `03-pet-core-events-intents-suggestions`  
**Status:** `in_progress`  
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

## Contract Metadata Envelope (Draft v1)
All events, intents, and suggestions use a shared metadata envelope:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | `string` | Yes | Stable schema id (for example `USER_COMMAND`). |
| `correlationId` | `string` | Yes | End-to-end trace id across event -> intent -> suggestion. |
| `ts` | `number` | Yes | Unix ms timestamp generated at emission stage. |
| `source` | `online \| offline \| local` | Conditional | Required on bridge-relevant payloads; defaults to `offline` in degraded mode. |
| `payload` | `object` | Yes for events/intents | Bounded object; unknown fields ignored by consumers. |
| `schemaVersion` | `string` | Recommended | Defaults to `1.0` for new producers. |

## Producer/Consumer Ownership (Draft v1)
| Contract | Producer | Consumer | Authority Boundary |
| --- | --- | --- | --- |
| `USER_COMMAND` | Renderer command surface (hotkeys/chat input) via main IPC | Pet contract router | Main process validates and normalizes command intent. |
| `MEDIA` | Sensors capability | Brain/state transition router | Sensors are fact-only; no direct state authority. |
| `USER_IDLE` | Sensors capability | Brain/state transition router | Idle facts may suggest state; local state machine decides. |
| `TIME_OF_DAY` | Sensors capability | Brain/state transition router | Time bucket contributes advisory intent only. |
| `EXT_PROP_INTERACTED` | Extension runtime via core IPC | Pet contract router/arbitrator | Extension events are non-authoritative and pass through core arbitration. |
| `INTENT_*` | Pet contract router + state router | Brain + output mappers | Intents request work; they do not directly mutate renderer state. |
| `PET_RESPONSE` | Pet contract router/output mapper | Dialog UI/speech bubble/chatbox | Suggestion only; display path may degrade to text. |
| `PET_ANNOUNCEMENT` | Pet contract router (cooldown-gated) | Bubble/chat output | Trigger class is bounded + rate-limited. |
| `PET_ANNOUNCEMENT_SKIPPED` | Pet contract router | Diagnostics/trace consumers | Explicitly records deterministic skip behavior. |

## Canonical Contract Slices (Draft v1)
Normalized event examples:

```json
{
  "type": "USER_COMMAND",
  "correlationId": "evt-abc123",
  "ts": 0,
  "payload": {
    "command": "status",
    "text": "status",
    "channel": "hotkey"
  }
}
```

```json
{
  "type": "MEDIA",
  "correlationId": "evt-media-1",
  "ts": 0,
  "payload": {
    "playing": true,
    "title": "Song",
    "artist": "Artist",
    "confidence": 0.92,
    "source": "GSMTC"
  }
}
```

```json
{
  "type": "USER_IDLE",
  "correlationId": "evt-idle-1",
  "ts": 0,
  "payload": {
    "idleMs": 180000
  }
}
```

```json
{
  "type": "TIME_OF_DAY",
  "correlationId": "evt-time-1",
  "ts": 0,
  "payload": {
    "bucket": "night"
  }
}
```

Intent and suggestion examples:

```json
{
  "type": "INTENT_INTROSPECTION_STATUS",
  "correlationId": "evt-abc123",
  "ts": 0,
  "reason": "user_command_status",
  "payload": {
    "command": "status"
  }
}
```

```json
{
  "type": "PET_RESPONSE",
  "correlationId": "evt-abc123",
  "ts": 0,
  "mode": "text",
  "source": "offline",
  "text": "Runtime degraded. Capabilities healthy=3, degraded=1, failed=0."
}
```

```json
{
  "type": "PET_ANNOUNCEMENT",
  "correlationId": "evt-ann-1",
  "ts": 0,
  "reason": "manual_test",
  "priority": "low",
  "channel": "bubble",
  "source": "offline",
  "text": "Manual announcement test from USER_COMMAND."
}
```

```json
{
  "type": "PET_ANNOUNCEMENT_SKIPPED",
  "correlationId": "evt-ann-2",
  "ts": 0,
  "reason": "manual_test",
  "skipReason": "cooldown_active",
  "cooldownMs": 5000,
  "source": "offline"
}
```

Extension interaction slice:

```json
{
  "type": "EXT_PROP_INTERACTED",
  "correlationId": "evt-prop-1",
  "ts": 0,
  "payload": {
    "extensionId": "sample-foodchase",
    "propId": "candy",
    "interactionType": "hotkey"
  }
}
```

## State Priority and Baseline Transition Contract
Baseline priority policy:
- `Sleep > WatchMode > MusicMode > Roam > Idle`

State coverage examples:
| Trigger Event | Candidate Intent | Expected State Outcome | Priority Rule |
| --- | --- | --- | --- |
| `TIME_OF_DAY(bucket=night)` | `INTENT_STATE_SLEEP` | `Sleep` | Highest-priority baseline state when sleep conditions are satisfied. |
| `MEDIA(playing=true, confidence>=0.7)` | `INTENT_STATE_MUSIC_MODE` | `MusicChill` or `MusicDance` | Preempts `Roam`/`Idle`, but not `Sleep`/`WatchMode`. |
| `USER_IDLE(idleMs high)` | `INTENT_STATE_ROAM` | `Roam` | Applies only when higher-priority states are inactive. |
| `USER_COMMAND(type=status)` | `INTENT_INTROSPECTION_STATUS` | No forced state change | Introspection must not mutate authoritative state. |
| `EXT_PROP_INTERACTED` | `INTENT_PROP_INTERACTION` | State unchanged or scoped transition | Requires arbitration before any state transition intent is accepted. |

## Idempotency, Ordering, and Timeout Policy (Draft v1)
- Idempotency:
  - Consumers treat duplicate `correlationId + type` as replay-safe within a bounded in-memory window.
  - Repeated `USER_COMMAND(status)` requests are allowed and produce fresh `PET_RESPONSE` outputs.
- Ordering:
  - Ordering is guaranteed per source queue only; cross-source global ordering is best-effort.
  - Within one pipeline run, trace ordering is strict: `event -> intent -> suggestion`.
- Retry:
  - Event ingestion may retry on transient IPC errors; retries preserve `correlationId`.
  - Suggestion emitters are at-most-once for proactive announcements due to cooldown policy.
- Timeout:
  - Bridge-bound advisory calls must have deterministic timeout fallback to local/offline suggestion path.
  - State authority cannot block on bridge timeout outcomes.

## Schema Evolution and Bounded Payload Policy (Draft v1)
- Backward compatibility:
  - Additive fields are allowed; removing/renaming required fields requires schema version bump.
  - Unknown fields must be ignored by consumers.
- Versioning:
  - Default schema target is `1.0`.
  - Breaking payload changes require dual-read transition period for one roadmap phase.
- Bounded payload policy:
  - `text` fields are capped by producer policy (short UI-safe payloads only).
  - `stateContextSummary` and `activePropsSummary` are bounded summaries, never raw dumps.
  - Trace payloads include only required fields (`type`, `correlationId`, bounded metadata).
  - No raw chain-of-thought or unbounded diagnostic stacks are emitted to renderer contracts.

## Bridge-Bound Read-Only Context Contract (Draft v1)
Required request context fields for D04 bridge usage:

```json
{
  "currentState": "Roam",
  "stateContextSummary": "Pet is roaming and recently interacted with a prop.",
  "activePropsSummary": "food:1",
  "source": "offline"
}
```

Rules:
- `currentState` is required and read-only from bridge perspective.
- `stateContextSummary` and `activePropsSummary` are optional but bounded when present.
- `source` must be explicit (`online` or `offline`) for deterministic degraded responses.

## Arbitration Insertion Rules (Extension vs Core)
1. Core safety/state invariants always win over extension-origin requests.
2. Extension-origin intents are inserted below active higher-priority core intents (`Sleep`, `WatchMode`).
3. Extension interaction intents can produce suggestions without forcing state mutation.
4. Arbitration results must emit deterministic reason codes (`allow`, `deny`, `defer`) for traceability.
5. Bridge-origin advisory outputs never override local arbitration decisions.

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
- `Doc Gate`: `passed`
- `Implementation Gate`: `in_progress`
- `Overall`: `in_progress`

## Implementation Progress (This Session)
- [x] Added contract router module: `pet-contract-router.js`.
- [x] Implemented runtime event -> intent -> suggestion processing with correlation IDs.
- [x] Implemented normalized `USER_COMMAND` source path with deterministic intents:
  - `status` -> `INTENT_INTROSPECTION_STATUS` -> `PET_RESPONSE`
  - `announce-test` -> `INTENT_PROACTIVE_ANNOUNCEMENT` -> `PET_ANNOUNCEMENT`
- [x] Implemented proactive announcement cooldown enforcement (`manual_test` cooldown).
- [x] Implemented extension event bridge path:
  - `EXT_PROP_INTERACTED` -> `INTENT_PROP_INTERACTION` -> `PET_RESPONSE`.
- [x] Added main-process IPC + renderer bridge:
  - `pet:runUserCommand`
  - `pet:getContractTrace`
  - `pet:contract-trace`
  - `pet:contract-suggestion`
- [x] Added renderer verification hotkeys:
  - `I` -> run `status` command
  - `U` -> run `announce-test` command
- [x] Added syntax-check coverage for contract router module.
- [x] Added deterministic contract pipeline verification script: `scripts/check-contract-router.js`.
- [x] Added contract verification into project checks: `npm run check:contracts`.
- [x] Added contract suggestion diagnostics visibility improvements:
  - renderer debug overlay now shows latest suggestion type + correlation ID.
  - main-process logs now emit `PET_ANNOUNCEMENT_SKIPPED` and `PET_RESPONSE` summaries.
- [ ] Manual runtime verification for D03 slice pending operator run.

## Automated Verification Evidence (2026-02-26)
- `npm run check` passed with:
  - `check:contracts`: verifies deterministic event -> intent -> suggestion flow for:
    - `USER_COMMAND(status)`
    - `USER_COMMAND(announce-test)` with cooldown skip and re-emit behavior
    - `EXT_PROP_INTERACTED` mapping to `INTENT_PROP_INTERACTION` and `PET_RESPONSE`
  - Correlation ID preservation assertions across all trace stages.
  - Existing layout and asset validation checks.

## Working Draft (v0.1)
First D03 runtime slice is command/event-centric and focuses on deterministic routing, traceability, and cooldown behavior:

| Flow | Event | Intent | Suggestion | Notes |
| --- | --- | --- | --- | --- |
| Status introspection | `USER_COMMAND(status)` | `INTENT_INTROSPECTION_STATUS` | `PET_RESPONSE` | Includes correlation ID and source (`offline` when bridge not healthy). |
| Proactive announcement test | `USER_COMMAND(announce-test)` | `INTENT_PROACTIVE_ANNOUNCEMENT` | `PET_ANNOUNCEMENT` or `PET_ANNOUNCEMENT_SKIPPED` | Cooldown enforced by reason bucket (`manual_test`). |
| Extension interaction narration | `EXT_PROP_INTERACTED` | `INTENT_PROP_INTERACTION` | `PET_RESPONSE` | Maintains core-authoritative behavior via upstream arbitration layer. |

Trace stages currently emitted:
- `event`
- `intent`
- `suggestion`

Each stage includes:
- `type`
- `correlationId`
- `source`
- bounded payload fields

## Open Questions
- Should suggestions carry explicit expiry and confidence defaults globally?

## Change Log
- `2026-02-26`: File created and seeded.
- `2026-02-26`: Updated for `spec + implementation slice` workflow with mandatory implementation/visible outcome sections and dual-gate status.
- `2026-02-26`: Advanced to `in_progress`; added first runtime event-intent-suggestion slice (`pet-contract-router.js`) with correlation IDs, user-command routing, announcement cooldown, extension interaction mapping, and trace IPC wiring.
- `2026-02-26`: Added contract ownership/schema/evolution/bounded-payload policy details, marked `Doc Gate` as `passed`, and added deterministic contract router verification script coverage while keeping implementation gate pending manual runtime verification.
