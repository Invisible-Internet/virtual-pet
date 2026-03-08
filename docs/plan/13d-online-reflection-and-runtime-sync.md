# Deliverable 13d: Online Reflection and Runtime Sync

**Deliverable ID:** `13d-online-reflection-and-runtime-sync`  
**Status:** `specifying`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-08`  
**Depends On:** `13b-persona-snapshot-synthesis-and-provenance`, `13c-persona-aware-offline-dialog-and-proactive-behavior`  
**Blocks:** `14a-deliberate-roam-policy-and-monitor-avoidance`

## Objective
Add bounded online reflection sync so online context can suggest lightweight runtime updates through existing governance lanes, while keeping local canonical authority and deterministic conflict handling.

## In Scope
- Add bounded online cadence targets:
  - hourly heartbeat reflection
  - nightly digest reflection
- Keep log-first behavior for online reflection artifacts using existing markdown logging lanes.
- Apply online reflection suggestions through existing guarded policy/application lanes (no direct raw file write from bridge context).
- Define deterministic conflict precedence between online suggestions and local runtime/canonical truth.
- Add operator-visible observability for last reflection run, outcome, and suppression/failure reason.
- Add deterministic checks and one acceptance row for `13d`.

## Out of Scope
- New provider/model transport families.
- Direct OpenClaw write authority to canonical files.
- Unbounded autonomous memory editing.
- Family-14 embodiment behavior changes.

## Environment / Prerequisites
- Post-`13c` runtime with persona-aware offline behavior and acceptance coverage.
- OpenClaw bridge lane available for online reflection mode (`openclaw.enabled=true`) during happy-path demo.
- Existing memory/log governance lanes available (`memory-pipeline`, markdown logs, promotion policy).

## Showcase Promise (Mandatory)
When online bridge is healthy, the app performs bounded reflection cadence (heartbeat/digest) and surfaces deterministic sync outcomes in `Status`, while degraded/disabled bridge states fail safely without violating local governance.

## Operator Demo Script (Mandatory)
1. Start app with valid local canonical workspace and enable OpenClaw service in `Settings`.
2. Confirm bridge enters healthy mode in `Status`.
3. Trigger or wait for one reflection cycle (heartbeat lane).
4. Confirm `Status` shows reflection metadata (last run time, outcome, source, and any applied suggestion count).
5. Ask one online-capable prompt and confirm reflection metadata updates without restart.
6. Confirm local governance remains bounded (no raw direct overwrite behavior outside managed/app-authority lanes).

## Failure / Recovery Script (Mandatory)
1. Disable OpenClaw service or point bridge to an unavailable endpoint.
2. Trigger/await reflection cycle.
3. Confirm reflection is suppressed/degraded with explicit reason and no unsafe writes.
4. Re-enable/repair OpenClaw connectivity.
5. Trigger/await next reflection cycle.
6. Confirm reflection resumes and status detail returns to healthy metadata.

## Quick Operator Test Card (Mandatory)
### Preflight (2 min max)
1. Run: `npm start`
2. Open: tray `Advanced Settings...` and tray `Status...`
3. Confirm start signal: app responsive, `Status` details load, no blank panels

### Happy Path (5 min max)
1. Action: enable OpenClaw service and save settings.
   - Expect: bridge health reflects online-ready state.
2. Action: run/await one reflection cycle.
   - Expect: reflection metadata appears and shows successful run.
3. Action: ask one online-capable prompt and refresh status.
   - Expect: reflection metadata updates with new timestamp/outcome.

### Failure + Recovery (5 min max)
1. Break it: disable OpenClaw service and run/await reflection.
   - Expect degraded signal: explicit suppressed/degraded reason, no unsafe apply.
2. Recover it: re-enable service and run/await reflection again.
   - Expect recovered signal: healthy reflection metadata and resumed cadence.

### Pass / Fail Checklist
- [ ] Reflection metadata is visible and refreshable in `Status`.
- [ ] Online reflection does not bypass local governance boundaries.
- [ ] Disabled/degraded bridge state is explicit and safe.
- [ ] Reflection resumes after bridge recovery without restart.

## Acceptance Evidence Checklist (Mandatory)
- [ ] `Status` capture showing reflection metadata after a successful online cycle.
- [ ] Degraded/suppressed capture with explicit reason when bridge is unavailable.
- [ ] Recovery capture showing resumed reflection after bridge restore.
- [ ] Deterministic check output line captured for `D13d-online-reflection-runtime-sync`.

## Public Interfaces / Touchpoints
- `main.js`
- `pet-contract-router.js`
- `openclaw-bridge.js`
- `memory-pipeline.js`
- `shell-observability.js`
- `scripts/check-*.js` coverage for reflection cadence/governance
- `scripts/run-acceptance-matrix.js` (new `13d` row)

## Acceptance Bar
- Reflection cadence behavior is bounded, observable, and policy-governed.
- Online suggestions are applied only through app-owned guarded lanes.
- Disabled/degraded bridge behavior is explicit, safe, and recoverable.
- New `13d` deterministic acceptance row passes.

## Implementation Slice (Mandatory)
- Not started (specifying phase).

## Visible App Outcome
- No visible app change yet (specifying only).

## Acceptance Notes
- `2026-03-08`: Deliverable opened after operator accepted `13c` and requested progression.

## Iteration Log
- `2026-03-08`: Initial `13d` spec created from family rough intent and post-`13c` boundary decisions.

## Gate Status
- `Spec Gate`: `not_started`
- `Build Gate`: `not_started`
- `Acceptance Gate`: `not_started`
- `Overall`: `specifying`

## Change Log
- `2026-03-08`: File created from the post-v1 deliverable template for `13d`.
