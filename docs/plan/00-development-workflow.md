# Post-v1 Development Workflow

Related:
- Tracker: [`00-progress-tracker.md`](./00-progress-tracker.md)
- Roadmap: [`00-master-roadmap.md`](./00-master-roadmap.md)
- Decisions: [`09-decisions-log.md`](./09-decisions-log.md)
- Template: [`templates/deliverable-template.md`](./templates/deliverable-template.md)

## Purpose
This document defines the default workflow for all work that starts after the v1 roadmap closeout.

Use it when:
- there is no active post-v1 deliverable
- a new feature family needs to be started
- an agent or contributor needs the canonical rules for planning, implementing, iterating, and closing future slices

The historical D01-D10 deliverables remain valid records, but they do not control future slice format or status vocabulary.

## Scope
This workflow is optimized for:
- small showcase-first slices
- visible operator demos
- explicit degraded and recovery behavior
- fast iteration after feedback

This workflow is not intended to retrofit the historical v1 deliverable files.

## Core Principles
1. Showcase-first
   - A deliverable exists to prove one visible operator outcome, not to hide multiple internal bets behind one status line.
2. Demo-script-first
   - The operator demo script and failure/recovery script must be written before implementation starts.
3. Surface owns the slice
   - If work touches multiple systems, the deliverable is named after the surface that best demonstrates the outcome.
4. Small vertical slices
   - Prefer `11a`, `11b`, `11c` style slices over one large feature bundle.
5. Operator acceptance decides closure
   - A slice is not closed when it compiles. It is closed when the operator-visible demo passes and the docs are synced.

## Naming Rules
Future deliverables use a family-plus-slice format:
- `11a-openclaw-memory-observability-surface`
- `12a-real-openclaw-dialog-parity`
- `13a-offline-identity-and-recent-recall`

Rules:
- Integer = feature family
- Letter suffix = smallest showcase-first slice within that family
- Do not consume a new family number until the scope clearly changes themes

## Status Schema
Use these statuses for future post-v1 deliverables:
- `queued`
  - approved to exist, not yet active
- `specifying`
  - active planning/spec work is happening
- `implementing`
  - code/doc changes are being made against a passed spec gate
- `iterating`
  - operator feedback found gaps; refinements are in progress
- `blocked`
  - progress cannot continue due to dependency, environment, or unresolved decision
- `accepted`
  - operator demo passed, docs synced, deliverable closed

Historical v1 rows keep their old wording and are not rewritten.

## Gate Model
Every future implementation deliverable uses three gates:

### `Spec Gate`
Pass only when all are true:
- showcase promise is explicit
- operator demo script is complete
- failure/recovery script is complete
- in-scope public interfaces or touchpoints are listed
- acceptance bar is explicit enough that implementation does not need to invent UX targets

### `Build Gate`
Pass only when all are true:
- the first implementation slice exists
- targeted checks are green
- the feature is actually demoable from the app or operator surface
- the deliverable doc records what was built

### `Acceptance Gate`
Pass only when all are true:
- operator ran the exact demo script
- degraded or recovery behavior was exercised
- visible result matched the accepted bar
- iteration notes are resolved or explicitly deferred

## When Implementation Is Allowed
- No implementation work starts before `Spec Gate=passed`.
- `implementing` is only valid after the spec is locked enough to build.
- If operator feedback reveals a missing or weak visible contract, move to `iterating`, not `accepted`.

## Mandatory Deliverable Sections
Every new post-v1 deliverable file must include:
- `Showcase Promise (Mandatory)`
- `Operator Demo Script (Mandatory)`
- `Failure / Recovery Script (Mandatory)`
- `Implementation Slice (Mandatory)`
- `Visible App Outcome`
- `Acceptance Notes`
- `Iteration Log`
- `Gate Status`

It must also include:
- Objective
- In Scope
- Out of Scope
- Environment / Prerequisites
- Public Interfaces / Touchpoints
- Change Log

## Writing The Demo Contract
The operator demo script must define:
1. exact starting state
2. exact user actions
3. exact visible signals to look for
4. what counts as pass vs "needs another pass"

Good demo script properties:
- short enough to run in a few minutes
- specific enough that two people would evaluate it the same way
- tied to one visible surface

## Writing The Failure / Recovery Script
Every slice must define at least one degraded or recovery scenario.

The script should answer:
- what fails or is unavailable
- what the user should still see
- what fallback label/message/status should be visible
- how the system should recover, if recovery is part of the slice

## Logging Operator Feedback
When operator feedback changes the deliverable outcome:
1. set status to `iterating`
2. add a concise entry to `Iteration Log`
3. summarize the mismatch in the tracker session summary
4. keep refinements inside the existing showcase promise unless the spec is explicitly reopened

## Closing A Deliverable
Close a slice only when:
1. `Spec Gate=passed`
2. `Build Gate=passed`
3. `Acceptance Gate=passed`
4. status is set to `accepted`
5. the deliverable doc, tracker, and `AGENTS.md` all match

## Session-End Sync Checklist
At the end of each working session:
1. update the active deliverable file if one exists
2. update [`00-progress-tracker.md`](./00-progress-tracker.md)
3. update [`../../AGENTS.md`](../../AGENTS.md)
4. record one short shipped-outcome note:
   - visible app/runtime change delivered
   - or `no visible app change` with reason
5. if project-level state changed materially, refresh [`../../README.md`](../../README.md)

## When No Deliverable Is Active
If the tracker says:
- `Current Deliverable: none`
- `Workflow State: idle`

then do not start coding immediately.

Instead:
1. copy [`templates/deliverable-template.md`](./templates/deliverable-template.md) to a new `docs/plan/<family><slice>-...md` file
2. set the new deliverable status to `specifying`
3. write the showcase promise, demo script, and failure/recovery script
4. update the tracker and `AGENTS.md`
5. pass `Spec Gate`
6. only then start implementation

## Example Walkthrough
Hypothetical slice:
- `11a-openclaw-memory-observability-surface`

Good showcase promise:
- "User can open one visible diagnostics surface and immediately see OpenClaw status, model/provider status, Obsidian status, and active fallback mode."

Good operator demo script:
1. Start the app with diagnostics enabled.
2. Open the observability surface.
3. Confirm visible rows for:
   - OpenClaw connection
   - provider/model identity
   - Obsidian/vault status
   - current memory adapter
   - current fallback mode
4. Disable one dependency or point it at an invalid path.
5. Confirm the affected row changes visibly without crashing the app.

Good failure/recovery script:
1. Start with OpenClaw unreachable or provider unavailable.
2. Confirm the surface shows a degraded state and fallback label.
3. Restore connectivity.
4. Confirm the surface updates to healthy again.

That is small, visible, and easy to accept or reject.
