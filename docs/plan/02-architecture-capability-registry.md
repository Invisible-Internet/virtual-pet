# Deliverable 02: Architecture Capability Registry

**Deliverable ID:** `02-architecture-capability-registry`  
**Status:** `in_progress`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `01-gap-analysis-expansion-vs-current`, `09-decisions-log`  
**Blocks:** `02b-extension-framework-and-pack-sdk`, `03-pet-core-events-intents-suggestions`, `04-openclaw-bridge-spec`, `05-memory-pipeline-and-obsidian-adapter`  
**Verification Gate:** `Capability contract, lifecycle, status model, and fallback semantics are documented, implemented as a runtime registry slice, and internally consistent`

## Objective
Define the built-in capability registry architecture that makes integrations optional and failure-tolerant.

## In Scope
- Capability interface contract.
- Lifecycle (`start/stop/health`).
- Runtime status model.
- Enable/disable behavior.
- Fallback/degraded behavior rules.
- Capability boundaries for architecture layers:
  - Renderer runtime boundary (retain Canvas baseline for v2 scope).
  - Pet brain/state machine boundary (deterministic local authority).
  - Sensor boundary (main-process normalized event producers).
  - OpenClaw bridge boundary (advisory/orchestration only).
- Desktop shell boundary:
  - Taskbar/tray icon + settings menu capability ownership.
  - Wardrobe/costume/accessory capability ownership and dependency model.
- Conversation/speech boundary:
  - `dialogUi` capability (speech bubble/chatbox input/output).
  - `voiceIo` capability (STT/TTS adapters with health/degraded status).
  - `lipSync` capability (audio-activity driven approximation; non-blocking).
- Background job and autonomy boundary:
  - `jobScheduler` capability (daily summary runs, maintenance jobs, and job-status reporting for introspection).
  - Autonomy policy enforcement boundary (immutable identity protection and mutation transparency policy).
- Extension framework boundary ownership:
  - `extensionRegistry` capability (discover/load/enable/disable extension packs).
  - `permissionManager` capability (permission visibility + warning model).
  - `propWorld` capability (desktop-anchored props and interaction routing).
  - `behaviorArbitrator` capability (single-authority conflict resolution for extension-origin actions).
  - `extensionHookHost` capability (trusted hook runtime boundary).
  - `extensionStore` capability (scoped persistence and quota governance).

## Out of Scope
- Dynamic third-party loading of capability-engine modules.
- Production capability implementations.

## Dependencies
- D01 gap mapping.
- Locked decisions from D09.

## Decisions Locked
- Built-in capability registry for v1.
- No dynamic plugin loading for capability-engine modules in v1.
- Extension packs (props/state/context/hook packs) are specified separately in D02b and do not replace core capability ownership.
- Degraded mode is mandatory for all capability failures.

## Implementation Breakdown
1. Define capability interface schema and state machine.
2. Define capability registration and boot order.
3. Define intent routing responsibilities.
4. Define global health and telemetry shape.
5. Define fallback behavior per capability class.
6. Define capability map for `renderer`, `brain`, `sensors`, `openclawBridge`, `desktopShell`, `wardrobe`, `dialogUi`, `voiceIo`, `lipSync`, `jobScheduler`, `extensionRegistry`, `permissionManager`, `propWorld`, `behaviorArbitrator`, `extensionHookHost`, `extensionStore`.
7. Define degraded behavior expectations for extension-related capabilities without violating core runtime invariants.

## Verification Gate
Pass when all are true:
1. Interface contract is explicit and versioned.
2. Status transitions are deterministic.
3. Failures cannot block core pet runtime.
4. Routing ownership is unambiguous.
5. Desktop shell, conversation/speech, wardrobe, and background job ownership boundaries are documented with failure fallbacks.
6. Extension framework capability ownership boundaries are explicit and non-conflicting with core authority model.
7. A capability registry runtime scaffold is implemented in app code with lifecycle/status reporting hooks.
8. At least one degraded capability path is visible in runtime logs/output without crashing pet baseline behavior.

