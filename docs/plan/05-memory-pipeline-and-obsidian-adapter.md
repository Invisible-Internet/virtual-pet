# Deliverable 05: Memory Pipeline and Obsidian Adapter

**Deliverable ID:** `05-memory-pipeline-and-obsidian-adapter`  
**Status:** `not_started`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `04-openclaw-bridge-spec`  
**Blocks:** `06-integrations-freshrss-spotify`, `08-test-and-acceptance-matrix`  
**Verification Gate:** `Memory logging, summarization, and promotion rules are fully specified with local fallback and guarded writes`

## Objective
Define memory pipeline architecture that can run with or without Obsidian, while supporting OpenClaw-assisted summarization.

## In Scope
- Observation log schema.
- Daily summary flow.
- Identity promotion guardrails.
- Adapter model: `local` and `obsidian`.
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

## Implementation Breakdown
1. Define memory record schema and retention strategy.
2. Define summary scheduling and trigger rules.
3. Define promotion thresholds and anti-volatility rules.
4. Define adapter interfaces and fallback semantics.
5. Define immutable/protected sections and audit logging.
6. Define required vault path layout and adapter behavior when folders are missing.
7. Define identity mutation thresholds:
   - Minimum interaction count.
   - Time-persistence threshold.
   - Cross-validation requirement across multiple evidence points.

## Verification Gate
Pass when all are true:
1. Pipeline works in `local` mode with no Obsidian path.
2. Pipeline works in `obsidian` mode when vault path exists.
3. Invalid adapter/path degrades to local mode without runtime failure.
4. Promotion writes are threshold-gated and logged.
5. Identity section protections are explicit, including "never mutate Immutable Core."
6. Required workspace/vault path schemas are documented with fallback behavior for missing targets.
7. Mutation transparency policy is documented and tied to output behavior.

## Tangible Acceptance Test (Doc-Level)
1. Example data flow shows one observation record promoted to summary and either rejected/accepted for adaptive identity by threshold rules.
2. Reviewer can verify mutation-log format and find required fields (timestamp, source evidence, threshold check outcome).
3. Reviewer can verify required file layout examples for both domains and the mutation transparency behavior table.

## Open Questions
- Default summary cadence (`daily` vs `manual + daily` hybrid).

## Change Log
- `2026-02-26`: File created and seeded.
