# Deliverable 08: Test and Acceptance Matrix

**Deliverable ID:** `08-test-and-acceptance-matrix`
**Status:** `done`
**Owner:** `Mic + Codex`
**Last Updated:** `2026-03-04`
**Depends On:** `02-architecture-capability-registry`, `02b-extension-framework-and-pack-sdk`, `03-pet-core-events-intents-suggestions`, `04-openclaw-bridge-spec`, `05a-obsidian-workspace-bootstrap-and-connectivity`, `05-memory-pipeline-and-obsidian-adapter`, `06-integrations-freshrss-spotify`, `07-state-system-extension-guide`, `07b-dialog-surface-and-minimal-offline-loop`, `07c-shell-settings-and-wardrobe-surface`
**Blocks:** `Roadmap closeout`
**Verification Gate:** `Matrix covers core runtime/capability degradation/memory/integration failures and includes executed evidence for representative visible scenarios`

## Objective
Define the acceptance and regression matrix for the shipped runtime, then tie that matrix to actual executed evidence instead of leaving D08 as a placeholder.

## In Scope
- Functional acceptance tests by subsystem and deliverable.
- Failure-mode tests for degradation, missing dependencies, and offline-safe fallback behavior.
- Extension framework acceptance tests (pack loading, trust warning, prop interaction, arbitration path).
- Regression checks for drag/fling/fixed-size/runtime invariants.
- Documentation verification checks.
- Executed evidence links for both automated smoke coverage and prior operator-visible runtime passes.

## Out of Scope
- Full CI pipeline implementation.
- Performance benchmark automation beyond the manual release checklist.

## Dependencies
- D02-D07c remain the source of truth for their runtime contracts and operator-visible verification notes.

## Decisions Locked
- Dual gating remains active (`Doc Gate` + `Implementation Gate`).
- Existing movement/runtime invariants remain mandatory.
- D08 adds a lightweight scripted smoke layer instead of a full GUI automation stack.
- Prior accepted operator-visible evidence from D02b-D07c remains valid input to D08 closeout.

## Execution Cadence And Ownership
- Automated smoke owner: `Codex / repo maintainer`
  - Run on any runtime change touching capability, bridge, memory, integration, state, dialog, extension, or movement invariants.
  - Command: `npm run check:acceptance`
  - Evidence artifact: [`artifacts/08-acceptance-smoke.md`](./artifacts/08-acceptance-smoke.md)
- Operator visible suite owner: `operator`
  - Run on release-candidate passes and after drag/dialog/shell behavior changes.
  - Evidence source: predecessor deliverable docs plus tracker notes referenced below.
- Failure handling rule:
  - D08 does not silently advance on a failing row.
  - Any failed row must keep `Overall` below `done` and carry an evidence link or blocker note.

