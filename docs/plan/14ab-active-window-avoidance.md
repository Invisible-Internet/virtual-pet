# Deliverable 14ab: Active Window Avoidance

**Deliverable ID:** `14ab-active-window-avoidance`  
**Status:** `accepted`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-09`  
**Depends On:** `14a-deliberate-roam-policy-and-monitor-avoidance`  
**Blocks:** `14b-event-driven-watch-behavior`

## Objective
Add a narrow, deterministic foreground-window awareness layer so the pet can inspect active windows in a playful but bounded way (including bottom-edge WatchMode placement for back-turned "watching screen" illusion), and can enter prolonged avoid mode after explicit user correction, while preserving main-process movement authority and graceful fallback behavior.

## In Scope
- Active foreground window only (single-window awareness for first slice).
- Window-edge inspect behavior using existing state-runtime surfaces (`WatchMode`) with a locked bottom-edge anchor contract for back-turned watch posture.
- Rectangular avoid mask derived from foreground-window bounds, plus a bounded margin.
- Deterministic foreground-window bounds refresh so resize/move updates recalculate avoid mask/inspect anchor.
- User-signaled prolonged avoid memory for active windows (manual drag-off correction records avoid entry).
- Deterministic clipping/fallback when strict avoid is active and no free roam area remains.
- Explicit observability and degraded reasons for detection/avoidance outcomes.
- Windows-only support boundary for this slice.

## Out of Scope
- Multi-window prioritization or per-app policy rules.
- Deep window introspection beyond foreground identity + screen bounds.
- New direct interactions with app internals.
- Any change to drag authority, window-size invariants, or renderer input authority.

## Environment / Prerequisites
- `14a` accepted baseline.
- Windows runtime (foreground-window bounds provider available).
- `Roam: Desktop` enabled.
- Diagnostics/status surface available for behavior observability.

## Spec Decisions (Locked)
### Activation Boundary
- Active only when:
  - platform is Windows
  - roam mode is `desktop`
  - foreground-window provider reports ready
- Disabled (not degraded) when:
  - roam mode is not `desktop` -> reason `window_avoidance_not_desktop_mode`
  - platform is not Windows -> reason `window_avoidance_not_supported_platform`

### Foreground Candidate Eligibility
- Provider returns one foreground candidate with bounded metadata:
  - `windowId` (opaque id/string)
  - `bounds` (screen coordinates)
  - `displayId` (if available)
- Ignore candidate and run nominal desktop roam when any are true:
  - bounds are missing/invalid/zero-area
  - candidate belongs to the pet app process/window family
  - candidate does not intersect selected desktop roam sampling display area(s)
- Eligibility-ignore path is healthy `nominal`, not degraded.

### Foreground Bounds Refresh (Resize / Move Recalculation)
- Active foreground-window snapshot must be refreshed at bounded cadence:
  - every roam decision boundary
  - and during active roam legs on a throttled poll lane (`FOREGROUND_WINDOW_POLL_MS`, target `250ms`)
- If active foreground window bounds change (move/resize/maximize/restore), mask and inspect anchor are recalculated immediately on next poll tick.
- Bounds revision changes are visible in behavior diagnostics and can trigger deterministic replan when current destination becomes invalid.

### Avoid Mask Geometry
- Use foreground window bounds expanded by `ACTIVE_WINDOW_AVOID_MARGIN_PX = 24`.
- Clip expanded mask to each selected roam sampling area from `14a` policy output.
- Use integer rounding for mask bounds before clipping.
- Empty clipped masks are discarded.

### Window Interaction Policy (Inspect vs Avoid)
- First-slice policy is hybrid and user-signaled:
  - default for newly focused window: `inspect_allowed`
  - hard avoid for that window: `avoid_active` only after manual drag-off correction
- Hard requirement: active-window roam-area clipping is disabled until `manual_window_avoid_recorded` exists for that `windowId`.
- Inspect contract:
  - use `WatchMode` as a back-turned, screen-facing inspect posture that must anchor along the active window's bottom edge.
  - allow bounded on-window placement for illusion support:
    - `WINDOW_WATCH_BOTTOM_BAND_PX` (target `64px`): only the bottom band of the active window can be used for on-window WatchMode placement.
    - `WINDOW_WATCH_BOTTOM_INSET_PX` (target `12px`): preferred watch anchor Y is slightly inside the window from its bottom edge.
    - `WINDOW_WATCH_BOTTOM_GRACE_PX` (target `220px`): allows larger near-bottom overlap when screen/taskbar clamping would otherwise invalidate bottom-edge WatchMode placement (for example fullscreen windows).
  - bottom-edge candidate set remains:
    1. `bottom_center`
    2. `bottom_right_quarter`
    3. `bottom_left_quarter`
  - selected anchor is closer-biased with bounded randomness:
    - nearest valid candidate is favored
    - non-nearest candidates remain eligible to avoid repetitive center-only behavior
  - top/left/right-only anchors are disallowed for WatchMode inspect in this slice; if no bottom-edge anchor is valid, suppress inspect with fallback reason `foreground_window_inspect_anchor_unavailable`.
  - activate `WatchMode` at selected bottom-edge anchor for bounded dwell (`WINDOW_EDGE_INSPECT_DWELL_MS`, target `6000ms`).
  - inspect movement stays bottom-edge constrained and may use the bottom grace band while in WatchMode so fullscreen/lower-edge windows do not cause inspect thrash loops.
  - suppress inspect when active window has avoid-cooldown entry
  - inspect entry cadence is bounded (prevents constant WatchMode bouncing):
    - focused-window stability minimum (`WINDOW_INSPECT_MIN_FOCUS_MS`, target `1800ms`)
    - global inspect cooldown (`WINDOW_INSPECT_GLOBAL_COOLDOWN_MS`, target `22000ms`)
    - per-window inspect cooldown (`WINDOW_INSPECT_WINDOW_COOLDOWN_MS`, target `70000ms`)
    - bounded trigger probability (`WINDOW_INSPECT_TRIGGER_PROBABILITY`, target `0.45`)
- User-signaled avoid contract:
  - if manual drag starts in/near active-window mask and ends outside it, record avoid entry keyed by `windowId`
  - avoid entry duration is prolonged and bounded (`WINDOW_AVOID_MS`, target `300000ms`)
  - while active, hard mask clipping is enforced for that window
  - expiry emits explicit re-entry reason and returns window to `inspect_allowed`

### Free-Area Clipping Contract (Strict Avoid Mode)
- Compose with existing `14a` order:
  1. `14a` monitor-avoidance chooses desktop sampling area set.
  2. `14ab` applies active-window clipping inside that set when active window is in `avoid_active`.
- Subtract one rectangular mask from each sampling area into up to four candidates (`top`, `right`, `bottom`, `left`).
- Candidate rectangle is eligible only if it can fit the runtime roam pet bounds (same envelope used by roam clamp math).
- If at least one eligible candidate remains, use clipped candidates for destination sampling.
- If zero eligible candidates remain, fallback to original (unclipped) `14a` sampling set with reason `foreground_window_no_free_area_fallback`.

### Reason Taxonomy (Locked)
- Decision reasons:
  - `foreground_window_nominal`
  - `foreground_window_soft_inspect_only`
  - `foreground_window_inspect_edge_pending`
  - `foreground_window_inspect_bottom_edge_active`
  - `foreground_window_avoidance_active`
  - `foreground_window_bounds_updated`
- Fallback reasons:
  - `none`
  - `foreground_window_no_free_area_fallback`
  - `foreground_window_inspect_anchor_unavailable`
- Avoid-memory reasons:
  - `manual_window_avoid_recorded`
  - `window_avoid_cooldown_active`
  - `window_avoid_expired_reentry`
- Degraded reasons:
  - `foreground_window_provider_unavailable`
  - `foreground_window_query_failed`
- Disabled reasons:
  - `window_avoidance_not_desktop_mode`
  - `window_avoidance_not_supported_platform`

### Observability Contract (Status -> Behavior Runtime)
- Add bounded window-avoidance fields:
  - `Window Avoidance State`
  - `Window Avoidance Reason`
  - `Window Avoid Margin`
  - `Foreground Window Bounds`
  - `Foreground Window Revision`
  - `Window Inspect State`
  - `Window Inspect Reason`
  - `Window Inspect Anchor Lane`
  - `Window Inspect Anchor Point`
  - `Window Inspect Dwell`
  - `Avoid Mask Bounds`
  - `Window Avoid Fallback`
  - `Window Avoid Cooldown`
- `Behavior Runtime` row state rules:
  - `degraded` only for provider unavailable/query failure
  - `healthy` for nominal and active-avoidance paths
  - `disabled` when roaming mode/platform disables the slice
- Existing `14a` monitor-avoidance fields remain intact.

## Showcase Promise (Mandatory)
When the operator focuses a work window, the pet can inspect in `WatchMode` along the window's bottom edge (including bounded near-bottom on-window placement for back-turned viewing illusion). If the operator manually drags the pet off that window, the app records prolonged avoid memory for that window and enforces strict avoid clipping with explicit diagnostics. If no valid roam area remains, fallback reason is explicit and movement never stalls.

## Operator Demo Script (Mandatory)
1. Start app on Windows with `Roam: Desktop` active.
2. Open `Status...` and inspect `Behavior Runtime` detail.
3. Focus a medium/large app window near the center of the active monitor.
4. Wait for one roam decision cycle.
5. Within a few roam cycles, confirm `Window Inspect Reason` becomes `foreground_window_inspect_bottom_edge_active`, and pet dwells at a bottom-edge WatchMode anchor.
6. Resize or move the focused window while app is roaming.
7. Confirm `Foreground Window Revision` and `Avoid Mask Bounds` update deterministically after resize.
8. Manually drag the pet off the focused window region and release.
9. Confirm `manual_window_avoid_recorded` / `window_avoid_cooldown_active` is visible and strict avoidance activates for that window.
10. Force no-free-area by maximizing the same focused window to consume roam area.
11. Confirm `Window Avoid Fallback` is `foreground_window_no_free_area_fallback` and pet keeps moving.

## Failure / Recovery Script (Mandatory)
1. Simulate provider failure/unavailable for foreground-window lookup.
2. Confirm `Behavior Runtime` is degraded with:
   - `Window Avoidance State: degraded`
   - reason `foreground_window_provider_unavailable` or `foreground_window_query_failed`
3. Confirm roam still proceeds via baseline `14a` sampling (no freeze).
4. Restore provider capability.
5. Confirm status returns to healthy and inspect/avoid behavior resumes.

## Quick Operator Test Card (Mandatory)
### Preflight (2 min max)
1. Run: `npm start`
2. Open: tray `Status...` -> `Behavior Runtime` detail
3. Confirm start signal: `Window Avoidance State: healthy` and `Window Avoid Fallback: none`

### Happy Path (5 min max)
1. Action: focus a central foreground app window.
   - Expect: within a few cycles, `Window Inspect Reason: foreground_window_inspect_bottom_edge_active` and `Window Inspect Anchor Lane: bottom_edge`.
2. Action: watch one roam decision cycle.
   - Expect: pet performs bounded bottom-edge WatchMode inspect (may overlap only near-bottom window band), then resumes roaming.
3. Action: resize/move focused window.
   - Expect: foreground bounds/mask revision updates in diagnostics.
4. Action: drag pet off focused window area.
   - Expect: window avoid cooldown entry appears (`manual_window_avoid_recorded`).
5. Action: maximize foreground window to consume roam area.
   - Expect: `Window Avoid Fallback: foreground_window_no_free_area_fallback`.

### Failure + Recovery (5 min max)
1. Break it: force foreground-window provider unavailable/query failure.
   - Expect degraded signal: `Window Avoidance State: degraded` plus explicit degraded reason.
2. Recover it: restore provider and refresh status.
   - Expect recovered signal: `Window Avoidance State: healthy` and active mask behavior returns.

### Pass / Fail Checklist
- [x] Window-edge inspect state is visible and bounded.
- [x] WatchMode inspect anchor stays on focused window bottom edge with bounded near-bottom overlap only.
- [x] Focused-window resize/move recalculates avoid bounds.
- [x] Manual drag-off records prolonged window avoid cooldown.
- [x] No-free-area condition uses deterministic fallback without stall.
- [x] Provider failure is explicit and recoverable.

## Acceptance Evidence Checklist (Mandatory)
- [x] Status capture with `foreground_window_inspect_bottom_edge_active` and bottom-edge anchor fields.
- [x] Status capture showing resized window caused bounds/mask revision update.
- [x] Status capture with `manual_window_avoid_recorded` / active avoid cooldown.
- [x] Status capture with `foreground_window_no_free_area_fallback`.
- [x] Status capture with degraded provider reason and recovered healthy state.
- [x] Automated row `D14ab-active-window-avoidance` passed.

## Public Interfaces / Touchpoints
- Runtime helper: `foreground-window-runtime.js` (foreground bounds/provider wrapper).
- Policy extension in `roam-policy.js` for mask clipping + fallback reason wiring.
- `main.js` roam decision integration (compose `14a` sampling with `14ab` clipping).
- `shell-observability.js` and `inventory-shell-renderer.js` behavior-runtime fields.
- Deterministic checks:
  - `scripts/check-foreground-window-runtime.js`
  - `scripts/check-roam-policy.js` expansion for clipping/fallback taxonomy
  - acceptance row `D14ab-active-window-avoidance` in `scripts/run-acceptance-matrix.js`.

## Cross-Slice Handoff (`14b`)
- `14ab` uses existing `WatchMode` only as a bounded inspect posture/anchor behavior.
- `14ab` does not claim media-event authority for behavior selection; that handoff belongs to `14b`.
- `14b` will extend this surface with media-aware window watch behaviors:
  - bottom-edge window watch anchors (center/right/left deterministic order) when video playback is active
  - edge walk/pacing and bounded bounce interactions around active playback window
  - deterministic arbitration between roam, inspect, and watch activities
- Existing runtime signals to reuse in `14b` (already available):
  - foreground window bounds/identity (`windowId`, bounds revisions from this slice)
  - local media playback probe (`isPlaying`, `sourceAppLabel`, provider) from Windows GSMTC sensor
  - ambient state/runtime context (`currentState`, roam phase, dialog hold gates)

## Acceptance Bar
- Foreground-window-only detection drives deterministic inspect + avoid behavior.
- Edge-inspect behavior is bounded and observable.
- WatchMode inspect uses bottom-edge anchoring with bounded near-bottom on-window overlap for the back-turned viewing illusion.
- Focused-window resize/move deterministically recalculates mask/anchor bounds.
- Manual drag-off correction records prolonged avoid memory for the active window.
- Margin and clipped free-area fallback behavior are deterministic and observable.
- Provider failures degrade safely with explicit reason labels.
- No-free-area path always falls back deterministically and keeps movement active.
- Baseline movement invariants and main-process authority remain intact.

## Implementation Slice (Mandatory)
- First vertical slice shipped:
  - added foreground-window runtime provider wrapper:
    - `foreground-window-runtime.js`
    - `scripts/foreground-window-probe.ps1`
    - bounded normalization + failure taxonomy (`foreground_window_provider_unavailable`, `foreground_window_query_failed`)
  - extended `roam-policy.js` with:
    - active-window avoid memory keyed by `windowId`
    - strict free-area clipping planner + deterministic no-free-area fallback reason
    - bottom-edge inspect anchor resolver (`bottom_center` -> `bottom_right_quarter` -> `bottom_left_quarter`)
  - wired `main.js` runtime integration:
    - bounded foreground poll lane (`FOREGROUND_WINDOW_POLL_MS`)
    - resize/move bounds revision recalculation with in-leg replan trigger
    - inspect dwell phase (`inspect_dwell`) using `WatchMode` bottom-edge anchor contract
    - manual drag-off correction recording prolonged avoid cooldown (`WINDOW_AVOID_MS`)
  - exposed behavior/runtime observability:
    - `shell-observability.js` detail fields for window avoid state/reason, bounds revision, inspect anchor lane/point, mask bounds, cooldown entries, and fallback reason
    - `inventory-shell-renderer.js` behavior card summary for window avoid/inspect/fallback
  - deterministic coverage + acceptance wiring:
    - new `scripts/check-foreground-window-runtime.js`
    - expanded `scripts/check-roam-policy.js` and `scripts/check-shell-observability.js`
    - acceptance row `D14ab-active-window-avoidance` in `scripts/run-acceptance-matrix.js`
    - check lanes updated in `package.json` (`check:syntax`, `check:contracts`)
  - verification run passed:
    - `npm run check:syntax`
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `28/28`

## Visible App Outcome
- Visible app/runtime change delivered:
  - active foreground-window inspect now runs with bottom-edge `WatchMode` anchoring and bounded inspect dwell
  - manual drag-off correction now records prolonged per-window avoid cooldown and enforces strict clipping while active
  - focused-window resize/move now recalculates avoid mask/anchor bounds and publishes revision updates in behavior diagnostics
  - deterministic no-free-area fallback keeps roam active with explicit reason labels

## Acceptance Notes
- `2026-03-08`: Deliverable promoted from `queued` to active `specifying`.
- `2026-03-08`: Spec contract locked for activation boundary, geometry, fallback taxonomy, and observability fields.
- `2026-03-08`: `Spec Gate` passed.
- `2026-03-09`: First implementation slice shipped with deterministic checks green (`Build Gate` passed).
- `2026-03-09`: Operator happy-path demo checks passed (inspect bottom-edge, resize/move recalculation, manual window avoid cooldown, and no-free-area fallback).
- `2026-03-09`: Operator failure/recovery evidence passed; note that `Roam: zone` correctly reports `Window Avoidance State: disabled` (`roam_mode_not_desktop`), so degraded-provider verification must be run in `Roam: desktop`.
- `2026-03-09`: `Acceptance Gate` passed.

## Iteration Log
- `2026-03-08`: Rough-in created from user-requested narrow scope and deferred playful state policy.
- `2026-03-08`: Spec refined and locked to fallback-first foreground-window clipping contract with explicit degraded/recovery taxonomy.
- `2026-03-08`: Spec iterated to include first-slice edge-inspect behavior, resize/move mask recalculation, and user-signaled prolonged window-avoid memory.
- `2026-03-08`: Spec tightened so hard avoidance only activates after manual drag-off correction; default focused-window behavior remains inspect/perimeter.
- `2026-03-09`: Spec iterated to lock bottom-edge WatchMode anchor contract (back-turned viewing illusion), bounded near-bottom on-window overlap, and deterministic bottom-edge anchor order.
- `2026-03-09`: Implemented first slice (foreground provider + inspect lane + manual avoid memory + strict clipping fallback + behavior observability + deterministic acceptance wiring).
- `2026-03-09`: Iterated inspect behavior from operator runtime feedback:
  - desktop ambient rest no longer randomly forces `WatchMode` in desktop roam
  - added inspect cadence gates (focus stability + global/per-window cooldown + bounded trigger probability) to stop constant window-hopping watch loops
  - bottom-edge inspect anchor selection is now closer-biased with bounded randomness (not center-only)
  - added bottom-edge grace allowance for fullscreen/lower-edge windows to avoid inspect/avoid thrash
- `2026-03-09`: Tuned inspect/avoid timing and anchor preference from additional operator feedback:
  - increased inspect dwell target to `6000ms` so `WatchMode` activity is less twitchy
  - increased manual window-avoid cooldown target to `300000ms` for longer post-correction avoidance memory
  - strengthened inspect cadence gating (`focus=1800ms`, `global=22000ms`, `per-window=70000ms`, trigger probability `0.45`)
  - changed bottom-edge anchor scoring to prefer right/left corners while still mixing center/right/left selections deterministically
- `2026-03-09`: Applied additional runtime behavior stability tuning from operator feedback:
  - `MusicChill` is now treated as ambient so roam/idle and other higher-priority states can still occur while music is active
  - media suggestion lane now increases `MusicDance` frequency for music playback and routes likely video playback to `WatchMode` (provider/title/browser-window heuristics)
  - roam target sampling now avoids immediate left-right reversal after a completed roam leg until a short idle interval passes
  - manual drag/fling now resets roam-direction memory so post-correction direction is unconstrained
- `2026-03-09`: Added Idle-dwell stabilization and ambient Idle reassert behavior:
  - desktop roam now enforces an Idle-only minimum dwell (`IDLE_STATE_MIN_DWELL_MS`, target `5000ms`) before the next autonomous roam leg can begin
  - ambient rest same-state short-circuit now still suppresses non-Idle repeats, but allows `Idle` reassert activation so Idle remains the dominant/common ambient state
- `2026-03-09`: Roam locomotion polish from operator feedback:
  - `Run` selection is now hard-gated by run-distance threshold only; short roam legs always use `Walk` (including queued roam destinations)
- `2026-03-09`: Roam run-gating verification/fix pass:
  - run-threshold evaluation now uses live leg-start distance (`current window position -> selected destination`) rather than cached candidate distance, preventing false short-hop `Run` picks after position/context drift
- `2026-03-09`: Media behavior iteration from operator feedback (YouTube misclassified as dance + long dance lock-in):
  - hardened browser/video-vs-music suggestion heuristics to reduce false `MusicDance` on browser video playback:
    - browser-source detection now includes provider plus source/process hints (`edge/chrome/firefox/brave/opera/vivaldi`)
    - browser suggestions now prefer `WatchMode` by default unless explicit music hints are present, with strong music overrides for sources such as `music.youtube.com` / `YouTube Music`
  - bounded `MusicDance` runtime dwell:
    - media-triggered `MusicDance` now uses a fixed short duration (`5200ms`) with deterministic return to `Idle` on completion
    - goal: preserve dance behavior while restoring ambient variation (`Idle`/`Roam`) during longer playback sessions
  - deterministic coverage update:
    - expanded `scripts/check-state-runtime.js` to assert music-state duration override + on-complete fallback behavior
- `2026-03-09`: Media-watch runtime stability pass from operator logs (watch slide + repeated unchanged announcements):
  - fixed media-triggered watch entry to route through bottom-edge movement before dwell:
    - added media watch bottom-edge destination resolver using foreground-window anchor contract
    - media `WatchMode` now queues/starts a roam leg to bottom edge first, then enters watch dwell at anchor (prevents idle/watch slide movement)
    - media watch no longer falls back to in-place `WatchMode`; if no bottom-edge anchor is available, watch activation is skipped for that cycle
  - increased media watch dwell target (`MEDIA_WATCHMODE_DWELL_MS=30000`) so playback watch sessions hold longer before returning to ambient roam
  - tightened unchanged-media event suppression:
    - local media event contract now de-duplicates on stable media signature (`provider/title/artist/album/source/route/suggested-state`)
    - reduced probe-key churn by collapsing playback status jitter (`Playing` vs `Changing`), ignoring output-device-name noise, and dropping volatile `sourceAppUserModelId` from change-keying
    - added local-media stop debounce (`LOCAL_MEDIA_STOP_DEBOUNCE_MS=8000`) so short playback probe dropouts do not reset media signature / retrigger repeated announcements
    - outcome: unchanged playback should no longer spam repeated `PET_RESPONSE` announcements each poll cycle
  - strengthened media watch anchor recovery:
    - bottom-edge anchor resolution now tries active-display clamp area first, then full display bounds, then desktop sampling plan fallback to reduce missed watch anchors
  - deterministic coverage update:
    - expanded `scripts/check-windows-media-sensor.js` to assert probe-key stability under playback/output jitter
- `2026-03-09`: Media-watch focus/anchor follow-up from operator feedback (hold while focused + corner bias):
  - media watch dwell now extends in bounded chunks while the watched window remains focused:
    - inspect dwell re-arms by `12000ms` while focused-window id matches the active media watch target
    - focus-loss release guard (`1200ms`) ends watch promptly when operator focus moves away
    - local-media stop no longer forces immediate watch exit while focus-hold is active on the watched window
  - media watch anchor selection now uses a dedicated corner-preferred profile:
    - bottom-right/bottom-left are strongly favored
    - bottom-center remains available as occasional variation/fallback
  - deterministic coverage update:
    - expanded `scripts/check-roam-policy.js` with corner-preferred media-watch anchor assertions
- `2026-03-09`: Startup-playing-media loop fix from operator logs (repeated unchanged media speech while app cycles Idle):
  - removed forced local-media contract polling on every `Idle` re-entry while media is already playing
  - local-media de-dup now treats non-manual forced polls as duplicate-suppressible for unchanged signatures
  - outcome: unchanged startup playback no longer repeatedly emits `MEDIA`/`PET_RESPONSE` chatter each ambient Idle cycle
  - verification:
    - `npm run check:contracts`
    - `npm run check:acceptance` (`28/28`)

## Gate Status
- `Spec Gate`: `passed` (`2026-03-08`)
- `Build Gate`: `passed` (`2026-03-09`)
- `Acceptance Gate`: `passed` (`2026-03-09`)
- `Overall`: `accepted`

## Change Log
- `2026-03-08`: File created as queued follow-on deliverable after `14a`.
- `2026-03-08`: Activated `14ab` for spec work and finalized first-slice spec gate contract.
- `2026-03-08`: Updated scope to include edge-inspect state and manual window-avoid memory; added explicit resize/move recalculation contract.
- `2026-03-08`: Added explicit `14b` handoff contract for media-aware playful watch behaviors.
- `2026-03-09`: Added bottom-edge WatchMode-specific inspect fields/reasons and updated demo/evidence scripts to assert bottom-edge placement behavior.
- `2026-03-09`: First implementation slice shipped (`foreground-window-runtime`, `roam-policy` extension, `main.js` integration, observability updates, deterministic checks, and acceptance row wiring).
- `2026-03-09`: WatchMode/inspect behavior tuned from runtime feedback (closer-biased anchor selection, inspect cadence gates, fullscreen bottom-edge grace handling, desktop random WatchMode suppression).
- `2026-03-09`: WatchMode/avoidance timing tuned (longer inspect dwell + longer window avoid cooldown) and anchor weighting adjusted to corner-preferred mixed selection.
- `2026-03-09`: Media/roam behavior tuning shipped (`MusicDance` frequency increase, video-to-`WatchMode` routing heuristics, `MusicChill` ambient eligibility, and immediate reverse-direction roam suppression with drag/fling reset).
- `2026-03-09`: Roam speed selection tightened so short-distance legs never use `Run`.
- `2026-03-09`: Run-threshold calculation corrected to live leg-start distance to prevent residual short-distance `Run` selections.
- `2026-03-09`: Media classifier hardened for browser playback and `MusicDance` now has bounded short dwell (`5200ms`) with return to `Idle`, reducing YouTube false-dance cases and long unvaried dance lock-in.
- `2026-03-09`: Media `WatchMode` now routes to bottom-edge anchors before dwell, holds longer (`30000ms`), and suppresses unchanged playback chatter via local-media signature de-dup + probe-key jitter hardening.
- `2026-03-09`: Media jitter hardening tightened further (stop debounce + volatile source id removed from media probe key/signature) and media watch anchor recovery now retries across display clamp/full-bounds sets before skipping activation.
- `2026-03-09`: Media watch now holds by focused-window continuity (`12000ms` extension chunks, `1200ms` focus-loss release) and uses corner-preferred bottom-edge anchor bias for media-triggered WatchMode.
- `2026-03-09`: Removed forced `idle-resume` media contract routing to prevent startup-playing-media announce loops; unchanged playback now stays de-duplicated during ambient Idle cycling.
- `2026-03-09`: Failure/recovery acceptance evidence confirmed; in `Roam: zone` behavior-runtime correctly reports `disabled` (`roam_mode_not_desktop`), and in `Roam: desktop` provider disable/restore verified degraded -> healthy recovery.

