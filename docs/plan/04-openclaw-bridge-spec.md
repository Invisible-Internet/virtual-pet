# Deliverable 04: OpenClaw Bridge Specification

**Deliverable ID:** `04-openclaw-bridge-spec`  
**Status:** `done`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `03-pet-core-events-intents-suggestions`, `02b-extension-framework-and-pack-sdk`  
**Blocks:** `05-memory-pipeline-and-obsidian-adapter`, `06-integrations-freshrss-spotify`, `08-test-and-acceptance-matrix`  
**Verification Gate:** `Bridge request/stream/error model is complete/testable and a runtime bridge slice (with offline fallback) is implemented without violating local authority rules`

## Objective
Specify how the app integrates with OpenClaw in an OpenClaw-first orchestration model with guaranteed fallbacks.

## In Scope
- Connection model.
- Request and streaming response lifecycle.
- Retry/backoff behavior.
- Error/degraded behavior.
- Security and minimal context payload policy.
- OpenClaw use-case routing coverage:
  - Dialogue generation.
  - Hobby summaries.
  - Memory analysis.
  - Identity mutation analysis (advisory only).
  - Flavor suggestions.
- Introspection query routing model (`what are you thinking/doing/status report`) with safe response modes.
- Dialogue request routing model for text and optional voice pipelines (STT in, TTS out).
- Bridge context propagation model:
  - Every bridge request carries read-only `currentState`.
  - Bridge request may carry bounded `stateContextSummary` (for state-aware dialogue like reading/pool context).
  - Missing context must degrade gracefully (no hard failure).
- Extension context enrichment envelope:
  - `activePropsSummary`
  - `extensionContextSummary`
  - `source` (online/offline origin labeling)
  - bounded truncation policy for all extension-provided context.
- Fallback policy for voice features:
  - If STT unavailable: chat input remains usable.
  - If TTS unavailable: text + optional canned talk SFX fallback.
- Non-authority guarantees:
  - Bridge cannot directly set runtime state.
  - Bridge cannot control render loop.
  - Bridge cannot mutate immutable identity sections.

## Out of Scope
- Skill implementation internals.
- Tool-specific business logic beyond routing contracts.

## Dependencies
- D03 contracts.
- D02 capability model.

## Decisions Locked
- OpenClaw is orchestration/advisory layer.
- Core pet behavior remains deterministic and local.

## Implementation Breakdown
1. Define bridge capability API and state machine.
2. Define request envelope and correlation IDs.
3. Define streaming event handling contract.
4. Define timeout/retry/circuit-breaker behavior.
5. Define fallback semantics when unavailable.
6. Define dialogue channel behavior (streaming text, optional TTS asset return, interruption/cancel handling).
7. Define proactive outbound suggestion behavior (`PET_ANNOUNCEMENT`) with local gating and rate limits.
8. Define state-context payload policy and truncation/safety limits.
9. Define extension context enrichment payload shape and offline fallback handling.

## Verification Gate
Pass when all are true:
1. Request/response/stream sequence diagrams are complete.
2. Failure modes have explicit fallback behavior.
3. No bridge state can block render loop or drag/fling pipeline.
4. Security assumptions and constraints are documented.
5. Bridge authority limitations are explicit and testable.
6. Bridge degradation behavior includes explicit text-only fallback and optional canned SFX talk mode.
7. Introspection prompts (`what are you thinking/doing/status report`) resolve in both online and degraded modes with bounded output policy.
8. State-aware dialogue path is specified: OpenClaw can reference current state/context but cannot authoritatively set state.
9. Extension context enrichment path is specified for both online and offline modes with explicit source labeling.
10. Runtime includes one implemented bridge request path with correlation IDs and timeout handling.
11. Offline fallback path is demonstrably non-blocking and user-visible.

## Tangible Acceptance Test (Doc-Level)
1. Sequence diagram shows an AI timeout case and deterministic local fallback result.
2. A policy table explicitly marks blocked actions (`set state directly`, `render control`, `immutable identity write`).
3. Sequence set includes:
   - Online text dialog with optional TTS.
   - Offline dialog fallback through local chat/bubble.
   - TTS-failure fallback to canned talk SFX mode.
4. Sequence set includes one proactive OpenClaw suggestion path that can be accepted/rejected by local pet policy before user-visible output.
5. Sequence set includes one state-aware Q/A path:
   - User asks what pet is doing/reading.
   - Bridge receives `currentState` and bounded context.
   - Offline mode returns local fallback response using same local state context.
6. Sequence set includes extension context enrichment:
   - Online path with `activePropsSummary` + `extensionContextSummary`.
   - Offline fallback path with local templated response and `source=offline`.

## Implementation Slice (Mandatory)
- Implement minimal `openclawBridge` runtime module stub with request envelope and timeout behavior.
- Implement one user-facing route (for example text dialog request) through bridge adapter.
- Implement deterministic fallback response path when bridge unavailable/timeout.
- Implement explicit blocked-action guardrails (`set state`, `render control`, immutable identity writes).

## Visible App Outcome
- `I` (`status`) now routes through bridge introspection path and emits correlation-linked contract traces.
- `Y` (`bridge-test`) now routes through bridge dialog path and emits `PET_RESPONSE` output.
- `G` (`guardrail-test`) triggers bridge-proposed prohibited actions that are blocked and logged by local guardrails.
- `PET_OPENCLAW_MODE=timeout` or `offline` produces deterministic offline fallback output without blocking runtime.

