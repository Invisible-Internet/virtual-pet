# Post-v1 Roadmap Rough-In: Families 11-15

Related:
- Workflow: [`00-development-workflow.md`](./00-development-workflow.md)
- Progress Tracker: [`00-progress-tracker.md`](./00-progress-tracker.md)
- Master Roadmap: [`00-master-roadmap.md`](./00-master-roadmap.md)
- Decisions Log: [`09-decisions-log.md`](./09-decisions-log.md)
- D10 Research Baseline: [`10-local-brain-and-personality-feasibility.md`](./10-local-brain-and-personality-feasibility.md)

## Summary
This rough-in preserves the agreed post-v1 roadmap shape so a future session can resume without re-deciding the major themes.

Locked ordering:
1. `11` Observability / Setup / Provenance
2. `12` Conversation / Bridge
3. `13` Memory / Persona Continuity
4. `14` Embodiment / Autonomy
5. `15` Extension Showcase

Planning status:
- `11a` is accepted and now serves as the observability baseline for the family.
- `11b` is accepted and now serves as the setup/bootstrap baseline for family `11`.
- `11c` is accepted and closed.
- `11d-settings-editor-and-service-controls` is accepted and closed.
- `12a-real-openclaw-dialog-parity` is accepted and closed.
- `12b-chat-shell-and-conversation-presence` is accepted and closed.
- `12c-guarded-openclaw-pet-command-lane` is accepted and closed (`Spec/Build/Acceptance Gates passed`).
- `12d-openclaw-plugin-and-skill-virtual-pet-lane` is accepted and closed (`Spec/Build/Acceptance Gates passed`).
- `12e-guided-openclaw-connectivity-and-pairing` is accepted and closed (`Spec/Build/Acceptance Gates passed`).
- `13a-offline-identity-and-recent-recall` is accepted and closed (`Spec/Build/Acceptance Gates passed`).
- `13b-persona-snapshot-synthesis-and-provenance` is accepted and closed (`Spec/Build/Acceptance Gates passed`).
- `13c-persona-aware-offline-dialog-and-proactive-behavior` is accepted and closed (`Spec/Build/Acceptance Gates passed`).
- `13d-online-reflection-and-runtime-sync` is accepted and closed (`Spec/Build/Acceptance Gates passed`).
- `14a-deliberate-roam-policy-and-monitor-avoidance` is now active in `specifying` (`Spec Gate` passed on `2026-03-08`; `Build/Acceptance` not started).
- `14ab-active-window-avoidance` is queued as the immediate follow-on after `14a` with narrowed foreground-window-only scope.
- Families `13` through `15` now use one cohesive execution sequence (`12c` through `15c`) with locked control-model decisions for family `14`.
- All future work follows the post-v1 workflow in [`00-development-workflow.md`](./00-development-workflow.md).

## Locked Assumptions
- `11a` is observability-first.
- Markdown remains canonical for personality and identity.
- Guided setup in `11b` writes canonical Markdown only to the pet-local workspace and treats the OpenClaw-facing workspace as observed/read-only.
- Any OpenClaw-to-pet action lane uses guarded requests only; the app remains authoritative.
- Existing v1 deliverables remain historical records and are not retrofitted.

## Family Index
| Family | Theme | Why It Exists | Current Planning State |
| --- | --- | --- | --- |
| `11` | Observability / Setup / Provenance | Make the current OpenClaw, model, memory, and fallback setup visible and understandable inside the app. | `11a`/`11b`/`11c`/`11d` accepted and closed |
| `12` | Conversation / Bridge | Make pet chat feel like real OpenClaw conversation, not narrow status/introspection. | `12a`/`12b`/`12c`/`12d`/`12e` accepted and closed |
| `13` | Memory / Persona Continuity | Make online and offline feel like the same pet with recall and stable personality. | `13a`/`13b`/`13c`/`13d` accepted and closed |
| `14` | Embodiment / Autonomy | Make the pet move and react more deliberately, unobtrusively, and believably. | `14a` active in `specifying`; `14ab` queued next |
| `15` | Extension Showcase | Prove the extension system with a real add-on and a polished end-to-end flow. | Rough only |

