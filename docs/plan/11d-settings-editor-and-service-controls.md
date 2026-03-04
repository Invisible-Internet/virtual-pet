# Deliverable 11d: Settings Editor and Service Controls

**Deliverable ID:** `11d-settings-editor-and-service-controls`  
**Status:** `queued`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-04`  
**Depends On:** `11b-guided-pet-setup-and-markdown-bootstrap`, `11c-repair-actions-and-provenance-visibility`  
**Blocks:** `12a-real-openclaw-dialog-parity`, `13a-offline-identity-and-recent-recall`  

## Objective
Add an explicit in-app settings editor so operators can configure service/source usage, selected runtime toggles, and character sizing controls from the GUI with clear persistence and provenance visibility.

## In Scope
- Shared-shell settings surface (likely under Setup/Advanced or a dedicated tab).
- Service/source enable controls (for example OpenClaw, Spotify, FreshRSS) with clear saved state.
- Selected advanced runtime toggles that are currently env/config-only and safe to expose.
- Character size controls for display/hitbox values with bounded validation.
- Persistence model and status/provenance visibility for settings source and effective values.

## Out of Scope
- Arbitrary free-form editing of every file or every env var.
- Unsafe settings that can break security boundaries without explicit guardrails.
- Hidden auto-applies; all writes stay explicit and operator-triggered.

## Environment / Prerequisites
- `11c` accepted or at minimum acceptance feedback complete.
- Shared shell runtime (`Inventory` / `Status` / `Setup`) available.
- Existing settings runtime (`settings-runtime.js`) and observability source-map support.

## Showcase Promise (Mandatory)
The operator can open settings in-app, change supported controls (service/source toggles, selected advanced flags, character size), save, and immediately confirm both runtime effect and persisted value/provenance.

## Operator Demo Script (Mandatory)
1. Open the settings surface from the shared shell.
2. Disable one integration source and save.
3. Re-open Status and confirm the change is visible in runtime/diagnostic rows.
4. Change one supported advanced runtime toggle and save.
5. Restart the app and confirm both changes persist.

## Failure / Recovery Script (Mandatory)
1. Attempt to save an invalid size or blocked setting value.
2. Confirm save is rejected with a clear reason and no partial write.
3. Restore a valid value and save.
4. Confirm runtime/state recovers without manual file editing.

## Public Interfaces / Touchpoints
- `inventory.html`
- `inventory-shell-renderer.js`
- `inventory-preload.js`
- `main.js`
- `settings-runtime.js`
- `shell-observability.js`
- new/updated deterministic check scripts (TBD during spec)

## Acceptance Bar
- Accepted when supported settings are editable in GUI, persisted explicitly, and visible in runtime/provenance.
- Not accepted if settings writes are ambiguous, hidden, or bypass validation/ownership boundaries.

## Implementation Slice (Mandatory)
- Not started. This file stages the queued slice immediately after `11c`.

## Visible App Outcome
- Not yet delivered. Outcome will be defined in final spec.

## Acceptance Notes
- `2026-03-04`: Slice staged only; spec/detail contract not started.

## Iteration Log
- `2026-03-04`: Created queued staging record per operator direction to run `11d` immediately after `11c`.

## Gate Status
- `Spec Gate`: `not_started`
- `Build Gate`: `not_started`
- `Acceptance Gate`: `not_started`
- `Overall`: `queued`

## Change Log
- `2026-03-04`: File created to stage post-`11c` settings-editor work.
