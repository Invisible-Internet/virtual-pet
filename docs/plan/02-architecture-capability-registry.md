# Deliverable 02: Architecture Capability Registry

**Deliverable ID:** `02-architecture-capability-registry`  
**Status:** `not_started`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `01-gap-analysis-expansion-vs-current`, `09-decisions-log`  
**Blocks:** `03-pet-core-events-intents-suggestions`, `04-openclaw-bridge-spec`, `05-memory-pipeline-and-obsidian-adapter`  
**Verification Gate:** `Capability contract, lifecycle, status model, and fallback semantics are documented and internally consistent`

## Objective
Define the built-in capability registry architecture that makes integrations optional and failure-tolerant.

## In Scope
- Capability interface contract.
- Lifecycle (`start/stop/health`).
- Runtime status model.
- Enable/disable behavior.
- Fallback/degraded behavior rules.

## Out of Scope
- Dynamic third-party plugin loading.
- Production capability implementations.

## Dependencies
- D01 gap mapping.
- Locked decisions from D09.

## Decisions Locked
- Built-in capability registry for v1.
- No dynamic plugin loading in v1.
- Degraded mode is mandatory for all capability failures.

## Implementation Breakdown
1. Define capability interface schema and state machine.
2. Define capability registration and boot order.
3. Define intent routing responsibilities.
4. Define global health and telemetry shape.
5. Define fallback behavior per capability class.

## Verification Gate
Pass when all are true:
1. Interface contract is explicit and versioned.
2. Status transitions are deterministic.
3. Failures cannot block core pet runtime.
4. Routing ownership is unambiguous.

## Open Questions
- Should capability state persist across restarts in v1 or derive from config only?

## Change Log
- `2026-02-26`: File created and seeded.
