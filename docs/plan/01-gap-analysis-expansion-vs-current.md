# Deliverable 01: Gap Analysis - Expansion Doc vs Current Repo

**Deliverable ID:** `01-gap-analysis-expansion-vs-current`  
**Status:** `done`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `00-master-roadmap`, `09-decisions-log`  
**Blocks:** `02-architecture-capability-registry`, `02b-extension-framework-and-pack-sdk`  
**Verification Gate:** `All major expansion ideas are mapped to repo status as Adopt/Adapt/Defer with rationale and no unresolved structural conflicts`

## Objective
Map ideas from the expansion conversation to current repository reality and lock what is included now vs deferred.

## In Scope
- Compare current code architecture to expansion proposal.
- Mark each major idea as:
  - `Adopt`
  - `Adapt`
  - `Defer`
- Document technical reasons and dependency implications.
- Include explicit mapping for:
  - Extension pack model (hybrid manifest + optional hooks) and discovery paths.
  - Prop world window model (desktop anchors, placement flow, multi-monitor behavior).
  - Core-authoritative behavior arbitration expectations for extension-origin actions.
  - Extension trust/permission/compatibility policy (author-trusted warning model + best-effort compatibility).
  - Desktop roaming modes (full desktop vs user-defined roam zone).
  - Baseline states and priority policy (`Idle`, `Roam`, `MusicChill`, `MusicDance`, `WatchMode`, `Sleep`).
  - State extension patterns for simple and complex state packs (example: Reading, Pool).
  - Taskbar/tray settings and wardrobe UX surface.
  - Sensor model (including Windows GSMTC media source assumptions).
  - Proactive pet-to-user communication triggers and output channels.
  - Memory domains/tiers and identity-promotion governance.
  - Core workspace and Obsidian vault file/folder layout expectations.
  - Introspection behavior modes.
  - Conversation pathways (voice + text) including offline fallback UX.
  - OpenClaw read-only state awareness requirements (`currentState` + state context payload).
  - Speech presentation (bubble/balloon) and lip-sync approximation behavior.
  - Hobby stream and scoring model.
  - Music mode initial feature focus (`MEDIA.playing` trigger, props, rating flow).

## Out of Scope
- Implementing feature code.
- Changing runtime behavior.

## Dependencies
- Current repo state (`main.js`, `renderer.js`, `preload.js`, `assets/characters/girl/manifest.json`).
- Decisions in [`09-decisions-log.md`](./09-decisions-log.md).

## Decisions Locked
- Canvas runtime baseline is retained.
- OpenClaw is advisory/orchestration, not render-loop authority.
- Capability registry model is v1 plugin strategy.
- Renderer migration proposals (DOM/CSS or Pixi) are out of scope for this roadmap and treated as future-only unless ADR-0001 is superseded.

## Implementation Breakdown
1. Inventory expansion doc themes (states, memory, OpenClaw, integrations, architecture posture).
2. Inventory current repo capabilities.
3. Build a mapping table: `Theme -> Current State -> Decision -> Rationale -> Target Deliverable`.
4. Resolve conflicts with locked decisions.
5. Publish prioritized gap list for D02, D02b, and D03-D06.
6. Add a "visible verification checklist" for each mapped theme so acceptance can be observed unambiguously.

## Verification Gate
Pass when all are true:
1. Mapping table covers all major expansion themes.
2. No theme is left without a decision state (`Adopt/Adapt/Defer`).
3. All `Adopt/Adapt` items point to a downstream deliverable.
4. Locked decisions in D09 are respected.
5. All requested feature targets (roam modes, states, tray/settings/wardrobe, memory/introspection/hobby, conversation/speech/lip-sync, proactive pet messaging, music-mode focus, state-pack extensibility, OpenClaw state awareness) are present in the mapping table.
6. Extension framework targets (pack model, prop world model, arbitration model, trust/permission model, compatibility policy) are present with downstream ownership.