## Cohesive Post-12b Execution Sequence (`12c`-`15c`)
1. `12c-guarded-openclaw-pet-command-lane`
2. `12d-openclaw-plugin-and-skill-virtual-pet-lane`
3. `12e-guided-openclaw-connectivity-and-pairing`
4. `13a-offline-identity-and-recent-recall`
5. `13b-persona-snapshot-synthesis-and-provenance`
6. `13c-persona-aware-offline-dialog-and-proactive-behavior`
7. `13d-online-reflection-and-runtime-sync`
8. `14a-deliberate-roam-policy-and-monitor-avoidance`
9. `14ab-active-window-avoidance`
10. `14b-event-driven-watch-behavior`
11. `14c-touch-and-gaze-reactions`
12. `14d-mouse-tag-game`
13. `15a-hero-extension-showcase-pack`
14. `15b-extension-authoring-and-debug-visibility`
15. `15c-extension-context-and-bridge-polish`

### Cross-Family Contracts (Locked)
- Offline mode must remain fully usable without OpenClaw connectivity.
- OpenClaw integration is plugin + skill, local-first transport priority.
- Existing daily memory logs remain canonical write sink (`log-first`, no single-file `log.md` migration).
- Online conflict policy for live runtime/persona sync: OpenClaw result wins, local marks superseded context.
- OpenClaw workspace remains observed/read-only from pet app write perspective unless a future slice explicitly changes governance.

## Family 11: Observability / Setup / Provenance
### Family Goal
Create one visible in-app surface that explains:
- whether OpenClaw is connected
- which provider/model is active
- what fallback mode the pet is in
- which memory mode/workspace roots are active
- whether canonical Markdown identity files are present and readable

### Why This Family Comes First
- The local OpenClaw + Ollama path already works externally.
- The app currently hides too much of what it is doing.
- This family will make future work easier to test and easier to demonstrate.

### Proposed Slices
- `11a-openclaw-memory-observability-surface`
- `11b-guided-pet-setup-and-markdown-bootstrap`
- `11c-repair-actions-and-provenance-visibility`
- `11d-settings-editor-and-service-controls`

### `11a` Rough Showcase Promise
The user can open one visible diagnostics/setup surface and immediately understand:
- OpenClaw health
- provider/model identity
- memory adapter mode
- configured roots/paths
- canonical file health
- current fallback/degraded state

### `11a` Rough Demo Anchor
1. Start the app.
2. Open the observability surface from a visible app entrypoint.
3. Confirm healthy rows for bridge, provider/model, memory mode, and canonical files.
4. Break one dependency or path.
5. Confirm the surface changes visibly and explains the degraded mode.
6. Restore the dependency.
7. Confirm the surface recovers without restarting if recovery is supported.

### `11a` Likely Public Interfaces / Touchpoints
- New shell action for opening the observability surface.
- New renderer-visible status payload for diagnostics/setup state.
- Possible new diagnostics window or panel.
- Capability summary enrichment for provider/model/fallback/path details.
- File-health summary for `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`.

### `11a` Non-goals
- No new model-hosting architecture.
- No canonical personality editing UI.
- No major bridge rewrite.
- No memory-behavior rewrite.

### `11b` Rough Intent
Add a guided Pet Setup flow that collects the minimum identity/profile inputs once, writes canonical Markdown to the pet-local workspace, and surfaces the configured OpenClaw workspace as an observed/read-only context target.

### `11b` Rough Demo Anchor
1. Open setup.
2. Enter pet name, birthday, and baseline identity/personality choices.
3. Confirm the app writes canonical Markdown only to the pet-local workspace.
4. Re-open the observability surface.
5. Confirm the local target reads healthy and the OpenClaw target remains informational/observed.

### `11c` Rough Intent
Expose repair actions and provenance so the user can see why the system believes what it believes.

### `11c` Rough Demo Anchor
1. Open the observability surface.
2. Inspect a degraded row or persona/file-health row.
3. Open a "why" or "details" view.
4. Confirm the app shows the source path, reason, and suggested repair step.

### `11d` Rough Intent
Add an explicit GUI settings editor (likely under an Advanced Settings section) for operator-owned runtime/config controls such as service/source enablement, selected environment toggles, and character window sizing, while preserving safety boundaries and clear provenance.

### `11d` Rough Demo Anchor
1. Open settings from the shared shell.
2. Toggle one service source (for example Spotify or FreshRSS) and apply.
3. Toggle one runtime flag (for example an explicit test env override) and apply.
4. Adjust character display/hitbox size settings and confirm visible runtime effect.
5. Restart and confirm the chosen settings persist and render clearly in Status/Setup provenance.

