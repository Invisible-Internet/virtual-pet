# Deliverable 02b: Extension Framework and Pack SDK

**Deliverable ID:** `02b-extension-framework-and-pack-sdk`  
**Status:** `done`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `02-architecture-capability-registry`, `09-decisions-log`  
**Blocks:** `03-pet-core-events-intents-suggestions`, `04-openclaw-bridge-spec`, `07-state-system-extension-guide`, `08-test-and-acceptance-matrix`  
**Verification Gate:** `Extension framework contracts are fully specified and at least one extension pack lifecycle + prop/arbitration slice is implemented with visible runtime behavior`

## Objective
Define the v1 extension framework so contributors can add offline-first props, behaviors, and custom state packs, with optional OpenClaw context enrichment when online.

## In Scope
- Hybrid pack model:
  - Declarative manifests as baseline.
  - Optional trusted hook modules for advanced logic.
- Folder-based extension discovery:
  - Dev path: repo-local `extensions/`.
  - Installed path: per-user app-data extensions folder.
- Extension manifest schema (`extension.manifest.json`) including:
  - identity/version fields.
  - capabilities and permissions.
  - optional hooks, props, state packs, context providers.
- Prop world model:
  - True desktop anchors via global screen coordinates (Windows-first).
  - Menu spawn + drag/drop placement flow.
- Core-authoritative arbitration model for extension-origin actions.
- Hook execution model (trusted local mode), extension storage model, and compatibility policy.
- Offline/online context contract:
  - local fallback behavior when OpenClaw is unavailable.
  - read-only state/context enrichment when OpenClaw is available.

## Out of Scope
- Remote extension marketplace/distribution.
- Signed package infrastructure.
- Cross-platform parity guarantee in v1 beyond Windows-first.

## Dependencies
- Capability ownership and degraded behavior model from D02.
- Architecture decisions in [`09-decisions-log.md`](./09-decisions-log.md).

## Decisions Locked
- Pet core remains authoritative for state/motion arbitration.
- Extension packs are offline-first; OpenClaw integration is context enrichment only.
- Author-installed local packs are trusted by default with warning + explicit enable/disable controls.
- Compatibility policy is best-effort with visible warnings.
- Canvas runtime baseline is retained.

## Implementation Breakdown
1. Define extension package lifecycle (`discover -> validate -> warn -> enable/disable -> unload`).
2. Define manifest schemas:
   - extension identity/version/capability/permission fields.
   - prop definitions.
   - state pack definitions (`simple` and `complex`).
   - optional hook and context provider contracts.
3. Define runtime service contracts:
   - `extensionRegistry`
   - `permissionManager`
   - `propWorld`
   - `behaviorArbitrator`
   - `extensionHookHost`
   - `extensionStore`
4. Define trust, warning, and permission visibility model.
5. Define compatibility checks (`apiVersion`, min/max app version) and warning behavior.
6. Define desktop prop world model and multi-monitor anchor behavior.
7. Define arbitration priority insertion rules for extension-origin actions.
8. Define context bridge payload model for introspection/dialog/OpenClaw:
   - `currentState`
   - bounded state/prop context summaries
   - offline fallback behavior.
9. Define authoring templates for v1 reference packs:
   - `FoodChase`
   - `Reading`
   - `PoolPlay`

## Verification Gate
Pass when all are true:
1. Pack model, schema, and lifecycle are explicit and versioned.
2. Permission/trust model is explicit with warning + toggle behavior.
3. Prop world model is deterministic for desktop anchors and monitor boundaries.
4. Arbitration model preserves core authority and conflict resolution rules.
5. Hook model and storage boundaries are explicit.
6. Online/offline context flow is fully specified and non-blocking.
7. Reference examples (`FoodChase`, `Reading`, `PoolPlay`) map to framework contracts end-to-end.
8. A minimal extension runtime slice is implemented (discover/validate/enable path with non-fatal failure behavior).
9. At least one prop interaction path is visibly demonstrable in app runtime.

