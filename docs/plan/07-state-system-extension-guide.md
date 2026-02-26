# Deliverable 07: State System Extension Guide

**Deliverable ID:** `07-state-system-extension-guide`  
**Status:** `not_started`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `03-pet-core-events-intents-suggestions`  
**Blocks:** `08-test-and-acceptance-matrix`  
**Verification Gate:** `Guide defines repeatable process for adding config-only and hook-enabled states without core switch rewrites`

## Objective
Define extensible workflow for adding new pet states under the mixed model (config-first with optional code hooks).

## In Scope
- State catalog schema.
- State registration rules.
- Optional hook module contract.
- Transition and priority integration rules.

## Out of Scope
- Implementing every future state.
- Deep animation authoring guidance.

## Dependencies
- D03 contracts.

## Decisions Locked
- Mixed state model is baseline.
- Core state engine should not require manual switch-case expansion for every new state.

## Implementation Breakdown
1. Define state catalog fields and validation rules.
2. Define lifecycle points (`enter/update/exit`) for optional hooks.
3. Define fallback behavior for invalid state packs.
4. Define migration path for existing states.
5. Provide examples: one config-only state, one hook-enabled state.

## Verification Gate
Pass when all are true:
1. New config-only state can be added without core code rewrite.
2. Hook-enabled state contract is explicit and bounded.
3. Invalid/missing state resources have deterministic fallback.
4. Guide includes examples and anti-patterns.

## Open Questions
- Where to store state packs in repo layout (`assets/states` vs `config/states`).

## Change Log
- `2026-02-26`: File created and seeded.
