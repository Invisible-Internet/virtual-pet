"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  loadRuntimeSettings,
  persistRuntimeSettingsPatch,
} = require("../settings-runtime");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function makeTempProjectRoot(label) {
  const root = path.join(
    os.tmpdir(),
    "virtual-pet-settings-runtime-check",
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

async function testLayeredPrecedenceAndEnvOverrides() {
  const root = await makeTempProjectRoot("precedence");
  const baseSettings = {
    integrations: {
      spotify: {
        enabled: true,
        available: true,
        backgroundEnrichmentEnabled: true,
        pollCadenceMinutes: 10,
      },
      freshRss: {
        enabled: true,
        available: false,
        backgroundEnrichmentEnabled: true,
        pollCadenceMinutes: 30,
      },
    },
    sensors: {
      media: {
        enabled: true,
        backend: "powershell",
        pollIntervalMs: 2500,
        probeTimeoutMs: 1800,
        includeOutputDevice: true,
      },
    },
    memory: {
      adapterMode: "local",
      mutationTransparencyPolicy: "logged",
      enabled: true,
      writeLegacyJsonl: false,
    },
    openclaw: {
      enabled: true,
      transport: "stub",
      mode: "online",
      baseUrl: "http://127.0.0.1:18789/bridge/dialog",
      agentId: "main",
      agentTimeoutMs: 60000,
      timeoutMs: 900,
      retryCount: 0,
      allowNonLoopback: false,
    },
    paths: {
      localWorkspaceRoot: ".",
      openClawWorkspaceRoot: null,
      obsidianVaultRoot: null,
    },
    roaming: {
      mode: "desktop",
      zone: "desk-center",
      zoneRect: null,
    },
    ui: {
      diagnosticsEnabled: false,
    },
    wardrobe: {
      activeAccessories: [],
    },
    inventory: {
      quickProps: [],
    },
    dialog: {
      alwaysShowBubble: true,
    },
  };
  const localSettings = {
    integrations: {
      spotify: {
        available: false,
        pollCadenceMinutes: 2,
      },
    },
    sensors: {
      media: {
        pollIntervalMs: 4000,
      },
    },
    memory: {
      adapterMode: "obsidian",
      writeLegacyJsonl: true,
    },
    openclaw: {
      transport: "http",
      agentId: "prime-main",
      agentTimeoutMs: 45000,
      baseUrl: "http://localhost:19999/bridge/dialog",
      timeoutMs: 1500,
    },
    roaming: {
      mode: "zone",
      zone: "desk-left",
      zoneRect: {
        x: 120,
        y: 140,
        width: 640,
        height: 420,
      },
    },
    ui: {
      diagnosticsEnabled: true,
      characterScalePercent: 108,
      characterHitboxScalePercent: 102,
    },
    wardrobe: {
      activeAccessories: ["headphones"],
    },
    inventory: {
      quickProps: ["poolRing"],
    },
    dialog: {
      alwaysShowBubble: false,
    },
  };
  await writeJson(path.join(root, "config", "settings.json"), baseSettings);
  await writeJson(path.join(root, "config", "settings.local.json"), localSettings);

  const loaded = loadRuntimeSettings({
    projectRoot: root,
    env: {
      PET_MEMORY_ADAPTER: "local",
      PET_OPENCLAW_TRANSPORT: "http",
      PET_OPENCLAW_BASE_URL: "https://remote.example.com/bridge/dialog",
      PET_OPENCLAW_AGENT_ID: "session-main",
      PET_OPENCLAW_AGENT_TIMEOUT_MS: "75000",
      PET_OPENCLAW_ALLOW_NON_LOOPBACK: "1",
      PET_OPENCLAW_AUTH_TOKEN: "test-token",
      PET_OPENCLAW_RETRY_COUNT: "2",
      PET_SPOTIFY_AVAILABLE: "1",
      PET_SPOTIFY_BACKGROUND_ENRICHMENT: "0",
      PET_LOCAL_MEDIA_ENABLED: "0",
      PET_LOCAL_MEDIA_TIMEOUT_MS: "900",
      PET_ROAMING_MODE: "desktop",
      PET_ROAMING_ZONE: "desk-right",
      PET_UI_DIAGNOSTICS_ENABLED: "0",
      PET_UI_CHARACTER_SCALE_PERCENT: "124",
      PET_UI_CHARACTER_HITBOX_SCALE_PERCENT: "117",
      PET_WARDROBE_ACCESSORIES: "headphones",
      PET_INVENTORY_QUICK_PROPS: "poolRing",
      PET_DIALOG_ALWAYS_SHOW_BUBBLE: "1",
    },
  });

  assert(loaded.settings.memory.adapterMode === "local", "env should override memory.adapterMode");
  assert(loaded.settings.memory.writeLegacyJsonl === true, "local file should override base setting");
  assert(loaded.settings.integrations.spotify.available === true, "env should override spotify availability");
  assert(
    loaded.settings.integrations.spotify.backgroundEnrichmentEnabled === false,
    "env should override spotify background enrichment"
  );
  assert(
    loaded.settings.integrations.spotify.pollCadenceMinutes === 2,
    "local file should override spotify cadence"
  );
  assert(loaded.settings.sensors.media.enabled === false, "env should override local media enabled");
  assert(loaded.settings.sensors.media.pollIntervalMs === 4000, "local file should override media cadence");
  assert(loaded.settings.sensors.media.probeTimeoutMs === 900, "env should override media timeout");
  assert(loaded.settings.roaming.mode === "desktop", "env should override roaming.mode");
  assert(loaded.settings.roaming.zone === "desk-right", "env should override roaming.zone");
  assert(
    loaded.settings.roaming.zoneRect &&
      loaded.settings.roaming.zoneRect.width === 640 &&
      loaded.settings.roaming.zoneRect.height === 420,
    "local file should preserve roaming.zoneRect when env does not override it"
  );
  assert(loaded.settings.ui.diagnosticsEnabled === false, "env should override ui.diagnosticsEnabled");
  assert(loaded.settings.ui.characterScalePercent === 124, "env should override ui.characterScalePercent");
  assert(
    loaded.settings.ui.characterHitboxScalePercent === 117,
    "env should override ui.characterHitboxScalePercent"
  );
  assert(
    Array.isArray(loaded.settings.wardrobe.activeAccessories) &&
      loaded.settings.wardrobe.activeAccessories.length === 1 &&
      loaded.settings.wardrobe.activeAccessories[0] === "headphones",
    "wardrobe.activeAccessories should normalize the supported accessory list"
  );
  assert(
    Array.isArray(loaded.settings.inventory.quickProps) &&
      loaded.settings.inventory.quickProps.length === 1 &&
      loaded.settings.inventory.quickProps[0] === "poolRing",
    "inventory.quickProps should normalize the supported quick props"
  );
  assert(loaded.settings.dialog.alwaysShowBubble === true, "env should override dialog.alwaysShowBubble");
  assert(loaded.settings.openclaw.transport === "http", "transport should resolve to HTTP");
  assert(loaded.settings.openclaw.baseUrl === "https://remote.example.com/bridge/dialog", "env baseUrl should win");
  assert(loaded.settings.openclaw.agentId === "session-main", "env agentId should win");
  assert(loaded.settings.openclaw.agentTimeoutMs === 75000, "env agentTimeoutMs should parse");
  assert(loaded.settings.openclaw.retryCount === 2, "env retry count should parse");
  assert(loaded.settings.openclaw.authToken === "test-token", "auth token should resolve from env");
  assert(loaded.sourceMap.baseConfig.endsWith(path.join("config", "settings.json")), "base config source map missing");
  assert(loaded.sourceMap.localConfig.endsWith(path.join("config", "settings.local.json")), "local config source map missing");
  assert(loaded.sourceMap["memory.adapterMode"] === "env", "env source map should mark memory.adapterMode");
  assert(loaded.sourceMap["integrations.spotify.available"] === "env", "env source map should mark spotify availability");
  assert(
    loaded.sourceMap["integrations.spotify.backgroundEnrichmentEnabled"] === "env",
    "env source map should mark spotify background enrichment"
  );
  assert(loaded.sourceMap["sensors.media.enabled"] === "env", "env source map should mark local media enabled");
  assert(loaded.sourceMap["roaming.mode"] === "env", "env source map should mark roaming.mode");
  assert(
    loaded.sourceMap["ui.diagnosticsEnabled"] === "env",
    "env source map should mark ui.diagnosticsEnabled"
  );
  assert(
    loaded.sourceMap["ui.characterScalePercent"] === "env",
    "env source map should mark ui.characterScalePercent"
  );
  assert(
    loaded.sourceMap["ui.characterHitboxScalePercent"] === "env",
    "env source map should mark ui.characterHitboxScalePercent"
  );
  assert(loaded.sourceMap["openclaw.agentId"] === "env", "env source map should mark openclaw.agentId");
  assert(loaded.sourceMap["openclaw.baseUrl"] === "env", "env source map should mark openclaw.baseUrl");
}

async function testInvalidLocalJsonHandled() {
  const root = await makeTempProjectRoot("invalid-json");
  await writeJson(path.join(root, "config", "settings.json"), {
    memory: {
      adapterMode: "local",
    },
  });
  await fs.promises.writeFile(
    path.join(root, "config", "settings.local.json"),
    "{ this-is: invalid json",
    "utf8"
  );

  const loaded = loadRuntimeSettings({
    projectRoot: root,
    env: {},
  });
  assert(Array.isArray(loaded.validationErrors), "validationErrors should be an array");
  assert(loaded.validationErrors.length > 0, "invalid local JSON should produce validationErrors");
}

async function testPolicyWarnings() {
  const root = await makeTempProjectRoot("policy");
  await writeJson(path.join(root, "config", "settings.json"), {
    memory: {
      adapterMode: "obsidian",
    },
    openclaw: {
      enabled: true,
      transport: "http",
      baseUrl: "https://remote.example.com/bridge/dialog",
      allowNonLoopback: false,
      authToken: null,
    },
    paths: {
      localWorkspaceRoot: ".",
      openClawWorkspaceRoot: "\\\\wsl$\\Ubuntu\\home\\openclaw\\workspace",
      obsidianVaultRoot: path.join(root, "missing-vault"),
    },
  });

  const loaded = loadRuntimeSettings({
    projectRoot: root,
    env: {},
  });
  const warningText = loaded.validationWarnings.join(" | ");
  assert(
    warningText.includes("non-loopback OpenClaw endpoint configured without auth token"),
    "non-loopback auth warning should be emitted"
  );
  assert(
    warningText.includes("openclaw.allowNonLoopback=true"),
    "non-loopback policy warning should be emitted"
  );
  assert(
    warningText.includes("Obsidian vault root does not exist"),
    "missing obsidian vault warning should be emitted"
  );
}

async function testPersistRuntimeSettingsPatch() {
  const root = await makeTempProjectRoot("persist");
  await writeJson(path.join(root, "config", "settings.json"), {
    ui: {
      diagnosticsEnabled: false,
    },
    dialog: {
      alwaysShowBubble: true,
    },
  });

  const persisted = persistRuntimeSettingsPatch({
    projectRoot: root,
    patch: {
      roaming: {
        mode: "zone",
        zone: "desk-left",
        zoneRect: {
          x: 220,
          y: 180,
          width: 700,
          height: 460,
        },
      },
      ui: {
        diagnosticsEnabled: true,
        characterScalePercent: 120,
        characterHitboxScalePercent: 110,
      },
      wardrobe: {
        activeAccessories: ["headphones"],
      },
      inventory: {
        quickProps: ["poolRing"],
      },
      dialog: {
        alwaysShowBubble: false,
      },
    },
  });

  assert(
    persisted.overridePath.endsWith(path.join("config", "settings.local.json")),
    "persisted override path should target config/settings.local.json in dev mode"
  );

  const loaded = loadRuntimeSettings({
    projectRoot: root,
    env: {},
  });
  assert(loaded.settings.roaming.mode === "zone", "persisted roaming.mode should load back");
  assert(loaded.settings.roaming.zone === "desk-left", "persisted roaming.zone should load back");
  assert(
    loaded.settings.roaming.zoneRect &&
      loaded.settings.roaming.zoneRect.x === 220 &&
      loaded.settings.roaming.zoneRect.width === 700,
    "persisted roaming.zoneRect should load back"
  );
  assert(loaded.settings.ui.diagnosticsEnabled === true, "persisted diagnostics setting should load back");
  assert(
    loaded.settings.ui.characterScalePercent === 120,
    "persisted character scale should load back"
  );
  assert(
    loaded.settings.ui.characterHitboxScalePercent === 110,
    "persisted character hitbox scale should load back"
  );
  assert(
    loaded.settings.dialog.alwaysShowBubble === false,
    "persisted dialog bubble setting should load back"
  );
  assert(
    loaded.settings.wardrobe.activeAccessories.includes("headphones"),
    "persisted active accessory should load back"
  );
  assert(
    loaded.settings.inventory.quickProps.includes("poolRing"),
    "persisted quick prop should load back"
  );
}

async function run() {
  await testLayeredPrecedenceAndEnvOverrides();
  await testInvalidLocalJsonHandled();
  await testPolicyWarnings();
  await testPersistRuntimeSettingsPatch();
  console.log("[settings-runtime] checks passed");
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
