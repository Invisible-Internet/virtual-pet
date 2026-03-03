# Virtual Pet

`virtual-pet` is a Windows-first Electron desktop pet with a transparent frameless window, a Canvas renderer, main-process movement authority, and an AI-advisory architecture built around OpenClaw.

## Current Project State
- The v1 roadmap is complete through D10.
- The post-v1 family roadmap is roughed in through families `11`-`15`.
- The shipped app already includes:
  - fixed-size drag/fling desktop movement
  - roaming and user-defined roam zones
  - visible state runtime
  - dialog surface with offline fallback replies and bubble output
  - tray/inventory shell surface
  - extension discovery and prop interaction routing
  - OpenClaw bridge with online, timeout, and offline behavior
  - memory pipeline with local and Obsidian-backed modes
  - Spotify, FreshRSS, and local media sensing slices
  - acceptance coverage with automated smoke checks plus operator-visible evidence
- Future work follows the post-v1 workflow in `docs/plan`.
- The current active post-v1 deliverable is `11a-openclaw-memory-observability-surface`, with `Spec Gate` passed and implementation not started yet.

## Architecture Principles
- Local deterministic authority stays in control.
- OpenClaw is advisory only.
- Graceful degradation is required.
- Settings and external paths are config-first.
- Future work should land as showcase-first, operator-verifiable slices.

## How We Develop New Deliverables
1. Start with [`docs/plan/00-progress-tracker.md`](./docs/plan/00-progress-tracker.md).
2. If no deliverable is active, read [`docs/plan/00-development-workflow.md`](./docs/plan/00-development-workflow.md) and copy the template from [`docs/plan/templates/deliverable-template.md`](./docs/plan/templates/deliverable-template.md).
3. Define the showcase promise, operator demo script, and failure/recovery script before implementation starts.
4. Post-v1 slices move through `queued`, `specifying`, `implementing`, `iterating`, `blocked`, and `accepted`.
5. Pass `Spec Gate` before coding, and only mark `Build Gate` after the first slice is demoable and checks are green.
6. Build the smallest vertical slice that proves the visible outcome, then use operator feedback to iterate when the first pass misses the experience target.
7. Close the slice only when `Acceptance Gate` passes and the deliverable doc, tracker, and `AGENTS.md` all agree.

## Docs Map
- Workflow: [`docs/plan/00-development-workflow.md`](./docs/plan/00-development-workflow.md)
- Deliverable template: [`docs/plan/templates/deliverable-template.md`](./docs/plan/templates/deliverable-template.md)
- Tracker: [`docs/plan/00-progress-tracker.md`](./docs/plan/00-progress-tracker.md)
- Roadmap: [`docs/plan/00-master-roadmap.md`](./docs/plan/00-master-roadmap.md)
- Post-v1 family rough-in: [`docs/plan/11-15-post-v1-roadmap-rough-in.md`](./docs/plan/11-15-post-v1-roadmap-rough-in.md)
- Decisions log: [`docs/plan/09-decisions-log.md`](./docs/plan/09-decisions-log.md)
- v1 tracker archive: [`docs/plan/archive/00-progress-tracker-v1-history.md`](./docs/plan/archive/00-progress-tracker-v1-history.md)

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
npm run check:acceptance
npm run check:workspace
npm run bootstrap:obsidian-vault
```

## Contribution Notes
Contributions should preserve the current architecture constraints:
- main process remains authoritative for movement and state arbitration
- renderer remains Canvas-based for this product line
- OpenClaw remains advisory only
- future work should follow the post-v1 workflow and ship with explicit visible/manual proof

## License
MIT
