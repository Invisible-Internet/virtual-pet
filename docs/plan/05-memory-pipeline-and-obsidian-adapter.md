# Deliverable 05: Memory Pipeline and Obsidian Adapter

**Deliverable ID:** `05-memory-pipeline-and-obsidian-adapter`  
**Status:** `done`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-27`  
**Depends On:** `05a-obsidian-workspace-bootstrap-and-connectivity`  
**Blocks:** `06-integrations-freshrss-spotify`, `08-test-and-acceptance-matrix`  
**Verification Gate:** `Memory logging/summarization/promotion rules are fully specified and a guarded local memory pipeline slice is implemented with visible evidence`

## Objective
Define memory pipeline architecture that can run with or without Obsidian, while supporting OpenClaw-assisted summarization.

## In Scope
- Observation log schema.
- Daily summary flow and trigger model.
- Identity promotion guardrails.
- Adapter model: `local` and `obsidian`.
- Config-driven path resolution for:
  - OpenClaw workspace root.
  - Obsidian vault root.
  - Local fallback workspace root.
- Write-target controls and mutation log.
- Two-domain memory model:
  - Domain 1: OpenClaw core workspace docs.
  - Domain 2: Optional Obsidian vault (`W:\\AI\\PrimeaVault`) structure and adapter mapping.
- Core workspace file expectations:
  - `SOUL.md`
  - `IDENTITY.md`
  - `USER.md`
  - `MEMORY.md`
  - `/memory/YYYY-MM-DD.md`
- Obsidian vault layout expectations:
  - `/01_Logs`
  - `/02_User`
  - `/03_Primea`
  - `/04_Analysis`
  - `/99_System`
- Tiered memory policy:
  - Tier 1 Observations (append-only frequent logs, no interpretation at this layer).
  - Tier 2 Pattern summaries (daily structured updates).
  - Tier 3 Identity promotion (rare, threshold-gated, logged).
- Tier 1 observation examples:
  - `music_rating`
  - `question_response`
  - `hobby_summary`
- Tier 2 default update targets:
  - `/02_User/music.md` (auto-managed sections only)
  - `/03_Primea/music_identity.md` (auto-managed sections only)
- Identity partition model:
  - Immutable Core (never auto-modified).
  - Declared Preferences (manual/rare).
  - Adaptive Preferences (auto-updated under thresholds).
- Identity mutation transparency policy (configurable):
  - `silent`
  - `logged`
  - `brief_notification`
- Mutation audit target:
  - `/04_Analysis/identity-mutations.md`

## Planning Decisions (2026-02-26)
1. Canonical memory artifacts should be Markdown-first for user-owned files.
2. Current `.jsonl` decision logs are accepted only as implementation-slice transitional outputs.
3. Introduce a settings file in a `config/` folder to define path dependencies and adapter mode, then have runtime read from that file first.
4. Keep local workspace files (`SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`) as offline fallback bootstrap, but allow redirect to OpenClaw workspace when configured.
5. Support Windows + WSL path targets for OpenClaw/Obsidian by allowing UNC paths (for example `\\\\wsl$\\Ubuntu\\...`) in settings.
6. D05 closeout is gated by D05a real-path validation evidence (OpenClaw in WSL + local Obsidian vault) before final implementation pass.

## Out of Scope
- Full memory UX in notebook UI.
- Unbounded autonomous identity mutation.

## Dependencies
- D03 contract definitions.
- D04 bridge behavior.

## Decisions Locked
- Pet logs observations locally.
- OpenClaw summarizes; pet applies guarded writes.
- Obsidian is optional and replaceable.

## Memory Contracts
### Tier 1 Observation Record (Runtime-Implemented)
- Required fields:
  - `observationId`
  - `ts`
  - `observationType`
  - `source`
  - `correlationId`
  - `evidenceTag`
  - `payload`
- Write model:
  - append-only
  - one-line markdown entry per observation
  - no in-place edits
- Current runtime producers:
  - user command contract events (`question_response`)
  - extension prop interactions (`hobby_summary`)
  - manual memory hotkey path (`music_rating`)

### Promotion Decision Record (Runtime-Implemented)
- Required fields:
  - `decisionId`
  - `ts`
  - `candidateType`
  - `focusObservationType`
  - `outcome` (`accepted` | `rejected`)
  - `reasons[]`
  - `thresholds`
  - `metrics`
  - `sourceEvidenceIds[]`
- Decision output is persisted for both acceptance and rejection outcomes.

### Identity Mutation Audit Record (Runtime-Implemented)
- Required fields:
  - `mutationId`
  - `ts`
  - `section`
  - `outcome` (`allowed` | `blocked`)
  - `reason`
  - `transparencyPolicy`
  - `evidence[]`
  - `requestedPatch`
- Protected target rule:
  - any mutation to `Immutable Core` is blocked and audited.

## Adapter Behavior and Fallback Contract
| Requested Mode | Preconditions | Active Mode | Fallback Reason | Behavior |
| --- | --- | --- | --- | --- |
| `local` | none | `local` | `none` | write to workspace memory files |
| `obsidian` | vault path exists and is directory | `obsidian` | `none` | write to Obsidian structure |
| `obsidian` | vault missing/not directory | `local` | `obsidian_vault_missing` or `obsidian_vault_not_directory` | degrade to local adapter without runtime failure |
| `obsidian` | vault exists but layout init fails | `local` | `obsidian_layout_failed` | degrade to local adapter without runtime failure |

## Settings Contract (Planned)
- Planned source of truth file: `config/settings.json`.
- Initial required keys:
  - `memory.adapterMode` (`local` | `obsidian`)
  - `paths.openClawWorkspaceRoot` (absolute path, optional)
  - `paths.obsidianVaultRoot` (absolute path, optional)
  - `paths.localWorkspaceRoot` (absolute path, defaults to app workspace)
  - `memory.mutationTransparencyPolicy` (`silent` | `logged` | `brief_notification`)
- Resolution order:
  1. `config/settings.json`
  2. environment overrides (`PET_MEMORY_ADAPTER`, `PET_OBSIDIAN_VAULT_PATH`, etc.)
  3. safe defaults

## Summary and Promotion Rules
- Tier 2 cadence default: `daily + manual trigger` hybrid.
- Tier 3 promotion thresholds (default):
  - `minimumInteractionCount = 3`
  - `minimumPersistenceHours = 6`
  - `minimumDistinctEvidencePoints = 2`
- Anti-volatility rules:
  - promotion requires repeated evidence over time window, not one event.
  - low-evidence or short-window candidates are rejected with explicit reason codes.

## Workspace and Vault Path Guarantees
### Local mode
- Ensures base files exist on startup:
  - `SOUL.md`
  - `IDENTITY.md`
  - `USER.md`
  - `MEMORY.md`
- Writes observations to:
  - `/memory/YYYY-MM-DD.md`
- Transitional implementation-slice decision logs currently write to:
  - `/memory/promotion-decisions.jsonl`
  - `/memory/identity-mutations.jsonl`
- Planned canonical Markdown decision logs:
  - `/memory/promotion-decisions.md`
  - `/memory/identity-mutations.md`

### Obsidian mode
- Ensures required folders exist on startup:
  - `/01_Logs`
  - `/02_User`
  - `/03_Primea`
  - `/04_Analysis`
  - `/99_System`
- Writes observations to:
  - `/01_Logs/YYYY-MM-DD.md`
- Writes decision logs to:
  - `/04_Analysis/promotion-decisions.md`
  - `/04_Analysis/identity-mutations.md`

## Implementation Slice (Mandatory)
- Implement local memory adapter scaffold and Tier-1 observation write path.
- Implement one summarization/promotion evaluation step with threshold result logging.
- Implement guarded write policy for protected identity sections.
- Implement fallback behavior when optional Obsidian path unavailable.

### Planned Follow-Up Slice (Settings + Format Alignment)
- Add `config/settings.json` loader and path resolver module.
- Redirect workspace targets to configured OpenClaw root when provided.
- Migrate local decision logs from `.jsonl` to Markdown canonical files.
- Keep deterministic machine parsing via fenced JSON blocks or frontmatter sections inside Markdown.

## Visible App Outcome
- Runtime generates Tier-1 memory entries from live interactions.
- Promotion decision logs include explicit threshold outcomes and reasons.
- Protected identity write attempts are blocked and audited.
- Manual verification hotkeys are available:
  - `M`: record `music_rating` observation.
  - `H`: run promotion evaluation.
  - `N`: test protected identity write rejection.

## Implementation Verification (Manual)
1. Start app (`npm start`) and press `M`; verify memory event logs and new observation entry in local memory output.
2. Press `H`; verify promotion decision output with `accepted` or `rejected` and threshold reason detail.
3. Press `N`; verify protected write is blocked and mutation audit entry is written.
4. Start with `PET_MEMORY_ADAPTER=obsidian` and missing vault path; verify fallback to local mode with no runtime crash.

## Manual Validation Evidence (2026-02-27)
- Operator startup log confirms settings-driven runtime in Obsidian mode:
  - `requestedAdapterMode=obsidian`
  - `activeAdapterMode=obsidian`
  - `fallbackReason=none`
  - `activeWorkspaceRoot=W:\\AI\\OpenClaw\\Memory\\Vault`
  - `openClawWorkspaceRoot=\\\\wsl$\\Ubuntu-24.04\\home\\openclaw\\.openclaw\\workspace`
  - `openclawWorkspaceBootstrapMode=warn_only`
- Manual hotkey verification evidence from live runtime:
  - `M`: `observationWritten` for `music_rating` to `W:\\AI\\OpenClaw\\Memory\\Vault\\01_Logs\\2026-02-27.md`.
  - `H`: `promotionDecision` logged to `...\\04_Analysis\\promotion-decisions.md` with threshold rejection reasons:
    - `interaction_count_below_threshold`
    - `persistence_window_below_threshold`
    - `distinct_evidence_below_threshold`
  - `N`: `identityMutationDecision` blocked for `section=\"Immutable Core\"` with reason `immutable_core_protected`, logged to `...\\04_Analysis\\identity-mutations.md`.
