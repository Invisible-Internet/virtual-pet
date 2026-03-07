"use strict";

const { evaluateOpenClawDialogGate, isOpenClawEnabled } = require("../openclaw-runtime-gate");

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

function testOpenClawEnabledDetection() {
  assertEqual(isOpenClawEnabled(null), false, "null settings should be treated as disabled");
  assertEqual(isOpenClawEnabled({}), false, "missing openclaw settings should be treated as disabled");
  assertEqual(
    isOpenClawEnabled({ openclaw: { enabled: false } }),
    false,
    "explicit false should be disabled"
  );
  assertEqual(
    isOpenClawEnabled({ openclaw: { enabled: true } }),
    true,
    "explicit true should be enabled"
  );
}

function testGateForDisabledOpenClaw() {
  const gate = evaluateOpenClawDialogGate({
    settings: {
      openclaw: {
        enabled: false,
      },
    },
    bridge: {},
  });
  assertEqual(gate.allowed, false, "disabled OpenClaw should block bridge dialog");
  assertEqual(gate.fallbackMode, "bridge_disabled", "disabled OpenClaw fallback mismatch");
}

function testGateForMissingBridgeRuntime() {
  const gate = evaluateOpenClawDialogGate({
    settings: {
      openclaw: {
        enabled: true,
      },
    },
    bridge: null,
  });
  assertEqual(gate.allowed, false, "missing bridge should block bridge dialog");
  assertEqual(gate.fallbackMode, "bridge_unavailable", "missing bridge fallback mismatch");
}

function testGateAllowsWhenReady() {
  const gate = evaluateOpenClawDialogGate({
    settings: {
      openclaw: {
        enabled: true,
      },
    },
    bridge: {
      sendDialog() {
        return null;
      },
    },
  });
  assert(gate.allowed, "ready bridge should pass gate");
  assertEqual(gate.fallbackMode, "none", "ready bridge fallback should be none");
}

function run() {
  testOpenClawEnabledDetection();
  testGateForDisabledOpenClaw();
  testGateForMissingBridgeRuntime();
  testGateAllowsWhenReady();
  console.log("[openclaw-runtime-gate] checks passed");
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
