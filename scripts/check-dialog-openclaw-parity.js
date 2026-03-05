"use strict";

const {
  BRIDGE_MODES,
  BRIDGE_TRANSPORTS,
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

async function testRecentDialogContextBoundaries() {
  const bridge = createOpenClawBridge({
    mode: BRIDGE_MODES.online,
    transport: BRIDGE_TRANSPORTS.stub,
  });

  const longTurns = [];
  for (let index = 0; index < 10; index += 1) {
    longTurns.push({
      role: index % 2 === 0 ? "user" : "pet",
      text: `turn-${index} ${"x".repeat(220)}`,
      source: `source-${index}-${"y".repeat(40)}`,
    });
  }

  const outcome = await requestWithTimeout(
    bridge.sendDialog({
      route: "dialog_user_message",
      correlationId: "corr-dialog-parity-bounds",
      promptText: "Can you continue that?",
      context: {
        currentState: "Idle",
        source: "online",
        recentDialogSummary: "z".repeat(1200),
        recentDialogTurns: longTurns,
      },
    }),
    1200
  );

  const turns = outcome.request.context.recentDialogTurns;
  assert(Array.isArray(turns), "recentDialogTurns should normalize to an array");
  assertEqual(turns.length, 6, "recentDialogTurns should be bounded to six entries");
  for (const turn of turns) {
    assert(turn.role === "user" || turn.role === "pet", "turn role should be normalized to user/pet");
    assert(turn.text.length <= 140, "turn text should be bounded");
    assert(turn.source.length <= 24, "turn source should be bounded");
  }
  assert(
    outcome.request.context.recentDialogSummary.length <= 180,
    "recentDialogSummary should be bounded"
  );
}

async function testFollowupUsesRecentContext() {
  const bridge = createOpenClawBridge({
    mode: BRIDGE_MODES.online,
    transport: BRIDGE_TRANSPORTS.stub,
  });

  const recentDialogSummary = "user: We should plan chores | pet: Start with laundry and dishes";
  const outcome = await requestWithTimeout(
    bridge.sendDialog({
      route: "dialog_user_message",
      correlationId: "corr-dialog-parity-followup",
      promptText: "Can you expand on that next step?",
      context: {
        currentState: "Idle",
        source: "online",
        recentDialogSummary,
        recentDialogTurns: [
          {
            role: "user",
            text: "We should plan chores",
            source: "local_ui",
          },
          {
            role: "pet",
            text: "Start with laundry and dishes",
            source: "online",
          },
        ],
      },
    }),
    1200
  );

  assertEqual(outcome.response.source, "online", "follow-up response should stay online");
  assert(
    typeof outcome.response.text === "string" &&
      outcome.response.text.includes("Following up from context:"),
    "follow-up response should reference context summary"
  );
}

async function run() {
  await testRecentDialogContextBoundaries();
  await testFollowupUsesRecentContext();
  console.log("[dialog-openclaw-parity] checks passed");
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
