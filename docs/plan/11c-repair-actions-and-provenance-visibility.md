# Deliverable 11c: Repair Actions and Provenance Visibility

**Deliverable ID:** `11c-repair-actions-and-provenance-visibility`  
**Status:** `accepted`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-04`  
**Depends On:** `05a-obsidian-workspace-bootstrap-and-connectivity`, `07c-shell-settings-and-wardrobe-surface`, `10-local-brain-and-personality-feasibility`, `11a-openclaw-memory-observability-surface`, `11b-guided-pet-setup-and-markdown-bootstrap`  
**Blocks:** `13a-offline-identity-and-recent-recall`, `13b-derived-persona-snapshot-from-markdown`, `15b-extension-authoring-and-debug-visibility`  

## Objective
Extend the shared-shell `Status` tab so the operator can drill into why a row or canonical file is healthy, degraded, failed, or observed-only, see the exact path/settings/runtime evidence behind that judgment, and trigger only safe repair or handoff actions without falling back to logs, manual guesswork, or hidden writes.

## In Scope
- Keep `Status` as the owner surface for repair/provenance work inside the existing shared shell window.
- Make every existing `11a` status row selectable for a deeper `why/details` view:
  - `OpenClaw Bridge`
  - `Provider / Model`
  - `Memory Runtime`
  - `Canonical Files`
  - `Paths / Sources`
  - `Validation`
- Add canonical-file drill-down for both workspaces:
  - local workspace summary
  - OpenClaw workspace summary
  - per-file detail for `SOUL.md`, `STYLE.md`, `IDENTITY.md`, `USER.md`, and `MEMORY.md`
- Expose provenance fields that explain where the current judgment came from:
  - observed path
  - workspace role
  - settings-source layer
  - runtime reason/state
  - setup-managed-block ownership when a local canonical file is readable
- Add a bounded repair-action lane for the cases the app can own safely:
  - `Refresh Status`
  - `Open Setup`
  - `Copy Path`
  - `Copy Details`
- Reuse the accepted `11b` setup flow as the local repair handoff for missing or stale local canonical files.
- Distinguish guided local repair from manual external repair and from observed-only OpenClaw diagnostics.

## Out of Scope
- Direct file writes from the `Status` tab.
- Any write, create, or delete action against the configured OpenClaw workspace.
- Editing `config/settings.json`, `settings.local.json`, or OpenClaw hook/config values from the GUI (staged for `11d`).
- New bridge restart controls, new provider/model probes, or a transport architecture rewrite.
- Full field-by-field persona provenance for a future derived persona snapshot.
- Replacing the accepted `11b` preview/apply contract with a shortcut or auto-apply path.

## Environment / Prerequisites
- Windows dev runtime via `npm start`.
- Shared shell window from D07c / `11a` / `11b`.
- Existing `Status` tab data from `shell-observability.js`.
- Existing `Setup` tab preview/apply flow from `11b`.
- Healthy-path verification assumes the local workspace root is readable and the canonical files exist.
- Degraded-path verification may use one of:
  - remove or rename one local canonical file
  - point `paths.openClawWorkspaceRoot` at a missing path
  - use `PET_FORCE_OPENCLAW_FAIL=1` to degrade bridge-facing rows

## Showcase Promise (Mandatory)
The operator can open `Status`, select a degraded row or canonical file, and immediately see why the app reached that health judgment, which path/settings/runtime source produced it, whether the issue is locally repairable or observed-only, and which safe next action to take without opening logs or guessing.

## Operator Demo Script (Mandatory)
1. Start the app with a valid local workspace root, then remove or rename the local `STYLE.md` so the `Canonical Files` row becomes degraded while the rest of the shell still loads.
2. Open `Status...` from the tray or use the existing `F10` fallback, then press `Refresh`.
3. Confirm the `Canonical Files` card is visibly degraded and exposes per-workspace or per-file selection affordances instead of only aggregate counts.
4. Select the local `STYLE.md` detail and confirm the detail surface shows:
   - the state pill and reason
   - the full local path
   - the workspace role as the pet-local canonical source
   - the settings source for the local root
   - whether a setup-managed block is present, missing, or unreadable
   - a repairability label that makes it clear this is a guided local repair case
5. Confirm the available actions are bounded to safe choices for this case:
   - `Open Setup`
   - `Refresh Status`
   - `Copy Path`
   - `Copy Details`
6. Use `Open Setup` from the detail surface and confirm the same shared shell window switches to the `Setup` tab rather than spawning a second popup.
7. Use the existing `Preview` then `Apply Setup` flow from `11b` to restore the local canonical files.
8. Return to `Status`, press `Refresh`, and re-open the local `STYLE.md` detail.
9. Confirm the file now reports `present` and readable, and that the detail panel still shows the same path/provenance surface with a healthier state.

## Failure / Recovery Script (Mandatory)
1. Start the app with a healthy local workspace and an invalid or missing `paths.openClawWorkspaceRoot`.
   - Example (PowerShell session-scoped override):
     - `$env:PET_OPENCLAW_WORKSPACE_PATH = "W:\\does-not-exist\\openclaw"`
     - `npm start`
2. Open `Status`, press `Refresh`, and select the observed OpenClaw workspace or an OpenClaw file detail from `Canonical Files` or `Paths / Sources`.
3. Confirm the detail surface shows:
   - the configured OpenClaw path
   - the reason such as `openclaw_workspace_missing` or `root_missing`
   - the settings-source provenance for that path
   - an ownership/repairability label that makes it clear the target is observed-only
4. Confirm the app does not offer a misleading write or bootstrap action for the observed OpenClaw target:
   - no `Apply Setup`
   - no direct create/repair button
   - only safe actions such as `Refresh Status`, `Copy Path`, and `Copy Details`
5. Restore the OpenClaw root to a readable location or intentionally disable OpenClaw.
   - Example recovery:
     - `Remove-Item Env:PET_OPENCLAW_WORKSPACE_PATH`
     - restart the app
6. Press `Refresh`.
7. Confirm the row/detail state updates without restart and the observed-only boundary remains explicit after recovery.

## Public Interfaces / Touchpoints
- New deliverable file: `docs/plan/11c-repair-actions-and-provenance-visibility.md`
- Shared-shell files extended:
  - `inventory.html`
  - `inventory-preload.js`
  - `inventory-shell-renderer.js`
- Main-process shell wiring extended:
  - `main.js`
  - `shell-observability.js`
- Setup bootstrap helpers referenced for ownership/provenance:
  - `setup-bootstrap.js`
- New IPC:
  - `pet:getObservabilityDetail`
  - `pet:runObservabilityAction`
- Existing IPC/actions reused:
  - `pet:getObservabilitySnapshot`
  - `pet:getSetupBootstrapSnapshot`
  - `pet:runShellAction`
  - shell action `open-setup`
- Automated coverage added:
  - `scripts/check-shell-repair-actions.js`
  - `npm run check:contracts` now includes `check-shell-repair-actions`
  - `scripts/run-acceptance-matrix.js` now includes case `D11c-repair-actions`

## Observability Detail Contract
`11c` keeps the existing summary snapshot from `11a` and adds one on-demand detail read-model for the selected subject.

Required request shape:

```js
{
  subjectId: "bridge|provider|memory|paths|validation|canonicalFiles/local|canonicalFiles/openClaw|canonicalFiles/local/STYLE.md|canonicalFiles/openClaw/STYLE.md"
}
```

Required detail shape:

```js
{
  kind: "observabilityDetail",
  ts: 0,
  subject: {
    subjectId: "canonicalFiles/local/STYLE.md",
    subjectKind: "row|workspace|file",
    rowId: "canonicalFiles",
    workspaceId: "local|openClaw|null",
    fileId: "STYLE.md|null",
    label: "Local STYLE.md",
    state: "healthy|degraded|failed|disabled|unknown",
    reason: "file_missing"
  },
  summary: {
    headline: "Local STYLE.md is missing.",
    impact: "Setup can restore the project-managed local file.",
    ownership: "local_managed|local_unmanaged|observed_only|manual_runtime",
    repairability: "guided|manual|observed_only|refresh_only"
  },
  provenance: [
    {
      label: "Observed Path",
      kind: "path|settings|runtime|ownership|role",
      value: "W:\\Dev\\virtual-pet\\local-workspace\\STYLE.md"
    }
  ],
  suggestedSteps: [
    "Open Setup and preview/apply the local bootstrap."
  ],
  actions: [
    {
      actionId: "open_setup",
      label: "Open Setup",
      kind: "primary|secondary",
      enabled: true
    }
  ]
}
```

Required rules:
- Details must be human-readable and concise; no raw JSON dump is acceptable as the primary UX.
- Every selected subject must include a stable `subjectId`, `state`, and `reason`.
- `Canonical Files` detail must support:
  - workspace-level detail for `local` and `openClaw`
  - file-level detail for each canonical file in each workspace
- Local file detail must include setup ownership visibility when readable:
  - `managed_block_present`
  - `managed_block_missing`
  - `managed_block_unreadable`
  - `not_checked`
- Path-related detail must identify which settings layer currently supplied the root when that information is available from the source map.
- `repairability=guided` is allowed only when the app can safely route the operator to an existing in-app repair path without inventing a new write lane.
- `repairability=observed_only` must be used for OpenClaw workspace subjects so the UI cannot imply app ownership over that external target.

## Repair Action Policy
`11c` adds visibility and safe handoff, not a new direct mutation surface.

Allowed action IDs for the first implementation slice:

```js
[
  "refresh_status",
  "open_setup",
  "copy_path",
  "copy_details"
]
```

Rules:
- `refresh_status`
  - always allowed
  - must re-run the existing `11a` summary snapshot and any open detail subject
- `open_setup`
  - allowed only for local canonical-file or local-path subjects that are repairable through the existing `11b` flow
  - must focus the same shared shell window on the `Setup` tab
  - must not auto-run preview or apply
- `copy_path`
  - enabled only when the subject has a concrete path
  - copies a single operator-facing path, not arbitrary runtime internals
- `copy_details`
  - copies a concise operator-facing summary of state, reason, and suggested repair text
- No `11c` action may:
  - write files directly from `Status`
  - mutate the configured OpenClaw workspace
  - rewrite settings files
  - restart or reconfigure the bridge

## Status Surface Design Contract
- `11c` must reuse the shared shell window from `11a` / `11b`; no extra repair popup.
- `Status` remains the owner tab for this slice.
- Required surface additions:
  - selectable health cards for every existing `11a` row
  - canonical-file workspace/file selectors within the `Canonical Files` area
  - one detail panel inside the `Status` tab for the currently selected subject
  - one action bar inside that detail panel
- Required detail-panel sections:
  - subject label
  - state pill
  - short headline/impact copy
  - provenance list
  - suggested repair steps
  - bounded action buttons
- Required selection behavior:
  - clicking a row selects that row's detail
  - clicking a canonical file selects the file detail rather than only the aggregate row
  - after `Refresh`, keep the current selection if the subject still exists; otherwise fall back to the first degraded subject, then to `bridge`
- Required ownership language:
  - local canonical files: project-managed local source
  - OpenClaw files: observed-only external context
  - bridge/provider/memory/settings warnings: manual runtime/config repair unless an explicit guided action exists
- This slice must not hide the existing top-level `Refresh` control; row/file detail is additive.

## Acceptance Bar
- Accepted for `Spec Gate` only when the detail contract, repair-action limits, ownership labels, guided-vs-observed-only rules, and demo scripts are explicit enough that implementation does not need to invent the UX or safety boundary.
- Accepted for final operator closure only when:
  - the `Status` tab shows a visible details surface for selected rows/files
  - the operator can identify the path/source/reason behind a degraded state without inspecting logs
  - local canonical-file issues clearly hand off to the existing `Setup` flow
  - OpenClaw workspace issues remain explicitly observed-only
  - the shared shell window is reused throughout the repair handoff
  - healthy, degraded, and recovery states are all demonstrable
- Not acceptable if:
  - the UI adds a second popup or modal-only repair flow
  - the detail surface relies on raw JSON blobs as the main operator view
  - `Status` can directly write or recreate the OpenClaw workspace
  - the operator cannot tell whether a problem is guided, manual, or observed-only
  - `Open Setup` bypasses the accepted `11b` preview/apply boundary

## Implementation Slice (Mandatory)
- First build slice is implemented:
  - `Status` cards are selectable and keyboard-focusable
  - canonical files now expose workspace/file detail selectors
  - `Status` includes a detail panel with bounded repair actions
  - detail/action IPC is wired through preload and main:
    - `pet:getObservabilityDetail`
    - `pet:runObservabilityAction`
  - `open_setup` reuses the existing shared-shell `Setup` tab handoff from `11b`
- Deterministic checks added/extended:
  - `scripts/check-shell-repair-actions.js`
  - `npm run check:contracts`
  - `scripts/run-acceptance-matrix.js` case `D11c-repair-actions`
- Verification run for this slice:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `16/16 automated checks passed`

## Visible App Outcome
- The operator can select any status row or canonical file and inspect a readable why/provenance detail.
- The detail panel now exposes bounded actions (`Refresh Status`, `Open Setup`, `Copy Path`, `Copy Details`) with guided-vs-observed-only behavior.
- Local canonical file repair routes to `Setup`; OpenClaw workspace remains observed-only.

## Acceptance Notes
- `2026-03-04`: Spec created from the post-v1 deliverable template and grounded against the accepted `11a` and `11b` runtime surfaces.
- `2026-03-04`: `Spec Gate` passed.
- `2026-03-04`: First `11c` implementation slice landed with new status-detail IPC, UI detail surface, and bounded repair actions.
- `2026-03-04`: Build verification passed:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `16/16 automated checks passed`
- `2026-03-04`: Iteration feedback pass shipped:
  - status detail language simplified for easier reading (`Where This Info Came From`, friendlier ownership/repair labels)
  - setup defaults now recover from existing local managed files so Profile/Advanced fields repopulate when data exists
  - Setup UX was reorganized for readability:
    - `User Profile` contains user-only questions
    - `Pet Profile` contains pet-only questions
    - pronouns now map from simple gender choices for user and pet
    - pet avatar now uses a browse picker
  - verification re-run stayed green (`16/16 automated checks passed`)
- `2026-03-04`: Operator acceptance confirmed:
  - in-app status details and bounded repair actions behaved as expected
  - readability and setup-form iteration feedback were addressed
  - degraded/recovery verification flow is documented and repeatable

## Iteration Log
- `2026-03-04`: Initial `11c` spec created and locked around the existing shared-shell `Status` / `Setup` surfaces, the `11a` observability snapshot, and the `11b` local-only bootstrap boundary.
- `2026-03-04`: Landed user-requested shared-shell UX polish outside the core `11c` scope (child-friendly setup copy, safe signature-emoji chooser, bottom hover-hint status bar) while keeping `11c` gates unchanged.
- `2026-03-04`: Implemented first `11c` slice and passed Build Gate checks; staged GUI settings editor work as `11d` for the next slice after `11c`.
- `2026-03-04`: Iterated on operator feedback with clearer status language and Setup field auto-recovery from local managed files.
- `2026-03-04`: Iterated Setup form UX labels/grouping, avatar browse picker, and user/pet pronoun mapping from simple gender choices.
- `2026-03-04`: Operator marked `11c` ready to close.

## Gate Status
- `Spec Gate`: `passed`
- `Build Gate`: `passed`
- `Acceptance Gate`: `passed`
- `Overall`: `accepted`

## Change Log
- `2026-03-04`: File created from the post-v1 deliverable template.
- `2026-03-04`: Passed `Spec Gate` with a bounded repair/provenance contract for the shared-shell `Status` tab.
- `2026-03-04`: Recorded adjacent shell UX polish delivered during `11c` specifying without changing the locked repair/provenance contract.
- `2026-03-04`: Implemented `11c` detail read-model/actions across shell UI, preload, and main-process IPC.
- `2026-03-04`: Added deterministic repair-action contract coverage and promoted `11c` to `implementing` with `Build Gate=passed`.
- `2026-03-04`: Improved detail copy readability and added setup-default recovery from existing local managed Markdown files.
- `2026-03-04`: Reworked Setup field grouping/labels and added gender-to-pronoun mapping plus avatar browse picker.
- `2026-03-04`: Closed `11c` as accepted after operator confirmation.
