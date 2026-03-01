# Documentation Progress Tracker

Related:
- Roadmap: [`00-master-roadmap.md`](./00-master-roadmap.md)
- Decisions: [`09-decisions-log.md`](./09-decisions-log.md)

## Plan Status Schema
Allowed values:
- `not_started`
- `in_progress`
- `review`
- `blocked`
- `done`

## Delivery Mode
- Implementation deliverables (D02-D08, including inserted D05a) use `spec + implementation slice`.
- A deliverable is not `done` until both are passed:
  - `Doc Gate`
  - `Implementation Gate`
- D01 is a completed discovery baseline and remains doc-only by design.

## Current Deliverable
- Current Deliverable: `07-state-system-extension-guide`
- Current Status: `in_progress`
- Overall Progress: `8/10 implementation deliverables done` (D01, D02, D02b, D03, D04, D05a, D05, D06 complete; D07 in progress)
- Current Gate State:
  - `Doc Gate`: `not_started`
  - `Implementation Gate`: `not_started`

## Deliverable Status Table
| Deliverable | Status | Notes |
| --- | --- | --- |
| `00-master-roadmap` | `in_progress` | Initial version seeded |
| `01-gap-analysis-expansion-vs-current` | `done` | Verification gate passed; reviewer approved mapping completeness and downstream ownership |
| `02-architecture-capability-registry` | `done` | Doc + implementation gates passed; runtime capability registry scaffold implemented and manually verified |
| `02b-extension-framework-and-pack-sdk` | `done` | Doc + implementation gates passed; manual verification confirmed valid/invalid pack handling, trust warning flow, and prop interaction outcomes |
| `03-pet-core-events-intents-suggestions` | `done` | Doc + implementation gates passed; manual verification confirmed status flow, announcement cooldown skips, and extension interaction trace correlation |
| `04-openclaw-bridge-spec` | `done` | Doc + implementation gates passed after operator-confirmed online/timeout/offline + guardrail + drag/fling verification |
| `05a-obsidian-workspace-bootstrap-and-connectivity` | `done` | Doc + implementation gates passed; real-path validation captured for WSL OpenClaw workspace + local Obsidian vault with enabled/disabled toggle checks |
| `05-memory-pipeline-and-obsidian-adapter` | `done` | Doc + implementation gates passed; operator runtime evidence confirmed `runtimeReady` obsidian path plus `M/H/N` write/promotion/mutation behavior |
| `06-integrations-freshrss-spotify` | `done` | Doc + implementation gates passed; operator verification confirmed FreshRSS/Spotify healthy paths, `track_rating` writes, and deterministic Spotify unavailable fallback |
| `07-state-system-extension-guide` | `in_progress` | Advanced after D06 closeout; implementation work not started yet |
| `08-test-and-acceptance-matrix` | `not_started` | Final consolidation |
| `09-decisions-log` | `in_progress` | Seed decisions added |

## Next 3 Actions
1. Open D07 and define the baseline state catalog contract, registration rules, and fallback model for config-only vs hook-enabled states.
2. Implement the first D07 runtime slice for one simple state (`Reading`) and one complex phase state (`PoolPlay`) without switch-case expansion.
3. Add deterministic missing-resource fallback behavior and manual verification steps for D07 before considering gate movement.

## Blockers
- None currently.

## Last Session Summary
- Closed D06 as `done`:
  - live OpenClaw-agent Spotify and FreshRSS healthy paths were manually verified in-app.
  - `track_rating` memory writes were manually verified in-app.
  - deterministic Spotify unavailable fallback was manually verified with `PET_SPOTIFY_AVAILABLE=0`.
  - parser/failure-hardening changes remained green under `npm run check`.
- Verification status for D06 after this session:
  - `Doc Gate`: `passed`
  - `Implementation Gate`: `passed`
  - `Verification Gate`: `passed`
- Shipped outcome note:
  - visible app/runtime change delivered: D06 is now closed with live FreshRSS/Spotify probe support, memory output, and verified fallback behavior. Current deliverable advanced to D07.
- Closed D05 as `done` with operator-provided runtime evidence from `npm start`:
  - `runtimeReady` confirmed `activeAdapterMode=obsidian`, `fallbackReason=none`, OpenClaw + vault paths resolved.
  - `M` hotkey wrote `music_rating` observation to `W:\\AI\\OpenClaw\\Memory\\Vault\\01_Logs\\2026-02-27.md`.
  - `H` hotkey wrote threshold-gated promotion decisions to `W:\\AI\\OpenClaw\\Memory\\Vault\\04_Analysis\\promotion-decisions.md`.
  - `N` hotkey blocked `Immutable Core` mutation and wrote audit entry to `W:\\AI\\OpenClaw\\Memory\\Vault\\04_Analysis\\identity-mutations.md`.
