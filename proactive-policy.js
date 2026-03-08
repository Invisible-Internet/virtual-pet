"use strict";

const PROACTIVE_BACKOFF_COOLDOWN_MS = Object.freeze([180000, 360000, 720000, 1200000]);
const PROACTIVE_REPEAT_GUARD_WINDOW_MS = 1800000;
const PROACTIVE_RECENT_USER_INPUT_WINDOW_MS = 90000;
const PROACTIVE_SUPPRESSED_RETRY_MS = 6000;
const PROACTIVE_REASON_NONE = "none";

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampBackoffTier(value) {
  const tier = Math.round(toNumber(value, 0));
  return Math.max(0, Math.min(PROACTIVE_BACKOFF_COOLDOWN_MS.length - 1, tier));
}

function getProactiveCooldownMsForTier(backoffTier = 0) {
  return PROACTIVE_BACKOFF_COOLDOWN_MS[clampBackoffTier(backoffTier)];
}

function pruneRecentOpenerHistory(history, nowMs, windowMs = PROACTIVE_REPEAT_GUARD_WINDOW_MS) {
  if (!Array.isArray(history) || history.length <= 0) return [];
  return history
    .filter((entry) => {
      const hash = typeof entry?.hash === "string" ? entry.hash.trim() : "";
      const tsMs = Math.max(0, Math.round(toNumber(entry?.tsMs, 0)));
      return hash.length > 0 && tsMs > 0 && nowMs - tsMs <= windowMs;
    })
    .slice(-24);
}

function hasRecentOpenerHash(history, openerHash, nowMs, windowMs = PROACTIVE_REPEAT_GUARD_WINDOW_MS) {
  const normalizedHash = typeof openerHash === "string" ? openerHash.trim() : "";
  if (!normalizedHash) return false;
  const recent = pruneRecentOpenerHistory(history, nowMs, windowMs);
  return recent.some((entry) => entry.hash === normalizedHash);
}

function createInitialProactivePolicyState(nowMs = Date.now()) {
  const now = Math.max(0, Math.round(toNumber(nowMs, Date.now())));
  return {
    nextCheckAtMs: 0,
    lastCheckedAtMs: 0,
    lastAnnouncementAtMs: 0,
    lastSuppressedReason: PROACTIVE_REASON_NONE,
    lastSuppressedAtMs: 0,
    lastAttemptReason: PROACTIVE_REASON_NONE,
    backoffTier: 0,
    nextEligibleAtMs: now,
    recentUserInputAtMs: 0,
    repeatGuardWindowMs: PROACTIVE_REPEAT_GUARD_WINDOW_MS,
    lastOpenerHash: "none",
    recentOpenerHistory: [],
    awaitingUserEngagement: false,
  };
}

function getCooldownRemainingMs(state, nowMs) {
  const safeNow = Math.max(0, Math.round(toNumber(nowMs, Date.now())));
  const lastAnnouncementAtMs = Math.max(0, Math.round(toNumber(state?.lastAnnouncementAtMs, 0)));
  if (lastAnnouncementAtMs <= 0) return 0;
  const cooldownMs = getProactiveCooldownMsForTier(state?.backoffTier || 0);
  const elapsedMs = Math.max(0, safeNow - lastAnnouncementAtMs);
  if (elapsedMs >= cooldownMs) return 0;
  return Math.max(0, cooldownMs - elapsedMs);
}

function applyIgnoredBackoffIfNeeded(state, nowMs = Date.now()) {
  if (!state || typeof state !== "object") return state;
  const safeNow = Math.max(0, Math.round(toNumber(nowMs, Date.now())));
  if (!state.awaitingUserEngagement) return state;
  const lastAnnouncementAtMs = Math.max(0, Math.round(toNumber(state.lastAnnouncementAtMs, 0)));
  if (lastAnnouncementAtMs <= 0) return state;
  const remainingMs = getCooldownRemainingMs(state, safeNow);
  if (remainingMs > 0) return state;
  state.backoffTier = clampBackoffTier((state.backoffTier || 0) + 1);
  state.awaitingUserEngagement = false;
  state.nextEligibleAtMs = safeNow + getProactiveCooldownMsForTier(state.backoffTier);
  return state;
}

