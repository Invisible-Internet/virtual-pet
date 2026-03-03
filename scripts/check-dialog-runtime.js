"use strict";

const {
  buildOfflineDialogResponse,
  classifyOfflineDialogTrigger,
  createDefaultDialogTemplateCatalog,
} = require("../dialog-runtime");

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

function run() {
  const templates = createDefaultDialogTemplateCatalog();

  assertEqual(
    classifyOfflineDialogTrigger("hello there"),
    "greeting",
    "greeting trigger classification mismatch"
  );
  assertEqual(
    classifyOfflineDialogTrigger("what music are you listening to?"),
    "music",
    "music trigger classification mismatch"
  );
  assertEqual(
    classifyOfflineDialogTrigger("what are you reading right now?"),
    "reading",
    "reading trigger classification mismatch"
  );

  const genericA = buildOfflineDialogResponse({
    templates,
    text: "hello there",
    currentState: "Idle",
    source: "offline",
    stateDescription: "I am keeping watch in local mode.",
    stateContextSummary: "mood=steady",
  });
  const genericB = buildOfflineDialogResponse({
    templates,
    text: "hello there",
    currentState: "Idle",
    source: "offline",
    stateDescription: "I am keeping watch in local mode.",
    stateContextSummary: "mood=steady",
  });
  assertEqual(genericA.text, genericB.text, "offline greeting should be deterministic");
  assertEqual(genericA.templateKey, "greeting", "offline greeting template key mismatch");
  assertIncludes(genericA.text, "Idle", "offline greeting should include current state");

  const music = buildOfflineDialogResponse({
    templates,
    text: "what music are you listening to?",
    currentState: "MusicChill",
    phase: "loop",
    source: "offline",
    stateDescription: "I'm relaxing in music mode.",
    stateContextSummary: "provider=spotify",
    recentMediaSummary: "Night Drive by Primea FM on headphones",
    recentHobbySummary: "no recent hobby updates",
    fallbackMode: "bridge_timeout",
  });
  assertEqual(music.templateKey, "music", "offline music template key mismatch");
  assertEqual(music.fallbackMode, "bridge_timeout", "offline music fallback mode mismatch");
  assertIncludes(music.text, "Night Drive by Primea FM", "offline music response text mismatch");

  const reading = buildOfflineDialogResponse({
    templates,
    text: "what are you reading right now?",
    currentState: "Reading",
    source: "offline",
    stateDescription: "I have a book open in local mode.",
    stateContextSummary: "itemType=book, title=The Pragmatic Programmer",
    recentHobbySummary: "The Pragmatic Programmer from local library",
  });
  assertEqual(reading.templateKey, "reading", "offline reading template key mismatch");
  assertIncludes(
    reading.text,
    "The Pragmatic Programmer",
    "offline reading response should include hobby summary"
  );

  console.log("[dialog] offline dialog checks passed");
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  run,
};