## Acceptance Matrix
| ID | Mode | Scenario | Pass Criteria | Human-Visible Proof |
| --- | --- | --- | --- | --- |
| `D02-ACC` | `auto + manual` | Capability registry boots renderer healthy and exposes a coherent snapshot. | Per-capability states and aggregate `runtimeState` match startup results without blocking renderer load. | Diagnostics capability summary and [`artifacts/08-acceptance-smoke.md`](./artifacts/08-acceptance-smoke.md). |
| `D02-FAIL` | `auto` | Optional capability startup degrades or fails. | Registry captures `reason`/`details`; runtime remains non-fatal and auditable. | Smoke row `D02-capability-registry`. |
| `D02b-ACC` | `auto + manual` | Valid extension pack loads and prop interaction reaches the core arbitration path. | `sample-foodchase` stays valid/enabled and `INTENT_PROP_INTERACTION` is emitted for `candy`. | Extension manager/runtime log and D02b operator evidence. |
| `D02b-FAIL` | `auto + manual` | Invalid manifest is skipped without breaking valid packs. | Warning surfaces for invalid pack, valid pack remains usable, trust warning still works on enable. | Warning text plus D02b operator evidence. |
| `D03-ACC` | `auto + manual` | Event -> intent -> suggestion routing works for `status`, `announce-test`, extension events, media, and hobby summaries. | Correlation IDs survive routing and expected suggestion types are emitted deterministically. | Contract trace/log output and smoke row `D03-contract-router`. |
| `D03-FAIL` | `auto + manual` | Announcement cooldown suppresses duplicate proactive output. | Second announcement emits `PET_ANNOUNCEMENT_SKIPPED` with `skipReason=cooldown_active`. | Trace/log output and D03 operator evidence. |
| `D04-ACC` | `auto + manual` | Online bridge request path returns an advisory response without violating local authority. | `bridge-test` returns `PET_RESPONSE`, correlation ID is preserved, and no forbidden action is executed. | In-app log/response plus smoke row `D04-openclaw-bridge`. |
| `D04-FAIL` | `auto + manual` | Timeout/offline bridge modes degrade deterministically. | `source=offline` fallback is emitted, blocked actions remain blocked, and drag/fling stays responsive. | Offline fallback output, guardrail log, and D04 operator evidence. |
| `D05a-ACC` | `auto + manual` | Settings/path bootstrap resolves configured OpenClaw and Obsidian roots. | Resolved path summary is coherent, required folders/files can be bootstrapped, and local overrides persist cleanly. | Workspace status output and D05a operator evidence. |
| `D05a-FAIL` | `auto + manual` | Missing or unsafe path configuration degrades gracefully. | Missing config/path reports `missing_config`, `missing_path`, `not_requested`, or warning text without crashing startup. | `check:workspace` / settings warnings / D05a operator evidence. |
| `D05-ACC` | `auto + manual` | Observation, promotion, and audit writes succeed in the active memory adapter. | `M`, `H`, and `N` write canonical Markdown artifacts with expected outcomes. | Vault/workspace files and D05 operator evidence. |
| `D05-FAIL` | `auto + manual` | Obsidian target is unavailable or identity mutation is prohibited. | Adapter falls back or blocks mutation explicitly while preserving audit output and reason codes. | Memory log output and smoke row `D05-memory-pipeline`. |
| `D06-ACC` | `auto + manual` | Spotify/FreshRSS happy path produces visible suggestions, observations, and hobby ranking output. | `J`, `L`, and `R` produce deterministic event payloads and observation shapes. | Integration FX/logs, observation files, and D06 operator evidence. |
| `D06-FAIL` | `auto + manual` | Provider/media source is unavailable or ambiguous. | Fallback mode is explicit (`spotify_provider_unavailable`, source fallback, or `unknown` route) and user-visible behavior remains stable. | D06 operator evidence plus smoke rows `D06-integrations` and `D06-local-media-sensor`. |
| `D07-ACC` | `auto + manual` | State runtime enters `Reading`, `PoolPlay`, `MusicChill`, and temporary FreshRSS reading deterministically. | State/phase/overlay output matches catalog rules and priority ordering stays stable. | Visible overlays/state labels and D07 operator evidence. |
| `D07-FAIL` | `auto + manual` | Missing state asset or lower-priority automatic event occurs. | `visualFallbackUsed=true` is surfaced, warning reason is logged, and higher-priority/manual states are not preempted. | Warning overlay/log and smoke row `D07-state-runtime`. |
| `D07b-ACC` | `auto + manual` | Chat input, bubble/history output, and talk feedback work visibly. | `Enter` or `/` opens input, response appears in history/bubble, and talk feedback is visible without blocking drag. | Dialog surface and D07b operator evidence. |
| `D07b-FAIL` | `auto + manual` | OpenClaw dialog path is unavailable. | Offline template reply includes `source` / `fallbackMode` labels and still provides visible speaking feedback. | Bubble/history metadata, D07b operator evidence, and smoke row `D07b-dialog-runtime`. |
| `D07c-ACC` | `manual` | Tray/dev fallback shell changes roam mode, diagnostics visibility, and accessories without restart. | Inventory/tray controls persist through settings and visibly change roam/wardrobe/runtime behavior. | Tray or `F6`-`F9` path plus D07c operator evidence. |
| `D07c-FAIL` | `manual` | Tray path is unavailable or roam zone changes mid-session. | Dev fallback remains usable, settings persist, and custom zone / cross-monitor roam behavior remains non-fatal. | Tray fallback behavior and D07c operator evidence. |
| `D08-ACC` | `auto + manual` | Acceptance suite produces executed evidence instead of a placeholder checklist. | `npm run check:acceptance` writes a report artifact and D08 maps manual visible rows to concrete evidence links. | [`artifacts/08-acceptance-smoke.md`](./artifacts/08-acceptance-smoke.md) and this file. |
| `D11a-ACC` | `auto + manual` | Shared shell `Status` tab exposes the observability rows without creating a second popup. | `Inventory...`, `Status...`, and `F10` route to the same shell window, required rows render, and the snapshot builder remains deterministic across healthy/degraded cases. | Shared shell window plus smoke row `D11a-shell-observability`. |
| `D11b-ACC` | `auto + manual` | Shared shell `Setup` tab previews and explicitly applies canonical Markdown bootstrap without creating a second popup. | `Setup...` and `F11` route to the shared shell window, local-write/apply-mode logic stays deterministic, the OpenClaw target remains observed/read-only, and managed Markdown blocks preview cleanly. | Shared shell window plus smoke row `D11b-setup-bootstrap`. |
| `D08-FAIL` | `auto + manual` | A smoke or manual row fails during consolidation. | Failure is surfaced with row ID, evidence, and blocker note; D08 remains below `done`. | Acceptance artifact failure row or tracker blocker note. |

