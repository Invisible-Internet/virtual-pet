# Deliverable 12a: Real OpenClaw Dialog Parity

**Deliverable ID:** `12a-real-openclaw-dialog-parity`  
**Status:** `accepted`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-05`  
**Depends On:** `04-openclaw-bridge-spec`, `07b-dialog-surface-and-minimal-offline-loop`, `11a-openclaw-memory-observability-surface`, `11d-settings-editor-and-service-controls`  
**Blocks:** `none`  

## Objective
Close the gap between the existing dialog surface and real OpenClaw conversation by ensuring freeform user messages are sent through the configured OpenClaw bridge transport with explicit online/offline metadata, bounded continuity context, and deterministic fallback behavior when the bridge is unavailable.

## In Scope
- Use real OpenClaw bridge routing for freeform `USER_MESSAGE` dialog (not only command-style prompts).
- Keep explicit dialog metadata visible in history/bubble:
  - `source` (`online` or `offline`)
  - `fallbackMode` (`none` or reason code)
  - `correlationId`
- Add bounded conversation continuity context in bridge requests so follow-up questions can reference the recent exchange.
- Preserve and verify non-authority guardrails for proposed bridge actions.
- Keep deterministic offline fallback templates for degraded modes.
- Add deterministic contract/acceptance coverage for online parity plus degraded/recovery behavior.

## Out of Scope
- New chat shell window routing or tray `open-dialog` entrypoint (belongs to `12b`).
- Runtime locomotion hold policy while chat is open (belongs to `12b`).
- New OpenClaw-to-pet command execution lane beyond current guardrail blocking (belongs to `12c`).
- Voice/STT/TTS expansion.
- Persona/memory behavior rewrites from families `13+`.

## Environment / Prerequisites
- Existing dialog surface from `07b` is working (`Enter` or `/` opens chat; history + bubble render).
- Shared-shell `Status` surface from `11a` is available for operator verification.
- Settings/runtime controls from `11d` are available, including `openclaw.enabled`.
- For parity validation, OpenClaw bridge must be configured for real transport:
  - `openclaw.enabled=true`
  - `openclaw.transport=ws`
  - reachable OpenClaw gateway URL (for example `ws://127.0.0.1:18789`)
  - auth policy satisfied for non-loopback endpoints when used
- For degraded validation, use one deterministic failure setup such as:
  - `PET_FORCE_OPENCLAW_FAIL=1`, or
  - disabled OpenClaw (`openclaw.enabled=false`), or
  - unreachable/timeout bridge endpoint

## Showcase Promise (Mandatory)
When OpenClaw is reachable over the configured real bridge transport, the operator can ask normal freeform questions in the current chat UI and receive OpenClaw-backed responses that visibly report `source=online` and `fallbackMode=none`; when OpenClaw is unavailable, the same UI degrades to deterministic local fallback with explicit reason metadata and recovers cleanly after connectivity/config is restored.

## Operator Demo Script (Mandatory)
1. Configure OpenClaw for real bridge transport (`openclaw.enabled=true`, `openclaw.transport=ws`, valid gateway `openclaw.baseUrl`) and start the app.
2. Open `Status` and press `Refresh`; confirm `OpenClaw Bridge` is healthy and transport reports `ws`.
3. Open dialog (`Enter` or `/`) and send a freeform question that is not a special command (example: `What should we focus on this afternoon?`).
4. Confirm a visible pet response appears in history/bubble with:
   - `source=online`
   - `fallbackMode=none`
   - non-empty response text
5. Send one follow-up question that refers to the prior answer (example: `Can you give me one concrete first step for that?`).
6. Confirm the second response is also `source=online`, remains non-empty, and reflects continuity with the previous turn rather than acting like an isolated canned fallback.
7. Ask `what are you doing right now?` and confirm the response path remains visible and coherent in the same dialog surface.
8. While a response bubble is visible, drag the pet and confirm movement remains responsive (no chat path blocks drag/fling authority).

## Failure / Recovery Script (Mandatory)
1. Start from a healthy online bridge state and verify one successful `source=online` dialog reply.
2. Induce a deterministic bridge failure (for example `PET_FORCE_OPENCLAW_FAIL=1` or an unreachable `openclaw.baseUrl`), then send another freeform message.
3. Confirm dialog still renders a reply but metadata now shows:
   - `source=offline`
   - `fallbackMode` set to a concrete failure reason (`bridge_timeout`, `bridge_unavailable`, `bridge_disabled`, etc.)
