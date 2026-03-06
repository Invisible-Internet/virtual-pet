# Deliverable 12e: Guided OpenClaw Connectivity and Pairing

**Deliverable ID:** `12e-guided-openclaw-connectivity-and-pairing`  
**Status:** `specifying`  
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
- No implementation yet in this session.
- First planned vertical slice:
  - add bridge-detail pairing checklist + QR/copy-code method affordances + `open_settings`/`run_pairing_probe` actions,
  - add bounded pairing challenge state handling (`challenge_ready`, `pending_approval`, `challenge_expired`, `paired`),
  - add bounded pairing settings keys to shell settings editor,
  - add deterministic check `scripts/check-openclaw-pairing-guidance.js` and acceptance row `D12e-guided-openclaw-pairing`.

## Visible App Outcome
- No visible app/runtime change yet.
- This session locks the `12e` operator-facing pairing contract so implementation can start without redefining UX or safety boundaries.

## Acceptance Notes
- `2026-03-06`: File created from the post-v1 deliverable template for `12e`.
- `2026-03-06`: Spec locked for pairing checklist, probe actions, pairing-safe settings boundaries, and deterministic test hooks.
- `2026-03-06`: Spec iterated to lock dual pairing methods (`QR approval` + `copy-code fallback`) with shared deterministic readiness/probe contracts.
- `2026-03-06`: Implementation intentionally not started; this is a spec-only session.

## Iteration Log
- `2026-03-06`: Initial `12e` spec drafted from template and aligned to accepted `12a`/`12c`/`12d` boundaries.
- `2026-03-06`: Added explicit desktop-to-VPS pairing contract with QR challenge flow and manual code fallback flow.

## Gate Status
- `Spec Gate`: `passed` (`2026-03-06`)
- `Build Gate`: `not_started`
- `Acceptance Gate`: `not_started`
- `Overall`: `specifying`

## Change Log
- `2026-03-06`: File created from the post-v1 deliverable template.
- `2026-03-06`: Added guided pairing checklist/probe contract, pairing-safe settings boundaries, and acceptance scripts.
- `2026-03-06`: Expanded pairing spec to include QR pairing and copy-code fallback contracts with deterministic failure/retry states.
- `2026-03-06`: Marked `Spec Gate` passed; implementation intentionally not started.
