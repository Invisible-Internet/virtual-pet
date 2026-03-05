# AGENTS.md

This file defines project-specific guidance for AI agents working in `virtual-pet`.

## Project Summary

- Runtime: Electron desktop app (single transparent frameless window).
- Entry points:
  - `main.js`: window lifecycle, drag movement, monitor clamping, diagnostics pipeline.
  - `preload.js`: safe IPC bridge (`contextIsolation: true`, `nodeIntegration: false`).
  - `renderer.js`: canvas rendering and pointer input forwarding.
  - `index.html`: minimal renderer host.

## Current Behavior (Source of Truth)

- Drag authority is in the main process:
  - Renderer sends `pet:beginDrag`, `pet:drag`, `pet:endDrag`.
  - Main reads cursor via `screen.getCursorScreenPoint()`.
- Window size is intentionally fixed:
  - `WINDOW_SIZE = { width: 320, height: 320 }`.
  - Main enforces size via `setContentBounds(...)` while dragging.
- Visible pet is smaller than window:
  - `PET_VISUAL_BOUNDS = { x: 50, y: 50, width: 220, height: 220 }`.
  - This is used for edge clamping and drawing anchor.
- Multi-monitor behavior:
  - Active display is selected from cursor location with sticky fallback.
  - Clamping uses either `display.workArea` or `display.bounds` based on config.

## Configuration Flags

Update these in `main.js`:

- `DIAGNOSTICS_ENABLED`
  - `true`: console logs + `pet-debug.log` + renderer debug overlay.
  - `false`: no diagnostics output and no overlay.
- `CLAMP_TO_WORK_AREA`
  - `true`: pet stops at taskbar/menu-bar edges (recommended default).
  - `false`: pet can overlap taskbar regions.

## Critical Invariants

When changing drag/movement code, preserve these unless explicitly requested:

1. Main process remains the source of truth for drag deltas and clamping.
2. Window content size remains fixed during drag.
3. `PET_VISUAL_BOUNDS` in `main.js` and `renderer.js` stay in sync.
4. `preload.js` remains minimal and secure:
   - keep `contextIsolation: true`
   - keep `nodeIntegration: false`
   - expose only required IPC APIs

## Editing Guidance

- Prefer small, targeted edits.
- Do not introduce new dependencies unless requested.
- Keep code ASCII unless file already requires otherwise.
- Avoid reintroducing `window.setPointerCapture(...)` on `window`; pointer capture should stay on the canvas element.

## How To Run

- Install: `npm install`
- Start app: `npm start`

## Manual Verification Checklist

After movement/monitor changes, verify:

1. Slow drag across monitor seams in both directions is smooth.
2. Pet visual bounds (not transparent margin) stop at left/right/top/bottom edges.
3. Taskbar behavior matches `CLAMP_TO_WORK_AREA`.
4. Repeated grab/release does not cause drift or shrinking drag range.
5. Window does not grow during drag.

If diagnostics are enabled, also verify:

1. `pet-debug.log` is written in repo root.
2. Overlay values update while dragging.
3. `size corrected` is not constantly true without real content-size drift.

## Notes For Future Refactors

- If you change pet/window dimensions, update both:
  - Clamp math in `main.js`
  - Draw anchor/bounds in `renderer.js`
- If you centralize shared constants, prefer one source exported through preload-safe config or static JSON to avoid mismatch.

## Post-v1 Workflow

This section defines the mandatory startup and handoff protocol for all work after the v1 roadmap closeout.

### Mandatory Startup Sequence
1. Read `AGENTS.md` first.
2. Read `docs/plan/00-progress-tracker.md`.
3. If `Current Deliverable` is not `none`, open that deliverable and follow its current status and gates.
4. If `Current Deliverable` is `none`, read `docs/plan/00-development-workflow.md`, then consult `docs/plan/11-15-post-v1-roadmap-rough-in.md` before creating/specifying the next deliverable.

### Post-v1 Status Schema
- `queued`
- `specifying`
- `implementing`
- `iterating`
- `blocked`
- `accepted`

