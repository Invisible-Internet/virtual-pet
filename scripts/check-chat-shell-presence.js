"use strict";

const fs = require("fs");
const path = require("path");
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

function readProjectFile(relativePath) {
  const absolutePath = path.join(__dirname, "..", relativePath);
  return fs.readFileSync(absolutePath, "utf8");
}

function assertContains(text, expected, message) {
  if (!text.includes(expected)) {
    throw new Error(`${message} (missing "${expected}")`);
  }
}

function testTrayAndDialogWiring() {
  const mainSource = readProjectFile("main.js");
  const preloadSource = readProjectFile("preload.js");
  const rendererSource = readProjectFile("renderer.js");

  assertContains(mainSource, 'openChat: "open-chat"', "main shell actions should define open-chat");
  assertContains(mainSource, 'label: "Open Chat..."', "tray menu should include Open Chat label");
  assertContains(
    mainSource,
    'emitToRenderer("pet:dialog-open-request"',
    "main should emit dialog open request to renderer"
  );
  assertContains(
    mainSource,
    'ipcMain.on("pet:setDialogSurfaceOpen"',
    "main should accept dialog surface open updates"
  );
  assertContains(mainSource, "startProactiveConversationController();", "main should start proactive controller");
  assertContains(
    mainSource,
    "conversationHoldActive",
    "main shell snapshot should include conversation hold state"
  );
  assertContains(
    mainSource,
    "proactiveBackoffTier",
    "main shell snapshot should include proactive backoff tier"
  );
  assertContains(
    mainSource,
    "proactiveNextEligibleAtMs",
    "main shell snapshot should include proactive next eligible timestamp"
  );

  assertContains(
    preloadSource,
    "setDialogSurfaceOpen: (open, reason = \"renderer\") =>",
    "preload should expose setDialogSurfaceOpen"
  );
  assertContains(
    preloadSource,
    "onDialogOpenRequest: (callback) =>",
    "preload should expose onDialogOpenRequest"
  );

  assertContains(
    rendererSource,
    "window.petAPI.onDialogOpenRequest",
    "renderer should subscribe to dialog open requests"
  );
  assertContains(
    rendererSource,
    "window.petAPI.setDialogSurfaceOpen",
    "renderer should report dialog surface open state"
  );
  assertContains(
    rendererSource,
    "conversationHoldActive",
    "renderer shell normalization should include hold state"
  );
}

function testProactiveSuppressionContract() {
  let nowMs = 10000;
  const router = createPetContractRouter({
    now: () => nowMs,
  });

  const suppressed = router.processEvent(
    {
      type: "PROACTIVE_CHECK",
      correlationId: "corr-presence-1",
      payload: {
        reason: "proactive_conversation",
        text: "Want to chat?",
      },
      ts: nowMs,
    },
    {
      source: "offline",
      announcementSuppressedReason: "suppressed_dialog_open",
      announcementCooldownSkipReason: "suppressed_cooldown",
      announcementCooldownMsByReason: {
        proactive_conversation: 5000,
      },
    }
  );

  assertEqual(suppressed.suggestions.length, 1, "suppressed proactive check should emit one suggestion");
  assertEqual(
    suppressed.suggestions[0].type,
    "PET_ANNOUNCEMENT_SKIPPED",
    "suppressed proactive check should emit skipped suggestion"
  );
  assertEqual(
    suppressed.suggestions[0].skipReason,
    "suppressed_dialog_open",
    "suppressed proactive skip reason mismatch"
  );

  nowMs += 100;
  const emitted = router.processEvent(
    {
      type: "PROACTIVE_CHECK",
      correlationId: "corr-presence-2",
      payload: {
        reason: "proactive_conversation",
        text: "Want to chat?",
        channel: "dialog",
      },
      ts: nowMs,
    },
    {
      source: "offline",
      announcementCooldownSkipReason: "suppressed_cooldown",
      announcementCooldownMsByReason: {
        proactive_conversation: 5000,
      },
    }
  );
  assertEqual(emitted.suggestions.length, 1, "proactive emit should produce one suggestion");
  assertEqual(emitted.suggestions[0].type, "PET_ANNOUNCEMENT", "proactive emit type mismatch");
  assertEqual(emitted.suggestions[0].channel, "dialog", "proactive emit channel mismatch");

  nowMs += 1000;
  const cooldown = router.processEvent(
    {
      type: "PROACTIVE_CHECK",
      correlationId: "corr-presence-3",
      payload: {
        reason: "proactive_conversation",
        text: "Want to chat?",
      },
      ts: nowMs,
    },
    {
      source: "offline",
      announcementCooldownSkipReason: "suppressed_cooldown",
      announcementCooldownMsByReason: {
        proactive_conversation: 5000,
      },
    }
  );
  assertEqual(cooldown.suggestions.length, 1, "cooldown proactive check should emit one suggestion");
  assertEqual(
    cooldown.suggestions[0].type,
    "PET_ANNOUNCEMENT_SKIPPED",
    "cooldown proactive check should emit skipped suggestion"
  );
  assertEqual(
    cooldown.suggestions[0].skipReason,
    "suppressed_cooldown",
    "cooldown proactive skip reason mismatch"
  );
  assert(
    Number.isFinite(cooldown.suggestions[0].cooldownRemainingMs) &&
      cooldown.suggestions[0].cooldownRemainingMs > 0,
    "cooldown proactive check should expose cooldownRemainingMs"
  );
}

function run() {
  testTrayAndDialogWiring();
  testProactiveSuppressionContract();
  console.log("[chat-shell-presence] checks passed");
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
