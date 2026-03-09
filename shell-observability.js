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
  behavior: "behavior",
  canonicalFiles: "canonicalFiles",
  paths: "paths",
  validation: "validation",
});
const DEFAULT_OBSERVABILITY_SUBJECT_ID = OBSERVABILITY_SUBJECT_IDS.bridge;
const OBSERVABILITY_DETAIL_ACTION_IDS = Object.freeze({
  refreshStatus: "refresh_status",
  openSetup: "open_setup",
  openSettings: "open_settings",
  startPairingQr: "start_pairing_qr",
  copyPairingCode: "copy_pairing_code",
  retryPairing: "retry_pairing",
  runPairingProbe: "run_pairing_probe",
  runReflectionNow: "run_reflection_now",
  copyPath: "copy_path",
  copyDetails: "copy_details",
});
const PAIRING_STATES = Object.freeze({
  notStarted: "not_started",
  challengeReady: "challenge_ready",
  pendingApproval: "pending_approval",
  paired: "paired",
  challengeExpired: "challenge_expired",
  failed: "failed",
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
  const endpoint =
    transport === BRIDGE_TRANSPORTS.http || transport === BRIDGE_TRANSPORTS.ws
      ? toOptionalString(openclaw.baseUrl, null)
      : null;
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
      mode: "offline",
      endpoint,
      endpointClass,
      authConfigured: Boolean(openclaw.authTokenConfigured),
      petCommandAuthConfigured: Boolean(openclaw.petCommandSharedSecretConfigured),
      petCommandAuthSource: toOptionalString(openclaw.petCommandSharedSecretSource, "none"),
      petCommandKeyId: toOptionalString(openclaw.petCommandKeyId, null),
      petCommandSharedSecretRef: toOptionalString(openclaw.petCommandSharedSecretRef, null),
      petCommandNonceCacheSize: Number.isFinite(Number(openclaw.petCommandNonceCacheSize))
        ? Math.max(0, Math.round(Number(openclaw.petCommandNonceCacheSize)))
        : 0,
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
    petCommandAuthConfigured: Boolean(openclaw.petCommandSharedSecretConfigured),
    petCommandAuthSource: toOptionalString(openclaw.petCommandSharedSecretSource, "none"),
    petCommandKeyId: toOptionalString(openclaw.petCommandKeyId, null),
    petCommandSharedSecretRef: toOptionalString(openclaw.petCommandSharedSecretRef, null),
    petCommandNonceCacheSize: Number.isFinite(Number(openclaw.petCommandNonceCacheSize))
      ? Math.max(0, Math.round(Number(openclaw.petCommandNonceCacheSize)))
      : 0,
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

function normalizeOfflineRecall(value) {
  if (!value || typeof value !== "object") return null;
  const recallType = toOptionalString(value.recallType, null);
  if (!recallType) return null;
  const evidenceTags = Array.isArray(value.evidenceTags)
    ? value.evidenceTags
        .map((entry) => toOptionalString(entry, ""))
        .filter(Boolean)
        .slice(0, 6)
    : [];
  return {
    ts: Number.isFinite(Number(value.ts)) ? Math.max(0, Math.round(Number(value.ts))) : 0,
    recallType,
    degradedReason: toOptionalString(value.degradedReason, "none") || "none",
    evidenceTags,
  };
}

function normalizeOfflinePersonaReply(value) {
  if (!value || typeof value !== "object") return null;
  const intent = toOptionalString(value.intent, null);
  if (!intent) return null;
  const styleProfile = value.styleProfile && typeof value.styleProfile === "object" ? value.styleProfile : {};
  return {
    ts: Number.isFinite(Number(value.ts)) ? Math.max(0, Math.round(Number(value.ts))) : 0,
    intent,
    personaState: toOptionalString(value.personaState, "degraded"),
    personaReason: toOptionalString(value.personaReason, "parse_incomplete"),
    personaMode: toOptionalString(value.personaMode, "neutral_fallback"),
    selectionHash: toOptionalString(value.selectionHash, "none"),
    styleProfile: {
      warmth: toOptionalString(styleProfile.warmth, "medium"),
      playfulness: toOptionalString(styleProfile.playfulness, "low"),
      curiosity: toOptionalString(styleProfile.curiosity, "medium"),
      openerStyle: toOptionalString(styleProfile.openerStyle, "direct"),
      closerStyle: toOptionalString(styleProfile.closerStyle, "none"),
      emojiPolicy: toOptionalString(styleProfile.emojiPolicy, "none"),
    },
  };
}

function normalizeProactivePolicy(value) {
  if (!value || typeof value !== "object") return null;
  return {
    ts: Number.isFinite(Number(value.ts)) ? Math.max(0, Math.round(Number(value.ts))) : 0,
    proactiveState: toOptionalString(value.proactiveState, "eligible"),
    lastAttemptReason: toOptionalString(value.lastAttemptReason, "none"),
    suppressionReason: toOptionalString(value.suppressionReason, "none"),
    backoffTier: Number.isFinite(Number(value.backoffTier))
      ? Math.max(0, Math.round(Number(value.backoffTier)))
      : 0,
    cooldownMs: Number.isFinite(Number(value.cooldownMs))
      ? Math.max(0, Math.round(Number(value.cooldownMs)))
      : 0,
    cooldownRemainingMs: Number.isFinite(Number(value.cooldownRemainingMs))
      ? Math.max(0, Math.round(Number(value.cooldownRemainingMs)))
      : 0,
    nextEligibleAt: Number.isFinite(Number(value.nextEligibleAt))
      ? Math.max(0, Math.round(Number(value.nextEligibleAt)))
      : 0,
    repeatGuardWindowMs: Number.isFinite(Number(value.repeatGuardWindowMs))
      ? Math.max(0, Math.round(Number(value.repeatGuardWindowMs)))
      : 0,
    lastOpenerHash: toOptionalString(value.lastOpenerHash, "none"),
    awaitingUserEngagement: Boolean(value.awaitingUserEngagement),
  };
}

function normalizeReflectionRuntime(value) {
  if (!value || typeof value !== "object") return null;
  const lastRunRaw = value.lastRun && typeof value.lastRun === "object" ? value.lastRun : null;
  const lastRun = lastRunRaw
    ? {
        cycleId: toOptionalString(lastRunRaw.cycleId, "heartbeat"),
        outcome: toOptionalString(lastRunRaw.outcome, "suppressed"),
        reason: toOptionalString(lastRunRaw.reason, "none"),
        startedAtMs: Number.isFinite(Number(lastRunRaw.startedAtMs))
          ? Math.max(0, Math.round(Number(lastRunRaw.startedAtMs)))
          : 0,
        completedAtMs: Number.isFinite(Number(lastRunRaw.completedAtMs))
          ? Math.max(0, Math.round(Number(lastRunRaw.completedAtMs)))
          : 0,
        scheduledAtMs: Number.isFinite(Number(lastRunRaw.scheduledAtMs))
          ? Math.max(0, Math.round(Number(lastRunRaw.scheduledAtMs)))
          : 0,
        acceptedIntentCount: Number.isFinite(Number(lastRunRaw.acceptedIntentCount))
          ? Math.max(0, Math.round(Number(lastRunRaw.acceptedIntentCount)))
          : 0,
        deferredIntentCount: Number.isFinite(Number(lastRunRaw.deferredIntentCount))
          ? Math.max(0, Math.round(Number(lastRunRaw.deferredIntentCount)))
          : 0,
        rejectedIntentCount: Number.isFinite(Number(lastRunRaw.rejectedIntentCount))
          ? Math.max(0, Math.round(Number(lastRunRaw.rejectedIntentCount)))
          : 0,
        isRetry: lastRunRaw.isRetry === true,
      }
    : null;
  return {
    ts: Number.isFinite(Number(value.ts)) ? Math.max(0, Math.round(Number(value.ts))) : 0,
    state: toOptionalString(value.state, "idle"),
    reason: toOptionalString(value.reason, "none"),
    nextHeartbeatAtMs: Number.isFinite(Number(value.nextHeartbeatAtMs))
      ? Math.max(0, Math.round(Number(value.nextHeartbeatAtMs)))
      : 0,
    nextDigestAtMs: Number.isFinite(Number(value.nextDigestAtMs))
      ? Math.max(0, Math.round(Number(value.nextDigestAtMs)))
      : 0,
    retryHeartbeatAtMs: Number.isFinite(Number(value.retryHeartbeatAtMs))
      ? Math.max(0, Math.round(Number(value.retryHeartbeatAtMs)))
      : 0,
    retryDigestAtMs: Number.isFinite(Number(value.retryDigestAtMs))
      ? Math.max(0, Math.round(Number(value.retryDigestAtMs)))
      : 0,
    inFlightCycleId: toOptionalString(value?.inFlight?.cycleId, null),
    inFlightStartedAtMs: Number.isFinite(Number(value?.inFlight?.startedAtMs))
      ? Math.max(0, Math.round(Number(value.inFlight.startedAtMs)))
      : 0,
    lastHeartbeatRunAtMs: Number.isFinite(Number(value.lastHeartbeatRunAtMs))
      ? Math.max(0, Math.round(Number(value.lastHeartbeatRunAtMs)))
      : 0,
    lastDigestRunAtMs: Number.isFinite(Number(value.lastDigestRunAtMs))
      ? Math.max(0, Math.round(Number(value.lastDigestRunAtMs)))
      : 0,
    rehydratedFromLogs: value.rehydratedFromLogs === true,
    rehydratedEntryCount: Number.isFinite(Number(value.rehydratedEntryCount))
      ? Math.max(0, Math.round(Number(value.rehydratedEntryCount)))
      : 0,
    lastRun,
  };
}

function normalizePersonaSnapshot(value) {
  if (!value || typeof value !== "object") return null;
  const schemaVersion = toOptionalString(value.schemaVersion, null);
  if (!schemaVersion) return null;
  const derivedFrom = Array.isArray(value.derivedFrom)
    ? value.derivedFrom
        .map((entry) => toOptionalString(entry, ""))
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const fieldKeys = Array.isArray(value.fieldKeys)
    ? value.fieldKeys
        .map((entry) => toOptionalString(entry, ""))
        .filter(Boolean)
        .slice(0, 12)
    : [];
  return {
    builtAt: Number.isFinite(Number(value.builtAt)) ? Math.max(0, Math.round(Number(value.builtAt))) : 0,
    schemaVersion,
    state: toOptionalString(value.state, "degraded"),
    degradedReason: toOptionalString(value.degradedReason, "parse_incomplete"),
    derivedFrom,
    fieldCount: Number.isFinite(Number(value.fieldCount))
      ? Math.max(0, Math.round(Number(value.fieldCount)))
      : fieldKeys.length,
    fieldKeys,
  };
}

function normalizePersonaExport(value) {
  if (!value || typeof value !== "object") return null;
  const schemaVersion = toOptionalString(value.schemaVersion, null);
  if (!schemaVersion) return null;
  const facts = Array.isArray(value.facts)
    ? value.facts
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => ({
          key: toOptionalString(entry.key, ""),
          value: toOptionalString(entry.value, ""),
          provenanceTag: toOptionalString(entry.provenanceTag, "unknown"),
        }))
        .filter((entry) => entry.key && entry.value)
        .slice(0, 12)
    : [];
  return {
    ts: Number.isFinite(Number(value.ts)) ? Math.max(0, Math.round(Number(value.ts))) : 0,
    mode: toOptionalString(value.mode, "online_dialog"),
    schemaVersion,
    snapshotVersion: toOptionalString(value.snapshotVersion, "vp-persona-snapshot-v1"),
    state: toOptionalString(value.state, "degraded"),
    degradedReason: toOptionalString(value.degradedReason, "parse_incomplete"),
    summary: toOptionalString(value.summary, ""),
    fieldCount: Number.isFinite(Number(value.fieldCount))
      ? Math.max(0, Math.round(Number(value.fieldCount)))
      : facts.length,
    facts,
    byteSize: Number.isFinite(Number(value.byteSize)) ? Math.max(0, Math.round(Number(value.byteSize))) : 0,
    highlightCount: Number.isFinite(Number(value.highlightCount))
      ? Math.max(0, Math.round(Number(value.highlightCount)))
      : 0,
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
  const lastOfflineRecall = normalizeOfflineRecall(memorySnapshot?.lastOfflineRecall);
  const lastOfflinePersonaReply = normalizeOfflinePersonaReply(memorySnapshot?.lastOfflinePersonaReply);
  const lastPersonaSnapshot = normalizePersonaSnapshot(memorySnapshot?.lastPersonaSnapshot);
  const lastPersonaExport = normalizePersonaExport(memorySnapshot?.lastPersonaExport);
  const lastProactivePolicy = normalizeProactivePolicy(memorySnapshot?.lastProactivePolicy);
  const lastReflectionRuntime = normalizeReflectionRuntime(memorySnapshot?.lastReflectionRuntime);
  const personaSnapshotDegraded =
    lastPersonaSnapshot && toOptionalString(lastPersonaSnapshot.state, "degraded") !== "ready";
  const personaSnapshotReason =
    toOptionalString(lastPersonaSnapshot?.degradedReason, "parse_incomplete") || "parse_incomplete";
  if (activeAdapterMode === "disabled") {
    return {
      state: OBSERVABILITY_ROW_STATES.disabled,
      reason: fallbackReason === "none" ? "memory_disabled" : fallbackReason,
      requestedAdapterMode,
      activeAdapterMode,
      fallbackReason,
      writeLegacyJsonl: Boolean(settingsSummary?.memory?.writeLegacyJsonl),
      lastOfflineRecall,
      lastOfflinePersonaReply,
      lastPersonaSnapshot,
      lastPersonaExport,
      lastProactivePolicy,
      lastReflectionRuntime,
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
      lastOfflineRecall,
      lastOfflinePersonaReply,
      lastPersonaSnapshot,
      lastPersonaExport,
      lastProactivePolicy,
      lastReflectionRuntime,
    };
  }
  if (personaSnapshotDegraded) {
    return {
      state: OBSERVABILITY_ROW_STATES.degraded,
      reason: `persona_snapshot_${personaSnapshotReason === "none" ? "degraded" : personaSnapshotReason}`,
      requestedAdapterMode,
      activeAdapterMode,
      fallbackReason,
      writeLegacyJsonl: Boolean(settingsSummary?.memory?.writeLegacyJsonl),
      lastOfflineRecall,
      lastOfflinePersonaReply,
      lastPersonaSnapshot,
      lastPersonaExport,
      lastProactivePolicy,
      lastReflectionRuntime,
    };
  }
  return {
    state: OBSERVABILITY_ROW_STATES.healthy,
    reason: "memory_runtime_ready",
    requestedAdapterMode,
    activeAdapterMode,
    fallbackReason,
    writeLegacyJsonl: Boolean(settingsSummary?.memory?.writeLegacyJsonl),
    lastOfflineRecall,
    lastOfflinePersonaReply,
    lastPersonaSnapshot,
    lastPersonaExport,
    lastProactivePolicy,
    lastReflectionRuntime,
  };
}

function normalizeBehaviorAvoidedDisplays(entries = []) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => {
      const displayId = toOptionalString(entry?.displayId, null);
      if (!displayId) return null;
      const expiresAtMs = Number.isFinite(Number(entry?.expiresAtMs))
        ? Math.max(0, Math.round(Number(entry.expiresAtMs)))
        : 0;
      const remainingMs = Number.isFinite(Number(entry?.remainingMs))
        ? Math.max(0, Math.round(Number(entry.remainingMs)))
        : 0;
      return {
        displayId,
        expiresAtMs,
        remainingMs,
        sourceReason: toOptionalString(entry?.sourceReason, "manual_correction"),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.expiresAtMs - right.expiresAtMs);
}

function normalizeBehaviorManualCorrection(entry) {
  if (!entry || typeof entry !== "object") return null;
  const fromDisplayId = toOptionalString(entry.fromDisplayId, null);
  const toDisplayId = toOptionalString(entry.toDisplayId, null);
  const recordedAtMs = Number.isFinite(Number(entry.recordedAtMs))
    ? Math.max(0, Math.round(Number(entry.recordedAtMs)))
    : 0;
  if (!fromDisplayId && !toDisplayId && recordedAtMs <= 0) return null;
  return {
    fromDisplayId,
    toDisplayId,
    recordedAtMs,
  };
}

function normalizeBehaviorBounds(bounds) {
  if (!bounds || typeof bounds !== "object") return null;
  const x = Number(bounds.x);
  const y = Number(bounds.y);
  const width = Number(bounds.width);
  const height = Number(bounds.height);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  if (width <= 0 || height <= 0) return null;
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function normalizeBehaviorWindowCooldownEntries(entries = []) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => {
      const windowId = toOptionalString(entry?.windowId, null);
      if (!windowId) return null;
      const expiresAtMs = Number.isFinite(Number(entry?.expiresAtMs))
        ? Math.max(0, Math.round(Number(entry.expiresAtMs)))
        : 0;
      const remainingMs = Number.isFinite(Number(entry?.remainingMs))
        ? Math.max(0, Math.round(Number(entry.remainingMs)))
        : 0;
      return {
        windowId,
        expiresAtMs,
        remainingMs,
        sourceReason: toOptionalString(entry?.sourceReason, "manual_correction"),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.expiresAtMs - right.expiresAtMs);
}

function buildBehaviorRow({ settingsSummary, behaviorSnapshot = null }) {
  const roamMode =
    toOptionalString(behaviorSnapshot?.roamMode, null) ||
    toOptionalString(settingsSummary?.roaming?.mode, "desktop") ||
    "desktop";
  const activeAvoidedDisplays = normalizeBehaviorAvoidedDisplays(
    behaviorSnapshot?.activeAvoidedDisplays
  );
  const decisionReason =
    toOptionalString(behaviorSnapshot?.decisionReason, "none") || "none";
  const fallbackReason =
    toOptionalString(behaviorSnapshot?.fallbackReason, "none") || "none";
  const reentryReason =
    toOptionalString(behaviorSnapshot?.reentryReason, "none") || "none";
  const pacingReason =
    toOptionalString(behaviorSnapshot?.pacingReason, "none") || "none";
  const pacingDelayMs = Number.isFinite(Number(behaviorSnapshot?.pacingDelayMs))
    ? Math.max(0, Math.round(Number(behaviorSnapshot.pacingDelayMs)))
    : 0;
  const nextDecisionAtMs = Number.isFinite(Number(behaviorSnapshot?.nextDecisionAtMs))
    ? Math.max(0, Math.round(Number(behaviorSnapshot.nextDecisionAtMs)))
    : 0;
  const monitorAvoidMs = Number.isFinite(Number(behaviorSnapshot?.monitorAvoidMs))
    ? Math.max(0, Math.round(Number(behaviorSnapshot.monitorAvoidMs)))
    : 0;
  const windowAvoidanceState =
    toOptionalString(behaviorSnapshot?.windowAvoidanceState, "unknown") || "unknown";
  const windowAvoidanceReason =
    toOptionalString(behaviorSnapshot?.windowAvoidanceReason, "none") || "none";
  const windowAvoidMarginPx = Number.isFinite(Number(behaviorSnapshot?.windowAvoidMarginPx))
    ? Math.max(0, Math.round(Number(behaviorSnapshot.windowAvoidMarginPx)))
    : 0;
  const foregroundWindowBounds = normalizeBehaviorBounds(behaviorSnapshot?.foregroundWindowBounds);
  const foregroundWindowWindowId =
    toOptionalString(behaviorSnapshot?.foregroundWindowWindowId, null);
  const foregroundWindowRevision = Number.isFinite(Number(behaviorSnapshot?.foregroundWindowRevision))
    ? Math.max(0, Math.round(Number(behaviorSnapshot.foregroundWindowRevision)))
    : 0;
  const windowInspectState = toOptionalString(behaviorSnapshot?.windowInspectState, "idle") || "idle";
  const windowInspectReason = toOptionalString(behaviorSnapshot?.windowInspectReason, "none") || "none";
  const windowInspectAnchorLane =
    toOptionalString(behaviorSnapshot?.windowInspectAnchorLane, "none") || "none";
  const rawAnchorPoint = behaviorSnapshot?.windowInspectAnchorPoint;
  const windowInspectAnchorPoint =
    rawAnchorPoint &&
    Number.isFinite(Number(rawAnchorPoint.x)) &&
    Number.isFinite(Number(rawAnchorPoint.y))
      ? {
          x: Math.round(Number(rawAnchorPoint.x)),
          y: Math.round(Number(rawAnchorPoint.y)),
        }
      : null;
  const windowInspectDwellMs = Number.isFinite(Number(behaviorSnapshot?.windowInspectDwellMs))
    ? Math.max(0, Math.round(Number(behaviorSnapshot.windowInspectDwellMs)))
    : 0;
  const avoidMaskBounds = normalizeBehaviorBounds(behaviorSnapshot?.avoidMaskBounds);
  const windowAvoidFallback = toOptionalString(behaviorSnapshot?.windowAvoidFallback, "none") || "none";
  const windowAvoidCooldownEntries = normalizeBehaviorWindowCooldownEntries(
    behaviorSnapshot?.windowAvoidCooldownEntries
  );
  const row = {
    state: OBSERVABILITY_ROW_STATES.healthy,
    reason: "roam_policy_active",
    roamMode,
    roamPhase: toOptionalString(behaviorSnapshot?.roamPhase, "idle"),
    decisionReason,
    fallbackReason,
    reentryReason,
    pacingReason,
    pacingDelayMs,
    monitorAvoidMs,
    nextDecisionAtMs,
    hasQueuedDestination: Boolean(behaviorSnapshot?.hasQueuedDestination),
    activeAvoidedDisplays,
    avoidCount: activeAvoidedDisplays.length,
    windowAvoidanceState,
    windowAvoidanceReason,
    windowAvoidMarginPx,
    foregroundWindowBounds,
    foregroundWindowWindowId,
    foregroundWindowRevision,
    windowInspectState,
    windowInspectReason,
    windowInspectAnchorLane,
    windowInspectAnchorPoint,
    windowInspectDwellMs,
    avoidMaskBounds,
    windowAvoidFallback,
    windowAvoidCooldownEntries,
    windowAvoidCooldownCount: windowAvoidCooldownEntries.length,
    lastManualCorrection: normalizeBehaviorManualCorrection(
      behaviorSnapshot?.lastManualCorrection
    ),
  };

  if (roamMode !== "desktop") {
    row.state = OBSERVABILITY_ROW_STATES.disabled;
    row.reason = "roam_mode_not_desktop";
    return row;
  }
  if (windowAvoidanceState === OBSERVABILITY_ROW_STATES.disabled) {
    row.state = OBSERVABILITY_ROW_STATES.disabled;
    row.reason = windowAvoidanceReason !== "none" ? windowAvoidanceReason : "window_avoidance_disabled";
    return row;
  }
  if (windowAvoidanceState === OBSERVABILITY_ROW_STATES.degraded) {
    row.state = OBSERVABILITY_ROW_STATES.degraded;
    row.reason = windowAvoidanceReason !== "none" ? windowAvoidanceReason : "window_avoidance_degraded";
    return row;
  }
  if (fallbackReason !== "none") {
    row.state = OBSERVABILITY_ROW_STATES.degraded;
    row.reason = fallbackReason;
    return row;
  }
  row.reason = decisionReason && decisionReason !== "none" ? decisionReason : "roam_policy_active";
  return row;
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
  behaviorSnapshot = null,
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
  const behavior = buildBehaviorRow({
    settingsSummary,
    behaviorSnapshot,
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
    behavior,
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

function formatDurationMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "unknown";
  const remainingMs = Math.max(0, Math.round(numeric));
  if (remainingMs <= 0) return "ready now";
  let seconds = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function formatEpochUtcMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "unknown";
  const rounded = Math.max(0, Math.round(numeric));
  try {
    return `${rounded} (${new Date(rounded).toISOString()})`;
  } catch {
    return String(rounded);
  }
}

function formatBounds(bounds) {
  if (!bounds || typeof bounds !== "object") return "none";
  const x = Number(bounds.x);
  const y = Number(bounds.y);
  const width = Number(bounds.width);
  const height = Number(bounds.height);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return "none";
  }
  return `x=${Math.round(x)}, y=${Math.round(y)}, w=${Math.round(width)}, h=${Math.round(height)}`;
}

function formatPoint(point) {
  if (!point || typeof point !== "object") return "none";
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return "none";
  return `x=${Math.round(x)}, y=${Math.round(y)}`;
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
    normalized === OBSERVABILITY_SUBJECT_IDS.behavior ||
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

function normalizePairingState(value) {
  const normalized = toOptionalString(value, PAIRING_STATES.notStarted) || PAIRING_STATES.notStarted;
  if (normalized === PAIRING_STATES.challengeReady) return PAIRING_STATES.challengeReady;
  if (normalized === PAIRING_STATES.pendingApproval) return PAIRING_STATES.pendingApproval;
  if (normalized === PAIRING_STATES.paired) return PAIRING_STATES.paired;
  if (normalized === PAIRING_STATES.challengeExpired) return PAIRING_STATES.challengeExpired;
  if (normalized === PAIRING_STATES.failed) return PAIRING_STATES.failed;
  return PAIRING_STATES.notStarted;
}

function buildBridgeDetailActions({ pairing = null, hasPath = false } = {}) {
  const actions = [];
  const pairingState = normalizePairingState(pairing?.pairingState);
  const canPair = pairingState !== PAIRING_STATES.paired;

  actions.push(
    buildDetailAction(
      OBSERVABILITY_DETAIL_ACTION_IDS.runPairingProbe,
      "Run Pairing Probe",
      canPair ? "primary" : "secondary",
      true
    )
  );
  actions.push(
    buildDetailAction(
      OBSERVABILITY_DETAIL_ACTION_IDS.openSettings,
      "Open Settings",
      "secondary",
      true
    )
  );
  if (canPair) {
    actions.push(
      buildDetailAction(
        OBSERVABILITY_DETAIL_ACTION_IDS.startPairingQr,
        "Show QR",
        "secondary",
        true
      )
    );
    actions.push(
      buildDetailAction(
        OBSERVABILITY_DETAIL_ACTION_IDS.copyPairingCode,
        "Copy Pairing Code",
        "secondary",
        true
      )
    );
  }
  if (pairingState === PAIRING_STATES.challengeExpired || pairingState === PAIRING_STATES.failed) {
    actions.push(
      buildDetailAction(
        OBSERVABILITY_DETAIL_ACTION_IDS.retryPairing,
        "Retry Pairing",
        "secondary",
        true
      )
    );
  }
  actions.push(
    buildDetailAction(
      OBSERVABILITY_DETAIL_ACTION_IDS.refreshStatus,
      "Refresh Status",
      "secondary",
      true
    )
  );
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
  ts = Date.now(),
}) {
  const state = toStatePill(row?.state);
  let label = "Status Row";
  let headline = "Status row detail is available.";
  let impact = "Use Refresh Status to confirm the latest runtime data.";
  let ownership = "manual_runtime";
  const provenance = [];
  const suggestedSteps = ["Press Refresh Status to re-check this row."];
  let pairing = null;

  if (rowId === OBSERVABILITY_SUBJECT_IDS.bridge) {
    label = "OpenClaw Bridge";
    headline = `OpenClaw bridge is ${normalizeStateLabel(state)}.`;
    impact = "Bridge state controls whether online advisory responses are available.";
    pairing = row?.pairing && typeof row.pairing === "object" ? row.pairing : null;
    provenance.push(
      { label: "Transport", kind: "runtime", value: toSentence(row?.transport, "unknown") },
      { label: "Mode", kind: "runtime", value: toSentence(row?.mode, "unknown") },
      { label: "Reason", kind: "runtime", value: normalizeReasonLabel(row?.reason) },
      {
        label: "Pet Command Auth",
        kind: "runtime",
        value: row?.petCommandAuthConfigured ? "configured" : "missing",
      },
      {
        label: "Pet Command Source",
        kind: "runtime",
        value: toSentence(row?.petCommandAuthSource, "none"),
      },
      {
        label: "Pet Command Key",
        kind: "runtime",
        value: toSentence(row?.petCommandKeyId, "unknown"),
      },
      {
        label: "Nonce Cache",
        kind: "runtime",
        value: String(Number.isFinite(Number(row?.petCommandNonceCacheSize)) ? row.petCommandNonceCacheSize : 0),
      }
    );
    if (row?.endpoint) {
      provenance.push({ label: "Endpoint", kind: "path", value: row.endpoint });
    }
    if (row?.petCommandSharedSecretRef) {
      provenance.push({ label: "Secret Ref", kind: "runtime", value: row.petCommandSharedSecretRef });
    }
    if (pairing) {
      const pairingState = normalizePairingState(pairing.pairingState);
      const challenge = pairing.challenge && typeof pairing.challenge === "object" ? pairing.challenge : null;
      const methodAvailability =
        pairing.methodAvailability && typeof pairing.methodAvailability === "object"
          ? pairing.methodAvailability
          : {};
      provenance.push(
        { label: "Pairing State", kind: "runtime", value: pairingState },
        {
          label: "QR Pairing",
          kind: "runtime",
          value: methodAvailability.qr === false ? "unavailable" : "available",
        },
        {
          label: "Code Pairing",
          kind: "runtime",
          value: methodAvailability.code === false ? "unavailable" : "available",
        }
      );
      if (typeof pairing.lastMethod === "string" && pairing.lastMethod.trim().length > 0) {
        provenance.push({ label: "Last Method", kind: "runtime", value: pairing.lastMethod });
      }
      if (challenge) {
        provenance.push(
          { label: "Pairing Id", kind: "runtime", value: challenge.pairingId || "unknown" },
          {
            label: "Challenge Expires",
            kind: "runtime",
            value: Number.isFinite(Number(challenge.expiresAtMs))
              ? String(Math.round(Number(challenge.expiresAtMs)))
              : "unknown",
          }
        );
      }
      const lastProbe = pairing.lastProbe && typeof pairing.lastProbe === "object" ? pairing.lastProbe : null;
      if (lastProbe) {
        provenance.push(
          {
            label: "Last Probe",
            kind: "runtime",
            value: toSentence(lastProbe.overallState, "unknown"),
          }
        );
      }
      suggestedSteps.length = 0;
      if (pairingState === PAIRING_STATES.paired) {
        suggestedSteps.push("Run Pairing Probe after config changes to confirm the lane is still healthy.");
      } else if (pairingState === PAIRING_STATES.pendingApproval) {
        suggestedSteps.push("Complete external OpenClaw pairing approval, then run Pairing Probe.");
      } else if (pairingState === PAIRING_STATES.challengeExpired) {
        suggestedSteps.push("Press Retry Pairing to mint a fresh challenge, then run Pairing Probe.");
      } else if (pairingState === PAIRING_STATES.challengeReady) {
        suggestedSteps.push("Scan the QR challenge or copy the pairing code, then run Pairing Probe.");
      } else {
        suggestedSteps.push("Open Settings, verify endpoint and refs, then run Pairing Probe.");
      }
    } else {
      suggestedSteps.length = 0;
      suggestedSteps.push("Open Settings, verify endpoint and refs, then run Pairing Probe.");
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
    const lastRecall =
      row?.lastOfflineRecall && typeof row.lastOfflineRecall === "object"
        ? row.lastOfflineRecall
        : null;
    const lastOfflinePersonaReply =
      row?.lastOfflinePersonaReply && typeof row.lastOfflinePersonaReply === "object"
        ? row.lastOfflinePersonaReply
        : null;
    const lastProactivePolicy =
      row?.lastProactivePolicy && typeof row.lastProactivePolicy === "object"
        ? row.lastProactivePolicy
        : null;
    const lastReflectionRuntime =
      row?.lastReflectionRuntime && typeof row.lastReflectionRuntime === "object"
        ? row.lastReflectionRuntime
        : null;
    const lastPersonaSnapshot =
      row?.lastPersonaSnapshot && typeof row.lastPersonaSnapshot === "object"
        ? row.lastPersonaSnapshot
        : null;
    const lastPersonaExport =
      row?.lastPersonaExport && typeof row.lastPersonaExport === "object"
        ? row.lastPersonaExport
        : null;
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
    if (lastRecall) {
      const recallTags = Array.isArray(lastRecall.evidenceTags) ? lastRecall.evidenceTags : [];
      provenance.push(
        {
          label: "Last Recall Type",
          kind: "runtime",
          value: toSentence(lastRecall.recallType, "none"),
        },
        {
          label: "Last Recall Reason",
          kind: "runtime",
          value: normalizeReasonLabel(lastRecall.degradedReason),
        },
        {
          label: "Last Recall Tags",
          kind: "runtime",
          value: recallTags.length > 0 ? recallTags.join(", ") : "none",
        }
      );
      if (Number.isFinite(Number(lastRecall.ts)) && Number(lastRecall.ts) > 0) {
        provenance.push({
          label: "Last Recall At",
          kind: "runtime",
          value: String(Math.round(Number(lastRecall.ts))),
        });
      }
      if (lastRecall.degradedReason && lastRecall.degradedReason !== "none") {
        suggestedSteps.length = 0;
        suggestedSteps.push(
          "Restore local identity/memory inputs, then ask the recall question again and refresh status."
        );
      }
    }
    if (lastOfflinePersonaReply) {
      const styleProfile =
        lastOfflinePersonaReply.styleProfile && typeof lastOfflinePersonaReply.styleProfile === "object"
          ? lastOfflinePersonaReply.styleProfile
          : {};
      provenance.push(
        {
          label: "Last Offline Persona Intent",
          kind: "runtime",
          value: toSentence(lastOfflinePersonaReply.intent, "none"),
        },
        {
          label: "Last Offline Persona Mode",
          kind: "runtime",
          value: toSentence(lastOfflinePersonaReply.personaMode, "none"),
        },
        {
          label: "Last Offline Persona State",
          kind: "runtime",
          value: toSentence(lastOfflinePersonaReply.personaState, "degraded"),
        },
        {
          label: "Last Offline Persona Reason",
          kind: "runtime",
          value: normalizeReasonLabel(lastOfflinePersonaReply.personaReason),
        },
        {
          label: "Last Offline Persona Style",
          kind: "runtime",
          value: `warmth=${toSentence(styleProfile.warmth, "medium")}, playfulness=${toSentence(
            styleProfile.playfulness,
            "low"
          )}, curiosity=${toSentence(styleProfile.curiosity, "medium")}`,
        }
      );
      if (Number.isFinite(Number(lastOfflinePersonaReply.ts)) && Number(lastOfflinePersonaReply.ts) > 0) {
        provenance.push({
          label: "Last Offline Persona At",
          kind: "runtime",
          value: String(Math.round(Number(lastOfflinePersonaReply.ts))),
        });
      }
    }
    if (lastProactivePolicy) {
      const nextEligibleAtMs = Number.isFinite(Number(lastProactivePolicy.nextEligibleAt))
        ? Math.max(0, Math.round(Number(lastProactivePolicy.nextEligibleAt)))
        : 0;
      const nextEligibleInMs = Math.max(0, nextEligibleAtMs - Math.max(0, Math.round(Number(ts) || 0)));
      provenance.push(
        {
          label: "Last Proactive Reason",
          kind: "runtime",
          value: normalizeReasonLabel(lastProactivePolicy.lastAttemptReason),
        },
        {
          label: "Last Suppression Reason",
          kind: "runtime",
          value: normalizeReasonLabel(lastProactivePolicy.suppressionReason),
        },
        {
          label: "Backoff Tier",
          kind: "runtime",
          value: String(
            Number.isFinite(Number(lastProactivePolicy.backoffTier))
              ? Math.max(0, Math.round(Number(lastProactivePolicy.backoffTier)))
              : 0
          ),
        },
        {
          label: "Next Proactive Eligible At",
          kind: "runtime",
          value: formatEpochUtcMs(nextEligibleAtMs),
        },
        {
          label: "Next Proactive Eligible In",
          kind: "runtime",
          value: formatDurationMs(nextEligibleInMs),
        },
        {
          label: "Proactive Repeat Window",
          kind: "runtime",
          value: String(
            Number.isFinite(Number(lastProactivePolicy.repeatGuardWindowMs))
              ? Math.max(0, Math.round(Number(lastProactivePolicy.repeatGuardWindowMs)))
              : 0
          ),
        }
      );
      if (lastProactivePolicy.suppressionReason && lastProactivePolicy.suppressionReason !== "none") {
        suggestedSteps.length = 0;
        suggestedSteps.push(
          "Clear suppression conditions (close chat, stop typing, or wait cooldown), then press Refresh Status."
        );
      }
    }
    if (lastReflectionRuntime) {
      provenance.push(
        {
          label: "Reflection Runtime State",
          kind: "runtime",
          value: toSentence(lastReflectionRuntime.state, "idle"),
        },
        {
          label: "Reflection Runtime Reason",
          kind: "runtime",
          value: normalizeReasonLabel(lastReflectionRuntime.reason),
        },
        {
          label: "Next Reflection Heartbeat At",
          kind: "runtime",
          value: formatEpochUtcMs(lastReflectionRuntime.nextHeartbeatAtMs),
        },
        {
          label: "Next Reflection Digest At",
          kind: "runtime",
          value: formatEpochUtcMs(lastReflectionRuntime.nextDigestAtMs),
        },
        {
          label: "Reflection Retry Heartbeat At",
          kind: "runtime",
          value: formatEpochUtcMs(lastReflectionRuntime.retryHeartbeatAtMs),
        },
        {
          label: "Reflection Retry Digest At",
          kind: "runtime",
          value: formatEpochUtcMs(lastReflectionRuntime.retryDigestAtMs),
        },
        {
          label: "Reflection Rehydrated Entries",
          kind: "runtime",
          value: String(
            Number.isFinite(Number(lastReflectionRuntime.rehydratedEntryCount))
              ? Math.max(0, Math.round(Number(lastReflectionRuntime.rehydratedEntryCount))
              )
              : 0
          ),
        }
      );
      if (lastReflectionRuntime.lastRun && typeof lastReflectionRuntime.lastRun === "object") {
        const run = lastReflectionRuntime.lastRun;
        provenance.push(
          {
            label: "Last Reflection Cycle",
            kind: "runtime",
            value: toSentence(run.cycleId, "heartbeat"),
          },
          {
            label: "Last Reflection Outcome",
            kind: "runtime",
            value: toSentence(run.outcome, "suppressed"),
          },
          {
            label: "Last Reflection Reason",
            kind: "runtime",
            value: normalizeReasonLabel(run.reason),
          },
          {
            label: "Last Reflection Accepted",
            kind: "runtime",
            value: String(
              Number.isFinite(Number(run.acceptedIntentCount))
                ? Math.max(0, Math.round(Number(run.acceptedIntentCount)))
                : 0
            ),
          },
          {
            label: "Last Reflection Deferred",
            kind: "runtime",
            value: String(
              Number.isFinite(Number(run.deferredIntentCount))
                ? Math.max(0, Math.round(Number(run.deferredIntentCount)))
                : 0
            ),
          },
          {
            label: "Last Reflection Rejected",
            kind: "runtime",
            value: String(
              Number.isFinite(Number(run.rejectedIntentCount))
                ? Math.max(0, Math.round(Number(run.rejectedIntentCount)))
                : 0
            ),
          },
          {
            label: "Last Reflection At",
            kind: "runtime",
            value: String(
              Number.isFinite(Number(run.completedAtMs))
                ? Math.max(0, Math.round(Number(run.completedAtMs)))
                : 0
            ),
          }
        );
      }
      if (
        lastReflectionRuntime.state === "degraded" ||
        lastReflectionRuntime.state === "suppressed"
      ) {
        suggestedSteps.length = 0;
        suggestedSteps.push(
          "Use Run Reflection Now to test heartbeat sync, then press Refresh Status."
        );
      }
    }
    if (lastPersonaSnapshot) {
      provenance.push(
        {
          label: "Persona Snapshot",
          kind: "runtime",
          value: toSentence(lastPersonaSnapshot.state, "degraded"),
        },
        {
          label: "Snapshot Version",
          kind: "runtime",
          value: toSentence(lastPersonaSnapshot.schemaVersion, "unknown"),
        },
        {
          label: "Snapshot Fields",
          kind: "runtime",
          value: String(
            Number.isFinite(Number(lastPersonaSnapshot.fieldCount))
              ? lastPersonaSnapshot.fieldCount
              : 0
          ),
        },
        {
          label: "Snapshot Derived From",
          kind: "runtime",
          value:
            Array.isArray(lastPersonaSnapshot.derivedFrom) &&
            lastPersonaSnapshot.derivedFrom.length > 0
              ? lastPersonaSnapshot.derivedFrom.join(", ")
              : "none",
        },
        {
          label: "Snapshot Reason",
          kind: "runtime",
          value: normalizeReasonLabel(lastPersonaSnapshot.degradedReason),
        }
      );
      if (lastPersonaSnapshot.state !== "ready") {
        suggestedSteps.length = 0;
        suggestedSteps.push(
          "Restore local canonical files, press Refresh Status, then send one chat message to regenerate persona export metadata."
        );
      }
    }
    if (lastPersonaExport) {
      provenance.push(
        {
          label: "Last Persona Export Mode",
          kind: "runtime",
          value: toSentence(lastPersonaExport.mode, "none"),
        },
        {
          label: "Last Persona Export Fields",
          kind: "runtime",
          value: String(
            Number.isFinite(Number(lastPersonaExport.fieldCount))
              ? lastPersonaExport.fieldCount
              : 0
          ),
        },
        {
          label: "Last Persona Export Reason",
          kind: "runtime",
          value: normalizeReasonLabel(lastPersonaExport.degradedReason),
        }
      );
      if (
        Array.isArray(lastPersonaExport.facts) &&
        lastPersonaExport.facts.length > 0
      ) {
        const factSummary = lastPersonaExport.facts
          .map((entry) => `${entry.key} (${entry.provenanceTag})`)
          .slice(0, 6)
          .join(", ");
        provenance.push({
          label: "Last Persona Export Facts",
          kind: "runtime",
          value: factSummary || "none",
        });
      }
      if (Number.isFinite(Number(lastPersonaExport.ts)) && Number(lastPersonaExport.ts) > 0) {
        provenance.push({
          label: "Last Persona Export At",
          kind: "runtime",
          value: String(Math.round(Number(lastPersonaExport.ts))),
        });
      }
    }
  } else if (rowId === OBSERVABILITY_SUBJECT_IDS.behavior) {
    label = "Behavior Runtime";
    headline = `Roam behavior policy is ${normalizeStateLabel(state)}.`;
    impact = "Behavior policy controls roam pacing, monitor-avoidance memory, and active-window inspect/avoid behavior.";
    const activeAvoidedDisplays = Array.isArray(row?.activeAvoidedDisplays)
      ? row.activeAvoidedDisplays
      : [];
    const windowAvoidCooldownEntries = Array.isArray(row?.windowAvoidCooldownEntries)
      ? row.windowAvoidCooldownEntries
      : [];
    provenance.push(
      {
        label: "Roam Mode",
        kind: "runtime",
        value: toSentence(row?.roamMode, "desktop"),
      },
      {
        label: "Roam Phase",
        kind: "runtime",
        value: toSentence(row?.roamPhase, "idle"),
      },
      {
        label: "Decision Reason",
        kind: "runtime",
        value: normalizeReasonLabel(row?.decisionReason),
      },
      {
        label: "Pacing Reason",
        kind: "runtime",
        value: normalizeReasonLabel(row?.pacingReason),
      },
      {
        label: "Pacing Delay",
        kind: "runtime",
        value: formatDurationMs(row?.pacingDelayMs),
      },
      {
        label: "Monitor Avoid Window",
        kind: "runtime",
        value: formatDurationMs(row?.monitorAvoidMs),
      },
      {
        label: "Fallback Reason",
        kind: "runtime",
        value: normalizeReasonLabel(row?.fallbackReason),
      },
      {
        label: "Re-entry Reason",
        kind: "runtime",
        value: normalizeReasonLabel(row?.reentryReason),
      },
      {
        label: "Avoided Displays",
        kind: "runtime",
        value: String(activeAvoidedDisplays.length),
      },
      {
        label: "Next Decision At",
        kind: "runtime",
        value: formatEpochUtcMs(row?.nextDecisionAtMs),
      },
      {
        label: "Window Avoidance State",
        kind: "runtime",
        value: toSentence(row?.windowAvoidanceState, "unknown"),
      },
      {
        label: "Window Avoidance Reason",
        kind: "runtime",
        value: normalizeReasonLabel(row?.windowAvoidanceReason),
      },
      {
        label: "Window Avoid Margin",
        kind: "runtime",
        value: `${Math.max(0, Math.round(Number(row?.windowAvoidMarginPx) || 0))} px`,
      },
      {
        label: "Foreground Window ID",
        kind: "runtime",
        value: toSentence(row?.foregroundWindowWindowId, "none"),
      },
      {
        label: "Foreground Window Bounds",
        kind: "runtime",
        value: formatBounds(row?.foregroundWindowBounds),
      },
      {
        label: "Foreground Window Revision",
        kind: "runtime",
        value: String(
          Number.isFinite(Number(row?.foregroundWindowRevision))
            ? Math.max(0, Math.round(Number(row.foregroundWindowRevision)))
            : 0
        ),
      },
      {
        label: "Window Inspect State",
        kind: "runtime",
        value: toSentence(row?.windowInspectState, "idle"),
      },
      {
        label: "Window Inspect Reason",
        kind: "runtime",
        value: normalizeReasonLabel(row?.windowInspectReason),
      },
      {
        label: "Window Inspect Anchor Lane",
        kind: "runtime",
        value: toSentence(row?.windowInspectAnchorLane, "none"),
      },
      {
        label: "Window Inspect Anchor Point",
        kind: "runtime",
        value: formatPoint(row?.windowInspectAnchorPoint),
      },
      {
        label: "Window Inspect Dwell",
        kind: "runtime",
        value: formatDurationMs(row?.windowInspectDwellMs),
      },
      {
        label: "Avoid Mask Bounds",
        kind: "runtime",
        value: formatBounds(row?.avoidMaskBounds),
      },
      {
        label: "Window Avoid Fallback",
        kind: "runtime",
        value: normalizeReasonLabel(row?.windowAvoidFallback),
      },
      {
        label: "Window Avoid Cooldown",
        kind: "runtime",
        value: String(windowAvoidCooldownEntries.length),
      }
    );
    for (const entry of activeAvoidedDisplays) {
      provenance.push({
        label: `Display ${entry.displayId}`,
        kind: "runtime",
        value: `${formatDurationMs(entry?.remainingMs)} remaining (expires ${formatEpochUtcMs(
          entry?.expiresAtMs
        )})`,
      });
    }
    for (const entry of windowAvoidCooldownEntries) {
      provenance.push({
        label: `Window ${entry.windowId}`,
        kind: "runtime",
        value: `${formatDurationMs(entry?.remainingMs)} remaining (expires ${formatEpochUtcMs(
          entry?.expiresAtMs
        )})`,
      });
    }
    if (row?.lastManualCorrection && typeof row.lastManualCorrection === "object") {
      provenance.push(
        {
          label: "Last Manual From",
          kind: "runtime",
          value: toSentence(row.lastManualCorrection.fromDisplayId, "unknown"),
        },
        {
          label: "Last Manual To",
          kind: "runtime",
          value: toSentence(row.lastManualCorrection.toDisplayId, "unknown"),
        },
        {
          label: "Last Manual At",
          kind: "runtime",
          value: formatEpochUtcMs(row.lastManualCorrection.recordedAtMs),
        }
      );
    }
    suggestedSteps.length = 0;
    if (state === OBSERVABILITY_ROW_STATES.disabled) {
      suggestedSteps.push(
        "Switch roaming to Desktop mode to activate monitor-avoidance policy."
      );
    } else if (
      row?.windowAvoidanceReason === "foreground_window_provider_unavailable" ||
      row?.windowAvoidanceReason === "foreground_window_query_failed"
    ) {
      suggestedSteps.push(
        "Keep a normal desktop window focused, then press Refresh Status to verify foreground-window provider recovery."
      );
    } else if (row?.fallbackReason === "avoidance_exhausted_fallback") {
      suggestedSteps.push(
        "Wait for avoid timers to expire or manually reposition the pet, then press Refresh Status."
      );
    } else if (row?.windowAvoidFallback === "foreground_window_no_free_area_fallback") {
      suggestedSteps.push(
        "Resize or move the focused window or wait for window cooldown expiry, then press Refresh Status."
      );
    } else {
      suggestedSteps.push(
        "Focus a desktop window and drag the pet off it once, then press Refresh Status to verify inspect/avoid signals."
      );
    }
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
  let actions = null;
  if (rowId === OBSERVABILITY_SUBJECT_IDS.bridge) {
    actions = buildBridgeDetailActions({ pairing, hasPath });
  } else if (rowId === OBSERVABILITY_SUBJECT_IDS.memory) {
    actions = [
      buildDetailAction(
        OBSERVABILITY_DETAIL_ACTION_IDS.runReflectionNow,
        "Run Reflection Now",
        "primary",
        true
      ),
      ...buildDetailActions({ allowOpenSetup: false, hasPath }),
    ];
  } else {
    actions = buildDetailActions({ allowOpenSetup: false, hasPath });
  }
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
    actions,
    pairing,
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
      ts,
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
    pairing: detail.pairing && typeof detail.pairing === "object" ? detail.pairing : null,
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
