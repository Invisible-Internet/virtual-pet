"use strict";

const ROAM_POLICY_SCHEMA_VERSION = "vp-roam-policy-v1";
const REASON_NONE = "none";
const DEFAULT_MONITOR_AVOID_MS = 45000;
const REENTRY_REASON_VISIBLE_MS = 90000;
const MIN_MONITOR_AVOID_MS = 1000;
const MAX_MONITOR_AVOID_MS = 300000;

const ROAM_POLICY_DECISION_REASONS = Object.freeze({
  none: REASON_NONE,
  startup: "policy_startup",
  pacingInitialWindow: "pacing_initial_window",
  pacingRestWindow: "pacing_rest_window",
  pacingRetryWindow: "pacing_retry_window",
  pacingExternalDelay: "pacing_external_delay",
  desktopNominal: "desktop_nominal",
  desktopAvoidanceActive: "desktop_avoidance_active",
  avoidanceExhaustedFallback: "avoidance_exhausted_fallback",
  avoidanceExpiredReentry: "avoidance_expired_reentry",
  desktopNoDisplaysAvailable: "desktop_no_displays_available",
  manualDisplayAvoidRecorded: "manual_display_avoid_recorded",
  manualDisplayAvoidIgnored: "manual_display_avoid_ignored",
  roamLegStarted: "roam_leg_started",
  roamLegRetry: "roam_leg_retry",
});

const ROAM_PACING_WINDOWS = Object.freeze({
  initial: Object.freeze({
    minMs: 1200,
    maxMs: 2400,
    reason: ROAM_POLICY_DECISION_REASONS.pacingInitialWindow,
  }),
  rest: Object.freeze({
    minMs: 2200,
    maxMs: 6200,
    reason: ROAM_POLICY_DECISION_REASONS.pacingRestWindow,
  }),
  retry: Object.freeze({
    minMs: 2200,
    maxMs: 6200,
    reason: ROAM_POLICY_DECISION_REASONS.pacingRetryWindow,
  }),
});

function toSafeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeDisplayId(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return String(Math.round(numeric));
}

function normalizeReason(value, fallback = REASON_NONE) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function clampMs(value, minMs = 0, maxMs = Number.MAX_SAFE_INTEGER) {
  const numeric = Math.round(toSafeNumber(value, minMs));
  return Math.max(minMs, Math.min(maxMs, numeric));
}

function createInitialRoamPolicyState({
  nowMs = Date.now(),
  monitorAvoidMs = DEFAULT_MONITOR_AVOID_MS,
} = {}) {
  const safeNow = Math.max(0, Math.round(toSafeNumber(nowMs, Date.now())));
  return {
    schemaVersion: ROAM_POLICY_SCHEMA_VERSION,
    monitorAvoidMs: clampMs(monitorAvoidMs, MIN_MONITOR_AVOID_MS, MAX_MONITOR_AVOID_MS),
    avoidedDisplays: {},
    decisionReason: ROAM_POLICY_DECISION_REASONS.startup,
    lastDecisionAtMs: safeNow,
    pacingReason: REASON_NONE,
    pacingPhase: REASON_NONE,
    pacingDelayMs: 0,
    lastPacingAtMs: 0,
    fallbackReason: REASON_NONE,
    reentryReason: REASON_NONE,
    reentryAtMs: 0,
    lastManualCorrection: null,
  };
}

function ensurePolicyState(state) {
  if (!state || typeof state !== "object") {
    return createInitialRoamPolicyState();
  }
  if (!state.avoidedDisplays || typeof state.avoidedDisplays !== "object") {
    state.avoidedDisplays = {};
  }
  return state;
}

function resolveReentryReason(state, nowMs) {
  const safeState = ensurePolicyState(state);
  const safeNow = Math.max(0, Math.round(toSafeNumber(nowMs, Date.now())));
  const reason = normalizeReason(safeState.reentryReason, REASON_NONE);
  const reentryAtMs = Math.max(0, Math.round(toSafeNumber(safeState.reentryAtMs, 0)));
  if (
    reason !== REASON_NONE &&
    reentryAtMs > 0 &&
    safeNow - reentryAtMs <= REENTRY_REASON_VISIBLE_MS
  ) {
    return reason;
  }
  if (safeState.reentryReason !== REASON_NONE) {
    safeState.reentryReason = REASON_NONE;
    safeState.reentryAtMs = 0;
  }
  return REASON_NONE;
}