## Tangible Acceptance Test (Doc-Level)
1. Reviewer can point to one row per requested feature target in the mapping table.
2. Each row has `Adopt/Adapt/Defer`, rationale, and downstream deliverable reference.
3. Renderer strategy row explicitly confirms `Adopt current Canvas baseline` with no migration work in current roadmap scope.
4. Extension framework rows explicitly map to D02b and related contract deliverables (D03/D04/D07/D08).

## Open Questions
- None currently.

## Current Repo Capability Snapshot
| Area | Current Repo State (Observed) | Gap Relevance |
| --- | --- | --- |
| Runtime and rendering | Electron app with a single transparent frameless `BrowserWindow`; Canvas renderer plus sprite runtime in `renderer.js`; no DOM/Pixi runtime path. | Confirms ADR-0001 baseline and constrains feature delivery to Canvas-compatible contracts. |
| Movement authority | Main process owns drag/fling/clamping (`pet:beginDrag`, `pet:drag`, `pet:endDrag`) and reads cursor from `screen.getCursorScreenPoint()`. | Matches invariants and supports deterministic control surface for future state/intent system. |
| Window/top-level shell | `skipTaskbar: true`; no tray icon, no settings menu, no extra windows besides pet window. | Desktop shell UX and multi-window prop world are not implemented. |
| IPC bridge | `preload.js` exposes minimal `petAPI`; `contextIsolation: true`, `nodeIntegration: false`. | Good baseline; new APIs must preserve minimal/safe surface. |
| Existing state behavior | Runtime render states are motion-driven (`idle`, `dragging`, `flying`, `impact`); sprite states are animation asset states (`IdleReady`, `Walk`, etc.). | Baseline v2 behavior states (`Roam`, `Sleep`, etc.) are not present yet. |
| Integrations and AI | No OpenClaw bridge, no voice I/O, no chat UI, no media/GSMTC ingestion, no memory subsystem. | Most expansion features require new capability contracts. |
| Extension framework | No extension discovery, no manifest loader for external packs, no prop world, no arbitration, no permissions model. | D02b is a net-new framework layer. |

