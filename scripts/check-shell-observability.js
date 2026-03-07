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
  assertEqual(
    healthy.rows.memory.lastOfflineRecall?.recallType,
    "identity_name",
    "memory row should include normalized last recall type"
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

  const degraded = buildObservabilitySnapshot({
    capabilitySnapshot: {
      runtimeState: "degraded",
      capabilities: [],
    },
    openclawCapabilityState: {
      state: "failed",
      reason: "startupError",
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
