"use strict";

const fs = require("fs");
const path = require("path");
const { normalizeBridgeMode, BRIDGE_MODES } = require("./openclaw-bridge");
const {
  buildDefaultIntegrationSettings,
  normalizeIntegrationSettings,
} = require("./integration-runtime");
const {
  DEFAULT_OPENCLAW_AGENT_ID,
  DEFAULT_OPENCLAW_AGENT_TIMEOUT_MS,
} = require("./openclaw-agent-probe");
const {
  buildDefaultLocalMediaSensorSettings,
  normalizeLocalMediaSensorSettings,
} = require("./windows-media-sensor");
const {
  MEMORY_ADAPTER_MODES,
  MUTATION_TRANSPARENCY_POLICIES,
  DEFAULT_OBSIDIAN_VAULT_PATH,
} = require("./memory-pipeline");

const OPENCLAW_TRANSPORTS = Object.freeze({
  stub: "stub",
  http: "http",
  ws: "ws",
});
const ROAMING_MODES = Object.freeze({
  desktop: "desktop",
  zone: "zone",
});
const DEFAULT_ROAMING_ZONE = "desk-center";
const MIN_ZONE_RECT_SIZE = 120;
const DEFAULT_CHARACTER_SCALE_PERCENT = 100;
const MIN_CHARACTER_SCALE_PERCENT = 50;
const MAX_CHARACTER_SCALE_PERCENT = 200;
const DEFAULT_CHARACTER_HITBOX_SCALE_PERCENT = 100;
const MIN_CHARACTER_HITBOX_SCALE_PERCENT = 50;
const MAX_CHARACTER_HITBOX_SCALE_PERCENT = 200;
const KNOWN_ACCESSORY_IDS = new Set(["headphones"]);
const KNOWN_QUICK_PROP_IDS = new Set(["poolRing"]);

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function toBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
      return true;
    }
    if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
      return false;
    }
  }
  return fallback;
}

function toOptionalString(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function toPositiveInteger(value, fallback, min = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.round(numeric));
}

function toBoundedInteger(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric);
  return Math.min(max, Math.max(min, rounded));
}

function normalizeStringArray(value, allowedValues = null) {
  const rawValues =
    Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const normalized = [];
  const seen = new Set();
  for (const entry of rawValues) {
    const trimmed = toOptionalString(entry, null);
    if (!trimmed) continue;
    if (allowedValues instanceof Set && !allowedValues.has(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

function normalizeZoneRect(value) {
  if (!value || typeof value !== "object") return null;
  const x = Number(value.x);
  const y = Number(value.y);
  const width = Number(value.width);
  const height = Number(value.height);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  if (width < MIN_ZONE_RECT_SIZE || height < MIN_ZONE_RECT_SIZE) {
    return null;
  }
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function deepClone(value) {
  if (!value || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value));
}

function mergeObjects(base, override) {
  const result = deepClone(base) || {};
  if (!override || typeof override !== "object") return result;
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = mergeObjects(result[key], value);
      continue;
    }
    result[key] = value;
  }
  return result;
}

function safeReadJson(filePath, warnings, errors) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    const message = `[settings] failed to parse ${filePath}: ${error?.message || String(error)}`;
    errors.push(message);
    return null;
  }
}

function toAbsolutePath(value, fallback) {
  const asString = toOptionalString(value, null);
  if (!asString) return fallback;
  if (path.isAbsolute(asString)) return path.normalize(asString);
  return path.resolve(asString);
}