## Expansion-to-Repo Mapping Table
| Theme | Current Repo State | Decision | Rationale | Downstream Deliverable(s) | Visible Verification Hook |
| --- | --- | --- | --- | --- | --- |
| Renderer strategy for roadmap scope | Canvas runtime is active (`renderer.js` + `renderer-sprite-runtime.js`), no alternative renderer path implemented. | `Adopt` | ADR-0001 locks Canvas baseline for this roadmap. | `02-architecture-capability-registry`, `08-test-and-acceptance-matrix` | D02 capability map explicitly retains Canvas renderer boundary; D08 excludes migration scenarios. |
| Renderer migration proposals (DOM/CSS/Pixi) | No migration work in repo and no supporting modules. | `Defer` | Locked out by ADR-0001 unless superseded in a future ADR. | `future ADR only` | D01 explicitly records "out of current roadmap scope". |
| Main-authoritative drag/clamp/motion control | Main owns drag IPC, clamp area selection, and fixed content bounds enforcement. | `Adopt` | Preserves current invariants and deterministic authority model. | `03-pet-core-events-intents-suggestions`, `08-test-and-acceptance-matrix` | D03 contract ownership marks local runtime as authoritative for movement/state transitions. |
| Extension pack model (manifest-first + optional hooks) | Only character asset manifest exists; no extension pack lifecycle. | `Adapt` | Requires net-new pack schema/lifecycle while preserving core authority. | `02b-extension-framework-and-pack-sdk`, `08-test-and-acceptance-matrix` | D02b defines `discover -> validate -> warn -> enable/disable -> unload` plus reference packs. |
| Extension discovery paths (`extensions/` + app-data path) | No discovery logic or folder conventions in runtime. | `Adapt` | Required for local contributor workflow in v1. | `02b-extension-framework-and-pack-sdk`, `08-test-and-acceptance-matrix` | D02b specifies dev and installed discovery paths with non-fatal validation outcomes. |
| Prop world model (desktop anchors, placement flow, multi-monitor) | Single pet window only; no prop windows or desktop-anchored objects. | `Adapt` | ADR-0011 requires desktop-anchored multi-window prop world (Windows-first). | `02b-extension-framework-and-pack-sdk`, `03-pet-core-events-intents-suggestions`, `07-state-system-extension-guide`, `08-test-and-acceptance-matrix` | D02b includes anchor and placement contracts; D08 includes spawn/place/interact traces. |
| Core-authoritative arbitration for extension-origin actions | No extension-origin actions exist yet; current runtime authority is local and deterministic. | `Adapt` | Arbitration service is needed once extension requests can compete with core intents. | `02-architecture-capability-registry`, `02b-extension-framework-and-pack-sdk`, `03-pet-core-events-intents-suggestions`, `08-test-and-acceptance-matrix` | D02/D02b define `behaviorArbitrator`; D03 inserts extension-origin intents into priority rules. |
| Hook trust and permission model | No trusted hook runtime or permission surfacing exists. | `Adapt` | ADR-0010 requires warning + visible permissions + per-pack toggles. | `02b-extension-framework-and-pack-sdk`, `08-test-and-acceptance-matrix` | D02b policy table and D08 trust-warning/toggle scenarios. |
| Extension compatibility policy | No API-version/app-version compatibility checks exist. | `Adapt` | Needed for best-effort compatibility guarantees and safe downgrade behavior. | `02b-extension-framework-and-pack-sdk`, `08-test-and-acceptance-matrix` | D02b defines compatibility warnings (not fatal crash path). |
| OpenClaw read-only state/context propagation (including extension context) | No OpenClaw bridge and no bridge request envelope today. | `Adapt` | ADR-0009 requires `currentState` + bounded context while preserving non-authority. | `03-pet-core-events-intents-suggestions`, `04-openclaw-bridge-spec`, `02b-extension-framework-and-pack-sdk`, `08-test-and-acceptance-matrix` | D03 request schemas include state/context fields; D04 sequence includes online/offline context paths. |
| Roaming modes (full desktop vs user-defined roam zone) | Clamp behavior exists for display bounds/work area; no user-defined roam-zone contract. | `Adapt` | Existing clamp math supports desktop mode baseline; user-zone is new contract work. | `03-pet-core-events-intents-suggestions`, `07-state-system-extension-guide`, `08-test-and-acceptance-matrix` | D07 defines zone mode transitions and boundaries; D08 includes operator-visible seam/zone checks. |
| Baseline state set + priority (`Idle`, `Roam`, `MusicChill`, `MusicDance`, `WatchMode`, `Sleep`) | Motion/render state exists, but no behavior state catalog or deterministic priority policy. | `Adapt` | Required for roadmap-visible behavior semantics beyond motion. | `03-pet-core-events-intents-suggestions`, `07-state-system-extension-guide`, `08-test-and-acceptance-matrix` | D03 documents transition contracts; D07 documents priority policy and examples. |
| State extension patterns (simple + complex packs) | No external state-pack model exists today. | `Adapt` | ADR-0006 requires mixed config-first + optional hook extensibility. | `02b-extension-framework-and-pack-sdk`, `07-state-system-extension-guide`, `08-test-and-acceptance-matrix` | D02b manifest schema includes simple/complex packs; D07 onboarding examples (`Reading`, `PoolPlay`). |
| Taskbar/tray settings and wardrobe UX surface | No tray menu, no settings UI, no wardrobe UI pipeline currently wired. | `Adapt` | Desktop shell controls are a required roadmap surface. | `02-architecture-capability-registry`, `07-state-system-extension-guide`, `08-test-and-acceptance-matrix` | D02 ownership boundaries + D07 UX contracts + D08 shell acceptance tests. |
| Sensor model including GSMTC assumptions | Current runtime emits motion/cursor/keyboard-driven input only; no normalized MEDIA/IDLE/TIME events. | `Adapt` | Required for media-driven states and deterministic sensor routing. | `03-pet-core-events-intents-suggestions`, `06-integrations-freshrss-spotify`, `08-test-and-acceptance-matrix` | D03 defines normalized sensor schema with `MEDIA.source`; D06 binds integration usage. |
| Proactive pet-to-user communication triggers/channels | No proactive message trigger pipeline in current app. | `Adapt` | ADR-0008 requires bounded, logged, rate-limited announcements. | `03-pet-core-events-intents-suggestions`, `04-openclaw-bridge-spec`, `07-state-system-extension-guide`, `08-test-and-acceptance-matrix` | D03 adds `PET_ANNOUNCEMENT`; D04 defines local gating before output. |
| Memory domains/tiers and identity-promotion governance | No memory pipeline, no observation records, no promotion governance. | `Adapt` | ADR-0004/0005 and roadmap require guarded writes and adapter abstraction. | `05-memory-pipeline-and-obsidian-adapter`, `08-test-and-acceptance-matrix` | D05 defines domains, tiers, and mutation log constraints. |
| Core workspace + Obsidian vault layout expectations | No `/memory` docs or adapter folders yet. | `Adapt` | Needed for deterministic file layout and adapter portability. | `05-memory-pipeline-and-obsidian-adapter`, `08-test-and-acceptance-matrix` | D05 defines file/folder contracts with local + optional Obsidian mode. |
| Introspection behavior modes (narrative/technical) | Current diagnostics overlay exists, but no introspection contracts exposed to user flow. | `Adapt` | ADR-0008 requires bounded output modes with auditable payloads. | `03-pet-core-events-intents-suggestions`, `04-openclaw-bridge-spec`, `08-test-and-acceptance-matrix` | D03 and D04 define narrative/technical response envelopes and degraded behavior. |
| Conversation pathways (text + voice with offline fallback) | No chat UI, no STT/TTS capability contracts. | `Adapt` | ADR-0007 requires text-first resilient operation and optional voice add-ons. | `03-pet-core-events-intents-suggestions`, `04-openclaw-bridge-spec`, `07-state-system-extension-guide`, `08-test-and-acceptance-matrix` | D03 event schemas + D04 fallback sequences + D08 online/offline checks. |
| Speech bubble/dialog fallback + lip-sync approximation | Visual rig exists; no speech-driven bubble system or lip-sync contract exists. | `Adapt` | Required conversation feedback layer and degraded-mode behavior. | `07-state-system-extension-guide`, `04-openclaw-bridge-spec`, `08-test-and-acceptance-matrix` | D07 dialogue visual bindings; D08 verifies fallback talk mode when TTS unavailable. |
| Hobby stream and scoring model | No hobby feed normalization or scoring pipeline exists yet. | `Adapt` | Needed for proactive interest summaries and daily top picks. | `06-integrations-freshrss-spotify`, `05-memory-pipeline-and-obsidian-adapter`, `08-test-and-acceptance-matrix` | D06 scoring/ranking contracts; D05 memory observation handoff. |
| Music mode initial behavior focus (`MEDIA.playing`, props, rating loop) | No media-driven state or rating capture path in runtime. | `Adapt` | Roadmap requires deterministic trigger path and memory feedback loop. | `06-integrations-freshrss-spotify`, `07-state-system-extension-guide`, `03-pet-core-events-intents-suggestions`, `08-test-and-acceptance-matrix` | D06 + D07 define trigger/state/prop/rating contracts with validation scenarios. |
| OpenClaw authority posture | No bridge currently; runtime already functions without external AI dependency. | `Adopt` | ADR-0003 + ADR-0009 require advisory/orchestration only, never render/state authority. | `04-openclaw-bridge-spec`, `08-test-and-acceptance-matrix` | D04 policy table explicitly blocks direct state/render authority actions. |

