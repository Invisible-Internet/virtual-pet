# Deliverable 12e: Guided OpenClaw Connectivity and Pairing

**Deliverable ID:** `12e-guided-openclaw-connectivity-and-pairing`  
**Status:** `accepted`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-06`  
**Depends On:** `04-openclaw-bridge-spec`, `11a-openclaw-memory-observability-surface`, `11c-repair-actions-and-provenance-visibility`, `11d-settings-editor-and-service-controls`, `12a-real-openclaw-dialog-parity`, `12c-guarded-openclaw-pet-command-lane`, `12d-openclaw-plugin-and-skill-virtual-pet-lane`  
**Blocks:** `13a-runtime-memory-retrieval-and-evidence-tags`

## Objective
Add a guided in-app connectivity/pairing flow so an operator can move from "OpenClaw degraded or auth-required" to a verifiable ready state without guessing through logs, while keeping secrets protected and app authority boundaries unchanged for both desktop-local and desktop-to-VPS OpenClaw deployments.

## Why 12e Exists (Concrete Gap After 12d)
- `12d` delivered a versioned plugin+skill lane, but operator setup is still mostly manual and spread across settings/env/CLI expectations.
- `Status` currently shows bridge health, but pairing readiness is not presented as a step-by-step checklist with clear next actions.
- `bridge_auth_required`, non-loopback policy, and endpoint misconfiguration failures are detectable but not yet guided through one bounded operator flow.
- Command-lane shared-secret readiness exists, but there is no guided operator path that connects secret-ref configuration to live pairing verification.

## In Scope
- Add a guided pairing/readiness experience owned by shared-shell `Status` bridge detail.
- Add one bounded "pairing probe" action that checks bridge connectivity/auth plus lane-read readiness and returns deterministic check states.
- Add a dual-method pairing handoff:
  - `QR approval` (scan with authenticated operator device)
  - `Copy code` fallback (manual code entry/approval path)
- Extend bounded settings-editor controls for pairing-related OpenClaw configuration fields needed by operators.
- Keep command/auth secret handling reference-based by default (`*Ref` and key id visibility), with no raw secret exposure in UI state.
- Add deterministic checks and acceptance-matrix coverage for guided pairing states and actions.
- Preserve offline usability and existing fallback behavior when OpenClaw is unavailable.

## Out of Scope
- Auto-installing or auto-enabling OpenClaw plugins from the app UI.
- Mandatory phone/mobile requirement; pairing must remain possible via copy-code fallback.
- Storing or displaying raw auth token/shared-secret values in renderer-visible payloads.
- Any direct OpenClaw authority expansion over movement/state/render/identity.
- New canonical-file governance or memory sync behavior (family `13` scope).
- Replacing existing bridge transports/policies from `12a`; `12e` is operator guidance and verification on top.

## Environment / Prerequisites
- `12d` accepted contract and plugin+skill lane (`vp-plugin-lane-v1`) remain available.
- Shared shell `Status` and `Settings` tabs from `11a`/`11d` remain the owner surfaces.
- Runtime settings source/provenance plumbing remains active (`settings-runtime`, settings source map, observability detail actions).
- Bridge transport (`ws` and CLI relay fallback from `12a`) remains unchanged and available to probe.

## Showcase Promise (Mandatory)
The operator can open `Status`, initiate pairing using either `QR approval` or `copy-code fallback`, run one guided pairing probe, and clearly see whether OpenClaw is ready or degraded, why it is degraded, and the exact bounded next action (`Open Settings`, `Retry Pairing`, `Refresh`, or external approval step) needed to recover.

## Operator Demo Script (Mandatory)
1. Start the app with OpenClaw enabled and plugin lane available, but with pairing/auth not fully ready (for example, auth missing or gateway not paired).
2. Open shared shell `Status`, press `Refresh`, and select `OpenClaw Bridge` detail.
3. Confirm the detail view shows a pairing checklist with per-check pass/fail state, readable reasons, and pairing method options (`Show QR`, `Copy Pairing Code`).
4. Trigger `Open Settings` from the bridge detail and set pairing-related config fields (transport/endpoint/ref/key as required by local setup).
5. Save settings and return to `Status`.
6. Start pairing via `Show QR`, scan/approve from an authenticated operator device, then run `Run Pairing Probe`.
7. Confirm probe results report:
   - bridge reachability/auth state
   - command-lane auth readiness (configured + key id visibility)
   - plugin lane status-read readiness
8. Reset auth/pairing state (test env), then use `Copy Pairing Code` and complete manual approval; rerun `Run Pairing Probe`.
9. Confirm bridge detail reports healthy/ready state for both methods with no raw secret value exposure.
10. Send one chat prompt and confirm response metadata is `source=online` when pairing is healthy.

## Failure / Recovery Script (Mandatory)
1. Set an invalid OpenClaw endpoint (or disable OpenClaw) and run `Run Pairing Probe`.
2. Confirm pairing checklist fails deterministically with reason (`bridge_config_invalid`, `openclaw_disabled`, or equivalent) and guided next action.
3. Restore endpoint/enable setting, but keep auth/pairing incomplete; rerun probe.
4. Confirm failure reason shifts to auth/pairing requirement (`bridge_auth_required` or equivalent) instead of generic failure.
5. Start QR pairing, let challenge expire, then rerun probe; confirm deterministic `pairing_challenge_expired` (or equivalent) and `Retry Pairing` guidance.
6. Retry using copy-code flow and complete external pairing/auth requirement, then rerun probe.
7. Confirm checklist moves to ready/healthy without app restart if runtime recovery supports it.

## Quick Operator Test Card (Mandatory)
### Preflight (2 min max)
1. Run: `npm start`
2. Open: tray `Status...` -> `OpenClaw Bridge` detail
3. Confirm start signal:
   - bridge card shows `HEALTHY` or `DEGRADED`
   - `Run Pairing Probe` button is visible

### Happy Path (5 min max)
1. Click `Show QR`.
   - Expect: pairing section shows a QR image and `Pairing Id`.
2. Approve pairing externally (scan QR or use payload as required by operator environment).
   - Expect: no app crash; pairing section remains visible.
3. Click `Run Pairing Probe`.
   - Expect: status line shows `Pairing probe result: Ready`.
4. Click `Copy Pairing Code`, complete external approval path, then click `Run Pairing Probe` again.
   - Expect: probe remains `Ready` and checks stay `Pass`.

### Failure + Recovery (5 min max)
1. Break it: set invalid `OpenClaw Base URL` in `Settings`, then run `Run Pairing Probe`.
   - Expect degraded signal: `Bridge endpoint policy: Fail` and non-ready probe result.
2. Recover it: restore valid endpoint, click `Retry Pairing`, complete pairing, then run `Run Pairing Probe`.
   - Expect recovered signal: `Pairing probe result: Ready`.

### Pass / Fail Checklist
- [x] `Show QR` displays a visible QR image in-app.
- [x] `Copy Pairing Code` copies a short challenge code (not auth secret/token).
- [x] failure case shows deterministic non-ready check reason.
- [x] recovery returns to `Pairing probe result: Ready`.

## Acceptance Evidence Checklist (Mandatory)
- [x] probe summary lines captured:
  - `Last Probe: Disabled`
  - `Last Probe: Ready`
- [x] check rows captured:
  - `Bridge auth: Pass (Bridge auth ok)`
  - `Command auth: Pass (Command auth ready)`
  - `Plugin lane status: Pass (Plugin lane ready)`
- [x] pairing-state lines captured:
  - `Pairing State: Not started` (degraded/disabled run)
  - `Pairing State: Paired` (recovered run)
- [x] QR evidence captured:
  - operator confirmed in-app QR was visible and payload URL was copyable

## Public Interfaces / Touchpoints
- Deliverable doc:
  - `docs/plan/12e-guided-openclaw-connectivity-and-pairing.md`
- Shared-shell UI and actions:
  - `inventory-shell-renderer.js`
  - `inventory-preload.js`
  - `shell-observability.js`
- Main-process pairing probe/action handling:
  - `main.js`
  - `openclaw-bridge.js`
  - `openclaw-plugin-skill-lane.js`
- Settings editor surface for pairing-related keys:
  - `shell-settings-editor.js`
  - `settings-runtime.js`
- Deterministic coverage:
  - `scripts/check-openclaw-pairing-guidance.js` (new)
  - `scripts/run-acceptance-matrix.js` row `D12e-guided-openclaw-pairing` (new)

## Pairing Readiness Contract (First Slice)
`12e` adds a deterministic readiness snapshot used by bridge detail:

```js
{
  kind: "openclawPairingSnapshot",
  ts: 0,
  overallState: "ready|degraded|failed|disabled",
  checks: [
    {
      id: "bridge_enabled|bridge_endpoint_policy|bridge_auth|command_auth|plugin_lane_status",
      state: "pass|warn|fail",
      reason: "normalized_reason_code",
      detail: "short human-readable summary"
    }
  ]
}
```

Rules:
- Snapshot must be bounded and renderer-safe (no secret/token values).
- Check IDs and reason codes must be deterministic for tests and operator guidance copy.
- `overallState` derives from check states, not from ad-hoc UI heuristics.

## Pairing Challenge Contract (QR + Code Fallback)
`12e` introduces a bounded pairing challenge payload used by the bridge detail:

```js
{
  kind: "openclawPairingChallenge",
  ts: 0,
  pairingState:
    "not_started|challenge_ready|pending_approval|paired|challenge_expired|failed",
  methodAvailability: {
    qr: true,
    code: true
  },
  challenge: {
    pairingId: "pair_...",
    expiresAtMs: 0,
    qrPayload: "opaque payload or URL-safe challenge string",
    code: "ABCD-EFGH"
  }
}
```

Rules:
- Challenge payload is short-lived and revocable.
- `qrPayload` and `code` are treated as one-time pairing artifacts, not long-term credentials.
- Any stored long-term secret/token remains outside renderer-visible state.
- QR and code flows must converge to the same verified paired state and probe output.

## Pairing Action Contract (First Slice)
Bridge detail exposes bounded actions:
- existing: `refresh_status`, `copy_details`
- new in `12e`:
  - `open_settings`
  - `start_pairing_qr`
  - `copy_pairing_code`
  - `retry_pairing`
  - `run_pairing_probe`

Rules:
- Actions execute through main-process authority; renderer does not run shell/CLI commands directly.
- `run_pairing_probe` returns structured check outcomes (not plain string only).
- `open_settings` routes through existing shared-shell action path.
- `copy_pairing_code` copies only the short-lived challenge code (never auth token/shared secret).
- `start_pairing_qr` and `retry_pairing` may mint/refresh challenge artifacts with explicit expiry metadata.

## Pairing-Safe Settings Contract
`12e` extends bounded editor coverage to include pairing-related config keys needed for operator setup:

```js
[
  "openclaw.enabled",
  "openclaw.transport",
  "openclaw.baseUrl",
  "openclaw.allowNonLoopback",
  "openclaw.authTokenRef",
  "openclaw.petCommandSharedSecretRef",
  "openclaw.petCommandKeyId"
]
```

Rules:
- `openclaw.authToken` and `openclaw.petCommandSharedSecret` remain blocked for direct GUI editing in first `12e` slice.
- Invalid URL/enum/shape inputs are rejected deterministically with explicit reason codes.
- Existing precedence (`base -> local/runtime -> env`) and provenance signals remain intact.

## Acceptance Bar
- Accepted for `Spec Gate` only when:
  - pairing checklist states/actions are explicit,
  - demo and failure/recovery scripts are concrete,
  - pairing-safe settings boundaries are explicit,
  - secret handling/non-authority constraints are explicit.
- Accepted for final operator closure only when:
  - guided probe identifies degraded causes with deterministic reason codes,
  - both pairing paths are operator-verifiable:
    - QR approval path
    - copy-code fallback path
  - operator can recover from at least one auth/pairing failure path via guided flow,
  - healthy state is verifiable from `Status` without raw secret exposure,
  - deterministic check row `D12e-guided-openclaw-pairing` is green.
- Not accepted if:
  - UI exposes raw token/secret values,
  - guidance only says "failed" without actionable reason,
  - pairing flow bypasses existing app authority boundaries.

## Implementation Slice (Mandatory)
- First implementation slice shipped:
  - added new pairing guidance runtime module:
    - `openclaw-pairing-guidance.js`
    - deterministic pairing challenge lifecycle:
      - `not_started`
      - `challenge_ready`
      - `pending_approval`
      - `paired`
      - `challenge_expired`
      - `failed`
  - extended shared-shell `Status` bridge detail with bounded pairing actions:
    - `open_settings`
    - `start_pairing_qr`
    - `copy_pairing_code`
    - `retry_pairing`
    - `run_pairing_probe`
  - wired `main.js` observability action handling for pairing actions:
    - QR/code challenge mint + retry
    - pairing-code clipboard copy
    - deterministic pairing probe checks:
      - `bridge_enabled`
      - `bridge_endpoint_policy`
      - `bridge_auth`
      - `command_auth`
      - `plugin_lane_status`
    - probe overall states:
      - `ready`
      - `degraded`
      - `failed`
      - `disabled`
  - bridged pairing snapshot into observability payload so bridge detail shows:
    - current pairing state
    - challenge metadata (`pairingId`, expiry, qr payload, code)
    - last probe summary/checks
  - iterated QR UX to render a real in-app scannable image from challenge payload:
    - added local QR generator utility:
      - `openclaw-pairing-qr.js`
    - bridge pairing snapshot now includes challenge `qrImageDataUrl` for renderer-safe display
    - `Status` detail pairing card now renders QR image (while retaining payload + copy-code fallback)
  - expanded bounded shell settings editor contract for pairing-related keys:
    - `openclaw.transport`
    - `openclaw.baseUrl`
    - `openclaw.allowNonLoopback`
    - `openclaw.authTokenRef`
    - `openclaw.petCommandSharedSecretRef`
    - `openclaw.petCommandKeyId`
    - kept raw secret/token values blocked
  - added deterministic coverage:
    - `scripts/check-openclaw-pairing-guidance.js`
    - `scripts/check-openclaw-pairing-qr.js`
    - acceptance matrix row `D12e-guided-openclaw-pairing`
  - verification run:
    - `npm run check:syntax`
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `22/22 automated checks passed`

## Visible App Outcome
- Visible app/runtime change delivered:
  - `Status` -> `OpenClaw Bridge` detail now includes guided pairing actions and state.
  - Operators can initiate pairing challenge from the app via QR or copy-code fallback and run a bounded pairing probe.
  - `Show QR` now renders a scannable in-app QR image for the challenge payload (not payload text only).
  - Pairing probe now reports deterministic per-check reasons for degraded/failed/ready states.
  - `Settings` editor now supports bounded pairing-related OpenClaw connectivity fields while keeping raw secrets blocked.

## Acceptance Notes
- `2026-03-06`: File created from the post-v1 deliverable template for `12e`.
- `2026-03-06`: Spec locked for pairing checklist, probe actions, pairing-safe settings boundaries, and deterministic test hooks.
- `2026-03-06`: Spec iterated to lock dual pairing methods (`QR approval` + `copy-code fallback`) with shared deterministic readiness/probe contracts.
- `2026-03-06`: First `12e` implementation slice landed across pairing runtime, bridge-detail actions, and settings-editor bounded keys.
- `2026-03-06`: Build verification run passed:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `22/22`
- `2026-03-06`: Post-implementation verification rerun stayed green:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `22/22`
- `2026-03-06`: QR iteration shipped for operator UX:
  - in-app `Show QR` now displays a generated scannable QR image (`data:image/svg+xml`)
  - added local QR contract check:
    - `scripts/check-openclaw-pairing-qr.js`
  - verification rerun stayed green:
    - `npm run check:syntax`
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `22/22`
- `2026-03-06`: Operator acceptance evidence captured for closure:
  - degraded/disabled evidence:
    - `Openclaw disabled`
    - bridge row state `DISABLED`
    - `Pairing State: Not started`
    - `Last Probe: Disabled`
  - recovery evidence:
    - `Request Success`
    - bridge row state `HEALTHY`
    - `Pairing State: Paired`
    - `Last Probe: Ready`
    - checks all pass (`Bridge auth`, `Command auth`, `Plugin lane status`)
  - copy-code/QR path evidence:
    - operator confirmed QR display and copyable payload URL
    - operator confirmed copy-code fallback path was observed previously

## Iteration Log
- `2026-03-06`: Initial `12e` spec drafted from template and aligned to accepted `12a`/`12c`/`12d` boundaries.
- `2026-03-06`: Added explicit desktop-to-VPS pairing contract with QR challenge flow and manual code fallback flow.
- `2026-03-06`: Implemented first vertical slice for guided pairing actions, pairing probe checks, and bounded settings support.
- `2026-03-06`: Revalidated `12e` implementation on request; no additional runtime changes were required after checks.
- `2026-03-06`: Implemented QR-image rendering in `Status` pairing details so operators can scan directly from the app.
- `2026-03-06`: Acceptance evidence clarified env-override behavior (`SOURCE=Environment variable`, `ENV OVERRIDE=Active`) and completed operator failure/recovery verification using env-driven test mode.

## Gate Status
- `Spec Gate`: `passed` (`2026-03-06`)
- `Build Gate`: `passed` (`2026-03-06`)
- `Acceptance Gate`: `passed` (`2026-03-06`)
- `Overall`: `accepted`

## Change Log
- `2026-03-06`: File created from the post-v1 deliverable template.
- `2026-03-06`: Added guided pairing checklist/probe contract, pairing-safe settings boundaries, and acceptance scripts.
- `2026-03-06`: Expanded pairing spec to include QR pairing and copy-code fallback contracts with deterministic failure/retry states.
- `2026-03-06`: Marked `Spec Gate` passed; implementation intentionally not started.
- `2026-03-06`: Implemented first `12e` runtime/UI/settings slice, added deterministic `D12e` coverage, and passed `Build Gate`.
- `2026-03-06`: Added local QR generation + in-app pairing QR rendering; checks remained green.
- `2026-03-06`: Marked `Acceptance Gate` passed and closed `12e` as `accepted` after operator-verified degraded/recovery and dual pairing-path evidence.
