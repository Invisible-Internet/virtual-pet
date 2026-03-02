# Decisions Log (ADR Style)

Related:
- Tracker: [`00-progress-tracker.md`](./00-progress-tracker.md)
- Roadmap: [`00-master-roadmap.md`](./00-master-roadmap.md)

## ADR-0001: Keep Canvas Runtime Baseline
- **Date:** 2026-02-26
- **Decision:** Continue with existing Canvas runtime for current roadmap.
- **Rationale:** Current runtime is stable and already supports drag/fling/sprite state behavior. Renderer rewrite would delay high-value integration work.
- **Alternatives Considered:** DOM/CSS migration now, Pixi migration now.
- **Impacted Files/Modules:** `renderer.js`, `renderer-sprite-runtime.js`, planning deliverables D01-D10.
- **Confirmation Note (2026-02-26):** Team reaffirmed no renderer migration in current roadmap scope.

## ADR-0002: Use Capability Registry (Built-in Modules) for v1
- **Date:** 2026-02-26
- **Decision:** Implement built-in capability registry with enable/disable + health + degraded mode. No dynamic plugin loading for capability-engine modules in v1.
- **Rationale:** Delivers modularity and fallback behavior without introducing dynamic loading complexity.
- **Alternatives Considered:** Dynamic plugin loader in v1, monolithic integration logic.
- **Impacted Files/Modules:** D02 architecture docs, D02b extension framework boundaries, future `main` capability orchestrator modules.

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

## ADR-0007: Conversation UX Is Text-First Resilient with Optional Voice
- **Date:** 2026-02-26
- **Decision:** Conversation must remain usable via local chat input/output and bubble UI regardless of OpenClaw/STT/TTS availability; voice is additive, not required for baseline operation.
- **Rationale:** Keeps interaction dependable in degraded environments and avoids hard dependency on external voice/runtime services.
- **Alternatives Considered:** Voice-first interaction with no text fallback, OpenClaw-required chat path.
- **Impacted Files/Modules:** D03 contracts, D04 bridge spec, D07b dialog surface and talk-feedback bindings, D08 acceptance matrix.

## ADR-0008: Introspection and Autonomy Outputs Are Bounded and Auditable
- **Date:** 2026-02-26
- **Decision:** Introspection responses are limited to approved narrative/technical payloads; autonomous mutation and announcement behavior must be threshold-gated, rate-limited, and logged.
- **Rationale:** Preserves user trust and debuggability while preventing uncontrolled behavior changes.
- **Alternatives Considered:** Unbounded introspection verbosity, unlogged autonomous mutation/announcement behavior.
- **Impacted Files/Modules:** D03 introspection contracts, D05 mutation governance, D08 acceptance checks.

## ADR-0009: OpenClaw Receives Read-Only Pet State Context
- **Date:** 2026-02-26
- **Decision:** Bridge-bound requests include `currentState` and optional bounded state context summary; OpenClaw may use this for responses but cannot set state authority.
- **Rationale:** Enables state-aware dialogue ("what are you reading/doing") while preserving local deterministic state control and offline operation.
- **Alternatives Considered:** No state context to OpenClaw, OpenClaw-driven state authority.
- **Impacted Files/Modules:** D02b extension framework contracts, D03 state/context contracts, D04 bridge payload policy, D07 state narration hooks, D08 validation.

## ADR-0010: Extension Framework Trust and Permission Model (v1)
- **Date:** 2026-02-26
- **Decision:** Use author-trusted local extension loading by default with one-time warning, explicit permission visibility, and per-extension enable/disable controls.
- **Rationale:** Matches v1 local-contributor workflow while preserving user awareness and fast rollback when extensions misbehave.
- **Alternatives Considered:** Strict sandbox-only trust model in v1, unrestricted no-warning trust model.
- **Impacted Files/Modules:** D02 capability ownership boundaries, D02b trust/permission contracts, D08 extension acceptance scenarios.

## ADR-0011: Prop World Uses Desktop-Anchored Multi-Window Model (Windows-First)
- **Date:** 2026-02-26
- **Decision:** Extension props use true desktop anchor coordinates with a multi-window world model, validated Windows-first in v1.
- **Rationale:** Required to support prop placement and interaction patterns (drop prop, pet navigates to prop, pool/food interactions) that are not realistic in pet-local-only space.
- **Alternatives Considered:** Pet-local prop rendering only, staged local-first then desktop-anchor later.
- **Impacted Files/Modules:** D02 capability boundaries (`propWorld`/arbitration), D02b prop world spec, D03 extension event contracts, D07 prop-to-state templates, D08 extension acceptance matrix.

