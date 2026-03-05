# Deliverable 11d: Settings Editor and Service Controls

**Deliverable ID:** `11d-settings-editor-and-service-controls`  
**Status:** `accepted`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-05`  
**Depends On:** `05a-obsidian-workspace-bootstrap-and-connectivity`, `07c-shell-settings-and-wardrobe-surface`, `11a-openclaw-memory-observability-surface`, `11b-guided-pet-setup-and-markdown-bootstrap`, `11c-repair-actions-and-provenance-visibility`  
**Blocks:** `12a-real-openclaw-dialog-parity`, `13a-offline-identity-and-recent-recall`  

## Objective
Add an explicit shared-shell settings editor so the operator can safely change a bounded set of runtime controls (service/source toggles, selected advanced runtime flags, and character sizing controls), save those changes explicitly, and verify persisted value plus effective provenance without editing JSON files by hand.

## In Scope
- Add an `Advanced Settings` surface in the existing shared shell window (`Settings` tab owner for first slice).
- Add tray routing for `Advanced Settings...` to open the shared shell directly on the `Settings` tab.
- Expose a bounded write-safe settings set for operator edits.
- Persist edits through the existing runtime override path:
  - dev: `config/settings.local.json`
  - packaged: `%APPDATA%/.../settings.json` (`app.getPath("userData")`)
- Show value provenance so the operator can see whether each effective value comes from base, local/runtime override, or env.
- Provide a visible apply result with clear partial-blocking rules when env overrides win.
- Add first-slice character sizing controls with bounded numeric validation and immediate runtime application rules.

## Out of Scope
- Free-form JSON editing from GUI.
- Editing root path values (`paths.localWorkspaceRoot`, `paths.openClawWorkspaceRoot`, `paths.obsidianVaultRoot`) in `11d`.
- Editing credential values (`openclaw.authToken`, `openclaw.authTokenRef`) in `11d`.
- Editing all existing settings keys; `11d` is a bounded first lane only.
- Auto-save behavior; saves must be explicit.
- Setup Markdown bootstrap writes (`SOUL.md`, `STYLE.md`, etc.) beyond existing `11b` flow.

## Environment / Prerequisites
- `11c` accepted baseline and shared shell window routing (`Inventory` / `Status` / `Setup` / `Settings`).
- Runtime settings loader/writer available in `settings-runtime.js`.
- Settings source-map visibility from runtime (`settingsSourceMap`, `settingsFiles`) available to shell and status surfaces.
- Windows dev flow (`npm start`) and acceptance scripts runnable.

## Showcase Promise (Mandatory)
The operator can open `Settings` -> `Advanced Settings`, change supported controls, press one explicit save action, and immediately confirm:
- the effective runtime value changed (or is clearly marked as env-overridden),
- the persisted override file was updated only for allowed keys,
- and `Status`/settings provenance explain where the effective value now comes from.

## Operator Demo Script (Mandatory)
1. Start the app with no `PET_*` override for the settings being tested and open the shared shell on `Settings`.
2. Open `Advanced Settings` and capture baseline values for:
   - `openclaw.enabled`
   - `integrations.spotify.enabled`
   - `ui.diagnosticsEnabled`
   - `Character Scale` slider value (`0..1`)
3. Disable `openclaw.enabled` and press `Save Settings`.
4. Confirm save success includes the override target path and reports no rejected keys.
5. Switch to `Status`, press `Refresh`, and confirm `OpenClaw Bridge` shows `disabled` with a reason aligned to config.
6. Return to `Advanced Settings`, re-enable `openclaw.enabled`, then disable `integrations.spotify.enabled`; save again.
7. Confirm settings view shows new effective values and source for edited keys as runtime/local override.
8. Change `Character Scale` slider to a non-default value, save, and confirm pet size plus desktop prop size update together without breaking drag/clamp behavior.
9. Restart the app and reopen `Advanced Settings`.
10. Confirm saved values persist and still report correct provenance after restart.

## Failure / Recovery Script (Mandatory)
1. From devtools or test harness, submit an invalid apply payload (`ui.characterScalePercent` outside bounds) and attempt save.
2. Confirm save is rejected with validation feedback and no file write for invalid fields.
3. Set `PET_SPOTIFY_ENABLED=1` in the launch environment, then attempt to disable Spotify in GUI and save.
4. Confirm response marks the key as env-overridden (persisted patch may exist, but effective value remains env-owned) with a clear message.
5. Remove the env override and relaunch.
6. Confirm effective value now follows saved GUI value and provenance updates away from `env`.
7. Return invalid field to a valid value, save, and confirm runtime returns to healthy behavior.

## Public Interfaces / Touchpoints
- Deliverable doc:
  - `docs/plan/11d-settings-editor-and-service-controls.md`
- Shared-shell UI:
  - `inventory.html`
  - `inventory-shell-renderer.js`
  - `inventory-preload.js`
- Main-process settings surface and apply lane:
  - `main.js`
  - `settings-runtime.js`
  - `shell-observability.js`
- Settings acceptance/contract checks:
  - `scripts/check-shell-settings-editor.js`
  - `scripts/run-acceptance-matrix.js` row `D11d-settings-editor`

## 11d Settings Write-Safety Contract
`11d` first slice allows GUI edits only for this whitelist:

```js
[
  "openclaw.enabled",
  "integrations.spotify.enabled",
  "integrations.spotify.backgroundEnrichmentEnabled",
  "integrations.freshRss.enabled",
  "integrations.freshRss.backgroundEnrichmentEnabled",
  "sensors.media.enabled",
  "ui.diagnosticsEnabled",
  "dialog.alwaysShowBubble",
  "ui.characterScalePercent"
]
```

Rules:
- Unknown keys are rejected.
- Known but blocked keys are rejected with `reason=blocked_key`.
- Patch writes are shallowly scoped to whitelisted keys only.
- Save API returns:
  - accepted keys
  - rejected keys with reason
  - env-overridden keys where effective value differs from persisted override
  - override target file path

## Character Sizing Contract
Exposed editor control (first slice):
- `Character Scale` slider
  - normalized range `0..1`
  - default `0.5` equals `100%`
  - `0` equals `50%` (half size)
  - `1` equals `200%` (double size)
  - quarter-mark ticks are labeled `0`, `25`, `50`, `75`, `100`
  - in-between values remain selectable across the full range

Runtime persisted fields:
- `ui.characterScalePercent`
  - default `100`
  - allowed integer range `50..200`
- `ui.characterHitboxScalePercent`
  - default `100`
  - mirrored from `ui.characterScalePercent` during GUI apply
  - allowed integer range `50..200`

Rules:
- Values outside bounds are rejected at validation time.
- Apply is explicit and atomic for accepted keys.
- Runtime must clamp to safe defaults if file/env values are malformed.
- One scale change applies together to character render/layout, hitbox envelope, and desktop quick-prop windows.
- Size/hitbox updates must preserve current invariants:
  - main process remains drag/clamp authority
  - content bounds remain fixed for the chosen active scale
  - renderer/main visual-bound agreement remains deterministic

## Persistence + Provenance Contract
- GUI writes go through one IPC apply endpoint and then `persistRuntimeSettingsPatch`.
- Effective values continue to resolve through existing precedence:
  - base config -> local/runtime override -> env
- Provenance must be visible per field as one of:
  - `base`
  - `local`
  - `runtime`
  - `env`
- When env wins, GUI must show:
  - persisted value
  - effective value
  - clear "overridden by environment" signal

## Shell Settings IPC Contract
`11d` introduces two bounded IPC calls:

```js
// Read-only editor snapshot
pet:getShellSettingsSnapshot -> {
  kind: "shellSettingsSnapshot",
  ts: 0,
  overridePath: "config/settings.local.json",
  fields: [
    {
      key: "openclaw.enabled",
      label: "OpenClaw Service",
      value: true,
      effectiveValue: true,
      source: "local",
      editable: true,
      validation: { kind: "boolean" }
    }
  ]
}