## Family 12: Conversation / Bridge
### Family Goal
Make talking to the pet feel like talking to the OpenClaw agent, while preserving local authority and graceful fallback.

### Problem Statement
`12a` and `12b` are accepted, so freeform chat parity and chat-shell presence are in place.

The remaining gap is a trusted action ingress for `OpenClaw -> app` requests:
- OpenClaw can answer in chat, but cannot safely request bounded visible pet actions.
- Without a guarded lane, "do something in the app" degrades into plain chat text with no deterministic action result.

### Proposed Slices
- `12a-real-openclaw-dialog-parity`
- `12b-chat-shell-and-conversation-presence`
- `12c-guarded-openclaw-pet-command-lane`
- `12d-openclaw-plugin-and-skill-virtual-pet-lane`
- `12e-guided-openclaw-connectivity-and-pairing`

### `12a` Rough Intent
Route true freeform user messages through the bridge as real dialog, with visible source/fallback metadata and continuity similar to webchat or WhatsApp usage.

### `12b` Rough Intent
Improve the chat shell experience:
- tray/menu action to open the dialog
- pet stays still while the dialog is open
- proactive conversation starts feel intentional and bounded

### `12c` Rough Intent
Add an OpenClaw skill or bridge command lane that lets OpenClaw request pet behaviors, while the app validates and arbitrates them.

### `12c` Tightened Use Cases
- OpenClaw (through a skill/API caller) asks the pet to post a short announcement after a meaningful agent-side result.
- OpenClaw asks the app to open/focus `Status` when degraded/repair context should be surfaced to the operator.
- App returns deterministic accepted/rejected outcomes with explicit reasons, not silent failure.

### `12c` Tightened Boundary
- Signed allowlisted commands only; app remains authority.
- No direct OpenClaw control over movement/state/render/identity.
- No direct OpenClaw file-write lane for canonical files; file continuity belongs to family `13`.

### `12d` Rough Intent
Ship a separable OpenClaw integration package (plugin + skill) in-project that exposes stable, versioned calls for:
- signed pet command requests
- bounded status/context reads
- bounded memory-sync intents through the guarded app lane

### `12e` Rough Intent
Add guided local-first pairing/connectivity UX so non-technical operators can complete:
- shared secret setup
- handshake verification
- degraded/recovery troubleshooting
- reconnect flow visibility

### Likely Public Interfaces / Touchpoints
- Dialog route handling in `main.js`
- Bridge request envelope for freeform dialog
- New shell action such as `open-dialog`
- Runtime "chat hold" or "conversation presence" policy
- Guarded pet-command request contract from bridge/skill to app

### Rough Future Acceptance Scenarios
- Ask the pet a general question and get a real OpenClaw-backed answer, not only state-description behavior.
- Open chat from the tray and see the pet hold still until chat closes.
- Trigger a proactive conversation and confirm it feels like dialogue, not just a one-line announcement.
- Send a guarded pet-action request from OpenClaw and confirm the app either accepts with a visible result or rejects with a visible reason.

### Non-goals For Initial Planning
- No direct OpenClaw authority over state or rendering.
- No full agent-session UI parity with webchat.
- No bundling of OpenClaw.

## Family 13: Memory / Persona Continuity
### Family Goal
Make the pet remember basic identity and recent interaction highlights offline, and make online/offline personality feel like one coherent character.

### Problem Statement
The memory pipeline exists, but what is missing is runtime retrieval and visible continuity across both local offline behavior and OpenClaw online context:
- offline recall of pet identity
- offline recall of a few recent highlights
- personality-aware local replies and behavior
- bounded canonical-file context export so OpenClaw sees the same persona facts without direct file-write authority

### Proposed Slices
- `13a-offline-identity-and-recent-recall`
- `13b-derived-persona-snapshot-from-markdown`
- `13c-persona-aware-offline-dialog-and-proactive-behavior`
- `13d-online-reflection-and-runtime-sync`

### `13a` Rough Intent
Make the pet able to answer basic offline questions such as:
- what is your name
- when is your birthday
- what happened recently between us
- with deterministic responses derived from canonical files plus bounded recent highlights