function evaluateProactiveSuppression({
  state,
  nowMs = Date.now(),
  dialogOpen = false,
  inputActive = false,
  stateEligible = true,
  quietHoursActive = false,
  candidateOpenerHash = "",
} = {}) {
  const safeNow = Math.max(0, Math.round(toNumber(nowMs, Date.now())));
  const safeState = state && typeof state === "object" ? state : createInitialProactivePolicyState(safeNow);
  safeState.recentOpenerHistory = pruneRecentOpenerHistory(
    safeState.recentOpenerHistory,
    safeNow,
    PROACTIVE_REPEAT_GUARD_WINDOW_MS
  );

  if (dialogOpen) {
    return {
      suppressed: true,
      reason: "suppressed_dialog_open",
      cooldownRemainingMs: 0,
      nextEligibleAtMs: safeNow,
    };
  }
  const recentUserInputAtMs = Math.max(0, toNumber(safeState.recentUserInputAtMs, 0));
  const recentInputSuppressed =
    recentUserInputAtMs > 0 && safeNow - recentUserInputAtMs < PROACTIVE_RECENT_USER_INPUT_WINDOW_MS;
  if (inputActive || recentInputSuppressed) {
    return {
      suppressed: true,
      reason: "suppressed_input_active",
      cooldownRemainingMs: 0,
      nextEligibleAtMs: safeNow + PROACTIVE_RECENT_USER_INPUT_WINDOW_MS,
    };
  }
  if (!stateEligible) {
    return {
      suppressed: true,
      reason: "suppressed_state_ineligible",
      cooldownRemainingMs: 0,
      nextEligibleAtMs: safeNow,
    };
  }
  if (quietHoursActive) {
    return {
      suppressed: true,
      reason: "suppressed_quiet_hours",
      cooldownRemainingMs: 0,
      nextEligibleAtMs: safeNow,
    };
  }

  const cooldownRemainingMs = getCooldownRemainingMs(safeState, safeNow);
  if (cooldownRemainingMs > 0) {
    return {
      suppressed: true,
      reason: "suppressed_cooldown",
      cooldownRemainingMs,
      nextEligibleAtMs: safeNow + cooldownRemainingMs,
    };
  }

  if (
    hasRecentOpenerHash(
      safeState.recentOpenerHistory,
      candidateOpenerHash,
      safeNow,
      PROACTIVE_REPEAT_GUARD_WINDOW_MS
    )
  ) {
    return {
      suppressed: true,
      reason: "suppressed_repeat_guard",
      cooldownRemainingMs: 0,
      nextEligibleAtMs: safeNow + PROACTIVE_SUPPRESSED_RETRY_MS,
    };
  }

  return {
    suppressed: false,
    reason: "",
    cooldownRemainingMs: 0,
    nextEligibleAtMs: safeNow,
  };
}

function recordProactiveSuppression(state, {
  reason = "unknown",
  nowMs = Date.now(),
  cooldownRemainingMs = 0,
} = {}) {
  if (!state || typeof state !== "object") return state;
  const safeNow = Math.max(0, Math.round(toNumber(nowMs, Date.now())));
  const normalizedReason = typeof reason === "string" && reason.trim().length > 0 ? reason.trim() : "unknown";
  const remainingMs = Math.max(0, Math.round(toNumber(cooldownRemainingMs, 0)));
  state.lastAttemptReason = normalizedReason;
  state.lastSuppressedReason = normalizedReason;
  state.lastSuppressedAtMs = safeNow;
  state.nextEligibleAtMs = safeNow + remainingMs;
  state.nextCheckAtMs =
    normalizedReason === "suppressed_cooldown" && remainingMs > 0
      ? safeNow + Math.max(PROACTIVE_SUPPRESSED_RETRY_MS, remainingMs)
      : safeNow + PROACTIVE_SUPPRESSED_RETRY_MS;
  return state;
}

