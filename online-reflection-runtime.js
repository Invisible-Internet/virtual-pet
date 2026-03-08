"use strict";

const REFLECTION_SCHEMA_VERSION = "vp-reflection-runtime-v1";

const REFLECTION_CYCLE_IDS = Object.freeze({
  heartbeat: "heartbeat",
  digest: "digest",
});

const REFLECTION_OUTCOMES = Object.freeze({
  success: "success",
  suppressed: "suppressed",
  failed: "failed",
});

const REFLECTION_DEFAULTS = Object.freeze({
  digestHourLocal: 2,
  digestMinuteLocal: 0,
  heartbeatRetryDelayMs: 10 * 60 * 1000,
  digestRetryDelayMs: 30 * 60 * 1000,
  schedulerTickMs: 15000,
  maxIntentsPerCycle: 3,
  maxAcceptedSummaryChars: 900,
});

const REFLECTION_ROUTES = Object.freeze({
  heartbeat: "memory_reflection_heartbeat",
  digest: "memory_reflection_digest",
});

const REFLECTION_CONTEXT_SOURCE = "reflection_scheduler";

function toPositiveInteger(value, fallback, min = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.round(numeric));
}

function toOptionalString(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeCycleId(value, fallback = REFLECTION_CYCLE_IDS.heartbeat) {
  const normalized = toOptionalString(value, fallback);
  if (normalized === REFLECTION_CYCLE_IDS.digest) {
    return REFLECTION_CYCLE_IDS.digest;
  }
  return REFLECTION_CYCLE_IDS.heartbeat;
}

function normalizeOutcome(value, fallback = REFLECTION_OUTCOMES.suppressed) {
  const normalized = toOptionalString(value, fallback);
  if (normalized === REFLECTION_OUTCOMES.success) {
    return REFLECTION_OUTCOMES.success;
  }
  if (normalized === REFLECTION_OUTCOMES.failed) {
    return REFLECTION_OUTCOMES.failed;
  }
  return REFLECTION_OUTCOMES.suppressed;
}

function getHourBoundaryMs(nowMs) {
  const date = new Date(toPositiveInteger(nowMs, Date.now(), 0));
  date.setMinutes(0, 0, 0);
  return date.getTime();
}

function getNextHeartbeatBoundaryMs(afterMs) {
  const date = new Date(toPositiveInteger(afterMs, Date.now(), 0));
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return date.getTime();
}

function getDigestBoundaryForDateMs(nowMs, digestHourLocal, digestMinuteLocal) {
  const date = new Date(toPositiveInteger(nowMs, Date.now(), 0));
  date.setHours(
    toPositiveInteger(digestHourLocal, REFLECTION_DEFAULTS.digestHourLocal, 0),
    toPositiveInteger(digestMinuteLocal, REFLECTION_DEFAULTS.digestMinuteLocal, 0),
    0,
    0
  );
  return date.getTime();
}

function getNextDigestBoundaryMs(afterMs, digestHourLocal, digestMinuteLocal) {
  const boundaryMs = getDigestBoundaryForDateMs(afterMs, digestHourLocal, digestMinuteLocal);
  if (boundaryMs > afterMs) return boundaryMs;
  const date = new Date(boundaryMs);
  date.setDate(date.getDate() + 1);
  return date.getTime();
}

function normalizeLastRunEntry(value, fallbackCycleId = REFLECTION_CYCLE_IDS.heartbeat) {
  if (!value || typeof value !== "object") return null;
  const cycleId = normalizeCycleId(value.cycleId, fallbackCycleId);
  const completedAtMs = toPositiveInteger(value.completedAtMs, 0, 0);
  if (completedAtMs <= 0) return null;
  return {
    cycleId,
    outcome: normalizeOutcome(value.outcome, REFLECTION_OUTCOMES.suppressed),
    reason: toOptionalString(value.reason, "none") || "none",
    completedAtMs,
    startedAtMs: toPositiveInteger(value.startedAtMs, completedAtMs, 0),
    scheduledAtMs: toPositiveInteger(value.scheduledAtMs, 0, 0),
    acceptedIntentCount: toPositiveInteger(value.acceptedIntentCount, 0, 0),
    deferredIntentCount: toPositiveInteger(value.deferredIntentCount, 0, 0),
    rejectedIntentCount: toPositiveInteger(value.rejectedIntentCount, 0, 0),
    isRetry: value.isRetry === true,
  };
}

function computeInitialNextRunAtMs({
  cycleId,
  nowMs,
  lastCompletedAtMs = 0,
  digestHourLocal = REFLECTION_DEFAULTS.digestHourLocal,
  digestMinuteLocal = REFLECTION_DEFAULTS.digestMinuteLocal,
}) {
  const normalizedCycleId = normalizeCycleId(cycleId);
  const normalizedNowMs = toPositiveInteger(nowMs, Date.now(), 0);
  const normalizedLastCompletedAtMs = toPositiveInteger(lastCompletedAtMs, 0, 0);
  if (normalizedCycleId === REFLECTION_CYCLE_IDS.digest) {
    if (normalizedLastCompletedAtMs > 0) {
      return getNextDigestBoundaryMs(
        normalizedLastCompletedAtMs,
        digestHourLocal,
        digestMinuteLocal
      );
    }
    return getDigestBoundaryForDateMs(
      normalizedNowMs,
      digestHourLocal,
      digestMinuteLocal
    );
  }

  if (normalizedLastCompletedAtMs > 0) {
    return getNextHeartbeatBoundaryMs(normalizedLastCompletedAtMs);
  }
  return getHourBoundaryMs(normalizedNowMs);
}

function createInitialReflectionRuntimeState({
  nowMs = Date.now(),
  lastRuns = null,
  digestHourLocal = REFLECTION_DEFAULTS.digestHourLocal,
  digestMinuteLocal = REFLECTION_DEFAULTS.digestMinuteLocal,
} = {}) {
  const normalizedNowMs = toPositiveInteger(nowMs, Date.now(), 0);
  const heartbeatRun = normalizeLastRunEntry(
    lastRuns?.heartbeat,
    REFLECTION_CYCLE_IDS.heartbeat
  );
  const digestRun = normalizeLastRunEntry(
    lastRuns?.digest,
    REFLECTION_CYCLE_IDS.digest
  );

  return {
    schemaVersion: REFLECTION_SCHEMA_VERSION,
    digestHourLocal: toPositiveInteger(
      digestHourLocal,
      REFLECTION_DEFAULTS.digestHourLocal,
      0
    ),
    digestMinuteLocal: toPositiveInteger(
      digestMinuteLocal,
      REFLECTION_DEFAULTS.digestMinuteLocal,
      0
    ),
    runtimeState: "idle",
    runtimeReason: "not_started",
    rehydratedFromLogs: false,
    rehydratedEntryCount: 0,
    inFlight: null,
    lastRun: null,
    lastRuns: {
      heartbeat: heartbeatRun,
      digest: digestRun,
    },
    nextRunAtMs: {
      heartbeat: computeInitialNextRunAtMs({
        cycleId: REFLECTION_CYCLE_IDS.heartbeat,
        nowMs: normalizedNowMs,
        lastCompletedAtMs: heartbeatRun?.completedAtMs || 0,
      }),
      digest: computeInitialNextRunAtMs({
        cycleId: REFLECTION_CYCLE_IDS.digest,
        nowMs: normalizedNowMs,
        lastCompletedAtMs: digestRun?.completedAtMs || 0,
        digestHourLocal: toPositiveInteger(
          digestHourLocal,
          REFLECTION_DEFAULTS.digestHourLocal,
          0
        ),
        digestMinuteLocal: toPositiveInteger(
          digestMinuteLocal,
          REFLECTION_DEFAULTS.digestMinuteLocal,
          0
        ),
      }),
    },
    retryAtMs: {
      heartbeat: 0,
      digest: 0,
    },
  };
}

function applyRunHistoryEntries(state, entries = [], nowMs = Date.now()) {
  if (!state || typeof state !== "object") {
    return createInitialReflectionRuntimeState({ nowMs });
  }
  const normalizedEntries = Array.isArray(entries)
    ? entries
        .map((entry) => normalizeLastRunEntry(entry, REFLECTION_CYCLE_IDS.heartbeat))
        .filter(Boolean)
    : [];

  let heartbeatRun = state.lastRuns?.heartbeat || null;
  let digestRun = state.lastRuns?.digest || null;

  for (const entry of normalizedEntries) {
    if (entry.cycleId === REFLECTION_CYCLE_IDS.digest) {
      if (!digestRun || entry.completedAtMs > digestRun.completedAtMs) {
        digestRun = entry;
      }
    } else if (!heartbeatRun || entry.completedAtMs > heartbeatRun.completedAtMs) {
      heartbeatRun = entry;
    }
  }

  state.lastRuns.heartbeat = heartbeatRun;
  state.lastRuns.digest = digestRun;
  state.rehydratedFromLogs = normalizedEntries.length > 0;
  state.rehydratedEntryCount = normalizedEntries.length;
  state.nextRunAtMs.heartbeat = computeInitialNextRunAtMs({
    cycleId: REFLECTION_CYCLE_IDS.heartbeat,
    nowMs,
    lastCompletedAtMs: heartbeatRun?.completedAtMs || 0,
  });
  state.nextRunAtMs.digest = computeInitialNextRunAtMs({
    cycleId: REFLECTION_CYCLE_IDS.digest,
    nowMs,
    lastCompletedAtMs: digestRun?.completedAtMs || 0,
    digestHourLocal: state.digestHourLocal,
    digestMinuteLocal: state.digestMinuteLocal,
  });
  state.runtimeState = "idle";
  state.runtimeReason = normalizedEntries.length > 0 ? "rehydrated_from_logs" : "no_history";
  return state;
}

function resolveCycleDueAt(state, cycleId, nowMs) {
  const normalizedCycleId = normalizeCycleId(cycleId);
  const retryAtMs = toPositiveInteger(state?.retryAtMs?.[normalizedCycleId], 0, 0);
  if (retryAtMs > 0 && nowMs >= retryAtMs) {
    return {
      cycleId: normalizedCycleId,
      dueAtMs: retryAtMs,
      isRetry: true,
      trigger: "retry_due",
    };
  }
  const scheduledAtMs = toPositiveInteger(state?.nextRunAtMs?.[normalizedCycleId], 0, 0);
  if (scheduledAtMs > 0 && nowMs >= scheduledAtMs) {
    return {
      cycleId: normalizedCycleId,
      dueAtMs: scheduledAtMs,
      isRetry: false,
      trigger: "schedule_due",
    };
  }
  return null;
}

function selectDueCycle(state, nowMs = Date.now()) {
  if (!state || typeof state !== "object") return null;
  const normalizedNowMs = toPositiveInteger(nowMs, Date.now(), 0);
  const candidates = [
    resolveCycleDueAt(state, REFLECTION_CYCLE_IDS.digest, normalizedNowMs),
    resolveCycleDueAt(state, REFLECTION_CYCLE_IDS.heartbeat, normalizedNowMs),
  ].filter(Boolean);
  if (candidates.length <= 0) return null;
  candidates.sort((left, right) => left.dueAtMs - right.dueAtMs);
  return candidates[0];
}

function markRunStarted(state, { cycleId, nowMs = Date.now(), correlationId = "n/a", isRetry = false } = {}) {
  if (!state || typeof state !== "object") return state;
  const normalizedCycleId = normalizeCycleId(cycleId);
  const startedAtMs = toPositiveInteger(nowMs, Date.now(), 0);
  state.inFlight = {
    cycleId: normalizedCycleId,
    startedAtMs,
    correlationId: toOptionalString(correlationId, "n/a") || "n/a",
    isRetry: Boolean(isRetry),
  };
  state.runtimeState = "running";
  state.runtimeReason = "in_flight";
  if (isRetry) {
    state.retryAtMs[normalizedCycleId] = 0;
  }
  return state;
}

function markRunCompleted(
  state,
  {
    cycleId,
    outcome,
    reason = "none",
    nowMs = Date.now(),
    scheduledAtMs = 0,
    startedAtMs = 0,
    acceptedIntentCount = 0,
    deferredIntentCount = 0,
    rejectedIntentCount = 0,
    isRetry = false,
    retryEligible = false,
  } = {}
) {
  if (!state || typeof state !== "object") return state;
  const normalizedCycleId = normalizeCycleId(cycleId);
  const completedAtMs = toPositiveInteger(nowMs, Date.now(), 0);
  const normalizedOutcome = normalizeOutcome(outcome, REFLECTION_OUTCOMES.suppressed);
  const entry = {
    cycleId: normalizedCycleId,
    outcome: normalizedOutcome,
    reason: toOptionalString(reason, "none") || "none",
    completedAtMs,
    startedAtMs: toPositiveInteger(startedAtMs, completedAtMs, 0),
    scheduledAtMs: toPositiveInteger(scheduledAtMs, 0, 0),
    acceptedIntentCount: toPositiveInteger(acceptedIntentCount, 0, 0),
    deferredIntentCount: toPositiveInteger(deferredIntentCount, 0, 0),
    rejectedIntentCount: toPositiveInteger(rejectedIntentCount, 0, 0),
    isRetry: Boolean(isRetry),
  };

  state.lastRun = entry;
  state.lastRuns[normalizedCycleId] = entry;
  state.nextRunAtMs[normalizedCycleId] = computeInitialNextRunAtMs({
    cycleId: normalizedCycleId,
    nowMs: completedAtMs,
    lastCompletedAtMs: completedAtMs,
    digestHourLocal: state.digestHourLocal,
    digestMinuteLocal: state.digestMinuteLocal,
  });

  if (normalizedOutcome === REFLECTION_OUTCOMES.failed && retryEligible && !isRetry) {
    const retryDelayMs =
      normalizedCycleId === REFLECTION_CYCLE_IDS.digest
        ? REFLECTION_DEFAULTS.digestRetryDelayMs
        : REFLECTION_DEFAULTS.heartbeatRetryDelayMs;
    state.retryAtMs[normalizedCycleId] = completedAtMs + retryDelayMs;
  } else {
    state.retryAtMs[normalizedCycleId] = 0;
  }

  state.inFlight = null;
  state.runtimeState =
    normalizedOutcome === REFLECTION_OUTCOMES.failed
      ? "degraded"
      : normalizedOutcome === REFLECTION_OUTCOMES.suppressed
        ? "suppressed"
        : "ready";
  state.runtimeReason = entry.reason;
  return state;
}

function markCycleSuppressedInFlight(state, { cycleId, nowMs = Date.now(), reason = "suppressed_in_flight" } = {}) {
  const preservedInFlight =
    state && state.inFlight && typeof state.inFlight === "object"
      ? {
          ...state.inFlight,
        }
      : null;
  markRunCompleted(state, {
    cycleId,
    outcome: REFLECTION_OUTCOMES.suppressed,
    reason,
    nowMs,
    startedAtMs: nowMs,
    scheduledAtMs: toPositiveInteger(state?.nextRunAtMs?.[normalizeCycleId(cycleId)], 0, 0),
    acceptedIntentCount: 0,
    deferredIntentCount: 0,
    rejectedIntentCount: 0,
    isRetry: false,
    retryEligible: false,
  });
  if (preservedInFlight) {
    state.inFlight = preservedInFlight;
    state.runtimeState = "running";
    state.runtimeReason = "in_flight";
  }
  return state;
}

module.exports = {
  REFLECTION_CONTEXT_SOURCE,
  REFLECTION_CYCLE_IDS,
  REFLECTION_DEFAULTS,
  REFLECTION_OUTCOMES,
  REFLECTION_ROUTES,
  REFLECTION_SCHEMA_VERSION,
  applyRunHistoryEntries,
  computeInitialNextRunAtMs,
  createInitialReflectionRuntimeState,
  markCycleSuppressedInFlight,
  markRunCompleted,
  markRunStarted,
  normalizeCycleId,
  normalizeLastRunEntry,
  normalizeOutcome,
  selectDueCycle,
};
