"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  loadRuntimeSettings,
  persistRuntimeSettingsPatch,
} = require("../settings-runtime");
const {
  buildShellSettingsSnapshot,
  validateShellSettingsPatch,
} = require("../shell-settings-editor");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function makeTempProjectRoot(label) {
  const root = path.join(
    os.tmpdir(),
    "virtual-pet-shell-settings-editor-check",
    `${label}-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0")}`
  );
  await fs.promises.mkdir(path.join(root, "config"), { recursive: true });
  return root;
}

async function writeJson(filePath, value) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function run() {
  const root = await makeTempProjectRoot("snapshot-and-validate");
  await writeJson(path.join(root, "config", "settings.json"), {
    memory: {
      enabled: true,
      adapterMode: "local",
      mutationTransparencyPolicy: "logged",
      writeLegacyJsonl: false,
    },
    integrations: {
      spotify: {
        enabled: true,
      },
      freshRss: {
        enabled: true,
      },
    },
    openclaw: {
      enabled: true,
      transport: "ws",
      baseUrl: "ws://127.0.0.1:18789",
      allowNonLoopback: false,
      authTokenRef: "PET_OPENCLAW_AUTH_TOKEN",
      petCommandSharedSecretRef: "PET_OPENCLAW_PET_COMMAND_SECRET",
      petCommandKeyId: "local-default",
    },
    ui: {
      diagnosticsEnabled: false,
      characterScalePercent: 100,
      characterHitboxScalePercent: 100,
    },
    sensors: {
      media: {
        enabled: true,
      },
    },
    dialog: {
      alwaysShowBubble: true,
    },
    paths: {
      localWorkspaceRoot: root,
      openClawWorkspaceRoot: null,
      obsidianVaultRoot: null,
    },
  });
  await writeJson(path.join(root, "config", "settings.local.json"), {
    ui: {
      diagnosticsEnabled: true,
      characterScalePercent: 112,
    },
  });

  const loadedWithEnv = loadRuntimeSettings({
    projectRoot: root,
    env: {
      PET_SPOTIFY_ENABLED: "1",
      PET_MEMORY_ENABLED: "0",
      PET_LOCAL_WORKSPACE_ROOT: path.join(root, "env-local-workspace"),
    },
  });
  const envSnapshot = buildShellSettingsSnapshot({
    projectRoot: root,
    settingsSummary: loadedWithEnv.settings,
    settingsSourceMap: loadedWithEnv.sourceMap,
    settingsFiles: loadedWithEnv.files,
  });
  const spotifyEnabledField = envSnapshot.fields.find(
    (field) => field.key === "integrations.spotify.enabled"
  );
  assert(spotifyEnabledField, "spotify enabled field should exist in snapshot");
  assert(
    spotifyEnabledField.source === "env" && spotifyEnabledField.envOverridden === true,
    "spotify enabled field should show env source"
  );
  assert(
    spotifyEnabledField.envOverrideKey === "PET_SPOTIFY_ENABLED",
    "spotify enabled field should expose env override key"
  );
  assert(
    Array.isArray(envSnapshot.activeEnvOverrides) &&
      envSnapshot.activeEnvOverrides.some(
        (entry) => entry?.key === "integrations.spotify.enabled" && entry?.envVar === "PET_SPOTIFY_ENABLED"
      ),
    "snapshot should list active env overrides with env var names"
  );
  const memoryEnabledField = envSnapshot.fields.find((field) => field.key === "memory.enabled");
  assert(memoryEnabledField, "memory enabled field should exist in snapshot");
  assert(
    memoryEnabledField.source === "env" && memoryEnabledField.envOverridden === true,
    "memory enabled field should show env source"
  );
  assert(
    memoryEnabledField.envOverrideKey === "PET_MEMORY_ENABLED",
    "memory enabled field should expose env override key"
  );
  const localWorkspaceRootField = envSnapshot.fields.find(
    (field) => field.key === "paths.localWorkspaceRoot"
  );
  assert(localWorkspaceRootField, "local workspace root field should exist in snapshot");
  assert(
    localWorkspaceRootField.label === "Canonical Files Root",
    "local workspace root field should use Canonical Files Root label"
  );
  assert(
    localWorkspaceRootField.source === "env" && localWorkspaceRootField.envOverridden === true,
    "local workspace root field should show env source"
  );
  assert(
    localWorkspaceRootField.envOverrideKey === "PET_LOCAL_WORKSPACE_ROOT",
    "local workspace root field should expose env override key"
  );

  const validation = validateShellSettingsPatch({
    patch: {
      "memory.enabled": false,
      "paths.localWorkspaceRoot": path.join(root, "next-local-workspace"),
      "openclaw.enabled": false,
      "openclaw.transport": "http",
      "openclaw.baseUrl": "https://example.openclaw.dev",
      "ui.characterScalePercent": 118,
      "ui.characterHitboxScalePercent": 200,
      "openclaw.authTokenRef": "not valid ref",
    },
  });
  assert(validation.accepted.length === 6, "six patch keys should be accepted");
  assert(validation.rejected.length === 2, "two patch keys should be rejected");
  assert(
    validation.rejected.some((entry) => entry.key === "ui.characterHitboxScalePercent" && entry.reason === "blocked_key"),
    "hitbox percent should be blocked from settings editor writes"
  );
  assert(
    validation.rejected.some((entry) => entry.key === "openclaw.authTokenRef" && entry.reason === "invalid_env_ref"),
    "invalid auth token ref should be rejected"
  );

  persistRuntimeSettingsPatch({
    projectRoot: root,
    patch: validation.normalizedPatch,
  });
  const reloaded = loadRuntimeSettings({
    projectRoot: root,
    env: {},
  });
  assert(
    reloaded.settings.openclaw.enabled === false,
    "accepted openclaw.enabled patch should persist"
  );
  assert(
    reloaded.settings.ui.characterScalePercent === 118,
    "accepted characterScalePercent patch should persist"
  );
  assert(
    reloaded.settings.openclaw.transport === "http",
    "accepted openclaw.transport patch should persist"
  );
  assert(
    reloaded.settings.openclaw.baseUrl === "https://example.openclaw.dev",
    "accepted openclaw.baseUrl patch should persist"
  );
  assert(
    reloaded.settings.memory.enabled === false,
    "accepted memory.enabled patch should persist"
  );
  assert(
    reloaded.settings.paths.localWorkspaceRoot === path.join(root, "next-local-workspace"),
    "accepted paths.localWorkspaceRoot patch should persist"
  );

  const persistedSnapshot = buildShellSettingsSnapshot({
    projectRoot: root,
    settingsSummary: reloaded.settings,
    settingsSourceMap: reloaded.sourceMap,
    settingsFiles: reloaded.files,
  });
  const openclawField = persistedSnapshot.fields.find((field) => field.key === "openclaw.enabled");
  assert(openclawField, "openclaw field should exist in persisted snapshot");
  assert(openclawField.value === false, "persisted snapshot should reflect saved openclaw value");

  console.log("[shell-settings-editor] checks passed");
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
