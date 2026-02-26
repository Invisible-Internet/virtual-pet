# Deliverable 04: OpenClaw Bridge Specification

**Deliverable ID:** `04-openclaw-bridge-spec`  
**Status:** `not_started`  
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
- A user query can run through bridge path when available and show response output.
- On forced timeout/unavailable state, app shows fallback response without freezing pet runtime.
- Logs explicitly mark `source=online` vs `source=offline` and include correlation IDs.

## Implementation Verification (Manual)
1. Run one online-available bridge request and verify response output plus correlation ID.
2. Force timeout/unavailable bridge state and verify local fallback output.
3. Verify pet drag/fling behavior remains unaffected during bridge failure scenarios.
4. Validate blocked-action policy logs for at least one prohibited action attempt.

## Gate Status
- `Doc Gate`: `not_started`
- `Implementation Gate`: `not_started`
- `Overall`: `not_started`

## Open Questions
- Default reconnect policy tuning for local loopback deployments.

## Change Log
- `2026-02-26`: File created and seeded.
- `2026-02-26`: Updated for `spec + implementation slice` workflow with mandatory implementation/visible outcome sections and dual-gate status.
