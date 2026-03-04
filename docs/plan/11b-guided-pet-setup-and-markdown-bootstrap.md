# Deliverable 11b: Guided Pet Setup and Markdown Bootstrap

**Deliverable ID:** `11b-guided-pet-setup-and-markdown-bootstrap`  
**Status:** `accepted`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-04`  
**Depends On:** `05a-obsidian-workspace-bootstrap-and-connectivity`, `05-memory-pipeline-and-obsidian-adapter`, `07c-shell-settings-and-wardrobe-surface`, `11a-openclaw-memory-observability-surface`, `10-local-brain-and-personality-feasibility`  
**Blocks:** `11c-repair-actions-and-provenance-visibility`, `12a-real-openclaw-dialog-parity`, `13a-offline-identity-and-recent-recall`, `13b-derived-persona-snapshot-from-markdown`  

## Objective
Extend the shared shell window with an explicit `Setup` flow so the operator can enter the pet's minimum identity/profile information once, preview the exact Markdown that will be written, and explicitly bootstrap a project-standard canonical Markdown set for the pet-local workspace while surfacing the configured OpenClaw workspace as an observed/read-only companion target instead of a direct write target.

## In Scope
- Extend the shared shell window from `Inventory` / `Status` to `Inventory` / `Status` / `Setup`.
- Keep `Inventory...` and `Status...`, and add a new tray entry `Setup...`.
- Add one dev fallback hotkey to open the shared shell window directly to the `Setup` tab.
- Show a setup-target summary for:
  - local workspace root
  - OpenClaw workspace root
  - whether the local target is writable and whether the OpenClaw target is readable/observed in the current mode
- Collect the minimum setup fields:
  - pet name
  - birthday
  - companion/user display name
  - companion timezone
  - one persona preset
  - one optional starter note
- Preview the generated Markdown blocks before any write happens.
- Apply setup only through an explicit operator action.
- Create or update managed setup blocks inside:
  - `SOUL.md`
  - `STYLE.md`
  - `IDENTITY.md`
  - `USER.md`
  - `MEMORY.md`
- Optionally seed `HEARTBEAT.md` as an intentionally empty/comment-only file so proactive automation stays disabled until a later deliverable.
- Apply setup only to the pet-local workspace in `11b`.
- Keep the OpenClaw workspace read-only from the virtual-pet app's perspective in `11b`.
- Reuse the `11a` status surface as the operator-visible verification path after setup is applied.
- Lock file-by-file content boundaries based on official OpenClaw workspace guidance before implementation starts.

## Out of Scope
- Full freeform Markdown editing.
- Full persona authoring or structured-trait editing.
- Automatic writes on startup.
- Hidden background bootstrap of the OpenClaw workspace outside an explicit setup action.
- Any direct write from the virtual-pet app into the OpenClaw workspace.
- Deep merge/parsing of arbitrary existing Markdown beyond managed setup blocks.
- Editing `config/settings.json`, `settings.local.json`, or OpenClaw hook/config values from the GUI.
- Implementing OpenClaw hook/config mutation from the GUI so `STYLE.md` is injected automatically on every turn.

## Environment / Prerequisites
- Windows dev runtime via `npm start`.
- Shared shell window from D07c / `11a`.
- Existing runtime settings stack from `config/settings.json`, optional local override, and environment overrides.
- `11a` observability surface available for post-apply verification.
- Local workspace root must resolve to a writable directory.
- OpenClaw observation in `11b` requires:
  - `openclaw.enabled=true`
  - `paths.openClawWorkspaceRoot` configured
  - target root exists and is at least readable if status should show it as healthy
- This slice respects ADR-0015:
  - normal runtime remains non-destructive by default
  - `11b` writes only to the pet-local workspace from this explicit operator flow
- Official OpenClaw bootstrap injection uses a fixed file set. Nonstandard companion files require either:
  - a future custom hook/injection path, or
  - an explicit agent-read strategy directed by workspace instructions

## Research Basis
This spec pass is grounded against primary OpenClaw docs plus the user-provided style template:
- OpenClaw workspace file map and bootstrap file meanings:
  - https://docs.openclaw.ai/concepts/agent-workspace
- OpenClaw first-run bootstrap behavior:
  - https://docs.openclaw.ai/start/bootstrapping
- Official templates:
  - `SOUL.md`: https://docs.openclaw.ai/reference/templates/SOUL
  - `IDENTITY.md`: https://docs.openclaw.ai/reference/templates/IDENTITY
  - `USER.md`: https://docs.openclaw.ai/reference/templates/USER
  - `HEARTBEAT.md`: https://docs.openclaw.ai/reference/templates/HEARTBEAT
- Memory guidance:
  - https://docs.openclaw.ai/concepts/memory
- Workspace bootstrap injection behavior:
  - https://docs.openclaw.ai/concepts/system-prompt
- Hook behavior and `bootstrap-extra-files` limits:
  - https://docs.openclaw.ai/automation/hooks
- Voice/style structure seed:
  - `C:\Users\micma\Downloads\STYLE.template.md`

## OpenClaw File Standards (Research-Locked)
Official OpenClaw workspace standards treat these as the main built-in identity/context files:
- `SOUL.md`
  - persona, tone, boundaries
  - loaded every session
- `IDENTITY.md`
  - agent name, creature/form, vibe, emoji, avatar
  - created/updated during bootstrap
- `USER.md`
  - who the human is, how to address them, timezone, and evolving context
  - loaded every session
- `MEMORY.md`
  - curated long-term memory for durable facts, preferences, and decisions
  - officially optional in OpenClaw, but required by this project-standard bootstrap
- `HEARTBEAT.md`
  - optional tiny checklist for periodic heartbeat runs
  - keep it short; an effectively empty file skips heartbeat API calls
- `memory/YYYY-MM-DD.md`
  - append-only daily memory layer
  - read on demand and used for running context rather than curated durable facts

Important boundary:
- `STYLE.md` is not an official built-in injected workspace file in OpenClaw.
- OpenClaw's built-in `bootstrap-extra-files` hook can inject additional workspace bootstrap files from configured glob/path patterns during `agent:bootstrap`.
- Therefore `11b` treats `STYLE.md` as a first-class project-managed file that lives beside the official OpenClaw files, but it does not pretend OpenClaw will inject it automatically by default.
- Project direction for now:
  - keep `STYLE.md` single-sourced
  - do not duplicate its contents into `SOUL.md`
  - plan a later `bootstrap-extra-files` hook configuration or explicit-read strategy if we want OpenClaw to ingest `STYLE.md` directly every turn

## Workspace Topology
`11b` locks two parallel workspace targets.

### 1. Pet-local workspace root
Purpose:
- offline-safe canonical source for the virtual pet
- bootstrap target even when OpenClaw is unavailable
- future offline/runtime read target

Required project-managed files:
- `SOUL.md`
- `STYLE.md`
- `IDENTITY.md`
- `USER.md`
- `MEMORY.md`
- `HEARTBEAT.md` optional and empty/comment-only for now
- `memory/YYYY-MM-DD.md`

### 2. OpenClaw workspace root
Purpose:
- agent-facing observed workspace for status/verification context
- future ingestion/sync destination owned by later integration work, not by `11b`

Observed files of interest:
- `SOUL.md`
- `STYLE.md`
- `IDENTITY.md`
- `USER.md`
- `MEMORY.md`
- `HEARTBEAT.md`
- `memory/YYYY-MM-DD.md`

OpenClaw-owned files outside this slice may also exist there:
- `AGENTS.md`
- `TOOLS.md`
- `BOOTSTRAP.md`

### Sync Rule
- `11b` writes managed setup blocks only to the pet-local workspace.
- The configured OpenClaw workspace is observed/read-only from the app's perspective in this slice.
- After apply, the pet-local Markdown files become the canonical bootstrap artifacts for offline mode.
- Any future OpenClaw ingestion or sync path must consume those canonical local artifacts without requiring direct `11b` writes into the agent workspace.
- For offline mode, the pet reads the pet-local workspace only.

## Offline Required File Set
The virtual pet's offline mode should depend on this minimum local file set:
- `SOUL.md`
- `STYLE.md`
- `IDENTITY.md`
- `USER.md`
- `MEMORY.md`

Not required for initial offline behavior:
- `HEARTBEAT.md`
- `AGENTS.md`
- `TOOLS.md`
- `BOOTSTRAP.md`

Offline interpretation rule:
- `SOUL.md` = values, boundaries, personality core
- `STYLE.md` = voice, tone, phrasing, word-choice constraints
- `IDENTITY.md` = self facts
- `USER.md` = companion facts
- `MEMORY.md` = durable relationship and preference facts

## Showcase Promise (Mandatory)
The operator can open `Setup` in the same shared shell window, enter the pet's baseline identity once, preview the exact canonical Markdown that will be written, explicitly apply it to the pet-local workspace, and then immediately verify through `Status` that the local canonical files now exist and read healthy while the OpenClaw workspace remains visible as an observed/read-only context target.

## Operator Demo Script (Mandatory)
1. Start the app with a valid local workspace root and, optionally, a valid OpenClaw workspace root configured.
2. Open `Setup...` from the tray and confirm the existing shared shell window opens or focuses on the `Setup` tab instead of spawning a second popup.
3. If tray support is unavailable, use dev fallback hotkey `F11` and confirm it opens the same shared shell window directly to the `Setup` tab.
4. Confirm the `Setup` tab shows:
   - local target summary
   - OpenClaw target summary marked as observed/read-only
   - required input fields
   - persona preset selector
   - preview/apply controls
5. Enter a test profile:
   - pet name
   - birthday
   - companion name
   - companion timezone
   - persona preset
   - starter note
6. Press `Preview` and confirm the UI shows non-empty Markdown previews for:
   - `SOUL.md`
   - `STYLE.md`
   - `IDENTITY.md`
   - `USER.md`
   - `MEMORY.md`
7. If the UI offers `Seed HEARTBEAT.md`, confirm the preview explains that the seeded file stays effectively empty/comment-only so OpenClaw heartbeat calls remain skipped until later configuration.
8. Confirm the preview clearly states that only the local workspace will be written and that the OpenClaw workspace remains observed/read-only.
9. Press `Apply Setup` and confirm the success state lists the written local files and local target root.
10. Switch to `Status` in the same shared shell window and confirm `Canonical Files` now reports healthy/readable local files; if an OpenClaw root is configured, confirm its row remains informational rather than a required setup-write success condition.
11. Confirm the app did not create a second shell window or require restart to show the result.

## Failure / Recovery Script (Mandatory)
1. Start the app with a healthy local workspace and an OpenClaw workspace configured to an invalid or missing path.
2. Open `Setup...` from the tray or use `F11`.
3. Confirm the `Setup` tab still renders and clearly marks the OpenClaw target as degraded or unavailable.
4. Confirm write behavior follows the target policy:
   - local apply remains available as long as the local target is writable
   - OpenClaw degradation is visible but does not trigger a direct write attempt
5. Break the local workspace path and confirm apply becomes blocked with a local-target reason.
6. Fix the local path, then use `Reload Targets` or re-open `Setup`.
7. Confirm local apply becomes available again and the OpenClaw summary remains read-only/observed.

## Public Interfaces / Touchpoints
- New deliverable file: `docs/plan/11b-guided-pet-setup-and-markdown-bootstrap.md`
- Shared shell additions:
  - new tab: `Setup`
  - new tray entry: `Setup...`
  - new dev fallback hotkey: `F11`
- Existing shared shell files to extend:
  - `inventory.html`
  - `inventory-preload.js`
  - `inventory-shell-renderer.js`
- Main-process routing additions:
  - `openSetup`
  - shared shell active-tab routing must support `inventory`, `status`, and `setup`
- Planned helper module:
  - `setup-bootstrap.js`
- Planned IPC:
  - `pet:getSetupBootstrapSnapshot`
  - `pet:previewSetupBootstrap`
  - `pet:applySetupBootstrap`
- Existing runtime sources to consume:
  - `loadRuntimeSettings()`
  - `resolveWorkspacePaths()`
  - canonical file IDs and file-health expectations from `11a`
  - explicit bootstrap rules from `memory-pipeline.js`
- Content standards to follow:
  - official OpenClaw file meanings for `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, `HEARTBEAT.md`
  - user-provided `STYLE.template.md` as the basis for `STYLE.md`