Historical v1 deliverables keep their original status wording and are not retrofitted.

### Post-v1 Gate Model
- `Spec Gate`
  - Must pass before implementation starts.
- `Build Gate`
  - First slice is implemented, checks are green, and the feature is demoable.
- `Acceptance Gate`
  - Operator-visible demo and failure/recovery script both pass with evidence logged.

### Post-v1 Workflow Rules
- Use showcase-first slices rather than broad feature bundles.
- Write the demo contract before implementation:
  - `Showcase Promise (Mandatory)`
  - `Operator Demo Script (Mandatory)`
  - `Failure / Recovery Script (Mandatory)`
- If a slice touches multiple systems, the deliverable is owned by the surface that best demonstrates the outcome.
- Do not start implementation before `Spec Gate=passed`.
- Failed operator feedback moves the slice to `iterating`, not `accepted`.
- `accepted` is the only terminal state for future post-v1 deliverables.

### Current Workflow Snapshot
- Current Deliverable: `12c-guarded-openclaw-pet-command-lane`
- Workflow State: `specifying`
- Current Status: `specifying`
- Last Completed Deliverable: `12b-chat-shell-and-conversation-presence`
- Next Detailed Target: `12c-guarded-openclaw-pet-command-lane`
- Next Queued Target: `13c-persona-aware-offline-dialog-and-proactive-behavior` (proactive robustness follow-up fit)
- Current Gate State:
  - `Spec Gate`: `passed` (`2026-03-05`)
  - `Build Gate`: `not_started`
  - `Acceptance Gate`: `not_started`
- Historical Note:
  - D01-D10 are complete historical v1 records.
  - Detailed v1 session history lives in `docs/plan/archive/00-progress-tracker-v1-history.md`.
- Last completed `12a` outcome:
  - Dialog bubble now reveals pet reply text one word at a time.
  - While revealing words, the app plays a short beep per word:
    - primary file: `assets/audio/dialog-word-beep.wav`
    - fallback: synthesized short beep if the file is missing/unavailable
  - While waiting for a reply, the bubble now shows animated `...` thinking feedback.
  - Generic bridge dialog requests now include bounded recent-turn continuity context:
    - `recentDialogSummary`
    - `recentDialogTurns`
  - OpenClaw bridge transport now supports real gateway WebSocket parity (`openclaw.transport=ws`).
  - Direct Node WebSocket gateway calls are attempted first; when blocked by gateway origin/device-identity policy, bridge now relays through `openclaw gateway call` (WSL CLI) so dialog remains `source=online` instead of deterministic offline fallback.
  - If host runtime lacks native `WebSocket` support (`wsRuntimeUnavailable`), bridge now surfaces startup reason `wsCliRelayConfigured` and uses the same CLI relay path, preventing forced offline generic fallback in Electron main.
  - Local runtime config for this workspace now defaults to:
    - `openclaw.transport=ws`
    - `openclaw.baseUrl=ws://127.0.0.1:18789`
    - `openclaw.timeoutMs=30000`
  - Acceptance smoke now includes `D12a-dialog-openclaw-parity`.
  - `Build Gate` passed on `2026-03-05` with checks green:
    - `npm run check:syntax`
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `18/18`
  - `Acceptance Gate` passed on `2026-03-05` (operator-accepted closure).
  - Shipped outcome: visible app/runtime change delivered and accepted; dialog parity is now real OpenClaw `ws` path with deterministic timeout/offline fallback and beep/thinking feedback in the existing dialog surface.
- Last completed `12b` outcome:
  - tray/menu `Open Chat...` now opens the dialog directly.
  - renderer reports dialog open/close presence to main; roaming locomotion now holds while chat is open and resumes on close.
  - proactive conversation checks now run in a bounded lane with deterministic suppression/cooldown reasons:
    - `suppressed_dialog_open`
    - `suppressed_input_active`
    - `suppressed_state_ineligible`
    - `suppressed_cooldown`
  - deterministic coverage added:
    - `scripts/check-chat-shell-presence.js`
    - acceptance row `D12b-chat-shell-presence`
  - gate outcome:
    - `Spec Gate` passed on `2026-03-05`
    - `Build Gate` passed on `2026-03-05` (`npm run check:syntax`, `npm run check:contracts`, `npm run check:acceptance` -> `19/19`)
    - `Acceptance Gate` passed on `2026-03-05` (operator-accepted closure)
  - follow-up note:
    - proactive cadence is currently policy-compliant but still feels frequent to operator; deeper timing/context robustness should be handled in `13c-persona-aware-offline-dialog-and-proactive-behavior`.