4. Confirm the app remains responsive and dialog history keeps appending entries (no crash, no frozen input).
5. Restore healthy bridge conditions and send a new freeform message.
6. Confirm metadata returns to `source=online` and `fallbackMode=none` without requiring a renderer rewrite or behavioral authority change.

## Public Interfaces / Touchpoints
- Deliverable doc:
  - `docs/plan/12a-real-openclaw-dialog-parity.md`
- Main-process dialog and bridge routing:
  - `main.js`
  - `openclaw-bridge.js`
  - `dialog-runtime.js`
- Renderer dialog surface and metadata display:
  - `renderer.js`
  - `index.html`
- Preload-safe dialog bridge API surface:
  - `preload.js`
- Status verification surface for bridge transport/health:
  - `shell-observability.js`
  - `inventory-shell-renderer.js`
- Deterministic coverage (planned):
  - `scripts/check-openclaw-bridge.js`
  - `scripts/check-dialog-runtime.js`
  - `scripts/run-acceptance-matrix.js` (new row `D12a-dialog-openclaw-parity`)

## Dialog Parity Contract
For generic freeform user messages, `12a` requires a first-class online bridge path with bounded continuity and explicit metadata.

Required request behavior:
- Generic `USER_MESSAGE` uses route `dialog_user_message`.
- Request context includes existing bounded state/context fields from D04 plus bounded recent dialog turns for continuity.
- Guardrails still block bridge-proposed non-authority actions:
  - `set_state`
  - `render_control`
  - `identity_mutation`

Required response behavior:
- Renderer-visible dialog entries must always include:
  - `correlationId`
  - `source`
  - `fallbackMode`
  - `text`
- Healthy online path yields `source=online` and `fallbackMode=none`.
- Degraded path yields `source=offline` with explicit fallback reason code.
- Offline fallback remains deterministic and uses existing template/runtime constraints.

## Acceptance Bar
- Accepted for `Spec Gate` only when:
  - the parity gap vs current `07b` behavior is explicit,
  - demo and failure/recovery scripts are concrete and operator-runnable,
  - required interfaces and metadata/guardrail contracts are locked.
- Accepted for final operator closure only when:
  - freeform chat demonstrably uses real OpenClaw transport in healthy mode,
  - online/offline metadata is consistently visible in dialog history/bubble,
  - follow-up continuity is visibly better than isolated canned replies,
  - degraded and recovered behavior matches the scripted fallback expectations,
  - drag/fling and core authority invariants remain intact.
- Not accepted if:
  - chat still depends on stub-only behavior for healthy-path verification,
  - metadata labels are missing or misleading,
  - bridge errors silently fail without visible fallback reason,
  - new behavior bypasses existing non-authority guardrails.

## Implementation Slice (Mandatory)
- First implementation slice is now shipped:
  - bubble replies from pet are now revealed one word at a time (online and offline sources).
  - each revealed word triggers a short beep:
    - primary source file: `assets/audio/dialog-word-beep.wav`
    - fallback: synthesized short beep when the file is missing/unavailable.
  - pending-response UX now shows an animated `...` thinking indicator in the dialog bubble while waiting for reply completion.
  - typing/reveal timing and beep playback are encapsulated in renderer-side helpers so future TTS/STT replacement can swap the current beep lane cleanly.
  - generic dialog bridge requests now include bounded recent-turn continuity context:
    - `recentDialogSummary`
    - `recentDialogTurns` (bounded role/text/source turns)
  - bridge stub follow-up path now consumes continuity context deterministically for follow-up wording in automated tests.
  - added deterministic `12a` parity check:
    - `scripts/check-dialog-openclaw-parity.js`
  - acceptance matrix now includes:
    - `D12a-dialog-openclaw-parity`
- Files changed in this slice:
  - `renderer.js`
  - `index.html`
  - `main.js`
  - `openclaw-bridge.js`
  - `scripts/check-dialog-openclaw-parity.js`
  - `scripts/run-acceptance-matrix.js`
  - `package.json`
  - `assets/audio/README.md`