// Explicit apply
pet:applyShellSettingsPatch({ patch }) -> {
  ok: true,
  acceptedKeys: ["openclaw.enabled"],
  rejected: [],
  envOverrides: [],
  overridePath: "config/settings.local.json",
  shellState: { ... },
  observability: { ... }
}
```

Rules:
- No direct renderer file I/O.
- IPC validates payload shape and key whitelist before write.
- Apply result is deterministic and operator-readable.

## Acceptance Bar
- Accepted for `Spec Gate` only when:
  - whitelist keys, blocked keys, persistence rules, env override behavior, validation bounds, and demo/failure scripts are explicit.
- Accepted for final operator closure only when:
  - operator can edit and save all whitelisted controls from GUI,
  - status/settings surfaces clearly show effective value and provenance,
  - invalid edits are rejected safely with no hidden partial corruption,
  - character size/hitbox controls visibly affect runtime and stay stable across restart,
  - no out-of-scope key is writable from GUI.
- Not accepted if:
  - GUI can mutate path roots or auth token fields in this slice,
  - save semantics are implicit/auto without explicit operator action,
  - env override behavior is hidden or misleading,
  - sizing changes break drag/clamp/window invariants.

## Implementation Slice (Mandatory)
- First implementation slice is now shipped:
  - new bounded settings-editor read/apply contract implemented:
    - `pet:getShellSettingsSnapshot`
    - `pet:applyShellSettingsPatch`
  - new shared-shell `Settings` section added:
    - `Advanced Settings` card with bounded controls and explicit `Save Settings`
    - per-field saved value, effective value, source, and env-override visibility
  - runtime settings contract extended:
    - `ui.characterScalePercent`
    - `ui.characterHitboxScalePercent`
    - env overrides:
      - `PET_UI_CHARACTER_SCALE_PERCENT`
      - `PET_UI_CHARACTER_HITBOX_SCALE_PERCENT`
  - runtime layout/hitbox behavior wired:
    - pet layout now updates from settings scale values
    - main window content size remains fixed for the active scale
    - renderer updates layout from shell-state payload
  - iteration polish updates:
    - `Advanced Settings` promoted to its own `Settings` tab in the shared shell
    - tray menu now includes `Advanced Settings...` routing
    - `Character Scale` now uses a normalized slider (`0..1`) mapped to `50..200%`
    - slider now keeps quarter-mark ticks (`0/25/50/75/100`) while allowing in-between values
    - slider no longer re-renders on every drag input
    - slider readout now updates in real time as the slider moves
    - value rows now collapse to one `Value` row unless env override is active
    - scale now applies together to character visuals, hitbox envelope, and quick-prop windows
    - diagnostics overlay visible-hitbox bounds now follow live sprite/rig bounds after runtime scale changes
  - deterministic coverage added:
    - `scripts/check-shell-settings-editor.js`
    - acceptance matrix row `D11d-settings-editor`
    - contract pipeline now includes `check-shell-settings-editor`

## Visible App Outcome
- Shared shell now includes a dedicated `Settings` tab with a visible `Advanced Settings` editor.
- Tray now includes `Advanced Settings...` that opens the shared shell on the `Settings` tab.
- Operators can save supported settings without hand-editing JSON files.
- Save results now show accepted/rejected keys and env override behavior.
- Character scale slider now supports in-between values with quarter-mark ticks (`0/25/50/75/100`) and updates pet + prop scale together.

## Acceptance Notes
- `2026-03-04`: Promoted from queued placeholder to full `specifying` contract.
- `2026-03-04`: `Spec Gate` passed; implementation intentionally not started in this session.
- `2026-03-04`: First `11d` implementation slice landed across shell UI, preload bridge, main-process IPC, and settings runtime.
- `2026-03-04`: Build verification passed:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `17/17 automated checks passed`
- `2026-03-05`: Iteration update landed (dedicated `Settings` tab/tray routing + normalized scale slider + unified pet/prop scaling), and checks re-passed:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `17/17 automated checks passed`
- `2026-03-05`: Slider interaction polish landed (smooth drag behavior without per-input re-render + quarter-mark ticks at `0/25/50/75/100`), and checks re-passed:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `17/17 automated checks passed`
- `2026-03-05`: Slider refinement landed (in-between values selectable; removed extra live readout/help text beneath slider), and checks re-passed:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `17/17 automated checks passed`
- `2026-03-05`: Slider/value presentation follow-up landed (restored real-time slider value readout, kept in-between values selectable with quarter-labeled ticks, and simplified saved/effective rows to one row unless env override is active), and checks re-passed:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `17/17 automated checks passed`
- `2026-03-05`: Diagnostics bounds follow-up landed (visible hitbox/overlay now tracks live computed sprite/rig bounds after scale changes), and checks re-passed:
  - `npm run check:syntax`
  - `npm run check:contracts`
  - `npm run check:acceptance` -> `17/17 automated checks passed`
- `2026-03-05`: `Acceptance Gate` passed after operator verification (`Looks good! let's close this one out`); deliverable closed as `accepted`.

