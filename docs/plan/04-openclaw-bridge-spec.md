# Deliverable 04: OpenClaw Bridge Specification

**Deliverable ID:** `04-openclaw-bridge-spec`  
**Status:** `not_started`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `03-pet-core-events-intents-suggestions`  
**Blocks:** `05-memory-pipeline-and-obsidian-adapter`, `06-integrations-freshrss-spotify`, `08-test-and-acceptance-matrix`  
**Verification Gate:** `Bridge request/stream/error model is complete, testable, and does not violate local runtime authority rules`

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

## Verification Gate
Pass when all are true:
1. Request/response/stream sequence diagrams are complete.
2. Failure modes have explicit fallback behavior.
3. No bridge state can block render loop or drag/fling pipeline.
4. Security assumptions and constraints are documented.
5. Bridge authority limitations are explicit and testable.
6. Bridge degradation behavior includes explicit text-only fallback and optional canned SFX talk mode.
7. Introspection prompts (`what are you thinking/doing/status report`) resolve in both online and degraded modes with bounded output policy.

## Tangible Acceptance Test (Doc-Level)
1. Sequence diagram shows an AI timeout case and deterministic local fallback result.
2. A policy table explicitly marks blocked actions (`set state directly`, `render control`, `immutable identity write`).
3. Sequence set includes:
   - Online text dialog with optional TTS.
   - Offline dialog fallback through local chat/bubble.
   - TTS-failure fallback to canned talk SFX mode.
4. Sequence set includes one proactive OpenClaw suggestion path that can be accepted/rejected by local pet policy before user-visible output.

## Open Questions
- Default reconnect policy tuning for local loopback deployments.

## Change Log
- `2026-02-26`: File created and seeded.