- Additional repeated `H` runs continued to append deterministic threshold-rejection decisions without runtime instability.
- Combined with existing automated checks (`check-memory-pipeline`) and D05a path/toggle validation, D05 implementation criteria are satisfied.

## Implementation Progress (This Session)
- D05a inserted ahead of D05 closeout; current D05 gate is now dependent on D05a real-path verification evidence.
- Added new runtime module: `memory-pipeline.js`.
- Added adapter mode support:
  - `local`
  - `obsidian` with guarded fallback to `local`
- Added Tier-1 write pipeline:
  - `question_response` (from user-command contract events)
  - `hobby_summary` (from extension prop interactions)
  - `music_rating` (manual runtime trigger)
- Added promotion decision evaluation with threshold logging (`accepted`/`rejected`).
- Added protected identity mutation guard for `Immutable Core` with audit logging.
- Added main-process memory IPC hooks and renderer hotkeys (`M`, `H`, `N`) for visible/manual verification.
- Added deterministic automated validation script: `scripts/check-memory-pipeline.js`.

## Automated Verification Evidence (2026-02-26)
- `npm run check` passed with:
  - `check:syntax` (includes `memory-pipeline.js`)
  - `check:contracts` (`check-contract-router`, `check-openclaw-bridge`, `check-memory-pipeline`)
  - `check:layout`
  - `check:assets`

