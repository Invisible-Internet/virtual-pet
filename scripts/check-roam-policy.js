"use strict";

const {
  ROAM_POLICY_DECISION_REASONS,
  applyRoamPacingDecision,
  buildRoamPolicySnapshot,
  createInitialRoamPolicyState,
  isWindowAvoidActive,
  planActiveWindowAvoidanceSampling,
  planDesktopRoamSampling,
  recordManualDisplayAvoidance,
  recordManualWindowAvoidance,
  resolveBottomEdgeInspectAnchor,
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

function testWindowAvoidanceMemoryAndClipping() {
  const state = createInitialRoamPolicyState({
    nowMs: 1000,
    monitorAvoidMs: 30000,
    windowAvoidMs: 2000,
  });

  const record = recordManualWindowAvoidance(state, {
    windowId: "window-main",
    nowMs: 1100,
    sourceReason: "manual_drag_window_correction",
  });
  assert(record.recorded, "manual drag-off correction should record window avoid entry");
  assertEqual(
    record.reason,
    ROAM_POLICY_DECISION_REASONS.manualWindowAvoidRecorded,
    "window avoid entry should use manual_window_avoid_recorded reason"
  );
  assert(
    isWindowAvoidActive(state, "window-main", 1200),
    "window avoid entry should stay active during cooldown"
  );

  const hardFallbackPlan = planActiveWindowAvoidanceSampling({
    samplingAreas: [{ x: 0, y: 0, width: 1000, height: 800 }],
    activeWindowBounds: { x: 100, y: 100, width: 800, height: 600 },
    avoidMarginPx: 24,
    petBounds: { x: 50, y: 50, width: 220, height: 220 },
    strictAvoidActive: true,
  });
  assertEqual(
    hardFallbackPlan.fallbackReason,
    ROAM_POLICY_DECISION_REASONS.foregroundWindowNoFreeAreaFallback,
    "strict avoid should report no-free-area fallback when no clipped area can fit pet bounds"
  );
  assertEqual(
    hardFallbackPlan.usedFallback,
    true,
    "strict avoid no-free-area plan should report fallback usage"
  );

  const clippedPlan = planActiveWindowAvoidanceSampling({
    samplingAreas: [{ x: 0, y: 0, width: 1920, height: 1080 }],
    activeWindowBounds: { x: 640, y: 340, width: 640, height: 360 },
    avoidMarginPx: 24,
    petBounds: { x: 50, y: 50, width: 220, height: 220 },
    strictAvoidActive: true,
  });
  assertEqual(clippedPlan.usedFallback, false, "strict avoid should use clipped candidates when available");
  assert(
    Array.isArray(clippedPlan.samplingAreas) && clippedPlan.samplingAreas.length > 0,
    "strict avoid clipped plan should keep at least one sampling candidate"
  );

  const snapshotAfterExpiry = buildRoamPolicySnapshot(state, {
    roamMode: "desktop",
    nowMs: 4000,
  });
  assert(
    !isWindowAvoidActive(state, "window-main", 4000),
    "window avoid entry should expire after cooldown window"
  );
  assertEqual(
    snapshotAfterExpiry.windowReentryReason,
    ROAM_POLICY_DECISION_REASONS.windowAvoidExpiredReentry,
    "window avoid expiry should emit re-entry reason while fresh"
  );
}

function testBottomEdgeInspectAnchorSelection() {
  const anchorResult = resolveBottomEdgeInspectAnchor({
    windowBounds: { x: 500, y: 200, width: 600, height: 400 },
    samplingAreas: [{ x: 0, y: 0, width: 1920, height: 1080 }],
    petBounds: { x: 50, y: 50, width: 220, height: 220 },
    bottomBandPx: 64,
    bottomInsetPx: 12,
    bottomGracePx: 220,
    currentPetPoint: { x: 940, y: 760 },
    randomUnit: 0.2,
  });
  assert(anchorResult.anchor, "bottom-edge inspect anchor should resolve when space is available");
  assertEqual(anchorResult.anchor.lane, "bottom_edge", "inspect anchor lane should be bottom_edge");
  assertEqual(
    anchorResult.anchor.key,
    "bottom_right_quarter",
    "closer-biased anchor selection should prefer nearest bottom-edge candidate"
  );

  const fullscreenAnchorResult = resolveBottomEdgeInspectAnchor({
    windowBounds: { x: 0, y: 0, width: 1920, height: 1080 },
    samplingAreas: [{ x: 0, y: 0, width: 1920, height: 1080 }],
    petBounds: { x: 50, y: 50, width: 220, height: 220 },
    bottomBandPx: 64,
    bottomInsetPx: 12,
    bottomGracePx: 220,
    currentPetPoint: { x: 300, y: 800 },
    randomUnit: 0.2,
  });
  assert(
    fullscreenAnchorResult.anchor,
    "fullscreen windows should still resolve a valid bottom-edge inspect anchor"
  );

  const unavailableResult = resolveBottomEdgeInspectAnchor({
    windowBounds: { x: 500, y: 200, width: 600, height: 400 },
    samplingAreas: [{ x: 0, y: 0, width: 200, height: 200 }],
    petBounds: { x: 50, y: 50, width: 220, height: 220 },
    bottomBandPx: 64,
    bottomInsetPx: 12,
  });
  assertEqual(
    unavailableResult.reason,
    ROAM_POLICY_DECISION_REASONS.foregroundWindowInspectAnchorUnavailable,
    "anchor resolver should emit explicit unavailable reason when no bottom-edge anchor fits"
  );

  const mixedSelectionKeys = [0.1, 0.4, 0.9].map((randomUnit) => {
    const mixedAnchor = resolveBottomEdgeInspectAnchor({
      windowBounds: { x: 500, y: 200, width: 600, height: 400 },
      samplingAreas: [{ x: 0, y: 0, width: 1920, height: 1080 }],
      petBounds: { x: 50, y: 50, width: 220, height: 220 },
      bottomBandPx: 64,
      bottomInsetPx: 12,
      bottomGracePx: 220,
      currentPetPoint: { x: 800, y: 760 },
      randomUnit,
    });
    return mixedAnchor.anchor?.key || "none";
  });
  assert(
    mixedSelectionKeys.includes("bottom_center") &&
      mixedSelectionKeys.includes("bottom_right_quarter") &&
      mixedSelectionKeys.includes("bottom_left_quarter"),
    "bottom-edge selection should mix center/right/left anchors across bounded random choices"
  );

  const cornerPreferredSelectionKeys = [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95].map((randomUnit) => {
    const cornerPreferredAnchor = resolveBottomEdgeInspectAnchor({
      windowBounds: { x: 500, y: 200, width: 600, height: 400 },
      samplingAreas: [{ x: 0, y: 0, width: 1920, height: 1080 }],
      petBounds: { x: 50, y: 50, width: 220, height: 220 },
      bottomBandPx: 64,
      bottomInsetPx: 12,
      bottomGracePx: 220,
      currentPetPoint: { x: 800, y: 760 },
      randomUnit,
      preferenceProfile: "corner_preferred_media_watch",
    });
    return cornerPreferredAnchor.anchor?.key || "none";
  });
  assert(
    cornerPreferredSelectionKeys.filter((key) => key === "bottom_center").length <= 1,
    "corner-preferred media-watch profile should strongly reduce center anchor picks"
  );
  assert(
    cornerPreferredSelectionKeys.includes("bottom_right_quarter") &&
      cornerPreferredSelectionKeys.includes("bottom_left_quarter"),
    "corner-preferred media-watch profile should still mix left/right corner anchors"
  );
}

function run() {
  testPacingDeterminism();
  testAvoidancePlanningAndFallback();
  testExpiryAndReentrySignal();
  testWindowAvoidanceMemoryAndClipping();
  testBottomEdgeInspectAnchorSelection();
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
