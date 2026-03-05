# Deliverable 12c: Guarded OpenClaw Pet Command Lane

**Deliverable ID:** `12c-guarded-openclaw-pet-command-lane`  
**Status:** `accepted`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-05`  
**Depends On:** `04-openclaw-bridge-spec`, `11a-openclaw-memory-observability-surface`, `11d-settings-editor-and-service-controls`, `12a-real-openclaw-dialog-parity`, `12b-chat-shell-and-conversation-presence`  
**Blocks:** `14b-event-driven-watch-behavior`, `15c-extension-context-and-bridge-polish`  

## Objective
Define a secure, app-authoritative command lane so OpenClaw can request bounded pet actions through explicit authorization, replay protection, and strict allowlisting, without giving OpenClaw direct authority over pet state, movement, rendering, or identity writes.

## Why 12c Exists (Concrete Use Cases)
- `12a` solved user-chat parity (`user -> OpenClaw -> chat reply`), but there is still no trusted lane for `OpenClaw -> app` action requests.
- OpenClaw needs a bounded way to ask the pet to do visible shell actions when useful, for example:
  - post a short announcement to the pet dialog bubble after an agent-side result is ready,
  - open/focus `Status` when OpenClaw detects degraded runtime conditions and wants the operator to inspect details.
- Without `12c`, the only practical path is unstructured text in chat, which cannot safely trigger deterministic UI actions.

## Boundary: Chat vs Command vs Canonical Files
- `12a` handles freeform conversation transport and online/offline reply metadata.
- `12c` handles signed OpenClaw-to-pet action requests for bounded visible actions only.
- Canonical file and memory continuity (`SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`) stays in family `13` read-model/context work; `12c` does not grant OpenClaw direct file-write authority.

## Quick Resume Checklist
1. Confirm `12b` is accepted/closed and set `12c` as active deliverable.
2. Confirm `Spec Gate` remains passed; reopen spec only if scope/contracts change.
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
- Define the OpenClaw-side caller contract for a skill/tool/API lane that emits `pet_command_request` envelopes.
- Define first-slice allowed command allowlist for safe, visible actions.
- Define explicit reject reasons and operator-visible provenance for accepted/rejected requests.
- Define deterministic checks for request validation, replay rejection, and bounded allowlist behavior.

## Out of Scope
- Unbounded OpenClaw action execution.
- Any direct `set_state`, `render_control`, or identity-mutation authority for OpenClaw.
- Raw movement/fling/clamp control from OpenClaw.
- Skill marketplace/distribution UX.
- Full policy engine for arbitrary third-party skills.
- Direct OpenClaw write authority over canonical files (`SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`).

## Environment / Prerequisites
- `12a` dialog/bridge parity lane is in place and still keeps app authority local.
- OpenClaw gateway transport is reachable (WebSocket lane for runtime bridge path).
- OpenClaw-side caller exists (skill, CLI relay, or automation hook) and can send signed `pet_command_request` payloads.
- Shared-shell `Status` surface exists for operator-visible diagnostics and reason text.
- Runtime settings and source-map plumbing from `11d` are available for provenance display.

## Showcase Promise (Mandatory)
An OpenClaw skill/API caller can submit a signed pet command request, and the app will either execute a safe allowlisted action with visible result or reject it with a clear reason, while preserving local authority over movement/state/render/identity paths.

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
- Bridge/runtime files:
  - `openclaw-bridge.js`
  - `main.js`
  - `settings-runtime.js`
  - `shell-observability.js`
- Renderer/shared-shell surfaces:
  - `renderer.js`
  - `inventory-shell-renderer.js`
- New helper module:
  - `openclaw-pet-command-lane.js`
- Deterministic checks:
  - `scripts/check-openclaw-pet-command-lane.js`
  - `scripts/run-acceptance-matrix.js` row `D12c-guarded-pet-command-lane`

## Skill/API Caller Contract (First Slice)
`12c` is transport-agnostic, but requires one normalized ingress payload shape:

```js
{
  route: "pet_command_request",
  correlationId: "corr_...",
  payload: {
    // signed envelope from Command Auth Contract
  }
}
```

Rules:
- Caller can be an OpenClaw skill, CLI relay, or automation hook.
- Transport may be direct bridge response, gateway call relay, or equivalent adapter path, as long as the payload shape is preserved.
- App trust is based on envelope verification (signature + nonce + expiry), not on caller process identity alone.

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

Canonical signature input (`vp-hmac-v1`) for first slice:

```js
const signingInput = [
  "vp-hmac-v1",
  requestId,
  actionId,
  String(issuedAtMs),
  String(expiresAtMs),
  auth.nonce,
  canonicalJson(source),
  canonicalJson(args)
].join("\n");