- Next `12c` spec outcome:
  - Draft deliverable file `docs/plan/12c-guarded-openclaw-pet-command-lane.md` now exists.
  - `Spec Gate` is now passed with a concrete command-lane use case (`OpenClaw -> app` bounded visible actions).
  - Auth model defines signed command envelope (`vp-hmac-v1`) with canonical signing input, nonce replay protection, and expiry/skew defaults.
  - First-slice allowlist is bounded to safe visible actions (`dialog.injectAnnouncement`, `shell.openStatus`) with explicit args and reject-reason taxonomy.
  - Lane boundary is explicit:
    - chat transport remains in `12a`
    - canonical file/memory continuity stays in family `13`
  - Implementation is not started yet; next step is first runtime slice + deterministic `D12c` coverage.
- Last completed `11d` outcome:
  - Shared-shell `Advanced Settings` now lives on a dedicated `Settings` tab (separate from `Setup`).
  - Tray now includes `Advanced Settings...` routing into the shared shell `Settings` tab.
  - New bounded settings IPC is live:
    - `pet:getShellSettingsSnapshot`
    - `pet:applyShellSettingsPatch`
  - Character scale control now uses normalized slider semantics in GUI (`0..1`, with `0.5=100%`, `0=50%`, `1=200%`) with quarter-labeled tick marks (`0/25/50/75/100`) while still allowing in-between values.
  - Runtime scale now applies together to character visuals, hitbox envelope, and quick-prop windows.
  - Renderer diagnostics overlay now uses live computed sprite/rig visible bounds so hitbox boxes stay aligned after runtime scaling changes.
  - `11d` deterministic checks are green, including `D11d-settings-editor`; `Build Gate` passed on `2026-03-04`.
  - Gate outcome:
    - `Spec Gate` passed on `2026-03-04`
    - `Build Gate` passed on `2026-03-04` (`npm run check:syntax`, `npm run check:contracts`, `npm run check:acceptance` -> `17/17`)
    - `Acceptance Gate` passed on `2026-03-05` (operator-accepted closure)
  - Shipped outcome: visible app/runtime change delivered and accepted; `11d` closed with dedicated settings routing, bounded settings apply/provenance visibility, normalized unified character scaling, and corrected diagnostics hitbox overlay alignment after scale changes.
- Last completed `11a` outcome:
  - Tray `Inventory...` and `Status...` open the same shared shell popup on different tabs.
  - `Inventory` preserves the D07c inventory UI; `Status` owns the `11a` observability rows.
  - Dev fallback `F10` routes to the shared shell popup on the `Status` tab.
  - The slice is closed as accepted after operator-confirmed shared-shell routing and degraded/recovery verification.
  - Shipped outcome (previous accepted slice): visible app/runtime change accepted via shared shell tabs, `Status...` tray routing, `F10` fallback, and a refreshable `11a` observability surface.
- Last completed `11b` outcome:
  - Tray `Setup...` and dev fallback `F11` open the same shared shell popup on the `Setup` tab.
  - `Setup` preview/apply writes managed Markdown only to the pet-local workspace.
  - The configured OpenClaw workspace remains observed/read-only from the pet app's perspective.
  - `STYLE.md` now participates in canonical file health, and the accepted `11b` smoke coverage is green.
  - The slice is closed as accepted after operator-confirmed shared-shell routing, local-only bootstrap apply, and post-apply `Status` verification.