function pruneExpiredAvoidedDisplays(state, nowMs = Date.now()) {
  const safeState = ensurePolicyState(state);
  const safeNow = Math.max(0, Math.round(toSafeNumber(nowMs, Date.now())));
  const expiredDisplayIds = [];
  for (const [displayId, entry] of Object.entries(safeState.avoidedDisplays)) {
    const expiresAtMs = Math.max(0, Math.round(toSafeNumber(entry?.expiresAtMs, 0)));
    if (expiresAtMs <= 0 || expiresAtMs <= safeNow) {
      delete safeState.avoidedDisplays[displayId];
      expiredDisplayIds.push(displayId);
    }
  }
  if (expiredDisplayIds.length > 0) {
    safeState.reentryReason = ROAM_POLICY_DECISION_REASONS.avoidanceExpiredReentry;
    safeState.reentryAtMs = safeNow;
  }
  return expiredDisplayIds;
}

function listActiveAvoidedDisplays(state, nowMs = Date.now()) {
  const safeState = ensurePolicyState(state);
  const safeNow = Math.max(0, Math.round(toSafeNumber(nowMs, Date.now())));
  const active = [];
  for (const entry of Object.values(safeState.avoidedDisplays)) {
    const displayId = normalizeDisplayId(entry?.displayId);
    if (!displayId) continue;
    const addedAtMs = Math.max(0, Math.round(toSafeNumber(entry?.addedAtMs, 0)));
    const expiresAtMs = Math.max(0, Math.round(toSafeNumber(entry?.expiresAtMs, 0)));
    if (expiresAtMs <= safeNow) continue;
    active.push({
      displayId,
      addedAtMs,
      expiresAtMs,
      remainingMs: Math.max(0, expiresAtMs - safeNow),
      sourceReason: normalizeReason(entry?.sourceReason, "manual_correction"),
      movedToDisplayId: normalizeDisplayId(entry?.movedToDisplayId),
    });
  }
  active.sort((left, right) => left.expiresAtMs - right.expiresAtMs);
  return active;
}

function markRoamPolicyDecision(state, reason = REASON_NONE, nowMs = Date.now()) {
  const safeState = ensurePolicyState(state);
  const safeNow = Math.max(0, Math.round(toSafeNumber(nowMs, Date.now())));
  safeState.decisionReason = normalizeReason(reason, REASON_NONE);
  safeState.lastDecisionAtMs = safeNow;
  return safeState;
}

function resolveRoamPacingDelay({
  phase = "rest",
  randomUnit = 0.5,
  windows = null,
} = {}) {
  const normalizedPhase = phase === "initial" || phase === "retry" ? phase : "rest";
  const baseWindow = ROAM_PACING_WINDOWS[normalizedPhase] || ROAM_PACING_WINDOWS.rest;
  const overrideWindow =
    windows && typeof windows === "object" && windows[normalizedPhase]
      ? windows[normalizedPhase]
      : null;
  const hasOverrideMin = Number.isFinite(Number(overrideWindow?.minMs));
  const hasOverrideMax = Number.isFinite(Number(overrideWindow?.maxMs));
  const boundedMinMs = clampMs(
    hasOverrideMin ? overrideWindow.minMs : baseWindow.minMs,
    0,
    Number.MAX_SAFE_INTEGER
  );
  const boundedMaxMs = clampMs(
    hasOverrideMax ? overrideWindow.maxMs : baseWindow.maxMs,
    boundedMinMs,
    Number.MAX_SAFE_INTEGER
  );
  const safeUnit = Math.max(0, Math.min(1, toSafeNumber(randomUnit, 0.5)));
  return {
    phase: normalizedPhase,
    reason: baseWindow.reason,
    minMs: boundedMinMs,
    maxMs: boundedMaxMs,
    delayMs: boundedMinMs + Math.round((boundedMaxMs - boundedMinMs) * safeUnit),
  };
}

function applyRoamPacingDecision(state, pacing, nowMs = Date.now()) {
  const safeState = ensurePolicyState(state);
  const safeNow = Math.max(0, Math.round(toSafeNumber(nowMs, Date.now())));
  const phase =
    pacing?.phase === "initial" || pacing?.phase === "retry" || pacing?.phase === "rest"
      ? pacing.phase
      : "rest";
  const reason = normalizeReason(
    pacing?.reason,
    phase === "initial"
      ? ROAM_POLICY_DECISION_REASONS.pacingInitialWindow
      : phase === "retry"
        ? ROAM_POLICY_DECISION_REASONS.pacingRetryWindow
        : ROAM_POLICY_DECISION_REASONS.pacingRestWindow
  );
  safeState.pacingPhase = phase;
  safeState.pacingReason = reason;
  safeState.pacingDelayMs = clampMs(pacing?.delayMs, 0, Number.MAX_SAFE_INTEGER);
  safeState.lastPacingAtMs = safeNow;
  markRoamPolicyDecision(safeState, reason, safeNow);
  return safeState;
}