## Required Visible Target Coverage
| Target | Covered By |
| --- | --- |
| Roaming bounds and optional roam zone behavior | `D07c-ACC`, `D07c-FAIL`, D07c operator evidence |
| Deterministic core state set entry (`Idle/Roam/MusicChill/...`) | `D07-ACC`, `D07-FAIL`, D07 operator evidence |
| State priority resolution | `D07-ACC`, `D07-FAIL`, smoke row `D07-state-runtime` |
| Desktop shell / wardrobe visibility | `D07c-ACC`, D07c operator evidence |
| Media-triggered music mode | `D06-ACC`, D07 operator evidence |
| Introspection default vs technical safety | `D03-ACC`, `D04-ACC`, D03 operator evidence |
| Conversation UI and visible request/response correlation | `D07b-ACC`, D07b operator evidence |
| Offline dialog fallback | `D07b-FAIL`, `D04-FAIL`, D07b/D04 operator evidence |
| Voice path when provider exists | conditional follow-on under `D07b-ACC`; text-first path remains the current required fallback |
| Voice fallback when TTS unavailable | `D07b-FAIL`; talk feedback + bubble output are the accepted v1 floor |
| Lip-sync / talk animation degradation | `D07b-ACC`, `D07b-FAIL`; talk feedback is the current visible approximation |
| Proactive messaging with cooldown | `D03-FAIL`, `D07b-ACC`, D03/D07b operator evidence |
| Technical vs narrative introspection content | `D03-ACC`, `D04-ACC` |
| Memory path layout validation and graceful degradation | `D05a-ACC`, `D05a-FAIL` |
| Hobby top `1-3` selection and scoring reasons | `D06-ACC`, D06 operator evidence |
| `track_rating (1-10)` feeds memory summary input | `D06-ACC`, `D05-ACC`, D06 operator evidence |
| Windows media `source=GSMTC` or deterministic fallback labeling | `D06-FAIL`, smoke row `D06-local-media-sensor` |
| Mutation transparency and audit visibility | `D05-FAIL`, D05 operator evidence |
| Simple custom state onboarding (`Reading`-style) | `D07-ACC`, smoke row `D07-state-runtime` |
| Complex custom state onboarding (`PoolPlay` phases) | `D07-ACC`, smoke row `D07-state-runtime` |
| State-aware dialogue online/offline | `D04-ACC`, `D07b-FAIL`, D07 operator evidence |
| D07 missing-asset fallback | `D07-FAIL`, smoke row `D07-state-runtime` |
| D07b visible input + bubble + non-blocking talk feedback | `D07b-ACC`, D07b operator evidence |
| D07c shell/settings toggles without restart | `D07c-ACC`, D07c operator evidence |
| D11a shared shell `Status` tab and observability rows | `D11a-ACC`, smoke row `D11a-shell-observability` |
| D11b shared shell `Setup` tab, target-policy summary, and managed Markdown bootstrap preview/apply | `D11b-ACC`, smoke row `D11b-setup-bootstrap` |

