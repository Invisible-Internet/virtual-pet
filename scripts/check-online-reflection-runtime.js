"use strict";

const fs = require("fs");
const path = require("path");
const {
  REFLECTION_CYCLE_IDS,
  REFLECTION_DEFAULTS,
  REFLECTION_OUTCOMES,
  applyRunHistoryEntries,
  createInitialReflectionRuntimeState,
  markCycleSuppressedInFlight,
  markRunCompleted,
  markRunStarted,
  selectDueCycle,
} = require("../online-reflection-runtime");

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

function assertContains(text, expected, message) {
  if (typeof text !== "string" || !text.includes(expected)) {
    throw new Error(`${message} (missing "${expected}")`);
  }
}

function assertNotContains(text, expected, message) {
  if (typeof text === "string" && text.includes(expected)) {
    throw new Error(`${message} (unexpected "${expected}")`);
  }
}

function testHeartbeatWallClockCadence() {
  const nowMs = new Date(2026, 2, 8, 1, 15, 0, 0).getTime();
  const state = createInitialReflectionRuntimeState({ nowMs });
  const due = selectDueCycle(state, nowMs);
  assert(due, "heartbeat should be due on first startup when no history exists");
  assertEqual(due.cycleId, REFLECTION_CYCLE_IDS.heartbeat, "expected heartbeat due cycle");
  assertEqual(due.trigger, "schedule_due", "expected schedule_due trigger");
}

function testDigestWallClockCadence() {
  const beforeDigestMs = new Date(2026, 2, 8, 1, 30, 0, 0).getTime();
  const beforeDigestState = createInitialReflectionRuntimeState({
    nowMs: beforeDigestMs,
    digestHourLocal: REFLECTION_DEFAULTS.digestHourLocal,
    digestMinuteLocal: REFLECTION_DEFAULTS.digestMinuteLocal,
  });
  assert(
    beforeDigestState.nextRunAtMs.digest > beforeDigestMs,
    "digest should schedule to same-day 2:00 AM when current time is before digest boundary"
  );

  const afterDigestMs = new Date(2026, 2, 8, 3, 10, 0, 0).getTime();
  const afterDigestState = createInitialReflectionRuntimeState({
    nowMs: afterDigestMs,
    digestHourLocal: REFLECTION_DEFAULTS.digestHourLocal,
    digestMinuteLocal: REFLECTION_DEFAULTS.digestMinuteLocal,
  });
  const due = selectDueCycle(afterDigestState, afterDigestMs);
  assert(due, "digest should be due when current time is past digest boundary and no history exists");
  assertEqual(due.cycleId, REFLECTION_CYCLE_IDS.digest, "expected digest due cycle");
}

function testHistoryRehydrateAndOverdueCatchup() {
  const nowMs = new Date(2026, 2, 8, 10, 45, 0, 0).getTime();
  const state = createInitialReflectionRuntimeState({ nowMs });
  applyRunHistoryEntries(
    state,
    [
      {
        cycleId: REFLECTION_CYCLE_IDS.heartbeat,
        outcome: REFLECTION_OUTCOMES.success,
        reason: "request_success",
        completedAtMs: new Date(2026, 2, 8, 8, 10, 0, 0).getTime(),
      },
      {
        cycleId: REFLECTION_CYCLE_IDS.digest,
        outcome: REFLECTION_OUTCOMES.success,
        reason: "request_success",
        completedAtMs: new Date(2026, 2, 8, 2, 5, 0, 0).getTime(),
      },
    ],
    nowMs
  );
  const due = selectDueCycle(state, nowMs);
  assert(due, "rehydrated state should mark overdue heartbeat as due");
  assertEqual(due.cycleId, REFLECTION_CYCLE_IDS.heartbeat, "overdue cycle should be heartbeat");
  assert(state.rehydratedFromLogs, "rehydrate flag should be set");
  assertEqual(state.rehydratedEntryCount, 2, "rehydrated entry count mismatch");
}