function recordManualDisplayAvoidance(state, {
  fromDisplayId = null,
  toDisplayId = null,
  nowMs = Date.now(),
  sourceReason = "manual_correction",
} = {}) {
  const safeState = ensurePolicyState(state);
  const safeNow = Math.max(0, Math.round(toSafeNumber(nowMs, Date.now())));
  pruneExpiredAvoidedDisplays(safeState, safeNow);
  const fromId = normalizeDisplayId(fromDisplayId);
  const toId = normalizeDisplayId(toDisplayId);
  if (!fromId || !toId || fromId === toId) {
    return {
      recorded: false,
      reason: ROAM_POLICY_DECISION_REASONS.manualDisplayAvoidIgnored,
      activeAvoidedDisplays: listActiveAvoidedDisplays(safeState, safeNow),
    };
  }

  const monitorAvoidMs = clampMs(
    safeState.monitorAvoidMs,
    MIN_MONITOR_AVOID_MS,
    MAX_MONITOR_AVOID_MS
  );
  safeState.avoidedDisplays[fromId] = {
    displayId: fromId,
    movedToDisplayId: toId,
    addedAtMs: safeNow,
    expiresAtMs: safeNow + monitorAvoidMs,
    sourceReason: normalizeReason(sourceReason, "manual_correction"),
  };
  safeState.fallbackReason = REASON_NONE;
  safeState.reentryReason = REASON_NONE;
  safeState.reentryAtMs = 0;
  safeState.lastManualCorrection = {
    fromDisplayId: fromId,
    toDisplayId: toId,
    recordedAtMs: safeNow,
  };
  markRoamPolicyDecision(
    safeState,
    ROAM_POLICY_DECISION_REASONS.manualDisplayAvoidRecorded,
    safeNow
  );
  return {
    recorded: true,
    reason: ROAM_POLICY_DECISION_REASONS.manualDisplayAvoidRecorded,
    entry: {
      ...safeState.avoidedDisplays[fromId],
      remainingMs: monitorAvoidMs,
    },
    activeAvoidedDisplays: listActiveAvoidedDisplays(safeState, safeNow),
  };
}

function normalizeDisplayAreas(displayAreas = []) {
  if (!Array.isArray(displayAreas)) return [];
  const dedupe = new Set();
  const normalized = [];
  for (const entry of displayAreas) {
    const displayId = normalizeDisplayId(entry?.displayId);
    const bounds = entry?.bounds;
    if (
      !displayId ||
      dedupe.has(displayId) ||
      !bounds ||
      !Number.isFinite(toSafeNumber(bounds.x, NaN)) ||
      !Number.isFinite(toSafeNumber(bounds.y, NaN)) ||
      !Number.isFinite(toSafeNumber(bounds.width, NaN)) ||
      !Number.isFinite(toSafeNumber(bounds.height, NaN))
    ) {
      continue;
    }
    const width = Math.max(1, Math.round(toSafeNumber(bounds.width, 1)));
    const height = Math.max(1, Math.round(toSafeNumber(bounds.height, 1)));
    dedupe.add(displayId);
    normalized.push({
      displayId,
      bounds: {
        x: Math.round(toSafeNumber(bounds.x, 0)),
        y: Math.round(toSafeNumber(bounds.y, 0)),
        width,
        height,
      },
    });
  }
  return normalized;
}

function planDesktopRoamSampling(state, {
  displayAreas = [],
  nowMs = Date.now(),
} = {}) {
  const safeState = ensurePolicyState(state);
  const safeNow = Math.max(0, Math.round(toSafeNumber(nowMs, Date.now())));
  const expiredDisplayIds = pruneExpiredAvoidedDisplays(safeState, safeNow);
  const normalizedAreas = normalizeDisplayAreas(displayAreas);
  const activeAvoidedDisplays = listActiveAvoidedDisplays(safeState, safeNow);
  if (normalizedAreas.length <= 0) {
    safeState.fallbackReason = ROAM_POLICY_DECISION_REASONS.desktopNoDisplaysAvailable;
    markRoamPolicyDecision(
      safeState,
      ROAM_POLICY_DECISION_REASONS.desktopNoDisplaysAvailable,
      safeNow
    );
    return {
      displayAreas: [],
      samplingAreas: [],
      activeAvoidedDisplays,
      avoidCount: activeAvoidedDisplays.length,
      decisionReason: safeState.decisionReason,
      fallbackReason: safeState.fallbackReason,
      reentryReason: resolveReentryReason(safeState, safeNow),
      expiredDisplayIds,
      usedFallback: false,
    };
  }

  const avoidedDisplayIds = new Set(
    activeAvoidedDisplays.map((entry) => normalizeDisplayId(entry.displayId)).filter(Boolean)
  );
  let selectedAreas = normalizedAreas.filter((entry) => !avoidedDisplayIds.has(entry.displayId));
  let usedFallback = false;
  if (selectedAreas.length <= 0) {
    selectedAreas = normalizedAreas;
    usedFallback = true;
  }

  const decisionReason = usedFallback
    ? ROAM_POLICY_DECISION_REASONS.avoidanceExhaustedFallback
    : activeAvoidedDisplays.length > 0
      ? ROAM_POLICY_DECISION_REASONS.desktopAvoidanceActive
      : ROAM_POLICY_DECISION_REASONS.desktopNominal;
  safeState.fallbackReason = usedFallback
    ? ROAM_POLICY_DECISION_REASONS.avoidanceExhaustedFallback
    : REASON_NONE;
  markRoamPolicyDecision(safeState, decisionReason, safeNow);

  return {
    displayAreas: selectedAreas.map((entry) => ({
      displayId: entry.displayId,
      bounds: { ...entry.bounds },
    })),
    samplingAreas: selectedAreas.map((entry) => ({ ...entry.bounds })),
    activeAvoidedDisplays,
    avoidCount: activeAvoidedDisplays.length,
    decisionReason,
    fallbackReason: safeState.fallbackReason,
    reentryReason: resolveReentryReason(safeState, safeNow),
    expiredDisplayIds,
    usedFallback,
  };
}

