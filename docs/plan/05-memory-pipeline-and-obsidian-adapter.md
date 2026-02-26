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

## Verification Gate
Pass when all are true:
1. Pipeline works in `local` mode with no Obsidian path.
2. Pipeline works in `obsidian` mode when vault path exists.
3. Invalid adapter/path degrades to local mode without runtime failure.
4. Promotion writes are threshold-gated and logged.

## Open Questions
- Default summary cadence (`daily` vs `manual + daily` hybrid).

## Change Log
- `2026-02-26`: File created and seeded.
