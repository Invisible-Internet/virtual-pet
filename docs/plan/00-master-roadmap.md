# Master Roadmap

Related:
- Progress Tracker: [`00-progress-tracker.md`](./00-progress-tracker.md)
- Decisions Log: [`09-decisions-log.md`](./09-decisions-log.md)

## Summary
This roadmap governs the documentation-guided implementation path for Virtual Pet v2:
- Keep Canvas runtime baseline.
- Build modular capability architecture with graceful fallbacks.
- Add extension framework contracts for offline-first props/state packs/context with online OpenClaw enrichment.
- Deliver OpenClaw-first orchestration and immediate memory pipeline support.
- Use config-first settings/path management for external dependencies (OpenClaw workspace, Obsidian vault, adapter/runtime toggles).
- Gate progression by both documentation and implementation verification before advancing to the next deliverable.
- Lock explicit user-visible behavior targets:
  - Desktop roam across display/work-area bounds and optional user-defined roam zone.
  - State catalog including `Idle`, `Roam`, `MusicChill`, `MusicDance`, `WatchMode`, `Sleep`.
  - Taskbar/tray shell with settings menu and wardrobe (costumes/accessories) controls.
  - Conversational UX with OpenClaw-backed dialogue plus offline-safe fallback chat input/output.
  - Speech output/input path with basic lip-sync approximation and fallback talk SFX mode.

## Execution Mode (Doc + Code)
For implementation deliverables (D02-D08, including inserted D05a), completion requires dual gates:
1. `Doc Gate`: contract/spec sections are complete and internally consistent.
2. `Implementation Gate`: at least one concrete runtime slice is implemented with visible/manual verification steps and outcomes.

Definition of `done` for each implementation deliverable:
- Deliverable file marks both gates passed.
- Tracker mirrors status and gate outcomes.
- User can run or observe at least one new visible app/runtime behavior tied to that deliverable.

Baseline exception:
- D01 is a completed discovery/planning deliverable and does not require retroactive runtime implementation.

## Explicit Feature Targets (Roadmap Commitments)
1. Movement and Roaming
- Pet can roam desktop bounds (respecting configured clamp mode).
- Pet can optionally roam within a designated user region (marquee/zone selection UX defined in docs).
2. Renderer Scope
- Keep existing Canvas renderer/runtime as-is for this roadmap.
- Do not include DOM/CSS/Pixi renderer migration work in current deliverables.
3. State System
- Baseline states are explicitly supported: `Idle`, `Roam`, `MusicChill`, `MusicDance`, `WatchMode`, `Sleep`.
- Default priority policy is documented and testable: `Sleep > WatchMode > MusicMode > Roam > Idle`.
- State extension model supports both:
  - Simple config states (single-loop or light variants).
  - Complex phase states (entry/loop/interaction/exit/recovery animation bundles).
4. Desktop Shell UX
- Tray/taskbar icon interactions are specified.
- Settings menu contracts are specified (including mode toggles, roaming mode, diagnostics exposure).
- Wardrobe pipeline is specified (costume/accessory selection and fallback behavior).
5. Sensor and Integration Focus
- Media sensing contract includes Windows GSMTC source expectations for playback/title/artist metadata.
- Music mode trigger path is defined from sensor event to visible state transition.
6. Memory and Introspection
- Two-domain memory model is documented and testable (`core workspace` + optional `extended vault`).
- Introspection responses are documented as narrative/technical views without exposing raw reasoning.
7. Conversation and Speech UX
- User can ask pet questions/commands through chat UI regardless of OpenClaw availability.
- Pet can proactively tell the user things through bubble/chat outputs based on deterministic triggers.
- Voice path supports STT/TTS integration points where available.
- When TTS is unavailable, fallback talk behavior is defined (short canned SFX + text bubble).
- Pet speech/thought bubble behavior is specified, including offline/degraded mode.
- Basic lip-sync approximation is specified as non-blocking visual behavior tied to speech activity.
- OpenClaw request context includes current pet state and bounded state-context metadata when available.
8. Extension Framework
- Hybrid extension packs are supported (manifest-first, optional trusted hook module).
- Pack discovery is folder-based in v1 (`extensions/` in dev + app-data extension path in installed app).
- Prop world uses true desktop anchors (Windows-first) and supports menu spawn + drag/drop placement.
- Behavior arbitration remains core-authoritative for extension-origin actions.
- Extension context can enrich OpenClaw requests in online mode, with offline-safe local fallback behavior.
9. Settings and Path Management
- Runtime path dependencies are configurable via settings file (not hard-coded defaults only).
- OpenClaw workspace path and Obsidian vault path support Windows-native and WSL UNC-style locations.
- Environment variables remain override layer, but settings file is the durable user-editable baseline before GUI exists.