- D05 `Implementation Gate` marked `passed`; D05 moved to `done`.
- Current deliverable advanced to D06 per gating rule.
- Closed D05a with real-path validation evidence:
  - Added local override configuration (`config/settings.local.json`, gitignored) with:
    - `paths.openClawWorkspaceRoot=\\\\wsl$\\Ubuntu-24.04\\home\\openclaw\\.openclaw\\workspace`
    - `paths.obsidianVaultRoot=W:\\AI\\OpenClaw\\Memory\\Vault`
  - Verified WSL runtime reachability via `openclaw status --deep --json` (`gateway.reachable=true`, `url=ws://127.0.0.1:18789`).
  - Applied OpenClaw workspace access fix for `micster`:
    - `/home/openclaw/.openclaw` -> `drwx--x---`
    - `/home/openclaw/.openclaw/workspace` -> `drwxrws---`
  - Ran elevated workspace checks due UNC sandbox limits:
    - baseline: `openclaw.status=ready`, `obsidian.status=ready`
    - `PET_OPENCLAW_ENABLED=0`: `openclaw.status=disabled`
    - `PET_MEMORY_ADAPTER=local`: `obsidian.status=not_requested`
  - Bootstrapped required vault directories via `npm run bootstrap:obsidian-vault`:
    - `01_Logs`, `02_User`, `03_Primea`, `04_Analysis`, `99_System`
  - Regression checks passed: `npm run check`.
- D05a `Implementation Gate` marked `passed`; D05a moved to `done`.
- Current deliverable advanced to D05 per gating rule; D05 remains `in_progress`.
- Diagnosed persistent OpenClaw webchat Obsidian-skill failures as an exec-host policy mismatch:
  - session logs show `exec host=sandbox is configured, but sandbox runtime is unavailable` followed by gateway/node host denial because non-elevated host must match configured host.
  - in installed OpenClaw runtime, `tools.exec.host` defaulted to `sandbox` for this agent context.
- Confirmed wizard limitations for this issue:
  - `openclaw configure --help` sections are `workspace|model|web|gateway|daemon|channels|skills|health` (no `tools.exec` section).
  - outcome: wizard helps with gateway/skills setup but does not currently expose the required exec-host override.
- Applied runtime config fix for test environment:
  - set `tools.exec.host=gateway` via `openclaw config set tools.exec.host gateway` (gateway restart still required before webchat sessions inherit the change).
- Captured security follow-up:
  - `openclaw security audit --json` flags `tools.elevated.allowFrom.webchat=["*"]` as critical; keep for temporary diagnostics only and narrow back to explicit session allowlists.
- Captured OpenClaw runtime diagnostics from user for Obsidian skill execution policy:
  - `tools.elevated.allowFrom.webchat` successfully set to session allowlist entry.
  - `sandbox explain --json` now reports `allowedByConfig=true` with no failures.
  - observed CLI drift: `openclaw approvals set default --gateway --host ask --sandbox allow` is no longer valid in installed OpenClaw version; approvals are now managed via `openclaw approvals set --file/--stdin`.
- Verified `obsidian-cli print-default --path-only` under `openclaw` user resolves to `/mnt/w/AI/OpenClaw/Memory/Vault` (matches corrected vault path).
- Next manual integration action remains gateway process restart/reload so running webchat session picks up updated `allowFrom.webchat` config.
- Applied requested memory artifact cleanup:
  - set `config/settings.json` `memory.writeLegacyJsonl=false` so legacy `.jsonl` compatibility logs are no longer written by default.
  - removed existing legacy artifacts from workspace:
    - `memory/promotion-decisions.jsonl`
    - `memory/identity-mutations.jsonl`
  - removed local root workspace docs that are no longer needed in current runtime mode:
    - `SOUL.md`
    - `IDENTITY.md`
    - `USER.md`
    - `MEMORY.md`
- Verified no regression after cleanup with `npm run check:contracts` (all checks passed).
- Deliverable status unchanged per gating rule: D05a remains current and `in_progress` pending real-path validation evidence.
- Inserted new deliverable `05a-obsidian-workspace-bootstrap-and-connectivity` before D05 closeout and made it the current deliverable.
- Implemented settings runtime and config-first integration wiring:
  - added `settings-runtime.js` with layered resolution (`settings.json`, local/userData override, env overrides),
  - added validation warnings/errors + path resolution summary (`loadRuntimeSettings`),
  - wired `main.js` memory/bridge initialization to resolved settings snapshot.
- Added config assets and local override patterns:
  - `config/settings.json`
  - `config/settings.local.example.json`
  - `config/README.md`
