# Deliverable 07: State System Extension Guide

**Deliverable ID:** `07-state-system-extension-guide`
**Status:** `done`
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
- Windows local media sensing can drive `MusicChill` without waiting for a slower Spotify/OpenClaw probe:
  - GSMTC/local-media path reacts first for desktop Spotify/browser/video playback when Windows exposes a current media session
  - slower Spotify/FreshRSS probes remain available as enrichment/memory inputs instead of the only real-time trigger path
- FreshRSS now has two D07 behaviors:
  - background FreshRSS probes stay silent and act as enrichment/memory inputs only
  - manual `L` is an explicit visible `Reading` demo for the latest headline, then it times out back to `Idle` so autonomous music/idle behavior can resume
- Placeholder animated overlay sprite sheets make first-slice states visibly distinct without requiring final character art:
  - `Reading` book prop
  - `FreshRSS` reading card prop
  - `MusicChill` headphones vs speaker prop
  - `PoolPlay` ring prop
  - explicit fallback-warning prop for missing-resource cases

## Implementation Verification (Manual)
1. Press `1` to trigger `Reading` and verify transition plus visible/logged context output.
2. Press `2` to trigger `PoolPlay` and verify deterministic `enter -> loop -> exit -> recover` transitions.
3. Press `3` to simulate one missing asset/resource path and verify fallback handling with explicit warning and `visualFallbackUsed=true`.
4. Ask "what are you doing?" or "what are you reading?" through the available command/test path and verify deterministic local fallback output when OpenClaw is offline or context data is unavailable.
5. Start Spotify/browser/video playback and verify local Windows media sensing enters `MusicChill` automatically; press `K` to force a manual local-media refresh if needed.
6. Verify local media route handling uses the Windows output endpoint:
   - `headphones` prop if the default render endpoint looks like headphones/headset/earbuds
   - `speaker` prop if the default render endpoint looks like speakers/stereo/tv/receiver
   - generic `musicNote` only when route cannot be inferred safely
7. Press `J` with Spotify active and verify the slower Spotify/OpenClaw enrichment path preserves the local speaker/headphones route when available instead of regressing to an incorrect prop.
8. Press `L` and verify a successful FreshRSS probe enters `Reading` with the animated RSS-card prop and the latest item title/source in the local reading response, then returns to `Idle` after the temporary demo window so `MusicChill` or other lower-priority behavior can resume.

## Runtime Contract Snapshot
- Catalog source: `config/state-catalog.json`
- Main authority module: `state-runtime.js`
- Local media sensor path:
  - main polls `windows-media-sensor.js`
  - PowerShell probe script is `scripts/windows-media-probe.ps1`
  - normalized local media events use `MEDIA.source=GSMTC` when Windows session data is available
- Renderer visibility path:
  - main emits `pet:state`
  - preload exposes `getStateSnapshot`, `triggerBehaviorState`, `simulateStateFallback`, `onState`
  - renderer consumes the bounded snapshot for visible prop overlays, sprite clip override, and diagnostics
- Authoritative snapshot fields emitted to renderer:
  - `currentState`
  - `phase`
  - `reason`
  - `source`
  - `visual.clip`
  - `visual.overlay`
  - `visual.requestedClip`
  - `visual.requestedOverlay`
  - `visualFallbackUsed`
  - `fallbackReasons[]`
  - `contextSummary`
  - `description.doing`
  - `description.reading`

## Priority And Transition Policy
| State | Priority | Entry Rule | Exit Rule |
| --- | --- | --- | --- |
| `Idle` | `0` | default startup and fallback sink | replaced by any higher-priority explicit trigger |
| `Roam` | `10` | reserved deterministic roam mode baseline | replaced by explicit higher-priority state |
| `WatchMode` | `20` | reserved attentive wait mode | replaced by explicit higher-priority state |
| `MusicChill` | `30` | `MEDIA.playing=true` enters `MusicChill` deterministically | replaced by higher-priority manual/phase state or later music escalation |
| `MusicDance` | `40` | reserved for explicit music escalation contract | replaced by higher-priority manual/phase state |
| `Sleep` | `50` | reserved low-activity/sleep policy | replaced by explicit higher-priority wake state |
| `Reading` | `60` | manual/runtime trigger with local reading context | replaced by explicit higher-priority trigger |
| `PoolPlay` | `70` | manual/runtime trigger enters `enter` phase | automatically resolves `enter -> loop -> exit -> recover -> Idle` |

## Visual Mapping And Fallback Rules
- Visual mapping is config-first; runtime does not add new switch branches per state.
- Sprite clip fallback:
  - if requested clip exists in the character manifest, use it
  - otherwise fall back to `fallbackClip`
  - if that also fails, fall back to `IdleReady`
