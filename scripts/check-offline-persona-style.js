"use strict";

const {
  PERSONA_INTENTS,
  buildPersonaAwareOfflineFallbackResponse,
  buildPersonaAwareProactivePrompt,
  buildStyleProfileFromPersonaSnapshot,
  classifyOfflinePersonaIntent,
  resolvePersonaFactLookup,
} = require("../offline-persona-style");

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

function createSnapshot({
  state = "ready",
  degradedReason = "none",
  toneKeywords = ["gentle", "curious"],
  profileId = "gentle_companion",
} = {}) {
  return {
    schemaVersion: "vp-persona-snapshot-v1",
    state,
    degradedReason,
    fields: {
      pet_name: { value: "Nori" },
      persona_profile_id: { value: profileId },
      tone_keywords: { value: toneKeywords },
      companion_name: { value: "Mic" },
      companion_call_name: { value: "friend" },
      companion_timezone: { value: "America/Phoenix" },
      pet_favorite_color: { value: "teal" },
      pet_favorite_movie: { value: "Kiki's Delivery Service" },
      pet_favorite_song: { value: "Ocean Eyes" },
      pet_favorite_book: { value: "The Hobbit" },
      pet_hobby: { value: "origami" },
      extra_offline_facts: { value: ["favorite snack => strawberries", "dream trip => Kyoto in spring"] },
    },
  };
}

function buildResponseForProfile(profileId) {
  return buildPersonaAwareOfflineFallbackResponse({
    promptText: "How are you feeling today?",
    personaSnapshot: createSnapshot({ profileId }),
    currentState: "Idle",
    phase: null,
    stateDescription: "I am keeping a calm local routine.",
    stateContextSummary: "local mode steady",
    ts: 1700000000000,
  });
}

function testIntentClassification() {
  assertEqual(
    classifyOfflinePersonaIntent("What is your name?"),
    PERSONA_INTENTS.identityName,
    "intent classifier should prioritize identity_name"
  );
  assertEqual(
    classifyOfflinePersonaIntent("How you feeling?"),
    PERSONA_INTENTS.smalltalk,
    "intent classifier should map feeling variant to smalltalk"
  );
  assertEqual(
    classifyOfflinePersonaIntent("Do you want to play?"),
    PERSONA_INTENTS.playInvite,
    "intent classifier should map play intent"
  );
  assertEqual(
    classifyOfflinePersonaIntent("Will you be my friend?"),
    PERSONA_INTENTS.friendship,
    "intent classifier should map friendship intent"
  );
  assertEqual(
    classifyOfflinePersonaIntent("What time is it?"),
    PERSONA_INTENTS.timeContext,
    "intent classifier should map time-context intent"
  );
  assertEqual(
    classifyOfflinePersonaIntent("What's today's date?"),
    PERSONA_INTENTS.timeContext,
    "intent classifier should map today's date phrasing to time-context intent"
  );
  assertEqual(
    classifyOfflinePersonaIntent("Current time please."),
    PERSONA_INTENTS.timeContext,
    "intent classifier should map current time phrasing to time-context intent"
  );
}

function testStyleProfileDerivation() {
  const playful = buildStyleProfileFromPersonaSnapshot(
    createSnapshot({
      toneKeywords: ["playful", "gentle", "curious"],
      profileId: "playful_friend",
    })
  );
  assertEqual(playful.playfulness, "high", "playful keyword should raise playfulness");
  assertEqual(playful.emojiPolicy, "light", "playful style should allow light emoji");
  assertEqual(playful.personaProfileId, "playful_friend", "profile id should pass through style profile");

  const degraded = buildStyleProfileFromPersonaSnapshot(
    createSnapshot({
      state: "degraded",
      degradedReason: "canonical_missing",
      toneKeywords: ["playful", "curious"],
      profileId: "bright_sidekick",
    })
  );
  assertEqual(degraded.personaState, "degraded", "degraded persona state mismatch");
  assertEqual(degraded.emojiPolicy, "none", "degraded persona should force emoji policy none");
  assertEqual(degraded.openerStyle, "direct", "degraded persona should force direct opener");
}

