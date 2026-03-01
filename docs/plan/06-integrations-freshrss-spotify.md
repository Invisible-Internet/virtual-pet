# Deliverable 06: Integrations - FreshRSS and Spotify

**Deliverable ID:** `06-integrations-freshrss-spotify`  
**Status:** `done`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-01`  
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

## Contract Details
### Spotify/media trigger contract
`MEDIA` event payload for the first runtime slice:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `playing` | `boolean` | Yes | `true` is required for music-mode evaluation. |
| `confidence` | `number` | Yes | `>= 0.7` is the activation threshold. |
| `provider` | `string` | Yes | `spotify` in the first slice. |
| `source` | `string` | Yes | Provider-side source identifier, currently `spotify`. |
| `title` | `string` | Yes | Track title for response text and memory payloads. |
| `artist` | `string` | Yes | Track artist for response text and memory payloads. |
| `album` | `string` | No | Optional metadata, persisted when present. |
| `suggestedState` | `string` | Yes | First slice uses `MusicChill`. |
| `activeProp` | `string` | Yes | First slice uses `headphones`. |
| `entryDialogue` | `string` | No | Optional bounded flavor text. |
| `fallbackMode` | `string` | Yes | `none` or deterministic fallback reason. |

Intent route:
- `MEDIA(playing=true, confidence>=0.7)` -> `INTENT_STATE_MUSIC_MODE` -> `PET_RESPONSE`
- Current runtime output is suggestion/log driven, not authoritative state mutation.
- Suggested state remains advisory until D07 owns real state transitions.

Example:

```json
{
  "type": "MEDIA",
  "payload": {
    "playing": true,
    "confidence": 0.98,
    "provider": "spotify",
    "source": "spotify",
    "title": "Night Drive",
    "artist": "Primea FM",
    "album": "Sample Rotation",
    "suggestedState": "MusicChill",
    "activeProp": "headphones",
    "entryDialogue": "Now playing Night Drive by Primea FM.",
    "fallbackMode": "none"
  }
}
```

Example trace/result:
- Renderer hotkey `J` -> `pet:probeSpotifyIntegration`
- Main -> OpenClaw agent probe (`now playing` + `top artist`) -> `processPetContractEvent("MEDIA", ...)`
- Contract router -> `INTENT_STATE_MUSIC_MODE`
- Suggestion -> `PET_RESPONSE { suggestedState=MusicChill, activeProp=headphones }`
- Memory -> `spotify_playback` observation write with `topArtistSummary`

### Deterministic fallback contract
Fallback must stay non-fatal and bounded:

| Condition | Capability State | Fallback Mode | Behavior |
| --- | --- | --- | --- |
| `integrations.spotify.enabled=false` | `disabled` | `disabledByConfig` | Ignore provider and do not claim live Spotify input. |
| `integrations.spotify.available=false` | `degraded` | `spotify_provider_unavailable` | Emit local `MusicChill` fallback text instead of failure. |
| `openclaw.enabled=false` | `degraded` | `openclaw_disabled` | Keep advisory music-mode suggestion local-only. |
| no live probe run yet | `degraded` | `probe_pending` | Capability is non-fatal but should not claim live provider health yet. |
| OpenClaw agent approval/auth/provider failure | `degraded` | provider-specific probe reason | Surface the degraded reason in logs/output and keep the app stable. |

Manual forcing path for current slice:
- Start with `PET_SPOTIFY_AVAILABLE=0 npm start` to force the deterministic unavailable path.

### Capability health mapping
- `spotifyIntegration`
  - `healthy`: last live Spotify probe succeeded (`now playing` + `top artist`).
  - `degraded`: provider unavailable, OpenClaw disabled, probe pending, or live probe failed; local fallback remains available.
  - `disabled`: config disables Spotify.
- `freshRssIntegration`
  - `healthy`: last live FreshRSS probe returned JSON items/summary.
  - `degraded`: provider unavailable, OpenClaw disabled, probe pending, or live probe failed (including approval required).
  - `disabled`: config disables FreshRSS.

### FreshRSS scoring contract
Streams:
- `Mic/Curated`
- `Primea/Demographic`
- `Discovery/Trending`

Baseline formula:
- `+3` `Mic/Curated`
- `+2` `Primea/Demographic`
- `+1` `Discovery/Trending`
- `+2` one or more identity-tag matches
- `+X` explicit positive reinforcement count

Scoring output payload fields:
- `title`
- `stream`
- `tags`
- `score`
- `reasons[]` with `kind`, `delta`, `rule`, and matched value/tags

Example ranking sheet:

| Item | Stream | Tag Match | Reinforcement | Total | Why Selected |
| --- | --- | --- | --- | --- | --- |
| `B` | `Mic/Curated` `(+3)` | `synth` `(+2)` | `+2` | `7` | Strong personal stream plus identity fit and explicit reinforcement |
| `C` | `Primea/Demographic` `(+2)` | `ambient` `(+2)` | `+1` | `5` | Good demographic fit with matching identity tag |
| `A` | `Discovery/Trending` `(+1)` | none | `+0` | `1` | Discovery-only fallback candidate |

Daily selection rules:
- Rank candidate set by total score descending.
- Select top `1-3` items after tie-break by stable title order.
- Persist summary text plus reason breakdown to the memory pipeline.
- Promotion candidates are emitted only after repeated patterns clear D05 thresholds.

### Track rating contract
First-slice runtime route: renderer hotkey `R` -> `pet:recordTrackRating` -> memory observation.

Observation payload shape:

```json
{
  "observationType": "track_rating",
  "source": "spotify_track_rating",
  "evidenceTag": "spotify-night-drive",
  "payload": {
    "provider": "spotify",
    "rating": 9,
    "trackTitle": "Night Drive",
    "artist": "Primea FM",
    "album": "Sample Rotation"
  }
}
```

Rules:
- Rating is clamped to `1-10`.
- Memory write must be append-only through the D05 pipeline.
- D05 `music_rating` hotkey path remains intact for regression safety; D06 adds `track_rating`, not a replacement.

## Implementation Slice (Mandatory)
- Implement OpenClaw-agent-backed on-demand probes for Spotify and FreshRSS through capability registry.
- Implement one intent route to pet behavior transition/log output and one FreshRSS summary route.
- Implement deterministic degraded behavior for missing-tool/approval/auth/provider failure paths.
- Implement `track_rating` capture route to memory observation payload.

Current implementation slice status:
- [x] Added `spotifyIntegration` + `freshRssIntegration` capability states derived from settings and live probe state.
- [x] Added `openclaw-agent-probe.js` with prompt builders, envelope parsing, failure detection, and payload normalization for Spotify/FreshRSS.
- [x] Added `MEDIA -> INTENT_STATE_MUSIC_MODE -> PET_RESPONSE` contract route for live Spotify playback probe output.
- [x] Added `FRESHRSS_ITEMS -> INTENT_HOBBY_SUMMARY -> PET_RESPONSE` contract route for live FreshRSS summary/items output.
- [x] Added deterministic Spotify unavailable fallback text/path.
- [x] Added deterministic degraded handling for probe-pending, approval-required, auth failure, and provider failure cases.
- [x] Added `track_rating` memory observation route without removing the older D05 `music_rating` path.
- [x] Added visible runtime cue: Spotify/FreshRSS/rating events emit renderer FX and integration event payloads.
- [x] Added deterministic checks for router media/FreshRSS flow, integration capability state, agent-probe parsing/failure handling, settings overrides, track-rating normalization, and FreshRSS scoring order.

## Visible App Outcome
- Live Spotify or FreshRSS probe triggers visible pet FX and logged suggestion output.
- When integration unavailable, app shows deterministic fallback result instead of failure.
- Rating input appears in memory observation log/output.

Current first-slice controls:
- `J`: run live Spotify probe (`now playing` + `top artist`) and route the result into `MusicChill` suggestion + visible FX + `spotify_playback` observation.
- `L`: run live FreshRSS probe and route returned items/summary into visible FX + `freshrss_summary` observation, or surface deterministic degraded reason.
- `R`: record `track_rating` observation.
- `M`: existing D05 `music_rating` control remains unchanged.

## Implementation Verification (Manual)
1. Trigger supported integration event and confirm intent route + output behavior.
2. Force integration unavailable and confirm fallback response/log behavior.
3. Trigger FreshRSS and confirm either live summary/items output or deterministic degraded reason.
4. Submit one `track_rating` value and confirm memory observation entry.
5. Verify capability health status reflects probe-pending, healthy, and degraded integration states.

Current manual script:
1. Start app with default settings and press `J`.
   Expected: live Spotify probe logs current track + top artist, `MEDIA -> INTENT_STATE_MUSIC_MODE -> PET_RESPONSE` fires, visible FX appear, and a `spotify_playback` observation is written.
2. With FreshRSS enabled in config or local override, press `L`.
   Expected: either live FreshRSS summary/items produce `FRESHRSS_ITEMS -> INTENT_HOBBY_SUMMARY -> PET_RESPONSE` plus `freshrss_summary` observation, or the app surfaces deterministic degraded reason such as `approval_required`.
3. Restart with `PET_SPOTIFY_AVAILABLE=0` and press `J`.
   Expected: same non-fatal output path, but response text mentions fallback and `spotifyIntegration` is degraded.
4. Press `R`.
   Expected: `track_rating` append in memory log with `rating` clamped to `1-10`.
5. If diagnostics are enabled, confirm overlay shows `spotifyIntegration` / `freshRssIntegration` states moving from `probePending` to `healthy`/`degraded` after probes.

## Gate Status
- `Doc Gate`: `passed`
- `Implementation Gate`: `passed`
- `Verification Gate`: `passed`
- `Implementation Slice`: `passed`
- `Overall`: `done`

## Current Verification Snapshot
- Automated verification: `npm run check` passed on `2026-03-01`.
- Live OpenClaw probe verification on `2026-03-01`:
  - Spotify `now playing`: passed through `openclaw agent --agent main --message ... --json`.
  - Spotify `top artist`: passed through `openclaw agent --agent main --message ... --json`.
  - FreshRSS latest items: returned OpenClaw approval request instead of JSON payload; current expected app result is `freshRssIntegration=degraded` with `approval_required`.
- Manual in-app verification on `2026-03-01`:
  - FreshRSS healthy path was demonstrated after enabling the provider in config/local override:
    - `freshRssIntegration` moved `probePending -> healthy`
    - `FRESHRSS_ITEMS -> INTENT_HOBBY_SUMMARY -> PET_RESPONSE` fired
    - `freshrss_summary` observation was written
  - Spotify healthy path was demonstrated multiple times:
    - `spotifyIntegration` moved `probePending -> healthy`
    - `MEDIA -> INTENT_STATE_MUSIC_MODE -> PET_RESPONSE` fired
    - `spotify_playback` observations were written
  - `track_rating` observation writes were demonstrated.
  - Deterministic Spotify unavailable path was demonstrated with `PET_SPOTIFY_AVAILABLE=0`:
    - `spotifyIntegration` started and remained `degraded (providerUnavailable)`
    - app remained stable while FreshRSS still probed successfully
    - no false `spotify_playback` write was emitted in the unavailable run
- Operator resolved the recurring OpenClaw approval prompts enough for the D06 verification scope; no new blocking prompt behavior remains in the verified runtime path.
- D06 closeout decision:
  - All implementation and verification gates are now satisfied for the deliverable scope.

## Open Questions
- Minimum required Spotify actions for v1 (`play/pause/next/volume`) vs extended set.

## Change Log
- `2026-02-26`: File created and seeded.
- `2026-02-26`: Updated for `spec + implementation slice` workflow with mandatory implementation/visible outcome sections and dual-gate status.
- `2026-02-27`: Advanced to `in_progress` after D05 closeout; implementation slice execution pending.
- `2026-02-28`: Added explicit Spotify/media event contract, deterministic fallback matrix, FreshRSS scoring example, `track_rating` payload contract, and first runtime slice notes (`J`/`R` controls, capability states, automated checks). Doc gate marked `passed`; implementation gate remains pending manual runtime evidence.
- `2026-03-01`: Replaced simulated D06 probe path with live OpenClaw-agent Spotify/FreshRSS probes, added FreshRSS summary routing/memory observation, added probe-state-based capability health, and captured live verification that Spotify succeeds while FreshRSS currently degrades on OpenClaw approval requirement.
- `2026-03-01`: Captured partial manual in-app verification for live FreshRSS and Spotify healthy paths plus `track_rating` writes; hardened FreshRSS failure classification and Spotify payload normalization based on operator logs. Implementation gate remains open pending re-test of the hardened cases.
- `2026-03-01`: Captured final operator verification for Spotify unavailable fallback (`PET_SPOTIFY_AVAILABLE=0`) and closed D06 as `done` with doc, implementation, and verification gates passed.
