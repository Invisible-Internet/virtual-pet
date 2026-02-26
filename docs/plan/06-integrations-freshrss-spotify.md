# Deliverable 06: Integrations - FreshRSS and Spotify

**Deliverable ID:** `06-integrations-freshrss-spotify`  
**Status:** `not_started`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `04-openclaw-bridge-spec`, `05-memory-pipeline-and-obsidian-adapter`  
**Blocks:** `08-test-and-acceptance-matrix`  
**Verification Gate:** `Intent routing, capability health checks, and fallback behavior are defined for both integrations`

## Objective
Define how FreshRSS and Spotify are integrated through OpenClaw-first orchestration while preserving local fallback.

## In Scope
- Integration intents and payload contracts.
- Skill availability checks.
- Health/status reporting in capability model.
- Missing integration fallback behavior.
- FreshRSS stream partition model:
  - `Mic/Curated`
  - `Primea/Demographic`
  - `Discovery/Trending`
- Feed scoring contract and reason logging.
- Spotify/media mode mapping contract:
  - `MEDIA.playing=true` triggers music-mode evaluation.
  - Initial focus path for `MusicChill` behavior and optional entry dialogue suggestion.
- User feedback capture contract (e.g., track rating) for memory pipeline.

## Out of Scope
- Provider-specific credential UI details.
- Deep recommendation logic implementation.

## Dependencies
- D04 bridge contracts.
- D05 memory pipeline requirements.

## Decisions Locked
- Integrations are OpenClaw-routed first.
- Missing tools/skills must degrade cleanly.

## Implementation Breakdown
1. Define intents for FreshRSS and Spotify actions.
2. Define success/failure suggestion contracts.
3. Define capability health probes.
4. Define behavior when integration/tool is unavailable.
5. Define logs needed for downstream memory summarization.

## Verification Gate
Pass when all are true:
1. Each integration has explicit intent schema.
2. Missing/failed integration behavior is documented and non-fatal.
3. Health statuses map into capability registry.
4. Integration outputs feed memory pipeline schemas.
5. Feed scoring and "why selected" logging fields are explicitly defined.

## Tangible Acceptance Test (Doc-Level)
1. Example scoring sheet ranks at least 3 sample feed items with explicit score contributions.
2. Example Spotify/media event trace shows trigger to music-mode contract and resulting log payload.

## Open Questions
- Minimum required Spotify actions for v1 (`play/pause/next/volume`) vs extended set.

## Change Log
- `2026-02-26`: File created and seeded.
