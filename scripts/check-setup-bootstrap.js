"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  APPLY_MODES,
  MANAGED_BLOCK_START,
  MANAGED_BLOCK_END,
  buildSetupBootstrapSnapshot,
  previewSetupBootstrap,
  applySetupBootstrap,
} = require("../setup-bootstrap");

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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "virtual-pet-setup-bootstrap-"));
  const localRoot = path.join(tempRoot, "local");
  const openClawRoot = path.join(tempRoot, "openclaw");
  fs.mkdirSync(localRoot, { recursive: true });
  fs.mkdirSync(openClawRoot, { recursive: true });

  const localOnlySnapshot = buildSetupBootstrapSnapshot({
    settingsSummary: {
      openclaw: { enabled: false },
      paths: { localWorkspaceRoot: localRoot, openClawWorkspaceRoot: null },
    },
    resolvedPaths: {
      localRoot,
      openClawRoot: null,
    },
  });
  assertEqual(localOnlySnapshot.applyMode, APPLY_MODES.localOnly, "disabled OpenClaw should fall back to local-only");

  const observedOpenClawSnapshot = buildSetupBootstrapSnapshot({
    settingsSummary: {
      openclaw: { enabled: true },
      paths: { localWorkspaceRoot: localRoot, openClawWorkspaceRoot: openClawRoot },
    },
    resolvedPaths: {
      localRoot,
      openClawRoot,
    },
  });
  assertEqual(
    observedOpenClawSnapshot.applyMode,
    APPLY_MODES.localOnly,
    "healthy OpenClaw path should still keep setup writes local-only"
  );
  assertEqual(
    observedOpenClawSnapshot.targets.openClaw.requiredForApply,
    false,
    "observed OpenClaw root should never be required for apply"
  );

  const blockedSnapshot = buildSetupBootstrapSnapshot({
    settingsSummary: {
      openclaw: { enabled: true },
      paths: { localWorkspaceRoot: path.join(tempRoot, "missing-local"), openClawWorkspaceRoot: openClawRoot },
    },
    resolvedPaths: {
      localRoot: path.join(tempRoot, "missing-local"),
      openClawRoot,
    },
  });
  assertEqual(blockedSnapshot.applyMode, APPLY_MODES.blocked, "missing local path should block apply");

  const preview = previewSetupBootstrap({
    input: {
      petName: "Mochi",
      birthday: "2026-03-04",
      companionName: "Mic",
      companionTimezone: "America/New_York",
      starterNote: "Likes quiet mornings.",
      personaPresetId: "bookish_helper",
      seedHeartbeatFile: true,
    },
    settingsSummary: {
      openclaw: { enabled: true },
      paths: { localWorkspaceRoot: localRoot, openClawWorkspaceRoot: openClawRoot },
    },
    resolvedPaths: {
      localRoot,
      openClawRoot,
    },
  });

  assert(preview.ok, "preview should succeed for valid input");
  assertEqual(preview.applyMode, APPLY_MODES.localOnly, "preview should stay local-only even when OpenClaw is configured");
  assertEqual(preview.writePlan.length, 1, "preview should plan writes for the local root only");
  assertEqual(preview.files.length, 6, "preview should include HEARTBEAT when seeded");
  const styleFile = preview.files.find((file) => file.fileId === "STYLE.md");
  const soulFile = preview.files.find((file) => file.fileId === "SOUL.md");
  assert(styleFile && styleFile.previewMarkdown.includes("## Voice Principles"), "STYLE preview should include voice principles");
  assert(soulFile && !soulFile.previewMarkdown.includes("## Voice Principles"), "SOUL preview should stay style-light");

  fs.writeFileSync(
    path.join(localRoot, "SOUL.md"),
    "# SOUL\n\nExisting local note.\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(openClawRoot, "SOUL.md"),
    "# SOUL\n\nExisting bridge note.\n",
    "utf8"
  );

  const firstApply = await applySetupBootstrap({
    input: {
      petName: "Mochi",
      birthday: "2026-03-04",
      companionName: "Mic",
      companionTimezone: "America/New_York",
      starterNote: "Likes quiet mornings.",
      personaPresetId: "bookish_helper",
      seedHeartbeatFile: true,
    },
    settingsSummary: {
      openclaw: { enabled: true },
      paths: { localWorkspaceRoot: localRoot, openClawWorkspaceRoot: openClawRoot },
    },
    resolvedPaths: {
      localRoot,
      openClawRoot,
    },
  });
  assert(firstApply.ok, "apply should succeed for valid local-only preview");
  assertEqual(firstApply.targetResults.length, 1, "apply should write only the local root");

  const localSoul = fs.readFileSync(path.join(localRoot, "SOUL.md"), "utf8");
  assert(localSoul.includes("Existing local note."), "apply should preserve unrelated local content");
  assert(localSoul.includes(MANAGED_BLOCK_START), "apply should append managed block markers");
  assert(localSoul.includes(MANAGED_BLOCK_END), "apply should append managed block end marker");
  const openClawSoul = fs.readFileSync(path.join(openClawRoot, "SOUL.md"), "utf8");
  assertEqual(openClawSoul, "# SOUL\n\nExisting bridge note.\n", "apply should not mutate the observed OpenClaw root");

  const secondApply = await applySetupBootstrap({
    input: {
      petName: "Mochi",
      birthday: "2026-03-05",
      companionName: "Mic",
      companionTimezone: "America/New_York",
      starterNote: "Now likes rainy afternoons.",
      personaPresetId: "bright_sidekick",
    },
    settingsSummary: {
      openclaw: { enabled: false },
      paths: { localWorkspaceRoot: localRoot, openClawWorkspaceRoot: openClawRoot },
    },
    resolvedPaths: {
      localRoot,
      openClawRoot,
    },
  });
  assert(secondApply.ok, "local-only apply should succeed");
  assertEqual(secondApply.targetResults.length, 1, "local-only apply should write only the local root");

  const updatedLocalSoul = fs.readFileSync(path.join(localRoot, "SOUL.md"), "utf8");
  assert(updatedLocalSoul.includes("Bring momentum."), "re-apply should replace the managed block content");
  assertEqual(updatedLocalSoul.split(MANAGED_BLOCK_START).length - 1, 1, "re-apply should keep a single managed block");

  fs.rmSync(tempRoot, { recursive: true, force: true });
  console.log("[setup-bootstrap] checks passed");
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
