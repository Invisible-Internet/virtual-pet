# Documentation Progress Tracker

Related:
- Workflow: [`00-development-workflow.md`](./00-development-workflow.md)
- Roadmap: [`00-master-roadmap.md`](./00-master-roadmap.md)
- Decisions: [`09-decisions-log.md`](./09-decisions-log.md)
- Template: [`templates/deliverable-template.md`](./templates/deliverable-template.md)
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
- Current Gate State:
  - `Spec Gate`: `n/a`
  - `Build Gate`: `n/a`
  - `Acceptance Gate`: `n/a`

## How To Start A New Deliverable
1. Read [`00-development-workflow.md`](./00-development-workflow.md).
2. Copy [`templates/deliverable-template.md`](./templates/deliverable-template.md) to a new `docs/plan/11a-...md` file.
3. Set the new deliverable status to `specifying`.
4. Fill in the showcase promise, operator demo script, failure/recovery script, public interfaces/touchpoints, and acceptance bar.
5. Update this tracker and `AGENTS.md` to point to the new deliverable.
6. Pass `Spec Gate` before implementation begins.

## Next 3 Actions
1. Choose the first post-v1 showcase surface to build.
2. Create `docs/plan/11a-...md` from the template and pass its `Spec Gate`.
3. Start implementation only after the demo contract is explicit enough to accept or reject cleanly.

## Blockers
- None currently; future work is waiting on the first post-v1 deliverable to be approved and specified.

## Last Session Summary
- Completed the post-v1 workflow reset:
  - added the canonical workflow doc
  - added the reusable deliverable template
  - archived the long v1 tracker history
  - rewrote the active tracker for the no-active-deliverable state
  - updated `AGENTS.md`, `README.md`, `00-master-roadmap.md`, and `09-decisions-log.md` to the new workflow vocabulary
- Historical note:
  - D10 closed the v1 roadmap as a doc-only research deliverable
  - detailed v1 session history is preserved in [`archive/00-progress-tracker-v1-history.md`](./archive/00-progress-tracker-v1-history.md)
- Shipped outcome note for this session:
  - no visible app change; this session reset the project workflow docs for post-v1 showcase-first deliverables
