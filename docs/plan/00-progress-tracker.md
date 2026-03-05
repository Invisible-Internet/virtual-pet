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
- Current Status: `accepted`
- Last Completed Deliverable: `11d-settings-editor-and-service-controls`
- Next Detailed Target: `12a-real-openclaw-dialog-parity`
- Next Queued Target: `12a-real-openclaw-dialog-parity`
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
- `11` has an accepted baseline through `11a`.
- `11b` is now accepted and closed.
- `11c` is now accepted and closed.
- `11d-settings-editor-and-service-controls` is now accepted and closed.
- `12a-real-openclaw-dialog-parity` is staged as the next target and should move to `specifying` next unless reprioritized.
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
1. Start `12a-real-openclaw-dialog-parity` in `specifying` using the deliverable template.
2. Lock `12a` showcase promise plus operator demo and failure/recovery scripts before implementation.
3. Pass `12a` `Spec Gate` before any runtime code changes.

## Blockers
- None currently; `11d` is accepted and the workflow is ready to begin `12a` specification.

## Last Session Summary
- Closed `11d-settings-editor-and-service-controls` as accepted:
  - operator confirmed `11d` outcome as good and requested closeout
  - `Acceptance Gate` marked `passed` on `2026-03-05`
  - workflow moved to `idle` with `Current Deliverable: none`
- Iterated `11d` diagnostics overlay bounds from operator feedback:
  - fixed renderer visible-hitbox/debug bounds to use live computed sprite/rig bounds instead of static design bounds
  - scale up/down now keeps diagnostics hitbox boxes aligned with the actual character runtime bounds
  - verification run:
    - `npm run check:syntax`
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `17/17 automated checks passed`
- Iterated `11d` shared-shell settings UX and runtime scaling behavior:
  - promoted `Advanced Settings` from `Setup` section into a dedicated `Settings` tab
  - added tray routing item `Advanced Settings...` to open shared shell on the `Settings` tab
  - changed `Character Scale` to normalized slider semantics (`0..1`, where `0.5=100%`, `0=50%`, `1=200%`)
  - fixed slider drag interaction so it no longer stalls from per-input re-render
  - kept quarter-labeled tick marks (`0/25/50/75/100`) while allowing in-between slider values
  - restored a concise real-time slider value readout
  - simplified per-field value display to a single `Value` row unless an env override is active
  - unified runtime scale application so character visuals, hitbox envelope, and desktop quick-prop windows scale together
  - updated bounded editor contract so `ui.characterScalePercent` remains the GUI write key and GUI apply mirrors hitbox scale internally
  - updated deterministic checks for new shell tab routing and updated settings-editor whitelist behavior
  - verification run:
    - `npm run check:syntax`
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `17/17 automated checks passed`
- Implemented the first `11d-settings-editor-and-service-controls` runtime slice:
  - added shared-shell `Setup` -> `Advanced Settings` editor with bounded controls and explicit save
  - added new settings IPC:
    - `pet:getShellSettingsSnapshot`
    - `pet:applyShellSettingsPatch`
  - added bounded write-safety validation and blocked-key handling via `shell-settings-editor.js`
  - extended runtime settings for character sizing controls:
    - `ui.characterScalePercent`
    - `ui.characterHitboxScalePercent`
  - wired runtime layout/hitbox updates and shell-state layout propagation for visible effect
  - added deterministic coverage:
    - `scripts/check-shell-settings-editor.js`
    - acceptance matrix row `D11d-settings-editor`
  - verification run:
    - `npm run check:syntax`
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `17/17 automated checks passed`
- Started `11d-settings-editor-and-service-controls` as the active deliverable and completed spec work:
  - promoted `11d` from queued placeholder to a full spec using the post-v1 template contract
  - locked the first-slice settings whitelist, blocked-key policy, and persistence/provenance behavior
  - defined explicit operator demo and failure/recovery scripts
  - locked first-slice character sizing settings contract and validation ranges
  - passed `Spec Gate` for `11d` without starting implementation
- Iterated Setup UX from operator feedback:
  - split setup questions into `User Profile` and `Pet Profile` so user/pet data is no longer mixed
  - renamed labels to clearer child-friendly wording (for example `Pet Birthday`, `What type of creature is pet?`)
  - replaced free-text user pronouns with `Are you a boy or girl?` and mapped pronouns automatically
  - added pet gender selection (`boy/girl/thing`) and mapped pet pronouns into `IDENTITY.md`
  - changed `Pet Avatar` to a browse picker instead of free text path entry
- Iterated on operator feedback for the active `11c` slice:
  - simplified `Status` detail wording to be easier to read (`Where This Info Came From`, friendlier ownership/repairability labels, less raw `unknown` wording)
  - fixed Setup default recovery so `Profile` and `Advanced` fields repopulate from existing local managed files when data is available
  - expanded setup contract coverage to assert recovered defaults in `scripts/check-setup-bootstrap.js`
  - re-ran verification:
    - `npm run check:syntax`
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `16/16 automated checks passed`
- Implemented the first `11c` runtime slice and passed Build Gate checks:
  - `Status` cards and canonical file chips now select a detail subject
  - shared-shell `Status` now renders a details panel with ownership/provenance and bounded repair actions
  - local guided handoff uses existing `Open Setup`; OpenClaw subjects stay observed-only
  - new IPC paths are live:
    - `pet:getObservabilityDetail`
    - `pet:runObservabilityAction`
  - new deterministic contract check added:
    - `scripts/check-shell-repair-actions.js`
  - acceptance matrix now includes `D11c-repair-actions`
  - verification run:
    - `npm run check:syntax`
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `16/16 automated checks passed`
- `11c` is now accepted and closed:
  - `Spec Gate`: `passed`
  - `Build Gate`: `passed`
  - `Acceptance Gate`: `passed`
