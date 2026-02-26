# Deliverable 02: Architecture Capability Registry

**Deliverable ID:** `02-architecture-capability-registry`  
**Status:** `not_started`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `01-gap-analysis-expansion-vs-current`, `09-decisions-log`  
**Blocks:** `02b-extension-framework-and-pack-sdk`, `03-pet-core-events-intents-suggestions`, `04-openclaw-bridge-spec`, `05-memory-pipeline-and-obsidian-adapter`  
**Verification Gate:** `Capability contract, lifecycle, status model, and fallback semantics are documented and internally consistent`

## Objective
Define the built-in capability registry architecture that makes integrations optional and failure-tolerant.

## In Scope
- Capability interface contract.
- Lifecycle (`start/stop/health`).
- Runtime status model.
- Enable/disable behavior.
- Fallback/degraded behavior rules.
- Capability boundaries for architecture layers:
  - Renderer runtime boundary (retain Canvas baseline for v2 scope).
  - Pet brain/state machine boundary (deterministic local authority).
  - Sensor boundary (main-process normalized event producers).
  - OpenClaw bridge boundary (advisory/orchestration only).
- Desktop shell boundary:
  - Taskbar/tray icon + settings menu capability ownership.
  - Wardrobe/costume/accessory capability ownership and dependency model.
- Conversation/speech boundary:
  - `dialogUi` capability (speech bubble/chatbox input/output).
  - `voiceIo` capability (STT/TTS adapters with health/degraded status).
  - `lipSync` capability (audio-activity driven approximation; non-blocking).
- Background job and autonomy boundary:
  - `jobScheduler` capability (daily summary runs, maintenance jobs, and job-status reporting for introspection).
  - Autonomy policy enforcement boundary (immutable identity protection and mutation transparency policy).
- Extension framework boundary ownership:
  - `extensionRegistry` capability (discover/load/enable/disable extension packs).
  - `permissionManager` capability (permission visibility + warning model).
  - `propWorld` capability (desktop-anchored props and interaction routing).
  - `behaviorArbitrator` capability (single-authority conflict resolution for extension-origin actions).
  - `extensionHookHost` capability (trusted hook runtime boundary).
  - `extensionStore` capability (scoped persistence and quota governance).

## Out of Scope
- Dynamic third-party loading of capability-engine modules.
- Production capability implementations.

## Dependencies
- D01 gap mapping.
- Locked decisions from D09.

## Decisions Locked
- Built-in capability registry for v1.
- No dynamic plugin loading for capability-engine modules in v1.
- Extension packs (props/state/context/hook packs) are specified separately in D02b and do not replace core capability ownership.
- Degraded mode is mandatory for all capability failures.

## Implementation Breakdown
1. Define capability interface schema and state machine.
2. Define capability registration and boot order.
3. Define intent routing responsibilities.
4. Define global health and telemetry shape.
5. Define fallback behavior per capability class.
6. Define capability map for `renderer`, `brain`, `sensors`, `openclawBridge`, `desktopShell`, `wardrobe`, `dialogUi`, `voiceIo`, `lipSync`, `jobScheduler`, `extensionRegistry`, `permissionManager`, `propWorld`, `behaviorArbitrator`, `extensionHookHost`, `extensionStore`.
7. Define degraded behavior expectations for extension-related capabilities without violating core runtime invariants.

## Verification Gate
Pass when all are true:
1. Interface contract is explicit and versioned.
2. Status transitions are deterministic.
3. Failures cannot block core pet runtime.
4. Routing ownership is unambiguous.
5. Desktop shell, conversation/speech, wardrobe, and background job ownership boundaries are documented with failure fallbacks.
6. Extension framework capability ownership boundaries are explicit and non-conflicting with core authority model.

## Tangible Acceptance Test (Doc-Level)
1. A capability map table exists with one row for each required capability class.
2. Reviewer can trace one failure scenario per capability and confirm documented degraded behavior.
3. Reviewer can trace one extension-capability outage scenario (for example: `propWorld` unavailable) and confirm deterministic fallback.

## Open Questions
- Should capability state persist across restarts in v1 or derive from config only?

## Change Log
- `2026-02-26`: File created and seeded.
