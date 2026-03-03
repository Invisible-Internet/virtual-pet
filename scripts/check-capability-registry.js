"use strict";

const { CAPABILITY_STATES, createCapabilityRegistry } = require("../capability-registry");

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

async function run() {
  const transitions = [];
  const registry = createCapabilityRegistry({
    onTransition(entry) {
      transitions.push(entry);
    },
  });

  registry.register({
    capabilityId: "renderer",
    required: true,
    telemetryTags: ["ui"],
    start: async () => ({
      state: CAPABILITY_STATES.healthy,
      reason: "didFinishLoad",
      details: { windowId: 1 },
    }),
  });
  registry.register({
    capabilityId: "sensors",
    required: false,
    telemetryTags: ["media"],
    start: async () => ({
      state: CAPABILITY_STATES.degraded,
      reason: "probePending",
      details: { backend: "powershell" },
    }),
  });
  registry.register({
    capabilityId: "openclawBridge",
    required: false,
    telemetryTags: ["bridge"],
    start: async () => {
      throw new Error("bridge socket unreachable");
    },
  });

  const snapshot = await registry.startAll();
  assertEqual(snapshot.runtimeState, CAPABILITY_STATES.failed, "registry runtime state mismatch");
  assertEqual(snapshot.summary.healthyCount, 1, "healthy capability count mismatch");
  assertEqual(snapshot.summary.degradedCount, 1, "degraded capability count mismatch");
  assertEqual(snapshot.summary.failedCount, 1, "failed capability count mismatch");

  const rendererState = registry.getCapabilityState("renderer");
  assertEqual(rendererState.state, CAPABILITY_STATES.healthy, "renderer state mismatch");
  assertEqual(rendererState.reason, "didFinishLoad", "renderer reason mismatch");

  const sensorsState = registry.getCapabilityState("sensors");
  assertEqual(sensorsState.state, CAPABILITY_STATES.degraded, "sensors state mismatch");
  assertEqual(sensorsState.reason, "probePending", "sensors reason mismatch");

  const bridgeState = registry.getCapabilityState("openclawBridge");
  assertEqual(bridgeState.state, CAPABILITY_STATES.failed, "bridge state mismatch");
  assertEqual(bridgeState.reason, "startupError", "bridge failure reason mismatch");
  assert(
    typeof bridgeState.details.message === "string" &&
      bridgeState.details.message.includes("bridge socket unreachable"),
    "bridge failure message mismatch"
  );

  await registry.stopAll();
  const stoppedSnapshot = registry.getSnapshot();
  assertEqual(stoppedSnapshot.summary.stoppedCount, 3, "all capabilities should stop cleanly");

  const transitionKinds = transitions.map((entry) => entry.next.state);
  assert(
    transitionKinds.includes(CAPABILITY_STATES.starting) &&
      transitionKinds.includes(CAPABILITY_STATES.degraded) &&
      transitionKinds.includes(CAPABILITY_STATES.failed) &&
      transitionKinds.includes(CAPABILITY_STATES.stopped),
    "transition log should include start, degraded, failed, and stopped states"
  );

  console.log("[capability-registry] checks passed");
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error.message || String(error));
    process.exit(1);
  });
}

module.exports = {
  run,
};