- Companion preset draft:
  - `docs/plan/11b-preset-content-drafts.md`

## Setup Bootstrap Contract
`11b` introduces one explicit setup read/write flow for canonical Markdown bootstrap.

Required input fields:

```js
{
  petName: "string",
  birthday: "string",
  companionName: "string",
  companionTimezone: "string",
  personaPresetId: "gentle_companion|playful_friend|bookish_helper|bright_sidekick",
  starterNote: "string"
}
```

Optional advanced fields:

```js
{
  companionPronouns: "string",
  companionCallName: "string",
  creatureLabel: "string",
  signatureEmoji: "string",
  avatarPath: "string",
  seedHeartbeatFile: false
}
```

Required target summary shape:

```js
{
  kind: "setupBootstrapSnapshot",
  ts: 0,
  targets: {
    local: {
      state: "ready|failed|unknown",
      root: "string|null",
      writable: true,
      required: true,
      reason: "string"
    },
    openClaw: {
      state: "ready|degraded|disabled|missing_config",
      root: "string|null",
      readable: true,
      writable: false,
      configured: true,
      requiredForApply: false,
      observedOnly: true,
      reason: "string"
    }
  },
  applyMode: "local_only|blocked",
  formDefaults: {
    petName: "",
    birthday: "",
    companionName: "",
    companionTimezone: "",
    personaPresetId: "gentle_companion",
    starterNote: ""
  },
  presets: [
    { id: "gentle_companion", label: "Gentle Companion", summary: "Calm, warm, reassuring." }
  ]
}
```

