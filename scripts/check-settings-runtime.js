"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadRuntimeSettings } = require("../settings-runtime");

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
      timeoutMs: 900,
      retryCount: 0,
      allowNonLoopback: false,
    },
    paths: {
      localWorkspaceRoot: ".",
      openClawWorkspaceRoot: null,
      obsidianVaultRoot: null,
    },
  };
  const localSettings = {
    memory: {
      adapterMode: "obsidian",
      writeLegacyJsonl: true,
    },
    openclaw: {
      transport: "http",
      baseUrl: "http://localhost:19999/bridge/dialog",
      timeoutMs: 1500,
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
      PET_OPENCLAW_ALLOW_NON_LOOPBACK: "1",
      PET_OPENCLAW_AUTH_TOKEN: "test-token",
      PET_OPENCLAW_RETRY_COUNT: "2",
    },
  });

  assert(loaded.settings.memory.adapterMode === "local", "env should override memory.adapterMode");
  assert(loaded.settings.memory.writeLegacyJsonl === true, "local file should override base setting");
  assert(loaded.settings.openclaw.transport === "http", "transport should resolve to HTTP");
  assert(loaded.settings.openclaw.baseUrl === "https://remote.example.com/bridge/dialog", "env baseUrl should win");
  assert(loaded.settings.openclaw.retryCount === 2, "env retry count should parse");
  assert(loaded.settings.openclaw.authToken === "test-token", "auth token should resolve from env");
  assert(loaded.sourceMap.baseConfig.endsWith(path.join("config", "settings.json")), "base config source map missing");
  assert(loaded.sourceMap.localConfig.endsWith(path.join("config", "settings.local.json")), "local config source map missing");
  assert(loaded.sourceMap["memory.adapterMode"] === "env", "env source map should mark memory.adapterMode");
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

async function run() {
  await testLayeredPrecedenceAndEnvOverrides();
  await testInvalidLocalJsonHandled();
  await testPolicyWarnings();
  console.log("[settings-runtime] checks passed");
}

run().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
