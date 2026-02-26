# Deliverable 08: Test and Acceptance Matrix

**Deliverable ID:** `08-test-and-acceptance-matrix`  
**Status:** `not_started`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `03-pet-core-events-intents-suggestions`, `04-openclaw-bridge-spec`, `05-memory-pipeline-and-obsidian-adapter`, `06-integrations-freshrss-spotify`, `07-state-system-extension-guide`  
**Blocks:** `Implementation execution`  
**Verification Gate:** `Matrix covers core runtime, capability degradation, memory adapters, and integration failures with explicit pass criteria`

## Objective
Define complete acceptance and regression matrix for architecture and implementation milestones.

## In Scope
- Functional acceptance tests by subsystem.
- Failure-mode tests (OpenClaw unavailable, adapter missing, tool missing).
- Regression checks for existing drag/fling/runtime behavior.
- Documentation verification checks.
- Visible/manual operator tests with unambiguous pass/fail outcomes for each targeted deliverable.

## Out of Scope
- Full CI pipeline implementation.
- Performance benchmark automation (beyond defined manual checks for now).

## Dependencies
- D03-D07 finalized contracts.

## Decisions Locked
- Documentation-first gating remains active.
- Existing movement/runtime invariants must remain intact.

## Implementation Breakdown
1. Define matrix dimensions (subsystem x scenario x expected outcome).
2. Add mandatory fallback tests per capability.
3. Add memory adapter mode tests.
4. Add integration availability tests.
5. Add session handoff and docs consistency checks.
6. Add "human-visible proof" column for each test case (what user should see in app/log/output).

## Verification Gate
Pass when all are true:
1. Every deliverable has at least one acceptance test and one failure-mode test.
2. Existing runtime invariants are represented explicitly.
3. Pass/fail criteria are objective and repeatable.
4. Matrix has ownership and execution cadence.
5. Each deliverable has at least one "visible result" acceptance scenario.

## Required Visible Test Targets
1. Roaming: pet roams desktop bounds and optional roam zone with clear boundary behavior.
2. State set: `Idle/Roam/MusicChill/MusicDance/WatchMode/Sleep` can all be entered via deterministic triggers.
3. State priority: conflict scenario resolves as `Sleep > WatchMode > MusicMode > Roam > Idle`.
4. Desktop shell: tray/taskbar icon opens settings menu; wardrobe changes visible accessory/costume state.
5. Media trigger: active media causes music-mode transition with log evidence.
6. Introspection: default vs technical status outputs are distinct and chain-of-thought safe.
7. Conversation UI: user can ask via chatbox, pet responds in bubble/chat output with visible correlation to request.
8. OpenClaw offline fallback: dialogue still works in local fallback mode (text-first).
9. Voice path: when TTS/STT available, voice in/out path functions without blocking runtime.
10. Voice fallback: if TTS fails/unavailable, canned talk SFX + text output still provide "pet is talking" feedback.
11. Lip-sync approximation: during speech activity, visible mouth/talk animation toggles; on fallback it degrades predictably.
12. Proactive pet messaging: deterministic trigger emits `PET_ANNOUNCEMENT` and visible bubble/chat output with cooldown respected.
13. Introspection content: technical mode output includes `currentState`, `lastSensorEvent`, and `activeJobs`; narrative mode includes state/mood/media/hobby flavor.
14. Memory domains: required core workspace + vault path layouts are validated, with graceful degradation when optional vault paths are unavailable.
15. Hobby flow: daily top `1-3` selection logs scoring reasons and emits memory summary payload.
16. Music-mode feedback loop: `track_rating (1-10)` appears in observation log and affects next daily summary input.
17. Media source check: Windows media event includes `source=GSMTC` when available, else deterministic fallback source labeling.
18. Mutation transparency modes: `silent/logged/brief_notification` produce the expected user-visible notification behavior while preserving audit logs.

## Open Questions
- Whether to add lightweight scripted smoke tests in this deliverable or defer to implementation phase.

## Change Log
- `2026-02-26`: File created and seeded.
