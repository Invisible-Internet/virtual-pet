# Documentation Progress Tracker

Related:
- Workflow: [`00-development-workflow.md`](./00-development-workflow.md)
- Roadmap: [`00-master-roadmap.md`](./00-master-roadmap.md)
- Decisions: [`09-decisions-log.md`](./09-decisions-log.md)
- Template: [`templates/deliverable-template.md`](./templates/deliverable-template.md)
- Post-v1 Family Rough-In: [`11-15-post-v1-roadmap-rough-in.md`](./11-15-post-v1-roadmap-rough-in.md)
- v1 Archive: [`archive/00-progress-tracker-v1-history.md`](./archive/00-progress-tracker-v1-history.md)

## Historical Baseline
- D01-D10 are complete historical v1 records.
- The v1 roadmap is closed.
- The first real post-v1 slice is `11a`.

## Post-v1 Status Schema
Allowed values:
- `queued`
- `specifying`
- `implementing`
- `iterating`
- `blocked`
- `accepted`

Historical v1 deliverables keep their original wording and remain archived history.

## Post-v1 Gate Model
- `Spec Gate`
  - spec, showcase promise, demo script, and failure/recovery script are ready
- `Build Gate`
  - first implementation slice exists and checks are green
- `Acceptance Gate`
  - operator-visible demo passes and evidence is logged

## Current Deliverable
- Current Deliverable: `11a-openclaw-memory-observability-surface`
- Workflow State: `active`
- Current Status: `specifying`
- Last Completed Deliverable: `D10`
- Next Detailed Target: `11a-openclaw-memory-observability-surface`
- Current Gate State:
  - `Spec Gate`: `passed`
  - `Build Gate`: `not_started`
  - `Acceptance Gate`: `not_started`

## Post-v1 Family Rough-In
Locked family order:
1. `11` Observability / Setup / Provenance
2. `12` Conversation / Bridge
3. `13` Memory / Persona Continuity
4. `14` Embodiment / Autonomy
5. `15` Extension Showcase

Planning state:
- `11` is the active family currently being specified through `11a`.
- `12` through `15` remain rough placeholders and are not implementation-ready yet.
- Full family notes live in [`11-15-post-v1-roadmap-rough-in.md`](./11-15-post-v1-roadmap-rough-in.md).

## How To Start A New Deliverable
1. Read [`00-development-workflow.md`](./00-development-workflow.md).
2. Copy [`templates/deliverable-template.md`](./templates/deliverable-template.md) to a new `docs/plan/11a-...md` file.
3. Set the new deliverable status to `specifying`.
4. Fill in the showcase promise, operator demo script, failure/recovery script, public interfaces/touchpoints, and acceptance bar.
5. Update this tracker and `AGENTS.md` to point to the new deliverable.
6. Pass `Spec Gate` before implementation begins.

## Next 3 Actions
1. Begin the first implementation slice for `11a-openclaw-memory-observability-surface` without expanding scope beyond the spec-passed contract.
2. Extend the existing inventory shell window into a shared tabbed `Inventory` / `Settings` popup with a new tray `Settings...` entry and `F10` routing.
3. Keep families `12` through `15` as rough placeholders until dedicated planning sessions lock their slice-level specs.

## Blockers
- None currently; `11a-openclaw-memory-observability-surface` is now spec-passed and ready for implementation work.

## Last Session Summary
- Created and specified [`11a-openclaw-memory-observability-surface.md`](./11a-openclaw-memory-observability-surface.md):
  - refined the operator surface into a shared tabbed shell window based on the existing inventory popup
  - kept tray `Inventory...`, added tray `Settings...`, and locked `F10` to route into the same shared window on the `Settings` tab
  - defined six required status rows, an aggregated observability snapshot, and a manual `Refresh` path
  - passed the `Spec Gate` without starting implementation
- Historical note:
  - D10 closed the v1 roadmap as a doc-only research deliverable
  - detailed v1 session history is preserved in [`archive/00-progress-tracker-v1-history.md`](./archive/00-progress-tracker-v1-history.md)
- Shipped outcome note for this session:
  - no visible app change; this session refined the `11a` deliverable spec so observability lives in a new `Settings` tab inside the existing inventory shell window instead of a separate popup