## Extension Visible Target Coverage
| Target | Covered By |
| --- | --- |
| Valid pack loads from `extensions/` | `D02b-ACC`, smoke row `D02b-extension-framework` |
| Invalid manifest warns and skips non-fatally | `D02b-FAIL`, smoke row `D02b-extension-framework` |
| Version mismatch warning / best-effort behavior | D02b manual/runtime contract coverage |
| One-time trust warning on first enable | `D02b-FAIL`, smoke row `D02b-extension-framework` |
| GUI prop spawn / persistence | D07c operator evidence |
| Pet navigates to prop and mapped state | D02b operator evidence plus D07/D07c prop behavior |
| Held-food chase near/far transition | extension roadmap contract; covered by D02b runtime contract scope |
| Pool prop wardrobe swap and phase behavior | `D07-ACC`, D07c operator evidence |
| Pool click splash/effect | D02b/D07 operator-visible prop behavior notes |
| Multiple props with single authority | D02b arbitration contract coverage |
| Offline local context-aware Q/A with extension state | `D07b-FAIL`, D02b operator evidence |
| Online Q/A with extension/state context | `D04-ACC`, D02b contract coverage |
| OpenClaw offline does not break extension interactions | `D02b-FAIL`, `D04-FAIL` |
| Disable extension removes behavior authority cleanly | D02b operator evidence |
| Multi-monitor prop anchors remain stable | D07c operator evidence |
| Extension KV persistence survives restart within quota | D02b contract scope; future operator retest if pack storage expands |
| Drag/fling/size invariants remain unchanged | movement invariants smoke row plus D04/D07b/D07c operator evidence |

## Executed Evidence
### Automated Smoke Evidence
- Command: `npm run check:acceptance`
- Artifact: [`artifacts/08-acceptance-smoke.md`](./artifacts/08-acceptance-smoke.md)
- Machine-readable artifact: [`artifacts/08-acceptance-smoke.json`](./artifacts/08-acceptance-smoke.json)

