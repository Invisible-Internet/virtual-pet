"use strict";

const {
  ROAM_POLICY_DECISION_REASONS,
  applyRoamPacingDecision,
  buildRoamPolicySnapshot,
  createInitialRoamPolicyState,
  planDesktopRoamSampling,
  recordManualDisplayAvoidance,
  resolveRoamPacingDelay,
} = require("../roam-policy");

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

function testPacingDeterminism() {
  const initialMin = resolveRoamPacingDelay({
    phase: "initial",
    randomUnit: 0,
    windows: {
      initial: { minMs: 1200, maxMs: 2400 },
      rest: { minMs: 2200, maxMs: 6200 },
      retry: { minMs: 2200, maxMs: 6200 },
    },
  });
  assertEqual(initialMin.delayMs, 1200, "initial pacing min window mismatch");
  assertEqual(
    initialMin.reason,
    ROAM_POLICY_DECISION_REASONS.pacingInitialWindow,
    "initial pacing reason mismatch"
  );

  const retryMax = resolveRoamPacingDelay({
    phase: "retry",
    randomUnit: 1,
    windows: {
      initial: { minMs: 1200, maxMs: 2400 },
      rest: { minMs: 2200, maxMs: 6200 },
      retry: { minMs: 2200, maxMs: 6200 },
    },
  });
  assertEqual(retryMax.delayMs, 6200, "retry pacing max window mismatch");

  const state = createInitialRoamPolicyState({ nowMs: 1000 });
  applyRoamPacingDecision(state, initialMin, 1000);
  assertEqual(
    state.decisionReason,
    ROAM_POLICY_DECISION_REASONS.pacingInitialWindow,
    "pacing apply should update decision reason"
  );
  assertEqual(state.pacingDelayMs, 1200, "pacing apply should persist delay");
}

function testAvoidancePlanningAndFallback() {
  const state = createInitialRoamPolicyState({
    nowMs: 2000,
    monitorAvoidMs: 30000,
  });
  const displayAreas = [
    {
      displayId: "1001",
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    },
    {
      displayId: "1002",
      bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
    },
  ];

  const firstAvoid = recordManualDisplayAvoidance(state, {
    fromDisplayId: "1001",
    toDisplayId: "1002",
    nowMs: 2100,
    sourceReason: "manual_drag_monitor_correction",
  });
  assert(firstAvoid.recorded, "manual cross-monitor correction should record avoid entry");

  const oneAvoidPlan = planDesktopRoamSampling(state, {
    displayAreas,
    nowMs: 2200,
  });
  assertEqual(
    oneAvoidPlan.decisionReason,
    ROAM_POLICY_DECISION_REASONS.desktopAvoidanceActive,
    "single avoid plan should remain active"
  );
  assertEqual(
    oneAvoidPlan.displayAreas.length,
    1,
    "single avoid plan should sample only one eligible display"
  );
  assertEqual(
    oneAvoidPlan.displayAreas[0].displayId,
    "1002",
    "single avoid plan should avoid pushed-away display"
  );

  recordManualDisplayAvoidance(state, {
    fromDisplayId: "1002",
    toDisplayId: "1001",
    nowMs: 2300,
    sourceReason: "manual_fling_monitor_correction",
  });
  const fallbackPlan = planDesktopRoamSampling(state, {
    displayAreas,
    nowMs: 2400,
  });
  assertEqual(
    fallbackPlan.fallbackReason,
    ROAM_POLICY_DECISION_REASONS.avoidanceExhaustedFallback,
    "all-avoided plan should emit exhausted fallback reason"
  );
  assertEqual(
    fallbackPlan.usedFallback,
    true,
    "all-avoided plan should report fallback path"
  );
  assertEqual(
    fallbackPlan.displayAreas.length,
    2,
    "all-avoided fallback should still keep roaming across available displays"
  );
}

function testExpiryAndReentrySignal() {
  const state = createInitialRoamPolicyState({
    nowMs: 3000,
    monitorAvoidMs: 30000,
  });
  recordManualDisplayAvoidance(state, {
    fromDisplayId: "1001",
    toDisplayId: "1002",
    nowMs: 3000,
    sourceReason: "manual_drag_monitor_correction",
  });

  const postExpiryPlan = planDesktopRoamSampling(state, {
    displayAreas: [
      { displayId: "1001", bounds: { x: 0, y: 0, width: 100, height: 100 } },
      { displayId: "1002", bounds: { x: 100, y: 0, width: 100, height: 100 } },
    ],
    nowMs: 34010,
  });
  assertEqual(postExpiryPlan.avoidCount, 0, "expired avoids should clear from active list");
  assertEqual(
    postExpiryPlan.reentryReason,
    ROAM_POLICY_DECISION_REASONS.avoidanceExpiredReentry,
    "expiry should surface a re-entry reason"
  );

  const desktopSnapshot = buildRoamPolicySnapshot(state, {
    roamMode: "desktop",
    nowMs: 34010,
  });
  assertEqual(desktopSnapshot.state, "healthy", "desktop snapshot should recover after expiry");
  assertEqual(
    desktopSnapshot.reentryReason,
    ROAM_POLICY_DECISION_REASONS.avoidanceExpiredReentry,
    "desktop snapshot should include re-entry reason while fresh"
  );

  const zoneSnapshot = buildRoamPolicySnapshot(state, {
    roamMode: "zone",
    nowMs: 34010,
  });
  assertEqual(zoneSnapshot.state, "disabled", "zone roam should disable monitor-avoidance policy row");
}

function run() {
  testPacingDeterminism();
  testAvoidancePlanningAndFallback();
  testExpiryAndReentrySignal();
  console.log("[roam-policy] checks passed");
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