signature = base64(hmacSha256(sharedSecret, signingInput));
```

`canonicalJson(value)` requirements:
- UTF-8 JSON with recursively sorted object keys.
- Arrays keep original order.
- No extra whitespace.

## Replay + Expiry Policy (First Slice Defaults)
- `maxClockSkewMs=30000`
- `maxRequestLifetimeMs=120000`
- `nonceReplayWindowMs=600000`
- nonce uniqueness scope is `(keyId, nonce)` within replay window.

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
- First-slice args contract:
  - `dialog.injectAnnouncement`
    - args: `{ text: string }`
    - `text` must be trimmed length `1..160`.
  - `shell.openStatus`
    - args: `{}` only (empty object).
- Explicitly blocked categories remain blocked even when signed:
  - `set_state`
  - `render_control`
  - `identity_mutation`
  - direct drag/fling/motion control

## Reject Reason Taxonomy (First Slice)
- `malformed_request`
- `auth_scheme_unsupported`
- `auth_secret_missing`
- `auth_invalid_signature`
- `auth_replay_nonce`
- `auth_request_too_old`
- `auth_request_expired`
- `blocked_action`
- `invalid_args`
- `execution_failed`

## Acceptance Bar
- Accepted for `Spec Gate` only when:
  - use cases for why command lane exists are explicit and operator-visible,
  - auth envelope, canonical signing input, nonce policy, expiry policy, and allowlist boundaries are explicit,
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
- First implementation slice shipped:
  - new runtime command lane module:
    - `openclaw-pet-command-lane.js`
  - canonical `vp-hmac-v1` signing-input verification with explicit reject taxonomy
  - nonce replay cache + expiry/lifetime/skew checks
  - bounded allowlist execution:
    - `dialog.injectAnnouncement`
    - `shell.openStatus`
  - `main.js` now processes signed `pet_command_request` actions from bridge proposed-actions lane
  - shared-shell observability bridge detail now includes pet-command auth readiness/source/key and nonce cache size
  - deterministic checks:
    - `scripts/check-openclaw-pet-command-lane.js` (new)
    - acceptance row `D12c-guarded-pet-command-lane` (new)

## Visible App Outcome
- Visible app/runtime change delivered:
  - signed allowlisted OpenClaw command requests can now execute bounded visible actions in runtime.
  - accepted/rejected command outcomes are surfaced with explicit reasons (`accepted`/taxonomy reject reason).
  - bridge diagnostics/status now expose command-auth readiness metadata without exposing secret values.

## Acceptance Notes
- `2026-03-05`: File created from the post-v1 deliverable template as a concrete auth/authorization spec for future OpenClaw skill integration.
- `2026-03-05`: Spec sections drafted; implementation intentionally not started.
- `2026-03-05`: Spec tightened with concrete use-case framing, skill/API ingress contract, canonical signing input, replay/expiry defaults, and explicit first-slice arg + reject-reason contracts.
- `2026-03-05`: Build verification run completed with first-slice implementation:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `20/20`
- `2026-03-05`: Operator runtime smoke reviewed (live app run with no command-lane regressions observed) and accepted for closeout so roadmap can advance to `12d`.

## Iteration Log
- `2026-03-05`: Initial `12c` auth-lane draft created with signed request envelope, replay protection, expiry validation, and first-slice allowlist.
- `2026-03-05`: Clarified lane boundaries vs `12a` chat and family `13` canonical-file continuity work to avoid scope overlap.
- `2026-03-05`: Implemented guarded runtime lane + deterministic coverage (`D12c-guarded-pet-command-lane`).

## Gate Status
- `Spec Gate`: `passed` (`2026-03-05`)
- `Build Gate`: `passed` (`2026-03-05`)
- `Acceptance Gate`: `passed` (`2026-03-05`)
- `Overall`: `accepted`

## Change Log
- `2026-03-05`: File created from the post-v1 deliverable template.
- `2026-03-05`: Added concrete signed-command auth model and bounded first-slice allowlist contract.
- `2026-03-05`: Added concrete command-lane use cases, skill/API ingress contract, canonical signature format, replay/expiry defaults, and explicit reject taxonomy.
- `2026-03-05`: Shipped first runtime/auth slice with nonce replay protection, allowlist executor, and deterministic coverage (`D12c`).
- `2026-03-05`: Operator accepted `12c` closeout; deliverable marked `accepted`.