## ADR-0012: Markdown-First Memory Artifact Policy
- **Date:** 2026-02-26
- **Decision:** Canonical user-facing memory artifacts should be Markdown-first. `.jsonl` files are allowed only as temporary implementation-slice outputs until Markdown parity is complete.
- **Rationale:** Improves inspectability/editability for operator workflows and aligns with OpenClaw/Obsidian document-centric memory strategy.
- **Alternatives Considered:** Keep JSONL as long-term canonical store, dual canonical stores (JSONL + Markdown).
- **Impacted Files/Modules:** D05 memory adapter outputs, mutation/promotion log formats, D08 acceptance checks.

## ADR-0013: Config-First External Path Resolution
- **Date:** 2026-02-26
- **Decision:** Add `config/settings.json` as durable settings baseline for external paths (`openClawWorkspaceRoot`, `obsidianVaultRoot`, local fallback roots) and memory adapter mode. Environment variables remain override layer.
- **Rationale:** Needed for real local integration (including WSL-hosted OpenClaw), predictable portability, and future GUI settings synchronization.
- **Alternatives Considered:** Environment-variables-only, hard-coded repo-relative paths.
- **Impacted Files/Modules:** D05 settings/path contracts, D07c settings UI groundwork, runtime bootstrap config loading, D08 path-resolution acceptance tests.

## ADR-0014: Insert D05a Connectivity/Bootstrap Gate Before D05 Closeout
- **Date:** 2026-02-26
- **Decision:** Add `05a-obsidian-workspace-bootstrap-and-connectivity` before D05 completion and require its implementation evidence before D05 gate closeout.
- **Rationale:** Path/config/transport uncertainties (OpenClaw in WSL, local Obsidian vault, optional remote endpoints) require a dedicated validation gate before memory deliverable finalization.
- **Alternatives Considered:** Keep path/connectivity work embedded in D05 only, defer connectivity verification to D08.
- **Impacted Files/Modules:** `00-master-roadmap.md`, `00-progress-tracker.md`, `AGENTS.md`, D05a deliverable file, D05 dependency chain.

## ADR-0015: OpenClaw Workspace Writes Are Non-Destructive by Default
- **Date:** 2026-02-26
- **Decision:** Normal runtime should never auto-create missing OpenClaw workspace files. Missing prerequisites are warning-only and resolved via explicit bootstrap command.
- **Rationale:** Prevents accidental mutation of external OpenClaw workspaces and keeps ownership boundaries explicit.
- **Alternatives Considered:** Always auto-create required OpenClaw workspace files during startup.
- **Impacted Files/Modules:** `memory-pipeline.js`, `scripts/check-workspace-connectivity.js`, D05a workspace governance, D05 closeout criteria.

## ADR-0016: v1 Offline Embodiment Baseline Is Minimal and Deterministic
- **Date:** `2026-03-02`
- **Decision:** v1 commits to a minimal offline embodiment loop only: deterministic local Q/A, visible state changes, prop interactions, proactive bounded announcements, and bubble/talk feedback. v1 does not commit to a full offline personality engine.
- **Rationale:** Preserves delight and resilience without introducing local-brain or personality complexity into the critical path.
- **Alternatives Considered:** Full rule-based offline personality in v1, local-model dependency in v1, no offline dialog surface beyond logs.
- **Impacted Files/Modules:** D07 state context fallback, D07b dialog surface and bubble/talk feedback, D07c shell affordances, D08 acceptance checks, `README.md`.

## ADR-0017: Split Phase 3 Scope Across D07, D07b, and D07c
- **Date:** `2026-03-02`
- **Decision:** Split the old Phase 3 monolith so D07 owns deterministic state runtime and state-pack mapping, D07b owns dialog surface and minimal offline loop, and D07c owns tray/settings/wardrobe surface.
- **Rationale:** Keeps each deliverable decision-complete, small enough to verify manually, and aligned with the "spec + implementation slice" workflow.
- **Alternatives Considered:** Keep all Phase 3 work in D07, split only dialog work, split only shell work.
- **Impacted Files/Modules:** `00-master-roadmap.md`, `00-progress-tracker.md`, `AGENTS.md`, D07, D07b, D07c, D08.

## ADR-0018: External OpenClaw Remains the Baseline; Local-Brain Work Stays Research-Only
- **Date:** `2026-03-02`
- **Decision:** Keep external OpenClaw as the product baseline through v1. Evaluate local providers, bundled OpenClaw, embedded model paths, and structured-trait canon only in the post-v1 D10 feasibility deliverable.
- **Rationale:** Preserves the current advisory-only architecture, avoids destabilizing near-term implementation, and defers high-risk platform/runtime questions until after v1 validation.
- **Alternatives Considered:** Commit to Ollama/local-model path now, bundle OpenClaw in the v1 roadmap, make structured traits canonical before feasibility work is complete.
- **Impacted Files/Modules:** `README.md`, `00-master-roadmap.md`, `00-progress-tracker.md`, `AGENTS.md`, D10.
