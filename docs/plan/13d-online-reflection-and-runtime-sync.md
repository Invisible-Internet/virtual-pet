# Deliverable 13d: Online Reflection and Runtime Sync

**Deliverable ID:** `13d-online-reflection-and-runtime-sync`  
**Status:** `implementing`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-08`  
**Depends On:** `13b-persona-snapshot-synthesis-and-provenance`, `13c-persona-aware-offline-dialog-and-proactive-behavior`  
**Blocks:** `14a-deliberate-roam-policy-and-monitor-avoidance`

## Objective
Add bounded online reflection sync so online context can suggest lightweight runtime updates through existing governance lanes, while local canonical authority remains final and deterministic.

## In Scope
- Reflection scheduler in app runtime:
  - hourly heartbeat (wall clock)
  - daily digest at `2:00 AM` local wall clock
  - startup catch-up executes one due cycle if overdue
  - overlap suppression (`suppressed_in_flight`)
  - one bounded retry:
    - heartbeat: `+10m`
    - digest: `+30m`
- Reflection transport uses `openclawBridge.sendDialog` with dedicated routes:
  - `memory_reflection_heartbeat`
  - `memory_reflection_digest`
- Reflection context remains bounded and derived only:
  - persona export summary/facts
  - bounded runtime/memory status metadata
  - no raw canonical markdown body transport
- Guarded apply lane only:
  - route: `virtual_pet.memory.sync_intent`
  - origin gate: reflection scheduler context token + source validation
  - non-reflection sources are deferred/rejected
- Cadence-to-intent mapping is strict:
  - heartbeat accepts only `memory_reflection_request`
  - digest accepts only `memory_summary_request`
- Per-cycle apply caps:
  - max `3` accepted intents
  - max `900` total accepted summary characters
- Conflict precedence:
  - local canonical/app guards are final
  - conflicting online requests are rejected with explicit reasons
- Log-first persistence:
  - every run outcome (success/suppressed/failed) recorded to memory logs
  - runtime state rehydrates from log history at startup
  - no sidecar reflection state file
- Observability surface:
  - reflection metadata lives in `Status -> Memory Runtime` only
  - new bounded action: `run_reflection_now` (heartbeat only)
  - no automatic bubble/chat user-facing reflection message
- Deterministic coverage:
  - new script `scripts/check-online-reflection-runtime.js`
  - acceptance row `D13d-online-reflection-runtime-sync`

## Out of Scope
- New settings fields for reflection cadence.
- New provider/model families.
- Direct online write authority to canonical markdown.
- Family-14 embodiment behavior changes.

## Environment / Prerequisites
- Post-`13c` runtime with persona snapshot/export and guarded lane baseline.
- OpenClaw bridge available for healthy-path online reflection.
- Existing memory pipeline/logging lanes active.

## Showcase Promise (Mandatory)
When OpenClaw is healthy, the app performs bounded reflection cadence and applies reflection intents only through guarded memory sync lanes; when unhealthy/disabled, reflection fails safely and remains explicit in `Status -> Memory Runtime`.

## Operator Demo Script (Mandatory)
1. Start app with valid local canonical workspace and OpenClaw enabled.
2. Open `Status...` and inspect `Memory Runtime`.
3. Use `Run Reflection Now`.
4. Confirm reflection fields update (`Last Reflection Outcome/Reason`, counts, next times).
5. Disable OpenClaw and run reflection again.
6. Confirm degraded/suppressed reason is explicit with no unsafe apply behavior.
7. Re-enable OpenClaw and run reflection again.
8. Confirm resumed successful reflection metadata without restart.

## Failure / Recovery Script (Mandatory)
1. Break bridge availability (disable OpenClaw or invalid endpoint).
2. Trigger `Run Reflection Now`.
3. Confirm explicit suppressed/degraded reflection reason and no direct canonical mutation.
4. Restore OpenClaw connectivity.
5. Trigger `Run Reflection Now` again.
6. Confirm reflection returns to successful run metadata.

## Quick Operator Test Card (Mandatory)
### Preflight (2 min max)
1. Run: `npm start`
2. Open: tray `Status...` -> `Memory Runtime`
3. Confirm start signal: detail panel renders with reflection fields

### Happy Path (5 min max)
1. Action: trigger `Run Reflection Now`.
   - Expect: `Last Reflection Outcome` updates to success (healthy path).
2. Action: refresh status.
   - Expect: next heartbeat/digest timestamps and last-run counters update.

### Failure + Recovery (5 min max)
1. Break it: disable OpenClaw; trigger `Run Reflection Now`.
   - Expect degraded/suppressed reason is explicit.
2. Recover it: re-enable OpenClaw; trigger `Run Reflection Now`.
   - Expect recovered success metadata.

### Pass / Fail Checklist
- [ ] Reflection metadata is visible and refreshable in `Status -> Memory Runtime`.
- [ ] Reflection run path stays within guarded memory-intent lane.
- [ ] Reflection suppress/degraded reasons are explicit.
- [ ] Reflection resumes after bridge recovery.

## Acceptance Evidence Checklist (Mandatory)
- [ ] `Status` capture after successful reflection run.
- [ ] `Status` capture after suppressed/degraded reflection run.
- [ ] `Status` capture after recovery reflection run.
- [ ] Automated row `D13d-online-reflection-runtime-sync` passed.

## Public Interfaces / Touchpoints
- `main.js`
- `online-reflection-runtime.js`
- `openclaw-bridge.js`
- `shell-observability.js`
- `inventory-shell-renderer.js`
- `scripts/check-online-reflection-runtime.js`
- `scripts/run-acceptance-matrix.js`
- `package.json` check scripts

## Acceptance Bar
- Reflection cadence behavior is bounded and deterministic.
- Reflection apply lane is reflection-origin gated with strict cadence-to-intent mapping.
- Per-cycle caps and local-guard conflict precedence are enforced.
- Reflection metadata and manual run action are visible in `Status -> Memory Runtime` only.
- Deterministic contract and acceptance checks pass.

## Implementation Slice (Mandatory)
- Implemented first `13d` runtime slice:
  - Added `online-reflection-runtime.js` for deterministic scheduler/runtime state math:
    - cadence boundaries
    - due-cycle selection
    - run start/complete transitions
    - overlap suppression tracking
    - retry slot handling
    - log-history rehydrate state application
  - Extended `main.js`:
    - scheduler tick loop and startup catch-up
    - reflection transport routes
    - reflection-origin gated memory intent submit handler
    - cadence-to-intent enforcement
    - per-cycle caps (`3 intents`, `900 chars`)
    - log-first reflection run observation writes
    - rehydrate from memory logs on startup
    - memory snapshot `lastReflectionRuntime` metadata
    - bounded observability action `run_reflection_now`
  - Extended `openclaw-bridge.js` stub routes for reflection transport parity.
  - Extended `shell-observability.js` and `inventory-shell-renderer.js`:
    - reflection runtime provenance fields in Memory Runtime detail
    - `Run Reflection Now` action wiring and user feedback
  - Added deterministic check:
    - `scripts/check-online-reflection-runtime.js`
  - Wired check lanes:
    - `package.json` (`check:syntax`, `check:contracts`)
    - `scripts/run-acceptance-matrix.js` row `D13d-online-reflection-runtime-sync`

## Visible App Outcome
- `Status -> Memory Runtime` now includes reflection runtime metadata and a `Run Reflection Now` action (heartbeat only), with explicit outcome/reason feedback.

## Acceptance Notes
- `2026-03-08`: `Spec Gate` contract locked and reflected in this deliverable doc.
- `2026-03-08`: First implementation slice completed and deterministic verification passed:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `26/26`

## Iteration Log
- `2026-03-08`: Locked first-slice contract:
  - guarded apply only
  - bridge-route transport only
  - fixed cadence (`hourly`, `2:00 AM local`)
  - startup overdue catch-up
  - one retry policy
  - reflection-only intent gate
  - log-first persistence
  - Status-only visibility
  - no new Settings fields
- `2026-03-08`: Implemented first runtime slice and deterministic checks for cadence/gating/caps/observability contracts.

## Gate Status
- `Spec Gate`: `passed` (`2026-03-08`)
- `Build Gate`: `passed` (`2026-03-08`)
- `Acceptance Gate`: `not_started`
- `Overall`: `implementing`

## Change Log
- `2026-03-08`: Initial deliverable template created in specifying phase.
- `2026-03-08`: Spec lock and first implementation slice landed with deterministic checks and acceptance row.