## Tangible Acceptance Test (Doc-Level)
1. A capability map table exists with one row for each required capability class.
2. Reviewer can trace one failure scenario per capability and confirm documented degraded behavior.
3. Reviewer can trace one extension-capability outage scenario (for example: `propWorld` unavailable) and confirm deterministic fallback.

## Implementation Slice (Mandatory)
- Build a minimal `capabilityRegistry` runtime scaffold in main process code.
- Register at least baseline capabilities: `renderer`, `brain`, `sensors`, `openclawBridge`.
- Expose capability state snapshots to diagnostics/log output with deterministic states (`healthy`, `degraded`, `failed`, etc.).
- Ensure failed optional capability startup does not block app launch or drag/fling runtime behavior.

## Visible App Outcome
- When app starts, logs show capability registration and lifecycle transitions.
- When one optional capability is forced unavailable, logs show degraded/fallback state while pet still renders and moves.
- Diagnostics surface (or console when diagnostics enabled) shows current capability status summary.

## Implementation Verification (Manual)
1. Start app normally and confirm capability startup states are logged.
2. Force one optional capability unavailable (stub/flag) and confirm `degraded` or `failed` state is reported.
3. Confirm pet still launches, drags, and flings with unchanged baseline movement invariants.
4. Confirm no uncaught exception terminates app during capability startup failure path.

## Gate Status
- `Doc Gate`: `in_progress`
- `Implementation Gate`: `not_started`
- `Overall`: `in_progress`

## Open Questions
- Should capability state persist across restarts in v1 or derive from config only?

## Working Draft (v0.1)
This section is the first pass for D02 implementation-level documentation.

## Capability Interface Contract (Draft v1)
All capabilities implement a common runtime contract:

| Field / Method | Type | Required | Description |
| --- | --- | --- | --- |
| `capabilityId` | `string` | Yes | Stable unique id (for example `renderer`, `openclawBridge`). |
| `contractVersion` | `string` | Yes | Interface version (start at `1.0`). |
| `dependsOn` | `string[]` | No | Hard dependencies that must be healthy/degraded before start. |
| `optionalDependsOn` | `string[]` | No | Soft dependencies used when available. |
| `defaultEnabled` | `boolean` | Yes | Default enabled state for boot. |
| `start(ctx)` | `async fn` | Yes | Starts capability and returns initial status snapshot. |
| `stop(ctx)` | `async fn` | Yes | Stops capability and releases resources. |
| `health()` | `async fn` | Yes | Returns health payload with `state` and diagnostic metadata. |
| `onConfigChanged(nextConfig)` | `fn` | No | Applies runtime config changes without full restart when possible. |
| `degradedPolicy` | `object` | Yes | Declares deterministic fallback behavior when unavailable or failed. |
| `telemetryTags` | `string[]` | No | Structured tags used in logs/introspection summaries. |

Required status payload shape:

| Field | Type | Description |
| --- | --- | --- |
| `capabilityId` | `string` | Echoes capability id. |
| `state` | `disabled \| starting \| healthy \| degraded \| failed \| stopping \| stopped` | Current lifecycle state. |
| `enabled` | `boolean` | Effective enabled flag. |
| `ts` | `number` | Unix ms timestamp for snapshot emission. |
| `reason` | `string` | Short state reason code (for example `missing_dependency`, `timeout`, `manual_disable`). |
| `details` | `object` | Capability-specific bounded diagnostics. |

## Lifecycle and Status Model (Draft v1)
Allowed states:

| State | Meaning | Core Runtime Impact |
| --- | --- | --- |
| `disabled` | Capability intentionally off by config or user toggle. | No crash; routing avoids capability. |
| `starting` | Boot/init in progress. | Calls may queue, fallback, or short-circuit by policy. |
| `healthy` | Capability operating within expected bounds. | Normal routing. |
| `degraded` | Capability partially available or missing optional dependency. | Fallback path active; core runtime remains deterministic. |
| `failed` | Capability unavailable due to unrecoverable startup/runtime error. | Hard switch to degraded fallback; no process crash. |
| `stopping` | Shutdown in progress. | New work rejected; in-flight work drains/cancels by policy. |
| `stopped` | Fully stopped after shutdown. | No work accepted. |

