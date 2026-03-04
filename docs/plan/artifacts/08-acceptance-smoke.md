# D08 Acceptance Smoke Report

- Generated: 2026-03-04T23:14:29.776Z
- Runner: Codex automated smoke
- Summary: 16/16 automated checks passed

| ID | Deliverable | Status | Command | Evidence |
| --- | --- | --- | --- | --- |
| D02-capability-registry | 02-architecture-capability-registry | passed | `node scripts/check-capability-registry.js` | `[capability-registry] checks passed` |
| D02b-extension-framework | 02b-extension-framework-and-pack-sdk | passed | `node scripts/check-extension-pack-registry.js` | `[extension-pack-registry] checks passed` |
| Movement-runtime-invariants | core-runtime-invariants | passed | `node scripts/check-runtime-invariants.js` | `[runtime-invariants] checks passed` |
| D03-contract-router | 03-pet-core-events-intents-suggestions | passed | `node scripts/check-contract-router.js` | `[contracts] router checks passed` |
| D04-openclaw-bridge | 04-openclaw-bridge-spec | passed | `node scripts/check-openclaw-bridge.js` | `[openclaw-bridge] checks passed` |
| D05-memory-pipeline | 05-memory-pipeline-and-obsidian-adapter | passed | `node scripts/check-memory-pipeline.js` | `[memory-pipeline] checks passed` |
| D05a-settings-runtime | 05a-obsidian-workspace-bootstrap-and-connectivity | passed | `node scripts/check-settings-runtime.js` | `[settings-runtime] checks passed` |
| D06-integrations | 06-integrations-freshrss-spotify | passed | `node scripts/check-integration-runtime.js` | `[integration-runtime] checks passed` |
| D06-local-media-sensor | 06-integrations-freshrss-spotify | passed | `node scripts/check-windows-media-sensor.js` | `[windows-media-sensor] checks passed` |
| D07-state-runtime | 07-state-system-extension-guide | passed | `node scripts/check-state-runtime.js` | `[state-runtime] checks passed` |
| D07b-dialog-runtime | 07b-dialog-surface-and-minimal-offline-loop | passed | `node scripts/check-dialog-runtime.js` | `[dialog] offline dialog checks passed` |
| D11a-shell-observability | 11a-openclaw-memory-observability-surface | passed | `node scripts/check-shell-observability.js` | `[shell-observability] checks passed` |
| D11b-setup-bootstrap | 11b-guided-pet-setup-and-markdown-bootstrap | passed | `node scripts/check-setup-bootstrap.js` | `[setup-bootstrap] checks passed` |
| D11c-repair-actions | 11c-repair-actions-and-provenance-visibility | passed | `node scripts/check-shell-repair-actions.js` | `[shell-repair-actions] checks passed` |
| Layout-assets | core-renderer-assets | passed | `node scripts/check-layout.js` | `layout checks passed` |
| Sprite-assets | core-renderer-assets | passed | `node scripts/check-assets.js` | `[assets] girl: manifest OK (7 states)
[assets] checks passed` |

