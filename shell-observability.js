"use strict";

const fs = require("fs");
const path = require("path");
const { BRIDGE_TRANSPORTS, isLoopbackUrl } = require("./openclaw-bridge");
const { MANAGED_BLOCK_START, MANAGED_BLOCK_END } = require("./setup-bootstrap");

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
  settings: "settings",
});
const OBSERVABILITY_SUBJECT_IDS = Object.freeze({
  bridge: "bridge",
  provider: "provider",
  memory: "memory",
  canonicalFiles: "canonicalFiles",
  paths: "paths",
  validation: "validation",
});
const DEFAULT_OBSERVABILITY_SUBJECT_ID = OBSERVABILITY_SUBJECT_IDS.bridge;
const OBSERVABILITY_DETAIL_ACTION_IDS = Object.freeze({
  refreshStatus: "refresh_status",
  openSetup: "open_setup",
  copyPath: "copy_path",
  copyDetails: "copy_details",
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
  if (normalized === SHELL_WINDOW_TABS.settings) {
    return SHELL_WINDOW_TABS.settings;
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
  if (normalizedActionId === "open-settings") {
    return SHELL_WINDOW_TABS.settings;
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

function toSentence(value, fallback = "unknown") {
  const text = toOptionalString(value, fallback) || fallback;
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStateLabel(value) {
  return toSentence(value || OBSERVABILITY_ROW_STATES.unknown, "unknown");
}

function normalizeReasonLabel(value) {
  return toSentence(value || "unknown_reason", "unknown reason");
}

function toStatePill(state, fallback = OBSERVABILITY_ROW_STATES.unknown) {
  switch (state) {
    case OBSERVABILITY_ROW_STATES.healthy:
    case OBSERVABILITY_ROW_STATES.degraded:
    case OBSERVABILITY_ROW_STATES.failed:
    case OBSERVABILITY_ROW_STATES.disabled:
    case OBSERVABILITY_ROW_STATES.unknown:
      return state;
    default:
      return fallback;
  }
}

function getPathSource(settingsSourceMap, pathKey) {
  const source =
    settingsSourceMap && typeof settingsSourceMap === "object"
      ? settingsSourceMap[`paths.${pathKey}`]
      : null;
  return toOptionalString(source, "unknown");
}

function getWorkspaceKey(workspaceId) {
  if (workspaceId === "openClaw") return "openClawWorkspace";
  return "localWorkspace";
}

function getWorkspacePathKey(workspaceId) {
  if (workspaceId === "openClaw") return "openClawWorkspaceRoot";
  return "localWorkspaceRoot";
}

function resolveCanonicalSubject(rawSubjectId, rows) {
  const canonicalRow = rows?.canonicalFiles || {};
  const tokens = String(rawSubjectId || "").split("/");
  const workspaceId = tokens[1] === "openClaw" ? "openClaw" : tokens[1] === "local" ? "local" : null;
  if (!workspaceId) return null;
  const workspace = canonicalRow[getWorkspaceKey(workspaceId)];
  if (!workspace || typeof workspace !== "object") return null;
  const fileId = tokens.length >= 3 ? tokens.slice(2).join("/") : null;
  if (fileId && !CANONICAL_FILE_IDS.includes(fileId)) return null;
  return {
    subjectKind: fileId ? "file" : "workspace",
    subjectId: fileId ? `canonicalFiles/${workspaceId}/${fileId}` : `canonicalFiles/${workspaceId}`,
    rowId: OBSERVABILITY_SUBJECT_IDS.canonicalFiles,
    workspaceId,
    fileId,
    workspace,
  };
}

function resolveObservabilitySubjectId(subjectId, rows) {
  const normalized = toOptionalString(subjectId, DEFAULT_OBSERVABILITY_SUBJECT_ID);
  if (!normalized) return { subjectId: DEFAULT_OBSERVABILITY_SUBJECT_ID, subjectKind: "row" };
  if (normalized.startsWith("canonicalFiles/")) {
    const resolved = resolveCanonicalSubject(normalized, rows);
    if (resolved) return resolved;
  }
  if (normalized === OBSERVABILITY_SUBJECT_IDS.canonicalFiles) {
    return {
      subjectKind: "row",
      subjectId: OBSERVABILITY_SUBJECT_IDS.canonicalFiles,
      rowId: OBSERVABILITY_SUBJECT_IDS.canonicalFiles,
      workspaceId: null,
      fileId: null,
    };
  }
  if (
    normalized === OBSERVABILITY_SUBJECT_IDS.bridge ||
    normalized === OBSERVABILITY_SUBJECT_IDS.provider ||
    normalized === OBSERVABILITY_SUBJECT_IDS.memory ||
    normalized === OBSERVABILITY_SUBJECT_IDS.paths ||
    normalized === OBSERVABILITY_SUBJECT_IDS.validation
  ) {
    return {
      subjectKind: "row",
      subjectId: normalized,
      rowId: normalized,
      workspaceId: null,
      fileId: null,
    };
  }
  return {
    subjectKind: "row",
    subjectId: DEFAULT_OBSERVABILITY_SUBJECT_ID,
    rowId: DEFAULT_OBSERVABILITY_SUBJECT_ID,
    workspaceId: null,
    fileId: null,
  };
}

function buildDetailAction(actionId, label, kind = "secondary", enabled = true) {
  return {
    actionId,
    label,
    kind,
    enabled: Boolean(enabled),
  };
}

function buildDetailActions({ allowOpenSetup = false, hasPath = false } = {}) {
  const actions = [];
  if (allowOpenSetup) {
    actions.push(
      buildDetailAction(
        OBSERVABILITY_DETAIL_ACTION_IDS.openSetup,
        "Open Setup",
        "primary",
        true
      )
    );
    actions.push(
      buildDetailAction(
        OBSERVABILITY_DETAIL_ACTION_IDS.refreshStatus,
        "Refresh Status",
        "secondary",
        true
      )
    );
  } else {
    actions.push(
      buildDetailAction(
        OBSERVABILITY_DETAIL_ACTION_IDS.refreshStatus,
        "Refresh Status",
        "primary",
        true
      )
    );
  }
  if (hasPath) {
    actions.push(
      buildDetailAction(
        OBSERVABILITY_DETAIL_ACTION_IDS.copyPath,
        "Copy Path",
        "secondary",
        true
      )
    );
  }
  actions.push(
    buildDetailAction(
      OBSERVABILITY_DETAIL_ACTION_IDS.copyDetails,
      "Copy Details",
      "secondary",
      true
    )
  );
  return actions;
}

function findFirstUnreadableFile(workspace) {
  if (!workspace || !Array.isArray(workspace.files)) return null;
  return workspace.files.find((entry) => !entry.readable) || null;
}

function mapCanonicalWorkspaceState(workspaceId, workspace) {
  if (!workspace?.root) {
    return workspaceId === "local"
      ? OBSERVABILITY_ROW_STATES.failed
      : OBSERVABILITY_ROW_STATES.degraded;
  }
  if (!fs.existsSync(workspace.root)) {
    return workspaceId === "local"
      ? OBSERVABILITY_ROW_STATES.failed
      : OBSERVABILITY_ROW_STATES.degraded;
  }
  const issue = findFirstUnreadableFile(workspace);
  if (issue) return OBSERVABILITY_ROW_STATES.degraded;
  return OBSERVABILITY_ROW_STATES.healthy;
}

function deriveManagedBlockState(file) {
  if (!file?.readable || !file?.path) return "not_checked";
  try {
    const content = fs.readFileSync(file.path, "utf8");
    return content.includes(MANAGED_BLOCK_START) && content.includes(MANAGED_BLOCK_END)
      ? "managed_block_present"
      : "managed_block_missing";
  } catch {
    return "managed_block_unreadable";
  }
}

function buildCanonicalRepairability({
  workspaceId,
  workspace,
  file,
  managedBlockState = "not_checked",
}) {
  if (workspaceId === "openClaw") return "observed_only";
  if (!workspace?.root || !fs.existsSync(workspace.root)) return "manual";
  if (file) {
    if (file.status === "file_missing") return "guided";
    if (managedBlockState === "managed_block_missing") return "guided";
    return file.readable ? "refresh_only" : "manual";
  }
  const unreadable = findFirstUnreadableFile(workspace);
  if (!unreadable) return "refresh_only";
  if (unreadable.status === "file_missing") return "guided";
  return "manual";
}

function buildRowDetail({
  rowId,
  row,
  settingsSourceMap,
}) {
  const state = toStatePill(row?.state);
  let label = "Status Row";
  let headline = "Status row detail is available.";
  let impact = "Use Refresh Status to confirm the latest runtime data.";
  let ownership = "manual_runtime";
  const provenance = [];
  const suggestedSteps = ["Press Refresh Status to re-check this row."];

  if (rowId === OBSERVABILITY_SUBJECT_IDS.bridge) {
    label = "OpenClaw Bridge";
    headline = `OpenClaw bridge is ${normalizeStateLabel(state)}.`;
    impact = "Bridge state controls whether online advisory responses are available.";
    provenance.push(
      { label: "Transport", kind: "runtime", value: toSentence(row?.transport, "unknown") },
      { label: "Mode", kind: "runtime", value: toSentence(row?.mode, "unknown") },
      { label: "Reason", kind: "runtime", value: normalizeReasonLabel(row?.reason) }
    );
    if (row?.endpoint) {
      provenance.push({ label: "Endpoint", kind: "path", value: row.endpoint });
    }
  } else if (rowId === OBSERVABILITY_SUBJECT_IDS.provider) {
    label = "Provider / Model";
    headline = `Provider identity is ${normalizeStateLabel(state)}.`;
    impact = "Provider/model identity explains which LLM path is currently visible.";
    provenance.push(
      { label: "Provider", kind: "runtime", value: toSentence(row?.providerLabel, "unavailable") },
      { label: "Model", kind: "runtime", value: toSentence(row?.modelLabel, "unavailable") },
      { label: "Source", kind: "runtime", value: toSentence(row?.source, "unknown") },
      { label: "Reason", kind: "runtime", value: normalizeReasonLabel(row?.reason) }
    );
  } else if (rowId === OBSERVABILITY_SUBJECT_IDS.memory) {
    label = "Memory Runtime";
    headline = `Memory runtime is ${normalizeStateLabel(state)}.`;
    impact = "Memory mode controls whether runtime writes stay in the requested adapter.";
    provenance.push(
      {
        label: "Requested Adapter",
        kind: "runtime",
        value: toSentence(row?.requestedAdapterMode, "unknown"),
      },
      {
        label: "Active Adapter",
        kind: "runtime",
        value: toSentence(row?.activeAdapterMode, "unknown"),
      },
      { label: "Fallback", kind: "runtime", value: toSentence(row?.fallbackReason, "none") },
      { label: "Reason", kind: "runtime", value: normalizeReasonLabel(row?.reason) }
    );
  } else if (rowId === OBSERVABILITY_SUBJECT_IDS.paths) {
    label = "Paths / Sources";
    headline = `Path configuration is ${normalizeStateLabel(state)}.`;
    impact = "Path roots decide where the app reads canonical files and observed context.";
    const localRoot = toOptionalString(row?.localWorkspaceRoot, null);
    const openClawRoot = toOptionalString(row?.openClawWorkspaceRoot, null);
    const obsidianRoot = toOptionalString(row?.obsidianVaultRoot, null);
    if (localRoot) provenance.push({ label: "Local Root", kind: "path", value: localRoot });
    if (openClawRoot) provenance.push({ label: "OpenClaw Root", kind: "path", value: openClawRoot });
    if (obsidianRoot) provenance.push({ label: "Obsidian Root", kind: "path", value: obsidianRoot });
    provenance.push(
      {
        label: "Local Root Source",
        kind: "settings",
        value: getPathSource(settingsSourceMap, "localWorkspaceRoot"),
      },
      {
        label: "OpenClaw Root Source",
        kind: "settings",
        value: getPathSource(settingsSourceMap, "openClawWorkspaceRoot"),
      },
      {
        label: "Obsidian Root Source",
        kind: "settings",
        value: getPathSource(settingsSourceMap, "obsidianVaultRoot"),
      },
      { label: "Reason", kind: "runtime", value: normalizeReasonLabel(row?.reason) }
    );
    suggestedSteps.length = 0;
    suggestedSteps.push(
      "Confirm path values in settings and env overrides, then press Refresh Status."
    );
  } else if (rowId === OBSERVABILITY_SUBJECT_IDS.validation) {
    label = "Validation";
    headline = `Validation is ${normalizeStateLabel(state)}.`;
    impact = "Warnings/errors explain configuration drift before runtime failures spread.";
    provenance.push(
      { label: "Warnings", kind: "runtime", value: String(row?.warningCount || 0) },
      { label: "Errors", kind: "runtime", value: String(row?.errorCount || 0) },
      {
        label: "First Warning",
        kind: "runtime",
        value: toSentence(row?.warnings?.[0], "none"),
      },
      {
        label: "First Error",
        kind: "runtime",
        value: toSentence(row?.errors?.[0], "none"),
      },
      { label: "Reason", kind: "runtime", value: normalizeReasonLabel(row?.reason) }
    );
    suggestedSteps.length = 0;
    suggestedSteps.push("Fix the reported validation issue, then press Refresh Status.");
  } else {
    label = "OpenClaw Bridge";
    headline = `OpenClaw bridge is ${normalizeStateLabel(state)}.`;
    provenance.push({ label: "Reason", kind: "runtime", value: normalizeReasonLabel(row?.reason) });
  }

  const hasPath = provenance.some(
    (entry) => entry.kind === "path" && toOptionalString(entry.value, null)
  );
  return {
    subject: {
      subjectId: rowId,
      subjectKind: "row",
      rowId,
      workspaceId: null,
      fileId: null,
      label,
      state,
      reason: toOptionalString(row?.reason, "unknown"),
    },
    summary: {
      headline,
      impact,
      ownership,
      repairability: "refresh_only",
    },
    provenance,
    suggestedSteps,
    actions: buildDetailActions({ allowOpenSetup: false, hasPath }),
  };
}

function buildCanonicalRowDetail({ row, settingsSourceMap }) {
  const localWorkspace = row?.localWorkspace || {};
  const openClawWorkspace = row?.openClawWorkspace || {};
  const state = toStatePill(row?.state);
  const localIssue = findFirstUnreadableFile(localWorkspace);
  const repairability = buildCanonicalRepairability({
    workspaceId: "local",
    workspace: localWorkspace,
    file: localIssue,
  });
  const allowOpenSetup = repairability === "guided";
  const provenance = [
    {
      label: "Local Root",
      kind: "path",
      value: toOptionalString(localWorkspace?.root, "Unavailable"),
    },
    {
      label: "Local Root Source",
      kind: "settings",
      value: getPathSource(settingsSourceMap, "localWorkspaceRoot"),
    },
    {
      label: "OpenClaw Root",
      kind: "path",
      value: toOptionalString(openClawWorkspace?.root, "Unavailable"),
    },
    {
      label: "OpenClaw Root Source",
      kind: "settings",
      value: getPathSource(settingsSourceMap, "openClawWorkspaceRoot"),
    },
    {
      label: "Local Readable",
      kind: "runtime",
      value: `${localWorkspace?.readableCount || 0}/${Array.isArray(localWorkspace?.files) ? localWorkspace.files.length : 0}`,
    },
    {
      label: "OpenClaw Readable",
      kind: "runtime",
      value: openClawWorkspace?.configured
        ? `${openClawWorkspace?.readableCount || 0}/${Array.isArray(openClawWorkspace?.files) ? openClawWorkspace.files.length : 0}`
        : "not_configured",
    },
    { label: "Reason", kind: "runtime", value: normalizeReasonLabel(row?.reason) },
  ];
  const hasPath = provenance.some(
    (entry) =>
      entry.kind === "path" &&
      toOptionalString(entry.value, null) &&
      entry.value !== "Unavailable"
  );
  return {
    subject: {
      subjectId: OBSERVABILITY_SUBJECT_IDS.canonicalFiles,
      subjectKind: "row",
      rowId: OBSERVABILITY_SUBJECT_IDS.canonicalFiles,
      workspaceId: null,
      fileId: null,
      label: "Canonical Files",
      state,
      reason: toOptionalString(row?.reason, "unknown"),
    },
    summary: {
      headline: `Canonical file health is ${normalizeStateLabel(state)}.`,
      impact: "Canonical files are the pet's local identity baseline and observed OpenClaw context.",
      ownership: "manual_runtime",
      repairability,
    },
    provenance,
    suggestedSteps:
      repairability === "guided"
        ? ["Open Setup, preview, and save to restore local managed canonical files."]
        : ["Press Refresh Status after repairing file/path issues."],
    actions: buildDetailActions({ allowOpenSetup, hasPath }),
  };
}

function buildCanonicalWorkspaceDetail({
  workspaceId,
  workspace,
  rowReason,
  settingsSourceMap,
}) {
  const state = mapCanonicalWorkspaceState(workspaceId, workspace);
  const issue = findFirstUnreadableFile(workspace);
  const repairability = buildCanonicalRepairability({
    workspaceId,
    workspace,
    file: issue,
  });
  const allowOpenSetup = repairability === "guided";
  const settingsPathKey = getWorkspacePathKey(workspaceId);
  const roleLabel =
    workspaceId === "local"
      ? "Pet-local canonical source"
      : "Observed OpenClaw workspace context";
  const provenance = [
    { label: "Workspace Role", kind: "role", value: roleLabel },
    { label: "Root", kind: "path", value: toOptionalString(workspace?.root, "Unavailable") },
    {
      label: "Settings Source",
      kind: "settings",
      value: getPathSource(settingsSourceMap, settingsPathKey),
    },
    {
      label: "Readable Files",
      kind: "runtime",
      value: `${workspace?.readableCount || 0}/${Array.isArray(workspace?.files) ? workspace.files.length : 0}`,
    },
    {
      label: "Reason",
      kind: "runtime",
      value: issue ? normalizeReasonLabel(issue.status) : normalizeReasonLabel(rowReason),
    },
  ];
  const hasPath = provenance.some(
    (entry) =>
      entry.kind === "path" &&
      toOptionalString(entry.value, null) &&
      entry.value !== "Unavailable"
  );
  return {
    subject: {
      subjectId: `canonicalFiles/${workspaceId}`,
      subjectKind: "workspace",
      rowId: OBSERVABILITY_SUBJECT_IDS.canonicalFiles,
      workspaceId,
      fileId: null,
      label: workspaceId === "local" ? "Local Canonical Workspace" : "OpenClaw Workspace",
      state,
      reason: issue ? issue.status : toOptionalString(rowReason, "unknown"),
    },
    summary: {
      headline:
        workspaceId === "local"
          ? `Local canonical workspace is ${normalizeStateLabel(state)}.`
          : `OpenClaw observed workspace is ${normalizeStateLabel(state)}.`,
      impact:
        workspaceId === "local"
          ? "Local files are the direct virtual-pet identity source."
          : "OpenClaw workspace status is informational/observed-only for this app slice.",
      ownership: workspaceId === "local" ? "local_managed" : "observed_only",
      repairability,
    },
    provenance,
    suggestedSteps:
      repairability === "guided"
        ? ["Open Setup and save to restore missing local canonical files."]
        : workspaceId === "openClaw"
          ? ["Repair this OpenClaw path outside the pet app, then press Refresh Status."]
          : ["Repair local path or permissions, then press Refresh Status."],
    actions: buildDetailActions({ allowOpenSetup, hasPath }),
  };
}

function buildCanonicalFileDetail({
  workspaceId,
  workspace,
  fileId,
  settingsSourceMap,
}) {
  const file = Array.isArray(workspace?.files)
    ? workspace.files.find((entry) => entry?.fileId === fileId) || null
    : null;
  const fallbackStatus = file ? file.status : "file_unavailable";
  const state = file
    ? file.readable
      ? OBSERVABILITY_ROW_STATES.healthy
      : workspaceId === "local" &&
          (file.status === "root_not_configured" || file.status === "root_missing")
        ? OBSERVABILITY_ROW_STATES.failed
        : OBSERVABILITY_ROW_STATES.degraded
    : OBSERVABILITY_ROW_STATES.unknown;
  const managedBlockState =
    workspaceId === "local" ? deriveManagedBlockState(file) : "not_checked";
  const repairability = buildCanonicalRepairability({
    workspaceId,
    workspace,
    file,
    managedBlockState,
  });
  const allowOpenSetup = repairability === "guided";
  const settingsPathKey = getWorkspacePathKey(workspaceId);
  const provenance = [
    {
      label: "Observed Path",
      kind: "path",
      value: file?.path || toOptionalString(workspace?.root, "Unavailable"),
    },
    {
      label: "Workspace Role",
      kind: "role",
      value:
        workspaceId === "local"
          ? "Pet-local canonical source"
          : "Observed OpenClaw workspace context",
    },
    {
      label: "Settings Source",
      kind: "settings",
      value: getPathSource(settingsSourceMap, settingsPathKey),
    },
    {
      label: "File Status",
      kind: "runtime",
      value: normalizeReasonLabel(fallbackStatus),
    },
  ];
  if (workspaceId === "local") {
    provenance.push({
      label: "Setup Block",
      kind: "ownership",
      value: normalizeReasonLabel(managedBlockState),
    });
  }
  const hasPath = provenance.some(
    (entry) =>
      entry.kind === "path" &&
      toOptionalString(entry.value, null) &&
      entry.value !== "Unavailable"
  );
  return {
    subject: {
      subjectId: `canonicalFiles/${workspaceId}/${fileId}`,
      subjectKind: "file",
      rowId: OBSERVABILITY_SUBJECT_IDS.canonicalFiles,
      workspaceId,
      fileId,
      label: `${workspaceId === "local" ? "Local" : "OpenClaw"} ${fileId}`,
      state,
      reason: fallbackStatus,
    },
    summary: {
      headline: `${workspaceId === "local" ? "Local" : "OpenClaw"} ${fileId} is ${normalizeStateLabel(state)}.`,
      impact:
        workspaceId === "local"
          ? "This file contributes to local pet identity and continuity."
          : "This file is visible for OpenClaw context only (read-only observation).",
      ownership: workspaceId === "local" ? "local_managed" : "observed_only",
      repairability,
    },
    provenance,
    suggestedSteps:
      repairability === "guided"
        ? ["Open Setup, preview, and save to restore this local managed file."]
        : workspaceId === "openClaw"
          ? ["Repair this file/path outside the pet app, then press Refresh Status."]
          : ["Repair local path/permissions, then press Refresh Status."],
    actions: buildDetailActions({ allowOpenSetup, hasPath }),
  };
}

function buildObservabilityDetail({
  snapshot = null,
  subjectId = DEFAULT_OBSERVABILITY_SUBJECT_ID,
  settingsSourceMap = {},
  ts = Date.now(),
} = {}) {
  const rows = snapshot?.rows && typeof snapshot.rows === "object" ? snapshot.rows : {};
  const resolvedSubject = resolveObservabilitySubjectId(subjectId, rows);
  let detail;
  if (resolvedSubject.subjectKind === "file") {
    detail = buildCanonicalFileDetail({
      workspaceId: resolvedSubject.workspaceId,
      workspace: resolvedSubject.workspace,
      fileId: resolvedSubject.fileId,
      settingsSourceMap,
    });
  } else if (resolvedSubject.subjectKind === "workspace") {
    detail = buildCanonicalWorkspaceDetail({
      workspaceId: resolvedSubject.workspaceId,
      workspace: resolvedSubject.workspace,
      rowReason: rows?.canonicalFiles?.reason,
      settingsSourceMap,
    });
  } else if (resolvedSubject.subjectId === OBSERVABILITY_SUBJECT_IDS.canonicalFiles) {
    detail = buildCanonicalRowDetail({
      row: rows?.canonicalFiles || {},
      settingsSourceMap,
    });
  } else {
    detail = buildRowDetail({
      rowId: resolvedSubject.subjectId,
      row: rows?.[resolvedSubject.subjectId] || {},
      settingsSourceMap,
    });
  }

  return {
    kind: "observabilityDetail",
    ts,
    subject: detail.subject,
    summary: detail.summary,
    provenance: detail.provenance,
    suggestedSteps: detail.suggestedSteps,
    actions: detail.actions,
  };
}

module.exports = {
  CANONICAL_FILE_IDS,
  DEFAULT_OBSERVABILITY_SUBJECT_ID,
  OBSERVABILITY_DETAIL_ACTION_IDS,
  OBSERVABILITY_ROW_STATES,
  OBSERVABILITY_SUBJECT_IDS,
  SHELL_WINDOW_TABS,
  buildObservabilityDetail,
  buildObservabilitySnapshot,
  normalizeShellWindowTab,
  resolveShellWindowTabForAction,
};
