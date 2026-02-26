# Master Roadmap

Related:
- Progress Tracker: [`00-progress-tracker.md`](./00-progress-tracker.md)
- Decisions Log: [`09-decisions-log.md`](./09-decisions-log.md)

## Summary
This roadmap governs the documentation-first execution path for Virtual Pet v2:
- Keep Canvas runtime baseline.
- Build modular capability architecture with graceful fallbacks.
- Deliver OpenClaw-first orchestration and immediate memory pipeline support.
- Gate progression by verification before advancing to the next deliverable.
- Lock explicit user-visible behavior targets:
  - Desktop roam across display/work-area bounds and optional user-defined roam zone.
  - State catalog including `Idle`, `Roam`, `MusicChill`, `MusicDance`, `WatchMode`, `Sleep`.
  - Taskbar/tray shell with settings menu and wardrobe (costumes/accessories) controls.
  - Conversational UX with OpenClaw-backed dialogue plus offline-safe fallback chat input/output.
  - Speech output/input path with basic lip-sync approximation and fallback talk SFX mode.

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
- Voice path supports STT/TTS integration points where available.
- When TTS is unavailable, fallback talk behavior is defined (short canned SFX + text bubble).
- Pet speech/thought bubble behavior is specified, including offline/degraded mode.
- Basic lip-sync approximation is specified as non-blocking visual behavior tied to speech activity.

## Phases and Ordering
### Phase 0 - Bootstrap and Alignment
- `00-progress-tracker`
- `00-master-roadmap`
- `09-decisions-log`
- `01-gap-analysis-expansion-vs-current`

### Phase 1 - Core Architecture Contracts
- `02-architecture-capability-registry`
- `03-pet-core-events-intents-suggestions`
- `04-openclaw-bridge-spec`

### Phase 2 - Memory and Integrations
- `05-memory-pipeline-and-obsidian-adapter`
- `06-integrations-freshrss-spotify`

### Phase 3 - Extensibility and Validation
- `07-state-system-extension-guide`
- `08-test-and-acceptance-matrix`

## Deliverable Sequencing
1. `01-gap-analysis-expansion-vs-current`
2. `02-architecture-capability-registry`
3. `03-pet-core-events-intents-suggestions`
4. `04-openclaw-bridge-spec`
5. `05-memory-pipeline-and-obsidian-adapter`
6. `06-integrations-freshrss-spotify`
7. `07-state-system-extension-guide`
8. `08-test-and-acceptance-matrix`

## Exit Criteria Per Phase
### Phase 0 Exit
- D01 is `done` and gaps are mapped to concrete implementation priorities.
- Decisions log contains baseline architecture decisions with rationale.

### Phase 1 Exit
- Capability interfaces are frozen for v1.
- Event/Intent/Suggestion contracts are frozen.
- OpenClaw bridge behavior and fallback semantics are frozen.
- Conversation I/O contracts (text/voice) and non-authority constraints are frozen.

### Phase 2 Exit
- Memory adapter model (`local` and `obsidian`) is specified and testable.
- FreshRSS/Spotify intent routing and missing-skill fallback behaviors are specified.
- Hobby stream scoring and daily summary behavior are specified with deterministic logging reasons.

### Phase 3 Exit
- State extension workflow is documented and validated.
- End-to-end acceptance matrix is complete with pass/fail criteria.
- Desktop shell UX (tray/settings/wardrobe) has explicit acceptance scenarios.
- Roam/state/introspection scenarios have visible, operator-checkable outcomes.
- Conversation, speech bubble, and lip-sync fallback scenarios have visible, operator-checkable outcomes.

## Risk Register Summary
| Risk | Impact | Mitigation |
| --- | --- | --- |
| Integration coupling to OpenClaw availability | High | Capability registry + degraded mode fallbacks |
| Memory pipeline writes causing drift/corruption | High | Guarded write targets + promotion thresholds + mutation log |
| Scope creep from plugin/state flexibility | Medium | Config-first with optional hooks, strict verification gates |
| Documentation drift across sessions | Medium | Mandatory tracker + AGENTS snapshot sync at session end |
| Renderer rewrite risk | High | Keep Canvas baseline for current roadmap |
| Voice stack/service instability | Medium | Text-first fallback chat + canned talk SFX + degraded mode contracts |