## Implementation Verification (Manual)
1. Start app (`npm start`) with default bridge mode and press `I`; verify:
   - `PET_RESPONSE` output path executes.
   - logs include correlation ID and `source=online`.
2. Press `Y`; verify dialog response path emits bridge-backed `PET_RESPONSE` and correlation trace.
3. Press `G`; verify logs include blocked-action entries for at least:
   - `set_state`
   - `render_control`
   - `identity_mutation`
4. Restart with `PET_OPENCLAW_MODE=timeout` and press `I` or `Y`; verify fallback output is shown and logs mark offline fallback without freezing drag/fling behavior.
5. Restart with `PET_OPENCLAW_MODE=offline` and repeat one command; verify deterministic offline fallback with correlation ID.

## Manual Verification Evidence (2026-02-26, Operator Run)
1. Online mode (`npm start`) validated:
   - Bridge startup state reached `healthy (simulatedOnlineReady)`.
   - `I` command path:
     - `[pet-openclaw] request ... route=introspection_status mode=online`
     - `[pet-openclaw] response ... route=introspection_status mode=online`
     - `source=online` trace chain with matching correlation ID through:
       - `USER_COMMAND`
       - `INTENT_INTROSPECTION_STATUS`
       - `PET_RESPONSE`
   - `Y` command path:
     - `[pet-openclaw] request ... route=dialog_user_command mode=online`
     - `[pet-openclaw] response ... route=dialog_user_command mode=online`
     - `INTENT_BRIDGE_DIALOG -> PET_RESPONSE` emitted with `source=online` and matching correlation ID.
2. Guardrail enforcement (`G` / `guardrail-test`) validated in online mode:
   - Logged prohibited action blocks for one correlation ID:
     - `action=set_state`
     - `action=render_control`
     - `action=identity_mutation`
   - Suggestion output remained advisory text and did not mutate core authority paths.
3. Timeout mode (`PET_OPENCLAW_MODE=timeout`) validated:
   - Bridge started as `healthy (simulatedTimeoutMode)`.
   - Runtime timeout path logged:
     - `[pet-openclaw] fallback ... reason=bridge_timeout`
     - capability transition to `degraded (requestTimeout)`
   - `source=offline` trace chain produced deterministic fallback responses for both introspection and dialog routes with correlation IDs.
4. Offline mode (`PET_OPENCLAW_MODE=offline`) validated:
   - Bridge startup state `degraded (offlineFallback)`.
   - Runtime offline fallback logged:
     - `[pet-openclaw] fallback ... reason=bridge_unavailable`
     - capability remained `degraded (requestFailed)`
   - `source=offline` trace chain produced deterministic fallback responses with correlation IDs.
5. Drag/fling non-blocking behavior confirmed by operator during degraded bridge modes (`timeout` and `offline`):
   - Pet movement/interaction remained responsive while fallback responses were emitted.

## Implementation Progress (This Session)
- Added bridge runtime module: `openclaw-bridge.js` (request envelope simulation, mode control, timeout helper).
- Wired main-process bridge path into user commands:
  - `status` -> bridge introspection route
  - `bridge-test` -> bridge dialog route
  - `guardrail-test` -> bridge dialog route with blocked-action policy enforcement
- Added local non-authority guardrails and explicit blocked-action logs for:
  - `set_state`
  - `render_control`
  - `identity_mutation`
- Added bridge request context propagation:
  - `currentState`
  - `stateContextSummary`
  - `activePropsSummary`
  - `extensionContextSummary`
  - `source`
- Added renderer verification hotkeys:
  - `Y` -> `bridge-test`
  - `G` -> `guardrail-test`
- Expanded automated checks:
  - `scripts/check-openclaw-bridge.js`
  - `scripts/check-contract-router.js` adds `INTENT_BRIDGE_DIALOG` coverage
  - `npm run check:contracts` now runs both contract and bridge checks

## Gate Status
- `Doc Gate`: `passed`
- `Implementation Gate`: `passed`
- `Overall`: `done`

## Verification Gate Status
- `Reopened (2026-02-26): Prior closeout lacked concrete visible verification evidence for bridge route, timeout behavior, and blocked-action guardrails.`
- `Passed (2026-02-26): Operator-confirmed online, timeout/offline fallback, blocked-action guardrails, and drag/fling non-blocking behavior.`

## Automated Verification Evidence (2026-02-26)
- `npm run check` passed with:
  - `check:syntax`
  - `check:contracts` (`check-contract-router` + `check-openclaw-bridge`)
  - `check:layout`
  - `check:assets`

## Open Questions
- Default reconnect policy tuning for local loopback deployments.

## Change Log
- `2026-02-26`: File created and seeded.
- `2026-02-26`: Updated for `spec + implementation slice` workflow with mandatory implementation/visible outcome sections and dual-gate status.
- `2026-02-26`: Advanced to `in_progress` after D03 closeout; D04 is now the active deliverable.
- `2026-02-26`: Deliverable approved and closed as `done`; `Doc Gate` and `Implementation Gate` marked `passed`.
- `2026-02-26`: Reopened to `in_progress` after review identified missing concrete visible verification evidence.
- `2026-02-26`: Implemented bridge runtime slice (online/timeout/offline modes, bridge dialog path, blocked-action guardrails, and automated bridge checks); implementation gate remains pending manual runtime evidence.
- `2026-02-26`: Operator confirmed degraded-mode drag/fling stability; implementation gate marked `passed` and deliverable re-closed as `done`.