| Date | Row IDs | Result | Runner | Evidence |
| --- | --- | --- | --- | --- |
| `2026-03-03` | `D02-ACC`, `D02-FAIL` | `passed` | `Codex automated smoke` | Smoke row `D02-capability-registry` -> `[capability-registry] checks passed`. |
| `2026-03-03` | `D02b-ACC`, `D02b-FAIL` | `passed` | `Codex automated smoke` | Smoke row `D02b-extension-framework` -> `[extension-pack-registry] checks passed`. |
| `2026-03-03` | movement invariants backing `D04/D07b/D07c` | `passed` | `Codex automated smoke` | Smoke row `Movement-runtime-invariants` -> `[runtime-invariants] checks passed`. |
| `2026-03-03` | `D03-ACC`, `D03-FAIL` | `passed` | `Codex automated smoke` | Smoke row `D03-contract-router` -> `[contracts] router checks passed`. |
| `2026-03-03` | `D04-ACC`, partial `D04-FAIL` contract path | `passed` | `Codex automated smoke` | Smoke row `D04-openclaw-bridge` -> `[openclaw-bridge] checks passed`. |
| `2026-03-03` | `D05-ACC`, `D05-FAIL` | `passed` | `Codex automated smoke` | Smoke row `D05-memory-pipeline` -> `[memory-pipeline] checks passed`. |
| `2026-03-03` | `D05a-FAIL` deterministic settings path | `passed` | `Codex automated smoke` | Smoke row `D05a-settings-runtime` -> `[settings-runtime] checks passed`. |
| `2026-03-03` | `D06-ACC`, `D06-FAIL` | `passed` | `Codex automated smoke` | Smoke rows `D06-integrations` and `D06-local-media-sensor`. |
| `2026-03-03` | `D07-ACC`, `D07-FAIL` | `passed` | `Codex automated smoke` | Smoke row `D07-state-runtime` -> `[state-runtime] checks passed`. |
| `2026-03-03` | `D07b-FAIL` offline dialog fallback | `passed` | `Codex automated smoke` | Smoke row `D07b-dialog-runtime` -> `[dialog] offline dialog checks passed`. |
| `2026-03-04` | `D11a-ACC` automated builder/tab-routing coverage | `passed` | `Codex automated smoke` | Smoke row `D11a-shell-observability` -> `[shell-observability] checks passed`. |
| `2026-03-04` | `D11b-ACC` automated setup preview/apply coverage | `passed` | `Codex automated smoke` | Smoke row `D11b-setup-bootstrap` -> `[setup-bootstrap] checks passed`. |
| `2026-03-03` | renderer/layout regression backing D07/D07c | `passed` | `Codex automated smoke` | Smoke rows `Layout-assets` and `Sprite-assets`. |

### Current Manual Retest Status
| Date | Row IDs | Result | Runner | Evidence |
| --- | --- | --- | --- | --- |
| `2026-03-03` | step `2` backing `D07c-FAIL` and movement regression coverage | `failed` | `operator` | Manual D08 sweep reported that dragging/flinging outside a custom roam zone could later snap the pet back toward the zone, roam travel could feel jerky at walk speed, and locomotion direction could stop matching actual desktop travel. Operator console/diagnostic evidence was captured from `npm start`. |
| `2026-03-03` | step `2` operator re-test after first roam fix | `failed` | `operator` | Operator confirmed smoother roam motion plus correct `zone -> desktop` fallback after manual drag/fling escape, but found a remaining step `2` issue: toggling `desktop -> zone` while a roam leg is already in flight can still cause the pet to pop back to the zone on the next loop instead of traveling there. Console output was captured from `npm start`. |
| `2026-03-03` | step `2` second follow-up fix | `pending_retest` | `Codex` | Forced roam-mode sync now cancels stale in-flight roam legs, clears stale queued destinations, and queues a desktop-bounded zone-entry leg before zone roaming resumes. This should prevent the mid-travel `desktop -> zone` toggle from snapping instantly to the zone edge. Awaiting operator re-test. |
| `2026-03-03` | steps `2-7` final manual visible sweep | `passed` | `operator` | Operator confirmed the full D08 manual visible sweep passed after the roam follow-up fixes: drag/fling stayed fixed-size and responsive, `zone <-> desktop` transitions traveled correctly, D07 hotkeys/fallback states worked, dialog/bubble/talk feedback worked, proactive output respected cooldown, and tray/fallback shell toggles worked without restart. Console output was captured from `npm start`. |
| `2026-03-04` | `D11b-ACC` | `passed` | `operator` | Operator confirmed the shared-shell `Setup` flow passed after the local-only write fix: `Setup...`/`F11` routing worked, preview/apply completed successfully, local canonical files were written, and no direct OpenClaw workspace write attempt appeared in the runtime output. |