function testOfflineFallbackDeterminism() {
  const snapshot = createSnapshot();
  const first = buildPersonaAwareOfflineFallbackResponse({
    promptText: "How are you today?",
    personaSnapshot: snapshot,
    currentState: "Idle",
    phase: null,
    stateDescription: "I am keeping a calm local routine.",
    stateContextSummary: "local mode steady",
    ts: 1700000000000,
  });
  const second = buildPersonaAwareOfflineFallbackResponse({
    promptText: "How are you today?",
    personaSnapshot: snapshot,
    currentState: "Idle",
    phase: null,
    stateDescription: "I am keeping a calm local routine.",
    stateContextSummary: "local mode steady",
    ts: 1700000000001,
  });
  assertEqual(first.text, second.text, "offline persona fallback should be deterministic");
  assertEqual(first.intent, "smalltalk", "smalltalk intent mismatch");
  assertEqual(first.personaState, "ready", "ready persona state mismatch");
  assert(first.text.length <= 220, "offline persona text should remain bounded");
}

function testOfflineVariationKeyInfluence() {
  const snapshot = createSnapshot();
  const first = buildPersonaAwareOfflineFallbackResponse({
    promptText: "How are you today?",
    personaSnapshot: snapshot,
    variationKey: "repeat:1|petTurns:0",
    currentState: "Idle",
    phase: null,
    stateDescription: "I am keeping a calm local routine.",
    stateContextSummary: "local mode steady",
    ts: 1700000000000,
  });
  const second = buildPersonaAwareOfflineFallbackResponse({
    promptText: "How are you today?",
    personaSnapshot: snapshot,
    variationKey: "repeat:2|petTurns:1",
    currentState: "Idle",
    phase: null,
    stateDescription: "I am keeping a calm local routine.",
    stateContextSummary: "local mode steady",
    ts: 1700000000001,
  });
  assert(
    first.selectionHash !== second.selectionHash,
    "variation key should influence deterministic selection hash"
  );
}

function testPersonaFactLookup() {
  const snapshot = createSnapshot();
  const timezone = resolvePersonaFactLookup(snapshot, "What is my timezone?");
  assertEqual(timezone.fieldKey, "companion_timezone", "fact lookup should target companion timezone");
  assertEqual(timezone.factValue, "America/Phoenix", "fact lookup value mismatch");

  const color = resolvePersonaFactLookup(snapshot, "What is your favorite color?");
  assertEqual(color.fieldKey, "pet_favorite_color", "fact lookup should target favorite color");

  const custom = resolvePersonaFactLookup(snapshot, "What is your favorite snack?");
  assertEqual(custom.fieldKey, "extra_offline_facts", "custom fact should map to extra_offline_facts");
  assertEqual(custom.factValue, "strawberries", "custom fact value mismatch");
}

function testProfileDistinctness() {
  const gentle = buildResponseForProfile("gentle_companion");
  const playful = buildResponseForProfile("playful_friend");
  const bookish = buildResponseForProfile("bookish_helper");
  const bright = buildResponseForProfile("bright_sidekick");

  assertEqual(gentle.personaMode, "gentle_companion", "gentle profile mode mismatch");
  assertEqual(playful.personaMode, "playful_friend", "playful profile mode mismatch");
  assertEqual(bookish.personaMode, "bookish_helper", "bookish profile mode mismatch");
  assertEqual(bright.personaMode, "bright_sidekick", "bright profile mode mismatch");

  const distinctTexts = new Set([gentle.text, playful.text, bookish.text, bright.text]);
  assert(distinctTexts.size >= 3, "profile responses should be visibly distinct");
}

