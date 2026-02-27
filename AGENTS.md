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

### Delivery Model (Mandatory)
- Use `spec + implementation slice` delivery for each implementation deliverable.
- From D02 onward, each deliverable must produce both:
  - Documentation contract updates.
  - A concrete runtime code slice with visible/manual verification steps.
- Required sections in each deliverable file:
  - `Implementation Slice (Mandatory)`
  - `Visible App Outcome`
  - `Implementation Verification (Manual)`
- Exception: D01 remains a completed discovery/planning baseline and is not retrofitted with runtime code requirements.

### Deliverable TODO Table
Status schema:
- `not_started | in_progress | review | blocked | done`

| Deliverable | Status | File |
| --- | --- | --- |
| `00-master-roadmap` | `in_progress` | `docs/plan/00-master-roadmap.md` |
| `01-gap-analysis-expansion-vs-current` | `done` | `docs/plan/01-gap-analysis-expansion-vs-current.md` |
| `02-architecture-capability-registry` | `done` | `docs/plan/02-architecture-capability-registry.md` |
| `02b-extension-framework-and-pack-sdk` | `done` | `docs/plan/02b-extension-framework-and-pack-sdk.md` |
| `03-pet-core-events-intents-suggestions` | `done` | `docs/plan/03-pet-core-events-intents-suggestions.md` |
| `04-openclaw-bridge-spec` | `done` | `docs/plan/04-openclaw-bridge-spec.md` |
| `05a-obsidian-workspace-bootstrap-and-connectivity` | `done` | `docs/plan/05a-obsidian-workspace-bootstrap-and-connectivity.md` |
| `05-memory-pipeline-and-obsidian-adapter` | `done` | `docs/plan/05-memory-pipeline-and-obsidian-adapter.md` |
| `06-integrations-freshrss-spotify` | `in_progress` | `docs/plan/06-integrations-freshrss-spotify.md` |
| `07-state-system-extension-guide` | `not_started` | `docs/plan/07-state-system-extension-guide.md` |
| `08-test-and-acceptance-matrix` | `not_started` | `docs/plan/08-test-and-acceptance-matrix.md` |
| `09-decisions-log` | `in_progress` | `docs/plan/09-decisions-log.md` |

### Current Progress Snapshot
- Current Deliverable: `06-integrations-freshrss-spotify`
- Current Status: `in_progress`
- Overall Progress: `7/10 implementation deliverables done` (D01, D02, D02b, D03, D04, D05a, D05 complete; D06 in progress)
- Gate Snapshot: `Doc Gate=in_progress`, `Implementation Gate=not_started`.
- Scope Note: roadmap now explicitly tracks roam modes, baseline state set/priority, tray/settings/wardrobe surface, memory/introspection contracts, and visible acceptance tests.
- Scope Note: roadmap also explicitly tracks conversation UX (chat/voice), speech bubble/dialog fallback, and lip-sync approximation with degraded-mode behavior.
- Scope Note: roadmap includes proactive pet messaging, explicit introspection payload expectations, music-mode feedback loop, and memory/hobby governance details.
- Scope Note: roadmap also includes simple/complex custom-state onboarding patterns and read-only pet state context propagation to OpenClaw.
- Scope Note: roadmap now includes `02b-extension-framework-and-pack-sdk` for extension packs, prop world model, trust/permission policy, arbitration, and OpenClaw context enrichment contracts.
- Scope Note: roadmap now explicitly tracks config-first path/settings management for OpenClaw workspace and Obsidian vault targets (including WSL path support expectations).
- Scope Note: roadmap sequencing now inserts `05a-obsidian-workspace-bootstrap-and-connectivity` before D05 gate closeout.
- Scope Note: D01 verification gate is passed and closed; focus has shifted to D02 capability contract and degraded-fallback architecture.
- Scope Note: delivery model is now `spec + implementation slice` so each deliverable ships visible runtime progress, not docs only.
- Scope Note: D02 is closed as `done` (doc + implementation gates passed).
- Scope Note: D02b is closed as `done` (doc + implementation gates passed) with verified extension discovery, trust-warning toggles, and prop interaction outcomes.
- Scope Note: D03 is closed as `done` (doc + implementation gates passed) with verified status-introspection flow, announcement cooldown skip behavior, and extension interaction correlation traces.
- Scope Note: D04 is re-closed as `done` (doc + implementation gates passed) after operator-confirmed degraded-mode drag/fling stability.
- Shipped Outcome (This Session): no new runtime code change; D05 was closed as `done` using operator startup/manual evidence confirming Obsidian-mode `runtimeReady` resolution and successful `M/H/N` memory flows (observation write, threshold-gated promotion logs, immutable-core mutation block/audit), and current deliverable advanced to D06.

### Gating Rule
- Do not advance to the next deliverable until the current deliverable is marked `done`, its verification gate is explicitly marked passed, and its implementation slice is explicitly marked passed in its file and mirrored in `docs/plan/00-progress-tracker.md`.

### Session-End Update Rule
- At the end of every working session, update both:
  - `docs/plan/00-progress-tracker.md`
  - `AGENTS.md` (Current Progress Snapshot and TODO status rows)
- Ensure both files point to the same `Current Deliverable` and status before stopping.
- Include a short shipped-outcome note:
  - Visible app/runtime changes delivered this session.
  - Or explicit `no visible app change` with reason.
