"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  OFFLINE_RECALL_TYPES,
  buildOfflineRecallResult,
  detectOfflineRecallIntent,
} = require("../offline-recall");
const { MANAGED_BLOCK_END, MANAGED_BLOCK_START } = require("../setup-bootstrap");

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
    throw new Error(`${message} (expected "${expectedPart}" in "${value}")`);
  }
}

function writeCanonicalIdentityWorkspace(rootDir) {
  fs.mkdirSync(rootDir, { recursive: true });
  fs.writeFileSync(
    path.join(rootDir, "IDENTITY.md"),
    [
      "# IDENTITY",
      "",
      MANAGED_BLOCK_START,
      "- Name: Nova",
      "- Nicknames: Novie, Nova Bean",
      "- Creature: cat",
      "",
      "## Known Facts",
      "- Birthday: 2024-05-01",
      MANAGED_BLOCK_END,
      "",
    ].join("\n"),
    "utf8"
  );
  fs.writeFileSync(
    path.join(rootDir, "MEMORY.md"),
    [
      "# MEMORY",
      "",
      MANAGED_BLOCK_START,
      "## Durable Facts",
      "- My name is `Nova`.",
      "- My birthday is `2024-05-01`.",
      MANAGED_BLOCK_END,
      "",
    ].join("\n"),
    "utf8"
  );
}

function testIntentDetection() {
  assertEqual(
    detectOfflineRecallIntent("What is your name?"),
    OFFLINE_RECALL_TYPES.identityName,
    "name intent detection mismatch"
  );
  assertEqual(
    detectOfflineRecallIntent("Do you have a nickname?"),
    OFFLINE_RECALL_TYPES.identityNickname,
    "nickname intent detection mismatch"
  );
  assertEqual(
    detectOfflineRecallIntent("When is your birthday?"),
    OFFLINE_RECALL_TYPES.identityBirthday,
    "birthday intent detection mismatch"
  );
  assertEqual(
    detectOfflineRecallIntent("What happened recently between us?"),
    OFFLINE_RECALL_TYPES.recentHighlights,
    "recent intent detection mismatch"
  );
}

function testIdentityRecallFromCanonicalFiles(tempRoot) {
  const workspaceRoot = path.join(tempRoot, "identity-workspace");
  writeCanonicalIdentityWorkspace(workspaceRoot);

  const nameRecall = buildOfflineRecallResult({
    promptText: "What is your name?",
    workspaceRoot,
    memoryAvailable: true,
    ts: 1700000000000,
  });
  assert(nameRecall, "name recall should return result");
  assertEqual(nameRecall.recallType, OFFLINE_RECALL_TYPES.identityName, "name recall type mismatch");
  assertEqual(nameRecall.degradedReason, "none", "name recall should not degrade");
  assertIncludes(nameRecall.text, "Nova", "name recall should include canonical name");
  assert(
    Array.isArray(nameRecall.evidenceTags) && nameRecall.evidenceTags.includes("identity.name"),
    "name recall should include identity evidence tag"
  );

  const birthdayRecall = buildOfflineRecallResult({
    promptText: "When is your birthday?",
    workspaceRoot,
    memoryAvailable: true,
    ts: 1700000000001,
  });
  assert(birthdayRecall, "birthday recall should return result");
  assertEqual(
    birthdayRecall.recallType,
    OFFLINE_RECALL_TYPES.identityBirthday,
    "birthday recall type mismatch"
  );
  assertEqual(birthdayRecall.degradedReason, "none", "birthday recall should not degrade");
  assertIncludes(
    birthdayRecall.text,
    "2024-05-01",
    "birthday recall should include canonical birthday"
  );

  const nicknameRecall = buildOfflineRecallResult({
    promptText: "Do you have a nickname?",
    workspaceRoot,
    memoryAvailable: true,
    ts: 1700000000006,
  });
  assert(nicknameRecall, "nickname recall should return result");
  assertEqual(
    nicknameRecall.recallType,
    OFFLINE_RECALL_TYPES.identityNickname,
    "nickname recall type mismatch"
  );
  assertEqual(nicknameRecall.degradedReason, "none", "nickname recall should not degrade");
  assertIncludes(nicknameRecall.text, "Novie", "nickname recall should include canonical nickname");
  assert(
    Array.isArray(nicknameRecall.evidenceTags) &&
      nicknameRecall.evidenceTags.includes("identity.nickname"),
    "nickname recall should include nickname evidence tag"
  );
}

