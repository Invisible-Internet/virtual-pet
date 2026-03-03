"use strict";

const path = require("path");
const { createExtensionPackRegistry } = require("../extension-pack-registry");

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
  const events = [];
  const registry = createExtensionPackRegistry({
    rootDir: path.join(__dirname, "..", "extensions"),
    logger(kind, payload) {
      events.push({ kind, payload });
    },
  });

  const snapshot = registry.discover();
  assertEqual(snapshot.summary.discoveredCount, 2, "discovered extension count mismatch");
  assertEqual(snapshot.summary.validCount, 1, "valid extension count mismatch");
  assertEqual(snapshot.summary.invalidCount, 1, "invalid extension count mismatch");
  assertEqual(snapshot.summary.enabledCount, 1, "enabled extension count mismatch");
  assert(
    snapshot.warnings.some((warning) => warning.includes("sample-invalid")),
    "invalid sample warning should be surfaced"
  );

  const disableResult = registry.setEnabled("sample-foodchase", false);
  assert(disableResult.ok, "valid extension should disable cleanly");
  assertEqual(disableResult.enabled, false, "extension should be disabled");

  const enableResult = registry.setEnabled("sample-foodchase", true);
  assert(enableResult.ok, "valid extension should re-enable cleanly");
  assertEqual(enableResult.enabled, true, "extension should be enabled after re-enable");
  assertIncludes(
    enableResult.trustWarning,
    "Author-trusted extension enabled",
    "trust warning should be emitted on first enable"
  );

  const interaction = registry.triggerPropInteraction("sample-foodchase", "candy", "hotkey");
  assert(interaction.ok, "valid prop interaction should succeed");
  assertEqual(interaction.intent.kind, "INTENT_PROP_INTERACTION", "interaction intent kind mismatch");
  assertEqual(interaction.intent.extensionId, "sample-foodchase", "interaction extensionId mismatch");
  assertEqual(interaction.intent.propId, "candy", "interaction propId mismatch");

  const invalidToggle = registry.setEnabled("sample-invalid", true);
  assertEqual(invalidToggle.ok, false, "invalid extension should not enable");
  assertEqual(invalidToggle.error, "extension_invalid", "invalid extension error mismatch");

  assert(
    events.some((entry) => entry.kind === "discover-summary"),
    "discover summary event should be logged"
  );
  assert(
    events.some((entry) => entry.kind === "trust-warning"),
    "trust warning event should be logged"
  );

  console.log("[extension-pack-registry] checks passed");
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
