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
} = {}) {
  return {
    schemaVersion: "vp-persona-snapshot-v1",
    state,
    degradedReason,
    fields: {
      pet_name: {
        value: "Nori",
      },
      tone_keywords: {
        value: toneKeywords,
      },
      companion_name: {
        value: "Mic",
      },
      companion_call_name: {
        value: "friend",
      },
      companion_timezone: {
        value: "America/Phoenix",
      },
    },
  };
}

function testIntentClassification() {
  assertEqual(
    classifyOfflinePersonaIntent("What is your name?"),
    PERSONA_INTENTS.identityName,
    "intent classifier should prioritize identity_name"
  );
  assertEqual(
    classifyOfflinePersonaIntent("When is your birthday?"),
    PERSONA_INTENTS.identityBirthday,
    "intent classifier should detect birthday intent"
  );
  assertEqual(
    classifyOfflinePersonaIntent("How are you today?"),
    PERSONA_INTENTS.smalltalk,
    "intent classifier should map smalltalk"
  );
  assertEqual(
    classifyOfflinePersonaIntent("I am feeling anxious today."),
    PERSONA_INTENTS.comfort,
    "intent classifier should map comfort prompts"
  );
}

function testStyleProfileDerivation() {
  const playful = buildStyleProfileFromPersonaSnapshot(
    createSnapshot({
      toneKeywords: ["playful", "gentle", "curious"],
    })
  );
  assertEqual(playful.playfulness, "high", "playful keyword should raise playfulness");
  assertEqual(playful.emojiPolicy, "light", "playful style should allow light emoji");

  const degraded = buildStyleProfileFromPersonaSnapshot(
    createSnapshot({
      state: "degraded",
      degradedReason: "canonical_missing",
      toneKeywords: ["playful", "curious"],
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
  const resolved = resolvePersonaFactLookup(snapshot, "What is my timezone?");
  assertEqual(resolved.fieldKey, "companion_timezone", "fact lookup should target companion timezone");
  assertEqual(resolved.factValue, "America/Phoenix", "fact lookup value mismatch");

  const response = buildPersonaAwareOfflineFallbackResponse({
    promptText: "What is my timezone?",
    personaSnapshot: snapshot,
    currentState: "Idle",
    phase: null,
    stateDescription: "I am keeping a calm local routine.",
    stateContextSummary: "local mode steady",
    ts: 1700000000200,
  });
  assertEqual(response.intent, "persona_fact", "persona fact intent mismatch");
  assertEqual(response.factFieldKey, "companion_timezone", "persona fact field key mismatch");
  assert(
    response.text.toLowerCase().includes("america/phoenix"),
    "persona fact response should include resolved value"
  );
}

function testDegradedFallbackReason() {
  const degraded = buildPersonaAwareOfflineFallbackResponse({
    promptText: "How are you today?",
    personaSnapshot: createSnapshot({
      state: "degraded",
      degradedReason: "canonical_missing",
      toneKeywords: ["playful", "curious"],
    }),
    currentState: "Idle",
    phase: null,
    stateDescription: "I am in local fallback.",
    stateContextSummary: "local fallback context",
    ts: 1700000000100,
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

function testProactivePromptDeterminism() {
  const snapshot = createSnapshot();
  const first = buildPersonaAwareProactivePrompt({
    reason: "proactive_conversation",
    personaSnapshot: snapshot,
    backoffTier: 0,
    lastOpenerHash: "none",
  });
  const second = buildPersonaAwareProactivePrompt({
    reason: "proactive_conversation",
    personaSnapshot: snapshot,
    backoffTier: 0,
    lastOpenerHash: "none",
  });
  assertEqual(first.text, second.text, "proactive persona prompt should be deterministic");
  assertEqual(first.openerHash, second.openerHash, "proactive opener hash should be deterministic");
}

function run() {
  testIntentClassification();
  testStyleProfileDerivation();
  testOfflineFallbackDeterminism();
  testOfflineVariationKeyInfluence();
  testPersonaFactLookup();
  testDegradedFallbackReason();
  testProactivePromptDeterminism();
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
