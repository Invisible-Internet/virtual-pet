# Deliverable 07b: Dialog Surface and Minimal Offline Loop

**Deliverable ID:** `07b-dialog-surface-and-minimal-offline-loop`  
**Status:** `done`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-03`  
**Depends On:** `03-pet-core-events-intents-suggestions`, `04-openclaw-bridge-spec`, `07-state-system-extension-guide`  
**Blocks:** `07c-shell-settings-and-wardrobe-surface`, `08-test-and-acceptance-matrix`  
**Verification Gate:** `Visible chat/bubble path works in both online and offline modes, with deterministic local fallback dialogue and non-blocking talk feedback`

## Objective
Deliver the first visible dialog surface and the minimal offline embodiment loop without committing to a full offline personality engine.

## In Scope
- Lightweight renderer-side dialog surface.
- Text input path for `USER_MESSAGE`.
- Bubble rendering for:
  - `PET_RESPONSE`
  - `PET_ANNOUNCEMENT`
- Deterministic offline local dialogue fallback.
- Explicit source labeling for online vs offline dialog results.
- Talk feedback when the pet is "speaking":
  - bubble pulse
  - mouth/talk pulse or equivalent non-blocking fallback
- Read-only state-aware response context from D07:
  - `currentState`
  - `phase`
  - bounded `stateContextSummary`
- Local offline response template config.
- Dialog history surface sufficient for manual verification.

## Out of Scope
- Full offline personality engine.
- Trait sliders or personality GUI.
- Local-model integration.
- Voice-first UX requirements.
- Authority over movement, state arbitration, or renderer ownership.

## Dependencies
- D03 event, intent, and suggestion contracts.
- D04 bridge routing and degraded fallback semantics.
- D07 authoritative state snapshot and local state-aware description fallback.

## Decisions Locked
- Conversation remains text-first resilient.
- Offline local dialogue is bounded, deterministic, and explicitly labeled `source=offline`.
- Bubble/talk feedback is presentation only and never grants state authority.
- v1 minimal offline embodiment is intentionally smaller than a full offline personality engine.

## Implementation Breakdown
1. Add a lightweight dialog surface in `index.html` and `renderer.js`.
2. Extend preload with dialog-safe APIs:
   - `sendUserMessage(text)`
   - `getDialogHistory()`
   - `onDialogMessage(callback)`
3. Extend the contract path so `USER_MESSAGE` is first-class, not only hotkey commands.
4. Add local offline response templates in `config/dialog/offline-templates.json`.
5. Define deterministic template selection inputs:
   - `currentState`
   - `phase`
   - `triggerReason`
   - `source`
   - `recentMediaSummary`
   - `recentHobbySummary`
6. Define renderer dialog message envelope and bubble/talk feedback behavior.
7. Preserve bridge guardrails and source labeling:
   - `source=online` for bridge responses
   - `source=offline` for local fallback
8. Add one proactive-announcement path that visibly renders in the bubble.

## Verification Gate
Pass when all are true:
1. User can send a text message through a visible dialog surface.
2. Offline mode still returns a visible local answer.
3. `PET_RESPONSE` and `PET_ANNOUNCEMENT` both render in the bubble path.
4. Talk feedback appears while the pet is speaking.
5. Bubble/talk feedback does not block drag/fling behavior.
6. Local state-aware answers use D07 state context when available.
7. Source labeling is explicit for online and offline results.
8. No bridge response can seize movement or state authority.

## Tangible Acceptance Test (Doc-Level)
1. Press `Enter` or `/` to open the dialog surface and submit a text question.
2. Ask "what are you doing?" while in `Reading` and confirm the bubble shows a local state-aware answer when OpenClaw is offline.
3. Trigger `announce-test` and confirm visible bubble output plus cooldown behavior.
4. Run with `PET_OPENCLAW_MODE=offline` and confirm the pet still answers in the dialog surface with `source=offline`.
5. While a reply is shown, drag the pet and confirm movement remains smooth and non-blocking.

## Public Interfaces
### Preload-safe APIs
- `sendUserMessage(text)`
- `getDialogHistory()`
- `onDialogMessage(callback)`

### Dialog message envelope
- `messageId`
- `correlationId`
- `channel`
- `source`
- `text`
- `fallbackMode`
- `stateContextSummary` (optional)
- `talkFeedbackMode`

### Config assets
- `config/dialog/offline-templates.json`

## Implementation Slice (Mandatory)
- Implement the first visible renderer-side dialog surface.
- Implement `USER_MESSAGE` routing to online bridge or deterministic local fallback.
- Implement bubble rendering for `PET_RESPONSE` and `PET_ANNOUNCEMENT`.
- Implement non-blocking talk feedback while a message is visible.
- Persist enough dialog history to support manual verification and debugging.
- Current runtime slice shipped:
  - renderer DOM dialog surface with `Enter` / `/` open path, history list, and text submit flow
  - preload-safe dialog APIs:
    - `sendUserMessage(text)`
    - `getDialogHistory()`
    - `onDialogMessage(callback)`
  - first-class `USER_MESSAGE` contract routing in the existing main-process pipeline
  - deterministic local fallback templates via `dialog-runtime.js` and `config/dialog/offline-templates.json`
  - shared dialog-history/bubble stream for `PET_RESPONSE` and `PET_ANNOUNCEMENT`
  - bubble pulse plus non-blocking talk indicator / mouth pulse fallback
  - deterministic checks:
    - `scripts/check-contract-router.js`
    - `scripts/check-dialog-runtime.js`

## Visible App Outcome
- User can open a visible dialog input surface and submit a message.
- Pet visibly answers in a bubble even when OpenClaw is offline.
- Proactive announcements use the same visible bubble channel.
- Talk feedback makes the pet feel active while preserving drag/fling responsiveness.

## Implementation Verification (Manual)
1. Press `Enter` or `/` to open the dialog surface and send one message.
2. Run with `PET_OPENCLAW_MODE=offline`, ask "what are you doing?", and verify a visible local state-aware reply appears.
3. Trigger `announce-test` and verify visible bubble output plus cooldown behavior.
4. Confirm the response envelope exposes `source` and `fallbackMode`.
5. Confirm drag/fling remains smooth while bubble/talk feedback is active.

## Gate Status
- `Doc Gate`: `passed`
- `Implementation Gate`: `passed`
- `Overall`: `done`

## Change Log
- `2026-03-02`: File created to split dialog, bubble, and minimal offline embodiment work out of D07 while keeping D07 as the current deliverable.
- `2026-03-03`: Implemented the first D07b runtime slice with dialog surface, `USER_MESSAGE` routing, offline template fallback, shared dialog history/bubble delivery, talk feedback, and green deterministic checks. Manual in-app verification remains open before the implementation gate can pass.
- `2026-03-03`: Operator manual verification passed for visible dialog history, offline `source` / `fallbackMode` labels, proactive announcement cooldown behavior, and smooth drag/fling while talk feedback was active. D07b is closed as `done`.
