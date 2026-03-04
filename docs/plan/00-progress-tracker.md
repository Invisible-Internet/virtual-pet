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
- The first accepted post-v1 slice is `11a`.

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
- Current Status: `none`
- Last Completed Deliverable: `11a-openclaw-memory-observability-surface`
- Next Detailed Target: `11b-guided-pet-setup-and-markdown-bootstrap` (unless reprioritized)
- Current Gate State:
  - no active deliverable
  - last completed deliverable `11a-openclaw-memory-observability-surface` passed `Spec Gate`, `Build Gate`, and `Acceptance Gate`

## Post-v1 Family Rough-In
Locked family order:
1. `11` Observability / Setup / Provenance
2. `12` Conversation / Bridge
3. `13` Memory / Persona Continuity
4. `14` Embodiment / Autonomy
5. `15` Extension Showcase

Planning state:
- `11` now has an accepted baseline through `11a`; `11b` is the next likely slice unless reprioritized.
- `12` through `15` remain rough placeholders and are not implementation-ready yet.
- Full family notes live in [`11-15-post-v1-roadmap-rough-in.md`](./11-15-post-v1-roadmap-rough-in.md).

## How To Start A New Deliverable
1. Read [`00-development-workflow.md`](./00-development-workflow.md).
2. Copy [`templates/deliverable-template.md`](./templates/deliverable-template.md) to a new `docs/plan/<family><slice>-...md` file.
3. Set the new deliverable status to `specifying`.
4. Fill in the showcase promise, operator demo script, failure/recovery script, public interfaces/touchpoints, and acceptance bar.
5. Update this tracker and `AGENTS.md` to point to the new deliverable.
6. Pass `Spec Gate` before implementation begins.

## Next 3 Actions
1. Decide whether to start `11b-guided-pet-setup-and-markdown-bootstrap` next or reprioritize another post-v1 slice.
2. If `11b` stays next, create/spec the deliverable from the template before any implementation work.
3. Keep `11a` as the observability baseline and avoid scope creep into repair actions or setup-writing flows outside a new deliverable.

## Blockers
- None currently; `11a-openclaw-memory-observability-surface` is accepted and no new post-v1 deliverable is active yet.

## Last Session Summary
- Closed `11a-openclaw-memory-observability-surface` as `accepted`:
  - operator confirmed tray `Inventory...` and `Status...` both open the same shared shell window on the correct tab
  - operator confirmed `F10` opens the same shared shell window directly to `Status`
  - operator confirmed `Refresh` supports visible degraded and recovery verification without reopening the app
  - automated checks remain green: `npm run check:syntax`, `node scripts/check-shell-observability.js`, and `npm run check:acceptance` (`14/14 automated checks passed`)
- Historical note:
  - D10 closed the v1 roadmap as a doc-only research deliverable
  - detailed v1 session history is preserved in [`archive/00-progress-tracker-v1-history.md`](./archive/00-progress-tracker-v1-history.md)
- Shipped outcome note for this session:
  - visible app/runtime change accepted: `11a` now ships a shared `Inventory` / `Status` shell window, tray and `F10` routing into `Status`, and a refreshable observability surface with operator-confirmed degraded/recovery behavior