function isLoopbackEndpoint(baseUrl) {
  const normalized = toOptionalString(baseUrl, "");
  if (!normalized) return false;
  try {
    const url = new URL(normalized);
    const hostname = (url.hostname || "").toLowerCase();
    return LOOPBACK_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

function isWslUncPath(filePath) {
  const normalized = toOptionalString(filePath, "");
  if (!normalized) return false;
  const lowered = normalized.replace(/\//g, "\\").toLowerCase();
  return lowered.startsWith("\\\\wsl$\\");
}

function validateResolvedPaths(normalized, warnings, errors) {
  const localRoot = toOptionalString(normalized?.paths?.localWorkspaceRoot, null);
  const openClawRoot = toOptionalString(normalized?.paths?.openClawWorkspaceRoot, null);
  const obsidianRoot = toOptionalString(normalized?.paths?.obsidianVaultRoot, null);
  const openclawEnabled = Boolean(normalized?.openclaw?.enabled);
  const adapterMode = normalized?.memory?.adapterMode;

  if (!localRoot) {
    errors.push("[settings] paths.localWorkspaceRoot must resolve to a non-empty absolute path.");
  }

  if (openclawEnabled && openClawRoot) {
    if (!path.isAbsolute(openClawRoot)) {
      errors.push("[settings] paths.openClawWorkspaceRoot must be absolute when set.");
    }
    if (!isWslUncPath(openClawRoot) && /^[a-zA-Z]:/.test(openClawRoot) === false) {
      warnings.push(
        "[settings] paths.openClawWorkspaceRoot is not a Windows drive path or WSL UNC path; verify connectivity."
      );
    }
    if (!fs.existsSync(openClawRoot)) {
      warnings.push("[settings] OpenClaw workspace root does not exist yet; runtime will stay non-destructive.");
    } else {
      try {
        const stats = fs.statSync(openClawRoot);
        if (!stats.isDirectory()) {
          warnings.push("[settings] OpenClaw workspace root exists but is not a directory.");
        }
      } catch {
        warnings.push("[settings] OpenClaw workspace root is not readable.");
      }
    }
  }

  if (adapterMode === MEMORY_ADAPTER_MODES.obsidian) {
    if (!obsidianRoot) {
      warnings.push("[settings] memory.adapterMode=obsidian but paths.obsidianVaultRoot is empty.");
    } else {
      if (!path.isAbsolute(obsidianRoot)) {
        errors.push("[settings] paths.obsidianVaultRoot must be absolute when obsidian adapter is requested.");
      }
      if (!fs.existsSync(obsidianRoot)) {
        warnings.push("[settings] Obsidian vault root does not exist; runtime will fall back to local adapter.");
      } else {
        try {
          const stats = fs.statSync(obsidianRoot);
          if (!stats.isDirectory()) {
            warnings.push("[settings] Obsidian vault root exists but is not a directory.");
          }
        } catch {
          warnings.push("[settings] Obsidian vault root is not readable.");
        }
      }
    }
  }
}

function buildDefaultSettings(projectRoot) {
  return {
    integrations: buildDefaultIntegrationSettings(),
    sensors: {
      media: buildDefaultLocalMediaSensorSettings(),
    },
    memory: {
      enabled: true,
      adapterMode: MEMORY_ADAPTER_MODES.local,
      mutationTransparencyPolicy: MUTATION_TRANSPARENCY_POLICIES.logged,
      writeLegacyJsonl: true,
    },
    openclaw: {
      enabled: true,
      transport: OPENCLAW_TRANSPORTS.stub,
      mode: BRIDGE_MODES.online,
      agentId: DEFAULT_OPENCLAW_AGENT_ID,
      agentTimeoutMs: DEFAULT_OPENCLAW_AGENT_TIMEOUT_MS,
      baseUrl: "http://127.0.0.1:18789/bridge/dialog",
      timeoutMs: 1200,
      retryCount: 0,
      authTokenRef: "PET_OPENCLAW_AUTH_TOKEN",
      authToken: null,
      allowNonLoopback: false,
      petCommandSharedSecretRef: "PET_OPENCLAW_PET_COMMAND_SECRET",
      petCommandSharedSecret: null,
      petCommandKeyId: "local-default",
    },
    paths: {
      localWorkspaceRoot: projectRoot,
      openClawWorkspaceRoot: null,
      obsidianVaultRoot: DEFAULT_OBSIDIAN_VAULT_PATH,
    },
    roaming: {
      mode: ROAMING_MODES.desktop,
      zone: DEFAULT_ROAMING_ZONE,
      zoneRect: null,
    },
    ui: {
      diagnosticsEnabled: false,
      characterScalePercent: DEFAULT_CHARACTER_SCALE_PERCENT,
      characterHitboxScalePercent: DEFAULT_CHARACTER_HITBOX_SCALE_PERCENT,
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
}

function normalizeSettings(rawSettings, { projectRoot, env, warnings, errors }) {
  const raw = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
  const normalized = buildDefaultSettings(projectRoot);

  normalized.integrations = normalizeIntegrationSettings(raw.integrations);
  const sensorsRaw = raw.sensors && typeof raw.sensors === "object" ? raw.sensors : {};
  normalized.sensors.media = normalizeLocalMediaSensorSettings(sensorsRaw.media);

  const memoryRaw = raw.memory && typeof raw.memory === "object" ? raw.memory : {};
  normalized.memory.enabled = toBoolean(memoryRaw.enabled, normalized.memory.enabled);
  normalized.memory.adapterMode =
    memoryRaw.adapterMode === MEMORY_ADAPTER_MODES.obsidian
      ? MEMORY_ADAPTER_MODES.obsidian
      : MEMORY_ADAPTER_MODES.local;
  const transparency = toOptionalString(memoryRaw.mutationTransparencyPolicy, normalized.memory.mutationTransparencyPolicy);
  normalized.memory.mutationTransparencyPolicy =
    transparency === MUTATION_TRANSPARENCY_POLICIES.silent ||
    transparency === MUTATION_TRANSPARENCY_POLICIES.brief_notification
      ? transparency
      : MUTATION_TRANSPARENCY_POLICIES.logged;
  normalized.memory.writeLegacyJsonl = toBoolean(
    memoryRaw.writeLegacyJsonl,
    normalized.memory.writeLegacyJsonl
  );

  const pathsRaw = raw.paths && typeof raw.paths === "object" ? raw.paths : {};
  normalized.paths.localWorkspaceRoot = toAbsolutePath(
    pathsRaw.localWorkspaceRoot,
    normalized.paths.localWorkspaceRoot
  );
  normalized.paths.openClawWorkspaceRoot = toAbsolutePath(pathsRaw.openClawWorkspaceRoot, null);
  normalized.paths.obsidianVaultRoot = toAbsolutePath(
    pathsRaw.obsidianVaultRoot,
    normalized.paths.obsidianVaultRoot
  );

  const roamingRaw = raw.roaming && typeof raw.roaming === "object" ? raw.roaming : {};
  normalized.roaming.mode =
    toOptionalString(roamingRaw.mode, normalized.roaming.mode) === ROAMING_MODES.zone
      ? ROAMING_MODES.zone
      : ROAMING_MODES.desktop;
  normalized.roaming.zone =
    toOptionalString(roamingRaw.zone, normalized.roaming.zone) || DEFAULT_ROAMING_ZONE;
  normalized.roaming.zoneRect = normalizeZoneRect(roamingRaw.zoneRect);

  const uiRaw = raw.ui && typeof raw.ui === "object" ? raw.ui : {};
  normalized.ui.diagnosticsEnabled = toBoolean(
    uiRaw.diagnosticsEnabled,
    normalized.ui.diagnosticsEnabled
  );
  normalized.ui.characterScalePercent = toBoundedInteger(
    uiRaw.characterScalePercent,
    normalized.ui.characterScalePercent,
    MIN_CHARACTER_SCALE_PERCENT,
    MAX_CHARACTER_SCALE_PERCENT
  );
  normalized.ui.characterHitboxScalePercent = toBoundedInteger(
    uiRaw.characterHitboxScalePercent,
    normalized.ui.characterHitboxScalePercent,
    MIN_CHARACTER_HITBOX_SCALE_PERCENT,
    MAX_CHARACTER_HITBOX_SCALE_PERCENT
  );

  const wardrobeRaw = raw.wardrobe && typeof raw.wardrobe === "object" ? raw.wardrobe : {};
  normalized.wardrobe.activeAccessories = normalizeStringArray(
    wardrobeRaw.activeAccessories,
    KNOWN_ACCESSORY_IDS
  );

  const inventoryRaw = raw.inventory && typeof raw.inventory === "object" ? raw.inventory : {};
  normalized.inventory.quickProps = normalizeStringArray(
    inventoryRaw.quickProps,
    KNOWN_QUICK_PROP_IDS
  );

  const dialogRaw = raw.dialog && typeof raw.dialog === "object" ? raw.dialog : {};
  normalized.dialog.alwaysShowBubble = toBoolean(
    dialogRaw.alwaysShowBubble,
    normalized.dialog.alwaysShowBubble
  );

  const openclawRaw = raw.openclaw && typeof raw.openclaw === "object" ? raw.openclaw : {};
  normalized.openclaw.enabled = toBoolean(openclawRaw.enabled, normalized.openclaw.enabled);
  const normalizedOpenClawTransport = toOptionalString(
    openclawRaw.transport,
    normalized.openclaw.transport
  );
  normalized.openclaw.transport =
    normalizedOpenClawTransport === OPENCLAW_TRANSPORTS.http
      ? OPENCLAW_TRANSPORTS.http
      : normalizedOpenClawTransport === OPENCLAW_TRANSPORTS.ws
        ? OPENCLAW_TRANSPORTS.ws
        : OPENCLAW_TRANSPORTS.stub;
  normalized.openclaw.agentId = toOptionalString(openclawRaw.agentId, normalized.openclaw.agentId);
  normalized.openclaw.agentTimeoutMs = toPositiveInteger(
    openclawRaw.agentTimeoutMs,
    normalized.openclaw.agentTimeoutMs,
    1000
  );
  normalized.openclaw.mode = normalizeBridgeMode(
    toOptionalString(openclawRaw.mode, normalized.openclaw.mode),
    normalized.openclaw.mode
  );
  normalized.openclaw.baseUrl =
    toOptionalString(openclawRaw.baseUrl, normalized.openclaw.baseUrl) || normalized.openclaw.baseUrl;
  normalized.openclaw.timeoutMs = toPositiveInteger(openclawRaw.timeoutMs, normalized.openclaw.timeoutMs, 200);
  normalized.openclaw.retryCount = toPositiveInteger(openclawRaw.retryCount, normalized.openclaw.retryCount, 0);
  normalized.openclaw.authTokenRef = toOptionalString(openclawRaw.authTokenRef, normalized.openclaw.authTokenRef);
  normalized.openclaw.authToken = toOptionalString(openclawRaw.authToken, null);
  normalized.openclaw.allowNonLoopback = toBoolean(
    openclawRaw.allowNonLoopback,
    normalized.openclaw.allowNonLoopback
  );
  normalized.openclaw.petCommandSharedSecretRef = toOptionalString(
    openclawRaw.petCommandSharedSecretRef,
    normalized.openclaw.petCommandSharedSecretRef
  );
  normalized.openclaw.petCommandSharedSecret = toOptionalString(openclawRaw.petCommandSharedSecret, null);
  normalized.openclaw.petCommandKeyId = toOptionalString(
    openclawRaw.petCommandKeyId,
    normalized.openclaw.petCommandKeyId
  );

  if (normalized.openclaw.authTokenRef && env && typeof env === "object") {
    const tokenFromRef = toOptionalString(env[normalized.openclaw.authTokenRef], null);
    if (tokenFromRef) {
      normalized.openclaw.authToken = tokenFromRef;
    }
  }
  if (!normalized.openclaw.authToken && env && typeof env === "object") {
    const tokenFromDefaultEnv = toOptionalString(env.PET_OPENCLAW_AUTH_TOKEN, null);
    if (tokenFromDefaultEnv) {
      normalized.openclaw.authToken = tokenFromDefaultEnv;
    }
  }
  if (normalized.openclaw.petCommandSharedSecretRef && env && typeof env === "object") {
    const commandSecretFromRef = toOptionalString(env[normalized.openclaw.petCommandSharedSecretRef], null);
    if (commandSecretFromRef) {
      normalized.openclaw.petCommandSharedSecret = commandSecretFromRef;
    }
  }
  if (!normalized.openclaw.petCommandSharedSecret && env && typeof env === "object") {
    const commandSecretFromDefaultEnv = toOptionalString(env.PET_OPENCLAW_PET_COMMAND_SECRET, null);
    if (commandSecretFromDefaultEnv) {
      normalized.openclaw.petCommandSharedSecret = commandSecretFromDefaultEnv;
    }
  }

  const loopback = isLoopbackEndpoint(normalized.openclaw.baseUrl);
  normalized.openclaw.loopbackEndpoint = loopback;
  normalized.openclaw.nonLoopbackAuthSatisfied =
    loopback || Boolean(normalized.openclaw.authToken);
  if (
    normalized.openclaw.enabled &&
    (normalized.openclaw.transport === OPENCLAW_TRANSPORTS.http ||
      normalized.openclaw.transport === OPENCLAW_TRANSPORTS.ws)
  ) {
    try {
      void new URL(normalized.openclaw.baseUrl);
    } catch {
      warnings.push("[settings] openclaw.baseUrl is not a valid URL; bridge will degrade to fallback.");
    }
    if (!loopback && !normalized.openclaw.authToken) {
      warnings.push(
        "[settings] non-loopback OpenClaw endpoint configured without auth token; bridge will run in degraded fallback mode."
      );
    }
    if (!loopback && !normalized.openclaw.allowNonLoopback) {
      warnings.push(
        "[settings] non-loopback OpenClaw endpoint requires openclaw.allowNonLoopback=true; bridge will run in degraded fallback mode."
      );
    }
  }

  validateResolvedPaths(normalized, warnings, errors);

  return normalized;
}

function resolveWorkspacePaths(settings) {
  const safe = settings && typeof settings === "object" ? settings : buildDefaultSettings(process.cwd());
  const pathsConfig = safe.paths && typeof safe.paths === "object" ? safe.paths : {};
  return {
    localRoot: toAbsolutePath(pathsConfig.localWorkspaceRoot, process.cwd()),
    openClawRoot: toAbsolutePath(pathsConfig.openClawWorkspaceRoot, null),
    obsidianRoot: toAbsolutePath(pathsConfig.obsidianVaultRoot, null),
  };
}

function applyEnvOverrides(settings, env, sourceMap) {
  if (!env || typeof env !== "object") return settings;
  const next = deepClone(settings);

  function set(pathKey, value) {
    const segments = pathKey.split(".");
    let cursor = next;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const key = segments[i];
      if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
      cursor = cursor[key];
    }
    cursor[segments[segments.length - 1]] = value;
    sourceMap[pathKey] = "env";
  }

  if (Object.prototype.hasOwnProperty.call(env, "PET_MEMORY_ENABLED")) {
    set("memory.enabled", toBoolean(env.PET_MEMORY_ENABLED, next.memory.enabled));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_MEMORY_ADAPTER")) {
    set("memory.adapterMode", toOptionalString(env.PET_MEMORY_ADAPTER, next.memory.adapterMode));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_IDENTITY_MUTATION_VISIBILITY")) {
    set(
      "memory.mutationTransparencyPolicy",
      toOptionalString(env.PET_IDENTITY_MUTATION_VISIBILITY, next.memory.mutationTransparencyPolicy)
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_MEMORY_WRITE_LEGACY_JSONL")) {
    set("memory.writeLegacyJsonl", toBoolean(env.PET_MEMORY_WRITE_LEGACY_JSONL, next.memory.writeLegacyJsonl));
  }

  if (Object.prototype.hasOwnProperty.call(env, "PET_OPENCLAW_ENABLED")) {
    set("openclaw.enabled", toBoolean(env.PET_OPENCLAW_ENABLED, next.openclaw.enabled));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_OPENCLAW_TRANSPORT")) {
    set("openclaw.transport", toOptionalString(env.PET_OPENCLAW_TRANSPORT, next.openclaw.transport));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_OPENCLAW_AGENT_ID")) {
    set("openclaw.agentId", toOptionalString(env.PET_OPENCLAW_AGENT_ID, next.openclaw.agentId));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_OPENCLAW_AGENT_TIMEOUT_MS")) {
    set(
      "openclaw.agentTimeoutMs",
      toPositiveInteger(env.PET_OPENCLAW_AGENT_TIMEOUT_MS, next.openclaw.agentTimeoutMs, 1000)
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_OPENCLAW_MODE")) {
    set("openclaw.mode", toOptionalString(env.PET_OPENCLAW_MODE, next.openclaw.mode));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_OPENCLAW_BASE_URL")) {
    set("openclaw.baseUrl", toOptionalString(env.PET_OPENCLAW_BASE_URL, next.openclaw.baseUrl));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_OPENCLAW_TIMEOUT_MS")) {
    set("openclaw.timeoutMs", toPositiveInteger(env.PET_OPENCLAW_TIMEOUT_MS, next.openclaw.timeoutMs, 200));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_OPENCLAW_RETRY_COUNT")) {
    set("openclaw.retryCount", toPositiveInteger(env.PET_OPENCLAW_RETRY_COUNT, next.openclaw.retryCount, 0));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_OPENCLAW_AUTH_TOKEN_REF")) {
    set("openclaw.authTokenRef", toOptionalString(env.PET_OPENCLAW_AUTH_TOKEN_REF, next.openclaw.authTokenRef));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_OPENCLAW_PET_COMMAND_SECRET_REF")) {
    set(
      "openclaw.petCommandSharedSecretRef",
      toOptionalString(env.PET_OPENCLAW_PET_COMMAND_SECRET_REF, next.openclaw.petCommandSharedSecretRef)
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_OPENCLAW_PET_COMMAND_SECRET")) {
    set(
      "openclaw.petCommandSharedSecret",
      toOptionalString(env.PET_OPENCLAW_PET_COMMAND_SECRET, next.openclaw.petCommandSharedSecret)
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_OPENCLAW_PET_COMMAND_KEY_ID")) {
    set("openclaw.petCommandKeyId", toOptionalString(env.PET_OPENCLAW_PET_COMMAND_KEY_ID, next.openclaw.petCommandKeyId));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_OPENCLAW_ALLOW_NON_LOOPBACK")) {
    set(
      "openclaw.allowNonLoopback",
      toBoolean(env.PET_OPENCLAW_ALLOW_NON_LOOPBACK, next.openclaw.allowNonLoopback)
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_OPENCLAW_AUTH_TOKEN")) {
    set("openclaw.authToken", toOptionalString(env.PET_OPENCLAW_AUTH_TOKEN, next.openclaw.authToken));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_LOCAL_WORKSPACE_ROOT")) {
    set("paths.localWorkspaceRoot", toOptionalString(env.PET_LOCAL_WORKSPACE_ROOT, next.paths.localWorkspaceRoot));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_OPENCLAW_WORKSPACE_PATH")) {
    set("paths.openClawWorkspaceRoot", toOptionalString(env.PET_OPENCLAW_WORKSPACE_PATH, next.paths.openClawWorkspaceRoot));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_OBSIDIAN_VAULT_PATH")) {
    set("paths.obsidianVaultRoot", toOptionalString(env.PET_OBSIDIAN_VAULT_PATH, next.paths.obsidianVaultRoot));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_ROAMING_MODE")) {
    set("roaming.mode", toOptionalString(env.PET_ROAMING_MODE, next.roaming.mode));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_ROAMING_ZONE")) {
    set("roaming.zone", toOptionalString(env.PET_ROAMING_ZONE, next.roaming.zone));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_UI_DIAGNOSTICS_ENABLED")) {
    set("ui.diagnosticsEnabled", toBoolean(env.PET_UI_DIAGNOSTICS_ENABLED, next.ui.diagnosticsEnabled));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_UI_CHARACTER_SCALE_PERCENT")) {
    set(
      "ui.characterScalePercent",
      toBoundedInteger(
        env.PET_UI_CHARACTER_SCALE_PERCENT,
        next.ui.characterScalePercent,
        MIN_CHARACTER_SCALE_PERCENT,
        MAX_CHARACTER_SCALE_PERCENT
      )
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_UI_CHARACTER_HITBOX_SCALE_PERCENT")) {
    set(
      "ui.characterHitboxScalePercent",
      toBoundedInteger(
        env.PET_UI_CHARACTER_HITBOX_SCALE_PERCENT,
        next.ui.characterHitboxScalePercent,
        MIN_CHARACTER_HITBOX_SCALE_PERCENT,
        MAX_CHARACTER_HITBOX_SCALE_PERCENT
      )
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_WARDROBE_ACCESSORIES")) {
    set(
      "wardrobe.activeAccessories",
      toOptionalString(env.PET_WARDROBE_ACCESSORIES, next.wardrobe.activeAccessories)
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_INVENTORY_QUICK_PROPS")) {
    set(
      "inventory.quickProps",
      toOptionalString(env.PET_INVENTORY_QUICK_PROPS, next.inventory.quickProps)
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_DIALOG_ALWAYS_SHOW_BUBBLE")) {
    set(
      "dialog.alwaysShowBubble",
      toBoolean(env.PET_DIALOG_ALWAYS_SHOW_BUBBLE, next.dialog.alwaysShowBubble)
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_SPOTIFY_ENABLED")) {
    set("integrations.spotify.enabled", toBoolean(env.PET_SPOTIFY_ENABLED, next.integrations.spotify.enabled));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_SPOTIFY_AVAILABLE")) {
    set(
      "integrations.spotify.available",
      toBoolean(env.PET_SPOTIFY_AVAILABLE, next.integrations.spotify.available)
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_SPOTIFY_BACKGROUND_ENRICHMENT")) {
    set(
      "integrations.spotify.backgroundEnrichmentEnabled",
      toBoolean(
        env.PET_SPOTIFY_BACKGROUND_ENRICHMENT,
        next.integrations.spotify.backgroundEnrichmentEnabled
      )
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_SPOTIFY_POLL_CADENCE_MINUTES")) {
    set(
      "integrations.spotify.pollCadenceMinutes",
      toPositiveInteger(
        env.PET_SPOTIFY_POLL_CADENCE_MINUTES,
        next.integrations.spotify.pollCadenceMinutes,
        1
      )
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_FRESHRSS_ENABLED")) {
    set(
      "integrations.freshRss.enabled",
      toBoolean(env.PET_FRESHRSS_ENABLED, next.integrations.freshRss.enabled)
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_FRESHRSS_AVAILABLE")) {
    set(
      "integrations.freshRss.available",
      toBoolean(env.PET_FRESHRSS_AVAILABLE, next.integrations.freshRss.available)
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_FRESHRSS_BACKGROUND_ENRICHMENT")) {
    set(
      "integrations.freshRss.backgroundEnrichmentEnabled",
      toBoolean(
        env.PET_FRESHRSS_BACKGROUND_ENRICHMENT,
        next.integrations.freshRss.backgroundEnrichmentEnabled
      )
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_FRESHRSS_POLL_CADENCE_MINUTES")) {
    set(
      "integrations.freshRss.pollCadenceMinutes",
      toPositiveInteger(
        env.PET_FRESHRSS_POLL_CADENCE_MINUTES,
        next.integrations.freshRss.pollCadenceMinutes,
        5
      )
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_LOCAL_MEDIA_ENABLED")) {
    set("sensors.media.enabled", toBoolean(env.PET_LOCAL_MEDIA_ENABLED, next.sensors.media.enabled));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_LOCAL_MEDIA_BACKEND")) {
    set("sensors.media.backend", toOptionalString(env.PET_LOCAL_MEDIA_BACKEND, next.sensors.media.backend));
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_LOCAL_MEDIA_POLL_INTERVAL_MS")) {
    set(
      "sensors.media.pollIntervalMs",
      toPositiveInteger(env.PET_LOCAL_MEDIA_POLL_INTERVAL_MS, next.sensors.media.pollIntervalMs, 500)
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_LOCAL_MEDIA_TIMEOUT_MS")) {
    set(
      "sensors.media.probeTimeoutMs",
      toPositiveInteger(env.PET_LOCAL_MEDIA_TIMEOUT_MS, next.sensors.media.probeTimeoutMs, 250)
    );
  }
  if (Object.prototype.hasOwnProperty.call(env, "PET_LOCAL_MEDIA_INCLUDE_OUTPUT_DEVICE")) {
    set(
      "sensors.media.includeOutputDevice",
      toBoolean(
        env.PET_LOCAL_MEDIA_INCLUDE_OUTPUT_DEVICE,
        next.sensors.media.includeOutputDevice
      )
    );
  }

  return next;
}

function resolveRuntimeOverridePath({ app, projectRoot } = {}) {
  const root = projectRoot || process.cwd();
  if (app?.isPackaged && app && typeof app.getPath === "function") {
    return path.join(app.getPath("userData"), "settings.json");
  }
  return path.join(root, "config", "settings.local.json");
}

function loadRuntimeSettings({ app, projectRoot, env = process.env } = {}) {
  const root = projectRoot || process.cwd();
  const warnings = [];
  const errors = [];
  const sourceMap = {};

  const baseDefaults = buildDefaultSettings(root);
  let merged = deepClone(baseDefaults);
  const baseConfigPath = path.join(root, "config", "settings.json");
  const localConfigPath = path.join(root, "config", "settings.local.json");
  const packagedSettingsPath =
    app && typeof app.getPath === "function" ? path.join(app.getPath("userData"), "settings.json") : null;

  const baseConfig = safeReadJson(baseConfigPath, warnings, errors);
  if (baseConfig) {
    merged = mergeObjects(merged, baseConfig);
    sourceMap.baseConfig = baseConfigPath;
  }

  if (app?.isPackaged) {
    if (packagedSettingsPath) {
      const packagedConfig = safeReadJson(packagedSettingsPath, warnings, errors);
      if (packagedConfig) {
        merged = mergeObjects(merged, packagedConfig);
        sourceMap.runtimeConfig = packagedSettingsPath;
      }
    }
  } else {
    const localConfig = safeReadJson(localConfigPath, warnings, errors);
    if (localConfig) {
      merged = mergeObjects(merged, localConfig);
      sourceMap.localConfig = localConfigPath;
    }
  }

  merged = applyEnvOverrides(merged, env, sourceMap);
  const normalized = normalizeSettings(merged, {
    projectRoot: root,
    env,
    warnings,
    errors,
  });

  return {
    settings: normalized,
    sourceMap,
    validationWarnings: warnings,
    validationErrors: errors,
    resolvedPaths: resolveWorkspacePaths(normalized),
    files: {
      baseConfigPath,
      localConfigPath,
      packagedSettingsPath,
    },
  };
}

function persistRuntimeSettingsPatch({ app, projectRoot, patch } = {}) {
  const overridePath = resolveRuntimeOverridePath({ app, projectRoot });
  const warnings = [];
  const errors = [];
  const existing = safeReadJson(overridePath, warnings, errors) || {};
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  const next = mergeObjects(existing, patch && typeof patch === "object" ? patch : {});
  fs.mkdirSync(path.dirname(overridePath), { recursive: true });
  fs.writeFileSync(overridePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return {
    overridePath,
    override: next,
  };
}

module.exports = {
  DEFAULT_CHARACTER_HITBOX_SCALE_PERCENT,
  DEFAULT_CHARACTER_SCALE_PERCENT,
  DEFAULT_ROAMING_ZONE,
  KNOWN_ACCESSORY_IDS,
  KNOWN_QUICK_PROP_IDS,
  MAX_CHARACTER_HITBOX_SCALE_PERCENT,
  MAX_CHARACTER_SCALE_PERCENT,
  MIN_CHARACTER_HITBOX_SCALE_PERCENT,
  MIN_CHARACTER_SCALE_PERCENT,
  OPENCLAW_TRANSPORTS,
  ROAMING_MODES,
  isLoopbackEndpoint,
  isWslUncPath,
  persistRuntimeSettingsPatch,
  resolveWorkspacePaths,
  resolveRuntimeOverridePath,
  loadRuntimeSettings,
};
