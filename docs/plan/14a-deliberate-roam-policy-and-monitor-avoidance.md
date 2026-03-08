# Deliverable 14a: Deliberate Roam Policy and Monitor Avoidance

**Deliverable ID:** `14a-deliberate-roam-policy-and-monitor-avoidance`  
**Status:** `specifying`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-08`  
**Depends On:** `13d-online-reflection-and-runtime-sync`  
**Blocks:** `14ab-active-window-avoidance`

## Objective
Make desktop roaming feel deliberate and unobtrusive by adding deterministic pacing plus bounded monitor-avoidance memory after manual user corrections, while keeping existing drag/clamp/state authority invariants unchanged.

## In Scope
- Deterministic roam pacing policy for ambient desktop roaming:
  - bounded rest windows and retry behavior for roam-leg selection
  - explicit decision reasons emitted by runtime policy
- Bounded monitor-avoidance memory in desktop roam mode:
  - record avoidance when manual drag/fling correction moves the pet off a monitor
  - temporary avoid list keyed by display id with cooldown + expiry
  - deterministic fallback when all displays are temporarily avoided
- Roam observability signals sufficient for operator debugging:
  - current roam decision reason
  - active avoided displays and remaining avoid time
  - fallback/re-entry reason when avoidance expires or is bypassed
- Deterministic contract coverage + acceptance matrix row for `14a` first slice.

## Out of Scope
- Family-14 utility/FSM/micro-BT architecture changes (planned in downstream slices).
- New animation states or sprite-sheet contract changes.
- Replacing zone roam mode semantics beyond compatibility with the new desktop avoidance policy.
- New settings-surface controls for roam policy tuning in this first slice.
- Foreground app-window detection/avoidance (tracked in `14ab-active-window-avoidance`).

## Environment / Prerequisites
- Existing accepted baseline through `13d`.
- Desktop with at least two active monitors for full `14a` monitor-avoidance validation.
- `Roam: Desktop` enabled from the shell/tray controls.
- Chat surface closed while validating autonomous roam movement.

## Showcase Promise (Mandatory)
When the operator manually pushes the pet from one monitor to another, the pet keeps roaming deliberately on the current monitor and temporarily avoids returning to the pushed-away monitor, with visible runtime signals showing why avoidance is active and when it clears.

## Operator Demo Script (Mandatory)
1. Start app on a multi-monitor setup with `Roam: Desktop` active.
2. Open `Status...` and inspect the `Behavior Runtime` detail (or equivalent roam diagnostics surface added by this slice).
3. Drag the pet from Monitor A to Monitor B and release.
4. Wait for one roam decision cycle.
5. Confirm visible avoidance signals show Monitor A as temporarily avoided with a remaining-time/expiry indicator.
6. Confirm autonomous roam remains active on Monitor B (pet is not stuck and does not immediately return to Monitor A).
7. Trigger recovery (either wait expiry or use bounded clear action if shipped in this slice).
8. Confirm avoidance state clears and re-entry eligibility is visible.

## Failure / Recovery Script (Mandatory)
1. Force an avoidance-exhaustion scenario by manually pushing the pet away from each available monitor in short succession.
2. Confirm runtime enters explicit fallback state (`avoidance_exhausted_fallback` or equivalent) instead of freezing roam.
3. Confirm pet still roams on at least one eligible/fallback display with bounded pacing.
4. Recover by clearing avoidance memory (or waiting bounded expiry window).
5. Confirm fallback state clears and normal multi-monitor eligibility resumes.

## Quick Operator Test Card (Mandatory)
### Preflight (2 min max)
1. Run: `npm start`
2. Open: tray `Status...` -> `Behavior Runtime` detail (or `Roam Diagnostics` detail if named differently in implementation)
3. Confirm start signal: `Roam Policy: Active` and `Avoided Displays: none`

### Happy Path (5 min max)
1. Action: set `Roam: Desktop` in shell controls.
   - Expect: roam mode shows desktop and policy detail remains active.
2. Action: drag pet from Monitor A to Monitor B.
   - Expect: `Avoided Displays` shows Monitor A with remaining cooldown/expiry.
3. Action: observe one autonomous roam cycle on Monitor B.
   - Expect: decision reason indicates deliberate roam leg without immediate return to Monitor A.

### Failure + Recovery (5 min max)
1. Break it: create avoidance entries for all displays by repeated manual push-away.
   - Expect degraded signal: explicit fallback reason (`avoidance_exhausted_fallback`) with roam still running.
2. Recover it: clear avoidance memory (or wait expiry) and refresh status.
   - Expect recovered signal: `Avoided Displays: none` and normal eligibility restored.

### Pass / Fail Checklist
- [ ] Manual cross-monitor correction creates a visible avoidance entry.
- [ ] Pet remains mobile (not stuck) while avoidance is active.
- [ ] Exhausted-avoidance path shows explicit fallback reason.
- [ ] Recovery clears avoidance and restores normal eligibility.

## Acceptance Evidence Checklist (Mandatory)
- [ ] `Behavior Runtime`/roam diagnostics detail capture showing active monitor avoidance.
- [ ] Capture showing exhausted-fallback reason while roam remains active.
- [ ] Capture showing recovered state (`Avoided Displays: none`).
- [ ] Automated row `D14a-deliberate-roam-monitor-avoidance` passed.

## Public Interfaces / Touchpoints
- `main.js` roam policy and monitor-selection logic.
- `inventory-shell-renderer.js` roam diagnostics presentation (if detail is surfaced in shell).
- `shell-observability.js` behavior/roam detail payload (if status surface is used).
- New helper module (planned): `roam-policy.js` for deterministic pacing/avoidance logic.
- Deterministic checks (planned):
  - `scripts/check-roam-policy.js`
  - acceptance row in `scripts/run-acceptance-matrix.js`.

## Acceptance Bar
- Main-process drag/movement/clamp authority remains intact.
- Desktop roam uses bounded monitor-avoidance memory with explicit cooldown/expiry semantics.
- Exhausted-avoidance fallback is deterministic and never stalls roam.
- Operator can see why avoidance is active, why fallback occurred, and when recovery happened.
- Deterministic check script(s) and acceptance row pass.

## Implementation Slice (Mandatory)
- Spec-only session; implementation not started.
- First planned vertical slice:
  - add pure deterministic roam policy helper for pacing + monitor avoidance memory
  - wire policy into `chooseRoamDestination`/roam decision loop
  - expose minimal runtime diagnostics for avoidance state and decision reasons
  - add deterministic check + acceptance matrix row

## Visible App Outcome
- No visible app/runtime change in this session (`spec-only`).
- `14a` contracts are now locked so implementation can start after this spec handoff.

## Acceptance Notes
- `2026-03-08`: Deliverable created from template and spec contract locked.
- `2026-03-08`: `Spec Gate` passed; implementation intentionally not started.

## Iteration Log
- `2026-03-08`: Locked first-slice `14a` scope to deterministic roam pacing + bounded monitor-avoidance memory + explicit roam diagnostics.

## Gate Status
- `Spec Gate`: `passed` (`2026-03-08`)
- `Build Gate`: `not_started`
- `Acceptance Gate`: `not_started`
- `Overall`: `specifying`

## Change Log
- `2026-03-08`: File created from the post-v1 deliverable template.
- `2026-03-08`: Spec contract finalized; implementation deferred until post-spec session.
