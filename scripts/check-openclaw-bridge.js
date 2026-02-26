"use strict";

const {
  BRIDGE_MODES,
  createOpenClawBridge,
  requestWithTimeout,
} = require("../openclaw-bridge");

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

async function testOnlineResponse() {
  const bridge = createOpenClawBridge({
    mode: BRIDGE_MODES.online,
  });
  const outcome = await requestWithTimeout(
    bridge.sendDialog({
      route: "introspection_status",
      correlationId: "corr-online",
      promptText: "status",
      context: {
        currentState: "Idle",
        source: "online",
      },
    }),
    1200
  );
  assertEqual(outcome.response.source, "online", "online response source mismatch");
  assert(
    typeof outcome.response.text === "string" && outcome.response.text.length > 0,
    "online response should include text"
  );
}

async function testTimeoutFallback() {
  const bridge = createOpenClawBridge({
    mode: BRIDGE_MODES.timeout,
    simulatedTimeoutLatencyMs: 2000,
  });

  let timedOut = false;
  try {
    await requestWithTimeout(
      bridge.sendDialog({
        route: "dialog_user_command",
        correlationId: "corr-timeout",
        promptText: "bridge-test",
        context: {
          currentState: "Idle",
          source: "online",
        },
      }),
      300
    );
  } catch (error) {
    timedOut = error?.code === "bridge_timeout";
  }
  assert(timedOut, "timeout mode should raise bridge_timeout");
}

async function testOfflineFailure() {
  const bridge = createOpenClawBridge({
    mode: BRIDGE_MODES.offline,
  });

  let unavailable = false;
  try {
    await requestWithTimeout(
      bridge.sendDialog({
        route: "dialog_user_command",
        correlationId: "corr-offline",
        promptText: "bridge-test",
        context: {
          currentState: "Idle",
          source: "offline",
        },
      }),
      600
    );
  } catch (error) {
    unavailable = error?.code === "bridge_unavailable";
  }
  assert(unavailable, "offline mode should raise bridge_unavailable");
}

async function testGuardrailProposalPayload() {
  const bridge = createOpenClawBridge({
    mode: BRIDGE_MODES.online,
  });

  const outcome = await requestWithTimeout(
    bridge.sendDialog({
      route: "dialog_user_command",
      correlationId: "corr-guardrail",
      promptText: "guardrail-test",
      context: {
        currentState: "Idle",
        source: "online",
      },
    }),
    1200
  );
  const actionTypes = (outcome.response.proposedActions || []).map((action) => action.type);
  assert(actionTypes.includes("set_state"), "guardrail payload should include set_state");
  assert(actionTypes.includes("render_control"), "guardrail payload should include render_control");
  assert(actionTypes.includes("identity_mutation"), "guardrail payload should include identity_mutation");
}

async function run() {
  await testOnlineResponse();
  await testTimeoutFallback();
  await testOfflineFailure();
  await testGuardrailProposalPayload();
  console.log("[openclaw-bridge] checks passed");
}

run().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