Managed Markdown block rule:
- `11b` writes one managed setup block per canonical file.
- Use explicit markers so reruns replace only the managed block:

```md
<!-- virtual-pet:setup-bootstrap:start -->
...
<!-- virtual-pet:setup-bootstrap:end -->
```

- If the target file is missing, create it with a heading plus the managed setup block.
- If the target file exists and already has the managed setup block, replace only that block.
- If the target file exists and has no managed setup block, append the new block without deleting existing content.
- `11b` must not rewrite unrelated user-authored Markdown outside the managed block.

Required preset behavior:
- Presets are bootstrap helpers only, not canonical structured traits.
- Presets seed concise Markdown text for `SOUL.md`, `STYLE.md`, and `IDENTITY.md`.
- Final canonical source remains Markdown written to the target files, not the preset ID alone.

## Future Setup Composition Model
`11b` should define the model that future install/setup flows will use to reconstruct these files.

### Preset Layers
Presets should compose, not collapse into one giant opaque choice.

Recommended layers:
- `personaPreset`
  - values, temperament, relational posture
- `stylePreset`
  - voice, vocabulary, intensity, rhetorical habits
- `identityPreset`
  - creature/form defaults, vibe, emoji/avatar defaults
- `relationshipPreset`
  - how the pet addresses the user and frames companionship

