"use strict";

const { createPetContractRouter } = require("../pet-contract-router");

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

function assertIncludes(value, expectedPart, message) {
  if (typeof value !== "string" || !value.includes(expectedPart)) {
    throw new Error(`${message} (expected to include "${expectedPart}")`);
  }
}

function createClock(startMs = 1700000000000) {
  let nowMs = startMs;
  return {
    now() {
      return nowMs;
    },
    advance(ms) {
      nowMs += ms;
      return nowMs;
    },
  };
}

function testStatusFlow() {
  const trace = [];
  const clock = createClock(1000);
  const router = createPetContractRouter({
    now: () => clock.now(),
    onTrace: (entry) => trace.push(entry),
  });

  const result = router.processEvent(
    {
      type: "USER_COMMAND",
      correlationId: "corr-status",
      payload: { command: "status" },
      ts: clock.now(),
    },
    {
      source: "offline",
      statusText: "Runtime degraded but stable.",
    }
  );

  assert(result.ok, "status flow should return ok=true");
  assertEqual(result.event.type, "USER_COMMAND", "status event type mismatch");
  assertEqual(result.intents.length, 1, "status flow should emit one intent");
  assertEqual(
    result.intents[0].type,
    "INTENT_INTROSPECTION_STATUS",
    "status intent type mismatch"
  );
  assertEqual(result.suggestions.length, 1, "status flow should emit one suggestion");
  assertEqual(result.suggestions[0].type, "PET_RESPONSE", "status suggestion type mismatch");
  assertEqual(result.suggestions[0].source, "offline", "status suggestion source mismatch");
  assertEqual(
    result.suggestions[0].correlationId,
    "corr-status",
    "status correlationId should be preserved"
  );
  assertIncludes(
    result.suggestions[0].text,
    "Runtime degraded but stable.",
    "status response text mismatch"
  );

  assertEqual(trace.length, 3, "status flow should emit 3 trace entries");
  assertEqual(trace[0].stage, "event", "status trace stage #1 mismatch");
  assertEqual(trace[1].stage, "intent", "status trace stage #2 mismatch");
  assertEqual(trace[2].stage, "suggestion", "status trace stage #3 mismatch");
  for (const entry of trace) {
    assertEqual(
      entry.payload?.correlationId,
      "corr-status",
      "trace correlationId should match status flow correlationId"
    );
  }
}

function testAnnouncementCooldownFlow() {
  const clock = createClock(20000);
  const router = createPetContractRouter({
    now: () => clock.now(),
    announcementCooldownMs: 10000,
  });

  const first = router.processEvent(
    {
      type: "USER_COMMAND",
      correlationId: "corr-ann-1",
      payload: { command: "announce-test" },
      ts: clock.now(),
    },
    {
      source: "offline",
      announcementCooldownMsByReason: {
        manual_test: 5000,
      },
    }
  );
  assertEqual(first.suggestions.length, 1, "announcement first run should emit one suggestion");
  assertEqual(first.suggestions[0].type, "PET_ANNOUNCEMENT", "announcement first run should emit PET_ANNOUNCEMENT");
  assertEqual(first.suggestions[0].reason, "manual_test", "announcement reason mismatch");

  clock.advance(1000);
  const second = router.processEvent(
    {
      type: "USER_COMMAND",
      correlationId: "corr-ann-2",
      payload: { command: "announce-test" },
      ts: clock.now(),
    },
    {
      source: "offline",
      announcementCooldownMsByReason: {
        manual_test: 5000,
      },
    }
  );
  assertEqual(second.suggestions.length, 1, "announcement second run should emit one suggestion");
  assertEqual(
    second.suggestions[0].type,
    "PET_ANNOUNCEMENT_SKIPPED",
    "announcement second run should be cooldown-skipped"
  );
  assertEqual(
    second.suggestions[0].skipReason,
    "cooldown_active",
    "announcement skip reason mismatch"
  );
  assertEqual(second.suggestions[0].cooldownMs, 5000, "announcement cooldown should use reason override");

  clock.advance(5001);
  const third = router.processEvent(
    {
      type: "USER_COMMAND",
      correlationId: "corr-ann-3",
      payload: { command: "announce-test" },
      ts: clock.now(),
    },
    {
      source: "offline",
      announcementCooldownMsByReason: {
        manual_test: 5000,
      },
    }
  );
  assertEqual(third.suggestions.length, 1, "announcement third run should emit one suggestion");
  assertEqual(third.suggestions[0].type, "PET_ANNOUNCEMENT", "announcement third run should emit PET_ANNOUNCEMENT");
}

function testExtensionInteractionFlow() {
  const clock = createClock(3000);
  const trace = [];
  const router = createPetContractRouter({
    now: () => clock.now(),
    onTrace: (entry) => trace.push(entry),
  });

  const result = router.processEvent(
    {
      type: "EXT_PROP_INTERACTED",
      correlationId: "corr-ext",
      payload: {
        extensionId: "sample-foodchase",
        propId: "candy",
        interactionType: "hotkey",
      },
      ts: clock.now(),
    },
    {
      source: "online",
    }
  );

  assert(result.ok, "extension interaction should return ok=true");
  assertEqual(result.intents.length, 1, "extension interaction should emit one intent");
  assertEqual(
    result.intents[0].type,
    "INTENT_PROP_INTERACTION",
    "extension interaction intent type mismatch"
  );
  assertEqual(result.suggestions.length, 1, "extension interaction should emit one suggestion");
  assertEqual(result.suggestions[0].type, "PET_RESPONSE", "extension interaction suggestion type mismatch");
  assertEqual(result.suggestions[0].source, "online", "extension interaction source mismatch");
  assertIncludes(
    result.suggestions[0].text,
    "sample-foodchase",
    "extension interaction response should include extensionId"
  );
  assertIncludes(
    result.suggestions[0].text,
    "candy",
    "extension interaction response should include propId"
  );

  assertEqual(trace.length, 3, "extension flow should emit 3 trace entries");
  for (const entry of trace) {
    assertEqual(
      entry.payload?.correlationId,
      "corr-ext",
      "trace correlationId should match extension flow correlationId"
    );
  }
}

function run() {
  testStatusFlow();
  testAnnouncementCooldownFlow();
  testExtensionInteractionFlow();
  console.log("[contracts] router checks passed");
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
