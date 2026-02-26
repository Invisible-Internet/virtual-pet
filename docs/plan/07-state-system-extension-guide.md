# Deliverable 07: State System Extension Guide

**Deliverable ID:** `07-state-system-extension-guide`  
**Status:** `not_started`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `03-pet-core-events-intents-suggestions`, `02b-extension-framework-and-pack-sdk`  
**Blocks:** `08-test-and-acceptance-matrix`  
**Verification Gate:** `Guide defines repeatable state-extension process and at least one simple + one complex state are implemented with visible runtime transitions`

## Objective
Define extensible workflow for adding new pet states under the mixed model (config-first with optional code hooks).

## In Scope
- State catalog schema.
- State registration rules.
- Optional hook module contract.
- Transition and priority integration rules.
- State pack composition for animation availability:
  - Simple pack pattern (single idle/loop animation + optional props).
  - Complex pack pattern (entry -> loop -> interaction variants -> exit -> cooldown/recovery).
- Baseline required state set:
  - `Idle`
  - `Roam`
  - `MusicChill`
  - `MusicDance`
  - `WatchMode`
  - `Sleep`
- Roaming policy extension points:
  - Desktop-wide roaming bounds.
  - User-defined roam-zone bounds.
- Wardrobe binding model:
  - Optional costume/accessory props per state (e.g., headphones in music mode).
- Speech/visualization bindings:
  - Speech bubble/thought balloon presentation rules by message type.
  - Lip-sync approximation hooks tied to speech activity (not phoneme-accurate requirement).
- Music mode behavior notes:
  - `MusicChill` is default entry behavior when media starts.
  - `MusicDance` transition conditions are explicit and deterministic (configurable trigger contract).
  - Dialogue visualization is an overlay behavior and must not seize state-engine authority.
- State-context narration hooks:
  - Optional `describe()`/context provider contract for question answering (for example: "what are you reading?").
  - Must have deterministic fallback text when context provider data is unavailable.
- Prop-to-state binding patterns:
  - Prop event triggers (`spawn/place/click/drag/proximity`) mapped to deterministic state transitions.
  - Shared patterns for extension examples (`FoodChase`, `Reading`, `PoolPlay`).

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
6. Provide baseline pack examples for all required states and default priorities.
7. Provide one dialogue-visual example showing bubble + lip-sync fallback behavior.
8. Provide one music-mode example showing `MusicChill` entry and optional transition to `MusicDance`.
9. Provide one simple custom-state example (`Reading`) and one complex custom-state example (`PoolPlay`) with lifecycle/asset contracts.
10. Provide prop-to-state mapping templates for `FoodChase`, `Reading`, and `PoolPlay`.

## Verification Gate
Pass when all are true:
1. New config-only state can be added without core code rewrite.
2. Hook-enabled state contract is explicit and bounded.
3. Invalid/missing state resources have deterministic fallback.
4. Guide includes examples and anti-patterns.
5. Baseline required state set and default priority policy are documented end-to-end.
6. Dialogue visual behaviors (bubble + lip-sync approximation) are documented with deterministic fallback rules.
7. Music-mode transition rules (`MusicChill`/`MusicDance`) are explicit and deterministic.
8. Guide includes explicit process to add a simple and a complex custom state without core switch rewrite.
9. State-context narration hook contract is explicit and includes offline fallback behavior.
10. Prop-to-state mapping templates are explicit and enforce deterministic fallback behavior.
11. Runtime demonstrates at least one simple config-only state and one complex phase state transition path.
12. Missing state assets trigger deterministic fallback without runtime crash.

## Tangible Acceptance Test (Doc-Level)
1. Reviewer can follow one explicit transition table with all baseline states and priority conflict resolution.
2. Example config shows music-state prop binding (`headphones`) and deterministic fallback when asset is missing.
3. Example dialogue config shows bubble display and lip-sync fallback to idle-mouth/talk-SFX mode when TTS data is missing.
4. Example transition config shows `MEDIA.playing=true` enters `MusicChill` with `headphones` prop and logs rationale.
5. Example `Reading` config shows book/comic/rss source context and deterministic fallback response when source metadata is missing.
6. Example `PoolPlay` config shows phase transitions (`enter/loop/exit/recover`) and fallback behavior for missing sub-animations.
7. Example `FoodChase` config shows held-prop proximity behavior (`look/follow-head` near, `chase` far) with bounded transition rules.

## Implementation Slice (Mandatory)
- Implement baseline state registration mechanism from config catalog (no switch-case rewrite path).
- Implement one simple custom state (`Reading`) and one complex phase state (`PoolPlay`) in runtime.
- Implement one state-context narration fallback path for missing context provider data.
- Implement missing animation/resource fallback behavior for both simple and complex examples.

## Visible App Outcome
- User can trigger `Reading` and observe state entry/behavior.
- User can trigger `PoolPlay` and observe `enter -> loop -> exit -> recover` sequence (or logged equivalent if visual assets missing).
- Missing resource scenarios visibly degrade to fallback state/animation without crash.

## Implementation Verification (Manual)
1. Trigger `Reading` state and verify transition + visible/logged context output.
2. Trigger `PoolPlay` path and verify deterministic phase transitions.
3. Remove one required asset and verify fallback handling with explicit warning.
4. Ask a state-aware question and verify deterministic fallback answer when context data unavailable.

## Gate Status
- `Doc Gate`: `not_started`
- `Implementation Gate`: `not_started`
- `Overall`: `not_started`

## Open Questions
- Where to store state packs in repo layout (`assets/states` vs `config/states`).

## Change Log
- `2026-02-26`: File created and seeded.
- `2026-02-26`: Updated for `spec + implementation slice` workflow with mandatory implementation/visible outcome sections and dual-gate status.
