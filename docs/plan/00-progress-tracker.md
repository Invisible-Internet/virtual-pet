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
- Current Deliverable: `11b-guided-pet-setup-and-markdown-bootstrap`
- Workflow State: `active`
- Current Status: `specifying`
- Last Completed Deliverable: `11a-openclaw-memory-observability-surface`
- Next Detailed Target: `11b-guided-pet-setup-and-markdown-bootstrap`
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
- `11` has an accepted baseline through `11a`.
- `11b` is now the active post-v1 deliverable.
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
1. Implement shared-shell `Setup` routing (`Setup...` tray entry, `Setup` tab, and `F11` fallback) without breaking the existing `Inventory` / `Status` paths.
2. Build the managed Markdown preview/apply flow for `SOUL.md`, `STYLE.md`, `IDENTITY.md`, `USER.md`, and `MEMORY.md`, with optional comment-only `HEARTBEAT.md` seeding.
3. Add deterministic checks for setup target-policy handling, managed-block replacement, local-vs-OpenClaw file topology, and single-sourced `STYLE.md` generation before operator demo.

## Blockers
- None currently; `11b-guided-pet-setup-and-markdown-bootstrap` is spec-passed and ready for implementation when requested.

## Last Session Summary
- Created and spec-passed `11b-guided-pet-setup-and-markdown-bootstrap`:
  - locked the shared-shell `Setup` tab model with tray `Setup...` and `F11` fallback
  - defined the target-policy rules for local-only vs dual-target bootstrap
  - strengthened the file contract using official OpenClaw workspace/bootstrap docs
  - locked a two-root model: pet-local workspace for offline mode and OpenClaw workspace as the agent-facing mirror
  - kept `STYLE.md` as a single-sourced first-class managed file with no duplication into `SOUL.md`
  - kept `HEARTBEAT.md` as an optional effectively empty seed
  - drafted concrete starter bundles in [`11b-preset-content-drafts.md`](./11b-preset-content-drafts.md) for `gentle_companion`, `playful_friend`, `bookish_helper`, and `bright_sidekick`
  - tightened those starter bundles with deterministic file skeletons so `SOUL.md`, `STYLE.md`, `IDENTITY.md`, `USER.md`, and `MEMORY.md` can be rendered consistently during implementation
  - replaced ambiguous emoji glyph defaults in the draft with symbolic ASCII labels to keep the preset content encoding-safe and easy to diff
  - reviewed and tuned the four starter voices so each preset has a clearer emotional lane and less overlap with its neighbors
  - added quick-picker guidance and explicitly froze the first four starter bundles so `11b` can move into implementation without more preset churn
  - defined managed Markdown block ownership for `SOUL.md`, `STYLE.md`, `IDENTITY.md`, `USER.md`, and `MEMORY.md`
  - grounded the slice against D05a bootstrap rules, D05 memory governance, D07c shell behavior, `11a` status verification, and the user-provided `STYLE.template.md`
- Historical note:
  - D10 closed the v1 roadmap as a doc-only research deliverable
  - detailed v1 session history is preserved in [`archive/00-progress-tracker-v1-history.md`](./archive/00-progress-tracker-v1-history.md)
- Shipped outcome note for this session:
  - no visible app change; this session froze `11b`'s first four starter personalities and added chooser guidance so setup implementation can proceed without more preset editorial churn
