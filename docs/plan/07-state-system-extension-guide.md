# Deliverable 07: State System Extension Guide

**Deliverable ID:** `07-state-system-extension-guide`
**Status:** `in_progress`
**Owner:** `Mic + Codex`
**Last Updated:** `2026-03-02`
**Depends On:** `02b-extension-framework-and-pack-sdk`, `03-pet-core-events-intents-suggestions`, `04-openclaw-bridge-spec`, `06-integrations-freshrss-spotify`
**Blocks:** `07b-dialog-surface-and-minimal-offline-loop`, `07c-shell-settings-and-wardrobe-surface`, `08-test-and-acceptance-matrix`
**Verification Gate:** `Main-process authoritative state runtime is defined, at least one simple + one complex state are implemented with visible runtime transitions, and local state-aware description fallback is testable`

## Objective
Define the deterministic behavior-state runtime and the repeatable extension workflow for adding new states under the mixed model (config-first with optional code hooks).

## In Scope
- Main-process authoritative state runtime.
- Tracked state catalog schema and config loading path (`config/state-catalog.json`).
- State registration rules and validation.
- Optional hook module contract for advanced state behavior.
- Transition and priority integration rules.
- Explicit behavior-state to visual-state mapping:
  - renderer clip target
  - overlay/prop bindings
  - deterministic fallback chain
- Baseline required state set:
  - `Idle`
  - `Roam`
  - `MusicChill`
  - `MusicDance`
  - `WatchMode`
  - `Sleep`
- Roaming policy extension points:
  - desktop-wide roaming bounds
  - user-defined roam-zone bounds
- Music mode behavior notes:
  - `MusicChill` is default entry behavior when media starts
  - `MusicDance` transition conditions are explicit and deterministic
- State-context narration hooks:
  - optional `describe()` or context provider contract for state-aware question answering
  - deterministic local fallback text when context provider data is unavailable
- Prop-to-state binding patterns:
  - prop event triggers (`spawn`, `place`, `click`, `drag`, `proximity`) mapped to deterministic state transitions
  - shared patterns for `FoodChase`, `Reading`, and `PoolPlay`
- Extension manifest reservations for future D07 implementation:
  - `statePacks[]`
  - `contextProviders[]`
  - optional `hooks.stateModule`

## Out of Scope
- Chat input surface, bubble rendering, and talk feedback (`07b-dialog-surface-and-minimal-offline-loop`).
- Tray/settings/wardrobe user surface (`07c-shell-settings-and-wardrobe-surface`).
- Full offline personality engine or local-model work.
- Implementing every future state.
- Deep animation authoring guidance.

## Dependencies
- D03 contracts.
- D04 bridge read-only state-awareness contract.

## Decisions Locked
- Mixed state model is baseline.
- Core state engine should not require manual switch-case expansion for every new state.
- Main process remains authoritative for state arbitration and renderer-visible state snapshots.
- Existing sprite clips are sufficient for the first D07 runtime slice; no new art is required for gate closure.

## Implementation Breakdown
1. Define the tracked state catalog schema in `config/state-catalog.json`.
2. Define main-process runtime interfaces for:
   - state registration
   - state arbitration
   - state snapshot emission
3. Define lifecycle points (`enter`, `update`, `exit`) for optional trusted hook modules.
4. Define behavior-state to visual-state mapping rules using existing clip names, overlays, props, and fx.
5. Define deterministic fallback behavior for missing overlays, missing clips, invalid phase bindings, and invalid hook modules.
6. Provide baseline visual bindings for all required states and default priorities.
7. Provide one music-mode example showing `MusicChill` entry and optional transition to `MusicDance`.
8. Provide one simple custom-state example (`Reading`) and one complex custom-state example (`PoolPlay`) with lifecycle and asset contracts.
9. Provide a local state-aware description fallback path for "what are you doing?" and "what are you reading?" when OpenClaw is offline or disabled.
10. Provide prop-to-state mapping templates for `FoodChase`, `Reading`, and `PoolPlay`.
11. Reserve additive extension manifest schema for `statePacks`, `contextProviders`, and optional `hooks.stateModule`.

