# Virtual Pet OpenClaw Plugin + Skill

This folder contains a real OpenClaw plugin package for the `12d` lane:
- plugin manifest: `openclaw.plugin.json`
- plugin entry: `index.js`
- plugin-shipped skill: `skills/virtual-pet-lane/SKILL.md`
- lane helper module: `skills/virtual-pet-lane/index.js`

## Contract
- `contractVersion`: `vp-plugin-lane-v1`
- action type/route: `virtual_pet_lane_call`
- supported call ids:
  - `virtual_pet.command.request`
  - `virtual_pet.status.read`
  - `virtual_pet.memory.sync_intent`

## Install Into OpenClaw
Fastest path from this repo:

```powershell
npm run check:openclaw-plugin-live
```

Notes:
- the live check stages the plugin into WSL, installs/enables it, verifies plugin + skill discovery, and validates gateway method readiness (or prints a bounded skip message if gateway restart is still pending).
- set `PET_OPENCLAW_LIVE_PROFILE=<profile>` only if you intentionally run OpenClaw with a non-default profile.

Manual path (if your repo path is mounted inside WSL):

```powershell
wsl bash -lc "openclaw plugins install -l /mnt/<drive>/.../virtual-pet/openclaw-plugin/virtual-pet"
wsl bash -lc "openclaw plugins enable virtual-pet-lane"
wsl bash -lc "openclaw plugins info --json virtual-pet-lane"
wsl bash -lc "openclaw skills list --json"
```

## Lane Helper Usage
The helper module is importable from Node checks and scripts:

```js
const lane = require("./openclaw-plugin/virtual-pet/skills/virtual-pet-lane");
const action = lane.buildStatusReadCall({
  correlationId: "corr-status-1",
  scope: "bridge_summary",
});
console.log(action);
```

Example output:

```json
{
  "type": "virtual_pet_lane_call",
  "route": "virtual_pet_lane_call",
  "payload": {
    "contractVersion": "vp-plugin-lane-v1",
    "call": "virtual_pet.status.read",
    "correlationId": "corr-status-1",
    "payload": {
      "scope": "bridge_summary"
    }
  }
}
```

## Checks
- deterministic contract check:
  - `node scripts/check-openclaw-plugin-skill-lane.js`
- live OpenClaw install/discovery check:
  - `node scripts/check-openclaw-plugin-skill-lane-live.js`

## Authority Boundaries
- Command execution still flows through the app-side guarded command lane (`12c`).
- Status reads stay bounded and never include secret values.
- Memory sync remains intent-only and may defer as `memory_sync_not_enabled` until family-13 handlers are enabled.
