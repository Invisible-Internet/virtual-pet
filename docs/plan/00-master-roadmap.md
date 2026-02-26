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

### Phase 2 Exit
- Memory adapter model (`local` and `obsidian`) is specified and testable.
- FreshRSS/Spotify intent routing and missing-skill fallback behaviors are specified.

### Phase 3 Exit
- State extension workflow is documented and validated.
- End-to-end acceptance matrix is complete with pass/fail criteria.

## Risk Register Summary
| Risk | Impact | Mitigation |
| --- | --- | --- |
| Integration coupling to OpenClaw availability | High | Capability registry + degraded mode fallbacks |
| Memory pipeline writes causing drift/corruption | High | Guarded write targets + promotion thresholds + mutation log |
| Scope creep from plugin/state flexibility | Medium | Config-first with optional hooks, strict verification gates |
| Documentation drift across sessions | Medium | Mandatory tracker + AGENTS snapshot sync at session end |
| Renderer rewrite risk | High | Keep Canvas baseline for current roadmap |
