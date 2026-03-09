# Deliverable 14b: Event-Driven Watch Behavior

**Deliverable ID:** `14b-event-driven-watch-behavior`  
**Status:** `queued`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-09`  
**Depends On:** `14ab-active-window-avoidance`  
**Blocks:** `14c-touch-and-gaze-reactions`

## Objective
Promote playful window inspection into a deterministic media-aware watch system so the pet can watch active playback windows from a bottom-edge lane (back-turned screen-facing illusion), alternate watch-side behaviors, and roam less mechanically while preserving movement authority and guardrails.

## In Scope
- Event-driven watch trigger from existing local media session telemetry (`isPlaying`, `sourceAppLabel`, provider).
- Coupling playback signal with foreground-window bounds from `14ab` to pick one active watch target.
- Deterministic watch anchor policy:
  - bottom-edge anchors only (to preserve back-turned facing-screen animation illusion)
  - deterministic anchor order: `bottom_center` -> `bottom_right_quarter` -> `bottom_left_quarter`
  - bounded on-window placement allowed only in bottom-edge band inherited from `14ab`
  - if no bottom-edge anchor is valid, suppress watch anchor with explicit fallback reason (no top/side fallback anchors in first slice)
- Playful watch behavior lanes:
  - `window_perch_watch` (sit/stare at contents)
  - `window_edge_patrol` (walk edge while peering in)
  - `window_run_bounce` (bounded run to edge + bounce-off reaction)
- Utility/FSM/BT planning for watch-vs-roam arbitration using deterministic `events + time` inputs.
- Observability fields for target window, playback source, selected watch behavior, and suppression/fallback reasons.

## Out of Scope
- Deep video-content introspection (frame/scene understanding).
- Browser extension hooks or per-site APIs.
- Multi-window watch orchestration beyond one active target.
- AI-driven direct movement/state writes.
- Any changes to main-process drag/clamp authority invariants.

## Environment / Prerequisites
- `14ab` implementation complete and accepted (foreground-window runtime + inspect/avoid policy).
- Windows local media sensor enabled and healthy.
- `Roam: Desktop` enabled.
- Sprite/animation contract checks available.

## Showcase Promise (Mandatory)
When media playback is active on a focused window, the pet moves to a deterministic bottom-edge watch anchor for a back-turned viewing illusion and cycles playful watch behaviors instead of constant generic roaming, while exposing explicit reason/fallback visibility.

## Operator Demo Script (Mandatory)
1. Start app on Windows with `Roam: Desktop` active.
2. Open `Status...` -> `Behavior Runtime` detail.
3. Start a video in a detectable media app (for example YouTube in browser, VLC, or Windows Media Player) and focus the playback window.
4. Wait one behavior decision cycle.
5. Confirm pet moves to a bottom-edge watch anchor (`bottom_center` or deterministic bottom-edge fallback if blocked).
6. Keep playback active and observe at least two watch behavior transitions (`window_perch_watch`, `window_edge_patrol`, or `window_run_bounce`).
7. Pause/stop playback.
8. Confirm pet exits watch behavior and returns to normal roam arbitration.

## Failure / Recovery Script (Mandatory)
1. Simulate media-sensor degraded/unavailable while a playback window is focused.
2. Confirm watch behavior is suppressed with explicit reason and pet falls back safely (no freeze).
3. Restore media sensor and playback.
4. Confirm watch behavior resumes with deterministic target/anchor selection.

## Quick Operator Test Card (Mandatory)
### Preflight (2 min max)
1. Run: `npm start`
2. Open: tray `Status...` -> `Behavior Runtime` detail
3. Confirm start signal: `Watch Behavior: idle` and media sensor healthy.

### Happy Path (5 min max)
1. Action: start/focus active video playback window.
   - Expect: `Watch Target` populated with source app + bounds.
2. Action: wait one decision cycle.
   - Expect: pet settles at bottom-edge watch anchor (or explicit bottom-edge anchor unavailable reason).
3. Action: continue playback for another cycle.
   - Expect: playful watch behavior transition visible without motion instability.

### Failure + Recovery (5 min max)
1. Break it: disable/degrade media sensor during playback.
   - Expect degraded signal: explicit watch suppression reason.
2. Recover it: re-enable sensor and resume playback.
   - Expect recovered signal: watch target and watch behavior re-activate.

### Pass / Fail Checklist
- [ ] Playback-triggered watch target selection is visible.
- [ ] Bottom-edge-only watch anchor behavior is visible.
- [ ] Playful watch behaviors occur without drag/clamp regressions.
- [ ] Degraded media path is explicit and recoverable.

## Acceptance Evidence Checklist (Mandatory)
- [ ] Status capture with active watch target + anchor reason.
- [ ] Status capture showing at least one playful watch behavior transition.
- [ ] Status capture for degraded media sensor suppression and recovery.
- [ ] Automated row `D14b-event-driven-watch-behavior` passed.

## Public Interfaces / Touchpoints
- `main.js` behavior arbitration + roam/watch decision integration.
- `windows-media-sensor.js` playback signal consumption and normalization.
- `foreground-window-runtime.js` output from `14ab` for watch target window.
- `state-runtime.js` / `config/state-catalog.json` behavior-state integration.
- `shell-observability.js` + `inventory-shell-renderer.js` behavior/watch diagnostics.
- Planned checks:
  - `scripts/check-watch-behavior-policy.js`
  - `scripts/check-state-runtime.js` expansion for watch transitions
  - acceptance row `D14b-event-driven-watch-behavior` in `scripts/run-acceptance-matrix.js`.

## Acceptance Bar
- Active playback can deterministically trigger a focused-window watch behavior.
- Bottom-edge-only anchor contract works with explicit suppression/fallback reason when blocked.
- Playful watch behavior lanes are visible and bounded.
- Failure/recovery paths are explicit, deterministic, and non-stalling.
- Main-process movement authority and clamp invariants remain intact.

## Implementation Slice (Mandatory)
- Not started (`queued`).
- First implementation target (post-`14ab` acceptance):
  - watch target resolver (`media + foreground window`)
  - bottom-edge anchor selection + bottom-edge-only fallback/suppression reasons
  - initial playful watch lane sequencing
  - diagnostics + deterministic contract checks + acceptance row

## Visible App Outcome
- No visible app/runtime change in this session (`queued planning draft only`).

## Acceptance Notes
- Not started.

## Iteration Log
- `2026-03-08`: Queued draft created to capture post-`14ab` playful watch behavior contract.
- `2026-03-09`: Anchor policy aligned with `14ab` bottom-edge WatchMode contract (no side/top fallback anchors in first slice).

## Gate Status
- `Spec Gate`: `not_started`
- `Build Gate`: `not_started`
- `Acceptance Gate`: `not_started`
- `Overall`: `queued`

## Change Log
- `2026-03-08`: File created from post-`14ab` handoff planning.
- `2026-03-09`: Replaced lower-right-first anchor language with bottom-edge-only watch anchor contract.