### Guided Questions
Future setup/install should walk the operator through a small question set:
1. What is your pet's name?
2. What is your pet's birthday?
3. What kind of being is your pet?
4. Which core persona preset fits best?
5. Which voice/style preset fits best?
6. What should the pet call you?
7. What are your pronouns?
8. What timezone are you in?
9. Is there one short relationship note or starter memory the pet should keep?
10. Should setup seed the optional empty `HEARTBEAT.md` placeholder now, or leave it absent?

### Reconstruction Goal
The answers plus presets must be sufficient to regenerate:
- `SOUL.md`
- `STYLE.md`
- `IDENTITY.md`
- `USER.md`
- `MEMORY.md`
- optional empty/comment-only `HEARTBEAT.md`

## Managed File Set (11b)
Required file intent and boundaries:
- `SOUL.md`
  - official OpenClaw-native persona file
  - contains core truths, boundaries, vibe, continuity, and values
- `STYLE.md`
  - companion style-authoring file for richer voice/tone rules
  - includes preferred vocabulary, banned phrases, punctuation habits, anti-patterns, and examples
  - single source of truth for voice, tone, phrasing, and word-choice constraints
- `IDENTITY.md`
  - agent-facing profile: name, creature/form, vibe, emoji, avatar
  - birthday may be stored as an extra known-facts field inside the managed block
