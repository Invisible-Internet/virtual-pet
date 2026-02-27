# Deliverable 05a: Obsidian Workspace Bootstrap and Connectivity

**Deliverable ID:** `05a-obsidian-workspace-bootstrap-and-connectivity`  
**Status:** `done`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-27`  
**Depends On:** `04-openclaw-bridge-spec`  
**Blocks:** `05-memory-pipeline-and-obsidian-adapter`  
**Verification Gate:** `Settings-driven OpenClaw/Obsidian paths and connectivity policies are implemented and validated with local environment evidence`

## Objective
Insert a configuration-first integration layer before D05 gate closeout so runtime behavior is deterministic across:
- local-only mode,
- OpenClaw enabled/disabled,
- Obsidian enabled/disabled,
- local/WSL path targets.

## In Scope
- `config/` settings model with layered overrides.
- Runtime settings resolver with schema normalization and validation warnings/errors.
- OpenClaw bridge transport selection (`stub`, `http`) with non-loopback auth policy.
- Non-destructive OpenClaw workspace policy in normal runtime.
- Explicit operator bootstrap/check commands for OpenClaw workspace and Obsidian vault prerequisites.
- IPC/config exposure of resolved integration summary.

## Out of Scope
- Full settings GUI (tracked later in D07).
- Mandatory OpenClaw Obsidian skill dependency (skill remains optional augmentation).

## Settings Contract (Implemented)
- `memory.enabled: boolean`
- `memory.adapterMode: "local" | "obsidian"`
- `memory.mutationTransparencyPolicy: "silent" | "logged" | "brief_notification"`
- `memory.writeLegacyJsonl: boolean` (compatibility switch)
- `openclaw.enabled: boolean`
- `openclaw.transport: "stub" | "http"`
- `openclaw.mode: "online" | "offline" | "timeout"` (stub transport mode simulation)
- `openclaw.baseUrl: string`
- `openclaw.timeoutMs: number`
- `openclaw.retryCount: number`
- `openclaw.authTokenRef: string | null`
- `openclaw.authToken: string | null`
- `openclaw.allowNonLoopback: boolean`
- `paths.localWorkspaceRoot: string`
- `paths.openClawWorkspaceRoot: string | null`
- `paths.obsidianVaultRoot: string | null`

## Resolution Order (Implemented)
1. Base defaults from `config/settings.json` (or bundled defaults in packaged app).
2. Local override:
   - dev: `config/settings.local.json`
   - packaged: `%APPDATA%/virtual-pet/settings.json`
3. Environment variable overrides (highest precedence).

## Runtime Interfaces (Implemented)
- `loadRuntimeSettings(): { settings, sourceMap, validationWarnings, validationErrors, resolvedPaths, files }`
- `isLoopbackEndpoint(baseUrl): boolean`
- `resolveWorkspacePaths(settings): { localRoot, openClawRoot, obsidianRoot }`

## OpenClaw Connectivity Policy (Implemented)
- `stub` transport preserved for deterministic local fallback.
- `http` transport supports configured `baseUrl`, timeout, retry count, bearer token.
- Loopback endpoints (`localhost`, `127.0.0.1`, `::1`): token optional.
- Non-loopback endpoints:
  - require `allowNonLoopback=true`
  - require auth token (`openclaw.authToken` or env via `authTokenRef`).
- Violations or runtime request failures degrade to local fallback text without blocking app runtime.

## Workspace and Memory Governance (Implemented in Runtime)
- OpenClaw disabled: runtime does not create `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`.
- OpenClaw enabled + workspace configured: normal runtime is warn-only for missing OpenClaw files.
- Explicit bootstrap path is available (`memoryPipeline.bootstrapOpenClawWorkspaceFiles()` and CLI command).
- Markdown canonical decision logs are active:
  - `promotion-decisions.md`
  - `identity-mutations.md`
- Legacy `.jsonl` logs remain compatibility artifacts (`writeLegacyJsonl`) and are migrated into Markdown when Markdown logs are empty.

## Obsidian Skill Position
- OpenClaw Obsidian skill is treated as optional augmentation only.
- Baseline Virtual-Pet memory flow remains path-first and independent of skill installation.

## OpenClaw Obsidian Skill Checklist (Manual)
1. Install/enable Obsidian skill in the target OpenClaw environment (if desired for OpenClaw-side retrieval/automation).
2. Verify OpenClaw starts and responds both with the skill enabled and disabled.
3. Verify Virtual-Pet baseline memory writes continue to work without relying on the skill.
4. Record skill state and outcome in D05a manual evidence notes before gate closeout.

## Implementation Slice (Mandatory)
- Added `settings-runtime.js`:
  - layered config loading,
  - normalization and validation,
  - path resolution and policy warnings.
- Added config artifacts:
  - `config/settings.json`
  - `config/settings.local.example.json`
  - `config/README.md`
- Wired `main.js` to resolved settings snapshot:
  - settings bootstrap on app ready,
  - memory/openclaw runtime initialization from settings,
  - config IPC exposure with source map and validation warnings/errors.
- Extended `openclaw-bridge.js`:
  - transport-aware runtime (`stub`/`http`),
  - non-loopback policy enforcement,
  - timeout/retry handling.
- Extended `memory-pipeline.js`:
  - non-destructive OpenClaw workspace policy in normal runtime,
  - explicit bootstrap method,
  - Markdown canonical decision logs + legacy JSONL migration.
- Added verification/ops scripts:
  - `scripts/check-settings-runtime.js`
  - `scripts/check-workspace-connectivity.js`
  - updated `scripts/check-openclaw-bridge.js`
  - updated `scripts/check-memory-pipeline.js`

## Visible App Outcome
- Runtime now logs resolved settings-driven behavior (adapter mode, roots, bridge mode/transport).
- Memory runtime and OpenClaw bridge behavior change deterministically from `config` + env overrides.
- Missing OpenClaw workspace files no longer get auto-created in normal runtime when integration is configured.

## Implementation Verification (Manual)
1. Run `npm run check` (includes settings/bridge/memory contract checks).
2. Run `npm run check:workspace` to inspect local prerequisite status summary.
3. Configure `config/settings.local.json` for local paths and re-run `npm start`; confirm:
   - startup logs show resolved modes/paths,
   - memory writes follow configured adapter and roots,
   - bridge transport/mode diagnostics reflect settings.
4. Optional bootstrap actions:
   - `npm run bootstrap:openclaw-workspace`
   - `npm run bootstrap:obsidian-vault`
5. Real-path validation evidence required before closing this deliverable:
   - OpenClaw in WSL reachable from configured endpoint/path.
   - Local Obsidian vault path is valid.
   - OpenClaw/Obsidian toggles verified in both enabled and disabled states.

## Manual Validation Evidence (2026-02-27)
- Configured local override (`config/settings.local.json`) with:
  - `paths.openClawWorkspaceRoot="\\\\wsl$\\Ubuntu-24.04\\home\\openclaw\\.openclaw\\workspace"`
  - `paths.obsidianVaultRoot="W:\\AI\\OpenClaw\\Memory\\Vault"`
  - `openclaw.transport="http"`
- WSL OpenClaw runtime check:
  - `wsl bash -lc "openclaw status --deep --json || openclaw status --deep"` reported `gateway.reachable=true` and `url=ws://127.0.0.1:18789`.