### Prior Operator-Visible Rows Reused By D08
| Date | Row IDs | Result | Runner | Evidence |
| --- | --- | --- | --- | --- |
| `2026-02-26` | `D02b-ACC`, `D02b-FAIL` | `passed` | `operator` | [`02b-extension-framework-and-pack-sdk.md`](./02b-extension-framework-and-pack-sdk.md) records valid/invalid pack handling, trust-warning toggle flow, and prop interaction evidence. |
| `2026-02-26` | `D04-ACC`, `D04-FAIL` | `passed` | `operator` | [`04-openclaw-bridge-spec.md`](./04-openclaw-bridge-spec.md) records online bridge, timeout/offline fallback, blocked-action guardrails, and drag/fling non-blocking confirmation. |
| `2026-02-27` | `D05a-ACC`, `D05a-FAIL` | `passed` | `operator` | [`05a-obsidian-workspace-bootstrap-and-connectivity.md`](./05a-obsidian-workspace-bootstrap-and-connectivity.md) records real-path validation and disabled/not-requested fallback outcomes. |
| `2026-02-27` | `D05-ACC`, `D05-FAIL` | `passed` | `operator` | [`05-memory-pipeline-and-obsidian-adapter.md`](./05-memory-pipeline-and-obsidian-adapter.md) records `runtimeReady` plus `M/H/N` writes and blocked mutation audit behavior. |
| `2026-03-01` | `D06-ACC`, `D06-FAIL` | `passed` | `operator` | [`06-integrations-freshrss-spotify.md`](./06-integrations-freshrss-spotify.md) records healthy Spotify/FreshRSS paths, `track_rating` writes, and deterministic Spotify unavailable fallback. |
| `2026-03-02` | `D07-ACC`, `D07-FAIL` | `passed` | `operator` | [`07-state-system-extension-guide.md`](./07-state-system-extension-guide.md) records `Reading`, `PoolPlay`, missing-asset fallback, `K`, `J`, `L`, and return-to-`MusicChill` behavior. |
| `2026-03-03` | `D07b-ACC`, `D07b-FAIL` | `passed` | `operator` | [`07b-dialog-surface-and-minimal-offline-loop.md`](./07b-dialog-surface-and-minimal-offline-loop.md) records visible dialog history, offline labels, proactive announcement cooldown behavior, and smooth drag/fling during talk feedback. |
| `2026-03-03` | `D07c-ACC`, `D07c-FAIL` | `passed` | `operator` | [`07c-shell-settings-and-wardrobe-surface.md`](./07c-shell-settings-and-wardrobe-surface.md) and [`00-progress-tracker.md`](./00-progress-tracker.md) record tray/inventory workflow, diagnostics toggle, custom zone flow, and acceptable cross-monitor roam behavior. |

## Repeatable Run Path
### Automated
1. Run `npm run check:acceptance`.
2. Confirm the console summary ends with `15/15 automated checks passed`.
3. Confirm the artifact files were updated:
   - [`artifacts/08-acceptance-smoke.md`](./artifacts/08-acceptance-smoke.md)
   - [`artifacts/08-acceptance-smoke.json`](./artifacts/08-acceptance-smoke.json)

### Manual Visible Sweep
1. Run `npm start`.
2. Drag and fling the pet; confirm the window stays fixed-size and motion remains responsive.
3. Press `1`, `2`, `3`, `4`, `K`, `J`, and `L`; confirm D07 visible state transitions and fallback behavior.
4. Press `Enter` or `/`; submit a short question and confirm bubble/history output plus talk feedback.
5. Trigger proactive output (`U`) and confirm cooldown skip behavior on immediate repeat.
6. Use tray controls or `F6`-`F9` fallback controls to change roam mode, diagnostics visibility, and `headphones`.
7. If tray is unavailable, confirm dev fallback still operates without restart.
8. If any step fails, record the row ID, visible symptom, and evidence path before changing status.

