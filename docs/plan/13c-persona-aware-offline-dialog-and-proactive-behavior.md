# Deliverable 13c: Persona-Aware Offline Dialog and Proactive Behavior

**Deliverable ID:** `13c-persona-aware-offline-dialog-and-proactive-behavior`  
**Status:** `accepted`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-08`  
**Depends On:** `12a-real-openclaw-dialog-parity`, `12b-chat-shell-and-conversation-presence`, `13a-offline-identity-and-recent-recall`, `13b-persona-snapshot-synthesis-and-provenance`  
**Blocks:** `13d-online-reflection-and-runtime-sync`

## Objective
Make offline dialog tone and proactive conversation behavior use the same derived persona snapshot so the pet stays stylistically consistent when OpenClaw is unavailable, while proactive prompts become paced, non-repetitive, and visibly suppressible for operator trust.

## Why 13c Exists (Concrete Gap After 13b)
- `13b` created deterministic persona synthesis/export, but offline freeform replies still lean on generic fallback copy rather than persona-style shaping.
- `12b` proactive cadence is bounded but still feels frequent to operator feedback; stronger gating/backoff/anti-repeat policy is needed.
- Family `13` continuity requires offline behavior and proactive starts to use the same persona snapshot contract before `13d` online reflection sync.

## In Scope
- Add deterministic persona-style shaping for offline fallback dialog using `vp-persona-snapshot-v1`.
- Add a deterministic offline intent classifier and template/token response library (no probabilistic generation path).
- Add proactive pacing policy with explicit suppression reasons:
  - dialog currently open
  - recent user input
  - state ineligible
  - cooldown active
  - quiet-hours active
  - near-duplicate opener blocked
- Add adaptive proactive cooldown backoff when proactive prompts are ignored or dismissed.
- Add anti-repeat memory for proactive opener text within a bounded rolling window.
- Add Status/diagnostic visibility for:
  - last proactive attempt reason
  - last suppression reason
  - next eligible proactive timestamp
  - active backoff tier
- Add deterministic checks and one acceptance matrix row for `13c` behavior.
- Add setup-managed offline interest facts (fixed favorites + repeatable custom Q/A) and carry them through persona snapshot/export for offline+online continuity.
- Move starter persona profile contracts to JSON (`config/persona-profiles/*.json`) with validated runtime loading and safe fallback behavior.
- Add deterministic offline time-context responses (day/time/month/year from local OS clock/timezone).
- Record Windows notification integration research notes and recommended bounded implementation path for a future slice.

## Out of Scope
- Online reflection cadence, digest/heartbeat sync, and online conflict policy (`13d`).
- Canonical file write governance changes.
- New model/provider transport behavior.
- New autonomous embodiment states from family `14`.
- Unbounded personality simulation or freeform trait editor UI.

## Environment / Prerequisites
- Existing post-`13b` baseline with persona snapshot synthesis and bounded export metadata in `Status`.
- Shared-shell `Status`, `Open Chat...`, and `Advanced Settings` surfaces available.
- Offline dialog fallback lane available (OpenClaw disabled/degraded/timeout).
- Existing proactive runtime lane from `12b` enabled.

## Showcase Promise (Mandatory)
With OpenClaw offline, the pet responds in a persona-aligned offline tone (derived from the same persona snapshot used in `13b`) and proactive prompts feel intentional, with visible suppression/backoff reasons and deterministic recovery when suppression conditions clear.

## Operator Demo Script (Mandatory)
1. Start app with local canonical files valid and set OpenClaw disabled in `Settings` (`openclaw.enabled=false`).
2. Open tray `Open Chat...` and ask a general offline question (for example, `How are you today?`).
3. Confirm reply is `source=offline` and tone reflects persona snapshot style hints (not generic fallback-only phrasing).
4. Close chat, wait for proactive eligibility, and confirm one proactive prompt appears.
5. Open `Status...` -> `Memory Runtime` detail and confirm proactive metadata fields are visible (`Last Proactive Reason`, `Next Proactive Eligible At`, `Backoff Tier`).
6. Immediately open chat again and keep it open for at least one proactive tick window.
7. Confirm proactive attempt is suppressed with visible reason `suppressed_dialog_open`.
8. Close chat, wait for the next eligible window, and confirm proactive prompt resumes without restart.

## Failure / Recovery Script (Mandatory)
1. Break persona styling by setting `Canonical Files Root` to an empty/unreadable folder and click `Save Settings`.
2. Ask an offline freeform question from `Open Chat...`.
3. Confirm response degrades deterministically to bounded neutral fallback with explicit reason (`persona_snapshot_canonical_missing` or equivalent) rather than fabricated persona facts.
4. Keep chat closed and trigger repeated proactive windows without user response to force backoff growth.
5. Confirm proactive detail shows increased backoff tier and a delayed `Next Proactive Eligible At`.
6. Restore valid `Canonical Files Root`, click `Save Settings`, then `Refresh Status`.
7. Ask another offline question and confirm persona-aligned tone returns.
8. Interact once in chat and confirm proactive backoff resets to baseline on the next eligible cycle.

## Quick Operator Test Card (Mandatory)
### Preflight (2 min max)
1. Run: `npm start`
2. Open: tray `Advanced Settings...` and tray `Status...` -> `Memory Runtime`
3. Confirm start signal: app responsive, `Memory Runtime` detail loads, and no blank/error panel

### Happy Path (5 min max)
1. Action: in `Settings`, set `Openclaw Service Enabled` to off and save.
   - Expect: bridge status shows disabled/offline-safe mode.
2. Action: ask `How are you today?` in `Open Chat...`.
   - Expect: reply metadata stays `source=offline` and text reflects persona style hints.
3. Action: close chat and wait for proactive prompt.
   - Expect: one proactive message appears within policy window.
4. Action: open `Status` -> `Memory Runtime` detail and click `Refresh Status`.
   - Expect: proactive metadata fields show deterministic reason and next eligible time.

### Failure + Recovery (5 min max)
1. Break it: set `Canonical Files Root` to an empty/unreadable folder and save, then ask offline question.
   - Expect degraded signal: neutral fallback reply plus explicit persona degradation reason.
2. Recover it: restore valid `Canonical Files Root`, save, click `Refresh Status`, ask again.
   - Expect recovered signal: persona-aligned offline tone returns and degraded reason clears.

### Pass / Fail Checklist
- [ ] Offline freeform reply is persona-aligned when snapshot is ready.
- [ ] Proactive suppression reason `suppressed_dialog_open` is visible while chat is open.
- [ ] Backoff tier and next eligible timestamp are visible in `Status`.
- [ ] Persona degradation reason appears when canonical files are unavailable.
- [ ] Persona-aligned behavior returns after canonical root restore without restart.

## Acceptance Evidence Checklist (Mandatory)
- [ ] Chat capture showing `source=offline` with persona-aligned reply text.
- [ ] `Status` detail capture showing proactive reason/suppression/backoff metadata.
- [ ] Capture/log line showing `suppressed_dialog_open` while chat is open.
- [ ] Degraded capture showing persona snapshot-derived degraded reason in offline reply path.
- [ ] Recovery capture showing persona-aligned tone restored after canonical root fix.
- [ ] Deterministic check output line captured for `D13c-persona-aware-offline-proactive`.

## Public Interfaces / Touchpoints
- Offline dialog/runtime behavior:
  - `dialog-runtime.js`
  - `main.js`
  - `persona-snapshot.js`
  - `offline-persona-style.js` (new helper or equivalent inline module)
- Proactive policy/runtime signals:
  - `pet-contract-router.js`
  - `state-runtime.js`
  - `main.js`
  - `proactive-policy.js` (new helper or equivalent inline module)
- Observability/status detail:
  - `shell-observability.js`
  - shared-shell status detail rendering
- Optional bounded settings touchpoint (quiet-hours configuration if added in first slice):
  - `shell-settings-editor.js`
  - `settings-runtime.js`
- Deterministic checks / acceptance:
  - `scripts/check-dialog-runtime.js`
  - `scripts/check-contract-router.js`
  - `scripts/check-shell-observability.js`
  - `scripts/check-offline-persona-style.js` (new)
  - `scripts/check-proactive-policy.js` (new or extend existing proactive check)
  - `scripts/check-persona-offline-proactive.js` (new acceptance row driver)
  - `scripts/run-acceptance-matrix.js` (`D13c-persona-aware-offline-proactive`)

## Offline Persona Style Contract (First Slice)
```js
{
  kind: "offlinePersonaReply",
  ts: 0,
  source: "offline",
  personaSnapshotVersion: "vp-persona-snapshot-v1",
  personaState: "ready|degraded",
  personaReason: "none|canonical_missing|canonical_unreadable|parse_incomplete|memory_unavailable",
  styleProfile: {
    toneKeywords: ["gentle", "curious"],
    openerStyle: "warm_short",
    verbosity: "short"
  },
  text: "bounded offline reply",
  evidenceTags: ["persona.tone", "offline.reply"]
}
```

Rules:
- Offline reply text remains bounded for bubble readability.
- Style shaping is deterministic for identical input + snapshot conditions.
- If persona snapshot is degraded, fallback copy stays explicit and safe, with deterministic `personaReason`.
- No raw canonical file dumps or secret/config leakage in reply metadata.

## Style Profile Derivation Rules (Deterministic)
Source precedence for each style field:
1. `vp-persona-snapshot-v1` normalized fields (`styleHints`, derived persona fields).
2. Canonical fallback defaults baked into this slice.
3. Degraded neutral defaults when snapshot is degraded/unavailable.

`styleProfile` first-slice normalized fields:
- `warmth`: `low|medium|high` (default `medium`)
- `playfulness`: `low|medium|high` (default `low`)
- `curiosity`: `low|medium|high` (default `medium`)
- `verbosity`: `short|medium` (default `short`)
- `emojiPolicy`: `none|light` (default `none`)
- `addressStyle`: `pet_name_only|pet_plus_user|friendly_nickname` (default `pet_name_only`)
- `openerStyle`: `direct|warm_short|warm_reflective` (default `direct`)
- `closerStyle`: `none|gentle_prompt|supportive_note` (default `none`)

Deterministic normalization rules:
- Unknown/missing values map to defaults; no freeform passthrough.
- Multiple style hints are sorted lexicographically before mapping to avoid order drift.
- Degraded persona state forces:
  - `emojiPolicy=none`
  - `playfulness=low`
  - `openerStyle=direct`
  - `closerStyle=none`

## Offline Intent Classification Contract (Deterministic)
Classifier executes in fixed order; first match wins:
1. `identity_name`
2. `identity_birthday`
3. `identity_nickname`
4. `recent_highlights`
5. `greeting`
6. `comfort`
7. `smalltalk`
8. `unknown`

Rules:
- Inputs are normalized with lowercase + trimmed whitespace + collapsed spaces.
- Rule matching is deterministic (keyword/phrase matching only, no random thresholding).
- Existing `13a` recall intents remain source-of-truth for identity/recent answers; `13c` wraps style around those outputs.
- If no intent matches, classify as `unknown` and use bounded neutral fallback frame.

## Response Frame and Token Library Contract
Offline responses are composed from deterministic parts:
- `openerToken`
- `coreTemplate`
- `optionalFollowUp`
- `closerToken`

Frame key:
`<intent> + <personaMode> + <degradedState>`

Persona modes (first slice):
- `gentle_helper`
- `playful_friend`
- `steady_companion`
- `neutral_fallback`

Rules:
- Frame libraries are static constants in code, versioned with the slice.
- No runtime mutation of frame libraries.
- Slot filling is sanitized and bounded before rendering.
- Each intent has at least two variants per persona mode to avoid obvious repetition.

## Deterministic Variant Selection
Variant selection uses a stable, seeded hash.

Selection key:
`<intent>|<normalizedUserText>|<snapshotFingerprint>|<personaReason>|<mode>`

Algorithm requirements:
- Use one explicit non-cryptographic stable hash function (for example `fnv1a32`).
- `variantIndex = hash(selectionKey) % frameCount`.
- Same key always yields same variant across runs/platforms.
- Different intent or snapshot fingerprint can change variant deterministically.

## Output Boundaries and Safety Rules
- Max reply length: `220` characters.
- Max sentences: `2`.
- Max follow-up questions: `1`.
- Max emoji count: `1` when `emojiPolicy=light`, otherwise `0`.
- Strip/escape control characters and unsupported markup.
- Never output raw file paths, env vars, tokens, or secret refs.

If bounds are exceeded:
1. Remove `optionalFollowUp`.
2. Remove `closerToken`.
3. Truncate safely to max length with sentence-aware clipping.

## Proactive Policy Contract (First Slice)
```js
{
  kind: "proactivePolicyState",
  ts: 0,
  proactiveState: "eligible|suppressed|cooldown",
  lastAttemptReason: "eligible_emit|suppressed_dialog_open|suppressed_input_active|suppressed_state_ineligible|suppressed_cooldown|suppressed_quiet_hours|suppressed_repeat_guard",
  backoffTier: 0,
  cooldownMs: 0,
  nextEligibleAt: 0,
  repeatGuardWindowMs: 0,
  lastOpenerHash: "hash-or-none"
}
```

Rules:
- Base cooldown remains deterministic and bounded.
- Ignored/dismissed proactive prompts increment `backoffTier` up to a bounded max.
- Positive user engagement resets `backoffTier` to baseline.
- Repeat guard prevents near-duplicate opener reuse within a bounded rolling window.
- Status detail exposes suppression and eligibility metadata without requiring logs.

## Proactive Cadence and Suppression Policy (First Slice)
Baseline cadence:
- `baseCooldownMs = 180000` (`3m`)
- Backoff tiers:
  - tier `0`: `3m`
  - tier `1`: `6m`
  - tier `2`: `12m`
  - tier `3`: `20m` (cap)
- `repeatGuardWindowMs = 1800000` (`30m`)
- `recentUserInputWindowMs = 90000` (`90s`)

Suppression evaluation order:
1. `suppressed_dialog_open`
2. `suppressed_input_active`
3. `suppressed_state_ineligible`
4. `suppressed_quiet_hours`
5. `suppressed_cooldown`
6. `suppressed_repeat_guard`

Behavior rules:
- If suppressed, no proactive prompt is emitted and `lastAttemptReason` stores the suppression reason.
- If emitted and ignored/dismissed, increment `backoffTier` by `1` up to cap.
- If user engages (chat reply/user action acknowledging proactive), reset `backoffTier` to `0`.
- Quiet-hours policy defaults to disabled unless explicitly configured in settings.

## Proactive Opener Style Contract
Proactive opener creation uses the same `styleProfile` as offline reply shaping.

Rules:
- Opener template selection uses deterministic hash with key:
  - `<proactive_reason>|<snapshotFingerprint>|<backoffTier>|<lastOpenerHash>|<minuteBucket>`
- Repeat guard compares normalized opener hash against rolling window cache.
- If repeat guard blocks all candidate openers, emit no prompt and record `suppressed_repeat_guard`.

## Deterministic Check Plan (Spec-Complete)
Required `13c` contract checks:
1. `offline persona style determinism`
   - identical input + snapshot -> identical output text/metadata
2. `intent routing order`
   - overlapping phrases resolve to fixed highest-priority intent
3. `degraded persona fallback`
   - degraded snapshot forces neutral style and explicit reason
4. `variant hashing stability`
   - fixed seeds produce stable indices across repeated runs
5. `output bounds enforcement`
   - long template inputs clip deterministically
6. `proactive suppression taxonomy`
   - each suppression reason can be triggered deterministically
7. `backoff growth and reset`
   - ignored prompts increase tier; engagement resets to `0`
8. `repeat guard`
   - near-duplicate opener attempts are blocked within window
9. `observability coverage`
   - `Status` detail shows last reason, next eligible time, tier, and repeat-guard context

## Acceptance Bar
- `Spec Gate` passes only when:
  - persona-style offline contract is explicit,
  - proactive suppression/backoff/repeat-guard taxonomy is explicit,
  - operator demo and failure/recovery scripts are concrete and runnable,
  - observability fields required for operator verification are listed.
- Final acceptance requires:
  - persona-aligned offline freeform replies when snapshot is ready,
  - deterministic degraded fallback when snapshot inputs fail,
  - proactive suppression/backoff behavior visible in `Status`,
  - deterministic recovery after canonical input restore and user re-engagement,
  - green acceptance row `D13c-persona-aware-offline-proactive`.
- Not accepted if:
  - proactive prompts remain spammy with no visible suppression/backoff explanation,
  - offline persona style is non-deterministic under stable inputs,
  - degraded persona conditions are silent or ambiguous to operator.

## Implementation Slice (Mandatory)
- First implementation slice shipped:
  1. Added deterministic offline persona style module:
     - `offline-persona-style.js`
     - style-profile derivation from `vp-persona-snapshot-v1`
     - fixed-order intent classifier
     - frame/token composition + bounded output
     - stable hash variant selection (`fnv1a32`) for offline replies and proactive openers
  2. Added proactive policy module:
     - `proactive-policy.js`
     - suppression ordering, cooldown tiers, repeat guard, ignored-backoff growth, and user-engagement reset
  3. Wired runtime integration in `main.js`:
     - offline fallback path now uses persona-aware deterministic shaping for non-recall prompts
     - proactive prompt generation now uses persona-aware deterministic prompt shaping
     - proactive state now tracks attempt reason, suppression reason, tier, next eligible timestamp, and opener hash
     - user chat/command engagement now resets proactive backoff tier
  4. Extended contract and observability surfaces:
     - `pet-contract-router.js` now passes bounded persona metadata on offline bridge dialog suggestions
     - `shell-observability.js` memory detail now surfaces:
       - `Last Offline Persona Intent/Mode/State/Reason`
       - `Last Proactive Reason`
       - `Last Suppression Reason`
       - `Backoff Tier`
       - `Next Proactive Eligible At`
       - `Proactive Repeat Window`
  5. Added deterministic coverage:
     - `scripts/check-offline-persona-style.js` (new)
     - `scripts/check-proactive-policy.js` (new)
     - `scripts/check-persona-offline-proactive.js` (new acceptance row wrapper)
     - extended:
       - `scripts/check-contract-router.js`
       - `scripts/check-chat-shell-presence.js`
       - `scripts/check-shell-observability.js`
     - acceptance row added:
       - `D13c-persona-aware-offline-proactive`
  6. Verification run passed:
     - `npm run check:syntax`
     - `npm run check:contracts`
     - `npm run check:acceptance` -> `25/25 automated checks passed`

## Visible App Outcome
- Visible app/runtime change delivered:
  - Offline non-recall dialog now uses deterministic persona-aware tone shaping from `vp-persona-snapshot-v1`.
  - Proactive conversation lane now applies deterministic suppression/backoff/repeat-guard policy.
  - `Status` -> `Memory Runtime` detail now exposes proactive reason/tier/next-eligible visibility and last offline persona reply metadata.

## Acceptance Notes
- `2026-03-07`: File created from post-v1 template for `13c`.
- `2026-03-07`: Locked showcase promise, operator demo script, failure/recovery script, quick operator test card, evidence checklist, and first-slice contracts for offline persona style + proactive robustness.
- `2026-03-07`: `Spec Gate` passed; implementation intentionally not started.
- `2026-03-07`: Expanded spec to include complete deterministic shaping mechanics (style derivation, intent routing, frame/token composition, hash-based varianting, bounds/safety) and proactive cadence/suppression/backoff details.
- `2026-03-07`: Implemented first `13c` runtime slice across offline persona shaping, proactive policy runtime, and observability surface metadata.
- `2026-03-07`: Build verification passed:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `25/25`
- `2026-03-07`: Operator happy-path/failure run captured iteration feedback:
  - repeated offline freeform phrasing felt too static for repeated prompts
  - opening chat surfaced a stale canned announcement bubble and felt awkward
  - requested broader offline answers for persona-known companion facts (for example from `USER.md`)
- `2026-03-07`: Iteration patch landed and checks re-verified green (`25/25`):
  - added deterministic repeat-aware variation keying for offline persona fallback selection
  - cleared stale announcement bubble on chat-open so `Open Chat...` does not auto-show old canned text
  - added bounded offline persona fact lookup/response lane for snapshot fields (including companion facts from `USER.md`, such as timezone)
- `2026-03-07`: Observability timing UX iteration landed:
  - `Next Proactive Eligible At` now includes readable UTC timestamp
  - added `Next Proactive Eligible In` countdown so refresh visibly updates remaining time
- `2026-03-07`: Chat-open bubble behavior iteration landed:
  - opening chat now clears stale pet reply bubbles in addition to stale announcements
  - prevents old reply text from auto-popping when reopening chat without a new message
- `2026-03-08`: Expanded `13c` offline depth + online synergy iteration landed:
  - setup now captures offline interest facts:
    - fixed pet favorites (`color/movie/song/book`) + `hobby`
    - repeatable custom offline Q/A pairs with add/remove UI
    - persisted in managed `IDENTITY.md` (`Extra Offline Facts`) and recovered into setup defaults
  - persona profile runtime now loads starter profiles from:
    - `config/persona-profiles/*.json`
    - validated loader with deterministic safe fallback when JSON is missing/invalid
  - persona snapshot/export now includes bounded profile + interest fields for offline and online continuity:
    - `persona_profile_id`
    - `pet_favorite_*`
    - `pet_hobby`
    - `extra_offline_facts`
    - prioritized export ordering keeps identity+interest facts ahead of lower-priority fields
  - offline persona dialog intent coverage expanded for:
    - phrasing variants (`how you feeling`, `what's up`, etc.)
    - social bids (`play_invite`, `friendship`)
    - local time/date prompts (`time_context`)
  - proactive opener shaping now alternates deterministically between check-in and interest-aware prompts when interest facts exist
  - Windows notification integration research captured (no runtime notification commentary shipped in this patch):
    - `docs/plan/13c-windows-notification-research-notes.md`
  - verification run remained green:
    - `npm run check:syntax`
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `25/25`
- `2026-03-08`: Operator ran the full happy-path and failure/recovery scripts and confirmed both flowed as expected, then provided iteration feedback for setup UX and offline date/time phrasing:
  - `+ Add Fact` appeared to do nothing (empty row was not rendered)
  - setup save workflow felt too strict due explicit `Preview` prerequisite
  - offline date/time prompts using common phrasing variants did not always classify as `time_context`
- `2026-03-08`: Iteration patch landed and checks re-verified green (`25/25`):
  - fixed `+ Add Fact` row rendering bug by preserving empty draft rows in setup UI normalization
  - added debounced automatic setup preview refresh on setup-field edits (including extra fact add/remove/edit)
  - setup save now auto-runs preview when stale/missing, so manual `Preview` click is no longer required before `Save Setup`
  - updated setup copy/hints/status text to reflect auto-preview behavior
  - expanded offline `time_context` intent classifier for additional real-world phrasing (`today's date`, `current time`, `day of week`, `date/time` variants)
  - extended deterministic coverage in `scripts/check-offline-persona-style.js` for new date/time intent phrasing coverage
- `2026-03-08`: Additional operator feedback iteration landed after live runtime run:
  - setup extra-fact typing no longer loses focus during auto-preview cycles
  - setup no longer requires a manual preview button path:
    - removed Setup `Preview` button from UI
    - preview panel remains visible from the latest generated preview
    - `Save Setup` auto-generates a fresh preview when needed, then applies
  - setup preview remains visible across edits/save cycles (no blank panel when form is dirty)
  - offline `time_context` responses now separate question forms:
    - day questions -> weekday-only answer
    - date questions -> month/day/year answer (no time)
    - time questions -> clock answer with timezone
  - verification rerun remained green:
    - `npm run check:syntax`
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `25/25`
- `2026-03-08`: Operator confirmed final runtime behavior as acceptable and requested move-on:
  - happy-path and failure/recovery behavior passed in live run output
  - setup add-fact + always-visible preview workflow accepted
  - offline day/date/time answers accepted:
    - time example: `12:46 PM GMT-7.`
    - day example: `Sunday.`
    - date example: `March 8, 2026.`
  - proactive suppression telemetry remained visible and deterministic (`suppressed_dialog_open`, `suppressed_input_active`)
  - acceptance evidence accepted from operator run transcript; deliverable closed

## Iteration Log
- `2026-03-07`: Initial `13c` spec drafted from rough-in addendum and `12b` proactive cadence feedback.
- `2026-03-07`: Added full deterministic offline-voice design and deterministic check plan to make implementation targets unambiguous.
- `2026-03-07`: Implemented deterministic policy/runtime slice and tightened tests after mapping/suppression edge-case fixes discovered during contract checks.
- `2026-03-07`: Iterated `13c` from operator-run feedback to reduce canned repetition and improve offline persona fact coverage from snapshot-derived companion fields.
- `2026-03-07`: Iterated `13c` observability timing detail so proactive eligibility is understandable on refresh (absolute time + countdown).
- `2026-03-07`: Iterated `13c` chat-open behavior to suppress stale reply bubbles when reopening chat after prior conversation.
- `2026-03-08`: Iterated `13c` with setup-managed offline interests, JSON persona profile loading, expanded offline intent coverage (play/friend/time), deterministic interest-aware proactive mix, and bounded persona snapshot/export continuity for offline+online synergy.
- `2026-03-08`: Iterated setup usability and offline time-context reliability from operator feedback:
  - fixed `+ Add Fact` empty-row visibility
  - enabled debounced auto-preview and save-time auto-preview fallback
  - widened `time_context` phrase routing for date/time/day prompts
- `2026-03-08`: Iterated setup preview persistence/focus behavior and time/date answer specificity:
  - removed explicit Setup preview button workflow
  - preserved visible preview while editing/saving
  - prevented extra-fact input focus churn during preview cycles
  - split offline day/date/time answer shaping by prompt subtype
- `2026-03-08`: Operator accepted final `13c` behavior and requested progression to next slice.

## Gate Status
- `Spec Gate`: `passed` (`2026-03-07`)
- `Build Gate`: `passed` (`2026-03-07`)
- `Acceptance Gate`: `passed` (`2026-03-08`)
- `Overall`: `accepted`

## Change Log
- `2026-03-07`: File created from the post-v1 deliverable template.
- `2026-03-07`: Added `13c` contracts for persona-aware offline dialog and proactive suppression/backoff observability.
- `2026-03-07`: Marked `Spec Gate` passed; implementation intentionally not started.
- `2026-03-07`: Expanded `13c` plan with concrete deterministic style-profile mapping, intent order, frame/token composition rules, hash selection, output bounds, proactive tier timings, and check coverage expectations.
- `2026-03-07`: Implemented first runtime slice (`offline-persona-style.js`, `proactive-policy.js`, main/router/observability wiring), added deterministic `13c` checks, and passed `Build Gate` with green syntax/contracts/acceptance runs.
- `2026-03-07`: Iteration patch from operator feedback:
  - repeat-aware offline variation keying in `main.js` + `offline-persona-style.js`
  - chat-open stale announcement bubble suppression in `renderer.js`
  - offline persona fact lookup/answer templates for snapshot companion fields
  - extended `scripts/check-offline-persona-style.js` coverage; contracts/acceptance remained green.
- `2026-03-07`: Iterated `shell-observability.js` memory detail timing fields:
  - added `Next Proactive Eligible In` refresh-updating countdown
  - made `Next Proactive Eligible At` include UTC timestamp context
  - extended `scripts/check-shell-observability.js`; syntax/contracts/acceptance remained green.
- `2026-03-07`: Iterated `renderer.js` dialog-open behavior:
  - generalized stale bubble clear from announcement-only to any stale pet bubble on open
  - syntax/contracts/acceptance remained green (`25/25`).
- `2026-03-08`: Iterated setup/persona continuity + offline dialog depth:
  - new JSON profile loader/runtime: `persona-profiles.js` + `config/persona-profiles/*.json`
  - setup/identity additions in `setup-bootstrap.js`, `inventory.html`, and `inventory-shell-renderer.js`:
    - `petFavoriteColor`, `petFavoriteMovie`, `petFavoriteSong`, `petFavoriteBook`, `petHobby`
    - repeatable `extraInterestPairs[]` with `+ Add Fact` UI and persisted `Extra Offline Facts` section
  - persona snapshot/export extensions in `persona-snapshot.js` for profile + interest fields with prioritized export ordering
  - offline persona runtime expansion in `offline-persona-style.js`:
    - four profile lanes (`gentle_companion`, `playful_friend`, `bookish_helper`, `bright_sidekick`)
    - expanded intent routing and response shaping (`play_invite`, `friendship`, `time_context`, phrasing variants)
    - deterministic proactive `checkin` vs `interest` alternation when interests are present
  - deterministic checks expanded/updated:
    - `scripts/check-offline-persona-style.js`
    - `scripts/check-persona-snapshot.js`
    - `scripts/check-setup-bootstrap.js`
    - `scripts/check-contract-router.js`
    - `scripts/check-shell-observability.js`
  - notification research note added (no shipped runtime notification commentary):
    - `docs/plan/13c-windows-notification-research-notes.md`
  - verification remained green:
    - `npm run check:syntax`
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `25/25`.
- `2026-03-08`: Iterated setup UX and date/time phrasing reliability from operator demo feedback:
  - `inventory-shell-renderer.js`:
    - fixed extra-fact row normalization so empty draft rows render after `+ Add Fact`
    - added debounced setup auto-preview scheduling on form changes
    - setup save now auto-previews when stale/missing before apply
    - updated setup default status/hint copy to remove hard dependency on manual `Preview`
  - `inventory.html`:
    - updated setup preview/help copy to reflect automatic preview updates
  - `offline-persona-style.js`:
    - broadened `time_context` intent regex for common date/time/day phrasing variants
  - `scripts/check-offline-persona-style.js`:
    - added deterministic assertions for date/time phrase variants and date-focused reply path
  - verification remained green:
    - `npm run check:syntax`
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `25/25`.
- `2026-03-08`: Iterated setup preview UX and precise time/date answer formatting from operator feedback:
  - `inventory.html`:
    - removed Setup `Preview` button
    - updated setup preview panel copy for always-visible generated preview flow
  - `inventory-shell-renderer.js`:
    - stopped clearing `latestSetupPreview` when setup fields become dirty
    - `render()` no longer re-renders extra-fact row markup every cycle, preventing focus loss while typing
    - save button is no longer blocked by `setupDirty`; `Save Setup` triggers auto-preview validation internally
    - successful save keeps preview visible and refreshes generated preview after apply
  - `offline-persona-style.js`:
    - added `time_context` subtype shaping (`day`, `date`, `time`, `month`, `year`, `datetime`)
    - day/date/time outputs are now intentionally separated to match operator expectations
  - `scripts/check-offline-persona-style.js`:
    - added deterministic assertions for day-only, date-only (no clock), and time-only response behavior
  - verification remained green:
    - `npm run check:syntax`
    - `npm run check:contracts`
    - `npm run check:acceptance` -> `25/25`.
- `2026-03-08`: Marked `13c` accepted after operator-confirmed live run evidence and move-on request.