## Feature-to-Deliverable Ownership
| Feature Theme | Primary Deliverable | Validation Deliverable |
| --- | --- | --- |
| Extension framework contracts (pack model, trust, permissions, compatibility) | D02b | D08 |
| Extension runtime services (`extensionRegistry`, `propWorld`, `extensionHookHost`, `permissionManager`, `behaviorArbitrator`, `extensionStore`) | D02, D02b | D08 |
| Desktop-anchored props and interaction model | D02b, D03, D07 | D08 |
| Roam modes (desktop + user zone) | D03, D07 | D08 |
| Baseline states + priorities | D03, D07 | D08 |
| Add-on state packs (simple + complex animation bundles) | D07 | D08 |
| Tray/settings/wardrobe GUI contracts | D02, D07 | D08 |
| Sensor normalization (USER_COMMAND/MEDIA/IDLE/TIME) | D03 | D08 |
| GSMTC media source expectations | D03, D06 | D08 |
| Conversation (chat/voice) + offline fallback | D03, D04 | D08 |
| OpenClaw read-only state awareness (`currentState` + context) | D03, D04 | D08 |
| Bubble/thought balloon + lip-sync approximation | D07 | D08 |
| OpenClaw non-authority + fallback policy | D04 | D08 |
| Memory domains/tiers/identity mutation guardrails | D05 | D08 |
| Config/settings path model (OpenClaw + Obsidian + adapter) | D05a, D05, D07 | D08 |
| Hobby stream scoring + daily top picks | D06, D05 | D08 |
| Introspection default/technical mode outputs | D03, D04 | D08 |
| MusicMode initial behavior set | D06, D07 | D08 |

## Phases and Ordering
### Phase 0 - Bootstrap and Alignment
- `00-progress-tracker`
- `00-master-roadmap`
- `09-decisions-log`
- `01-gap-analysis-expansion-vs-current`

### Phase 1 - Core Architecture Contracts
- `02-architecture-capability-registry`
- `02b-extension-framework-and-pack-sdk`
- `03-pet-core-events-intents-suggestions`
- `04-openclaw-bridge-spec`

### Phase 2 - Memory and Integrations
- `05a-obsidian-workspace-bootstrap-and-connectivity`
- `05-memory-pipeline-and-obsidian-adapter`
- `06-integrations-freshrss-spotify`

### Phase 3 - Extensibility and Validation
- `07-state-system-extension-guide`
- `08-test-and-acceptance-matrix`

## Deliverable Sequencing
1. `01-gap-analysis-expansion-vs-current`
2. `02-architecture-capability-registry`
3. `02b-extension-framework-and-pack-sdk`
4. `03-pet-core-events-intents-suggestions`
5. `04-openclaw-bridge-spec`
6. `05a-obsidian-workspace-bootstrap-and-connectivity`
7. `05-memory-pipeline-and-obsidian-adapter`
8. `06-integrations-freshrss-spotify`
9. `07-state-system-extension-guide`
10. `08-test-and-acceptance-matrix`

## Exit Criteria Per Phase
### Phase 0 Exit
- D01 is `done` and gaps are mapped to concrete implementation priorities.
- Decisions log contains baseline architecture decisions with rationale.

### Phase 1 Exit
- Capability interfaces are frozen for v1.
- Extension framework contracts are frozen for v1 (pack schema, trust/permission model, prop world model, arbitration model, hook boundaries).
- Event/Intent/Suggestion contracts are frozen.
- OpenClaw bridge behavior and fallback semantics are frozen.
- Conversation I/O contracts (text/voice) and non-authority constraints are frozen.
- At least one visible runtime increment is shipped from each Phase 1 deliverable.

### Phase 2 Exit
- Settings-driven external path resolution is implemented and validated (`config/settings.json`, local overrides, env overrides).
- OpenClaw transport selection (`stub`/`http`) and non-loopback auth policy are implemented with deterministic fallback behavior.
- OpenClaw workspace bootstrap and Obsidian vault prerequisite checks are available via explicit operator commands.
- Memory adapter model (`local` and `obsidian`) is specified and testable.
- FreshRSS/Spotify intent routing and missing-skill fallback behaviors are specified.
- Hobby stream scoring and daily summary behavior are specified with deterministic logging reasons.
- At least one visible runtime increment is shipped from each Phase 2 deliverable.

### Phase 3 Exit
- State extension workflow is documented and validated.
- End-to-end acceptance matrix is complete with pass/fail criteria.
- Desktop shell UX (tray/settings/wardrobe) has explicit acceptance scenarios.
- Roam/state/introspection scenarios have visible, operator-checkable outcomes.
- Conversation, speech bubble, and lip-sync fallback scenarios have visible, operator-checkable outcomes.
- At least one visible runtime increment is shipped from each Phase 3 deliverable.

## Risk Register Summary
| Risk | Impact | Mitigation |
| --- | --- | --- |
| Integration coupling to OpenClaw availability | High | Capability registry + degraded mode fallbacks |
| Memory pipeline writes causing drift/corruption | High | Guarded write targets + promotion thresholds + mutation log |
| Scope creep from plugin/state flexibility | Medium | Config-first with optional hooks, strict verification gates |
| Third-party extension trust and compatibility drift | High | Author-trusted default warning + explicit permission visibility + enable/disable controls + best-effort compatibility warnings |
| Documentation drift across sessions | Medium | Mandatory tracker + AGENTS snapshot sync at session end |
| Renderer rewrite risk | High | Keep Canvas baseline for current roadmap |
| Voice stack/service instability | Medium | Text-first fallback chat + canned talk SFX + degraded mode contracts |
| Multi-window prop world complexity | High | Windows-first scope + explicit extension acceptance scenarios + deterministic fallback rules |