- Implemented OpenClaw transport/policy runtime updates:
  - `stub` + `http` transport selection,
  - loopback/non-loopback policy enforcement,
  - non-loopback token requirements with deterministic fallback.
- Implemented memory governance runtime updates:
  - OpenClaw disabled no longer creates `SOUL.md`/`IDENTITY.md`/`USER.md`/`MEMORY.md`,
  - OpenClaw configured runtime stays warn-only for missing workspace files,
  - explicit bootstrap path added (`bootstrapOpenClawWorkspaceFiles`),
  - Markdown canonical decision logs retained with legacy JSONL compatibility and one-time migration.
- Added/updated deterministic checks:
  - `scripts/check-settings-runtime.js`
  - `scripts/check-workspace-connectivity.js`
  - expanded `scripts/check-openclaw-bridge.js`
  - expanded `scripts/check-memory-pipeline.js`
  - `npm run check` passed end-to-end.
- User manual verification logs confirmed D05 runtime slice behavior:
  - Tier-1 observation write: `memory/2026-02-26.md`
  - Promotion decision log with threshold rejection reasons: `memory/promotion-decisions.jsonl`
  - Protected identity write blocked + audited: `memory/identity-mutations.jsonl`
- Planning decisions captured from user review:
  - Adopt Markdown-first canonical memory artifacts (JSONL is transitional only).
  - Add config-first path settings to support OpenClaw workspace + Obsidian vault targeting.
  - Treat local `SOUL.md`/`IDENTITY.md`/`USER.md`/`MEMORY.md` as offline fallback bootstrap until external workspace path is configured.
- Roadmap and D05 docs updated with config/path-management scope and WSL path compatibility expectations.
- Implemented D05 first runtime slice:
  - Added `memory-pipeline.js` with adapter modes (`local`, `obsidian`) and guarded fallback behavior.
  - Added Tier-1 observation writes (`question_response`, `hobby_summary`, `music_rating`) with append-only logs.
  - Added promotion decision evaluation with threshold outcome logging (`accepted`/`rejected`).
  - Added protected identity mutation guardrails and mutation audit logging (`Immutable Core` blocked).
- Wired memory runtime into app lifecycle and UI/manual controls:
  - Main process now initializes memory runtime and emits memory events/snapshots.
  - Renderer hotkeys added: `M` (music rating), `H` (promotion check), `N` (protected write test).
  - Preload bridge expanded with memory IPC APIs.
- Added deterministic automated checks: `scripts/check-memory-pipeline.js` and wired it into `npm run check:contracts`.
- Ran `npm run check` successfully (`check:syntax`, `check:contracts`, `check:layout`, `check:assets` all passed).
- D05 `Doc Gate` marked `passed`; `Implementation Gate` remains `in_progress` pending manual runtime evidence.
- Operator confirmed final D04 degraded-mode drag/fling non-blocking behavior (`timeout` + `offline` runs).
- D04 `Implementation Gate` marked `passed`; D04 re-closed as `done` with both gates passed.
- Current deliverable advanced back to D05 per gating rule, with D05 status set to `in_progress`.
- Operator provided concrete D04 runtime evidence for:
  - online bridge introspection path (`I`) with `source=online` and end-to-end correlation IDs
  - online bridge dialog path (`Y`) via `INTENT_BRIDGE_DIALOG -> PET_RESPONSE`
  - guardrail enforcement path (`G`) with blocked actions:
    - `set_state`
    - `render_control`
    - `identity_mutation`
  - timeout fallback mode (`PET_OPENCLAW_MODE=timeout`) with `bridge_timeout` and `source=offline` deterministic fallback output
  - offline fallback mode (`PET_OPENCLAW_MODE=offline`) with `bridge_unavailable` and deterministic fallback output
- D04 verification is now partial-pass; remaining open item is explicit manual drag/fling non-blocking confirmation in degraded bridge modes.
- D04 review identified missing concrete visible verification evidence and no true bridge request path/guardrail validation in prior closeout.
- D04 was reopened to `in_progress`; `Implementation Gate` moved back to `in_progress` while `Doc Gate` remains `passed`.
- Implemented D04 runtime slice hardening:
  - Added `openclaw-bridge.js` with simulated bridge request envelope, mode control (`online`/`timeout`/`offline`), and timeout wrapper.
  - Wired main-process `USER_COMMAND` bridge routing (`status`, `bridge-test`, `guardrail-test`) with correlation IDs and source propagation.
  - Added non-authority blocked-action guardrails and logs for `set_state`, `render_control`, and `identity_mutation`.
  - Added bridge request context fields (`currentState`, `stateContextSummary`, `activePropsSummary`, `extensionContextSummary`, `source`).
  - Added renderer manual-test hotkeys: `Y` (`bridge-test`) and `G` (`guardrail-test`).
  - Added automated bridge checks (`scripts/check-openclaw-bridge.js`) and expanded contract checks.