function recordProactiveAnnouncement(state, {
  nowMs = Date.now(),
  openerHash = "",
} = {}) {
  if (!state || typeof state !== "object") return state;
  const safeNow = Math.max(0, Math.round(toNumber(nowMs, Date.now())));
  const normalizedHash = typeof openerHash === "string" && openerHash.trim().length > 0 ? openerHash.trim() : "none";
  const cooldownMs = getProactiveCooldownMsForTier(state.backoffTier || 0);
  state.lastAnnouncementAtMs = safeNow;
  state.lastAttemptReason = "eligible_emit";
  state.lastSuppressedReason = PROACTIVE_REASON_NONE;
  state.lastSuppressedAtMs = 0;
  state.nextEligibleAtMs = safeNow + cooldownMs;
  state.nextCheckAtMs = safeNow + cooldownMs;
  state.lastOpenerHash = normalizedHash;
  state.recentOpenerHistory = pruneRecentOpenerHistory(
    [
      ...(Array.isArray(state.recentOpenerHistory) ? state.recentOpenerHistory : []),
      { hash: normalizedHash, tsMs: safeNow },
    ],
    safeNow,
    PROACTIVE_REPEAT_GUARD_WINDOW_MS
  );
  state.awaitingUserEngagement = true;
  return state;
}

function recordProactiveUserEngagement(state, nowMs = Date.now()) {
  if (!state || typeof state !== "object") return state;
  const safeNow = Math.max(0, Math.round(toNumber(nowMs, Date.now())));
  state.backoffTier = 0;
  state.recentUserInputAtMs = safeNow;
  state.awaitingUserEngagement = false;
  state.nextEligibleAtMs = safeNow;
  return state;
}

function buildProactivePolicySnapshot(state, nowMs = Date.now()) {
  const safeNow = Math.max(0, Math.round(toNumber(nowMs, Date.now())));
  const safeState = state && typeof state === "object" ? state : createInitialProactivePolicyState(safeNow);
  const backoffTier = clampBackoffTier(safeState.backoffTier || 0);
  const cooldownMs = getProactiveCooldownMsForTier(backoffTier);
  const cooldownRemainingMs = getCooldownRemainingMs(safeState, safeNow);
  return {
    kind: "proactivePolicyState",
    ts: safeNow,
    proactiveState:
      safeState.lastSuppressedReason && safeState.lastSuppressedReason !== PROACTIVE_REASON_NONE
        ? "suppressed"
        : cooldownRemainingMs > 0
          ? "cooldown"
          : "eligible",
    lastAttemptReason:
      typeof safeState.lastAttemptReason === "string" && safeState.lastAttemptReason.trim().length > 0
        ? safeState.lastAttemptReason.trim()
        : PROACTIVE_REASON_NONE,
    suppressionReason:
      typeof safeState.lastSuppressedReason === "string" && safeState.lastSuppressedReason.trim().length > 0
        ? safeState.lastSuppressedReason.trim()
        : PROACTIVE_REASON_NONE,
    backoffTier,
    cooldownMs,
    cooldownRemainingMs,
    nextEligibleAt: Math.max(0, Math.round(toNumber(safeState.nextEligibleAtMs, safeNow))),
    repeatGuardWindowMs: PROACTIVE_REPEAT_GUARD_WINDOW_MS,
    recentUserInputAtMs: Math.max(0, Math.round(toNumber(safeState.recentUserInputAtMs, 0))),
    lastOpenerHash:
      typeof safeState.lastOpenerHash === "string" && safeState.lastOpenerHash.trim().length > 0
        ? safeState.lastOpenerHash.trim()
        : "none",
    awaitingUserEngagement: Boolean(safeState.awaitingUserEngagement),
  };
}

module.exports = {
  PROACTIVE_BACKOFF_COOLDOWN_MS,
  PROACTIVE_REASON_NONE,
  PROACTIVE_RECENT_USER_INPUT_WINDOW_MS,
  PROACTIVE_REPEAT_GUARD_WINDOW_MS,
  PROACTIVE_SUPPRESSED_RETRY_MS,
  applyIgnoredBackoffIfNeeded,
  buildProactivePolicySnapshot,
  clampBackoffTier,
  createInitialProactivePolicyState,
  evaluateProactiveSuppression,
  getProactiveCooldownMsForTier,
  getCooldownRemainingMs,
  hasRecentOpenerHash,
  pruneRecentOpenerHistory,
  recordProactiveAnnouncement,
  recordProactiveSuppression,
  recordProactiveUserEngagement,
};