- Staging decision locked for next slice:
  - start `11d-settings-editor-and-service-controls` next
- Delivered a user-requested shared-shell UX polish pass:
  - made Setup copy more child-friendly (`Companion` labels now read as `Your Name`/`Your Timezone` in the GUI)
  - added a safe signature-emoji dropdown picker so users can choose from known options
  - added a small bottom hint/status bar that shows hover help text for controls and fields
  - kept setup writes local-only and OpenClaw observed/read-only
- Created and spec-passed `11c-repair-actions-and-provenance-visibility`:
  - locked the shared-shell `Status` detail contract for row-level and file-level provenance
  - bounded the first repair-action lane to safe actions only:
    - `Refresh Status`
    - `Open Setup`
    - `Copy Path`
    - `Copy Details`
  - kept local canonical-file repair routed through the accepted `11b` preview/apply flow instead of adding direct writes from `Status`
  - kept the configured OpenClaw workspace explicitly observed/read-only for `11c`
  - defined canonical-file detail requirements for path provenance, settings-source visibility, and setup-managed-block ownership
- Created and spec-passed `11b-guided-pet-setup-and-markdown-bootstrap`:
  - locked the shared-shell `Setup` tab model with tray `Setup...` and `F11` fallback
  - defined the initial target-policy rules for setup bootstrap before operator iteration tightened the write boundary
  - strengthened the file contract using official OpenClaw workspace/bootstrap docs
  - locked a two-root model: pet-local workspace for offline mode and OpenClaw workspace as the observed agent-facing context root
  - kept `STYLE.md` as a single-sourced first-class managed file with no duplication into `SOUL.md`
  - kept `HEARTBEAT.md` as an optional effectively empty seed
  - drafted concrete starter bundles in [`11b-preset-content-drafts.md`](./11b-preset-content-drafts.md) for `gentle_companion`, `playful_friend`, `bookish_helper`, and `bright_sidekick`
  - tightened those starter bundles with deterministic file skeletons so `SOUL.md`, `STYLE.md`, `IDENTITY.md`, `USER.md`, and `MEMORY.md` can be rendered consistently during implementation
  - replaced ambiguous emoji glyph defaults in the draft with symbolic ASCII labels to keep the preset content encoding-safe and easy to diff
  - reviewed and tuned the four starter voices so each preset has a clearer emotional lane and less overlap with its neighbors
  - added quick-picker guidance and explicitly froze the first four starter bundles so `11b` can move into implementation without more preset churn
  - defined managed Markdown block ownership for `SOUL.md`, `STYLE.md`, `IDENTITY.md`, `USER.md`, and `MEMORY.md`
  - grounded the slice against D05a bootstrap rules, D05 memory governance, D07c shell behavior, `11a` status verification, and the user-provided `STYLE.template.md`
- First implementation slice for `11b` is now shipped:
  - shared shell window now supports `Inventory`, `Status`, and `Setup`
  - tray `Setup...` and fallback `F11` route to the shared shell window on the `Setup` tab
  - `Setup` now shows target readiness, frozen preset choices, required/advanced fields, preview tabs, and explicit `Preview` / `Apply Setup` controls
  - added `setup-bootstrap.js` for target-policy resolution, managed Markdown generation, and file apply rules
  - explicit apply now writes managed blocks only into the pet-local `SOUL.md`, `STYLE.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, and optional empty/comment-only `HEARTBEAT.md`
  - extended shell observability so `STYLE.md` now participates in canonical file health
  - added smoke row `D11b-setup-bootstrap` and updated the acceptance artifact to `15/15 automated checks passed`
- Operator feedback and first iteration outcome:
  - the initial `11b` build incorrectly attempted to write into the configured OpenClaw workspace and hit `EPERM` on a `\\\\wsl$\\...` path
  - `11b` is now being iterated so setup writes only to the pet-local workspace and treats the OpenClaw workspace as observed/read-only
  - post-iteration verification is green again:
    - `npm run check:syntax`
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `15/15 automated checks passed`
- Final operator acceptance:
  - the local-only setup flow completed successfully in-app
  - the OpenClaw workspace remained read-only from the pet app's perspective
  - `11b` is now closed as `accepted`
- Historical note:
  - D10 closed the v1 roadmap as a doc-only research deliverable
  - detailed v1 session history is preserved in [`archive/00-progress-tracker-v1-history.md`](./archive/00-progress-tracker-v1-history.md)
- Shipped outcome note for this session:
  - visible app/runtime change delivered and accepted; `11d` is now closed with settings editor/tray routing, normalized scaling behavior, and corrected diagnostics hitbox overlay alignment