function testRecentRecallFromRuntimeObservations() {
  const runtimeObservations = [
    {
      observationId: "obs-1",
      ts: "2026-03-06T10:00:00.000Z",
      tsMs: Date.parse("2026-03-06T10:00:00.000Z"),
      observationType: "question_response",
      source: "contract_user_message",
      evidenceTag: "what-is-your-name",
      payload: {
        text: "what is your name",
        responseText: "My name is Nova.",
      },
    },
    {
      observationId: "obs-2",
      ts: "2026-03-06T10:01:00.000Z",
      tsMs: Date.parse("2026-03-06T10:01:00.000Z"),
      observationType: "spotify_playback",
      source: "spotify_playback",
      evidenceTag: "spotify:night-drive",
      payload: {
        title: "Night Drive",
        artist: "Primea FM",
      },
    },
    {
      observationId: "obs-3",
      ts: "2026-03-06T10:02:00.000Z",
      tsMs: Date.parse("2026-03-06T10:02:00.000Z"),
      observationType: "track_rating",
      source: "manual_track_rating",
      evidenceTag: "night-drive",
      payload: {
        trackTitle: "Night Drive",
        rating: 8,
      },
    },
    {
      observationId: "obs-4",
      ts: "2026-03-06T10:03:00.000Z",
      tsMs: Date.parse("2026-03-06T10:03:00.000Z"),
      observationType: "question_response",
      source: "contract_user_message",
      evidenceTag: "what-is-your-name",
      payload: {
        text: "what is your name",
        responseText: "My name is Nova.",
      },
    },
  ];

  const recentRecall = buildOfflineRecallResult({
    promptText: "What happened recently between us?",
    runtimeObservations,
    memoryAvailable: true,
    ts: 1700000000002,
  });
  assert(recentRecall, "recent recall should return result");
  assertEqual(
    recentRecall.recallType,
    OFFLINE_RECALL_TYPES.recentHighlights,
    "recent recall type mismatch"
  );
  assertEqual(recentRecall.degradedReason, "none", "recent recall should not degrade");
  assert(
    Array.isArray(recentRecall.highlights) && recentRecall.highlights.length === 3,
    "recent recall should cap to 3 highlights"
  );
  assert(
    Array.isArray(recentRecall.evidenceTags) && recentRecall.evidenceTags.length === 3,
    "recent recall evidence tags should be deduped and bounded"
  );
  assertIncludes(recentRecall.text, "Recent highlights", "recent recall text should include header");
}

function testRecentRecallMarkdownFallback(tempRoot) {
  const workspaceRoot = path.join(tempRoot, "markdown-fallback");
  const memoryDir = path.join(workspaceRoot, "memory");
  fs.mkdirSync(memoryDir, { recursive: true });
  fs.writeFileSync(
    path.join(memoryDir, "2026-03-06.md"),
    [
      "# Memory Log 2026-03-06",
      "",
      '- 2026-03-06T10:05:00.000Z | type=media_playback | source=media | evidence=media:synthwave | correlationId=corr-1 | payload={"title":"Sunset Loop","artist":"Arcade Child"}',
      '- 2026-03-06T10:06:00.000Z | type=hobby_summary | source=extension | evidence=toy:ball | correlationId=corr-2 | payload={"extensionId":"playpack","propId":"ball"}',
      "",
    ].join("\n"),
    "utf8"
  );
  const recentRecall = buildOfflineRecallResult({
    promptText: "What happened recently between us?",
    workspaceRoot,
    memoryDir,
    runtimeObservations: [],
    memoryAvailable: true,
    ts: 1700000000003,
  });
  assert(recentRecall, "markdown fallback recall should return result");
  assertEqual(
    recentRecall.degradedReason,
    "none",
    "markdown fallback should produce non-degraded highlights"
  );
  assert(
    Array.isArray(recentRecall.highlights) && recentRecall.highlights.length >= 1,
    "markdown fallback should extract at least one highlight"
  );
}

function testDegradedRecallReasons(tempRoot) {
  const missingIdentity = buildOfflineRecallResult({
    promptText: "What is your name?",
    workspaceRoot: path.join(tempRoot, "missing-workspace"),
    memoryAvailable: true,
    ts: 1700000000004,
  });
  assert(missingIdentity, "missing identity recall should still return result");
  assertEqual(
    missingIdentity.degradedReason,
    "identity_unavailable",
    "missing identity should degrade deterministically"
  );

  const memoryUnavailable = buildOfflineRecallResult({
    promptText: "What happened recently between us?",
    runtimeObservations: [],
    memoryAvailable: false,
    ts: 1700000000005,
  });
  assert(memoryUnavailable, "memory unavailable recall should return result");
  assertEqual(
    memoryUnavailable.degradedReason,
    "memory_unavailable",
    "memory unavailable should degrade deterministically"
  );
}

function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "virtual-pet-offline-recall-"));
  testIntentDetection();
  testIdentityRecallFromCanonicalFiles(tempRoot);
  testRecentRecallFromRuntimeObservations();
  testRecentRecallMarkdownFallback(tempRoot);
  testDegradedRecallReasons(tempRoot);
  fs.rmSync(tempRoot, { recursive: true, force: true });
  console.log("[offline-recall] checks passed");
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