Deterministic transition rules:
1. `disabled -> starting` only when enabled by config/user action.
2. `starting -> healthy|degraded|failed` must resolve with explicit `reason`.
3. `healthy -> degraded|failed` on health probe failure thresholds.
4. `degraded -> healthy` allowed after successful dependency recovery.
5. `failed -> starting` only through supervised retry/backoff policy.
6. `any -> stopping -> stopped` during app shutdown or explicit disable.
7. Transition loops must be rate-limited and logged to avoid retry thrash.

## Registration and Boot Order (Draft v1)
Boot phases:

| Phase | Capabilities | Notes |
| --- | --- | --- |
| `P0-core` | `renderer`, `brain` | Mandatory for pet baseline runtime. |
| `P1-input` | `sensors`, `desktopShell`, `dialogUi` | User interaction + shell entry points. |
| `P2-voice-jobs` | `voiceIo`, `lipSync`, `jobScheduler` | Optional enhancements with degraded defaults. |
| `P3-extension` | `extensionRegistry`, `permissionManager`, `extensionStore`, `extensionHookHost`, `propWorld`, `behaviorArbitrator` | Extension feature stack with explicit fallback routing. |
| `P4-online` | `openclawBridge` | Must never block P0-P3 availability. |
| `P5-domain` | `wardrobe` | Can start earlier if dependencies are healthy; ordered here for deterministic fallback checks. |

Boot policy:
1. Start by phase order, but continue boot when non-core capabilities degrade/fail.
2. `renderer` and `brain` are the only startup blockers for app "ready" state.
3. All other capabilities must expose degraded behavior for partial boot.

## Capability Map (Draft v1)
| Capability | Process Owner | Primary Responsibility | Dependencies | Degraded Behavior |
| --- | --- | --- | --- | --- |
| `renderer` | Renderer process | Draw pet visuals and interactive canvas runtime. | none | Show minimal placeholder render mode; maintain drag/motion data path. |
| `brain` | Main process | Deterministic state authority and intent arbitration entrypoint. | `renderer` | Fall back to minimal state set (`Idle` + drag/fly impact) with deterministic local rules. |
| `sensors` | Main process | Normalize input/media/time/idle facts into events. | none | Emit only locally available facts with source labels (`unknown` fallback where needed). |
| `openclawBridge` | Main process | Advisory orchestration for dialogue/integration intents. | network/service availability | Route to local fallback responses and maintain non-authority guarantees. |
| `desktopShell` | Main process | Tray/taskbar/settings shell entry points. | none | Expose defaults through config file only; runtime remains controllable. |
| `wardrobe` | Renderer + main config | Outfit/accessory selection and fallback resolution. | `renderer`, asset loader | Use base/default outfit and ignore missing optional accessories. |
| `dialogUi` | Renderer process | Chat input/output and bubble display surface. | `renderer` | Keep text-only minimal panel/bubble fallback; no voice dependency. |
| `voiceIo` | Main/adapter boundary | STT/TTS adapters and voice transport. | OS/service adapters | Disable voice path and keep text-first conversation mode. |
| `lipSync` | Renderer process | Speech-activity mouth animation approximation. | `voiceIo` optional, `dialogUi` | Use talk-SFX/idle-mouth fallback animation when speech activity unavailable. |
| `jobScheduler` | Main process | Recurring jobs (maintenance, summaries, bounded autonomy jobs). | clock/timer + optional `openclawBridge` | Run local-only safe jobs; defer online-dependent jobs with reason logging. |
| `extensionRegistry` | Main process | Discover/validate/load/enable extension packs. | file system paths | Skip invalid/missing packs; continue with core-only runtime. |
| `permissionManager` | Main process + UI surface | Permission visibility, warning flow, and enable/disable gating. | `extensionRegistry` | Default deny sensitive permissions and surface warning state. |
| `propWorld` | Main process + window manager | Desktop-anchored prop placement and interaction routing. | `extensionRegistry`, `behaviorArbitrator` | Disable prop interactions; keep pet core behaviors active. |
| `behaviorArbitrator` | Main process | Resolve extension-origin and core intent conflicts under local authority. | `brain`, `extensionRegistry` | Force core-priority-only policy; reject extension-origin conflicting intents. |
| `extensionHookHost` | Main process | Execute trusted extension hooks within bounded interface. | `extensionRegistry`, `permissionManager` | Disable hook execution and continue manifest-only behavior. |
| `extensionStore` | Main process | Scoped extension persistence with quotas/governance. | file system | Use in-memory ephemeral storage with warning; block unsafe writes. |

