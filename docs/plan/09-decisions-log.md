# Decisions Log (ADR Style)

Related:
- Tracker: [`00-progress-tracker.md`](./00-progress-tracker.md)
- Roadmap: [`00-master-roadmap.md`](./00-master-roadmap.md)

## ADR-0001: Keep Canvas Runtime Baseline
- **Date:** 2026-02-26
- **Decision:** Continue with existing Canvas runtime for current roadmap.
- **Rationale:** Current runtime is stable and already supports drag/fling/sprite state behavior. Renderer rewrite would delay high-value integration work.
- **Alternatives Considered:** DOM/CSS migration now, Pixi migration now.
- **Impacted Files/Modules:** `renderer.js`, `renderer-sprite-runtime.js`, planning deliverables D01-D08.

## ADR-0002: Use Capability Registry (Built-in Modules) for v1
- **Date:** 2026-02-26
- **Decision:** Implement built-in capability registry with enable/disable + health + degraded mode. No dynamic plugin loading in v1.
- **Rationale:** Delivers modularity and fallback behavior without introducing dynamic loading complexity.
- **Alternatives Considered:** Dynamic plugin loader in v1, monolithic integration logic.
- **Impacted Files/Modules:** D02 architecture docs, future `main` capability orchestrator modules.

## ADR-0003: OpenClaw-First Integration Orchestration
- **Date:** 2026-02-26
- **Decision:** Route integrations (FreshRSS, Spotify, weather/chat) through OpenClaw-first intent model.
- **Rationale:** Keeps external service logic centralized and consistent with assistant strategy while preserving local deterministic control.
- **Alternatives Considered:** Direct app integrations first, mixed ownership.
- **Impacted Files/Modules:** D04, D06, intent/suggestion contracts.

## ADR-0004: Memory Pipeline Writes via Pet, Summaries via OpenClaw
- **Date:** 2026-02-26
- **Decision:** Pet writes observations; OpenClaw returns summaries/promotions; pet applies guarded writes.
- **Rationale:** Prevents uncontrolled write paths and keeps core data consistency/governance in app control plane.
- **Alternatives Considered:** OpenClaw direct writes, dual-writer model.
- **Impacted Files/Modules:** D05, memory adapters, promotion/mutation logs.

## ADR-0005: Memory Adapter Strategy - Local Default with Optional Obsidian
- **Date:** 2026-02-26
- **Decision:** Implement memory adapter abstraction with `local` as default and `obsidian` as optional adapter.
- **Rationale:** Supports immediate implementation with fallback and future replacement of Obsidian without architecture breakage.
- **Alternatives Considered:** Obsidian-only, defer memory architecture.
- **Impacted Files/Modules:** D05, settings/memory config, fallback behavior.

## ADR-0006: Mixed State Extensibility Model
- **Date:** 2026-02-26
- **Decision:** Use config-first state definitions with optional code hooks for advanced states.
- **Rationale:** Balances extensibility and maintainability while avoiding state-engine sprawl.
- **Alternatives Considered:** Data-only states, code-only states.
- **Impacted Files/Modules:** D07 state extension design, state catalog/hook contracts.