## Prioritized Gap List for D02, D02b, and D03-D06
1. `P0 - D02b extension contract foundation`: pack schema, discovery paths, prop world anchors, arbitration, trust/permission visibility, compatibility checks, and online/offline context envelope.
2. `P0 - D03 contract normalization`: events/intents/suggestions schema for baseline states, sensor normalization, extension-origin intent insertion, conversation messages, and announcement contracts.
3. `P0 - D04 bridge constraints`: OpenClaw request/stream/fallback model with explicit non-authority rules and bounded state/extension context payloads.
4. `P1 - D05 memory governance`: local + Obsidian adapter model, memory tiers, guarded promotion/mutation policy, and deterministic write layouts.
5. `P1 - D06 integration specialization`: GSMTC-aware media ingestion, hobby scoring, and music-mode rating feedback loop that feeds memory observations.

## D09 Decision Cross-Check
| ADR | Requirement | D01 Mapping Coverage | Result |
| --- | --- | --- | --- |
| ADR-0001 | Keep Canvas runtime baseline | Renderer strategy rows (`Adopt` + migration `Defer`). | Aligned |
| ADR-0002 | Built-in capability registry for v1 | Arbitration/ownership rows point to D02 + D02b boundaries. | Aligned |
| ADR-0003 | OpenClaw-first orchestration (advisory) | OpenClaw posture and bridge rows keep local authority. | Aligned |
| ADR-0004 | Pet writes memory, OpenClaw summarizes | Memory governance row points to D05 guarded write model. | Aligned |
| ADR-0005 | Local-default + optional Obsidian adapter | Memory layout row maps to dual-adapter D05 scope. | Aligned |
| ADR-0006 | Mixed state extensibility model | State extension row maps simple+complex pack model. | Aligned |
| ADR-0007 | Text-first resilient conversation with optional voice | Conversation row enforces offline text fallback. | Aligned |
| ADR-0008 | Bounded introspection + rate-limited autonomy | Introspection and proactive messaging rows include bounded/logged behavior. | Aligned |
| ADR-0009 | OpenClaw receives read-only state context | State/context propagation row maps to D03/D04 payload contracts. | Aligned |
| ADR-0010 | Author-trusted extension warning + permissions | Hook trust/permission row maps to D02b + D08 visibility checks. | Aligned |
| ADR-0011 | Desktop-anchored prop world (Windows-first) | Prop world row maps to D02b/D03/D07/D08. | Aligned |

