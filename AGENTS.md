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
- Current Status: `none`
- Last Completed Deliverable: `11a-openclaw-memory-observability-surface`
- Next Detailed Target: `11b-guided-pet-setup-and-markdown-bootstrap` (unless reprioritized)
- Current Gate State:
  - no active deliverable
  - last completed deliverable `11a-openclaw-memory-observability-surface` passed `Spec Gate`, `Build Gate`, and `Acceptance Gate`
- Historical Note:
  - D01-D10 are complete historical v1 records.
  - Detailed v1 session history lives in `docs/plan/archive/00-progress-tracker-v1-history.md`.
- Last completed `11a` outcome:
  - Tray `Inventory...` and `Status...` open the same shared shell popup on different tabs.
  - `Inventory` preserves the D07c inventory UI; `Status` owns the `11a` observability rows.
  - Dev fallback `F10` routes to the shared shell popup on the `Status` tab.
  - The slice is closed as accepted after operator-confirmed shared-shell routing and degraded/recovery verification.
  - Shipped outcome (this session): visible app/runtime change accepted via shared shell tabs, `Status...` tray routing, `F10` fallback, and a refreshable `11a` observability surface.

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
  - `11b-guided-pet-setup-and-markdown-bootstrap` is the next likely detailed slice unless the user explicitly reprioritizes.
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