- Resolved WSL permission/access path issue:
  - `micster` already in `openclaw` group; `/home/openclaw/.openclaw` had restrictive permissions.
  - Updated Linux permissions to allow traversal and workspace access for group members:
    - `/home/openclaw/.openclaw` -> `drwx--x---`
    - `/home/openclaw/.openclaw/workspace` -> `drwxrws---`
- Workspace connectivity checks (elevated run required for UNC access in this environment):
  - `npm run check:workspace` => `openclaw.status=ready`, `obsidian.status=ready`.
  - `PET_OPENCLAW_ENABLED=0 npm run check:workspace` => `openclaw.status=disabled`.
  - `PET_MEMORY_ADAPTER=local npm run check:workspace` => `obsidian.status=not_requested`.
- Vault bootstrap evidence:
  - `npm run bootstrap:obsidian-vault` created:
    - `01_Logs`
    - `02_User`
    - `03_Primea`
    - `04_Analysis`
    - `99_System`
- Regression check:
  - `npm run check` passed (`check:syntax`, `check:contracts`, `check:layout`, `check:assets`).

## Automated Verification Evidence (2026-02-26)
- `npm run check` passed:
  - syntax checks include `settings-runtime.js`.
  - contract checks include:
    - OpenClaw stub + HTTP policy cases.
    - memory non-destructive workspace behavior + explicit bootstrap.
    - settings precedence + invalid JSON + policy warnings.

## Gate Status
- `Doc Gate`: `passed`
- `Implementation Gate`: `passed`
- `Overall`: `done`

## Change Log
- `2026-02-26`: Deliverable inserted and initialized as current execution target before D05 closeout.
- `2026-02-26`: Shipped settings/runtime/transport/bootstrap implementation slice and automated verification harness.
- `2026-02-27`: Captured real-path validation evidence against WSL OpenClaw workspace + local Obsidian vault, including enabled/disabled toggle checks.
- `2026-02-27`: Deliverable closed as `done` (`Doc Gate` and `Implementation Gate` both passed).
