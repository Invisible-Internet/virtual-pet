# Deliverable 14ab: Active Window Avoidance

**Deliverable ID:** `14ab-active-window-avoidance`  
**Status:** `queued`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-08`  
**Depends On:** `14a-deliberate-roam-policy-and-monitor-avoidance`  
**Blocks:** `14b-event-driven-watch-behavior`

## Objective
Add a narrow, deterministic foreground-window avoidance layer so the pet avoids walking in front of the currently active window on a single monitor, while preserving movement authority and graceful fallback behavior.

## In Scope
- Active foreground window only (single-window awareness for first slice).
- Rectangular avoid mask derived from foreground window bounds, plus a bounded margin.
- Deterministic fallback when no free roam area remains after mask application.
- Explicit observability and degraded reasons for detection/avoidance outcomes.
- Windows-only support boundary for this slice.

## Out of Scope
- Multi-window prioritization or per-app policy rules.
- Deep window introspection beyond bounds/foreground identity.
- New direct interactions with app internals.
- Playful `window-edge inspect` behavior states in this first slice.

## Environment / Prerequisites
- `14a` accepted baseline.
- Windows runtime (foreground window bounds provider available).
- `Roam: Desktop` enabled.
- Diagnostics/status surface available for behavior observability.

## Showcase Promise (Mandatory)
When the operator focuses a work window, the pet avoids roaming through that foreground window's rectangular mask (plus margin); if no valid roam area remains, the app reports deterministic fallback behavior instead of stalling movement.

## Operator Demo Script (Mandatory)
1. Start app on Windows with `Roam: Desktop` active.
2. Open `Status...` and inspect behavior/roam diagnostics detail.
3. Focus a medium-to-large app window in the center of the active monitor.
4. Observe autonomous roam for at least one decision cycle.
5. Confirm pet path avoids foreground-window mask region.
6. Move/resize or switch foreground window and refresh diagnostics.
7. Confirm avoid mask updates with explicit reason/state.
8. Force no-free-area condition (maximize/position foreground window to consume roam zone).
9. Confirm deterministic fallback reason is visible and pet does not freeze.

## Failure / Recovery Script (Mandatory)
1. Simulate foreground-window detection unavailable (runtime capability disabled/failing).
2. Confirm degraded reason is explicit in diagnostics and roam continues via bounded baseline policy.
3. Restore foreground-window detection capability.
4. Confirm diagnostics return to healthy and avoid mask resumes.

## Quick Operator Test Card (Mandatory)
### Preflight (2 min max)
1. Run: `npm start`
2. Open: tray `Status...` -> behavior/roam diagnostics detail
3. Confirm start signal: `Window Avoidance: enabled` (or equivalent ready signal)

### Happy Path (5 min max)
1. Action: focus a central foreground app window.
   - Expect: diagnostics show active avoid mask with window bounds + margin.
2. Action: watch one roam decision cycle.
   - Expect: pet avoids mask region while still moving.
3. Action: focus a different app window.
   - Expect: mask target updates deterministically to new foreground window.

### Failure + Recovery (5 min max)
1. Break it: force/trigger foreground-window detection unavailable.
   - Expect degraded signal: explicit reason (`foreground_window_unavailable` or equivalent).
2. Recover it: restore detection and refresh status.
   - Expect recovered signal: active mask resumes with no motion stall.

### Pass / Fail Checklist
- [ ] Foreground window mask is visible in diagnostics.
- [ ] Pet avoids masked region in happy path.
- [ ] No-free-area condition uses deterministic fallback.
- [ ] Detection failure is explicit and recoverable.

## Acceptance Evidence Checklist (Mandatory)
- [ ] Diagnostics capture with active foreground mask + margin.
- [ ] Diagnostics capture for no-free-area fallback reason.
- [ ] Diagnostics capture for degraded detection + recovered state.
- [ ] Automated row `D14ab-active-window-avoidance` passed.

## Public Interfaces / Touchpoints
- Planned runtime helper: `foreground-window-runtime.js` (or equivalent provider wrapper).
- Planned policy helper extension in `roam-policy.js` for mask clipping/fallback rules.
- `main.js` roam decision integration.
- `shell-observability.js` and/or `inventory-shell-renderer.js` behavior diagnostics rows/details.
- Planned checks:
  - `scripts/check-foreground-window-runtime.js`
  - `scripts/check-roam-policy.js` expansion
  - acceptance row in `scripts/run-acceptance-matrix.js`.

## Acceptance Bar
- Foreground-window-only detection drives deterministic avoid mask behavior.
- Margin application and fallback behavior are deterministic and observable.
- Failure modes degrade safely with explicit reason labels.
- Baseline movement invariants and main-process authority remain intact.
- `window-edge inspect` states remain deferred until stability is proven.

## Implementation Slice (Mandatory)
- Not started (`queued`).
- First implementation target after `14a` acceptance:
  - foreground-window bounds provider
  - avoid-mask clipping layer + margin
  - fallback reason taxonomy
  - minimal status diagnostics
  - deterministic checks + acceptance row

## Visible App Outcome
- No visible app/runtime change in this session (`queued rough-in only`).
- Future `14ab` path is now documented and sequenced after `14a`.

## Acceptance Notes
- Not started.

## Iteration Log
- `2026-03-08`: Rough-in created from user-requested narrow scope and deferred playful state policy.

## Gate Status
- `Spec Gate`: `not_started`
- `Build Gate`: `not_started`
- `Acceptance Gate`: `not_started`
- `Overall`: `queued`

## Change Log
- `2026-03-08`: File created as queued follow-on deliverable after `14a`.