- Verification run:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `18/18 automated checks passed`
- Additional runtime parity slice shipped:
  - `openclaw-bridge` now supports `transport=ws` with gateway protocol support.
  - direct Node WebSocket bridge requests are attempted first for real gateway parity.
  - when gateway policy blocks direct Node WebSocket clients (`origin not allowed` / device-identity pairing requirements), the same `ws` transport now relays through `openclaw gateway call` (WSL CLI), preserving the real gateway WebSocket path while avoiding offline fallback lock-in.
  - settings/runtime normalization now accepts `openclaw.transport=ws` and observability rows show ws endpoints.
  - deterministic coverage expanded:
    - `scripts/check-openclaw-bridge.js` includes loopback WebSocket dialog transport checks.
    - `scripts/check-settings-runtime.js` includes WebSocket transport normalization checks.
  - local runtime settings default for this workspace switched from HTTP bridge endpoint to gateway WebSocket endpoint:
    - `openclaw.transport=ws`
    - `openclaw.baseUrl=ws://127.0.0.1:18789`
    - `openclaw.timeoutMs=30000`
- Verification run (post-ws slice):
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `18/18 automated checks passed`

## Visible App Outcome
- While the app is waiting on a dialog reply, the bubble now shows animated `...` to signal thinking.
- Pet reply text in the bubble now types in word-by-word, with a beep per revealed word.
- The beep path is now configurable by replacing `assets/audio/dialog-word-beep.wav` without changing runtime code.
- Bridge request context for generic freeform messages now carries bounded recent dialog turns/summary for continuity-ready OpenClaw prompts.
- Real OpenClaw dialog path now uses gateway WebSocket transport (`ws`) and no longer hard-falls back to deterministic local replies for every freeform prompt when `/bridge/dialog` HTTP POST is unavailable.

## Acceptance Notes
- `2026-03-05`: File created from the post-v1 deliverable template and grounded against existing `04`, `07b`, `11a`, and `11d` behavior.
- `2026-03-05`: `Spec Gate` passed; implementation intentionally not started in this session.
- `2026-03-05`: First `12a` implementation slice landed for dialog reveal/beep/thinking UX.
- `2026-03-05`: Automated verification passed:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `17/17 automated checks passed`
- `2026-03-05`: Follow-up `12a` implementation landed for bounded continuity context in bridge requests plus dedicated parity checks.
- `2026-03-05`: Automated verification re-ran and passed:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `18/18 automated checks passed`
- `2026-03-05`: WebSocket transport parity slice landed:
  - added `ws` bridge transport and runtime/settings normalization
  - added WS deterministic checks
  - added gateway-policy fallback relay via `openclaw gateway call` for environments where direct Node WS clients are blocked by origin/device-identity policy
  - added explicit missing-WebSocket-runtime relay handling:
    - when runtime reports `wsRuntimeUnavailable` (no native `WebSocket` in host process), startup now surfaces `wsCliRelayConfigured` and request path relays through gateway CLI instead of hard offline fallback
  - verified with live bridge probe returning `source=online` text via the `ws` path and full deterministic checks green

## Iteration Log
- `2026-03-05`: Initial `12a` spec created to lock parity contract, demo script, and degraded/recovery behavior before any code changes.
- `2026-03-05`: Added renderer-side word-by-word bubble reveal with per-word beep and pending-response animated `...` indicator.
- `2026-03-05`: Added bounded recent dialog continuity context (`recentDialogSummary`/`recentDialogTurns`) to generic bridge requests and landed deterministic `D12a` parity coverage.
- `2026-03-05`: Added real `ws` transport for OpenClaw dialog parity, plus gateway-policy fallback relay to CLI-backed gateway calls so operator chat no longer stays stuck in offline fallback when HTTP `/bridge/dialog` is unavailable.

## Gate Status
- `Spec Gate`: `passed`
- `Build Gate`: `passed` (`2026-03-05`)
- `Acceptance Gate`: `passed` (`2026-03-05`)
- `Overall`: `accepted`

## Change Log
- `2026-03-05`: File created from the post-v1 deliverable template.
- `2026-03-05`: Locked `12a` scope and marked `Spec Gate=passed` with no implementation changes.
- `2026-03-05`: Implemented first `12a` runtime slice for bubble typing-beep feedback and thinking indicator, with all deterministic checks green.
- `2026-03-05`: Implemented bounded continuity context lane for generic dialog bridge requests and added explicit `D12a-dialog-openclaw-parity` acceptance coverage.
- `2026-03-05`: Implemented `ws` transport parity for OpenClaw dialog bridge, including gateway-policy fallback relay and deterministic transport normalization checks.
- `2026-03-05`: Operator demo/failure run accepted; deliverable closed as `accepted`.