- Overlay fallback:
  - if overlay id is supported in renderer, render it
  - otherwise fall back to `fallbackOverlay`
  - if no supported fallback exists, omit the overlay and set `visualFallbackUsed=true`
- Behavior-state compatibility rules:
  - `Reading`-family states must only bind to body poses that are believable while reading:
    - current first slice: `IdleReady`
    - future attached-pose expansion: seated, reclined, lying, or other calm poses
    - anti-pattern: roaming/run/jump body motion while actively reading a hand-held item
  - music-listening states may reuse locomotion or idle body motion while changing attached/carry props
  - complex prop-play states may use travel clips to approach the prop, then switch to prop-compatible loop/recover clips once interaction starts
- Prop presentation tiers:
  - Tier 1 preferred: direction-aware attached prop sprite sheets anchored to body sockets (head, hand, back, etc.) and synchronized with all 8 directions
  - Tier 2 acceptable: carried world prop that attaches while moving and is dropped/placed at a stable desktop anchor when interaction begins
  - Tier 3 fallback: floating icon/badge above the pet when bespoke prop art or attachment data is unavailable
- Current first-slice visible bindings:
  - `Reading` -> `IdleReady` + animated `book`
  - `FreshRSS Reading` -> `IdleReady` + animated `rssCard`
  - `PoolPlay.enter` -> `Jump` + `poolRing`
  - `PoolPlay.loop` -> `IdleReady` + `poolRing`
  - `PoolPlay.exit` -> `Jump` + `poolRing`
  - `PoolPlay.recover` -> `IdleReady`
  - `MusicChill` -> `IdleReady` + animated `headphones` or `speaker` based on Windows default render endpoint when the local media sensor is available
  - slower Spotify/OpenClaw probes may enrich track identity and memory logging, but should not overwrite a known local speaker/headphones route with a worse guess
  - if neither Windows local media nor Spotify metadata can infer the route safely, `MusicChill` falls back to a generic animated `musicNote` prop
  - missing-resource test -> fallback-warning prop + `visualFallbackUsed=true`
- First-slice manual controls:
  - `1` -> trigger local `Reading` example (`The Pragmatic Programmer`) as a temporary debug/demo state that returns to `Idle`
  - `2` -> trigger `PoolPlay`
  - `3` -> force a missing-resource fallback on `Reading` as a temporary debug/demo state that returns to `Idle`
  - `4` -> ask a local state-aware question (`what are you reading?` when in `Reading`, otherwise `what are you doing?`)
  - `K` -> force one local Windows media probe (`GSMTC` + default audio endpoint)
  - automatic local-media polling also runs in the background when enabled
  - `J` -> existing Spotify probe now acts as slower enrichment and uses the current local output route when Spotify payload metadata is incomplete
  - `L` -> FreshRSS probe now drives deterministic temporary `Reading` entry from the latest feed item when probe data is available, then yields back to `Idle`

## Config Examples
Simple config-only state:
```json
{
  "id": "Reading",
  "kind": "simple",
  "priority": 60,
  "visual": {
    "clip": "IdleReady",
    "fallbackClip": "IdleReady",
    "overlay": "book"
  },
  "context": {
    "itemType": "rss article",
    "title": "FreshRSS release notes",
    "sourceLabel": "FreshRSS"
  },
  "description": {
    "doingTemplate": "I am reading {title} from {sourceLabel}.",
    "readingTemplate": "I am reading {title} from {sourceLabel}.",
    "readingFallback": "I have a book open, but I do not have the title handy."
  }
}
```

Complex phase state:
```json
{
  "id": "PoolPlay",
  "kind": "phase",
  "priority": 70,
  "onCompleteStateId": "Idle",
  "phases": [
    { "id": "enter", "durationMs": 450, "visual": { "clip": "Jump", "overlay": "poolRing" } },
    { "id": "loop", "durationMs": 1200, "visual": { "clip": "IdleReady", "overlay": "poolRing" } },
    { "id": "exit", "durationMs": 450, "visual": { "clip": "Jump", "overlay": "poolRing" } },
    { "id": "recover", "durationMs": 650, "visual": { "clip": "IdleReady" } }
  ]
}
```

## Hook Contract (Reserved, Bounded)
- Reserved extension manifest additions for future state-pack work:
  - `statePacks[]`
  - `contextProviders[]`
  - optional `hooks.stateModule`
- Reserved trusted hook lifecycle:
  - `enter(snapshot, context)`
  - `update(snapshot, context)`
  - `exit(snapshot, context)`
- Bounds:
  - hook modules may enrich bounded state context or request local side effects
  - hook modules may not seize movement authority, renderer authority, or direct main-process state arbitration
  - invalid hook modules must degrade to config-only behavior with explicit warnings

