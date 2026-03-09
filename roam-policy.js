"use strict";

const ROAM_POLICY_SCHEMA_VERSION = "vp-roam-policy-v1";
const REASON_NONE = "none";
const DEFAULT_MONITOR_AVOID_MS = 45000;
const DEFAULT_WINDOW_AVOID_MS = 120000;
const REENTRY_REASON_VISIBLE_MS = 90000;
const MIN_MONITOR_AVOID_MS = 1000;
const MAX_MONITOR_AVOID_MS = 300000;
const MIN_WINDOW_AVOID_MS = 1000;
const MAX_WINDOW_AVOID_MS = 900000;

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
  foregroundWindowNominal: "foreground_window_nominal",
  foregroundWindowSoftInspectOnly: "foreground_window_soft_inspect_only",
  foregroundWindowInspectEdgePending: "foreground_window_inspect_edge_pending",
  foregroundWindowInspectBottomEdgeActive: "foreground_window_inspect_bottom_edge_active",
  foregroundWindowAvoidanceActive: "foreground_window_avoidance_active",
  foregroundWindowBoundsUpdated: "foreground_window_bounds_updated",
  foregroundWindowNoFreeAreaFallback: "foreground_window_no_free_area_fallback",
  foregroundWindowInspectAnchorUnavailable: "foreground_window_inspect_anchor_unavailable",
  manualWindowAvoidRecorded: "manual_window_avoid_recorded",
  manualWindowAvoidIgnored: "manual_window_avoid_ignored",
  windowAvoidCooldownActive: "window_avoid_cooldown_active",
  windowAvoidExpiredReentry: "window_avoid_expired_reentry",
  windowAvoidanceNotDesktopMode: "window_avoidance_not_desktop_mode",
  windowAvoidanceNotSupportedPlatform: "window_avoidance_not_supported_platform",
  foregroundWindowProviderUnavailable: "foreground_window_provider_unavailable",
  foregroundWindowQueryFailed: "foreground_window_query_failed",
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

function normalizeWindowId(value) {
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
  windowAvoidMs = DEFAULT_WINDOW_AVOID_MS,
} = {}) {
  const safeNow = Math.max(0, Math.round(toSafeNumber(nowMs, Date.now())));
  return {
    schemaVersion: ROAM_POLICY_SCHEMA_VERSION,
    monitorAvoidMs: clampMs(monitorAvoidMs, MIN_MONITOR_AVOID_MS, MAX_MONITOR_AVOID_MS),
    windowAvoidMs: clampMs(windowAvoidMs, MIN_WINDOW_AVOID_MS, MAX_WINDOW_AVOID_MS),
    avoidedDisplays: {},
    avoidedWindows: {},
    decisionReason: ROAM_POLICY_DECISION_REASONS.startup,
    lastDecisionAtMs: safeNow,
    pacingReason: REASON_NONE,
    pacingPhase: REASON_NONE,
    pacingDelayMs: 0,
    lastPacingAtMs: 0,
    fallbackReason: REASON_NONE,
    reentryReason: REASON_NONE,
    reentryAtMs: 0,
    windowDecisionReason: REASON_NONE,
    windowFallbackReason: REASON_NONE,
    windowReentryReason: REASON_NONE,
    windowReentryAtMs: 0,
    lastManualCorrection: null,
    lastManualWindowCorrection: null,
  };
}