## Verification Gate Self-Check
- [x] Mapping table covers all major expansion themes in scope.
- [x] Every mapped theme has a decision (`Adopt`, `Adapt`, or `Defer`).
- [x] Every `Adopt`/`Adapt` row points to at least one downstream deliverable.
- [x] Locked decisions from `09-decisions-log.md` are cross-checked and aligned.
- [x] Requested feature targets are all present (roam, baseline states/priority, shell/wardrobe, sensor, proactive messaging, memory/introspection/hobby, conversation/speech/lip-sync, music-mode focus, extension/state-pack model, OpenClaw state awareness).
- [x] Extension framework targets are explicitly present (pack model, prop world model, arbitration, trust/permission, compatibility, online/offline context propagation).

## Tangible Acceptance Checklist Coverage (Doc-Level)
- [x] Mapping table includes one row per requested feature target.
- [x] Every row includes decision, rationale, and downstream ownership.
- [x] Renderer strategy row explicitly states `Adopt` Canvas baseline and `Defer` renderer migration work in this roadmap.
- [x] Extension framework rows explicitly map to D02b and related D03/D04/D07/D08 contracts.
- [x] Extension coverage includes: offline/online context path, prop world behavior, and trust/permission visibility checks.

## Verification Gate Status
- `Passed (2026-02-26): reviewer approved mapping completeness, extension-framework coverage, and ADR alignment.`
- `Implementation Gate: N/A (D01 is discovery/planning baseline by roadmap exception).`

## Change Log
- `2026-02-26`: File created and seeded.
- `2026-02-26`: Added full expansion-to-repo mapping table, extension framework gap rows, renderer strategy resolution, ADR cross-check, prioritized downstream gap list, and explicit verification checklist coverage; status moved to `review`.
- `2026-02-26`: Reviewer approved D01; status moved to `done` and verification gate recorded as passed.
