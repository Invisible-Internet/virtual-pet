# Deliverable 13a: Offline Identity and Recent Recall

**Deliverable ID:** `13a-offline-identity-and-recent-recall`  
**Status:** `specifying`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-06`  
**Depends On:** `05-memory-pipeline-and-obsidian-adapter`, `11b-guided-pet-setup-and-markdown-bootstrap`, `11c-repair-actions-and-provenance-visibility`, `12a-real-openclaw-dialog-parity`, `12e-guided-openclaw-connectivity-and-pairing`  
**Blocks:** `13b-persona-snapshot-synthesis-and-provenance`, `13c-persona-aware-offline-dialog-and-proactive-behavior`

## Objective
Make offline dialog recall deterministic for identity and recent interaction highlights so the pet can answer basic "who are you" and "what happened recently" questions without OpenClaw, while keeping evidence/provenance bounded and testable.

## Why 13a Exists (Concrete Gap After 12e)
- `12a` and `12e` made chat transport and connectivity visible, but offline replies still rely on generic templates and state summaries.
- Canonical identity files exist (`IDENTITY.md`, `MEMORY.md`, `USER.md`) but offline dialog does not yet read them for direct recall answers.
- Memory observations are written with `evidenceTag`, but offline dialog does not yet return bounded "recent highlights" derived from those writes.
- Family `13` requires continuity before persona synthesis (`13b`) and behavior styling (`13c`).

## In Scope
- Add deterministic offline recall intents for:
  - pet name
  - pet birthday
  - recent highlights between user and pet (bounded list)
- Add a bounded local read-model for canonical identity facts from pet-local markdown files.
- Add bounded recent-highlight retrieval based on existing memory observation signals and evidence tags.
- Add renderer-safe recall evidence metadata for diagnostics/detail views (no secret material).
- Add deterministic checks and one acceptance matrix row for offline recall/evidence behavior.

## Out of Scope
- Any OpenClaw online persona export package (belongs to `13b`).
- Personality tone/style synthesis for all offline dialog (belongs to `13c`).
- Online reflection/sync cadence (`13d`).
- Canonical file direct-write governance changes.
- Unbounded semantic memory retrieval or embedding/vector systems.

## Environment / Prerequisites
- Existing post-`12e` app baseline with shared shell, status detail, and chat shell available.
- Canonical local files created through accepted `11b` setup flow.
- Memory runtime enabled with existing observation logging.
- OpenClaw may be healthy, degraded, or disabled; `13a` showcase must pass when offline.

## Showcase Promise (Mandatory)
With OpenClaw offline or unavailable, the operator can ask the pet for its name, birthday, and recent highlights; the pet responds with deterministic bounded answers sourced from canonical files and recent memory evidence tags, and degraded/recovery behavior is visible when required inputs are missing.

## Operator Demo Script (Mandatory)
1. Start app in an offline-capable mode (OpenClaw disabled or bridge fallback active) with existing local setup data.
2. Open tray `Open Chat...` and ask: `What is your name?`
3. Confirm response includes the exact local `IDENTITY.md` name value and stays `source=offline`.
4. Ask: `When is your birthday?`
5. Confirm response includes the exact local birthday value from managed canonical data.
6. Ask: `What happened recently between us?`
7. Confirm response includes a bounded highlight list (max 3 items) and evidence-tag references tied to recent observations.
8. Open tray `Status...` -> `Memory Runtime` detail.
9. Confirm detail includes recall provenance/evidence summary for the most recent offline recall request.
10. Re-run one recall question after a manual `Refresh Status` to confirm deterministic output remains stable.

## Failure / Recovery Script (Mandatory)
1. Break recall input by temporarily making local identity data unreadable (for example, point local workspace root to an empty folder in Settings).
2. Ask: `What is your name?`
3. Confirm offline response degrades deterministically with a bounded reason (`identity_unavailable` or equivalent) instead of fabricated identity text.
4. Restore valid local workspace root and press `Refresh Status`.
5. Ask: `What is your name?` again.
6. Confirm response recovers to the exact canonical identity value with no app restart required.
7. Disable memory runtime (or force memory unavailable), ask for recent highlights, then re-enable and repeat to verify deterministic degraded and recovery signals for recall history.

## Quick Operator Test Card (Mandatory)
### Preflight (2 min max)
1. Run: `npm start`
2. Open: tray `Open Chat...` and tray `Status...` -> `Memory Runtime`
3. Confirm start signal: chat is visible and memory row shows `HEALTHY` or `DEGRADED` (not crash/blank)

### Happy Path (5 min max)
1. Action: ask `What is your name?`
   - Expect: reply contains exact canonical pet name from `IDENTITY.md`.
2. Action: ask `When is your birthday?`
   - Expect: reply contains exact canonical birthday value.
3. Action: ask `What happened recently between us?`
   - Expect: reply contains at most 3 recent highlights with evidence-tag references.
4. Action: open `Status` -> `Memory Runtime` detail and click `Refresh Status`.
   - Expect: recall provenance/evidence summary is visible and reason labels are deterministic.

### Failure + Recovery (5 min max)
1. Break it: switch local workspace root to an unreadable/empty target, then ask `What is your name?`
   - Expect degraded signal: recall reply reports bounded unavailable reason (`identity_unavailable` or equivalent).
2. Recover it: restore local workspace root, refresh status, ask same question again.
   - Expect recovered signal: exact canonical name returns, and degraded reason clears.

### Pass / Fail Checklist
- [ ] Offline name recall matches local canonical value.
- [ ] Offline birthday recall matches local canonical value.
- [ ] Recent recall output is bounded (max 3 highlights) and includes evidence tags.
- [ ] Identity-unavailable degraded signal appears when canonical input is unavailable.
- [ ] Recovery returns deterministic canonical recall without restart.

## Acceptance Evidence Checklist (Mandatory)
- [ ] Chat capture for name recall with exact returned value.
- [ ] Chat capture for birthday recall with exact returned value.
- [ ] Chat capture for recent-highlight recall including evidence-tag references.
- [ ] `Status` memory detail capture showing recall provenance/evidence summary.
- [ ] Degraded capture showing unavailable reason code/text.
- [ ] Recovery capture showing canonical value restored.
- [ ] Deterministic check output line captured for `D13a-offline-identity-recall`.

## Public Interfaces / Touchpoints
- Runtime offline dialog routing:
  - `main.js`
  - `dialog-runtime.js`
- Memory retrieval/evidence plumbing:
  - `memory-pipeline.js`
  - `shell-observability.js`
- Canonical-file read-model and managed-block parsing:
  - `setup-bootstrap.js` (or extracted shared helper if needed)
- Deterministic checks and acceptance row:
  - `scripts/check-dialog-runtime.js`
  - `scripts/check-memory-pipeline.js`
  - `scripts/run-acceptance-matrix.js` (`D13a-offline-identity-recall`)

## Offline Recall Contract (First Slice)
```js
{
  kind: "offlineRecallResult",
  ts: 0,
  recallType: "identity_name|identity_birthday|recent_highlights",
  source: "offline",
  text: "bounded reply text",
  degradedReason: "none|identity_unavailable|memory_unavailable|no_recent_highlights",
  evidenceTags: ["identity.name", "obs:question_response:status-check"],
  evidenceRefs: [
    { kind: "canonical_file", fileId: "IDENTITY.md", field: "Name" },
    { kind: "memory_observation", observationId: "obs-...", evidenceTag: "..." }
  ]
}
```

Rules:
- `text` stays bounded for bubble readability.
- `evidenceTags` and `evidenceRefs` are renderer-safe and deterministic.
- No raw secrets/tokens/private env values in recall output or evidence metadata.

## Recent Highlight Retrieval Contract (First Slice)
- Source priority:
  1. in-memory recent observations from active runtime
  2. latest daily markdown memory log as fallback
- Eligibility:
  - include only bounded known observation types (`question_response`, `hobby_summary`, `spotify_playback`, `media_playback`, `track_rating`)
  - dedupe by `evidenceTag`
- Output bounds:
  - max `3` highlights
  - most recent first
  - deterministic degraded reason when none are available

## Acceptance Bar
- Accepted for `Spec Gate` only when:
  - recall intents and degraded reasons are explicit,
  - demo + failure/recovery scripts are concrete and operator-runnable,
  - evidence/provenance output boundary is explicit and safe.
- Accepted for final closure only when:
  - offline name/birthday answers match canonical local values,
  - recent recall is bounded and evidence-tagged,
  - identity/memory unavailable paths show deterministic degraded labels,
  - degraded path recovers without restart when inputs are restored,
  - deterministic check row `D13a-offline-identity-recall` is green.
- Not accepted if:
  - offline recall fabricates missing identity facts,
  - recent recall is unbounded or non-deterministic between identical inputs,
  - evidence metadata leaks raw secret/config values.

## Implementation Slice (Mandatory)
- Not started (`spec-only` session).
- First implementation slice planned:
  - add offline recall intent routing in dialog fallback lane,
  - add canonical identity read-model + recent-highlight retrieval helper,
  - add memory-detail provenance fields for last recall evidence,
  - add deterministic check and acceptance-matrix row for `13a`.

## Visible App Outcome
- No visible app/runtime change yet.
- This session locks the `13a` demo contract and acceptance criteria so implementation can start without reopening scope.

## Acceptance Notes
- `2026-03-06`: File created from post-v1 template for `13a`.
- `2026-03-06`: Locked offline recall scope to deterministic identity + bounded recent-highlight evidence tags.
- `2026-03-06`: Resolved deliverable naming to `13a-offline-identity-and-recent-recall` for implementation kickoff.

## Iteration Log
- `2026-03-06`: Initial `13a` spec drafted and aligned to accepted `11b` canonical-file setup and `12a/12e` offline dialog boundaries.

## Gate Status
- `Spec Gate`: `passed` (`2026-03-06`)
- `Build Gate`: `not_started`
- `Acceptance Gate`: `not_started`
- `Overall`: `specifying`

## Change Log
- `2026-03-06`: File created from the post-v1 deliverable template.
- `2026-03-06`: Added offline recall intent contract, evidence-tag retrieval contract, and operator demo/failure scripts.
- `2026-03-06`: Marked `Spec Gate` passed; implementation intentionally not started.
