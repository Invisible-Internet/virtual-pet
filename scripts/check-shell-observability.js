"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  SHELL_WINDOW_TABS,
  buildObservabilityDetail,
  buildObservabilitySnapshot,
  resolveShellWindowTabForAction,
} = require("../shell-observability");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} (expected "${expected}", got "${actual}")`);
  }
}

function createWorkspace(root, files) {
  fs.mkdirSync(root, { recursive: true });
  for (const fileId of files) {
    fs.writeFileSync(path.join(root, fileId), `# ${fileId}\n`, "utf8");
  }
}

function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "virtual-pet-observability-"));
  const localRoot = path.join(tempRoot, "local");
  createWorkspace(localRoot, ["SOUL.md", "STYLE.md", "IDENTITY.md", "USER.md", "MEMORY.md"]);

  const healthy = buildObservabilitySnapshot({
    capabilitySnapshot: {
      runtimeState: "healthy",
      capabilities: [],
    },
    openclawCapabilityState: {
      state: "healthy",
      reason: "httpConfigured",
    },
    behaviorSnapshot: {
      roamMode: "desktop",
      roamPhase: "rest",
      decisionReason: "desktop_avoidance_active",
      pacingReason: "pacing_rest_window",
      pacingDelayMs: 3200,
      fallbackReason: "none",
      reentryReason: "none",
      monitorAvoidMs: 45000,
      nextDecisionAtMs: 1700000002200,
      activeAvoidedDisplays: [
        {
          displayId: "1001",
          remainingMs: 18000,
          expiresAtMs: 1700000019000,
          sourceReason: "manual_drag_monitor_correction",
        },
      ],
      lastManualCorrection: {
        fromDisplayId: "1001",
        toDisplayId: "1002",
        recordedAtMs: 1700000001400,
      },
    },
    memorySnapshot: {
      requestedAdapterMode: "obsidian",
      activeAdapterMode: "obsidian",
      fallbackReason: "none",
      lastOfflineRecall: {
        ts: 1700000000999,
        recallType: "identity_name",
        degradedReason: "none",
        evidenceTags: ["identity.name"],
      },
      lastOfflinePersonaReply: {
        ts: 1700000001222,
        intent: "smalltalk",
        personaState: "ready",
        personaReason: "none",
        personaMode: "gentle_companion",
        selectionHash: "abc12345",
        styleProfile: {
          warmth: "high",
          playfulness: "low",
          curiosity: "high",
          openerStyle: "warm_reflective",
          closerStyle: "supportive_note",
          emojiPolicy: "none",
        },
      },
      lastPersonaSnapshot: {
        builtAt: 1700000001333,
        schemaVersion: "vp-persona-snapshot-v1",
        state: "ready",
        degradedReason: "none",
        derivedFrom: ["SOUL.md", "STYLE.md", "IDENTITY.md", "USER.md", "MEMORY.md"],
        fieldCount: 8,
        fieldKeys: [
          "pet_name",
          "pet_pronouns",
        ],
      },
      lastPersonaExport: {
        ts: 1700000001666,
        mode: "online_dialog",
        schemaVersion: "vp-persona-export-v1",
        snapshotVersion: "vp-persona-snapshot-v1",
        state: "ready",
        degradedReason: "none",
        summary: "Persona ready for Nori.",
        fieldCount: 2,
        byteSize: 480,
        highlightCount: 1,
        facts: [
          {
            key: "pet_name",
            value: "Nori",
            provenanceTag: "IDENTITY.md:Name",
          },
          {
            key: "pet_pronouns",
            value: "she/her",
            provenanceTag: "IDENTITY.md:Pronouns",
          },
        ],
      },
      lastProactivePolicy: {
        ts: 1700000001777,
        proactiveState: "suppressed",
        lastAttemptReason: "suppressed_dialog_open",
        suppressionReason: "suppressed_dialog_open",
        backoffTier: 2,
        cooldownMs: 720000,
        cooldownRemainingMs: 210000,
        nextEligibleAt: 1700000211777,
        repeatGuardWindowMs: 1800000,
        lastOpenerHash: "def67890",
        awaitingUserEngagement: true,
      },
    },
    settingsSummary: {
      memory: {
        enabled: true,
        adapterMode: "obsidian",
        writeLegacyJsonl: false,
      },
      openclaw: {
        enabled: true,
        transport: "http",
        mode: "online",
        agentId: "main",
        baseUrl: "http://127.0.0.1:18789/bridge/dialog",
        authTokenConfigured: false,
      },
      paths: {
        localWorkspaceRoot: localRoot,
        openClawWorkspaceRoot: null,
        obsidianVaultRoot: "W:\\AI\\OpenClaw\\Memory\\Vault",
      },
    },
    settingsSourceMap: {
      baseConfig: "config/settings.json",
      localConfig: "config/settings.local.json",
      "paths.localWorkspaceRoot": "env",
    },
    settingsFiles: {
      baseConfigPath: "config/settings.json",
      localConfigPath: "config/settings.local.json",
    },
    validationWarnings: [],
    validationErrors: [],
    resolvedPaths: {
      localRoot,
      openClawRoot: null,
      obsidianRoot: "W:\\AI\\OpenClaw\\Memory\\Vault",
    },
    trayAvailable: true,
  });

  assertEqual(healthy.overview.runtimeState, "healthy", "healthy snapshot runtime state mismatch");
  assertEqual(healthy.rows.bridge.state, "healthy", "bridge row should be healthy");
  assertEqual(healthy.rows.memory.state, "healthy", "memory row should be healthy");
  assertEqual(healthy.rows.behavior.state, "healthy", "behavior row should be healthy");
  assertEqual(
    healthy.rows.behavior.avoidCount,
    1,
    "behavior row should include one active avoided display"
  );
  assertEqual(
    healthy.rows.memory.lastOfflineRecall?.recallType,
    "identity_name",
    "memory row should include normalized last recall type"
  );
  assertEqual(
    healthy.rows.memory.lastPersonaSnapshot?.schemaVersion,
    "vp-persona-snapshot-v1",
    "memory row should include normalized persona snapshot summary"
  );
  assertEqual(
    healthy.rows.memory.lastPersonaExport?.mode,
    "online_dialog",
    "memory row should include normalized persona export metadata"
  );
  assertEqual(
    healthy.rows.canonicalFiles.localWorkspace.readableCount,
    5,
    "local canonical files should be readable"
  );
  assert(
    healthy.rows.paths.activeLayers.includes("env"),
    "paths row should include env as an active layer"
  );
  const memoryDetail = buildObservabilityDetail({
    snapshot: healthy,
    subjectId: "memory",
    settingsSourceMap: {},
  });
  assert(
    memoryDetail.provenance.some(
      (entry) => entry.label === "Last Recall Type" && entry.value === "identity name"
    ),
    "memory detail should include last recall provenance"
  );
  assert(
    memoryDetail.provenance.some(
      (entry) => entry.label === "Last Persona Export Mode" && entry.value === "online dialog"
    ),
    "memory detail should include persona export mode provenance"
  );
  assert(
    memoryDetail.provenance.some(
      (entry) => entry.label === "Last Offline Persona Intent" && entry.value === "smalltalk"
    ),
    "memory detail should include offline persona intent provenance"
  );
  assert(
    memoryDetail.provenance.some(
      (entry) => entry.label === "Last Proactive Reason" && entry.value === "suppressed dialog open"
    ),
    "memory detail should include proactive reason provenance"
  );
  assert(
    memoryDetail.provenance.some(
      (entry) =>
        entry.label === "Next Proactive Eligible In" &&
        typeof entry.value === "string" &&
        entry.value.length > 0
    ),
    "memory detail should include proactive countdown provenance"
  );
  const behaviorDetail = buildObservabilityDetail({
    snapshot: healthy,
    subjectId: "behavior",
    settingsSourceMap: {},
  });
  assert(
    behaviorDetail.provenance.some(
      (entry) =>
        entry.label === "Decision Reason" && entry.value === "desktop avoidance active"
    ),
    "behavior detail should include decision reason provenance"
  );
  assert(
    behaviorDetail.provenance.some(
      (entry) => entry.label === "Display 1001"
    ),
    "behavior detail should include avoided display provenance"
  );

  const personaSnapshotDegraded = buildObservabilitySnapshot({
    capabilitySnapshot: {
      runtimeState: "degraded",
      capabilities: [],
    },
    openclawCapabilityState: {
      state: "healthy",
      reason: "requestSuccess",
    },
    behaviorSnapshot: {
      roamMode: "desktop",
      roamPhase: "rest",
      decisionReason: "desktop_nominal",
      pacingReason: "pacing_rest_window",
      pacingDelayMs: 2800,
      fallbackReason: "none",
      reentryReason: "none",
      monitorAvoidMs: 45000,
      nextDecisionAtMs: 1700000003000,
      activeAvoidedDisplays: [],
    },
    memorySnapshot: {
      requestedAdapterMode: "obsidian",
      activeAdapterMode: "obsidian",
      fallbackReason: "none",
      lastPersonaSnapshot: {
        builtAt: 1700000002000,
        schemaVersion: "vp-persona-snapshot-v1",
        state: "degraded",
        degradedReason: "canonical_missing",
        derivedFrom: ["STYLE.md", "MEMORY.md"],
        fieldCount: 2,
        fieldKeys: ["tone_keywords"],
      },
    },
    settingsSummary: {
      memory: {
        enabled: true,
        adapterMode: "obsidian",
        writeLegacyJsonl: false,
      },
      openclaw: {
        enabled: true,
        transport: "http",
        mode: "online",
        agentId: "main",
        baseUrl: "http://127.0.0.1:18789/bridge/dialog",
        authTokenConfigured: false,
      },
      paths: {
        localWorkspaceRoot: localRoot,
        openClawWorkspaceRoot: null,
        obsidianVaultRoot: "W:\\AI\\OpenClaw\\Memory\\Vault",
      },
    },
    settingsSourceMap: {
      baseConfig: "config/settings.json",
    },
    settingsFiles: {
      baseConfigPath: "config/settings.json",
    },
    validationWarnings: [],
    validationErrors: [],
    resolvedPaths: {
      localRoot,
      openClawRoot: null,
      obsidianRoot: "W:\\AI\\OpenClaw\\Memory\\Vault",
    },
    trayAvailable: true,
  });
  assertEqual(
    personaSnapshotDegraded.rows.memory.state,
    "degraded",
    "memory row should degrade when persona snapshot is degraded"
  );
  assertEqual(
    personaSnapshotDegraded.rows.memory.reason,
    "persona_snapshot_canonical_missing",
    "memory row reason should include persona degraded reason"
  );

  const degraded = buildObservabilitySnapshot({
    capabilitySnapshot: {
      runtimeState: "degraded",
      capabilities: [],
    },
    openclawCapabilityState: {
      state: "failed",
      reason: "startupError",
    },
    behaviorSnapshot: {
      roamMode: "desktop",
      roamPhase: "rest",
      decisionReason: "avoidance_exhausted_fallback",
      pacingReason: "pacing_retry_window",
      pacingDelayMs: 4200,
      fallbackReason: "avoidance_exhausted_fallback",
      reentryReason: "none",
      monitorAvoidMs: 45000,
      nextDecisionAtMs: 1700000004200,
      activeAvoidedDisplays: [
        {
          displayId: "1001",
          remainingMs: 2000,
          expiresAtMs: 1700000005000,
          sourceReason: "manual_drag_monitor_correction",
        },
        {
          displayId: "1002",
          remainingMs: 2100,
          expiresAtMs: 1700000005100,
          sourceReason: "manual_fling_monitor_correction",
        },
      ],
    },
    memorySnapshot: {
      requestedAdapterMode: "obsidian",
      activeAdapterMode: "local",
      fallbackReason: "startup_failed",
    },
    settingsSummary: {
      memory: {
        enabled: true,
        adapterMode: "obsidian",
        writeLegacyJsonl: true,
      },
      openclaw: {
        enabled: true,
        transport: "http",
        mode: "offline",
        agentId: "main",
        baseUrl: "http://127.0.0.1:18789/bridge/dialog",
        authTokenConfigured: false,
      },
      paths: {
        localWorkspaceRoot: localRoot,
        openClawWorkspaceRoot: path.join(tempRoot, "missing-openclaw"),
        obsidianVaultRoot: "W:\\AI\\OpenClaw\\Memory\\Vault",
      },
    },
    settingsSourceMap: {
      baseConfig: "config/settings.json",
    },
    settingsFiles: {
      baseConfigPath: "config/settings.json",
    },
    validationWarnings: ["[settings] OpenClaw workspace root does not exist yet; runtime will stay non-destructive."],
    validationErrors: [],
    resolvedPaths: {
      localRoot,
      openClawRoot: path.join(tempRoot, "missing-openclaw"),
      obsidianRoot: "W:\\AI\\OpenClaw\\Memory\\Vault",
    },
    trayAvailable: false,
  });

  assertEqual(degraded.overview.runtimeState, "degraded", "degraded snapshot runtime state mismatch");
  assertEqual(degraded.rows.bridge.state, "failed", "failed bridge should surface");
  assertEqual(degraded.rows.provider.state, "degraded", "provider row should degrade when bridge fails");
  assertEqual(degraded.rows.memory.state, "degraded", "memory fallback should degrade");
  assertEqual(
    degraded.rows.behavior.state,
    "degraded",
    "behavior row should degrade when fallback is active"
  );
  assertEqual(
    degraded.rows.behavior.reason,
    "avoidance_exhausted_fallback",
    "behavior degraded reason should surface fallback"
  );
  assertEqual(
    degraded.rows.validation.state,
    "degraded",
    "validation warnings should degrade the validation row"
  );
  assertEqual(
    degraded.rows.paths.state,
    "degraded",
    "path warnings should degrade the paths row"
  );

  const disabled = buildObservabilitySnapshot({
    capabilitySnapshot: {
      runtimeState: "degraded",
      capabilities: [],
    },
    openclawCapabilityState: {
      state: "healthy",
      reason: "requestSuccess",
    },
    behaviorSnapshot: {
      roamMode: "zone",
      roamPhase: "idle",
      decisionReason: "none",
      pacingReason: "none",
      pacingDelayMs: 0,
      fallbackReason: "none",
      reentryReason: "none",
      monitorAvoidMs: 45000,
      nextDecisionAtMs: 0,
      activeAvoidedDisplays: [],
    },
    memorySnapshot: {
      requestedAdapterMode: "obsidian",
      activeAdapterMode: "obsidian",
      fallbackReason: "none",
    },
    settingsSummary: {
      memory: {
        enabled: true,
        adapterMode: "obsidian",
        writeLegacyJsonl: false,
      },
      openclaw: {
        enabled: false,
        transport: "ws",
        mode: "online",
        agentId: "main",
        baseUrl: "ws://127.0.0.1:18789",
        authTokenConfigured: false,
      },
      paths: {
        localWorkspaceRoot: localRoot,
        openClawWorkspaceRoot: null,
        obsidianVaultRoot: "W:\\AI\\OpenClaw\\Memory\\Vault",
      },
    },
    settingsSourceMap: {
      baseConfig: "config/settings.json",
    },
    settingsFiles: {
      baseConfigPath: "config/settings.json",
    },
    validationWarnings: [],
    validationErrors: [],
    resolvedPaths: {
      localRoot,
      openClawRoot: null,
      obsidianRoot: "W:\\AI\\OpenClaw\\Memory\\Vault",
    },
    trayAvailable: true,
  });
  assertEqual(disabled.rows.bridge.state, "disabled", "bridge row should disable when openclaw is disabled");
  assertEqual(disabled.rows.bridge.mode, "offline", "disabled bridge should always report offline mode");
  assertEqual(
    disabled.rows.behavior.state,
    "disabled",
    "behavior row should disable outside desktop roam mode"
  );

  assertEqual(
    resolveShellWindowTabForAction("open-inventory", SHELL_WINDOW_TABS.status),
    SHELL_WINDOW_TABS.inventory,
    "inventory action should route to inventory tab"
  );
  assertEqual(
    resolveShellWindowTabForAction("open-status", SHELL_WINDOW_TABS.inventory),
    SHELL_WINDOW_TABS.status,
    "status action should route to status tab"
  );
  assertEqual(
    resolveShellWindowTabForAction("open-setup", SHELL_WINDOW_TABS.inventory),
    SHELL_WINDOW_TABS.setup,
    "setup action should route to setup tab"
  );
  assertEqual(
    resolveShellWindowTabForAction("open-settings", SHELL_WINDOW_TABS.inventory),
    SHELL_WINDOW_TABS.settings,
    "settings action should route to settings tab"
  );

  fs.rmSync(tempRoot, { recursive: true, force: true });
  console.log("[shell-observability] checks passed");
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error.message || String(error));
    process.exit(1);
  }
}

module.exports = {
  run,
};
