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
- Current Deliverable: `none`
- Workflow State: `idle`
- Current Status: `accepted`
- Last Completed Deliverable: `11b-guided-pet-setup-and-markdown-bootstrap`
- Next Detailed Target: `11c-repair-actions-and-provenance-visibility`
- Current Gate State:
  - `Spec Gate`: `n/a`
  - `Build Gate`: `n/a`
  - `Acceptance Gate`: `n/a`
- Historical Note:
  - D01-D10 are complete historical v1 records.
  - Detailed v1 session history lives in `docs/plan/archive/00-progress-tracker-v1-history.md`.
- Last completed `11a` outcome:
  - Tray `Inventory...` and `Status...` open the same shared shell popup on different tabs.
  - `Inventory` preserves the D07c inventory UI; `Status` owns the `11a` observability rows.
  - Dev fallback `F10` routes to the shared shell popup on the `Status` tab.
  - The slice is closed as accepted after operator-confirmed shared-shell routing and degraded/recovery verification.
  - Shipped outcome (previous accepted slice): visible app/runtime change accepted via shared shell tabs, `Status...` tray routing, `F10` fallback, and a refreshable `11a` observability surface.
- Current `11b` setup contract:
  - Tray `Setup...` and dev fallback `F11` must open the same shared shell popup on the `Setup` tab.
  - `Setup` must collect the minimum pet profile fields, preview Markdown before any write, and apply only through an explicit operator action.
  - Managed setup blocks must update `SOUL.md`, `STYLE.md`, `IDENTITY.md`, `USER.md`, and `MEMORY.md` without rewriting unrelated Markdown.
  - `STYLE.md` is a first-class project-managed file but not a documented default OpenClaw bootstrap file; keep it single-sourced and do not duplicate its contents into `SOUL.md`.
  - Pet-local workspace is the offline-mode read source and the only direct `11b` write target.
  - OpenClaw workspace is an observed/read-only agent-facing context target in `11b`; do not write to it from the pet app.
  - `HEARTBEAT.md` may be seeded only as an effectively empty/comment-only file in `11b`; proactive automation content belongs to a later slice.
  - Starter content bundles now live in `docs/plan/11b-preset-content-drafts.md` and are the current source for `11b` preset copy.
  - The preset-content draft now locks deterministic file skeletons plus ASCII-safe symbolic emoji defaults so implementation does not have to invent Markdown structure or fight encoding issues.
  - The four starter voices have been tuned for clearer separation: `gentle` is soothing, `playful` is impish, `bookish` is reflective, and `bright` is action-forward.
  - The four starter bundles are now frozen for first implementation; use the quick-picker guidance in `docs/plan/11b-preset-content-drafts.md` and do not add more starter bundles before shipping `11b`.
  - First implementation slice is now present:
    - shared shell window supports `Inventory`, `Status`, and `Setup`
    - tray `Setup...` and fallback `F11` route to the shared shell window on the `Setup` tab
    - preview/apply uses `setup-bootstrap.js` for target-policy resolution, preset generation, and managed-block writes
    - shell canonical file health now includes `STYLE.md`
    - automated smoke row `D11b-setup-bootstrap` is passing
  - Operator feedback changed the active `11b` contract:
    - the initial build attempted to write into the configured OpenClaw workspace and hit `EPERM`
    - `11b` now iterates on a local-only write policy while leaving the OpenClaw workspace observed/read-only
  - Post-iteration verification:
    - `npm run check:syntax`
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `15/15 automated checks passed`
  - Operator acceptance:
    - shared-shell `Setup` routing, preview/apply, and post-apply `Status` verification all passed in-app
    - no direct OpenClaw workspace write attempt was observed during the accepted run
  - Shipped outcome (this session): visible app/runtime change accepted; `11b` now has a working shared-shell `Setup` tab, explicit bootstrap preview/apply flow, a local-only write boundary, and repo-local bootstrap Markdown ignored by default.

### Post-v1 Roadmap Snapshot
- Rough-in doc: `docs/plan/11-15-post-v1-roadmap-rough-in.md`
- Locked family order:
  - `11` Observability / Setup / Provenance
  - `12` Conversation / Bridge
  - `13` Memory / Persona Continuity
  - `14` Embodiment / Autonomy
  - `15` Extension Showcase
- Planning rule:
  - `11` now has an accepted baseline through `11a`.
  - `11b-guided-pet-setup-and-markdown-bootstrap` is accepted and closed.
  - `11c-repair-actions-and-provenance-visibility` is the next likely slice unless the user explicitly reprioritizes.
  - `12` through `15` remain rough placeholders and must not be treated as spec-passed deliverables yet.

### Session-End Sync Rule
- At the end of every working session, update:
  - the active deliverable file if one exists
  - `docs/plan/00-progress-tracker.md`
  - `AGENTS.md`
- If no deliverable is active, update `docs/plan/00-progress-tracker.md` and `AGENTS.md` whenever workflow state or next-step guidance changes.
- Include a short shipped-outcome note:
  - visible app/runtime change delivered
  - or explicit `no visible app change` with reason
