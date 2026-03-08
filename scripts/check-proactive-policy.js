"use strict";

const {
  PROACTIVE_RECENT_USER_INPUT_WINDOW_MS,
  applyIgnoredBackoffIfNeeded,
  buildProactivePolicySnapshot,
  createInitialProactivePolicyState,
  evaluateProactiveSuppression,
  getProactiveCooldownMsForTier,
  recordProactiveAnnouncement,
  recordProactiveSuppression,
  recordProactiveUserEngagement,
} = require("../proactive-policy");

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

function testSuppressionOrder() {
  const state = createInitialProactivePolicyState(1000);
  const dialogFirst = evaluateProactiveSuppression({
    state,
    nowMs: 1000,
    dialogOpen: true,
    inputActive: true,
    stateEligible: false,
    quietHoursActive: true,
    candidateOpenerHash: "abc",
  });
  assertEqual(dialogFirst.reason, "suppressed_dialog_open", "dialog-open should be highest suppression");

  const inputSecond = evaluateProactiveSuppression({
    state,
    nowMs: 1000,
    dialogOpen: false,
    inputActive: true,
    stateEligible: false,
    quietHoursActive: true,
    candidateOpenerHash: "abc",
  });
  assertEqual(inputSecond.reason, "suppressed_input_active", "input-active suppression mismatch");

  const stateThird = evaluateProactiveSuppression({
    state,
    nowMs: 1000 + PROACTIVE_RECENT_USER_INPUT_WINDOW_MS + 1,
    dialogOpen: false,
    inputActive: false,
    stateEligible: false,
    quietHoursActive: true,
    candidateOpenerHash: "abc",
  });
  assertEqual(stateThird.reason, "suppressed_state_ineligible", "state-ineligible suppression mismatch");
}

function testCooldownAndRepeatGuard() {
  const startMs = 2000;
  const state = createInitialProactivePolicyState(startMs);
  recordProactiveAnnouncement(state, {
    nowMs: startMs,
    openerHash: "hash-1",
  });

  const cooldown = evaluateProactiveSuppression({
    state,
    nowMs: startMs + 1000,
    candidateOpenerHash: "hash-2",
  });
  assertEqual(cooldown.reason, "suppressed_cooldown", "cooldown suppression mismatch");
  assert(cooldown.cooldownRemainingMs > 0, "cooldown suppression should include remaining ms");

  const afterCooldown = startMs + getProactiveCooldownMsForTier(0) + 5;
  const repeat = evaluateProactiveSuppression({
    state,
    nowMs: afterCooldown,
    candidateOpenerHash: "hash-1",
  });
  assertEqual(repeat.reason, "suppressed_repeat_guard", "repeat guard suppression mismatch");
}

function testBackoffGrowthAndReset() {
  const startMs = 3000;
  const state = createInitialProactivePolicyState(startMs);
  recordProactiveAnnouncement(state, {
    nowMs: startMs,
    openerHash: "hash-2",
  });
  assertEqual(state.backoffTier, 0, "backoff tier should start at 0");

  const afterCooldown = startMs + getProactiveCooldownMsForTier(0) + 1;
  applyIgnoredBackoffIfNeeded(state, afterCooldown);
  assertEqual(state.backoffTier, 1, "ignored proactive should increase backoff tier");

  recordProactiveUserEngagement(state, afterCooldown + 1000);
  assertEqual(state.backoffTier, 0, "user engagement should reset backoff tier");
}

function testSnapshotShape() {
  const state = createInitialProactivePolicyState(4000);
  recordProactiveSuppression(state, {
    reason: "suppressed_dialog_open",
    nowMs: 5000,
  });
  const snapshot = buildProactivePolicySnapshot(state, 5000);
  assertEqual(snapshot.proactiveState, "suppressed", "snapshot proactive state mismatch");
  assertEqual(snapshot.lastAttemptReason, "suppressed_dialog_open", "snapshot reason mismatch");
  assert(Number.isFinite(snapshot.nextEligibleAt), "snapshot next eligible must be numeric");
}

function run() {
  testSuppressionOrder();
  testCooldownAndRepeatGuard();
  testBackoffGrowthAndReset();
  testSnapshotShape();
  console.log("[proactive-policy] checks passed");
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