## Narration Contract
- Local narration is deterministic and bounded to current state snapshot plus local context.
- Current first-slice supported questions:
  - `what are you doing?`
  - `what are you reading?`
- Local fallback rules:
  - if reading context contains required placeholders, use the template
  - if placeholders are missing, fall back to the configured local fallback sentence
  - offline/local narration remains available even when OpenClaw is disabled or unavailable

## Prop-To-State Templates
- `FoodChase`
  - `proximity=near` -> look/follow-head response
  - `proximity=far` -> chase response
  - fallback if prop signal is incomplete: remain in current safe state and log reason
- `Reading`
  - `spawn/place/click` on trusted reading prop may request `Reading`
  - context provider may attach `title`, `sourceLabel`, `itemType`
  - fallback if provider data is missing: enter `Reading` anyway and use local narration fallback text
  - first runtime slice reserves `L` for a FreshRSS-backed `Reading` entry using the latest article title/source
- `PoolPlay`
  - `spawn/place/click` on trusted pool prop may request `PoolPlay`
  - full prop-world target behavior:
    - prop persists on the desktop until removed by user or pet/system logic
    - pet travels to the prop anchor before interaction loop begins
    - `loop` continues while the prop remains active and no higher-priority interruption occurs
    - `exit/recover` start when interest decays, the prop is removed, or arbitration selects another behavior
  - current first slice uses manual trigger only and time-bounded looping as a deterministic placeholder
  - fallback if a phase clip/overlay is missing: continue the phase timeline with fallback visuals, never crash

## Inventory And Prop Provenance
- There are two distinct prop sources in the roadmap:
  - attached/carry props that travel with the pet (`headphones`, `book`, future `boombox`)
  - desktop props that exist separately in the prop world (`pool`, `slide`, `swing`, food items)
- Current roadmap coverage:
  - desktop-anchored persistent prop world and placement flow are owned by D02b contracts
  - state reaction, visual compatibility, and deterministic fallback are owned by D07
  - user-facing inventory/launcher controls belong in D07c shell/settings/wardrobe follow-on work
- Gap identified from operator feedback:
  - explicit inventory semantics for "user places a prop from inventory" vs "pet pulls a prop from inventory" should be formalized before D07c implementation begins

## Anti-Patterns
- Do not add core `switch` branches for each new state.
- Do not let bridge or extension code mutate authoritative state directly.
- Do not bind state visuals to assets without a deterministic clip/overlay fallback.
- Do not require online context just to answer basic local state questions.

## Gate Status
- `Doc Gate`: `passed`
- `Implementation Gate`: `passed`
- `Overall`: `done`

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
- `2026-03-02`: Implemented first D07 runtime slice (`state-runtime.js`, `config/state-catalog.json`, renderer-visible state snapshot/overlays, `Reading`, `PoolPlay`, missing-resource fallback, local narration fallback, and deterministic checks). `Doc Gate` moved to `passed`; `Implementation Gate` remains pending manual app verification.
- `2026-03-02`: Added animated placeholder overlay sprite sheets for D07 state visuals, restored fling `Roll` precedence over state overlays, routed successful FreshRSS probes into visible `Reading`, and made `MusicChill` distinguish speakers vs headphones when Spotify output metadata is available.
- `2026-03-02`: Captured operator clarification that reading states must use body-compatible poses, prop visuals should prefer direction-aware body attachments over floating icons, and persistent desktop props / inventory-driven placement remain follow-on scope beyond the first D07 runtime slice.
- `2026-03-02`: Added config-first Windows local media sensing (`GSMTC` + default audio endpoint) with background polling, a manual `K` probe path, slower Spotify/FreshRSS background enrichment hooks, a priority guard so automatic `MusicChill` does not preempt higher-priority states such as `Reading` or `PoolPlay`, and duration-bound manual `Reading`/fallback test injections so autonomous behavior can resume after debug actions.
- `2026-03-02`: Fixed local-media application ordering so `MusicChill` no longer waits behind Spotify enrichment, and added forced local-media reassertion when temporary manual states fall back to `Idle`.
- `2026-03-02`: Clarified FreshRSS semantics so background probes remain silent enrichment while manual `L` becomes a duration-bound visible `Reading` demo that returns to `Idle` and allows local-media `MusicChill` to resume.
- `2026-03-02`: Operator runtime verification passed for D07: fling `Roll`, `1`/`2`/`3`/`4`, automatic local-media `MusicChill`, manual `K`, Spotify enrichment via `J`, and temporary FreshRSS `L` all behaved as expected, including return to `MusicChill` after temporary `Reading` states. D07 closed as `done`.
