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
- No post-v1 deliverable is active yet.
- The first real future slice will start at `11a`.

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
- Current Deliverable: `none`
- Workflow State: `idle`
- Current Status: `n/a` (no active post-v1 deliverable)
- Last Completed Deliverable: `D10`
- Next Detailed Target: `11a-openclaw-memory-observability-surface`
- Current Gate State:
  - `Spec Gate`: `n/a`
  - `Build Gate`: `n/a`
  - `Acceptance Gate`: `n/a`

## Post-v1 Family Rough-In
Locked family order:
1. `11` Observability / Setup / Provenance
2. `12` Conversation / Bridge
3. `13` Memory / Persona Continuity
4. `14` Embodiment / Autonomy
5. `15` Extension Showcase

Planning state:
- `11` is the next family to detail fully.
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
1. Detail `11a-openclaw-memory-observability-surface` from the family rough-in and turn it into a spec-passed deliverable file.
2. Create `docs/plan/11a-openclaw-memory-observability-surface.md` from the template and pass its `Spec Gate`.
3. Keep families `12` through `15` as rough placeholders until dedicated planning sessions lock their slice-level specs.

## Blockers
- None currently; future work is waiting on the first post-v1 deliverable to be approved and specified.

## Last Session Summary
- Recorded the post-v1 family rough-in for families `11` through `15`:
  - added [`11-15-post-v1-roadmap-rough-in.md`](./11-15-post-v1-roadmap-rough-in.md)
  - updated `00-master-roadmap.md`, `00-progress-tracker.md`, `AGENTS.md`, `README.md`, and `00-development-workflow.md` so the next planning target is clearly `11a-openclaw-memory-observability-surface`
- Historical note:
  - D10 closed the v1 roadmap as a doc-only research deliverable
  - detailed v1 session history is preserved in [`archive/00-progress-tracker-v1-history.md`](./archive/00-progress-tracker-v1-history.md)
- Shipped outcome note for this session:
  - no visible app change; this session preserved the agreed post-v1 family roadmap and set `11a-openclaw-memory-observability-surface` as the next detailed planning target
