# Deliverable 13b: Persona Snapshot Synthesis and Provenance

**Deliverable ID:** `13b-persona-snapshot-synthesis-and-provenance`  
**Status:** `accepted`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-07`  
**Depends On:** `05-memory-pipeline-and-obsidian-adapter`, `11b-guided-pet-setup-and-markdown-bootstrap`, `11c-repair-actions-and-provenance-visibility`, `12a-real-openclaw-dialog-parity`, `13a-offline-identity-and-recent-recall`  
**Blocks:** `13c-persona-aware-offline-dialog-and-proactive-behavior`, `13d-online-reflection-and-runtime-sync`

## Objective
Define a deterministic, read-only persona snapshot derived from canonical Markdown plus accepted memory promotions, with bounded provenance and bounded online bridge export so offline and online behavior can consume the same persona facts without bypassing Markdown governance.

## Why 13b Exists (Concrete Gap After 13a)
- `13a` added deterministic offline recall for name/birthday/recent highlights, but recall logic is still intent-specific and not a unified persona read-model.
- Online dialog continuity context still lacks a first-class bounded persona package with explicit provenance.
- `13c` and `13d` need one stable persona contract before behavior tuning or online reflection sync can be implemented safely.

## In Scope
- Define `vp-persona-snapshot-v1` as a read-only runtime artifact built from canonical files and accepted memory promotions.
- Define deterministic field synthesis rules and conflict precedence across:
  - `SOUL.md`
  - `STYLE.md`
  - `IDENTITY.md`
  - `USER.md`
  - accepted memory promotions / bounded highlight evidence
- Define per-field provenance metadata and degraded-reason taxonomy.
- Define a bounded bridge export package (`vp-persona-export-v1`) for online dialog requests.
- Define `Status` detail visibility requirements for snapshot state, provenance coverage, and last export metadata.
- Define deterministic check targets and one acceptance-matrix row for this slice.

## Out of Scope
- Any canonical file write path or canonical-file governance change.
- Persona editing GUI (field mutation or trait editor).
- Offline dialog tone/proactive behavior rollout (belongs to `13c`).
- Online reflection cadence/mutation policy (belongs to `13d`).
- Unbounded raw markdown injection into bridge requests.

## Environment / Prerequisites
- Existing post-`13a` baseline with shared-shell `Status`, chat surface, and memory runtime.
- Local canonical files seeded through accepted `11b` setup flow.
- Optional accepted memory promotions and/or recent observations available for additive continuity fields.
- OpenClaw bridge may be healthy, degraded, or disabled; degraded behavior must remain deterministic and visible.

## Showcase Promise (Mandatory)
The operator can open `Status` and see a deterministic persona snapshot state with bounded provenance coverage, and when online dialog is used the bridge receives a bounded persona export package sourced from the same snapshot; if required source files are missing/unreadable, degraded reason codes are explicit and recovery is visible after restore.

## Operator Demo Script (Mandatory)
1. Start the app with valid local canonical files and OpenClaw bridge healthy.
2. Open tray `Status...` -> `Memory Runtime` detail and click `Refresh Status`.
3. Confirm snapshot fields show `Persona Snapshot: READY`, `Snapshot Version: vp-persona-snapshot-v1`, and a non-empty `Derived From` source list.
4. Trigger one online dialog request from tray `Open Chat...` (for example: `Give me a quick hello for today.`).
5. Confirm dialog reply metadata stays `source=online` and the app remains responsive.
6. Return to `Status` detail and confirm export fields show a bounded payload summary:
   - `Last Persona Export Mode: online_dialog`
   - `Last Persona Export Fields: <= 12`
   - `Last Persona Export Reason: none`
7. Use `Copy Details` and confirm exported facts include provenance tags (not raw full-file dumps).

## Failure / Recovery Script (Mandatory)
1. Break canonical inputs by pointing local workspace root to an empty folder (or temporarily removing required persona files).
2. Open `Status...` -> `Memory Runtime` detail and click `Refresh Status`.
3. Confirm degraded snapshot signal appears with deterministic reason (`canonical_missing` or `canonical_unreadable`) and missing-source detail.
4. Trigger one dialog request and confirm app behavior remains non-fatal with bounded fallback export (`minimal` or `none`) and explicit reason.
5. Restore valid local workspace root/files and click `Refresh Status`.
6. Confirm snapshot returns to `READY` and export reason clears without app restart.

## Quick Operator Test Card (Mandatory)
### Preflight (2 min max)
1. Run: `npm start`
2. Open: tray `Status...` -> `Memory Runtime` and tray `Open Chat...`
3. Confirm start signal: app is responsive and `Memory Runtime` detail renders without blank/error state

### Happy Path (5 min max)
1. Action: click `Refresh Status` in `Memory Runtime` detail.
   - Expect: `Persona Snapshot: READY` and `Snapshot Version: vp-persona-snapshot-v1`.
2. Action: send one online chat message from `Open Chat...`.
   - Expect: reply metadata shows `source=online`.
3. Action: reopen `Memory Runtime` detail.
   - Expect: `Last Persona Export Mode: online_dialog` and `Last Persona Export Fields` is bounded (`<= 12`).
4. Action: click `Copy Details`.
   - Expect: copied text includes provenance tags/source labels for exported facts.

### Failure + Recovery (5 min max)
1. Break it: `Settings` tab -> set `Canonical Files Root` to an empty/unreadable folder -> `Save Settings`, then click `Refresh Status`.
   - Expect degraded signal: `Persona Snapshot: DEGRADED` with reason `canonical_missing` or `canonical_unreadable`.
2. Recover it: restore valid `Canonical Files Root`, `Save Settings`, and click `Refresh Status`.
   - Expect recovered signal: `Persona Snapshot: READY` and degraded reason cleared.

### Pass / Fail Checklist
- [x] `Persona Snapshot: READY` appears with version label.
- [x] Online dialog still responds with `source=online`.
- [x] Last export metadata is visible and field count is bounded.
- [x] Degraded snapshot reason appears when canonical inputs are unavailable.
- [x] Snapshot recovers to `READY` after restore without restart.

## Acceptance Evidence Checklist (Mandatory)
- [x] `Status` capture showing `Persona Snapshot: READY` + version.
- [x] `Copy Details` capture showing bounded exported fields with provenance tags.
- [x] Chat capture showing `source=online` during happy-path export.
- [x] Degraded capture showing `Persona Snapshot: DEGRADED` reason.
- [x] Recovery capture showing `READY` restored.
- [x] Deterministic check output line captured for `D13b-persona-snapshot-provenance`.

## Public Interfaces / Touchpoints
- Runtime snapshot synthesis and normalization:
  - `persona-snapshot.js` (new)
  - `setup-bootstrap.js` (canonical parsing helpers, if reused)
  - `memory-pipeline.js` (accepted promotion / bounded recall feeds)
- Bridge request enrichment:
  - `openclaw-bridge.js`
  - `main.js`
  - `dialog-runtime.js`
- Shared-shell observability detail:
  - `shell-observability.js`
  - shared-shell renderer detail pane
- Deterministic checks / acceptance:
  - `scripts/check-persona-snapshot.js` (new)
  - `scripts/check-shell-observability.js` (extended)
  - `scripts/check-dialog-openclaw-parity.js` (extended)
  - `scripts/run-acceptance-matrix.js` (`D13b-persona-snapshot-provenance`)

## Persona Snapshot Contract (First Slice)
```js
{
  kind: "personaSnapshot",
  schemaVersion: "vp-persona-snapshot-v1",
  builtAt: 0,
  state: "ready|degraded",
  degradedReason: "none|canonical_missing|canonical_unreadable|parse_incomplete|memory_unavailable",
  derivedFrom: ["SOUL.md", "STYLE.md", "IDENTITY.md", "USER.md", "MEMORY.md"],
  fields: {
    pet_name: {
      value: "Nori",
      provenance: {
        sourceKind: "canonical_field",
        fileId: "IDENTITY.md",
        field: "Name"
      }
    },
    pet_pronouns: {
      value: "she/her",
      provenance: {
        sourceKind: "canonical_field",
        fileId: "IDENTITY.md",
        field: "Pronouns"
      }
    },
    tone_keywords: {
      value: ["gentle", "curious"],
      provenance: {
        sourceKind: "canonical_section",
        fileId: "STYLE.md",
        section: "Voice"
      }
    }
  },
  recentHighlights: [
    {
      summary: "You and I reviewed today's memory status.",
      evidenceTag: "obs:question_response:status-check",
      provenance: {
        sourceKind: "memory_observation",
        observationId: "obs-..."
      }
    }
  ]
}
```

Rules:
- Snapshot is read-only and rebuildable; no direct edits.
- Deterministic field order and deterministic value normalization are required.
- Identity canonical fields outrank memory promotions for conflicting identity facts.
- Memory promotions can enrich additive style/context fields but cannot overwrite canonical identity ownership.
- `recentHighlights` are bounded (`<= 3`) and safe for renderer/bridge use.

## Bridge Persona Export Contract (First Slice)
```js
{
  kind: "personaExport",
  schemaVersion: "vp-persona-export-v1",
  snapshotVersion: "vp-persona-snapshot-v1",
  state: "ready|degraded",
  degradedReason: "none|canonical_missing|canonical_unreadable|parse_incomplete|memory_unavailable",
  summary: "short bounded summary",
  facts: [
    { key: "pet_name", value: "Nori", provenanceTag: "IDENTITY.md:Name" }
  ],
  styleHints: ["gentle", "curious"],
  recentHighlights: ["You and I reviewed today's memory status."]
}
```

Rules:
- Total export payload must be bounded (target `<= 4KB` serialized JSON).
- `facts` max `12`, `styleHints` max `6`, `recentHighlights` max `3`.
- Export includes provenance tags only; do not include raw file paths beyond canonical file IDs/field labels.
- If snapshot is degraded, export remains bounded and explicit (`state/degradedReason`), not silent.

## Acceptance Bar
- `Spec Gate` passes only when snapshot schema, synthesis precedence, provenance metadata, and bounded export contract are explicit and operator-testable.
- Final acceptance requires:
  - visible `Status` snapshot readiness/degraded signals
  - deterministic bounded export metadata after online dialog requests
  - deterministic degraded reason on missing/unreadable canonical inputs
  - deterministic recovery after input restore without restart
  - green acceptance row `D13b-persona-snapshot-provenance`
- Not accepted if:
  - export payload is unbounded or non-deterministic for identical inputs
  - canonical identity ownership can be overwritten by memory promotions
  - provenance is missing or leaks sensitive config/secrets.

## Implementation Slice (Mandatory)
- Implemented first `13b` runtime slice:
  - added deterministic persona synthesis/export module:
    - `persona-snapshot.js`
    - `vp-persona-snapshot-v1` synthesis from canonical files + bounded recent highlights
    - bounded `vp-persona-export-v1` payload shaping with provenance tags and byte-size cap (`<= 4KB`)
  - wired runtime integration in `main.js`:
    - persona snapshot/export cache fields in memory snapshot runtime state
    - `dialog_user_message` bridge context now includes bounded `personaExport`
    - snapshot/export metadata now refreshes on memory init and new memory observations
  - extended bridge context normalization/path usage in `openclaw-bridge.js`:
    - `personaExport` normalization and bounds in request context
    - gateway CLI message composition includes bounded persona context block for dialog route
  - extended `Status` memory detail visibility in `shell-observability.js`:
    - `Persona Snapshot`, `Snapshot Version`, `Snapshot Fields`, `Snapshot Derived From`, `Snapshot Reason`
    - `Last Persona Export Mode`, `Last Persona Export Fields`, `Last Persona Export Reason`, `Last Persona Export Facts`, `Last Persona Export At`
- Added deterministic coverage:
  - `scripts/check-persona-snapshot.js` (new)
  - `scripts/check-dialog-openclaw-parity.js` (extended persona export bounds assertions)
  - `scripts/check-shell-observability.js` (extended persona snapshot/export provenance assertions)
  - `scripts/check-shell-settings-editor.js` (extended for `memory.enabled` and `paths.localWorkspaceRoot` bounded settings coverage)
  - `scripts/run-acceptance-matrix.js` new row:
    - `D13b-persona-snapshot-provenance`
  - package checks updated:
    - `check:syntax` now includes `persona-snapshot.js`
    - `check:contracts` now includes `scripts/check-persona-snapshot.js`
  - Operator-iteration slice from acceptance walkthrough feedback:
    - `Advanced Settings` now includes:
      - `Memory Runtime` (`memory.enabled`)
      - `Canonical Files Root` (`paths.localWorkspaceRoot`)
  - settings snapshot/env-override detail now surfaces:
    - `PET_MEMORY_ENABLED`
    - `PET_LOCAL_WORKSPACE_ROOT`
  - applying relevant settings now refreshes memory runtime in-process (no app restart required) for:
    - `memory.*`
    - `openclaw.enabled`
    - `paths.localWorkspaceRoot`
    - `paths.openClawWorkspaceRoot`
    - `paths.obsidianVaultRoot`
  - memory observability alignment iteration:
    - Advanced Settings label renamed for clarity:
      - `Canonical Files Root` (`paths.localWorkspaceRoot`)
    - `Memory Runtime` row now degrades when `Persona Snapshot` is degraded, with explicit reason:
      - `persona_snapshot_<degraded_reason>`
- Verification run passed:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `24/24 automated checks passed`

## Visible App Outcome
- Visible app/runtime change delivered:
  - online dialog bridge requests now carry bounded persona export context derived from canonical local files.
  - `Status` -> `Memory Runtime` detail now shows persona snapshot readiness/provenance and last persona export metadata.
  - degraded persona conditions (for missing/unreadable canonical files) are surfaced through deterministic reason labels.

## Acceptance Notes
- `2026-03-07`: File created from post-v1 template for `13b`.
- `2026-03-07`: Locked showcase promise, operator demo script, failure/recovery script, quick operator test card, evidence checklist, and first-slice contracts for persona snapshot synthesis + provenance export.
- `2026-03-07`: `Spec Gate` passed; implementation intentionally not started.
- `2026-03-07`: Implemented first `13b` slice for snapshot synthesis/export, bridge context wiring, and status provenance visibility.
- `2026-03-07`: Build verification passed:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `24/24`
- `2026-03-07`: Iterated settings UX for `13b` acceptance flow:
  - added `Memory Runtime` toggle and `Canonical Files Root` editor in Advanced Settings
  - extended env-override provenance for `PET_MEMORY_ENABLED` and `PET_LOCAL_WORKSPACE_ROOT`
  - added immediate memory-runtime refresh after applying relevant settings
  - aligned memory observability semantics:
    - renamed settings label to `Canonical Files Root`
    - `Memory Runtime` now reports `degraded` while persona snapshot is degraded
  - reran verification:
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `24/24`
- `2026-03-07`: Operator acceptance evidence captured:
  - happy path confirmed:
    - `Persona Snapshot: ready`
    - bounded persona export metadata and provenance tags visible
    - online dialog path confirmed
  - failure/recovery confirmed:
    - setting `Canonical Files Root` to invalid path degraded persona snapshot and memory runtime detail
    - restoring `Canonical Files Root` returned snapshot to `ready`
  - accepted closure approved by operator.

## Iteration Log
- `2026-03-07`: Initial `13b` spec drafted from roadmap rough-in and `13a` continuity requirements.
- `2026-03-07`: Added operator-requested settings controls (`memory.enabled`, `paths.localWorkspaceRoot`) and runtime refresh coupling so failure/recovery can be run entirely from the GUI.
- `2026-03-07`: Clarified settings naming (`Canonical Files Root`) and aligned observability so `Memory Runtime` degrades when persona snapshot degrades.

## Gate Status
- `Spec Gate`: `passed` (`2026-03-07`)
- `Build Gate`: `passed` (`2026-03-07`)
- `Acceptance Gate`: `passed` (`2026-03-07`)
- `Overall`: `accepted`

## Change Log
- `2026-03-07`: File created from the post-v1 deliverable template.
- `2026-03-07`: Added persona snapshot/export contracts, operator demo/failure scripts, and marked `Spec Gate` passed (spec-only session).
- `2026-03-07`: Implemented first runtime slice (`persona-snapshot.js`, bridge context export, memory/status provenance visibility) and added deterministic `D13b` acceptance coverage.
- `2026-03-07`: Marked `Build Gate` passed after green syntax/contracts/acceptance checks.
- `2026-03-07`: Iterated Advanced Settings for operator acceptance: added bounded `memory.enabled` and `paths.localWorkspaceRoot` controls, env-override visibility, and immediate memory runtime refresh on apply.
- `2026-03-07`: Iterated `13b` observability semantics: renamed `paths.localWorkspaceRoot` label to `Canonical Files Root` and made `Memory Runtime` report `degraded` when `Persona Snapshot` is degraded.
- `2026-03-07`: Marked `Acceptance Gate` passed after operator-confirmed happy-path plus failure/recovery evidence; deliverable closed as `accepted`.