### `13b` Rough Intent
Create a derived, read-only persona snapshot from canonical Markdown:
- `SOUL.md`
- `IDENTITY.md`
- `USER.md`
- accepted memory promotions where applicable
- and produce a bounded bridge context export package so online OpenClaw dialog sees consistent persona facts/provenance

### `13c` Rough Intent
Use the derived persona snapshot in deterministic local behavior:
- offline dialog tone
- proactive conversation style
- bounded personality-influenced reactions

### `13d` Rough Intent
Add online reflection/runtime sync with bounded cadence and governance:
- hourly heartbeat + nightly digest
- log-first persistence to existing daily markdown logs
- policy-lane application for online suggestions
- explicit conflict precedence when online context disagrees with local runtime

### Family 13 Tightened Sequencing
1. `13a`: local recall answers are correct and bounded.
2. `13b`: persona snapshot + provenance + bounded online context export are deterministic.
3. `13c`: proactive/offline behavior style uses the same snapshot with anti-spam pacing and suppression visibility.
4. `13d`: online sync/reflection applies via the same policy/governance lane with cadence + conflict handling.

### Family 13 File/Authority Boundary
- App owns canonical file reads and guarded memory writes.
- OpenClaw receives bounded derived context, not raw file-write authority.
- Any future sync lane must preserve "pet applies writes" governance from earlier memory deliverables.

### `13c` Addendum (Proactive Robustness, Brief)
- Add context gating before proactive prompts:
  - do not prompt while user is actively chatting, shortly after user input, or during recent proactive cooldown.
- Add adaptive pacing:
  - base cooldown plus exponential backoff when prompts are ignored/dismissed.
- Add anti-repeat memory:
  - avoid repeating near-duplicate proactive openers within a rolling time window.
- Add quiet windows:
  - optional local quiet-hours policy so proactive prompts are suppressed at configured times.
- Add lightweight observability:
  - expose last proactive reason, suppression reason, and next eligible time in Status/diagnostics.

### `13c` Iteration Candidate: Richer Offline Dialog
- Operator request: plan a follow-on `13c` iteration focused on richer offline dialog quality.
- Problem signal:
  - offline chat still falls back too often to generic unknown-response copy (`not in local memory yet`).
- Candidate scope (bounded):
  - deterministic offline QA expansion over canonical local context (`SOUL.md`, `STYLE.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`).
  - broader fact extraction + synonym intent mapping for common companion questions.
  - response framing that preserves persona style while preferring concrete local facts when available.
- Guardrails:
  - keep deterministic behavior (no probabilistic generation path for offline fallback).
  - no raw file dumps or secret/config leakage.
  - preserve existing authority boundary (app-owned local reads, bounded derived outputs only).
- Success signals for this iteration discussion:
  - fewer generic unknown offline replies for questions answerable from local canonical files.
  - explicit observability of matched local-fact source vs unknown-fallback path.

### Likely Public Interfaces / Touchpoints
- Runtime read-model for canonical Markdown identity/persona files
- Derived persona snapshot format with provenance
- Offline dialog template/context enrichment
- Recent-highlight retrieval policy from memory artifacts

### Rough Future Acceptance Scenarios
- Ask offline for the pet's name and birthday; receive correct answers from canonical files.
- Ask offline about recent interactions; get a short bounded summary from recent highlights.
- Compare online and offline greetings and confirm they feel stylistically aligned.
- Inspect diagnostics/provenance and confirm where a persona field came from.

### Non-goals For Initial Planning
- No editable structured-trait canon.
- No direct bypass around Markdown governance.
- No unbounded local-brain simulation.

## Family 14: Embodiment / Autonomy
### Family Goal
Make the pet feel physically believable, unobtrusive, and more context-aware in its movement and reactions.

### Problem Statement
The roam runtime works, but behavior policy still feels too repetitive and insufficiently intentional.

### Family 14 Control Model (Locked)
- Top-level state selection: `Utility scoring`.
- State authority and transition legality: `FSM arbitration` (cooldowns, min-hold, lockouts, recovery).
- In-state sequencing only: `Per-state micro behavior trees`.
- Core stat authority: deterministic `events + time` only.
- Online AI influence: `intent suggestions only` (mapped into normal events), no direct stat writes.

### Family 14 Animation Contract (Locked)
- Every new family-14 runtime state must ship bespoke directional sprite-sheet coverage before enablement.
- Missing required state art fails validation and keeps that state degraded/disabled with explicit diagnostics.
- Existing movement invariants and main-process movement authority remain unchanged.

