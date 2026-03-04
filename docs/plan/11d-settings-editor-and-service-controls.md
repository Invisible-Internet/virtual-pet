# Deliverable 11d: Settings Editor and Service Controls

**Deliverable ID:** `11d-settings-editor-and-service-controls`  
**Status:** `specifying`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-04`  
**Depends On:** `05a-obsidian-workspace-bootstrap-and-connectivity`, `07c-shell-settings-and-wardrobe-surface`, `11a-openclaw-memory-observability-surface`, `11b-guided-pet-setup-and-markdown-bootstrap`, `11c-repair-actions-and-provenance-visibility`  
**Blocks:** `12a-real-openclaw-dialog-parity`, `13a-offline-identity-and-recent-recall`  

## Objective
Add an explicit shared-shell settings editor so the operator can safely change a bounded set of runtime controls (service/source toggles, selected advanced runtime flags, and character sizing controls), save those changes explicitly, and verify persisted value plus effective provenance without editing JSON files by hand.

## In Scope
- Add an `Advanced Settings` surface in the existing shared shell window (`Setup` tab owner for first slice).
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
- `11c` accepted baseline and shared shell window routing (`Inventory` / `Status` / `Setup`).
- Runtime settings loader/writer available in `settings-runtime.js`.
- Settings source-map visibility from runtime (`settingsSourceMap`, `settingsFiles`) available to shell and status surfaces.
- Windows dev flow (`npm start`) and acceptance scripts runnable.

## Showcase Promise (Mandatory)
The operator can open `Setup` -> `Advanced Settings`, change supported controls, press one explicit save action, and immediately confirm:
- the effective runtime value changed (or is clearly marked as env-overridden),
- the persisted override file was updated only for allowed keys,
- and `Status`/settings provenance explain where the effective value now comes from.

## Operator Demo Script (Mandatory)
1. Start the app with no `PET_*` override for the settings being tested and open the shared shell on `Setup`.
2. Open `Advanced Settings` and capture baseline values for:
   - `openclaw.enabled`
   - `integrations.spotify.enabled`
   - `ui.diagnosticsEnabled`
   - `ui.characterScalePercent`
3. Disable `openclaw.enabled` and press `Save Settings`.
4. Confirm save success includes the override target path and reports no rejected keys.
5. Switch to `Status`, press `Refresh`, and confirm `OpenClaw Bridge` shows `disabled` with a reason aligned to config.
6. Return to `Advanced Settings`, re-enable `openclaw.enabled`, then disable `integrations.spotify.enabled`; save again.
7. Confirm settings view shows new effective values and source for edited keys as runtime/local override.
8. Change `ui.characterScalePercent` to a non-default valid value, save, and confirm visible pet size/hitbox envelope updates without breaking drag/clamp behavior.
9. Restart the app and reopen `Advanced Settings`.
10. Confirm saved values persist and still report correct provenance after restart.

## Failure / Recovery Script (Mandatory)
1. In `Advanced Settings`, enter an invalid character scale value (outside allowed bounds) and attempt save.
2. Confirm save is rejected with field-level validation feedback and no file write for invalid fields.
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
- Settings acceptance/contract checks (new for `11d`):
  - `scripts/check-shell-settings-editor.js` (planned)
  - `scripts/run-acceptance-matrix.js` add `D11d-settings-editor` (planned)

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
  "ui.characterScalePercent",
  "ui.characterHitboxScalePercent"
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
New runtime settings fields (first slice):
- `ui.characterScalePercent`
  - default `100`
  - allowed integer range `70..140`
- `ui.characterHitboxScalePercent`
  - default `100`
  - allowed integer range `80..130`

Rules:
- Values outside bounds are rejected at validation time.
- Apply is explicit and atomic for accepted keys.
- Runtime must clamp to safe defaults if file/env values are malformed.
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

## Shell Settings IPC Contract (Planned)
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
- Not started.
- This session delivers spec-only work:
  - write-safety contract locked
  - demo and failure/recovery scripts locked
  - first-slice IPC contract draft locked

## Visible App Outcome
- No visible app/runtime change yet.
- Operator-visible outcomes are deferred to `Build Gate` implementation.

## Acceptance Notes
- `2026-03-04`: Promoted from queued placeholder to full `specifying` contract.
- `2026-03-04`: `Spec Gate` passed; implementation intentionally not started in this session.

## Iteration Log
- `2026-03-04`: Replaced queued staging notes with bounded write-safety, provenance, and sizing contracts for first `11d` implementation slice.

## Gate Status
- `Spec Gate`: `passed`
- `Build Gate`: `not_started`
- `Acceptance Gate`: `not_started`
- `Overall`: `specifying`

## Change Log
- `2026-03-04`: File created to stage post-`11c` settings-editor work.
- `2026-03-04`: Rewritten from template-staging state into a full `11d` spec with mandatory demo and failure/recovery contracts.
- `2026-03-04`: Marked `Spec Gate=passed` for `11d`; no implementation changes made.
