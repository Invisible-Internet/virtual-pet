# Deliverable 11a: OpenClaw Memory Observability Surface

**Deliverable ID:** `11a-openclaw-memory-observability-surface`  
**Status:** `accepted`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-04`  
**Depends On:** `04-openclaw-bridge-spec`, `05-memory-pipeline-and-obsidian-adapter`, `05a-obsidian-workspace-bootstrap-and-connectivity`, `07c-shell-settings-and-wardrobe-surface`, `10-local-brain-and-personality-feasibility`  
**Blocks:** `11b-guided-pet-setup-and-markdown-bootstrap`, `12a-real-openclaw-dialog-parity`, `13a-offline-identity-and-recent-recall`, `15b-extension-authoring-and-debug-visibility`  

## Objective
Extend the existing inventory popup into a shared tabbed shell window so the app can visibly explain its OpenClaw bridge state, provider/model identity, memory runtime mode, configured roots, and canonical Markdown file health without forcing the operator to inspect logs or the compact in-pet diagnostics overlay.

## In Scope
- Extend the existing inventory shell popup into one shared tabbed window.
- Keep the existing `Inventory` tray entry and add a new `Status` tray entry.
- One new dev fallback hotkey to open the shared window directly to the `Status` tab.
- One aggregated observability snapshot built from existing runtime state:
  - capability snapshot
  - runtime settings summary
  - memory snapshot
  - settings source/validation output
  - canonical Markdown file health checks
- Tab-routing behavior so tray/dev entrypoints can focus the shared shell window and land on the correct tab.
- Required visible rows for:
  - OpenClaw bridge
  - provider/model identity
  - memory runtime
  - canonical Markdown file health
  - configured paths and settings sources
  - validation warnings/errors
- Manual `Refresh` action so failure/recovery states are operator-testable without relying on automatic polling.
- Degraded labels and operator-readable reason text for unavailable or partially known data.

## Out of Scope
- Guided Pet Setup writing flows (`11b`).
- Repair actions beyond `Refresh` and passive status visibility (`11c`).
- Canonical personality editing UI.
- New model-hosting architecture or bridge ownership changes.
- Full provenance drill-down for every identity/persona field.
- Runtime behavior changes outside the observability surface itself.

## Environment / Prerequisites
- Windows dev runtime via `npm start`.
- Existing tray shell surface from D07c, with dev fallback available if tray support is missing.
- Existing runtime settings stack from `config/settings.json`, optional local override, and environment overrides.
- Existing OpenClaw bridge configuration and memory pipeline runtime.
- Healthy-path verification assumes:
  - OpenClaw is enabled and reachable through the configured transport, and
  - configured workspace roots point at readable directories.
- Degraded-path verification may use either:
  - `PET_FORCE_OPENCLAW_FAIL=1`, or
  - an intentionally invalid `paths.openClawWorkspaceRoot` / `paths.obsidianVaultRoot` in the local override layer.

## Showcase Promise (Mandatory)
The operator can open the existing shell GUI from either `Inventory` or `Status`, land on the correct tab in the same shared window, and immediately tell whether the pet is healthy, degraded, or in fallback by reading explicit rows for OpenClaw bridge state, provider/model identity, memory runtime mode, configured roots, and canonical Markdown file health.

## Operator Demo Script (Mandatory)
1. Start the app in a normal dev run with the current local OpenClaw path configured and the pet fully loaded.
2. Open `Inventory` from the tray menu and confirm the existing shell GUI opens on the `Inventory` tab, preserving the current inventory appearance and controls.
3. With that window still open, use the tray `Status` entry. Confirm the same window is focused and switched to the `Status` tab instead of creating a second popup.
4. If tray support is unavailable, use dev fallback hotkey `F10` and confirm it opens the same shared window directly to the `Status` tab.
5. Confirm the `Status` tab is a full shell surface, not the tiny in-pet diagnostics overlay, and that it shows all required rows:
   - `OpenClaw Bridge`
   - `Provider / Model`
   - `Memory Runtime`
   - `Canonical Files`
   - `Paths / Sources`
   - `Validation`
6. Confirm each required row shows:
   - a visible state pill (`healthy`, `degraded`, `failed`, `disabled`, or `unknown`)
   - one short reason/status line
   - non-empty summary data instead of raw JSON blobs
7. Click `Refresh` and confirm the values re-read from runtime state without reopening the app.
8. Confirm `Canonical Files` visibly reports the presence or absence of `SOUL.md`, `IDENTITY.md`, `USER.md`, and `MEMORY.md` for:
   - the pet-local workspace, and
   - the OpenClaw workspace when configured
9. Confirm `Paths / Sources` visibly reports:
   - local workspace root
   - OpenClaw workspace root
   - Obsidian vault root
   - which config layers are active (`base`, `local` or packaged override, and env if present)
10. Confirm `Validation` visibly reports whether settings warnings/errors are present, even if the count is zero.

## Failure / Recovery Script (Mandatory)
1. Start the app with a deterministic degraded condition:
   - either `PET_FORCE_OPENCLAW_FAIL=1`, or
   - an invalid local override path such as a missing `paths.openClawWorkspaceRoot`.
2. Open `Status` from the tray or use `F10` so the shared shell window lands on the `Status` tab, then click `Refresh`.
3. Confirm the affected row becomes visibly degraded or failed:
   - bridge failure must change `OpenClaw Bridge`
   - invalid workspace path must change `Canonical Files`, `Paths / Sources`, or `Validation`
4. Confirm the surface still renders all rows and does not collapse into a blank or console-only failure mode.
5. Remove the forced failure or restore the path to a valid location.
6. Click `Refresh` again.
7. Confirm the affected row recovers to healthy or to a less severe state if partial recovery is all that is possible.

## Public Interfaces / Touchpoints
- New deliverable file: `docs/plan/11a-openclaw-memory-observability-surface.md`
- Existing shell action remains:
  - `openInventory`
- New shell action:
  - `openStatus`
- Tray item labels:
  - `Inventory...`
  - `Status...`
- New dev fallback hotkey:
  - `F10`
- Existing shared shell window files to extend:
  - `inventory.html`
  - `inventory-preload.js`
  - `inventory-shell-renderer.js`
- New main-process snapshot builder:
  - `buildObservabilitySnapshot()`
- New IPC:
  - `pet:getObservabilitySnapshot`
- Optional event channel if live refresh is later needed:
  - `pet:observability`
- `buildShellStateSnapshot()` extension:
  - extend `inventoryUi` with `activeTab`
  - extend `devFallback.hotkeys` to include `F10`
- Existing runtime sources to consume:
  - capability snapshot from `capabilityRegistry`
  - memory snapshot from `memoryPipeline`
  - runtime settings summary / resolved paths / source map / validation arrays
  - bridge settings and startup state
  - canonical file checks for `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`

## Snapshot Contract
`11a` introduces one aggregated read-model for the operator surface.

Required shape:

```js
{
  kind: "observabilitySnapshot",
  ts: 0,
  overview: {
    runtimeState: "healthy|degraded|failed|unknown",
    fallbackMode: "none|string",
    trayAvailable: true,
    source: "runtime"
  },
  rows: {
    bridge: {
      state: "healthy|degraded|failed|disabled|unknown",
      reason: "string",
      transport: "stub|http",
      mode: "online|offline|timeout",
      endpoint: "string|null",
      endpointClass: "loopback|non-loopback|stub",
      authConfigured: true
    },
    provider: {
      state: "healthy|degraded|failed|unknown",
      reason: "string",
      providerLabel: "string|null",
      modelLabel: "string|null",
      source: "probe|bridge|settings|unknown",
      lastUpdatedTs: 0
    },
    memory: {
      state: "healthy|degraded|disabled|unknown",
      reason: "string",
      requestedAdapterMode: "local|obsidian|disabled|unknown",
      activeAdapterMode: "local|obsidian|disabled|unknown",
      fallbackReason: "string",
      writeLegacyJsonl: false
    },
    canonicalFiles: {
      localWorkspace: {
        root: "string|null",
        files: [
          { fileId: "SOUL.md", present: true, readable: true, path: "string|null" }
        ]
      },
      openClawWorkspace: {
        configured: true,
        root: "string|null",
        files: [
          { fileId: "SOUL.md", present: true, readable: true, path: "string|null" }
        ]
      }
    },
    paths: {
      localWorkspaceRoot: "string|null",
      openClawWorkspaceRoot: "string|null",
      obsidianVaultRoot: "string|null",
      resolvedPaths: {},
      settingsFiles: {},
      sourceMap: {}
    },
    validation: {
      warningCount: 0,
      errorCount: 0,
      warnings: [],
      errors: []
    }
  }
}
```

Rules:
- Required rows must always render, even when the underlying data is missing.
- Missing/unknown data must render as an explicit degraded/unknown row, not disappear.
- `Provider / Model` may render `unknown` if bridge/probe data is unavailable, but the row must still exist with a reason such as `provider_identity_unavailable`.
- `Canonical Files` must distinguish:
  - root not configured
  - root missing
  - file missing
  - file unreadable
  - file present/readable

## Surface Design Contract
- Use the existing always-on-top shell popup window from D07c as a shared tabbed container rather than opening a second popup.
- Do not overload the tiny in-pet diagnostics overlay with this feature.
- Required top-level tabs for this slice:
  - `Inventory`
  - `Status`
- Routing rules:
  - tray `Inventory...` opens or focuses the shared window on the `Inventory` tab
  - tray `Status...` opens or focuses the shared window on the `Status` tab
  - dev fallback `F10` opens or focuses the shared window on the `Status` tab
  - opening one tab must not spawn a duplicate second window if the shared shell window already exists
- `Inventory` tab must remain recognizably the existing D07c inventory surface.
- `Status` tab owns the `11a` observability content.
- Header controls for the shared shell window must include:
  - tab strip or equivalent tab selector
  - `Refresh` control when the `Status` tab is active
  - `Close`
- Required `Status` tab sections:
  - overview summary pills
  - runtime health rows
  - paths and source rows
  - validation summary
- Each row must provide:
  - label
  - state pill
  - short status reason
  - one or more key/value lines relevant to that row
- This slice does not require expandable deep provenance panels; that is reserved for `11c`.

## Acceptance Bar
- Accepted for `Spec Gate` only when the shared-window tab model, entrypoints, row set, snapshot contract, demo script, and failure/recovery script are explicit enough that implementation does not need to invent UX or data boundaries.
- Accepted for final operator closure only when:
  - tray `Inventory...` and `Status...` entrypoints both work
  - `F10` fallback works when tray is unavailable
  - both entrypoints focus the same shared shell window and land on the correct tab
  - all required rows are visible
  - degraded and recovery states are visible after `Refresh`
  - canonical file health is visible for local and OpenClaw workspaces
- Not acceptable if:
  - the feature opens a second competing popup instead of reusing the shared shell window
  - the feature only extends the compact renderer overlay
  - the operator must inspect console logs or raw JSON to understand status
  - provider/model identity silently disappears when unavailable
  - failure and recovery cannot be demonstrated by an operator

## Implementation Slice (Mandatory)
- Implemented first slice for `Build Gate`:
  - extended the existing inventory shell window into a shared tabbed `Inventory` / `Status` popup
  - added tray `Status...`, renderer dev fallback `F10`, and main-process tab routing into the shared shell window
  - added a reusable `shell-observability.js` builder plus `pet:getObservabilitySnapshot`
  - rendered the six required rows in the `Status` tab with visible state pills and a manual `Refresh` button
  - populated the snapshot from capability, settings, memory, validation, and canonical file-check sources
- Targeted checks to add or update:
  - added `scripts/check-shell-observability.js` to cover healthy/degraded snapshot rows plus `openInventory` / `openStatus` tab routing
  - extended `npm run check:acceptance` with smoke row `D11a-shell-observability`
  - kept `npm run check:syntax` green after the shell-window, preload, and renderer changes

## Visible App Outcome
- After implementation, the operator will have one shared shell window with separate `Inventory` and `Status` tabs.
- The `Status` tab will explain the app's current OpenClaw, memory, path, and canonical-file state in one place.
- This surface will replace guesswork and log-hunting as the primary way to understand why the pet is healthy, degraded, or running with fallback behavior.

## Acceptance Notes
- Automated build checks passed on `2026-03-04`:
  - `npm run check:syntax`
  - `node scripts/check-shell-observability.js`
  - `npm run check:acceptance` -> `14/14 automated checks passed`
- Operator-visible demo passed on `2026-03-04`:
  - tray `Inventory...` opened the shared shell window on `Inventory`
  - tray `Status...` focused the same shared shell window on `Status`
  - dev fallback `F10` opened the same shared shell window on `Status`
  - `Refresh` re-read the snapshot without reopening the app
- Operator-visible failure/recovery pass confirmed on `2026-03-04`:
  - degraded rows remained visible instead of collapsing
  - affected rows recovered after restoring the healthy condition and using `Refresh`

## Iteration Log
- `2026-03-03`: Initial spec created from the post-v1 deliverable template and grounded against the existing shell, bridge, settings, and memory runtime code.
- `2026-03-03`: Refined the surface contract so `11a` extends the existing inventory window into a shared tabbed shell window; tray `Inventory...` and `Status...` now target different tabs in the same popup instead of creating a separate observability window.
- `2026-03-04`: Implemented the first `11a` runtime slice: shared shell tab routing, tray `Status...`, `F10` fallback, aggregated observability snapshot builder, status-tab UI rows, and deterministic smoke coverage.
- `2026-03-04`: Renamed the shared-shell operator label from `Settings` to `Status` across the tray entry, tab label, fallback wording, and active planning docs while keeping the same `11a` scope and behavior.
- `2026-03-04`: Operator ran the shared-shell demo and degraded/recovery checks; the `Inventory`/`Status` routing, `F10` fallback, and `Refresh`-driven status recovery all passed, closing `11a`.

## Gate Status
- `Spec Gate`: `passed`
- `Build Gate`: `passed`
- `Acceptance Gate`: `passed`
- `Overall`: `accepted`

## Change Log
- `2026-03-03`: File created from the post-v1 deliverable template.
- `2026-03-03`: Locked the first `11a` operator surface contract and aggregated observability snapshot.
- `2026-03-03`: Replaced the dedicated observability-popup approach with a shared tabbed shell-window model: tray `Inventory...` and `Status...` plus `F10` all route into the same popup, with `Status` owning the `11a` observability rows.
- `2026-03-04`: Implemented the first build slice with shared shell tabs, a refreshable `Status` tab, main-process observability snapshot IPC, deterministic observability checks, and a new D11a smoke row in the acceptance runner.
- `2026-03-04`: Renamed the user-facing `Settings` label to `Status` in the tray menu, shared shell tab, fallback wording, and active workflow docs.
- `2026-03-04`: Closed `11a` as accepted after operator-confirmed `Inventory` / `Status` tray routing, `F10` fallback behavior, and degraded/recovery verification.
