# Virtual Pet

`virtual-pet` is an Electron desktop pet with a transparent frameless window, a Canvas renderer, main-process movement authority, and an AI-advisory architecture built around OpenClaw.

The project is already beyond the original "eventually integrate AI" stage. It has shipped capability-registry, extension, contract-routing, bridge, memory, and integration slices. The current work is focused on the missing embodiment layer: a real behavior-state runtime, visible offline-safe dialog, and the first shell/settings/wardrobe surface.

## Current Status
### Verified now
- Main-process authoritative drag, clamp, and fixed-window movement.
- Canvas renderer with sprite-runtime support and current character asset manifest.
- Capability registry with health, degraded, and failed states.
- Extension discovery, validation, trust warning, and prop interaction routing.
- Contract router for event -> intent -> suggestion flows with correlation IDs.
- OpenClaw bridge with online, timeout, and offline fallback behavior plus blocked-action guardrails.
- Memory pipeline with local and Obsidian adapter modes.
- Live Spotify and FreshRSS integration probe slices with deterministic degraded fallbacks.

### In progress
- D07: deterministic state runtime and config-first state catalog.

### Planned next
- D07b: dialog surface and minimal offline loop.
- D07c: tray/settings/wardrobe surface.
- D08: acceptance matrix with executed visible proof.

### Research only
- D10: local-brain and personality feasibility.

## Architecture Principles
- Local deterministic authority stays in control.
- OpenClaw is advisory only.
- Graceful degradation is required.
- Settings and external paths are config-first.
- Deliverables use `spec + implementation slice` with manual visible verification.

The intended runtime philosophy is:
- local movement/state authority
- auditable bridge and memory behavior
- offline-safe interaction loop
- AI enrichment without AI control

## Current Runtime Surface
### Core app
- Electron desktop window with transparent frameless rendering.
- Main-process drag IPC:
  - `pet:beginDrag`
  - `pet:drag`
  - `pet:endDrag`
- Fixed content window size with visual pet bounds smaller than the transparent window.

### Renderer and assets
- Canvas renderer in [`renderer.js`](./renderer.js).
- Sprite runtime in [`renderer-sprite-runtime.js`](./renderer-sprite-runtime.js).
- Current character assets and manifest in [`assets/characters/girl/manifest.json`](./assets/characters/girl/manifest.json).

### Runtime services already present
- Capability registry in [`capability-registry.js`](./capability-registry.js).
- Extension runtime in [`extension-pack-registry.js`](./extension-pack-registry.js).
- Contract router in [`pet-contract-router.js`](./pet-contract-router.js).
- Bridge runtime in [`openclaw-bridge.js`](./openclaw-bridge.js).
- Memory runtime in [`memory-pipeline.js`](./memory-pipeline.js).
- Settings runtime in [`settings-runtime.js`](./settings-runtime.js).
- Integration runtime in [`integration-runtime.js`](./integration-runtime.js).

## Current Controls
These are the real current operator/test controls in the app, not planned controls.

### Mouse
- Drag the pet to move it.
- Release to fling it.

### Movement and sprite test controls
- `W`, `A`, `S`, `D`: movement input
- `Shift`: run
- `Space`: jump

### Extension and contract controls
- `P`: trigger the first available extension prop interaction
- `O`: toggle the first valid extension
- `I`: run `status`
- `U`: run `announce-test`
- `Y`: run `bridge-test`
- `G`: run `guardrail-test`

### Integration and memory controls
- `J`: run Spotify probe
- `L`: run FreshRSS probe
- `M`: record `music_rating`
- `R`: record `track_rating`
- `H`: run memory promotion check
- `N`: test protected identity write rejection

## Config and Runtime Modes
Tracked defaults live in [`config/settings.json`](./config/settings.json).

Key runtime areas already supported:
- `openclaw`
  - `enabled`
  - `transport`
  - `mode`
  - timeout and auth policy
- `memory`
  - `enabled`
  - `adapterMode`
  - mutation transparency policy
- `integrations`
  - Spotify
  - FreshRSS
- `paths`
  - local workspace root
  - OpenClaw workspace root
  - Obsidian vault root

Local overrides:
- `config/settings.local.json` in dev
- `%APPDATA%/virtual-pet/settings.json` in packaged builds

See [`config/README.md`](./config/README.md) for details.

## Roadmap Snapshot
### Completed
- D01 gap analysis
- D02 capability registry
- D02b extension framework
- D03 pet core contracts
- D04 OpenClaw bridge
- D05a workspace/bootstrap connectivity
- D05 memory pipeline
- D06 Spotify and FreshRSS integration slice

### Current deliverable
- D07 state system extension guide
  - main-process authoritative behavior-state runtime
  - config-first state catalog
  - `Reading` and `PoolPlay` runtime slice
  - deterministic visual fallback behavior
  - local state-aware description fallback

### Follow-on deliverables
- D07b dialog surface and minimal offline loop
- D07c shell/settings/wardrobe surface
- D08 acceptance matrix

### Post-v1 research
- D10 local-brain and personality feasibility

The source-of-truth roadmap is [`docs/plan/00-master-roadmap.md`](./docs/plan/00-master-roadmap.md).

## Known Gaps
These are intentionally not overstated as already-shipped features:
- No authoritative behavior-state runtime yet.
- No visible chat input surface yet.
- No bubble/talk feedback surface yet.
- No tray/settings/wardrobe UI yet.
- No full offline personality engine.
- No committed local-model or bundled-OpenClaw path.

## Docs Map
- Tracker: [`docs/plan/00-progress-tracker.md`](./docs/plan/00-progress-tracker.md)
- Roadmap: [`docs/plan/00-master-roadmap.md`](./docs/plan/00-master-roadmap.md)
- Decisions log: [`docs/plan/09-decisions-log.md`](./docs/plan/09-decisions-log.md)
- Current deliverable: [`docs/plan/07-state-system-extension-guide.md`](./docs/plan/07-state-system-extension-guide.md)
- Next deliverable: [`docs/plan/07b-dialog-surface-and-minimal-offline-loop.md`](./docs/plan/07b-dialog-surface-and-minimal-offline-loop.md)
- Shell/settings deliverable: [`docs/plan/07c-shell-settings-and-wardrobe-surface.md`](./docs/plan/07c-shell-settings-and-wardrobe-surface.md)
- Final validation deliverable: [`docs/plan/08-test-and-acceptance-matrix.md`](./docs/plan/08-test-and-acceptance-matrix.md)
- Post-v1 research deliverable: [`docs/plan/10-local-brain-and-personality-feasibility.md`](./docs/plan/10-local-brain-and-personality-feasibility.md)

## Getting Started
Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm start
```

Run checks:

```bash
npm run check
```

Useful targeted checks:

```bash
npm run check:workspace
npm run bootstrap:obsidian-vault
```

## Contribution Notes
Contributions should preserve the current architecture constraints:
- main process remains authoritative for movement and state arbitration
- renderer remains Canvas-based for this roadmap
- OpenClaw remains advisory only
- new work should land as small, verifiable slices with visible/manual proof

## License
MIT

