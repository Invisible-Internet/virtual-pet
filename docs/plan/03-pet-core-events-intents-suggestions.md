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

## Open Questions
- Should suggestions carry explicit expiry and confidence defaults globally?

## Change Log
- `2026-02-26`: File created and seeded.
