# Deliverable 12c: Guarded OpenClaw Pet Command Lane

**Deliverable ID:** `12c-guarded-openclaw-pet-command-lane`  
**Status:** `specifying`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-05`  
**Depends On:** `04-openclaw-bridge-spec`, `11a-openclaw-memory-observability-surface`, `11d-settings-editor-and-service-controls`, `12a-real-openclaw-dialog-parity`  
**Blocks:** `14b-event-driven-watch-behavior`, `15c-extension-context-and-bridge-polish`  

## Objective
Define a secure, app-authoritative command lane so OpenClaw can request bounded pet actions through explicit authorization, replay protection, and strict allowlisting, without giving OpenClaw direct authority over pet state, movement, rendering, or identity writes.

## Quick Resume Checklist
1. Confirm `12b` is accepted/closed and set `12c` as active deliverable.
2. Pass `Spec Gate` for this file using current auth envelope + reject-reason taxonomy.
3. Implement first allowlist-only slice:
   - `dialog.injectAnnouncement`
   - `shell.openStatus`
4. Add deterministic check + matrix row:
   - `scripts/check-openclaw-pet-command-lane.js`
   - `D12c-guarded-pet-command-lane`
5. Run operator demo/failure script and close `Acceptance Gate`.

## In Scope
- Define a signed `pet_command_request` contract carried through the bridge response lane.
- Define authorization verification in app runtime:
  - shared secret binding
  - request signature verification
  - nonce replay protection
  - timestamp/expiry checks
- Define first-slice allowed command allowlist for safe, visible actions.
- Define explicit reject reasons and operator-visible provenance for accepted/rejected requests.
- Define deterministic checks for request validation, replay rejection, and bounded allowlist behavior.

## Out of Scope
- Unbounded OpenClaw action execution.
- Any direct `set_state`, `render_control`, or identity-mutation authority for OpenClaw.
- Raw movement/fling/clamp control from OpenClaw.
- Skill marketplace/distribution UX.
- Full policy engine for arbitrary third-party skills.

## Environment / Prerequisites
- `12a` dialog/bridge parity lane is in place and still keeps app authority local.
- OpenClaw gateway transport is reachable (WebSocket lane for runtime bridge path).
- Shared-shell `Status` surface exists for operator-visible diagnostics and reason text.
- Runtime settings and source-map plumbing from `11d` are available for provenance display.

## Showcase Promise (Mandatory)
An OpenClaw skill can submit a signed pet command request, and the app will either execute a safe allowlisted action with visible result or reject it with a clear reason, while preserving local authority over movement/state/render/identity paths.

## Operator Demo Script (Mandatory)
1. Start the app with the command lane enabled and a configured shared-secret reference.
2. Open `Status` and confirm command-lane auth readiness reports healthy (secret configured + nonce cache active).
3. Trigger a signed `pet_command_request` from the OpenClaw side for allowlisted action `dialog.injectAnnouncement`.
4. Confirm the pet shows the announcement in bubble/history with provenance indicating command-lane source.
5. Trigger a signed request for allowlisted action `shell.openStatus`.
6. Confirm the shared shell focuses/opens `Status` via existing shell action routing.
7. Verify status/provenance view shows accepted command metadata:
   - command id
   - action id
   - skill/agent/session source
   - auth scheme/key id

## Failure / Recovery Script (Mandatory)
1. Send a command with an invalid signature; confirm rejection reason `auth_invalid_signature`.
2. Re-send the same signed request/nonce; confirm rejection reason `auth_replay_nonce`.
3. Send an expired request; confirm rejection reason `auth_request_expired`.
4. Send a signed but non-allowlisted action (for example `set_state`); confirm rejection reason `blocked_action`.
5. Send a fresh valid signed allowlisted command.
6. Confirm accepted execution succeeds and the lane returns to healthy behavior.

## Public Interfaces / Touchpoints
- Deliverable doc:
  - `docs/plan/12c-guarded-openclaw-pet-command-lane.md`
- Bridge/runtime files (planned):
  - `openclaw-bridge.js`
  - `main.js`
  - `settings-runtime.js`
  - `shell-observability.js`
- Renderer/shared-shell surfaces (planned):
  - `renderer.js`
  - `inventory-shell-renderer.js`
- New helper module (planned):
  - `pet-command-auth.js`
- Deterministic checks (planned):
  - `scripts/check-openclaw-pet-command-lane.js`
  - `scripts/run-acceptance-matrix.js` row `D12c-guarded-pet-command-lane`

## Command Auth Contract
`12c` introduces a bounded signed request envelope for OpenClaw-origin actions:

```js
{
  type: "pet_command_request",
  requestId: "req_...",
  actionId: "dialog.injectAnnouncement",
  args: {
    text: "Time to stretch."
  },
  issuedAtMs: 0,
  expiresAtMs: 0,
  source: {
    skillId: "virtual-pet-bridge",
    agentId: "main",
    sessionId: "..."
  },
  auth: {
    scheme: "vp-hmac-v1",
    keyId: "local-default",
    nonce: "uuid-v4",
    signature: "base64-hmac"
  }
}
```

Validation rules:
- `scheme` must be `vp-hmac-v1`.
- App computes signature from canonical request payload using configured shared secret.
- `nonce` is single-use within replay window; duplicates are rejected.
- Request must be within allowed time window:
  - `issuedAtMs` not too old
  - `expiresAtMs` not exceeded
- Any shape/auth failure is rejected with explicit reason code.

## Shared Secret + Provenance Contract
- App reads shared-secret value from env-ref key:
  - `openclaw.petCommandSharedSecretRef` (default `PET_OPENCLAW_PET_COMMAND_SECRET`)
- Secret value is never exposed in renderer payloads.
- Status/provenance may expose:
  - secret configured yes/no
  - secret source layer (`env` / `local` / `runtime`)
  - key id used for accepted/rejected requests

## First-Slice Allowlist Contract
Allowed action IDs for first `12c` slice:

```js
[
  "dialog.injectAnnouncement",
  "shell.openStatus"
]
```

Rules:
- Unknown action => `blocked_action`.
- Known but invalid args => `invalid_args`.
- Allowlist execution reuses existing local app action paths (no duplicate authority path).
- Explicitly blocked categories remain blocked even when signed:
  - `set_state`
  - `render_control`
  - `identity_mutation`
  - direct drag/fling/motion control

## Acceptance Bar
- Accepted for `Spec Gate` only when:
  - auth envelope, nonce policy, expiry policy, and allowlist boundaries are explicit,
  - demo/failure scripts are concrete and operator-runnable,
  - reject-reason taxonomy is operator-readable.
- Accepted for final operator closure only when:
  - valid signed allowlisted commands execute visibly,
  - invalid/replayed/expired/non-allowlisted requests are rejected with clear reason,
  - no blocked authority category can be bypassed through command lane,
  - status/provenance surfaces expose enough evidence for debugging.
- Not accepted if:
  - OpenClaw can directly set movement/state/render/identity without local arbitration,
  - auth failures collapse silently,
  - replay/expiry protections are missing or non-deterministic.

## Implementation Slice (Mandatory)
- Not started in this session; this file is spec-only for the next secure command-lane slice.
- Planned first implementation slice:
  - request envelope parsing + auth verification
  - nonce cache + expiry checks
  - allowlisted command executor
  - deterministic check `check-openclaw-pet-command-lane.js`

## Visible App Outcome
- No visible app/runtime change in this session (specification only).
- After implementation, operators can observe accepted/rejected OpenClaw command requests with explicit authorization reasons and bounded action outcomes.

## Acceptance Notes
- `2026-03-05`: File created from the post-v1 deliverable template as a concrete auth/authorization spec for future OpenClaw skill integration.
- `2026-03-05`: Spec sections drafted; implementation intentionally not started.

## Iteration Log
- `2026-03-05`: Initial `12c` auth-lane draft created with signed request envelope, replay protection, expiry validation, and first-slice allowlist.

## Gate Status
- `Spec Gate`: `not_started`
- `Build Gate`: `not_started`
- `Acceptance Gate`: `not_started`
- `Overall`: `specifying`

## Change Log
- `2026-03-05`: File created from the post-v1 deliverable template.
- `2026-03-05`: Added concrete signed-command auth model and bounded first-slice allowlist contract.