function ensurePolicyState(state) {
  if (!state || typeof state !== "object") {
    return createInitialRoamPolicyState();
  }
  if (!state.avoidedDisplays || typeof state.avoidedDisplays !== "object") {
    state.avoidedDisplays = {};
  }
  if (!state.avoidedWindows || typeof state.avoidedWindows !== "object") {
    state.avoidedWindows = {};
  }
  if (!Number.isFinite(Number(state.windowAvoidMs))) {
    state.windowAvoidMs = DEFAULT_WINDOW_AVOID_MS;
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

function pruneExpiredAvoidedWindows(state, nowMs = Date.now()) {
  const safeState = ensurePolicyState(state);
  const safeNow = Math.max(0, Math.round(toSafeNumber(nowMs, Date.now())));
  const expiredWindowIds = [];
  for (const [windowId, entry] of Object.entries(safeState.avoidedWindows)) {
    const expiresAtMs = Math.max(0, Math.round(toSafeNumber(entry?.expiresAtMs, 0)));
    if (expiresAtMs <= 0 || expiresAtMs <= safeNow) {
      delete safeState.avoidedWindows[windowId];
      expiredWindowIds.push(windowId);
    }
  }
  if (expiredWindowIds.length > 0) {
    safeState.windowReentryReason = ROAM_POLICY_DECISION_REASONS.windowAvoidExpiredReentry;
    safeState.windowReentryAtMs = safeNow;
  }
  return expiredWindowIds;
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

function listActiveAvoidedWindows(state, nowMs = Date.now()) {
  const safeState = ensurePolicyState(state);
  const safeNow = Math.max(0, Math.round(toSafeNumber(nowMs, Date.now())));
  const active = [];
  for (const entry of Object.values(safeState.avoidedWindows)) {
    const windowId = normalizeWindowId(entry?.windowId);
    if (!windowId) continue;
    const addedAtMs = Math.max(0, Math.round(toSafeNumber(entry?.addedAtMs, 0)));
    const expiresAtMs = Math.max(0, Math.round(toSafeNumber(entry?.expiresAtMs, 0)));
    if (expiresAtMs <= safeNow) continue;
    active.push({
      windowId,
      addedAtMs,
      expiresAtMs,
      remainingMs: Math.max(0, expiresAtMs - safeNow),
      sourceReason: normalizeReason(entry?.sourceReason, "manual_correction"),
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

function resolveWindowReentryReason(state, nowMs = Date.now()) {
  const safeState = ensurePolicyState(state);
  const safeNow = Math.max(0, Math.round(toSafeNumber(nowMs, Date.now())));
  const reason = normalizeReason(safeState.windowReentryReason, REASON_NONE);
  const reentryAtMs = Math.max(0, Math.round(toSafeNumber(safeState.windowReentryAtMs, 0)));
  if (
    reason !== REASON_NONE &&
    reentryAtMs > 0 &&
    safeNow - reentryAtMs <= REENTRY_REASON_VISIBLE_MS
  ) {
    return reason;
  }
  if (safeState.windowReentryReason !== REASON_NONE) {
    safeState.windowReentryReason = REASON_NONE;
    safeState.windowReentryAtMs = 0;
  }
  return REASON_NONE;
}

function recordManualWindowAvoidance(state, {
  windowId = null,
  nowMs = Date.now(),
  sourceReason = "manual_correction",
} = {}) {
  const safeState = ensurePolicyState(state);
  const safeNow = Math.max(0, Math.round(toSafeNumber(nowMs, Date.now())));
  pruneExpiredAvoidedWindows(safeState, safeNow);
  const normalizedWindowId = normalizeWindowId(windowId);
  if (!normalizedWindowId) {
    return {
      recorded: false,
      reason: ROAM_POLICY_DECISION_REASONS.manualWindowAvoidIgnored,
      activeAvoidedWindows: listActiveAvoidedWindows(safeState, safeNow),
    };
  }
  const windowAvoidMs = clampMs(
    safeState.windowAvoidMs,
    MIN_WINDOW_AVOID_MS,
    MAX_WINDOW_AVOID_MS
  );
  safeState.avoidedWindows[normalizedWindowId] = {
    windowId: normalizedWindowId,
    addedAtMs: safeNow,
    expiresAtMs: safeNow + windowAvoidMs,
    sourceReason: normalizeReason(sourceReason, "manual_correction"),
  };
  safeState.windowFallbackReason = REASON_NONE;
  safeState.windowReentryReason = REASON_NONE;
  safeState.windowReentryAtMs = 0;
  safeState.windowDecisionReason = ROAM_POLICY_DECISION_REASONS.manualWindowAvoidRecorded;
  safeState.lastManualWindowCorrection = {
    windowId: normalizedWindowId,
    recordedAtMs: safeNow,
  };
  return {
    recorded: true,
    reason: ROAM_POLICY_DECISION_REASONS.manualWindowAvoidRecorded,
    entry: {
      ...safeState.avoidedWindows[normalizedWindowId],
      remainingMs: windowAvoidMs,
    },
    activeAvoidedWindows: listActiveAvoidedWindows(safeState, safeNow),
  };
}

function isWindowAvoidActive(state, windowId, nowMs = Date.now()) {
  const safeState = ensurePolicyState(state);
  const safeNow = Math.max(0, Math.round(toSafeNumber(nowMs, Date.now())));
  pruneExpiredAvoidedWindows(safeState, safeNow);
  const normalizedWindowId = normalizeWindowId(windowId);
  if (!normalizedWindowId) return false;
  const entry = safeState.avoidedWindows[normalizedWindowId];
  const expiresAtMs = Math.max(0, Math.round(toSafeNumber(entry?.expiresAtMs, 0)));
  return expiresAtMs > safeNow;
}

function normalizeBoundsRect(bounds) {
  if (!bounds || typeof bounds !== "object") return null;
  const x = toSafeNumber(bounds.x, NaN);
  const y = toSafeNumber(bounds.y, NaN);
  const width = toSafeNumber(bounds.width, NaN);
  const height = toSafeNumber(bounds.height, NaN);
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

function expandBoundsRect(bounds, marginPx = 0) {
  const normalized = normalizeBoundsRect(bounds);
  if (!normalized) return null;
  const margin = Math.max(0, Math.round(toSafeNumber(marginPx, 0)));
  return {
    x: normalized.x - margin,
    y: normalized.y - margin,
    width: normalized.width + margin * 2,
    height: normalized.height + margin * 2,
  };
}

function intersectBoundsRect(leftBounds, rightBounds) {
  const left = normalizeBoundsRect(leftBounds);
  const right = normalizeBoundsRect(rightBounds);
  if (!left || !right) return null;
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const maxX = Math.min(left.x + left.width, right.x + right.width);
  const maxY = Math.min(left.y + left.height, right.y + right.height);
  const width = maxX - x;
  const height = maxY - y;
  if (width <= 0 || height <= 0) return null;
  return {
    x,
    y,
    width,
    height,
  };
}

function unionBoundsRects(boundsList = []) {
  const normalized = Array.isArray(boundsList)
    ? boundsList.map((entry) => normalizeBoundsRect(entry)).filter(Boolean)
    : [];
  if (normalized.length <= 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const bounds of normalized) {
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.max(1, Math.round(maxX - minX)),
    height: Math.max(1, Math.round(maxY - minY)),
  };
}

function subtractMaskFromArea(area, mask) {
  const normalizedArea = normalizeBoundsRect(area);
  const normalizedMask = normalizeBoundsRect(mask);
  if (!normalizedArea) return [];
  if (!normalizedMask) return [normalizedArea];
  const overlap = intersectBoundsRect(normalizedArea, normalizedMask);
  if (!overlap) return [normalizedArea];

  const top = {
    x: normalizedArea.x,
    y: normalizedArea.y,
    width: normalizedArea.width,
    height: overlap.y - normalizedArea.y,
  };
  const bottom = {
    x: normalizedArea.x,
    y: overlap.y + overlap.height,
    width: normalizedArea.width,
    height: normalizedArea.y + normalizedArea.height - (overlap.y + overlap.height),
  };
  const left = {
    x: normalizedArea.x,
    y: overlap.y,
    width: overlap.x - normalizedArea.x,
    height: overlap.height,
  };
  const right = {
    x: overlap.x + overlap.width,
    y: overlap.y,
    width: normalizedArea.x + normalizedArea.width - (overlap.x + overlap.width),
    height: overlap.height,
  };
  return [top, right, bottom, left].map((entry) => normalizeBoundsRect(entry)).filter(Boolean);
}

function canAreaFitPetBounds(area, petBounds) {
  const normalizedArea = normalizeBoundsRect(area);
  const normalizedPetBounds = normalizeBoundsRect({
    x: 0,
    y: 0,
    width: petBounds?.width,
    height: petBounds?.height,
  });
  if (!normalizedArea || !normalizedPetBounds) return false;
  return normalizedArea.width >= normalizedPetBounds.width && normalizedArea.height >= normalizedPetBounds.height;
}

function isDestinationInsideArea(destination, area, petBounds) {
  const normalizedArea = normalizeBoundsRect(area);
  const normalizedPetBounds = normalizeBoundsRect({
    x: 0,
    y: 0,
    width: petBounds?.width,
    height: petBounds?.height,
  });
  if (!normalizedArea || !normalizedPetBounds) return false;
  const x = Math.round(toSafeNumber(destination?.x, NaN));
  const y = Math.round(toSafeNumber(destination?.y, NaN));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const minX = normalizedArea.x - normalizedPetBounds.x;
  const maxX = normalizedArea.x + normalizedArea.width - normalizedPetBounds.x - normalizedPetBounds.width;
  const minY = normalizedArea.y - normalizedPetBounds.y;
  const maxY = normalizedArea.y + normalizedArea.height - normalizedPetBounds.y - normalizedPetBounds.height;
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

function isDestinationInsideAnyArea(destination, areas = [], petBounds = null) {
  if (!Array.isArray(areas) || areas.length <= 0) return false;
  return areas.some((area) => isDestinationInsideArea(destination, area, petBounds));
}

function normalizePoint(point = null) {
  if (!point || typeof point !== "object") return null;
  const x = toSafeNumber(point.x, NaN);
  const y = toSafeNumber(point.y, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: Math.round(x),
    y: Math.round(y),
  };
}

function clampUnit(value, fallback = 0) {
  const numeric = toSafeNumber(value, fallback);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric <= 0) return 0;
  if (numeric >= 1) return 1;
  return numeric;
}

function getInspectAnchorPreferenceWeight(key = "", preferenceProfile = "default") {
  if (preferenceProfile === "corner_preferred_media_watch") {
    if (key === "bottom_right_quarter" || key === "bottom_left_quarter") return 1.25;
    if (key === "bottom_center") return 0.12;
    return 0.85;
  }
  if (key === "bottom_right_quarter" || key === "bottom_left_quarter") return 1;
  if (key === "bottom_center") return 0.45;
  return 0.8;
}

function selectInspectAnchorCandidate(
  candidates = [],
  { currentPetPoint = null, randomUnit = null, preferenceProfile = "default" } = {}
) {
  if (!Array.isArray(candidates) || candidates.length <= 0) return null;
  if (candidates.length === 1) {
    return candidates[0];
  }
  const normalizedPoint = normalizePoint(currentPetPoint);
  const proximityBaseOffset = preferenceProfile === "corner_preferred_media_watch" ? 320 : 120;
  const weightedCandidates = candidates.map((candidate) => {
    const hasPoint = Boolean(normalizedPoint);
    const distanceToPet = hasPoint
      ? Math.hypot(
          toSafeNumber(candidate?.point?.x, 0) - normalizedPoint.x,
          toSafeNumber(candidate?.point?.y, 0) - normalizedPoint.y
        )
      : 0;
    const preferenceWeight = getInspectAnchorPreferenceWeight(candidate?.key, preferenceProfile);
    const proximityWeight = hasPoint ? 1 / Math.max(1, distanceToPet + proximityBaseOffset) : 1;
    return {
      ...candidate,
      weight: Math.max(0.00001, preferenceWeight * proximityWeight),
    };
  });
  const totalWeight = weightedCandidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (totalWeight <= 0) {
    return weightedCandidates[0];
  }
  const safeRandomUnit = clampUnit(randomUnit, typeof Math.random === "function" ? Math.random() : 0);
  const threshold = safeRandomUnit * totalWeight;
  let runningWeight = 0;
  for (const candidate of weightedCandidates) {
    runningWeight += candidate.weight;
    if (runningWeight >= threshold) {
      return candidate;
    }
  }
  return weightedCandidates[weightedCandidates.length - 1];
}

function resolveBottomEdgeInspectAnchor({
  windowBounds = null,
  samplingAreas = [],
  petBounds = null,
  bottomBandPx = 64,
  bottomInsetPx = 12,
  bottomGracePx = 220,
  currentPetPoint = null,
  randomUnit = null,
  preferenceProfile = "default",
} = {}) {
  const normalizedWindowBounds = normalizeBoundsRect(windowBounds);
  const normalizedPetBounds = normalizeBoundsRect({
    x: 0,
    y: 0,
    width: petBounds?.width,
    height: petBounds?.height,
  });
  if (!normalizedWindowBounds || !normalizedPetBounds || !Array.isArray(samplingAreas) || samplingAreas.length <= 0) {
    return {
      anchor: null,
      reason: ROAM_POLICY_DECISION_REASONS.foregroundWindowInspectAnchorUnavailable,
    };
  }

  const windowBottom = normalizedWindowBounds.y + normalizedWindowBounds.height;
  const safeBottomBandPx = Math.max(1, Math.round(toSafeNumber(bottomBandPx, 64)));
  const safeBottomInsetPx = Math.max(1, Math.round(toSafeNumber(bottomInsetPx, 12)));
  const safeBottomGracePx = Math.max(
    0,
    Math.round(toSafeNumber(bottomGracePx, normalizedPetBounds.height))
  );
  const candidatePetTopY = windowBottom - safeBottomInsetPx - normalizedPetBounds.height;
  const candidateXs = [
    {
      key: "bottom_center",
      x: normalizedWindowBounds.x + Math.round(normalizedWindowBounds.width * 0.5),
    },
    {
      key: "bottom_right_quarter",
      x: normalizedWindowBounds.x + Math.round(normalizedWindowBounds.width * 0.75),
    },
    {
      key: "bottom_left_quarter",
      x: normalizedWindowBounds.x + Math.round(normalizedWindowBounds.width * 0.25),
    },
  ];
  const validCandidates = [];
  for (const candidate of candidateXs) {
    const petRect = {
      x: Math.round(candidate.x - normalizedPetBounds.width * 0.5),
      y: Math.round(candidatePetTopY),
      width: normalizedPetBounds.width,
      height: normalizedPetBounds.height,
    };
    const destination = {
      x: Math.round(petRect.x - toSafeNumber(petBounds?.x, 0)),
      y: Math.round(petRect.y - toSafeNumber(petBounds?.y, 0)),
    };
    if (!isDestinationInsideAnyArea(destination, samplingAreas, petBounds)) {
      continue;
    }
    const overlap = intersectBoundsRect(petRect, normalizedWindowBounds);
    if (!overlap) continue;
    const bandTop = windowBottom - safeBottomBandPx;
    const overlapBottom = overlap.y + overlap.height;
    const minAllowedOverlapTop = bandTop - safeBottomGracePx;
    if (overlapBottom < bandTop || overlapBottom > windowBottom || overlap.y < minAllowedOverlapTop) {
      continue;
    }
    validCandidates.push({
      lane: "bottom_edge",
      key: candidate.key,
      point: {
        x: candidate.x,
        y: windowBottom - safeBottomInsetPx,
      },
      destination,
    });
  }

  const selectedCandidate = selectInspectAnchorCandidate(validCandidates, {
    currentPetPoint,
    randomUnit,
    preferenceProfile,
  });
  if (selectedCandidate) {
    return {
      anchor: selectedCandidate,
      reason: REASON_NONE,
    };
  }

  return {
    anchor: null,
    reason: ROAM_POLICY_DECISION_REASONS.foregroundWindowInspectAnchorUnavailable,
  };
}

function planActiveWindowAvoidanceSampling({
  samplingAreas = [],
  activeWindowBounds = null,
  avoidMarginPx = 24,
  petBounds = null,
  strictAvoidActive = false,
} = {}) {
  const normalizedSamplingAreas = Array.isArray(samplingAreas)
    ? samplingAreas.map((entry) => normalizeBoundsRect(entry)).filter(Boolean)
    : [];
  const expandedMask = expandBoundsRect(activeWindowBounds, avoidMarginPx);
  if (normalizedSamplingAreas.length <= 0) {
    return {
      samplingAreas: [],
      avoidMaskBounds: null,
      strictAvoidActive: Boolean(strictAvoidActive),
      usedFallback: false,
      fallbackReason: REASON_NONE,
    };
  }
  if (!expandedMask) {
    return {
      samplingAreas: normalizedSamplingAreas,
      avoidMaskBounds: null,
      strictAvoidActive: Boolean(strictAvoidActive),
      usedFallback: false,
      fallbackReason: REASON_NONE,
    };
  }
  const clippedMasks = normalizedSamplingAreas
    .map((entry) => intersectBoundsRect(entry, expandedMask))
    .filter(Boolean);
  if (!strictAvoidActive) {
    return {
      samplingAreas: normalizedSamplingAreas,
      avoidMaskBounds: unionBoundsRects(clippedMasks),
      strictAvoidActive: false,
      usedFallback: false,
      fallbackReason: REASON_NONE,
    };
  }
  const clippedCandidates = [];
  for (const area of normalizedSamplingAreas) {
    const overlap = intersectBoundsRect(area, expandedMask);
    if (!overlap) {
      if (canAreaFitPetBounds(area, petBounds)) {
        clippedCandidates.push(area);
      }
      continue;
    }
    for (const candidate of subtractMaskFromArea(area, overlap)) {
      if (canAreaFitPetBounds(candidate, petBounds)) {
        clippedCandidates.push(candidate);
      }
    }
  }

  if (clippedCandidates.length > 0) {
    return {
      samplingAreas: clippedCandidates,
      avoidMaskBounds: unionBoundsRects(clippedMasks),
      strictAvoidActive: true,
      usedFallback: false,
      fallbackReason: REASON_NONE,
    };
  }
  return {
    samplingAreas: normalizedSamplingAreas,
    avoidMaskBounds: unionBoundsRects(clippedMasks),
    strictAvoidActive: true,
    usedFallback: true,
    fallbackReason: ROAM_POLICY_DECISION_REASONS.foregroundWindowNoFreeAreaFallback,
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
  pruneExpiredAvoidedWindows(safeState, safeNow);
  const activeAvoidedDisplays = listActiveAvoidedDisplays(safeState, safeNow);
  const activeAvoidedWindows = listActiveAvoidedWindows(safeState, safeNow);
  const normalizedRoamMode = normalizeReason(roamMode, "desktop");
  const fallbackReason = normalizeReason(safeState.fallbackReason, REASON_NONE);
  const decisionReason = normalizeReason(safeState.decisionReason, REASON_NONE);
  const reentryReason = resolveReentryReason(safeState, safeNow);
  const windowReentryReason = resolveWindowReentryReason(safeState, safeNow);

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
    windowAvoidMs: clampMs(safeState.windowAvoidMs, MIN_WINDOW_AVOID_MS, MAX_WINDOW_AVOID_MS),
    decisionReason,
    fallbackReason,
    reentryReason,
    windowDecisionReason: normalizeReason(safeState.windowDecisionReason, REASON_NONE),
    windowFallbackReason: normalizeReason(safeState.windowFallbackReason, REASON_NONE),
    windowReentryReason,
    pacingReason: normalizeReason(safeState.pacingReason, REASON_NONE),
    pacingPhase: normalizeReason(safeState.pacingPhase, REASON_NONE),
    pacingDelayMs: clampMs(safeState.pacingDelayMs, 0, Number.MAX_SAFE_INTEGER),
    lastPacingAtMs: Math.max(0, Math.round(toSafeNumber(safeState.lastPacingAtMs, 0))),
    lastDecisionAtMs: Math.max(0, Math.round(toSafeNumber(safeState.lastDecisionAtMs, 0))),
    activeAvoidedDisplays,
    avoidCount: activeAvoidedDisplays.length,
    activeAvoidedWindows,
    windowAvoidCount: activeAvoidedWindows.length,
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
    lastManualWindowCorrection:
      safeState.lastManualWindowCorrection &&
      typeof safeState.lastManualWindowCorrection === "object"
        ? {
            windowId: normalizeWindowId(safeState.lastManualWindowCorrection.windowId),
            recordedAtMs: Math.max(
              0,
              Math.round(toSafeNumber(safeState.lastManualWindowCorrection.recordedAtMs, 0))
            ),
          }
        : null,
  };
}

module.exports = {
  DEFAULT_MONITOR_AVOID_MS,
  DEFAULT_WINDOW_AVOID_MS,
  ROAM_PACING_WINDOWS,
  ROAM_POLICY_DECISION_REASONS,
  ROAM_POLICY_SCHEMA_VERSION,
  applyRoamPacingDecision,
  buildRoamPolicySnapshot,
  canAreaFitPetBounds,
  createInitialRoamPolicyState,
  intersectBoundsRect,
  isWindowAvoidActive,
  listActiveAvoidedWindows,
  markRoamPolicyDecision,
  normalizeBoundsRect,
  planDesktopRoamSampling,
  planActiveWindowAvoidanceSampling,
  recordManualDisplayAvoidance,
  recordManualWindowAvoidance,
  resolveBottomEdgeInspectAnchor,
  resolveRoamPacingDelay,
};