- Last completed `11c` outcome:
  - `Status` remains the owner surface in the shared shell window; do not add a second diagnostics popup.
  - Every existing `11a` status row must open a detail view that explains state, reason, provenance, and repairability.
  - `Canonical Files` must drill down to local/OpenClaw workspace detail and per-file detail for `SOUL.md`, `STYLE.md`, `IDENTITY.md`, `USER.md`, and `MEMORY.md`.
  - Guided repair actions stay bounded to:
    - `Refresh Status`
    - `Open Setup`
    - `Copy Path`
    - `Copy Details`
  - Local canonical-file repair must hand off to the accepted `11b` `Setup` preview/apply flow; do not add direct write-from-`Status` behavior.
  - OpenClaw workspace details remain observed/read-only; do not create, write, or "repair" that workspace from the pet app.
  - Settings/config mutation UI, bridge restart controls, and full persona-field provenance remain out of scope for `11c`.
  - Latest shared-shell UX polish:
    - setup labels are now child-friendlier in the GUI (`Your Name`, `Your Timezone`, etc.)
    - `Signature Emoji` now provides a safe chooser list
    - a bottom hover-hint status bar now shows inline help/tooltips
  - First implementation slice shipped:
    - status cards + canonical file selectors now drive a details panel in `Status`
    - details expose provenance, ownership, repairability, and bounded repair actions
    - new IPC handlers exist for detail reads and detail actions
    - deterministic coverage includes `scripts/check-shell-repair-actions.js`
  - Iteration updates from operator feedback:
    - details copy uses simpler language and avoids raw `unknown` wording where possible
    - Setup Profile/Advanced defaults recover from existing local managed files when present
    - setup bootstrap checks now assert recovered defaults
    - Setup UI now separates user and pet questions (`User Profile` / `Pet Profile`)
    - user and pet pronouns map from simple gender choices
    - pet avatar now uses a browse picker instead of free-text path input
  - Gate outcome:
    - `Spec Gate` passed on `2026-03-04`
    - `Build Gate` passed on `2026-03-04` (`npm run check:syntax`, `npm run check:contracts`, `npm run check:acceptance` -> `16/16`)
    - `Acceptance Gate` passed on `2026-03-04` (operator-accepted closure)
  - Shipped outcome: visible app/runtime change delivered and accepted; `Status` has clearer repair/provenance details with bounded repair actions, and Setup now has clearer user/pet grouping, pronoun mapping, avatar browse picker, and default recovery from local managed data.

### Post-v1 Roadmap Snapshot
- Rough-in doc: `docs/plan/11-15-post-v1-roadmap-rough-in.md`
- Locked family order:
  - `11` Observability / Setup / Provenance
  - `12` Conversation / Bridge
  - `13` Memory / Persona Continuity
  - `14` Embodiment / Autonomy
  - `15` Extension Showcase
- Planning rule:
  - `11` now has accepted baselines through `11a` and `11b`.
  - `11c-repair-actions-and-provenance-visibility` is accepted and closed.
  - `11d-settings-editor-and-service-controls` is accepted and closed.
  - `12a-real-openclaw-dialog-parity` is accepted and closed (`Spec/Build/Acceptance Gates passed`).
  - `12b-chat-shell-and-conversation-presence` is accepted and closed (`Spec/Build/Acceptance Gates passed`).
  - `12c-guarded-openclaw-pet-command-lane` is the current active deliverable (`specifying`, `Spec Gate=passed`).
  - `13c-persona-aware-offline-dialog-and-proactive-behavior` is the best-fit follow-up placeholder for proactive timing/style robustness.
  - Families `13` through `15` now have tighter intent/sequencing notes, but remain rough placeholders and must not be treated as spec-passed deliverables yet.

### Session-End Sync Rule
- At the end of every working session, update:
  - the active deliverable file if one exists
  - `docs/plan/00-progress-tracker.md`
  - `AGENTS.md`
- If no deliverable is active, update `docs/plan/00-progress-tracker.md` and `AGENTS.md` whenever workflow state or next-step guidance changes.
- Include a short shipped-outcome note:
  - visible app/runtime change delivered
  - or explicit `no visible app change` with reason
