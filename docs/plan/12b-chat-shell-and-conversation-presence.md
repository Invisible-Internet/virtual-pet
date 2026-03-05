# Deliverable 12b: Chat Shell and Conversation Presence

**Deliverable ID:** `12b-chat-shell-and-conversation-presence`  
**Status:** `accepted`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-05`  
**Depends On:** `07b-dialog-surface-and-minimal-offline-loop`, `11a-openclaw-memory-observability-surface`, `11d-settings-editor-and-service-controls`, `12a-real-openclaw-dialog-parity`  
**Blocks:** `12c-guarded-openclaw-pet-command-lane`

## Objective
Make chat feel like an intentional shell-mode experience by adding a dedicated tray/menu entrypoint, holding pet locomotion while dialog is open, and adding bounded proactive conversation starts with explicit cooldown and suppression rules.

## In Scope
- Add tray/menu action to open dialog directly.
- Add explicit runtime conversation-presence hold policy:
  - while dialog is open, pet locomotion/roam transitions are paused.
  - when dialog closes, locomotion resumes cleanly.
- Add bounded proactive conversation starts:
  - deterministic eligibility checks.
  - cooldown window.
  - suppression while input is active or dialog is already open.
- Surface minimal operator-visible status signals for hold/cooldown state.
- Add deterministic checks and acceptance row coverage for `12b`.

## Out of Scope
- Any new bridge/provider parity behavior already covered by `12a`.
- Signed OpenClaw command-lane auth and allowlist work (`12c`).
- TTS/STT, voice UX, or new speech transport behavior.
- Full multi-session chat UI parity with OpenClaw Control UI.

## Environment / Prerequisites
- `12a` is accepted and remains the source of truth for online/offline dialog parity.
- Existing chat surface from `07b` is functional (`Enter`/`/` open path).
- Tray/shell routing infrastructure from `11a` and `11d` is available.
- Runtime authority remains local to app process; no bridge authority changes.

## Showcase Promise (Mandatory)
Operators can open chat from the tray, observe the pet intentionally hold still while the dialog is open, and observe proactive conversation starts only under bounded conditions with visible non-spammy behavior.

## Operator Demo Script (Mandatory)
1. Start the app and confirm pet can roam normally when chat is closed.
2. Open chat from tray/menu action `Open Chat...`.
3. Confirm dialog opens and pet locomotion holds (no roam transition churn while open).
4. Send a message, receive reply, and keep dialog open; confirm hold remains active.
5. Close dialog and confirm locomotion resumes without state lock or drift.
6. Wait for proactive trigger window under normal conditions; confirm at most one proactive start occurs within cooldown.
7. Re-open dialog and confirm proactive starts are suppressed while dialog is open.

## Failure / Recovery Script (Mandatory)
1. Force a proactive trigger check while dialog is open; confirm no proactive start is emitted (`suppressed_dialog_open` reason).
2. Force a proactive trigger check during cooldown; confirm no proactive start is emitted (`suppressed_cooldown` reason).
3. Re-enable eligible conditions after cooldown and with dialog closed.
4. Confirm proactive start emits once and then re-enters cooldown.
5. Open and close dialog repeatedly and confirm locomotion hold toggles cleanly each cycle.

## Public Interfaces / Touchpoints
- Deliverable doc:
  - `docs/plan/12b-chat-shell-and-conversation-presence.md`
- Main/runtime wiring:
  - `main.js`
  - `dialog-runtime.js`
  - `state-runtime.js`
  - `pet-contract-router.js`
- Renderer/chat surface:
  - `renderer.js`
  - `index.html`
  - `preload.js`
- Tray/shell actions:
  - tray action routing in `main.js`
  - shared shell surface references in `inventory-shell-renderer.js` when needed
- Deterministic coverage (planned):
  - `scripts/check-dialog-runtime.js`
  - `scripts/check-state-runtime.js`
  - new `scripts/check-chat-shell-presence.js`
  - `scripts/run-acceptance-matrix.js` row `D12b-chat-shell-presence`

## Acceptance Bar
- Accepted for `Spec Gate` only when:
  - tray/open-chat entrypoint behavior is explicit,
  - hold/resume policy is explicit,
  - proactive trigger, cooldown, and suppression rules are explicit,
  - demo/failure scripts are concrete and operator-runnable.
- Accepted for final operator closure only when:
  - tray open-chat path is visible and stable,
  - locomotion hold/resume is deterministic and recovers cleanly,
  - proactive starts are bounded and non-spammy,
  - deterministic checks and acceptance matrix row are green.
- Not accepted if:
  - chat open state does not reliably hold locomotion,
  - proactive starts trigger while chat is active or during cooldown,
  - repeated open/close creates stuck hold state.

## Implementation Slice (Mandatory)
- First implementation slice is shipped in this session:
  - tray action `Open Chat...` now routes to the existing dialog surface via main->renderer IPC.
  - dialog open/close presence is now reported renderer->main and enforced as an explicit locomotion hold condition.
  - proactive conversation checks now run on a bounded cadence with:
    - deterministic suppression (`suppressed_dialog_open`, `suppressed_input_active`, `suppressed_state_ineligible`)
    - cooldown skip reason (`suppressed_cooldown`)
    - reason-bucket cooldown policy (`proactive_conversation`).
  - shell snapshot now surfaces minimal operator-visible presence signals:
    - `dialog.surfaceOpen`
    - `dialog.conversationHoldActive`
    - `dialog.inputActive`
    - proactive cooldown/eligibility/suppression fields
  - deterministic checks added:
    - `scripts/check-chat-shell-presence.js`
    - `scripts/check-contract-router.js` proactive check coverage extended.
  - acceptance matrix row added:
    - `D12b-chat-shell-presence`

## Visible App Outcome
- Tray now exposes `Open Chat...` and opens the existing dialog directly.
- While dialog is open, roaming locomotion is held; on close, normal roam scheduling resumes.
- Proactive chat starts now run in a bounded lane with deterministic suppression and cooldown behavior.
- Shell diagnostics/snapshot now exposes hold/cooldown/suppression state for operator verification.

## 12c Quick Pickup Notes
- `12c` stays queued and unchanged in scope.
- Resume order immediately after `12b`:
  1. Promote `12c` to active.
  2. Pass `Spec Gate` using existing draft sections and reject-reason taxonomy.
  3. Implement first allowlist slice:
     - `dialog.injectAnnouncement`
     - `shell.openStatus`
  4. Add deterministic row `D12c-guarded-pet-command-lane`.

## Acceptance Notes
- `2026-03-05`: File created from the post-v1 deliverable template.
- `2026-03-05`: Reprioritized as the active post-`12a` slice.
- `2026-03-05`: `Spec Gate` passed with tray entrypoint, hold/resume policy, and proactive suppression/cooldown behavior locked for implementation.
- `2026-03-05`: First implementation slice landed with tray open-chat routing, dialog-presence locomotion hold, and bounded proactive-start suppression/cooldown behavior.
- `2026-03-05`: Verification run passed:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `19/19 automated checks passed`
- `2026-03-05`: Operator demo/failure run accepted; `12b` closed.
- `2026-03-05`: Follow-up note captured for future slice: proactive cadence/timing should be made more context-aware so "Want to chat?" does not feel too frequent even when technically cooldown-compliant.

## Iteration Log
- `2026-03-05`: Initial `12b` spec created with explicit chat-open hold policy and proactive-start bounds.
- `2026-03-05`: Implemented first `12b` slice, including tray open-chat routing, main/renderer presence wiring, proactive bounded start lane, and deterministic `D12b` acceptance coverage.
- `2026-03-05`: Operator accepted closure with one UX follow-up: improve proactive timing policy robustness.

## Gate Status
- `Spec Gate`: `passed`
- `Build Gate`: `passed` (`2026-03-05`)
- `Acceptance Gate`: `passed` (`2026-03-05`)
- `Overall`: `accepted`

## Change Log
- `2026-03-05`: File created from the post-v1 deliverable template.
- `2026-03-05`: Added concrete `12b` scope, demo/failure scripts, acceptance bar, and `12c` quick-pickup notes.
- `2026-03-05`: Passed `Spec Gate` and moved to first implementation slice.
- `2026-03-05`: Implemented first runtime slice with tray open-chat action, dialog presence hold, proactive bounded starts, and deterministic `D12b` acceptance checks.
- `2026-03-05`: Operator accepted demo/failure script and closed deliverable as `accepted`.