## Tangible Acceptance Test (Doc-Level)
1. Reviewer can validate one valid and one invalid extension manifest path with non-fatal outcomes.
2. Reviewer can trace `spawn -> place -> interact -> arbitration -> pet response` for a prop example.
3. Reviewer can trace one online and one offline state-aware dialogue path using extension context.
4. Reviewer can validate conflict resolution for two simultaneous extension-origin behavior requests.
5. Reviewer can validate example pack templates for `FoodChase`, `Reading`, and `PoolPlay`.

## Implementation Slice (Mandatory)
- Implement extension discovery/validation scaffold for local `extensions/` path.
- Implement manifest validity handling with warning + skip (non-fatal).
- Implement one simple prop registration and interaction routing path to core intent/arbitration.
- Implement one permission warning/toggle flow (can be config/console-backed in first slice).

## Visible App Outcome
- App discovers at least one test extension pack and logs status.
- Invalid extension pack does not crash app and appears as skipped/warned.
- One prop interaction triggers a visible pet reaction or logged state-intent transition.

## Implementation Verification (Manual)
1. Add one valid test pack and one invalid test pack under `extensions/` and start app.
2. Confirm valid pack loads and invalid pack is skipped with explicit warning.
3. Trigger one prop interaction and confirm arbitration path + pet response is visible.
4. Disable the extension and confirm app returns to core-only behavior without failure.

## Gate Status
- `Doc Gate`: `passed`
- `Implementation Gate`: `passed`
- `Overall`: `done`

## Implementation Progress (This Session)
- [x] Added extension discovery/validation runtime scaffold: `extension-pack-registry.js`.
- [x] Added local `extensions/` discovery with valid/invalid manifest handling and warning+skip behavior.
- [x] Added one-time trust warning model on first enable action per extension.
- [x] Added extension IPC/runtime routes in `main.js`:
  - `pet:getExtensions`
  - `pet:setExtensionEnabled`
  - `pet:interactWithExtensionProp`
- [x] Added core-authoritative arbitration output for prop interaction requests (`decision=allow`, `authority=core`).
- [x] Added renderer/preload integration for extension snapshots/events and debug visibility.
- [x] Added keyboard-driven verification hooks in renderer:
  - `P`: trigger first available extension prop interaction.
  - `O`: toggle first valid extension enable/disable.
- [x] Added sample packs:
  - valid: `extensions/sample-foodchase/extension.manifest.json`
  - invalid: `extensions/sample-invalid/extension.manifest.json`
- [x] Added syntax-check coverage for new module in `package.json`.
- [x] Manual runtime verification for D02b slice completed with operator-provided logs.

## Working Draft (v0.1)
First implementation pass focuses on local extension discovery, validation, enable/disable toggles, and one prop interaction path routed through core arbitration.

## Manual Verification Evidence (2026-02-26)
1. Startup discovery run:
   - `discover discovered=2 valid=1 invalid=1 enabled=1`
   - Invalid manifest warning surfaced: `sample-invalid: missing extensionId; invalid prop id ...`
2. Prop interaction path:
   - Success case logged: `interaction extension=sample-foodchase prop=candy type=hotkey decision=allow`
3. Enable/disable and trust-warning flow:
   - Toggle logs show enabled counts flipping `1 -> 0 -> 1`.
   - First re-enable surfaced one-time trust warning:
     - `trust-warning sample-foodchase: Author-trusted extension enabled...`
4. Disabled extension interaction:
   - Logged failure path: `interaction failed ... error=extension_disabled`

## Verification Gate Status
- `Passed (2026-02-26): D02b contract and runtime slice were implemented and manually verified (valid/invalid pack handling, trust-warning toggle path, and core-arbitrated prop interaction flow).`

## Open Questions
- Whether to add zip-import installer workflow in post-v1 roadmap.

## Change Log
- `2026-02-26`: File created for extension framework and pack SDK scope.
- `2026-02-26`: Updated for `spec + implementation slice` workflow with mandatory implementation/visible outcome sections and dual-gate status.
- `2026-02-26`: Advanced to `in_progress`; implemented first runtime slice for extension discovery/validation, warning+skip invalid manifests, trust warning model, and core-arbitrated prop interaction path.
- `2026-02-26`: Added manual verification evidence from operator run; moved D02b to `done` with doc/implementation gates passed.
