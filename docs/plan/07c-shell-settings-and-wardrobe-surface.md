# Deliverable 07c: Shell, Settings, and Wardrobe Surface

**Deliverable ID:** `07c-shell-settings-and-wardrobe-surface`  
**Status:** `not_started`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-02`  
**Depends On:** `02-architecture-capability-registry`, `05a-obsidian-workspace-bootstrap-and-connectivity`, `07b-dialog-surface-and-minimal-offline-loop`  
**Blocks:** `08-test-and-acceptance-matrix`  
**Verification Gate:** `Tray/settings/wardrobe surface is visible, persists through the settings stack, and changes at least one runtime behavior without breaking movement invariants`

## Objective
Deliver the first real shell and settings surface promised by the roadmap without mixing that work into D07 or D07b.

## In Scope
- Tray/taskbar menu.
- Deterministic settings toggles for runtime controls.
- Minimal wardrobe/accessory control.
- Roam mode switching.
- Diagnostics visibility toggles.
- Durable settings integration through the existing settings stack.

## Out of Scope
- Full graphical settings window.
- Full costume authoring pipeline.
- Cross-platform shell parity beyond the current Windows-first roadmap.
- Deep profile or preference management.

## Dependencies
- D02 capability ownership boundaries.
- D05a settings/path model and persistence baseline.
- D07b dialog surface if shell affordances need to expose dialog visibility toggles.

## Decisions Locked
- Tray remains the primary shell contract for this slice.
- If tray support is unavailable in a dev environment, a dev-only hotkey fallback is acceptable for verification, but tray/menu remains the documented baseline.
- Settings remain config-first and must preserve the existing override order.

## Implementation Breakdown
1. Add a main-process tray/menu module.
2. Extend the tracked settings model with durable keys for:
   - `roaming.mode`
   - `roaming.zone`
   - `ui.diagnosticsEnabled`
   - `wardrobe.activeAccessories`
   - `dialog.alwaysShowBubble`
3. Expose runtime-safe menu actions for:
   - desktop roam
   - zone roam
   - diagnostics on/off
   - accessory toggle (`headphones` / `none`)
4. Reflect settings changes in runtime status output and renderer-visible state.
5. Add one dev-only verification fallback if tray interaction is unavailable during development.

## Verification Gate
Pass when all are true:
1. Tray/taskbar menu appears and changes at least one runtime behavior.
2. Settings changes persist through the existing settings stack.
3. One wardrobe/accessory toggle visibly changes the pet.
4. Roam mode changes are reflected in runtime status output.
5. Diagnostics toggle changes overlay visibility without requiring code edits.
6. Drag/fling and fixed-window invariants remain intact.

## Tangible Acceptance Test (Doc-Level)
1. Toggle roam mode from the tray and verify status output reflects the active mode.
2. Toggle headphones and verify visible accessory change.
3. Toggle diagnostics and verify overlay visibility changes without restart.
4. Confirm drag/fling still behaves the same after each shell interaction.
5. If using the dev-only fallback path, confirm it mirrors the same settings changes as the tray action.

## Public Interfaces
### Settings additions
- `roaming.mode`
- `roaming.zone`
- `ui.diagnosticsEnabled`
- `wardrobe.activeAccessories`
- `dialog.alwaysShowBubble`

### Runtime responsibilities
- Main-process tray/menu management.
- Settings persistence through the current layered settings runtime.
- Renderer-visible accessory/diagnostic state updates.

## Implementation Slice (Mandatory)
- Implement a tray/menu surface for the first shell controls.
- Implement one persisted roam-mode toggle and one persisted diagnostics toggle.
- Implement one visible wardrobe/accessory toggle (`headphones` / `none`).
- Add one dev-only fallback action for environments where tray support is unavailable.

## Visible App Outcome
- The app exposes a visible shell/settings surface instead of relying only on code edits or hidden hotkeys.
- User can toggle diagnostics and roam mode without restarting.
- User can toggle one visible accessory and confirm the wardrobe pipeline has started.

## Implementation Verification (Manual)
1. Use the tray to toggle roam mode and verify runtime status output changes.
2. Toggle diagnostics visibility and confirm overlay changes immediately.
3. Toggle headphones and confirm a visible accessory change.
4. Confirm drag/fling behavior is unchanged after these interactions.
5. If tray is unavailable, use the dev fallback and verify it produces the same runtime effect.

## Gate Status
- `Doc Gate`: `not_started`
- `Implementation Gate`: `not_started`
- `Overall`: `not_started`

## Change Log
- `2026-03-02`: File created to split tray, settings, and wardrobe work out of D07 and keep shell controls as a focused, operator-verifiable slice.