function testRetryScheduling() {
  const nowMs = new Date(2026, 2, 8, 1, 5, 0, 0).getTime();
  const state = createInitialReflectionRuntimeState({ nowMs });
  markRunStarted(state, {
    cycleId: REFLECTION_CYCLE_IDS.heartbeat,
    nowMs,
    correlationId: "corr-retry",
    isRetry: false,
  });
  markRunCompleted(state, {
    cycleId: REFLECTION_CYCLE_IDS.heartbeat,
    outcome: REFLECTION_OUTCOMES.failed,
    reason: "bridge_unavailable",
    nowMs,
    startedAtMs: nowMs - 1000,
    retryEligible: true,
    isRetry: false,
  });
  assert(
    state.retryAtMs.heartbeat > nowMs,
    "failed heartbeat should schedule one retry timestamp"
  );
  const retryDue = selectDueCycle(state, state.retryAtMs.heartbeat + 1);
  assert(retryDue, "retry should become due after retryAt");
  assertEqual(retryDue.cycleId, REFLECTION_CYCLE_IDS.heartbeat, "retry due cycle mismatch");
  assert(retryDue.isRetry, "retry due cycle should set isRetry=true");
}

function testOverlapSuppressionPreservesInflight() {
  const nowMs = new Date(2026, 2, 8, 12, 0, 0, 0).getTime();
  const state = createInitialReflectionRuntimeState({ nowMs });
  markRunStarted(state, {
    cycleId: REFLECTION_CYCLE_IDS.digest,
    nowMs,
    correlationId: "corr-inflight",
    isRetry: false,
  });
  markCycleSuppressedInFlight(state, {
    cycleId: REFLECTION_CYCLE_IDS.heartbeat,
    nowMs: nowMs + 1000,
    reason: "suppressed_in_flight",
  });
  assert(
    state.inFlight && state.inFlight.cycleId === REFLECTION_CYCLE_IDS.digest,
    "in-flight digest run should remain active after overlap suppression"
  );
  assert(
    state.lastRuns.heartbeat && state.lastRuns.heartbeat.reason === "suppressed_in_flight",
    "heartbeat overlap suppression should still write last-run metadata"
  );
}

function testRuntimeWiring() {
  const mainSource = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
  assertContains(
    mainSource,
    "submitMemorySyncIntent: async (intent) => submitReflectionMemorySyncIntent(intent)",
    "plugin lane should wire submitMemorySyncIntent handler"
  );
  assertContains(
    mainSource,
    "REFLECTION_MAX_INTENTS_PER_CYCLE",
    "main should enforce reflection max-intent cap"
  );
  assertContains(
    mainSource,
    "REFLECTION_MAX_ACCEPTED_SUMMARY_CHARS",
    "main should enforce reflection summary-char cap"
  );
  assertContains(
    mainSource,
    "reflection_intent_type_mismatch",
    "main should reject reflection intent type mismatch by cycle"
  );
  assertContains(
    mainSource,
    "getExpectedReflectionIntentType",
    "main should map cadence to expected reflection intent type"
  );
  assertContains(mainSource, "runReflectionSchedulerTick", "main should include scheduler tick");
  assertContains(
    mainSource,
    "OBSERVABILITY_DETAIL_ACTION_IDS.runReflectionNow",
    "main should handle runReflectionNow observability action"
  );

  const observabilitySource = fs.readFileSync(
    path.join(__dirname, "..", "shell-observability.js"),
    "utf8"
  );
  assertContains(
    observabilitySource,
    "Run Reflection Now",
    "shell observability should expose run reflection action"
  );
  assertContains(
    observabilitySource,
    "Last Reflection Outcome",
    "memory detail should include last reflection outcome"
  );
  assertContains(
    observabilitySource,
    "Next Reflection Heartbeat At",
    "memory detail should include next heartbeat timestamp"
  );

  const bridgeSource = fs.readFileSync(path.join(__dirname, "..", "openclaw-bridge.js"), "utf8");
  assertContains(
    bridgeSource,
    "memory_reflection_heartbeat",
    "bridge stub should include heartbeat reflection route"
  );
  assertContains(
    bridgeSource,
    "memory_reflection_digest",
    "bridge stub should include digest reflection route"
  );
  assertContains(
    bridgeSource,
    'intentType: "memory_summary_request"',
    "bridge digest stub should emit memory_summary_request"
  );
  assertNotContains(
    bridgeSource,
    "digest-reflection-",
    "bridge digest stub should not emit extra reflection intent payloads"
  );
}

function run() {
  testHeartbeatWallClockCadence();
  testDigestWallClockCadence();
  testHistoryRehydrateAndOverdueCatchup();
  testRetryScheduling();
  testOverlapSuppressionPreservesInflight();
  testRuntimeWiring();
  console.log("[online-reflection-runtime] checks passed");
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