- Ran `npm run check` successfully (`check:syntax`, `check:contracts`, `check:layout`, `check:assets` all passed).
- Current deliverable returned from D05 to D04 per gating rule.
- D04 was approved and closed as `done`; both `Doc Gate` and `Implementation Gate` were marked `passed`.
- Current deliverable advanced to D05 per gating rule, with D05 status set to `in_progress`.
- Shipped outcome note: no new visible app/runtime change in this closeout step; session focused on approval processing and tracker synchronization.
- Operator provided manual runtime evidence confirming D03 implementation gate criteria:
  - `USER_COMMAND(status) -> INTENT_INTROSPECTION_STATUS -> PET_RESPONSE`
  - `USER_COMMAND(announce-test)` cooldown behavior with `PET_ANNOUNCEMENT_SKIPPED` and `skipReason=cooldown_active`
  - `EXT_PROP_INTERACTED -> INTENT_PROP_INTERACTION -> PET_RESPONSE`
- D03 moved to `done` with both gates passed and verification gate explicitly marked `passed` in deliverable doc.
- Current deliverable advanced to D04 per gating rule, with D04 status set to `in_progress`.
- Shipped outcome note: no new visible app/runtime change this verification closeout step; session focused on operator validation evidence and deliverable gate/state updates.
- D03 documentation contract details were expanded with:
  - schema envelope + producer/consumer ownership table
  - idempotency/ordering/timeout policy
  - schema evolution rules and bounded payload policy
  - bridge-bound read-only context contract and extension arbitration insertion rules
- D03 `Doc Gate` moved to `passed`, and `Implementation Gate` was later moved to `passed` after operator manual runtime validation.
- Added deterministic contract verification script: `scripts/check-contract-router.js` and wired `npm run check:contracts`.
- Added runtime verification visibility improvements:
  - renderer debug overlay now shows latest contract suggestion type + correlation ID
  - main-process logs now include `PET_ANNOUNCEMENT_SKIPPED` and `PET_RESPONSE` summaries
- Ran `npm run check` successfully (`check:syntax`, `check:contracts`, `check:layout`, `check:assets` all passed).
- Shipped outcome note: visible app/runtime change delivered (enhanced contract diagnostics visibility + deterministic contract verification harness).
- D01 was reviewed and approved by the user; deliverable status moved to `done`.
- D01 verification gate was explicitly marked `passed` in deliverable and mirrored in tracker workflow state.
- Current deliverable advanced to D02 per gating rule, with D02 status set to `in_progress`.
- Began D02 first-pass drafting for capability interface, lifecycle/status model, capability map, and degraded-fallback scenarios.
- Delivery approach updated to `spec + implementation slice` for D02-D08 so each deliverable must ship visible runtime progress, not documentation alone.
- Reviewed and updated `AGENTS.md`, roadmap, tracker, and D02-D08 deliverable files for dual-gate workflow consistency.
- Added mandatory sections across implementation deliverables: implementation slice, visible app outcome, manual implementation verification, and gate status.
- Implemented D02 runtime slice: new `capability-registry.js`, main-process capability lifecycle startup/transition logging, baseline capability registration (`renderer`, `brain`, `sensors`, `openclawBridge`), and capability snapshot IPC/config exposure.
- Updated renderer/preload paths to consume capability snapshot stream for diagnostics visibility.
- Captured operator-run validation logs for normal startup plus forced optional failure paths (`PET_FORCE_SENSORS_FAIL`, `PET_FORCE_OPENCLAW_FAIL`) and marked D02 gates passed; D02 moved to `review`.
- D02 was approved and closed as `done` with verification/implementation gates passed.
- Advanced to D02b and implemented first runtime slice: `extension-pack-registry.js`, extension discovery/validation from `extensions/`, trust-warning enable model, and core-authoritative prop interaction IPC path.
- Added sample extension packs (one valid, one invalid) for D02b visible/manual verification scenarios.
- D02b was manually verified by operator and approved; moved to `done` with both gates passed.
- Advanced to D03 and implemented first runtime contract pipeline slice (`pet-contract-router.js`) with correlation IDs, user-command routing, cooldowned announcement behavior, extension event mapping, and trace/suggestion IPC channels.

## Documentation Bootstrap Verification Checklist
- [x] All required files exist in `docs/plan/`.
- [x] Deliverable docs `01`-`08` plus `02b` and `05a` include required sections.
- [x] `AGENTS.md` contains resume protocol and TODO/progress snapshot.
- [x] `AGENTS.md` and this tracker reference the same current deliverable/status.
- [x] Cross-links between tracker, roadmap, and decisions log are valid.