function buildRoamPolicySnapshot(state, {
  roamMode = "desktop",
  nowMs = Date.now(),
} = {}) {
  const safeState = ensurePolicyState(state);
  const safeNow = Math.max(0, Math.round(toSafeNumber(nowMs, Date.now())));
  pruneExpiredAvoidedDisplays(safeState, safeNow);
  const activeAvoidedDisplays = listActiveAvoidedDisplays(safeState, safeNow);
  const normalizedRoamMode = normalizeReason(roamMode, "desktop");
  const fallbackReason = normalizeReason(safeState.fallbackReason, REASON_NONE);
  const decisionReason = normalizeReason(safeState.decisionReason, REASON_NONE);
  const reentryReason = resolveReentryReason(safeState, safeNow);

  let stateLabel = "healthy";
  let reason = "roam_policy_active";
  if (normalizedRoamMode !== "desktop") {
    stateLabel = "disabled";
    reason = "roam_mode_not_desktop";
  } else if (
    fallbackReason === ROAM_POLICY_DECISION_REASONS.avoidanceExhaustedFallback ||
    fallbackReason === ROAM_POLICY_DECISION_REASONS.desktopNoDisplaysAvailable
  ) {
    stateLabel = "degraded";
    reason = fallbackReason;
  }

  return {
    kind: "roamPolicyRuntime",
    schemaVersion: ROAM_POLICY_SCHEMA_VERSION,
    ts: safeNow,
    state: stateLabel,
    reason,
    roamMode: normalizedRoamMode,
    monitorAvoidMs: clampMs(safeState.monitorAvoidMs, MIN_MONITOR_AVOID_MS, MAX_MONITOR_AVOID_MS),
    decisionReason,
    fallbackReason,
    reentryReason,
    pacingReason: normalizeReason(safeState.pacingReason, REASON_NONE),
    pacingPhase: normalizeReason(safeState.pacingPhase, REASON_NONE),
    pacingDelayMs: clampMs(safeState.pacingDelayMs, 0, Number.MAX_SAFE_INTEGER),
    lastPacingAtMs: Math.max(0, Math.round(toSafeNumber(safeState.lastPacingAtMs, 0))),
    lastDecisionAtMs: Math.max(0, Math.round(toSafeNumber(safeState.lastDecisionAtMs, 0))),
    activeAvoidedDisplays,
    avoidCount: activeAvoidedDisplays.length,
    lastManualCorrection:
      safeState.lastManualCorrection && typeof safeState.lastManualCorrection === "object"
        ? {
            fromDisplayId: normalizeDisplayId(safeState.lastManualCorrection.fromDisplayId),
            toDisplayId: normalizeDisplayId(safeState.lastManualCorrection.toDisplayId),
            recordedAtMs: Math.max(
              0,
              Math.round(toSafeNumber(safeState.lastManualCorrection.recordedAtMs, 0))
            ),
          }
        : null,
  };
}

module.exports = {
  DEFAULT_MONITOR_AVOID_MS,
  ROAM_PACING_WINDOWS,
  ROAM_POLICY_DECISION_REASONS,
  ROAM_POLICY_SCHEMA_VERSION,
  applyRoamPacingDecision,
  buildRoamPolicySnapshot,
  createInitialRoamPolicyState,
  markRoamPolicyDecision,
  planDesktopRoamSampling,
  recordManualDisplayAvoidance,
  resolveRoamPacingDelay,
};