function testExpandedIntentResponses() {
  const snapshot = createSnapshot();
  const play = buildPersonaAwareOfflineFallbackResponse({
    promptText: "Do you want to play?",
    personaSnapshot: snapshot,
    currentState: "Idle",
    stateDescription: "I am keeping a calm local routine.",
    stateContextSummary: "local mode steady",
    ts: 1700000000100,
  });
  assertEqual(play.intent, "play_invite", "play intent response mismatch");

  const friendship = buildPersonaAwareOfflineFallbackResponse({
    promptText: "Will you be my friend?",
    personaSnapshot: snapshot,
    currentState: "Idle",
    stateDescription: "I am keeping a calm local routine.",
    stateContextSummary: "local mode steady",
    ts: 1700000000200,
  });
  assertEqual(friendship.intent, "friendship", "friendship intent response mismatch");

  const dayContext = buildPersonaAwareOfflineFallbackResponse({
    promptText: "What day is it?",
    personaSnapshot: snapshot,
    currentState: "Idle",
    stateDescription: "I am keeping a calm local routine.",
    stateContextSummary: "local mode steady",
    ts: 1700000000300,
  });
  assertEqual(dayContext.intent, "time_context", "day-context intent response mismatch");
  assertEqual(dayContext.timeContextKind, "day", "day-context kind mismatch");
  assert(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(dayContext.text),
    "day-context response should include weekday"
  );
  assert(!/\d{1,2}:\d{2}/.test(dayContext.text), "day-context response should not include time");

  const timeContext = buildPersonaAwareOfflineFallbackResponse({
    promptText: "What time is it?",
    personaSnapshot: snapshot,
    currentState: "Idle",
    stateDescription: "I am keeping a calm local routine.",
    stateContextSummary: "local mode steady",
    ts: 1700000000300,
  });
  assertEqual(timeContext.intent, "time_context", "time-context intent response mismatch");
  assertEqual(timeContext.timeContextKind, "time", "time-context kind mismatch");
  assert(
    /\d{1,2}:\d{2}/.test(timeContext.text),
    "time-context response should include clock time"
  );

  const dateContext = buildPersonaAwareOfflineFallbackResponse({
    promptText: "What's today's date?",
    personaSnapshot: snapshot,
    currentState: "Idle",
    stateDescription: "I am keeping a calm local routine.",
    stateContextSummary: "local mode steady",
    ts: 1700000000400,
  });
  assertEqual(dateContext.intent, "time_context", "date-context intent response mismatch");
  assertEqual(dateContext.timeContextKind, "date", "date-context kind mismatch");
  assert(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(dateContext.text),
    "date-context response should include local date/time phrasing"
  );
  assert(!/\d{1,2}:\d{2}/.test(dateContext.text), "date-context response should not include clock time");
}

function testDegradedFallbackReason() {
  const degraded = buildPersonaAwareOfflineFallbackResponse({
    promptText: "How are you today?",
    personaSnapshot: createSnapshot({
      state: "degraded",
      degradedReason: "canonical_missing",
      toneKeywords: ["playful", "curious"],
      profileId: "playful_friend",
    }),
    currentState: "Idle",
    phase: null,
    stateDescription: "I am in local fallback.",
    stateContextSummary: "local fallback context",
    ts: 1700000000400,
  });
  assertEqual(
    degraded.personaReason,
    "canonical_missing",
    "degraded persona reason should pass through"
  );
  assertEqual(
    degraded.fallbackMode,
    "offline_persona_dialog_degraded",
    "degraded persona fallback mode should be explicit"
  );
}

function testProactivePromptDeterminismAndFlavor() {
  const snapshot = createSnapshot({ profileId: "bright_sidekick" });
  const first = buildPersonaAwareProactivePrompt({
    reason: "proactive_conversation",
    personaSnapshot: snapshot,
    backoffTier: 0,
    lastOpenerHash: "none",
    ts: 1700000100000,
  });
  const second = buildPersonaAwareProactivePrompt({
    reason: "proactive_conversation",
    personaSnapshot: snapshot,
    backoffTier: 0,
    lastOpenerHash: "none",
    ts: 1700000100000,
  });
  assertEqual(first.text, second.text, "proactive persona prompt should be deterministic");
  assertEqual(first.openerHash, second.openerHash, "proactive opener hash should be deterministic");
  assert(
    first.promptFlavor === "checkin" || first.promptFlavor === "interest",
    "proactive prompt should report deterministic flavor"
  );
}

function run() {
  testIntentClassification();
  testStyleProfileDerivation();
  testOfflineFallbackDeterminism();
  testOfflineVariationKeyInfluence();
  testPersonaFactLookup();
  testProfileDistinctness();
  testExpandedIntentResponses();
  testDegradedFallbackReason();
  testProactivePromptDeterminismAndFlavor();
  console.log("[offline-persona-style] checks passed");
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
