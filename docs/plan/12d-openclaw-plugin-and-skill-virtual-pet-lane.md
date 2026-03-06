# Deliverable 12d: OpenClaw Plugin and Skill Virtual Pet Lane

**Deliverable ID:** `12d-openclaw-plugin-and-skill-virtual-pet-lane`  
**Status:** `accepted`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-06`  
**Depends On:** `04-openclaw-bridge-spec`, `11a-openclaw-memory-observability-surface`, `11d-settings-editor-and-service-controls`, `12a-real-openclaw-dialog-parity`, `12b-chat-shell-and-conversation-presence`, `12c-guarded-openclaw-pet-command-lane`  
**Blocks:** `12e-guided-openclaw-connectivity-and-pairing`, `15c-extension-context-and-bridge-polish`

## Objective
Define a separable, versioned OpenClaw plugin+skill lane that packages stable Virtual Pet calls (`command.request`, `status.read`, `memory.sync_intent`) on top of the accepted guarded app authority from `12c`, so OpenClaw-side automation can use a deterministic contract instead of ad-hoc bridge payloads.

## Why 12d Exists (Concrete Gap After 12c)
- `12c` proved secure app-side command verification and allowlist execution, but OpenClaw-side callers are still ad-hoc and not packaged as a reusable lane.
- Without a versioned plugin+skill contract, pairing and operator troubleshooting are brittle because each caller may shape payloads differently.
- `12e` pairing UX needs one concrete contract target to validate (what to call, what "healthy" looks like, and what errors mean).

## In Scope
- Define one versioned plugin+skill call surface for Virtual Pet lane calls:
  - `virtual_pet.command.request`
  - `virtual_pet.status.read`
  - `virtual_pet.memory.sync_intent`
- Define request/response envelopes, versioning fields, and deterministic error taxonomy.
- Define local-first transport policy for plugin calls (runtime lane first, bounded fallback labels if unavailable).
- Define bounded status/context read shape for operator-safe diagnostics (no secret exposure).
- Define bounded memory-sync intent shape that stays intent-only (no direct canonical file writes).
- Define deterministic checks and acceptance-matrix coverage for the plugin+skill lane contract.

## Out of Scope
- OpenClaw marketplace/distribution flow or remote package publishing.
- Any direct OpenClaw authority over movement/state/render/identity.
- Pairing wizard/UI and guided secret setup (`12e` scope).
- Canonical file read/write governance changes (family `13` scope).
- Broad third-party plugin policy engine beyond the Virtual Pet lane package.

## Environment / Prerequisites
- `12c` is accepted and its signed command lane remains the app authority path.
- OpenClaw bridge transport remains available via local-first runtime path (`ws` and CLI relay fallback support from `12a`).
- Shared-shell `Status` remains available for operator-visible readiness and reject reasons.
- Runtime has configured pet-command auth settings (`openclaw.petCommandSharedSecretRef` / key id path).

## Showcase Promise (Mandatory)
An operator can run the in-project OpenClaw Virtual Pet plugin+skill calls and observe a stable versioned contract: bounded status read returns a predictable payload, and signed command requests either produce visible pet actions or deterministic rejects through the existing guarded lane.

## Operator Demo Script (Mandatory)
1. Start the app with OpenClaw enabled and command-lane auth configured.
2. Load the Virtual Pet plugin+skill lane from the local project package path.
3. Run `virtual_pet.status.read` with scope `bridge_summary`.
4. Confirm the response includes stable contract fields:
   - `contractVersion`
   - `laneState`
   - `commandPolicy` (allowlist ids)
   - auth readiness flags (without secret values)
5. Run `virtual_pet.command.request` for action `dialog.injectAnnouncement` with valid signed envelope.
6. Confirm the pet shows the announcement and the call returns `accepted` with command metadata.
7. Run `virtual_pet.command.request` for action `shell.openStatus`.
8. Confirm `Status` opens/focuses and the call reports `accepted`.
9. Confirm `Status` detail/provenance reflects recent command-lane activity consistent with plugin call metadata.

## Failure / Recovery Script (Mandatory)
1. Run `virtual_pet.command.request` with invalid signature; confirm deterministic reject (`auth_invalid_signature`).
2. Run `virtual_pet.command.request` with blocked action id (for example `set_state`); confirm deterministic reject (`blocked_action`).
3. Run any lane call with unsupported `contractVersion`; confirm deterministic reject (`contract_version_unsupported`).
4. Run `virtual_pet.memory.sync_intent` with malformed payload; confirm deterministic reject (`invalid_intent_payload`).
5. Restore valid version and valid signed payload; rerun `dialog.injectAnnouncement`.
6. Confirm normal accepted behavior resumes without restarting the app.

## Public Interfaces / Touchpoints
- Deliverable doc:
  - `docs/plan/12d-openclaw-plugin-and-skill-virtual-pet-lane.md`
- Existing runtime authority path used by plugin calls:
  - `main.js`
  - `openclaw-bridge.js`
  - `openclaw-pet-command-lane.js`
  - `shell-observability.js`
  - `settings-runtime.js`
- Planned plugin+skill package boundary (first slice target):
- Plugin+skill package boundary:
  - `openclaw-plugin/virtual-pet/openclaw.plugin.json`
  - `openclaw-plugin/virtual-pet/package.json`
  - `openclaw-plugin/virtual-pet/index.js`
  - `openclaw-plugin/virtual-pet/schemas/virtual-pet-lane.input.schema.json`
  - `openclaw-plugin/virtual-pet/schemas/virtual-pet-lane.output.schema.json`
  - `openclaw-plugin/virtual-pet/skills/virtual-pet-lane/SKILL.md`
  - `openclaw-plugin/virtual-pet/skills/virtual-pet-lane/index.js`
  - `openclaw-plugin/virtual-pet/README.md`
- Runtime lane module:
  - `openclaw-plugin-skill-lane.js`
- Deterministic checks:
  - `scripts/check-openclaw-plugin-skill-lane.js`
  - `scripts/check-openclaw-plugin-skill-lane-live.js`
  - `scripts/run-acceptance-matrix.js` row `D12d-openclaw-plugin-skill-lane`

## Versioned Lane Contract (First Slice)
All plugin calls use a normalized envelope:

```js
{
  contractVersion: "vp-plugin-lane-v1",
  call: "virtual_pet.command.request" | "virtual_pet.status.read" | "virtual_pet.memory.sync_intent",
  correlationId: "corr_...",
  payload: {}
}
```

Rules:
- Unknown `contractVersion` => `contract_version_unsupported`.
- Unknown `call` => `unknown_call`.
- `correlationId` must be non-empty and echoed in responses.
- Responses must include `result` (`accepted` | `rejected` | `deferred`) and explicit reason on non-accepted outcomes.

## Call Contract: `virtual_pet.command.request`
Payload passes a signed envelope to the existing `12c` authority lane:

```js
{
  envelope: {
    type: "pet_command_request",
    requestId: "...",
    actionId: "dialog.injectAnnouncement",
    args: { "text": "..." },
    issuedAtMs: 0,
    expiresAtMs: 0,
    source: { "skillId": "...", "agentId": "...", "sessionId": "..." },
    auth: { "scheme": "vp-hmac-v1", "keyId": "...", "nonce": "...", "signature": "..." }
  }
}
```

Rules:
- Plugin does not bypass or duplicate app auth logic; app `12c` lane remains source of truth.
- Reject reason taxonomy from `12c` is preserved verbatim for command outcomes.

## Call Contract: `virtual_pet.status.read`
Payload requests bounded lane visibility:

```js
{
  scope: "bridge_summary" | "command_auth" | "command_policy"
}
```

Response includes only bounded fields needed by operators and pairing flows:
- lane health/state
- transport/mode summary
- command auth configured yes/no + source labels
- key id
- allowlist ids
- nonce cache size

Response excludes:
- shared-secret raw values
- unbounded runtime internals

## Call Contract: `virtual_pet.memory.sync_intent`
Payload is intent-only and bounded:

```js
{
  intentId: "intent_...",
  intentType: "memory_reflection_request" | "memory_summary_request",
  summary: "short text <= 240 chars",
  context: {
    correlationId: "corr_...",
    source: "openclaw"
  }
}
```

Rules:
- No direct canonical file writes.
- No direct mutation of runtime memory stores from plugin side.
- First slice may return `deferred` with reason `memory_sync_not_enabled` when downstream family-13 handlers are unavailable.

## Reject Reason Taxonomy (12d Additions)
- `contract_version_unsupported`
- `unknown_call`
- `invalid_call_shape`
- `invalid_intent_payload`
- `memory_sync_not_enabled`
- `transport_unavailable`
- plus pass-through `12c` command-lane reasons for `virtual_pet.command.request`

## Acceptance Bar
- Accepted for `Spec Gate` only when:
  - the plugin+skill package boundary is explicit,
  - call/version envelopes are explicit,
  - demo/failure scripts are concrete and runnable,
  - authority boundaries vs `12c`, `12e`, and family `13` are explicit.
- Accepted for final operator closure only when:
  - plugin calls execute locally with deterministic accepted/rejected/deferred outcomes,
  - visible action path (`dialog.injectAnnouncement`, `shell.openStatus`) is proven through plugin calls,
  - bounded status read is useful for operator troubleshooting and exposes no secrets,
  - deterministic check row `D12d-openclaw-plugin-skill-lane` is green.
- Not accepted if:
  - plugin contract is caller-specific and not versioned,
  - plugin can bypass `12c` authority checks,
  - memory-sync intent writes canonical files directly.

## Implementation Slice (Mandatory)
- First implementation slice shipped:
  - added `openclaw-plugin-skill-lane.js` with:
    - `vp-plugin-lane-v1` version enforcement
    - call routing for:
      - `virtual_pet.command.request`
      - `virtual_pet.status.read`
      - `virtual_pet.memory.sync_intent`
    - deterministic reject/defer taxonomy:
      - `contract_version_unsupported`
      - `unknown_call`
      - `invalid_call_shape`
      - `invalid_intent_payload`
      - `memory_sync_not_enabled`
      - `transport_unavailable`
  - wired `main.js` bridge proposed-action handling to process `virtual_pet_lane_call` requests.
  - wired `virtual_pet.command.request` to reuse the existing guarded `12c` app authority lane.
  - wired `virtual_pet.status.read` to return bounded status snapshots for:
    - `bridge_summary`
    - `command_auth`
    - `command_policy`
  - wired `virtual_pet.memory.sync_intent` to deterministic defer when downstream family-13 handlers are not enabled.
  - refactored in-project plugin scaffold to real OpenClaw plugin conventions:
    - `openclaw.plugin.json` manifest with tool + skill declarations
    - `package.json` OpenClaw extension metadata
    - plugin entry module `index.js` registering:
      - tool `virtual_pet_lane`
      - gateway methods:
        - `virtualpetlane.build_call`
        - `virtualpetlane.contract`
    - plugin-shipped skill directory:
      - `skills/virtual-pet-lane/SKILL.md`
      - `skills/virtual-pet-lane/index.js`
    - explicit input/output schemas for tool contract
  - added a live OpenClaw install/discovery check:
    - `scripts/check-openclaw-plugin-skill-lane-live.js`
    - npm script `check:openclaw-plugin-live`
    - validates install/enable/info + skills discovery using real OpenClaw CLI
    - bounded gateway RPC round-trip check (skips with explicit message until gateway restart loads plugin methods)
  - added deterministic coverage:
    - `scripts/check-openclaw-plugin-skill-lane.js`
    - acceptance matrix row `D12d-openclaw-plugin-skill-lane`
  - verification run:
    - `npm run check:syntax`
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `21/21 automated checks passed`

## Visible App Outcome
- Visible app/runtime change delivered:
  - OpenClaw proposed actions can now use a versioned plugin+skill lane envelope (`virtual_pet_lane_call`) for command/status/memory-intent calls.
  - command requests from the lane route through existing signed `12c` guardrails (no authority bypass).
  - bounded status reads are now available through the lane for pairing/troubleshooting flows.
  - memory sync intents now return deterministic deferred outcomes until family-13 memory sync handlers are enabled.

## Acceptance Notes
- `2026-03-05`: File created from the post-v1 deliverable template for `12d`.
- `2026-03-05`: Spec locked with explicit versioned call contracts (`command.request`, `status.read`, `memory.sync_intent`) and deterministic reject taxonomy.
- `2026-03-05`: First implementation slice landed with plugin+skill lane module, bridge wiring, in-project plugin scaffold, and deterministic `D12d` checks.
- `2026-03-05`: Build verification run passed:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `21/21`
- `2026-03-06`: OpenClaw plugin scaffold refactored to native `openclaw.plugin.json` + plugin entry + plugin-shipped `SKILL.md`; new live install/discovery check (`npm run check:openclaw-plugin-live`) is green.
- `2026-03-06`: Operator demo script run completed with passing evidence:
  - `npm run check:openclaw-plugin-live` -> passed (with bounded gateway RPC skip message until gateway plugin methods are loaded)
  - `virtual_pet.status.read` (`bridge_summary`) -> `accepted` with expected contract fields (`contractVersion`, `laneState`, `commandPolicy`, `commandAuth` readiness flags)
  - `virtual_pet.command.request` (`dialog.injectAnnouncement`) -> `accepted`
  - `virtual_pet.command.request` (`shell.openStatus`) -> `accepted`
  - demo summary: `PASS`
- `2026-03-06`: Operator failure/recovery script run completed with passing evidence:
  - invalid signature -> `auth_invalid_signature`
  - blocked action -> `blocked_action`
  - unsupported contract version -> `contract_version_unsupported`
  - malformed memory sync intent -> `invalid_intent_payload`
  - recovery command rerun (`dialog.injectAnnouncement`) -> `accepted` without restart
  - failure/recovery summary: `PASS`
- `2026-03-06`: Deliverable closed as accepted after operator-confirmed demo and failure/recovery evidence.

## Iteration Log
- `2026-03-05`: Initial `12d` spec drafted from template and aligned to rough-in + accepted `12c` authority boundaries.
- `2026-03-05`: Implemented first vertical slice and passed Build Gate checks.
- `2026-03-06`: Iterated scaffold to align with OpenClaw plugin conventions and added real CLI-backed live verification.
- `2026-03-06`: Operator ran demo + failure/recovery scripts and accepted closure.

## Gate Status
- `Spec Gate`: `passed` (`2026-03-05`)
- `Build Gate`: `passed` (`2026-03-05`)
- `Acceptance Gate`: `passed` (`2026-03-06`)
- `Overall`: `accepted`

## Change Log
- `2026-03-05`: File created from the post-v1 deliverable template.
- `2026-03-05`: Added first-slice plugin+skill contract, demo/failure scripts, and acceptance bar.
- `2026-03-05`: Marked `Spec Gate` passed; implementation intentionally not started.
- `2026-03-05`: Implemented first plugin+skill runtime slice, added `D12d` deterministic coverage, and passed Build Gate checks.
- `2026-03-06`: Refactored plugin scaffold to OpenClaw-native structure and added `check:openclaw-plugin-live` CLI-backed install/discovery validation.
- `2026-03-06`: Marked `Acceptance Gate` passed and closed `12d` as accepted after operator demo + failure/recovery evidence.
