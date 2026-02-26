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

## Planning Workflow And Resume Protocol

This section defines the mandatory session handoff process for roadmap execution.

### Mandatory Startup Sequence
1. Read `AGENTS.md` first.
2. Read `docs/plan/00-progress-tracker.md`.
3. Open the file listed in `Current Deliverable`.
4. Continue only work relevant to that deliverable unless a blocker requires escalation.

### Deliverable TODO Table
Status schema:
- `not_started | in_progress | review | blocked | done`

| Deliverable | Status | File |
| --- | --- | --- |
| `00-master-roadmap` | `in_progress` | `docs/plan/00-master-roadmap.md` |
| `01-gap-analysis-expansion-vs-current` | `in_progress` | `docs/plan/01-gap-analysis-expansion-vs-current.md` |
| `02-architecture-capability-registry` | `not_started` | `docs/plan/02-architecture-capability-registry.md` |
| `02b-extension-framework-and-pack-sdk` | `not_started` | `docs/plan/02b-extension-framework-and-pack-sdk.md` |
| `03-pet-core-events-intents-suggestions` | `not_started` | `docs/plan/03-pet-core-events-intents-suggestions.md` |
| `04-openclaw-bridge-spec` | `not_started` | `docs/plan/04-openclaw-bridge-spec.md` |
| `05-memory-pipeline-and-obsidian-adapter` | `not_started` | `docs/plan/05-memory-pipeline-and-obsidian-adapter.md` |
| `06-integrations-freshrss-spotify` | `not_started` | `docs/plan/06-integrations-freshrss-spotify.md` |
| `07-state-system-extension-guide` | `not_started` | `docs/plan/07-state-system-extension-guide.md` |
| `08-test-and-acceptance-matrix` | `not_started` | `docs/plan/08-test-and-acceptance-matrix.md` |
| `09-decisions-log` | `in_progress` | `docs/plan/09-decisions-log.md` |

### Current Progress Snapshot
- Current Deliverable: `01-gap-analysis-expansion-vs-current`
- Current Status: `in_progress`
- Overall Progress: `0/9 implementation deliverables done` (docs bootstrapped, content in progress)
- Scope Note: roadmap now explicitly tracks roam modes, baseline state set/priority, tray/settings/wardrobe surface, memory/introspection contracts, and visible acceptance tests.
- Scope Note: roadmap also explicitly tracks conversation UX (chat/voice), speech bubble/dialog fallback, and lip-sync approximation with degraded-mode behavior.
- Scope Note: roadmap includes proactive pet messaging, explicit introspection payload expectations, music-mode feedback loop, and memory/hobby governance details.
- Scope Note: roadmap also includes simple/complex custom-state onboarding patterns and read-only pet state context propagation to OpenClaw.
- Scope Note: roadmap now includes `02b-extension-framework-and-pack-sdk` for extension packs, prop world model, trust/permission policy, arbitration, and OpenClaw context enrichment contracts.

### Gating Rule
- Do not advance to the next deliverable until the current deliverable is marked `done` and its verification gate is explicitly marked passed in its file and mirrored in `docs/plan/00-progress-tracker.md`.

### Session-End Update Rule
- At the end of every working session, update both:
  - `docs/plan/00-progress-tracker.md`
  - `AGENTS.md` (Current Progress Snapshot and TODO status rows)
- Ensure both files point to the same `Current Deliverable` and status before stopping.