## Iteration Log
- `2026-03-04`: Replaced queued staging notes with bounded write-safety, provenance, and sizing contracts for first `11d` implementation slice.
- `2026-03-04`: Implemented first bounded settings-editor slice and promoted `11d` to `implementing` with `Build Gate=passed`.
- `2026-03-05`: Moved `Advanced Settings` to its own tab/tray route and changed character scale control to normalized slider semantics with unified pet/prop scaling.
- `2026-03-05`: Refined slider interaction to keep quarter-mark ticks while allowing in-between values and removing extra inline slider helper text.
- `2026-03-05`: Refined slider/value presentation again to restore live value readout and reduce duplicate value rows when no env override is present.
- `2026-03-05`: Fixed diagnostics overlay bounds to use live sprite/rig visible bounds so hitbox boxes stay aligned after scaling.

## Gate Status
- `Spec Gate`: `passed`
- `Build Gate`: `passed`
- `Acceptance Gate`: `passed` (`2026-03-05`)
- `Overall`: `accepted`

## Change Log
- `2026-03-04`: File created to stage post-`11c` settings-editor work.
- `2026-03-04`: Rewritten from template-staging state into a full `11d` spec with mandatory demo and failure/recovery contracts.
- `2026-03-04`: Marked `Spec Gate=passed` for `11d`; no implementation changes made.
- `2026-03-04`: Implemented first `11d` runtime/settings slice (bounded GUI editor, IPC, persistence/provenance visibility, and settings-editor deterministic checks).
- `2026-03-05`: Iterated `11d` shell/settings UX and scale behavior (new tab + tray route + normalized scale slider + unified prop scaling).
- `2026-03-05`: Iterated slider UX to remove drag stickiness and add quarter-stop ticks.
- `2026-03-05`: Iterated slider UX again to allow in-between values and remove extra slider readout/helper text.
- `2026-03-05`: Iterated slider/value UX again to restore real-time value readout, keep quarter-labeled ticks, and simplify duplicate value rows.
- `2026-03-05`: Iterated diagnostics overlay bounds so visible-hitbox boxes stay aligned with scaled character runtime bounds.
- `2026-03-05`: Closed deliverable after operator acceptance and marked `11d` as `accepted`.