## Verification Gate
Pass when all are true:
1. Pipeline works in `local` mode with no Obsidian path.
2. Pipeline works in `obsidian` mode when vault path exists.
3. Invalid adapter/path degrades to local mode without runtime failure.
4. Promotion writes are threshold-gated and logged.
5. Identity section protections are explicit, including "never mutate Immutable Core."
6. Required workspace/vault path schemas are documented with fallback behavior for missing targets.
7. Mutation transparency policy is documented and tied to output behavior.
8. Runtime writes Tier-1 observation records via guarded local adapter without blocking pet runtime.
9. Runtime exposes mutation/promotion decision logs with threshold check outcomes.
10. Settings/path contract is documented for OpenClaw workspace and Obsidian vault targets.

## Gate Status
- `Doc Gate`: `passed`
- `Implementation Gate`: `passed`
- `Overall`: `done`

## Open Questions
- Should Markdown decision logs store machine fields as fenced JSON blocks or compact table rows.
- Whether dual-write mode (OpenClaw workspace + local mirror) should be optional debug behavior.
- Exact default path for OpenClaw workspace when running through WSL (`\\\\wsl$\\<distro>\\...`) vs Windows-native path.

## Change Log
- `2026-02-26`: File created and seeded.
- `2026-02-26`: Updated for `spec + implementation slice` workflow with mandatory implementation/visible outcome sections and dual-gate status.
- `2026-02-26`: Advanced to `in_progress` after D04 closeout approval.
- `2026-02-26`: Returned to `not_started` after D04 was reopened for runtime implementation and verification hardening.
- `2026-02-26`: Returned to `in_progress` after D04 re-closeout and gate pass.
- `2026-02-26`: Added concrete memory contracts, adapter fallback table, and delivered first runtime implementation slice with automated checks.
- `2026-02-26`: Planning update with user feedback: markdown-first artifact policy, config-file path strategy, and OpenClaw/Obsidian real-path validation scope.
- `2026-02-26`: Dependency updated to D05a insertion; D05 remains `in_progress` until D05a connectivity/bootstrap evidence is captured.
- `2026-02-27`: D05a dependency satisfied (real-path validation passed); D05 remains current deliverable for final implementation-gate closeout work.
- `2026-02-27`: Captured operator runtime evidence for `runtimeReady` + `M/H/N` manual paths in Obsidian mode and closed D05 as `done` (Doc + Implementation gates passed).
