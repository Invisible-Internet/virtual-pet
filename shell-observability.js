"use strict";

const fs = require("fs");
const path = require("path");
const { BRIDGE_TRANSPORTS, isLoopbackUrl } = require("./openclaw-bridge");

const CANONICAL_FILE_IDS = Object.freeze(["SOUL.md", "STYLE.md", "IDENTITY.md", "USER.md", "MEMORY.md"]);
const OBSERVABILITY_ROW_STATES = Object.freeze({
  healthy: "healthy",
  degraded: "degraded",
  failed: "failed",
  disabled: "disabled",
  unknown: "unknown",
});
const SHELL_WINDOW_TABS = Object.freeze({
  inventory: "inventory",
  status: "status",
  setup: "setup",
});

function toOptionalString(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeShellWindowTab(value, fallback = SHELL_WINDOW_TABS.inventory) {
  const normalized = toOptionalString(value, fallback);
  if (normalized === SHELL_WINDOW_TABS.status) {
    return SHELL_WINDOW_TABS.status;
  }
  if (normalized === SHELL_WINDOW_TABS.setup) {
    return SHELL_WINDOW_TABS.setup;
  }
  return SHELL_WINDOW_TABS.inventory;
}

function resolveShellWindowTabForAction(actionId, fallback = SHELL_WINDOW_TABS.inventory) {
  const normalizedActionId = toOptionalString(actionId, "");
  if (normalizedActionId === "open-status") {
    return SHELL_WINDOW_TABS.status;
  }
  if (normalizedActionId === "open-setup") {
    return SHELL_WINDOW_TABS.setup;
  }
  if (normalizedActionId === "open-inventory") {
    return SHELL_WINDOW_TABS.inventory;
  }
  return normalizeShellWindowTab(fallback, SHELL_WINDOW_TABS.inventory);
}

function mapCapabilityState(candidate) {
  switch (candidate) {
    case "healthy":
      return OBSERVABILITY_ROW_STATES.healthy;
    case "degraded":
    case "starting":
    case "stopping":
    case "stopped":
      return OBSERVABILITY_ROW_STATES.degraded;
    case "failed":
      return OBSERVABILITY_ROW_STATES.failed;
    case "disabled":
      return OBSERVABILITY_ROW_STATES.disabled;
    default:
      return OBSERVABILITY_ROW_STATES.unknown;
  }
}

function buildFileHealth(fileId, root) {
  const targetPath = root ? path.join(root, fileId) : null;
  if (!root) {
    return {
      fileId,
      present: false,
      readable: false,
      path: null,
      status: "root_not_configured",
    };
  }
  if (!fs.existsSync(root)) {
    return {
      fileId,
      present: false,
      readable: false,
      path: targetPath,
      status: "root_missing",
    };
  }
  if (!fs.existsSync(targetPath)) {
    return {
      fileId,
      present: false,
      readable: false,
      path: targetPath,
      status: "file_missing",
    };
  }
  try {
    fs.accessSync(targetPath, fs.constants.R_OK);
    return {
      fileId,
      present: true,
      readable: true,
      path: targetPath,
      status: "present",
    };
  } catch {
    return {
      fileId,
      present: true,
      readable: false,
      path: targetPath,
      status: "file_unreadable",
    };
  }
}

function buildWorkspaceFileHealth(root, configured = true) {
  const normalizedRoot = toOptionalString(root, null);
  const files = CANONICAL_FILE_IDS.map((fileId) => buildFileHealth(fileId, normalizedRoot));
  const presentCount = files.filter((entry) => entry.present).length;
  const readableCount = files.filter((entry) => entry.readable).length;
  return {
    configured,
    root: normalizedRoot,
    files,
    presentCount,
    readableCount,
  };
}

function deriveCanonicalFilesState(localWorkspace, openClawWorkspace) {
  if (!localWorkspace.root) {
    return {
      state: OBSERVABILITY_ROW_STATES.failed,
      reason: "local_workspace_unconfigured",
    };
  }
  if (!fs.existsSync(localWorkspace.root)) {
    return {
      state: OBSERVABILITY_ROW_STATES.failed,
      reason: "local_workspace_missing",
    };
  }
  const localIssues = localWorkspace.files.filter((entry) => !entry.readable);
  if (localIssues.length > 0) {
    return {
      state: OBSERVABILITY_ROW_STATES.degraded,
      reason: localIssues[0].status,
    };
  }
  if (openClawWorkspace.configured && openClawWorkspace.root) {
    if (!fs.existsSync(openClawWorkspace.root)) {
      return {
        state: OBSERVABILITY_ROW_STATES.degraded,
        reason: "openclaw_workspace_missing",
      };
    }
    const openClawIssues = openClawWorkspace.files.filter((entry) => !entry.readable);
    if (openClawIssues.length > 0) {
      return {
        state: OBSERVABILITY_ROW_STATES.degraded,
        reason: openClawIssues[0].status,
      };
    }
  }
  if (!openClawWorkspace.configured) {
    return {
      state: OBSERVABILITY_ROW_STATES.healthy,
      reason: "local_workspace_ready",
    };
  }
  return {
    state: OBSERVABILITY_ROW_STATES.healthy,
    reason: "canonical_files_ready",
  };
}

function buildActiveSettingsLayers(sourceMap = {}) {
  const layers = [];
  if (sourceMap && typeof sourceMap === "object") {
    if (sourceMap.baseConfig) layers.push("base");
    if (sourceMap.localConfig) layers.push("local");
    if (sourceMap.runtimeConfig) layers.push("runtime");
    if (Object.values(sourceMap).includes("env")) layers.push("env");
  }
  return layers;
}

function buildValidationRow(warnings = [], errors = []) {
  const warningCount = Array.isArray(warnings) ? warnings.length : 0;
  const errorCount = Array.isArray(errors) ? errors.length : 0;
  return {
    state:
      errorCount > 0
        ? OBSERVABILITY_ROW_STATES.failed
        : warningCount > 0
          ? OBSERVABILITY_ROW_STATES.degraded
          : OBSERVABILITY_ROW_STATES.healthy,
    reason:
      errorCount > 0
        ? "settings_validation_errors"
        : warningCount > 0
          ? "settings_validation_warnings"
          : "settings_valid",
    warningCount,
    errorCount,
    warnings: Array.isArray(warnings) ? warnings : [],
    errors: Array.isArray(errors) ? errors : [],
  };
}

function buildPathsRow({
  settingsSummary,
  settingsSourceMap,
  settingsFiles,
  resolvedPaths,
  validation,
}) {
  const activeLayers = buildActiveSettingsLayers(settingsSourceMap);
  return {
    state: validation.state,
    reason:
      validation.state === OBSERVABILITY_ROW_STATES.failed
        ? "path_validation_failed"
        : validation.state === OBSERVABILITY_ROW_STATES.degraded
          ? "path_validation_warnings"
          : "paths_ready",
    localWorkspaceRoot: toOptionalString(settingsSummary?.paths?.localWorkspaceRoot, null),
    openClawWorkspaceRoot: toOptionalString(settingsSummary?.paths?.openClawWorkspaceRoot, null),
    obsidianVaultRoot: toOptionalString(settingsSummary?.paths?.obsidianVaultRoot, null),
    resolvedPaths: resolvedPaths && typeof resolvedPaths === "object" ? resolvedPaths : {},
    settingsFiles: settingsFiles && typeof settingsFiles === "object" ? settingsFiles : {},
    sourceMap: settingsSourceMap && typeof settingsSourceMap === "object" ? settingsSourceMap : {},
    activeLayers,
  };
}

function buildBridgeRow({ settingsSummary, openclawCapabilityState }) {
  const openclaw = settingsSummary?.openclaw || {};
  const enabled = Boolean(openclaw.enabled);
  const transport = toOptionalString(openclaw.transport, BRIDGE_TRANSPORTS.stub) || BRIDGE_TRANSPORTS.stub;
  const endpoint = transport === BRIDGE_TRANSPORTS.http ? toOptionalString(openclaw.baseUrl, null) : null;
  const endpointClass =
    transport === BRIDGE_TRANSPORTS.stub
      ? "stub"
      : isLoopbackUrl(endpoint || "")
        ? "loopback"
        : "non-loopback";
  if (!enabled) {
    return {
      state: OBSERVABILITY_ROW_STATES.disabled,
      reason: "openclaw_disabled",
      transport,
      mode: toOptionalString(openclaw.mode, "offline") || "offline",
      endpoint,
      endpointClass,
      authConfigured: Boolean(openclaw.authTokenConfigured),
    };
  }

  const capabilityState = openclawCapabilityState && typeof openclawCapabilityState === "object"
    ? openclawCapabilityState
    : null;

  return {
    state: mapCapabilityState(capabilityState?.state),
    reason: toOptionalString(capabilityState?.reason, "bridge_status_unavailable"),
    transport,
    mode: toOptionalString(openclaw.mode, "unknown") || "unknown",
    endpoint,
    endpointClass,
    authConfigured: Boolean(openclaw.authTokenConfigured),
  };
}

function buildProviderRow({ settingsSummary, bridgeRow, ts }) {
  const openclaw = settingsSummary?.openclaw || {};
  if (!openclaw.enabled) {
    return {
      state: OBSERVABILITY_ROW_STATES.disabled,
      reason: "openclaw_disabled",
      providerLabel: null,
      modelLabel: null,
      source: "settings",
      lastUpdatedTs: 0,
      agentId: toOptionalString(openclaw.agentId, null),
    };
  }

  if (bridgeRow.transport === BRIDGE_TRANSPORTS.stub) {
    return {
      state: OBSERVABILITY_ROW_STATES.healthy,
      reason: "stub_provider_identity",
      providerLabel: "Stub Bridge",
      modelLabel: toOptionalString(openclaw.mode, "online") || "online",
      source: "settings",
      lastUpdatedTs: ts,
      agentId: toOptionalString(openclaw.agentId, null),
    };
  }

  return {
    state:
      bridgeRow.state === OBSERVABILITY_ROW_STATES.failed
        ? OBSERVABILITY_ROW_STATES.degraded
        : bridgeRow.state === OBSERVABILITY_ROW_STATES.disabled
          ? OBSERVABILITY_ROW_STATES.disabled
          : OBSERVABILITY_ROW_STATES.unknown,
    reason: "provider_identity_unavailable",
    providerLabel: null,
    modelLabel: null,
    source: "unknown",
    lastUpdatedTs: 0,
    agentId: toOptionalString(openclaw.agentId, null),
  };
}

function buildMemoryRow({ settingsSummary, memorySnapshot }) {
  const requestedAdapterMode =
    toOptionalString(memorySnapshot?.requestedAdapterMode, null) ||
    toOptionalString(settingsSummary?.memory?.adapterMode, "unknown") ||
    "unknown";
  const activeAdapterMode =
    toOptionalString(memorySnapshot?.activeAdapterMode, null) ||
    (settingsSummary?.memory?.enabled === false ? "disabled" : requestedAdapterMode);
  const fallbackReason = toOptionalString(memorySnapshot?.fallbackReason, "none") || "none";
  if (activeAdapterMode === "disabled") {
    return {
      state: OBSERVABILITY_ROW_STATES.disabled,
      reason: fallbackReason === "none" ? "memory_disabled" : fallbackReason,
      requestedAdapterMode,
      activeAdapterMode,
      fallbackReason,
      writeLegacyJsonl: Boolean(settingsSummary?.memory?.writeLegacyJsonl),
    };
  }
  if (fallbackReason !== "none" || activeAdapterMode !== requestedAdapterMode) {
    return {
      state: OBSERVABILITY_ROW_STATES.degraded,
      reason: fallbackReason !== "none" ? fallbackReason : "memory_adapter_fallback",
      requestedAdapterMode,
      activeAdapterMode,
      fallbackReason,
      writeLegacyJsonl: Boolean(settingsSummary?.memory?.writeLegacyJsonl),
    };
  }
  return {
    state: OBSERVABILITY_ROW_STATES.healthy,
    reason: "memory_runtime_ready",
    requestedAdapterMode,
    activeAdapterMode,
    fallbackReason,
    writeLegacyJsonl: Boolean(settingsSummary?.memory?.writeLegacyJsonl),
  };
}

function deriveRuntimeState(rows, capabilitySnapshotState = null) {
  const normalizedCapabilityState = mapCapabilityState(capabilitySnapshotState);
  if (
    normalizedCapabilityState === OBSERVABILITY_ROW_STATES.failed ||
    normalizedCapabilityState === OBSERVABILITY_ROW_STATES.degraded ||
    normalizedCapabilityState === OBSERVABILITY_ROW_STATES.healthy
  ) {
    return normalizedCapabilityState;
  }
  const rowStates = Object.values(rows).map((row) => row?.state || OBSERVABILITY_ROW_STATES.unknown);
  if (rowStates.includes(OBSERVABILITY_ROW_STATES.failed)) return OBSERVABILITY_ROW_STATES.failed;
  if (
    rowStates.includes(OBSERVABILITY_ROW_STATES.degraded) ||
    rowStates.includes(OBSERVABILITY_ROW_STATES.unknown)
  ) {
    return OBSERVABILITY_ROW_STATES.degraded;
  }
  if (rowStates.every((state) => state === OBSERVABILITY_ROW_STATES.disabled)) {
    return OBSERVABILITY_ROW_STATES.disabled;
  }
  return OBSERVABILITY_ROW_STATES.healthy;
}

function buildObservabilitySnapshot({
  capabilitySnapshot = null,
  openclawCapabilityState = null,
  memorySnapshot = null,
  settingsSummary = {},
  settingsSourceMap = {},
  settingsFiles = {},
  validationWarnings = [],
  validationErrors = [],
  resolvedPaths = {},
  trayAvailable = false,
  ts = Date.now(),
} = {}) {
  const validation = buildValidationRow(validationWarnings, validationErrors);
  const bridge = buildBridgeRow({
    settingsSummary,
    openclawCapabilityState,
  });
  const provider = buildProviderRow({
    settingsSummary,
    bridgeRow: bridge,
    ts,
  });
  const memory = buildMemoryRow({
    settingsSummary,
    memorySnapshot,
  });
  const localWorkspace = buildWorkspaceFileHealth(
    resolvedPaths?.localRoot || settingsSummary?.paths?.localWorkspaceRoot || null,
    true
  );
  const openClawWorkspaceConfigured = Boolean(
    resolvedPaths?.openClawRoot || settingsSummary?.paths?.openClawWorkspaceRoot
  );
  const openClawWorkspace = buildWorkspaceFileHealth(
    resolvedPaths?.openClawRoot || settingsSummary?.paths?.openClawWorkspaceRoot || null,
    openClawWorkspaceConfigured
  );
  const canonicalFilesState = deriveCanonicalFilesState(localWorkspace, openClawWorkspace);
  const canonicalFiles = {
    state: canonicalFilesState.state,
    reason: canonicalFilesState.reason,
    localWorkspace,
    openClawWorkspace,
  };
  const paths = buildPathsRow({
    settingsSummary,
    settingsSourceMap,
    settingsFiles,
    resolvedPaths,
    validation,
  });

  const rows = {
    bridge,
    provider,
    memory,
    canonicalFiles,
    paths,
    validation,
  };
  const runtimeState = deriveRuntimeState(rows, capabilitySnapshot?.runtimeState);
  const fallbackMode =
    memory.fallbackReason && memory.fallbackReason !== "none"
      ? memory.fallbackReason
      : bridge.state !== OBSERVABILITY_ROW_STATES.healthy && bridge.state !== OBSERVABILITY_ROW_STATES.disabled
        ? bridge.reason
        : "none";

  return {
    kind: "observabilitySnapshot",
    ts,
    overview: {
      runtimeState,
      fallbackMode,
      trayAvailable: Boolean(trayAvailable),
      source: "runtime",
    },
    rows,
  };
}

module.exports = {
  CANONICAL_FILE_IDS,
  OBSERVABILITY_ROW_STATES,
  SHELL_WINDOW_TABS,
  buildObservabilitySnapshot,
  normalizeShellWindowTab,
  resolveShellWindowTabForAction,
};
