# Deliverable 07c: Shell, Settings, and Wardrobe Surface

**Deliverable ID:** `07c-shell-settings-and-wardrobe-surface`  
**Status:** `done`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-03`  
**Depends On:** `02-architecture-capability-registry`, `05a-obsidian-workspace-bootstrap-and-connectivity`, `07b-dialog-surface-and-minimal-offline-loop`  
**Blocks:** `08-test-and-acceptance-matrix`  
**Verification Gate:** `Tray/settings/wardrobe surface is visible, persists through the settings stack, and changes at least one runtime behavior without breaking movement invariants`

## Objective
Deliver the first real shell and settings surface promised by the roadmap without mixing that work into D07 or D07b.

## In Scope
- Tray/taskbar menu.
- Inventory popup GUI for wardrobe and trusted props.
- Deterministic settings toggles for runtime controls.
- Minimal wardrobe/accessory control.
- Minimal inventory/prop launcher control for at least one trusted desktop prop.
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
- Wardrobe accessories and trusted props live in an inventory popup opened from the tray or dev fallback, rather than being listed directly as tray toggles.
- If tray support is unavailable in a dev environment, a dev-only hotkey fallback is acceptable for verification, but tray/menu remains the documented baseline.
- Settings remain config-first and must preserve the existing override order.

## Implementation Breakdown
1. Add a main-process tray/menu module.
2. Extend the tracked settings model with durable keys for:
   - `roaming.mode`
   - `roaming.zone`
   - `roaming.zoneRect`
   - `ui.diagnosticsEnabled`
   - `wardrobe.activeAccessories`
   - `inventory.quickProps`
   - `dialog.alwaysShowBubble`
3. Expose runtime-safe tray actions for:
   - inventory popup open
   - desktop roam
   - zone roam
   - diagnostics on/off
   - always-show-bubble on/off
4. Implement an inventory popup GUI with icon-based wardrobe and trusted-prop controls.
5. Reflect settings changes in runtime status output and renderer-visible state.
6. Spawn the first trusted prop as a separate desktop window that can be dragged independently from the pet and returned to inventory from the desktop.
7. Add a marquee-based roam-zone selector so `Zone` mode can target a real drawn desktop area.
8. Add one dev-only verification fallback if tray interaction is unavailable during development.

## Verification Gate
Pass when all are true:
1. Tray/taskbar menu appears and changes at least one runtime behavior.
2. Settings changes persist through the existing settings stack.
3. One wardrobe/accessory toggle visibly changes the pet.
4. One inventory/prop launcher control visibly spawns or removes a trusted prop.
5. Roam mode changes are reflected in runtime status output.
6. Diagnostics toggle changes overlay visibility without requiring code edits.
7. Drag/fling and fixed-window invariants remain intact.

## Tangible Acceptance Test (Doc-Level)
1. Open the inventory popup from the tray/dev fallback, then toggle headphones and verify visible accessory change.
2. Drag the first trusted prop icon from the inventory popup onto the desktop and verify a separate prop window appears.
3. Drag the placed prop window independently from the pet and confirm the pet does not move with it.
4. Toggle diagnostics and verify overlay visibility changes without restart.
5. Toggle roam mode from the tray and verify status output reflects the active mode plus visible desktop roaming.
6. Confirm drag/fling still behaves the same after each shell interaction.
7. If using the dev-only fallback path, confirm it mirrors the same settings changes as the tray action.

## Public Interfaces
### Settings additions
- `roaming.mode`
- `roaming.zone`
- `roaming.zoneRect`
- `ui.diagnosticsEnabled`
- `wardrobe.activeAccessories`
- `inventory.quickProps`
- `dialog.alwaysShowBubble`

### Runtime responsibilities
- Main-process tray/menu management.
- Main-process inventory popup and trusted prop window management.
- Main-process roam-zone selector window management.
- Settings persistence through the current layered settings runtime.
- Renderer-visible accessory/diagnostic state updates.
- Shell-visible trusted prop spawn/remove actions for the first inventory slice.
- Separate trusted prop windows that remain draggable independently of the pet.

## Implementation Slice (Mandatory)
- Implement a tray/menu surface for the first shell controls.
- Implement one persisted roam-mode toggle and one persisted diagnostics toggle.
- Implement an inventory popup GUI with icon-driven wardrobe controls.
- Implement one visible wardrobe/accessory toggle (`headphones` / `none`).
- Implement one trusted inventory/prop launcher action (spawn/remove one desktop prop) as a separate desktop window.
- Implement a marquee-based roam-zone selector that persists a custom zone rectangle.
- Add one dev-only fallback action for environments where tray support is unavailable.

## Visible App Outcome
- The app exposes a visible shell/settings surface instead of relying only on code edits or hidden hotkeys.
- The tray opens a dedicated inventory popup where wardrobe accessories and trusted props are represented as icons.
- User can toggle diagnostics and roam mode without restarting.
- User can toggle one visible accessory and confirm the wardrobe pipeline has started.
- User can spawn/remove at least one trusted prop from a visible shell control, establishing the first inventory workflow.
- User can draw a custom roam zone and keep the pet moving within it.
- The first trusted prop exists in its own desktop window and can be repositioned separately from the pet.

## Implementation Verification (Manual)
1. Use the tray or `F6` fallback to open the inventory popup.
2. Toggle headphones in the inventory popup and confirm a visible accessory change.
3. Drag the pool-ring icon from the inventory popup onto the desktop and confirm it appears as a separate prop window.
4. Drag the pool-ring prop window independently from the pet and confirm the pet stays put.
5. Use the zone selector to draw a custom roam area, then confirm the pet runs into that marquee from its current position and keeps moving inside it instead of walking in place.
6. Toggle roam mode and confirm runtime status output changes plus visible desktop roaming with idle/watch pauses between travel legs.
7. Return the pool-ring prop from its desktop window and confirm it disappears from the desktop without being removed from inventory.
8. Toggle diagnostics visibility and confirm overlay changes immediately.
9. Toggle the pinned speech-bubble setting and confirm the last pet bubble persists instead of expiring on the normal timer.
10. Confirm drag/fling behavior is unchanged after these interactions.
11. If tray is unavailable, use the dev fallback and verify it produces the same runtime effect.

## Gate Status
- `Doc Gate`: `passed`
- `Implementation Gate`: `passed`
- `Overall`: `done`

## Change Log
- `2026-03-02`: File created to split tray, settings, and wardrobe work out of D07 and keep shell controls as a focused, operator-verifiable slice.
- `2026-03-02`: Expanded future shell scope to include a minimal inventory/prop launcher so user-placed desktop props and wardrobe/accessory controls share one visible operator surface.
- `2026-03-03`: Implemented the first D07c runtime slice with persisted shell settings, tray/menu actions plus dev fallback hotkeys, a visible headphones wardrobe toggle, a visible pool-ring quick prop, and immediate diagnostics/bubble toggle wiring through the existing settings stack.
- `2026-03-03`: Reworked the D07c slice after manual feedback so tray opens an inventory popup GUI, roaming now drives actual desktop motion, pool-ring props use separate draggable windows, and always-show-bubble keeps the last pet bubble visible until replaced.
- `2026-03-03`: Corrected the D07c slice after follow-up manual feedback so roaming now uses destination-based travel with rest phases, zone mode can be drawn with a marquee selector, pool-ring props can be returned from their desktop window, and the inventory window is scrollable/resizable with category scaffolding for costumes and snacks.
- `2026-03-03`: Corrected the D07c slice after the next manual feedback pass so roam legs use stable bounds during motion, custom zones can queue an entry run into the marquee area, and the inventory window now uses a clearer transparent-shell chrome with a stronger drag bar and compact `X` close affordance.
- `2026-03-03`: Fixed a D07c main-process crash in roam-range calculation by ensuring autonomous roam planning always supplies valid timestamped pet bounds to the clamp helpers.
- `2026-03-03`: Fixed a D07c roam-step collision bug so fractional motion no longer aborts `Roam` instantly, changed custom-zone entry to travel through desktop space instead of popping to the zone clamp boundary, stabilized the diagnostics bounds box to the character-sized visual bounds, and removed the remaining inventory badge/footer chrome.
- `2026-03-03`: Refined D07c desktop roaming after seam/facing feedback so desktop travel uses a virtual multi-monitor roam envelope with endpoints still sampled from real display work areas, zone-entry travel inherits that cross-monitor path, roam legs publish a diagonal-aware facing direction, and `Run` now moves substantially faster than `Walk`.
- `2026-03-03`: Closed D07c as `done` after operator-confirmed shell acceptance: tray surface, inventory resize/scroll, pool-ring return, diagnostics toggle, custom zone flow, and acceptable cross-monitor roaming/facing behavior are all working well enough to defer further polish until later deliverables.
