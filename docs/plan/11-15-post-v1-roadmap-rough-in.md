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
- `11b` is the next likely slice if priority stays within family `11`.
- `12` through `15` are intentionally rough placeholders and are not implementation-ready yet.
- All future work follows the post-v1 workflow in [`00-development-workflow.md`](./00-development-workflow.md).

## Locked Assumptions
- `11a` is observability-first.
- Markdown remains canonical for personality and identity.
- Future guided setup writes synchronized canonical Markdown to both the pet-local workspace and the OpenClaw-facing workspace.
- Any OpenClaw-to-pet action lane uses guarded requests only; the app remains authoritative.
- Existing v1 deliverables remain historical records and are not retrofitted.

## Family Index
| Family | Theme | Why It Exists | Current Planning State |
| --- | --- | --- | --- |
| `11` | Observability / Setup / Provenance | Make the current OpenClaw, model, memory, and fallback setup visible and understandable inside the app. | `11a` accepted; `11b` next likely |
| `12` | Conversation / Bridge | Make pet chat feel like real OpenClaw conversation, not narrow status/introspection. | Rough only |
| `13` | Memory / Persona Continuity | Make online and offline feel like the same pet with recall and stable personality. | Rough only |
| `14` | Embodiment / Autonomy | Make the pet move and react more deliberately, unobtrusively, and believably. | Rough only |
| `15` | Extension Showcase | Prove the extension system with a real add-on and a polished end-to-end flow. | Rough only |

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
Add a guided Pet Setup flow that collects the minimum identity/profile inputs once and writes synchronized Markdown to:
- the pet-local workspace
- the OpenClaw-facing workspace

### `11b` Rough Demo Anchor
1. Open setup.
2. Enter pet name, birthday, and baseline identity/personality choices.
3. Confirm the app writes canonical Markdown to both configured targets.
4. Re-open the observability surface.
5. Confirm both targets now read healthy and synchronized.

### `11c` Rough Intent
Expose repair actions and provenance so the user can see why the system believes what it believes.

### `11c` Rough Demo Anchor
1. Open the observability surface.
2. Inspect a degraded row or persona/file-health row.
3. Open a "why" or "details" view.
4. Confirm the app shows the source path, reason, and suggested repair step.

## Family 12: Conversation / Bridge
### Family Goal
Make talking to the pet feel like talking to the OpenClaw agent, while preserving local authority and graceful fallback.

### Problem Statement
The current dialog surface exists, but the shipped behavior was primarily validated around:
- visible input/output
- state-aware fallback
- online/offline labels
- non-blocking bubble/talk feedback

It was not yet validated as full OpenClaw conversation parity.

### Proposed Slices
- `12a-real-openclaw-dialog-parity`
- `12b-chat-shell-and-conversation-presence`
- `12c-guarded-openclaw-pet-command-lane`

### `12a` Rough Intent
Route true freeform user messages through the bridge as real dialog, with visible source/fallback metadata and continuity similar to webchat or WhatsApp usage.

### `12b` Rough Intent
Improve the chat shell experience:
- tray/menu action to open the dialog
- pet stays still while the dialog is open
- proactive conversation starts feel intentional and bounded

### `12c` Rough Intent
Add an OpenClaw skill or bridge command lane that lets OpenClaw request pet behaviors, while the app validates and arbitrates them.

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
The memory pipeline exists, but what is missing is runtime retrieval and visible continuity:
- offline recall of pet identity
- offline recall of a few recent highlights
- personality-aware local replies and behavior

### Proposed Slices
- `13a-offline-identity-and-recent-recall`
- `13b-derived-persona-snapshot-from-markdown`
- `13c-persona-aware-offline-dialog-and-proactive-behavior`

### `13a` Rough Intent
Make the pet able to answer basic offline questions such as:
- what is your name
- when is your birthday
- what happened recently between us

### `13b` Rough Intent
Create a derived, read-only persona snapshot from canonical Markdown:
- `SOUL.md`
- `IDENTITY.md`
- `USER.md`
- accepted memory promotions where applicable

### `13c` Rough Intent
Use the derived persona snapshot in deterministic local behavior:
- offline dialog tone
- proactive conversation style
- bounded personality-influenced reactions

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

### Proposed Slices
- `14a-deliberate-roam-policy-and-monitor-avoidance`
- `14b-event-driven-watch-behavior`
- `14c-touch-and-gaze-reactions`
- `14d-mouse-tag-game`

### `14a` Rough Intent
Improve roam behavior so the pet:
- rests more naturally
- changes states less mechanically
- stays unobtrusive unless something attracts it
- temporarily avoids monitors or zones the user pushes it away from

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

### Planned for Family 12
- Shell action for opening chat.
- Explicit "dialog open" locomotion policy.
- Guarded bridge/skill command envelope for pet-action requests.

### Planned for Family 13
- Read-model over canonical Markdown identity/persona files.
- Derived persona snapshot format with provenance fields.
- Recent-highlight retrieval contract for offline recall.

### Planned for Family 14
- Roam-policy memory for short-term aversion.
- Event-driven watch-state trigger contract.
- Pointer/touch reaction event contract.

### Planned for Family 15
- One showcase extension contract and success criteria.
- Better extension observability/debug payloads.
- Clear extension-context enrichment boundaries.

## Resume Checklist For A New Session
1. Read `AGENTS.md`.
2. Read [`00-progress-tracker.md`](./00-progress-tracker.md).
3. Read [`10-local-brain-and-personality-feasibility.md`](./10-local-brain-and-personality-feasibility.md).
4. Use this roadmap rough-in to confirm the locked family order and assumptions.
5. Start detailed planning with `11b-guided-pet-setup-and-markdown-bootstrap` unless the user reprioritizes another slice.
6. Do not start coding until the chosen deliverable spec passes `Spec Gate`.

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
- `11b` is the next likely implementation target unless the user reprioritizes.
- `12` through `15` are roadmap placeholders only until future detailed planning sessions lock their slice-level specs.