### Proposed Slices
- `14a-deliberate-roam-policy-and-monitor-avoidance`
- `14ab-active-window-avoidance`
- `14b-event-driven-watch-behavior`
- `14c-touch-and-gaze-reactions`
- `14d-mouse-tag-game`

### `14a` Tightened First-Slice Focus
- Keep main-process movement authority unchanged.
- Add deterministic roam pacing + bounded monitor-avoidance memory with explicit cooldown/expiry.
- Expose enough status signals to debug why the pet is avoiding or re-entering a monitor zone.

### `14a` Rough Intent
Improve roam behavior so the pet:
- rests more naturally
- changes states less mechanically
- stays unobtrusive unless something attracts it
- temporarily avoids monitors or zones the user pushes it away from

### `14ab` Tightened First-Slice Focus
- active foreground window only
- rectangular avoid mask + margin
- deterministic fallback when no free roam area
- explicit observability/degraded reasons
- only after stability, add playful `window-edge inspect` states

### `14ab` Rough Intent
Add a narrow window-aware roam layer so the pet avoids the currently focused work window on a monitor without stalling movement, while exposing deterministic reason codes when detection is unavailable or no free roam area remains.

### `14b` Rough Intent
Expand event-driven embodiment so media playback can drive more than music states:
- watching movies
- watching YouTube
- passive co-viewing behaviors

### `14c` Rough Intent
Add direct pet interactions:
- head pat
- belly rub
- stronger gaze/head-follow reactions

### `14d` Rough Intent
Add a reversible mouse-pointer tag game:
- pet flees the cursor
- if caught, pet chases the cursor
- game ends naturally when distance/escape conditions are met

### Likely Public Interfaces / Touchpoints
- Roam policy/timing logic in `main.js`
- State/runtime rules for watch and interaction-driven behaviors
- Pointer proximity / touch interaction handling
- Renderer reaction hooks and state overlays
- Short-term aversion or environment-memory policy

### Rough Future Acceptance Scenarios
- Drag or fling the pet off a work monitor and confirm it avoids returning there for a bounded period.
- Start a movie or browser video and confirm the pet enters a watch-like behavior instead of generic roam.
- Stroke/pat the pet and confirm a visible reaction without breaking drag invariants.
- Start the tag game and confirm chase/flee reverses cleanly without destabilizing the pet window.

### Non-goals For Initial Planning
- No deep reinforcement-learning system.
- No webcam-based eye tracking.
- No rewrite of main-process movement authority.

## Family 15: Extension Showcase
### Family Goal
Prove that the extension system is not just scaffolded, but genuinely useful and pleasant to use.

### Problem Statement
The extension framework exists and was validated, but it still needs a strong visible showcase.

### Proposed Slices
- `15a-hero-extension-showcase-pack`
- `15b-extension-authoring-and-debug-visibility`
- `15c-extension-context-and-bridge-polish`

### `15a` Tightened First-Slice Focus
- Ship one opinionated "hero" pack with visible value on day one.
- Validate trust warning/enable/disable lifecycle in one operator demo script.
- Treat extension failures as degradable and observable, never crash paths.

### `15a` Rough Intent
Add one "hero" extension that clearly demonstrates:
- discovery
- trust warning / enable flow
- visible new behavior or prop interaction
- graceful disable path

### `15b` Rough Intent
Improve author/operator visibility so extension behavior is easier to inspect, test, and explain.

### `15c` Rough Intent
Polish how extension context is surfaced to dialog/bridge behavior without giving extensions authority over core state.

### Likely Public Interfaces / Touchpoints
- Extension manifest/schema additions if needed
- Extension debug or observability surface
- Sample pack assets and authoring docs
- Extension-to-dialog context plumbing

### Rough Future Acceptance Scenarios
- Install or enable one showcase extension and immediately see a new, meaningful pet behavior.
- Disable the extension and confirm the app returns cleanly to baseline behavior.
- Ask the pet about extension-related context and confirm online/offline handling remains coherent.
- Verify extension state appears in the observability/debug surfaces.

### Non-goals For Initial Planning
- No extension marketplace.
- No remote pack distribution.
- No extension authority over movement/state arbitration.

## Important Planned Interface Additions
These are roadmap placeholders, not final contracts.