## Verification Gate
Pass when all are true:
1. New config-only state can be added without core code rewrite.
2. Hook-enabled state contract is explicit and bounded.
3. Invalid/missing state resources have deterministic fallback.
4. Guide includes examples and anti-patterns.
5. Baseline required state set and default priority policy are documented end-to-end.
6. Music-mode transition rules (`MusicChill`/`MusicDance`) are explicit and deterministic.
7. Guide includes explicit process to add a simple and a complex custom state without core switch rewrite.
8. State-context narration hook contract is explicit and includes deterministic local fallback behavior.
9. Prop-to-state mapping templates are explicit and enforce deterministic fallback behavior.
10. Runtime demonstrates at least one simple config-only state and one complex phase state transition path.
11. Missing state assets trigger deterministic fallback without runtime crash.
12. Runtime emits a bounded renderer-visible state snapshot including fallback metadata.

## Tangible Acceptance Test (Doc-Level)
1. Reviewer can follow one explicit transition table with all baseline states and priority conflict resolution.
2. Example config shows music-state prop binding (`headphones`) and deterministic fallback when asset or prop binding is missing.
3. Example transition config shows `MEDIA.playing=true` enters `MusicChill` with `headphones` prop and logs rationale.
4. Example `Reading` config shows book/comic/rss source context and deterministic local fallback response when source metadata is missing.
5. Example `PoolPlay` config shows phase transitions (`enter/loop/exit/recover`) and fallback behavior for missing sub-bindings.
6. Example `FoodChase` config shows held-prop proximity behavior (`look/follow-head` near, `chase` far) with bounded transition rules.
7. Example renderer snapshot includes `currentState`, `phase`, `reason`, `visual`, and `visualFallbackUsed`.

## Implementation Slice (Mandatory)
- Implement baseline state registration mechanism from config catalog (no switch-case rewrite path).
- Implement one simple custom state (`Reading`) and one complex phase state (`PoolPlay`) in runtime.
- Implement one local state-context narration fallback path for missing context provider data or offline bridge mode.
- Implement missing animation/resource fallback behavior for both simple and complex examples.
- Emit authoritative state snapshots from main to renderer.

## Visible App Outcome
- User can trigger `Reading` and observe state entry and mapped visual behavior.
- User can trigger `PoolPlay` and observe `enter -> loop -> exit -> recover` sequence (or logged equivalent if visual assets are missing).
- Missing resource scenarios visibly degrade to fallback state/animation without crash.
- Renderer diagnostics can surface the active behavior state, phase, and fallback flag.

## Implementation Verification (Manual)
1. Press `1` to trigger `Reading` and verify transition plus visible/logged context output.
2. Press `2` to trigger `PoolPlay` and verify deterministic `enter -> loop -> exit -> recover` transitions.
3. Press `3` to simulate one missing asset/resource path and verify fallback handling with explicit warning and `visualFallbackUsed=true`.
4. Ask "what are you doing?" or "what are you reading?" through the available command/test path and verify deterministic local fallback output when OpenClaw is offline or context data is unavailable.

## Gate Status
- `Doc Gate`: `not_started`
- `Implementation Gate`: `not_started`
- `Overall`: `in_progress`

## Working Defaults
- Core catalog lives in `config/state-catalog.json`.
- D07 runtime introduces `state-runtime.js` as the main-process state authority module.
- Existing renderer clips are reused first:
  - `Idle` -> `IdleReady`
  - `Roam` -> `Walk`
  - `MusicChill` -> `IdleReady` + `headphones`
  - `MusicDance` -> `Run` or `Walk` + `headphones`
  - `WatchMode` -> `IdleReady`
  - `Sleep` -> `IdleReady` + sleep placeholder overlay/fx
  - `Reading` -> `IdleReady` + `book` overlay
  - `PoolPlay.enter` -> `Jump` or `IdleReady`
  - `PoolPlay.loop` -> `IdleReady` + pool overlay/fx
  - `PoolPlay.exit` -> `Jump` or `IdleReady`
  - `PoolPlay.recover` -> `IdleReady`

## Change Log
- `2026-02-26`: File created and seeded.
- `2026-02-26`: Updated for `spec + implementation slice` workflow with mandatory implementation/visible outcome sections and dual-gate status.
- `2026-03-01`: Advanced to `in_progress` after D06 closeout; implementation work not started yet.
- `2026-03-02`: Re-scoped D07 around deterministic state runtime ownership, behavior-to-visual mapping, local state-aware description fallback, and additive extension schema reservations. Bubble/talk feedback and tray/settings/wardrobe work moved into D07b and D07c.