## Failure Scenarios and Deterministic Fallbacks (Draft v1)
| Capability | Example Failure | Expected Fallback Result |
| --- | --- | --- |
| `renderer` | Sprite sheet load failure or render exception | Switch to minimal procedural render mode; keep motion/state authority in main process. |
| `brain` | Non-fatal internal contract error in advisory path | Continue with reduced local state transitions; reject ambiguous intents. |
| `sensors` | Media source unavailable (no GSMTC data) | Emit events with `source=unknown` and skip media-specific transitions. |
| `openclawBridge` | Timeout or service unavailable | Respond via local fallback dialogue/introspection path with `source=offline`. |
| `desktopShell` | Tray creation fails | App remains running; settings reachable through default local config path. |
| `wardrobe` | Missing outfit asset | Revert to base/default outfit; log missing asset warning only. |
| `dialogUi` | Chat panel component failure | Keep lightweight bubble output path and local command fallback. |
| `voiceIo` | STT/TTS adapter missing | Disable voice controls and maintain text input/output flow. |
| `lipSync` | Audio activity unavailable | Use simple talk state pulse or idle-mouth fallback. |
| `jobScheduler` | Job runner exception | Isolate failed job, continue scheduler heartbeat, and report job status as degraded. |
| `extensionRegistry` | Invalid manifest in `extensions/` | Mark extension invalid, continue loading remaining valid packs. |
| `permissionManager` | Permission metadata missing | Default to restrictive permissions and block sensitive actions. |
| `propWorld` | Desktop anchor window creation fails | Disable prop placement; extension pack remains loaded where non-prop features exist. |
| `behaviorArbitrator` | Conflict resolution rule error | Apply core-only priority and drop extension-origin conflicting actions. |
| `extensionHookHost` | Hook throws runtime exception | Quarantine failing extension hook and continue manifest-declarative behavior. |
| `extensionStore` | Write quota exceeded or path unavailable | Reject write with non-fatal warning; continue runtime with read-only behavior. |

## Global Health Snapshot Shape (Draft v1)
```json
{
  "ts": 0,
  "runtimeState": "healthy|degraded",
  "capabilities": [
    {
      "capabilityId": "renderer",
      "state": "healthy",
      "enabled": true,
      "reason": "ok",
      "details": {}
    }
  ],
  "summary": {
    "healthyCount": 0,
    "degradedCount": 0,
    "failedCount": 0,
    "disabledCount": 0
  }
}
```

## Verification Progress (Draft Tracking)
- [x] Interface contract fields drafted with versioning and status payload shape.
- [x] Lifecycle state model and transition rules drafted.
- [x] Capability map includes all required capability classes from D02 scope.
- [x] One failure scenario per capability drafted with deterministic fallback.
- [ ] Failure-mode walkthroughs need trace-level examples for reviewer validation.
- [ ] Telemetry/introspection payload boundaries need final detail limits.

## Change Log
- `2026-02-26`: File created and seeded.
- `2026-02-26`: Advanced to `in_progress`; added first-pass draft for capability interface contract, lifecycle/status model, boot order, capability map, failure/fallback matrix, and global health payload.
- `2026-02-26`: Updated to dual-gate (`Doc Gate` + `Implementation Gate`) workflow with mandatory implementation slice and visible outcome sections.
