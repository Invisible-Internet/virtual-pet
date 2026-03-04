"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  OBSERVABILITY_DETAIL_ACTION_IDS,
  buildObservabilityDetail,
  buildObservabilitySnapshot,
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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "virtual-pet-shell-repair-"));
  const localRoot = path.join(tempRoot, "local");
  const missingOpenClawRoot = path.join(tempRoot, "missing-openclaw");
  createWorkspace(localRoot, ["SOUL.md", "IDENTITY.md", "USER.md", "MEMORY.md"]);

  const snapshot = buildObservabilitySnapshot({
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
        enabled: true,
        transport: "http",
        mode: "offline",
        agentId: "main",
        baseUrl: "http://127.0.0.1:18789/bridge/dialog",
        authTokenConfigured: false,
      },
      paths: {
        localWorkspaceRoot: localRoot,
        openClawWorkspaceRoot: missingOpenClawRoot,
        obsidianVaultRoot: "W:\\AI\\OpenClaw\\Memory\\Vault",
      },
    },
    settingsSourceMap: {
      baseConfig: "config/settings.json",
      "paths.localWorkspaceRoot": "localConfig",
      "paths.openClawWorkspaceRoot": "localConfig",
    },
    settingsFiles: {
      baseConfigPath: "config/settings.json",
    },
    validationWarnings: [],
    validationErrors: [],
    resolvedPaths: {
      localRoot,
      openClawRoot: missingOpenClawRoot,
      obsidianRoot: "W:\\AI\\OpenClaw\\Memory\\Vault",
    },
    trayAvailable: true,
  });

  const localStyleDetail = buildObservabilityDetail({
    snapshot,
    subjectId: "canonicalFiles/local/STYLE.md",
    settingsSourceMap: {
      "paths.localWorkspaceRoot": "localConfig",
      "paths.openClawWorkspaceRoot": "localConfig",
    },
  });
  assertEqual(localStyleDetail.subject.subjectKind, "file", "local style detail should be file detail");
  assertEqual(
    localStyleDetail.summary.repairability,
    "guided",
    "missing local canonical file should be guided"
  );
  assert(
    localStyleDetail.actions.some(
      (action) =>
        action.actionId === OBSERVABILITY_DETAIL_ACTION_IDS.openSetup && action.enabled === true
    ),
    "missing local file should expose Open Setup action"
  );
  assert(
    localStyleDetail.provenance.some(
      (entry) => entry.kind === "path" && typeof entry.value === "string" && entry.value.includes("STYLE.md")
    ),
    "local file detail should include path provenance"
  );

  const openClawStyleDetail = buildObservabilityDetail({
    snapshot,
    subjectId: "canonicalFiles/openClaw/STYLE.md",
    settingsSourceMap: {
      "paths.localWorkspaceRoot": "localConfig",
      "paths.openClawWorkspaceRoot": "localConfig",
    },
  });
  assertEqual(
    openClawStyleDetail.summary.ownership,
    "observed_only",
    "openclaw file detail should stay observed-only"
  );
  assertEqual(
    openClawStyleDetail.summary.repairability,
    "observed_only",
    "openclaw file detail should never be guided"
  );
  assert(
    !openClawStyleDetail.actions.some(
      (action) => action.actionId === OBSERVABILITY_DETAIL_ACTION_IDS.openSetup
    ),
    "openclaw file detail must not expose Open Setup action"
  );

  const pathsDetail = buildObservabilityDetail({
    snapshot,
    subjectId: "paths",
    settingsSourceMap: {
      "paths.localWorkspaceRoot": "localConfig",
      "paths.openClawWorkspaceRoot": "localConfig",
    },
  });
  assert(
    pathsDetail.actions.some((action) => action.actionId === OBSERVABILITY_DETAIL_ACTION_IDS.copyPath),
    "paths detail should expose Copy Path action"
  );

  const fallbackDetail = buildObservabilityDetail({
    snapshot,
    subjectId: "not-a-real-subject",
    settingsSourceMap: {},
  });
  assertEqual(
    fallbackDetail.subject.subjectId,
    "bridge",
    "invalid subject should fall back to bridge"
  );

  fs.rmSync(tempRoot, { recursive: true, force: true });
  console.log("[shell-repair-actions] checks passed");
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
