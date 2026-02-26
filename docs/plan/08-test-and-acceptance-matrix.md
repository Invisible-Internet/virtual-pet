# Deliverable 08: Test and Acceptance Matrix

**Deliverable ID:** `08-test-and-acceptance-matrix`  
**Status:** `not_started`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `02b-extension-framework-and-pack-sdk`, `03-pet-core-events-intents-suggestions`, `04-openclaw-bridge-spec`, `05-memory-pipeline-and-obsidian-adapter`, `06-integrations-freshrss-spotify`, `07-state-system-extension-guide`  
**Blocks:** `Implementation execution`  
**Verification Gate:** `Matrix covers core runtime/capability degradation/memory/integration failures and includes executed evidence for representative visible scenarios`

## Objective
Define complete acceptance and regression matrix for architecture and implementation milestones.

## In Scope
- Functional acceptance tests by subsystem.
- Failure-mode tests (OpenClaw unavailable, adapter missing, tool missing).
- Extension framework acceptance tests (pack loading, trust model, prop world behavior, arbitration, context propagation).
- Regression checks for existing drag/fling/runtime behavior.
- Documentation verification checks.
- Visible/manual operator tests with unambiguous pass/fail outcomes for each targeted deliverable.

## Out of Scope
- Full CI pipeline implementation.
- Performance benchmark automation (beyond defined manual checks for now).

## Dependencies
- D03-D07 finalized contracts.

## Decisions Locked
- Dual gating remains active (`Doc Gate` + `Implementation Gate`).
- Existing movement/runtime invariants must remain intact.

## Implementation Breakdown
1. Define matrix dimensions (subsystem x scenario x expected outcome).
2. Add mandatory fallback tests per capability.
3. Add memory adapter mode tests.
4. Add integration availability tests.
5. Add session handoff and docs consistency checks.
6. Add "human-visible proof" column for each test case (what user should see in app/log/output).
7. Add extension-framework scenarios for pack validity, trust/warning flow, prop world interactions, and offline/online context behavior.

## Verification Gate
Pass when all are true:
1. Every deliverable has at least one acceptance test and one failure-mode test.
2. Existing runtime invariants are represented explicitly.
3. Pass/fail criteria are objective and repeatable.
4. Matrix has ownership and execution cadence.
5. Each deliverable has at least one "visible result" acceptance scenario.
6. Representative tests from each subsystem are actually executed and recorded with evidence links/log snippets.

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
19. Simple custom state onboarding: a new `Reading`-style state can be added via config and entered without core switch rewrite.
20. Complex custom state onboarding: a `PoolPlay`-style phase state executes `enter -> loop -> exit -> recover` with deterministic fallback for missing clips.
21. State-aware dialogue: when asked what pet is doing/reading, response references current state/context in online mode and falls back to local context when OpenClaw is offline.

## Extension Framework Required Visible Test Targets
1. Valid pack loads from `extensions/` and appears in extension manager UI.
2. Invalid manifest yields warning and non-fatal skip.
3. Version mismatch shows warning and best-effort load behavior.
4. One-time trust warning shown on first enable; per-extension toggle works.
5. Spawn candy prop from GUI, drag/drop to desktop anchor, prop persists at coordinates.
6. Pet navigates to prop and enters mapped extension behavior/state.
7. Held-food chase behavior: near=`look/follow-head`, far=`chase` transition.
8. Pool prop triggers wardrobe swap and complex phase behavior (`enter/loop/exit/recover`).
9. Pool click interaction triggers splash response/effect.
10. Multiple props can coexist while arbitrator keeps single active behavior authority.
11. Asking "what are you doing/reading?" returns local context-aware answer offline.
12. Same question online includes extension/state context in OpenClaw response path.
13. OpenClaw offline does not break extension interactions or local Q/A.
14. Disable extension cleanly removes active props/behaviors and reverts to core state logic.
15. Multi-monitor prop anchors remain stable and pet travel remains clamped correctly.
16. Extension scoped KV persistence survives restart within quota.
17. Regression: drag/fling/size invariants remain unchanged.

## Open Questions
- Whether to add lightweight scripted smoke tests in this deliverable or defer to implementation phase.

## Implementation Slice (Mandatory)
- Implement a lightweight test execution harness or repeatable manual-run script for core visible scenarios.
- Execute a representative subset across movement, capability degradation, dialogue fallback, extension path, and memory path.
- Record outcomes in matrix with timestamp, runner, pass/fail, and evidence reference.
- Ensure regression checks include drag/fling invariants from existing runtime.

## Visible App Outcome
- Test matrix includes concrete executed rows (not only planned rows).
- User can run one command or short checklist and see pass/fail output tied to visible app behavior.
- At least one degraded-path scenario and one extension-path scenario are demonstrated and recorded.

## Implementation Verification (Manual)
1. Run the selected smoke/manual suite and capture results in matrix.
2. Validate one core runtime invariant test (`drag/fling/size`) remains passing.
3. Validate one offline/degraded bridge scenario and one extension scenario with evidence.
4. Confirm failed test behavior is explicitly surfaced with actionable notes.

## Gate Status
- `Doc Gate`: `not_started`
- `Implementation Gate`: `not_started`
- `Overall`: `not_started`

## Change Log
- `2026-02-26`: File created and seeded.
- `2026-02-26`: Updated for `spec + implementation slice` workflow with mandatory implementation/visible outcome sections and dual-gate status.
