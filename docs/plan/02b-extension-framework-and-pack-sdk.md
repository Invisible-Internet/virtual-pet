# Deliverable 02b: Extension Framework and Pack SDK

**Deliverable ID:** `02b-extension-framework-and-pack-sdk`  
**Status:** `not_started`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `02-architecture-capability-registry`, `09-decisions-log`  
**Blocks:** `03-pet-core-events-intents-suggestions`, `04-openclaw-bridge-spec`, `07-state-system-extension-guide`, `08-test-and-acceptance-matrix`  
**Verification Gate:** `Extension framework contracts are fully specified for pack model, trust/permission policy, desktop prop world, arbitration, hook boundaries, and online/offline context flow with runnable examples`

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

## Tangible Acceptance Test (Doc-Level)
1. Reviewer can validate one valid and one invalid extension manifest path with non-fatal outcomes.
2. Reviewer can trace `spawn -> place -> interact -> arbitration -> pet response` for a prop example.
3. Reviewer can trace one online and one offline state-aware dialogue path using extension context.
4. Reviewer can validate conflict resolution for two simultaneous extension-origin behavior requests.
5. Reviewer can validate example pack templates for `FoodChase`, `Reading`, and `PoolPlay`.

## Open Questions
- Whether to add zip-import installer workflow in post-v1 roadmap.

## Change Log
- `2026-02-26`: File created for extension framework and pack SDK scope.