- `USER.md`
  - human-facing profile: name, preferred address, pronouns, timezone, notes/context
- `MEMORY.md`
  - curated long-term memory only
  - seeded lightly with stable setup facts and an initial relationship note, not a full transcript dump
- `HEARTBEAT.md` (optional)
  - if seeded by `11b`, it must remain effectively empty/comment-only
  - future proactive routines belong in a later deliverable, not in the `11b` bootstrap payload

### Template Strategy
`11b` should generate complete starter content using OpenClaw-first boundaries while keeping style single-sourced:
- `SOUL.md`
  - use the official OpenClaw spirit: helpful, opinionated, bounded, non-sycophantic
  - do not duplicate the full style guide here
- `STYLE.md`
  - use the provided style-template structure:
    - `Voice Principles`
    - `Vocabulary`
    - `Punctuation & Formatting`
    - `Platform Differences` (optional)
    - `Quick Reactions`
    - `Rhetorical Moves`
    - `Anti-Patterns`
    - `Examples of Right Voice`
- `IDENTITY.md`
  - preserve the official OpenClaw fields first:
    - `Name`
    - `Creature`
    - `Vibe`
    - `Emoji`
    - `Avatar`
  - append pet-specific known facts in the managed block as needed
- `USER.md`
  - preserve the official OpenClaw fields first:
    - `Name`
    - `What to call them`
    - `Pronouns`
    - `Timezone`
    - `Notes`
  - add a lightweight context paragraph only, not a dossier
- `MEMORY.md`
  - keep the initial bootstrap content small
  - seed only durable setup facts, preferences explicitly chosen during setup, and one brief relationship baseline

### STYLE.md Rule
`STYLE.md` is a required project-managed file in both workspaces.
- It is the single source of truth for voice, tone, phrasing, banned words, and rhetorical habits.
- `11b` must not duplicate its style content into `SOUL.md`.
- Because OpenClaw does not document `STYLE.md` as a default injected file, `11b` must clearly label this as an integration gap to be solved later by:
  - a `bootstrap-extra-files` hook configuration, or
  - an explicit workspace/read strategy
- `11b` itself only bootstraps the file; it does not implement that OpenClaw injection path.

### HEARTBEAT.md Rule
`11b` must not fill `HEARTBEAT.md` with active automation tasks.
- If the operator chooses to seed it, use only a header/comment placeholder such as:

```md
# HEARTBEAT

<!-- Intentionally empty for now. Add tiny periodic tasks later when proactive routines are designed. -->
```

- This keeps the file effectively empty so OpenClaw skips heartbeat API calls until later work explicitly enables them.

## Surface Design Contract
- `11b` must reuse the existing shared shell window from `11a`; no second setup popup.
- Required top-level tabs after `11b`:
  - `Inventory`
  - `Status`
  - `Setup`
- Routing rules:
  - tray `Inventory...` opens or focuses the shared shell window on `Inventory`
  - tray `Status...` opens or focuses the shared shell window on `Status`
  - tray `Setup...` opens or focuses the shared shell window on `Setup`
  - dev fallback `F11` opens or focuses the shared shell window on `Setup`
- `Setup` tab must provide:
  - target readiness summary
  - required input fields
  - optional advanced identity/user fields
  - preset selector
  - file-preview selector/cards for `SOUL.md`, `STYLE.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`
  - `Preview`
  - `Apply Setup`
  - `Reload Targets`
  - optional `Seed HEARTBEAT.md` toggle or equivalent explicit control
  - visible success/error result area
- `Apply Setup` behavior must be explicit:
  - never auto-run when the tab opens
  - never run from a preset click alone
- `Status` remains the verification surface for canonical-file health after setup completes.

