# Deliverable 14ab: Active Window Avoidance

**Deliverable ID:** `14ab-active-window-avoidance`  
**Status:** `specifying`  
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
  - deterministic bottom-edge anchor order (all candidates stay on bottom edge lane):
    1. `bottom_center`
    2. `bottom_right_quarter`
    3. `bottom_left_quarter`
  - top/left/right-only anchors are disallowed for WatchMode inspect in this slice; if no bottom-edge anchor is valid, suppress inspect with fallback reason `foreground_window_inspect_anchor_unavailable`.
  - activate `WatchMode` at selected bottom-edge anchor for bounded dwell (`WINDOW_EDGE_INSPECT_DWELL_MS`, target `2500ms`).
  - inspect movement can overlap active window only inside `WINDOW_WATCH_BOTTOM_BAND_PX`; the pet must not roam into upper interior window area during inspect.
  - suppress inspect when active window has avoid-cooldown entry
- User-signaled avoid contract:
  - if manual drag starts in/near active-window mask and ends outside it, record avoid entry keyed by `windowId`
  - avoid entry duration is prolonged and bounded (`WINDOW_AVOID_MS`, target `120000ms`)
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
5. Confirm `Window Inspect Reason` becomes `foreground_window_inspect_bottom_edge_active`, and pet dwells at a bottom-edge WatchMode anchor.
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
   - Expect: `Window Inspect Reason: foreground_window_inspect_bottom_edge_active` and `Window Inspect Anchor Lane: bottom_edge`.
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
- [ ] Window-edge inspect state is visible and bounded.
- [ ] WatchMode inspect anchor stays on focused window bottom edge with bounded near-bottom overlap only.
- [ ] Focused-window resize/move recalculates avoid bounds.
- [ ] Manual drag-off records prolonged window avoid cooldown.
- [ ] No-free-area condition uses deterministic fallback without stall.
- [ ] Provider failure is explicit and recoverable.

## Acceptance Evidence Checklist (Mandatory)
- [ ] Status capture with `foreground_window_inspect_bottom_edge_active` and bottom-edge anchor fields.
- [ ] Status capture showing resized window caused bounds/mask revision update.
- [ ] Status capture with `manual_window_avoid_recorded` / active avoid cooldown.
- [ ] Status capture with `foreground_window_no_free_area_fallback`.
- [ ] Status capture with degraded provider reason and recovered healthy state.
- [ ] Automated row `D14ab-active-window-avoidance` passed.

## Public Interfaces / Touchpoints
- Planned runtime helper: `foreground-window-runtime.js` (foreground bounds/provider wrapper).
- Planned policy extension in `roam-policy.js` for mask clipping + fallback reason wiring.
- `main.js` roam decision integration (compose `14a` sampling with `14ab` clipping).
- `shell-observability.js` and `inventory-shell-renderer.js` behavior-runtime fields.
- Planned checks:
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
- Not started (`specifying`, post-Spec-Gate; implementation intentionally deferred).
- First implementation target:
  - foreground-window provider wrapper + bounded failure taxonomy
  - bounds-refresh/revision lane for focused-window resize/move
  - inspect-edge lane (`WatchMode` + bottom-edge anchor + bounded dwell + near-bottom overlap guardrails)
  - manual window-avoid cooldown memory (drag-off correction)
  - strict mask clipping fallback layer (`14a`-composed) + margin contract
  - behavior-runtime observability fields
  - deterministic checks + acceptance row wiring

## Visible App Outcome
- No visible app/runtime change in this session (`spec-only contract lock`).
- Implementation remains blocked on this deliverable only (no parallel slice coding).

## Acceptance Notes
- `2026-03-08`: Deliverable promoted from `queued` to active `specifying`.
- `2026-03-08`: Spec contract locked for activation boundary, geometry, fallback taxonomy, and observability fields.
- `2026-03-08`: `Spec Gate` passed; implementation intentionally deferred by workflow rule.

## Iteration Log
- `2026-03-08`: Rough-in created from user-requested narrow scope and deferred playful state policy.
- `2026-03-08`: Spec refined and locked to fallback-first foreground-window clipping contract with explicit degraded/recovery taxonomy.
- `2026-03-08`: Spec iterated to include first-slice edge-inspect behavior, resize/move mask recalculation, and user-signaled prolonged window-avoid memory.
- `2026-03-08`: Spec tightened so hard avoidance only activates after manual drag-off correction; default focused-window behavior remains inspect/perimeter.
- `2026-03-09`: Spec iterated to lock bottom-edge WatchMode anchor contract (back-turned viewing illusion), bounded near-bottom on-window overlap, and deterministic bottom-edge anchor order.

## Gate Status
- `Spec Gate`: `passed` (`2026-03-08`)
- `Build Gate`: `not_started`
- `Acceptance Gate`: `not_started`
- `Overall`: `specifying`

## Change Log
- `2026-03-08`: File created as queued follow-on deliverable after `14a`.
- `2026-03-08`: Activated `14ab` for spec work and finalized first-slice spec gate contract.
- `2026-03-08`: Updated scope to include edge-inspect state and manual window-avoid memory; added explicit resize/move recalculation contract.
- `2026-03-08`: Added explicit `14b` handoff contract for media-aware playful watch behaviors.
- `2026-03-09`: Added bottom-edge WatchMode-specific inspect fields/reasons and updated demo/evidence scripts to assert bottom-edge placement behavior.