### Planned for Family 11
- Observability surface entrypoint from shell/tray/dev fallback.
- Status payload covering bridge, provider/model, memory mode, canonical file health, fallback mode, and configured roots.
- File/provenance detail view for health rows.
- GUI settings editor slice for advanced operator controls (service toggles, selected env/runtime overrides, sizing controls) with explicit persistence/provenance rules.

### Planned for Family 12
- Shell action for opening chat.
- Explicit "dialog open" locomotion policy.
- Guarded bridge/skill command envelope for pet-action requests.
- OpenClaw skill/API caller ingress contract for signed `pet_command_request` payloads.
- Separable plugin+skill integration package boundary for future extraction.
- Guided local-first pairing and command-lane diagnostics.

### Planned for Family 13
- Read-model over canonical Markdown identity/persona files.
- Derived persona snapshot format with provenance fields.
- Recent-highlight retrieval contract for offline recall.
- Bounded online bridge context export derived from canonical files + recent highlights.
- Hourly heartbeat + nightly digest runtime sync lanes with explicit conflict handling.

### Planned for Family 14
- Behavior stat snapshot contract (`events + time` deterministic updates).
- Behavior decision trace contract (winner + suppressed candidates + gate reasons).
- Utility->FSM state selection contract plus per-state micro-BT sequencing.
- Foreground-window bounds provider contract and avoid-mask clipping semantics (queued `14ab`, Windows-first).
- Required bespoke sprite-sheet validation policy for every new family-14 state.

### Planned for Family 15
- One showcase extension contract and success criteria.
- Better extension observability/debug payloads.
- Clear extension-context enrichment boundaries.

## Resume Checklist For A New Session
1. Read `AGENTS.md`.
2. Read [`00-progress-tracker.md`](./00-progress-tracker.md).
3. Read [`10-local-brain-and-personality-feasibility.md`](./10-local-brain-and-personality-feasibility.md).
4. Use this roadmap rough-in to confirm the locked family order and assumptions.
5. Resume from tracker/AGENTS (`14a` is the active deliverable unless reprioritized).
6. Do not start coding on any slice until that slice passes `Spec Gate`.

## Test And Demo Anchors To Preserve
These are the minimum user-visible anchors we should remember when detailed planning resumes.

### Family 11
- One visible diagnostics/setup surface.
- Healthy, degraded, and recovery states are all demonstrable.
- Canonical file health is visible.

### Family 12
- Real freeform dialog with OpenClaw.
- Tray-open chat.
- Pet stays still while chat is open.
- Guarded OpenClaw-to-pet action requests.

### Family 13
- Offline recall of name and birthday.
- Offline recall of recent highlights.
- Persona-aligned offline tone.
- Provenance for persona data.

### Family 14
- Deliberate roaming and unobtrusive behavior.
- Temporary monitor avoidance after manual user correction.
- Foreground active-window avoidance with explicit fallback when free roam area is exhausted.
- Event-driven watching behavior.
- Interactive touch/game behavior.

### Family 15
- One polished extension that visibly changes the pet.
- Clean enable/disable lifecycle.
- Extension behavior is inspectable and demonstrable.

## Defaults Chosen
- `11` is the next detailed family.
- `12` is the next family after `11`.
- `13` follows `12`.
- `14` follows `13`.
- `15` follows `14`.
- `11a` is the accepted first post-v1 implementation target and baseline for family `11`.
- `11b` is the accepted setup/bootstrap baseline for family `11`.
- `11c` is accepted and closed.
- `11d-settings-editor-and-service-controls` is accepted and closed.
- `12a-real-openclaw-dialog-parity` is accepted and closed.
- `12b-chat-shell-and-conversation-presence` is accepted and closed.
- `12c-guarded-openclaw-pet-command-lane` is accepted and closed.
- `12d` and `12e` are accepted and closed after `12c` acceptance.
- `13a` through `13d` are accepted and closed.
- `14a-deliberate-roam-policy-and-monitor-avoidance` is the current detailed target (`specifying`, `Spec Gate` passed).
- `14ab-active-window-avoidance` is the next queued target after `14a`.
- Family `14` driver model is locked: utility scoring + FSM + per-state micro BT.
- Family `14` art policy is locked: all new family-14 states require bespoke directional sheets.
- `12` through `15` remain roadmap placeholders until slice-level deliverable files pass `Spec Gate`.