## Acceptance Bar
- Accepted for `Spec Gate` only when the shared-window routing model, target policy, managed Markdown block rules, required inputs, preview/apply behavior, and failure/recovery rules are explicit enough that implementation does not need to invent ownership boundaries.
- Accepted for final operator closure only when:
  - `Setup...` tray entry and `F11` fallback both work
  - the same shared shell window is reused
  - preview is visible before any write
  - apply is explicit and operator-readable
  - local-write / observed-OpenClaw behavior is clear
  - local-vs-OpenClaw workspace topology is visible and understandable
  - the offline-required local file set is fully bootstrapped
  - `SOUL.md`, `STYLE.md`, `IDENTITY.md`, `USER.md`, and `MEMORY.md` previews all follow the locked content boundaries
  - configured OpenClaw target failures are visible and actionable without causing a direct write attempt
  - local canonical files become healthy in `Status` after a successful apply
- Not acceptable if:
  - setup opens a separate competing popup
  - setup silently writes files on load
  - setup rewrites arbitrary Markdown outside a managed block
  - setup hides local target eligibility or the OpenClaw read-only boundary
  - setup duplicates `STYLE.md` content into `SOUL.md`
  - setup claims `STYLE.md` is automatically injected by OpenClaw without an actual hook/integration path
  - setup attempts to write directly into the configured OpenClaw workspace
  - the operator cannot tell exactly what will be written before pressing apply

## Implementation Slice (Mandatory)
- First implementation slice is now shipped:
  - added `Setup...` tray routing, shared-shell `Setup` tab support, and `F11` dev fallback
  - extended the existing shell window so `Inventory`, `Status`, and `Setup` all reuse the same popup
  - added `setup-bootstrap.js` for target-policy resolution, preset metadata, managed-block preview generation, and explicit apply
  - added setup IPC endpoints:
    - `pet:getSetupBootstrapSnapshot`
    - `pet:previewSetupBootstrap`
    - `pet:applySetupBootstrap`
  - rendered the `Setup` tab with:
    - target readiness summary
    - required fields
    - advanced optional fields
    - frozen preset chooser
    - per-file preview tabs
    - explicit `Reload Targets`, `Preview`, and `Apply Setup` controls
  - implemented managed-block write rules for the pet-local `SOUL.md`, `STYLE.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, and optional empty/comment-only `HEARTBEAT.md`
  - extended the `11a` canonical file health row so `STYLE.md` is now part of shell verification coverage
- Targeted checks now shipped and passing:
  - `scripts/check-setup-bootstrap.js`
  - updated `scripts/check-shell-observability.js`
  - updated `npm run check:contracts`
  - updated `npm run check:acceptance` smoke row `D11b-setup-bootstrap`

## Visible App Outcome
- After implementation, the operator will have one clear place to initialize or re-bootstrap the pet's canonical identity docs.
- The app will stop relying on hidden bootstrap scripts or hand-edited Markdown for the baseline setup path.
- `11a` and `11b` together will make the setup state visible and operator-controlled:
  - `Setup` writes the baseline
  - `Status` verifies the result
- The pet-local workspace will become the offline-mode read source for personality and identity files.
- `11b` no longer assumes the virtual-pet app can mutate the OpenClaw workspace directly.

## Acceptance Notes
- Spec and first runtime slice both landed on `2026-03-04`.
- First runtime implementation slice now exists and automated checks are green.
- Operator feedback exposed one contract issue: the first build incorrectly attempted to write into the configured OpenClaw workspace and hit `EPERM` on a `\\\\wsl$\\...` root.
- Post-iteration automated verification re-passed after the local-only write fix:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance`
- Operator acceptance passed:
  - tray `Setup...` and fallback `F11` reused the shared shell window correctly
  - preview/apply completed successfully against the pet-local workspace
  - no direct OpenClaw workspace write attempt was observed in the runtime logs
  - `Status` verification remained coherent after apply