## Implementation Slice (Mandatory)
- Added `npm run check:acceptance` as the D08 entry point.
- Added deterministic D08-only checks for:
  - capability registry lifecycle coverage
  - extension discovery/trust/prop interaction coverage
  - movement/runtime architectural invariants
- Refactored existing check scripts to export `run()` so D08 can execute them in-process and still remain sandbox-compatible.
- Added report generation to:
  - [`artifacts/08-acceptance-smoke.md`](./artifacts/08-acceptance-smoke.md)
  - [`artifacts/08-acceptance-smoke.json`](./artifacts/08-acceptance-smoke.json)
- Executed the representative automated subset and linked prior operator-visible passes for D02b-D07c.

## Visible App Outcome
- D08 now contains executed evidence instead of a placeholder test list.
- One command (`npm run check:acceptance`) produces pass/fail output for capability, extension, bridge, memory, integration, state, dialog, and invariant coverage.
- One command (`npm run check:acceptance`) produces pass/fail output for capability, extension, bridge, memory, integration, state, dialog, observability, and invariant coverage.
- The manual visible sweep is now short, concrete, and mapped to the actual runtime controls used across D07, D07b, and D07c.

## Implementation Verification (Manual)
1. Run `npm run check:acceptance` and verify the artifact summary reports `14/14 automated checks passed`.
2. Run `npm start` and verify one drag/fling regression pass.
3. Verify one offline/degraded bridge/dialog scenario (`U`, `Y`, or offline mode) still yields visible fallback output.
4. Verify one extension or shell path remains visibly usable (`P`, `O`, tray, or `F6`-`F9` fallback).
5. Confirm any failed row would be captured with an evidence path before D08 is marked `done`.

## Gate Status
- `Doc Gate`: `passed`
- `Implementation Gate`: `passed`
- `Overall`: `done`

## Change Log
- `2026-02-26`: File created and seeded.
- `2026-02-26`: Updated for `spec + implementation slice` workflow with mandatory implementation/visible outcome sections and dual-gate status.
- `2026-03-02`: Expanded dependencies and visible-test coverage to include D07b and D07c, plus explicit executed-row requirements for the split Phase 3 deliverables.
- `2026-03-03`: Added the D08 acceptance runner (`npm run check:acceptance`), new deterministic capability/extension/invariant checks, automated smoke artifacts, a full acceptance matrix, and executed evidence links for both automated and prior operator-visible passes. `Doc Gate` and `Implementation Gate` are now `passed`; deliverable moves to `review`.
- `2026-03-04`: Extended the automated smoke runner with `D11a-shell-observability` so shared-shell tab routing and observability snapshot rows now contribute to the acceptance artifact (`14/14 automated checks passed`).
- `2026-03-04`: Added `D11b-setup-bootstrap` so the shared-shell setup snapshot/apply-mode logic, managed Markdown preview output, and block-replacement rules now contribute to the acceptance artifact (`15/15 automated checks passed`).
- `2026-03-03`: Operator D08 step `2` exposed a roam follow-up issue: leaving a custom zone via manual drag/fling could later pull the pet back unexpectedly, walk-speed travel could feel jerky, and roam animation direction could drift from actual motion. Applied a follow-up runtime patch; manual re-test is still required before D08 can close.
- `2026-03-03`: Operator re-test confirmed the first roam fix improved smoothing and `zone -> desktop` fallback, but exposed one remaining step `2` issue: toggling `desktop -> zone` mid-travel could still snap the pet back to the zone edge on the next loop. Applied a second runtime patch so forced roam-mode transitions rebuild a safe zone-entry leg instead of resuming with stale motion state. Manual re-test is still required before D08 can close.
- `2026-03-03`: Operator completed the full D08 manual visible sweep successfully after the roam follow-up fixes. D08 is now closed as `done`.
