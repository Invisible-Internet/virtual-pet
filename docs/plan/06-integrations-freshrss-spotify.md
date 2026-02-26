# Deliverable 06: Integrations - FreshRSS and Spotify

**Deliverable ID:** `06-integrations-freshrss-spotify`  
**Status:** `not_started`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `04-openclaw-bridge-spec`, `05-memory-pipeline-and-obsidian-adapter`  
**Blocks:** `08-test-and-acceptance-matrix`  
**Verification Gate:** `Intent routing, capability health checks, and fallback behavior are defined and at least one integration path is implemented with visible runtime output`

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
- Baseline scoring formula definition:
  - `+3` Personal Favorites
  - `+2` Demographic category
  - `+1` Discovery
  - `+2` Tag match with declared identity
  - `+X` User positive reinforcement
- Spotify/media mode mapping contract:
  - `MEDIA.playing=true` triggers music-mode evaluation.
  - Initial focus path for `MusicChill` behavior, headphones prop, and optional entry dialogue suggestion.
- User feedback capture contract (e.g., track rating) for memory pipeline.
- Daily selection behavior:
  - Select top `1-3` feed items.
  - Persist summary output and scoring reasons to memory pipeline.
  - Emit promotion candidates when repeated patterns pass thresholds.

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
6. Define `track_rating` payload contract (`1-10`) and routing to memory observations.

## Verification Gate
Pass when all are true:
1. Each integration has explicit intent schema.
2. Missing/failed integration behavior is documented and non-fatal.
3. Health statuses map into capability registry.
4. Integration outputs feed memory pipeline schemas.
5. Feed scoring and "why selected" logging fields are explicitly defined.
6. Daily top-item selection and rating-to-memory flow are explicitly defined.
7. Runtime demonstrates one media/integration trigger path with deterministic fallback when tool unavailable.
8. Runtime writes at least one integration-derived observation to memory pipeline.

## Tangible Acceptance Test (Doc-Level)
1. Example scoring sheet ranks at least 3 sample feed items with explicit score contributions.
2. Example Spotify/media event trace shows trigger to music-mode contract and resulting log payload.
3. Example includes one `track_rating=1-10` input and resulting memory observation payload.

## Implementation Slice (Mandatory)
- Implement one integration adapter stub path (Spotify/media or FreshRSS) through capability registry.
- Implement one intent route to pet behavior transition/log output.
- Implement one missing-tool fallback path returning deterministic local behavior.
- Implement `track_rating` capture route to memory observation payload.

## Visible App Outcome
- Media/integration event triggers visible pet mode transition or logged suggestion output.
- When integration unavailable, app shows deterministic fallback result instead of failure.
- Rating input appears in memory observation log/output.

## Implementation Verification (Manual)
1. Trigger supported integration event and confirm intent route + output behavior.
2. Force integration unavailable and confirm fallback response/log behavior.
3. Submit one `track_rating` value and confirm memory observation entry.
4. Verify capability health status reflects available/unavailable integration states.

## Gate Status
- `Doc Gate`: `not_started`
- `Implementation Gate`: `not_started`
- `Overall`: `not_started`

## Open Questions
- Minimum required Spotify actions for v1 (`play/pause/next/volume`) vs extended set.

## Change Log
- `2026-02-26`: File created and seeded.
- `2026-02-26`: Updated for `spec + implementation slice` workflow with mandatory implementation/visible outcome sections and dual-gate status.