- This spec pass added OpenClaw-first file-content boundaries plus `STYLE.md` / `HEARTBEAT.md` rules before implementation.
- Preset starter content now lives in a companion draft with deterministic file skeletons and encoding-safe symbolic emoji defaults.
- The four starter voices have now been reviewed and tuned to sharpen bundle-to-bundle differentiation before implementation.
- The preset draft now includes quick-picker guidance and a freeze recommendation, so `11b` no longer needs more preset editorial work before runtime implementation starts.
- Current iteration rule:
  - `11b` writes only to the pet-local workspace
  - configured OpenClaw roots are status/observation targets only until a later ingestion/sync slice exists
- Closeout note:
  - the generated local bootstrap Markdown files are now intentionally ignored in the repo's `.gitignore`

## Iteration Log
- `2026-03-04`: Initial `11b` spec created and grounded against D05a path/bootstrap rules, D05 memory governance, D07c shared shell behavior, `11a` observability, and the current shell-window runtime.
- `2026-03-04`: Strengthened `11b` with official OpenClaw file standards research, locked local-vs-OpenClaw workspace topology, made `STYLE.md` single-sourced with no duplication into `SOUL.md`, and kept `HEARTBEAT.md` as an optional effectively empty seed until proactive automation gets its own slice.
- `2026-03-04`: Added a companion preset-content draft doc and corrected the future `STYLE.md` ingestion note to use OpenClaw's `bootstrap-extra-files` hook path instead of claiming basename-only limits.
- `2026-03-04`: Tightened the companion preset drafts with deterministic file skeletons, four concrete starter bundles, and ASCII-safe symbolic emoji defaults so implementation can render managed blocks without inventing content structure.
- `2026-03-04`: Reviewed and tuned the four starter voices so `gentle`, `playful`, `bookish`, and `bright` are easier to distinguish during setup preview and later runtime behavior.
- `2026-03-04`: Added quick-picker guidance and a freeze recommendation to the preset draft so `11b` can move into implementation without further preset expansion.
- `2026-03-04`: Shipped the first implementation slice: shared-shell `Setup` tab, tray/`F11` routing, deterministic preview/apply IPC, managed-block file writes, and automated `D11b` smoke coverage.
- `2026-03-04`: Operator demo exposed a direct-write failure against the configured OpenClaw workspace (`EPERM` on `\\\\wsl$\\...\\MEMORY.md`). Re-scoped `11b` so setup writes only to the pet-local workspace and treats the OpenClaw root as observed/read-only.
- `2026-03-04`: Re-ran `npm run check:syntax`, `npm run check:contracts`, and `npm run check:acceptance` after the local-only write fix; all passed and `Build Gate` remains passed while operator re-test is pending.
- `2026-03-04`: Operator re-test passed. The shared-shell `Setup` flow completed without `EPERM`, local-only bootstrap writes worked, and the OpenClaw workspace remained read-only from the pet app's perspective.

## Gate Status
- `Spec Gate`: `passed`
- `Build Gate`: `passed`
- `Acceptance Gate`: `passed`
- `Overall`: `accepted`

## Change Log
- `2026-03-04`: File created from the post-v1 deliverable template and expanded into a spec-passed shared-shell setup/bootstrap slice.
- `2026-03-04`: Added OpenClaw-first file-template rules for `SOUL.md`, `STYLE.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, and optional `HEARTBEAT.md`.
- `2026-03-04`: Linked `11b-preset-content-drafts.md` and corrected the future `STYLE.md` ingestion path to the documented `bootstrap-extra-files` hook.
- `2026-03-04`: Refined the preset-content draft into implementation-grade starter copy with stable file skeletons and symbolic emoji defaults.
- `2026-03-04`: Tuned the four starter voices to reduce overlap and make preset selection more legible.
- `2026-03-04`: Froze the first four starter bundles for implementation and added chooser guidance to the companion preset draft.
- `2026-03-04`: Implemented the first shared-shell `Setup` slice with preview/apply bootstrap flow and automated `D11b` smoke coverage.
- `2026-03-04`: Updated the `11b` contract after operator feedback so setup writes only to the pet-local workspace; the OpenClaw workspace is now explicitly observed/read-only for this slice.
- `2026-03-04`: Closed `11b` as accepted after operator-confirmed local-only setup writes, read-only OpenClaw observation, and coherent post-apply status verification.
