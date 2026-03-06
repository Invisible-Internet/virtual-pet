"use strict";

const fs = require("fs");
const path = require("path");
const {
  DEFAULT_CHARACTER_SCALE_PERCENT,
  MAX_CHARACTER_SCALE_PERCENT,
  MIN_CHARACTER_SCALE_PERCENT,
  resolveRuntimeOverridePath,
} = require("./settings-runtime");

const SHELL_SETTINGS_FIELDS = Object.freeze([
  Object.freeze({
    key: "openclaw.enabled",
    label: "OpenClaw Service",
    description: "Turn OpenClaw bridge usage on or off.",
    kind: "boolean",
    defaultValue: true,
  }),
  Object.freeze({
    key: "openclaw.transport",
    label: "OpenClaw Transport",
    description: "Choose bridge transport mode.",
    kind: "enum",
    options: Object.freeze(["ws", "http", "stub"]),
    defaultValue: "ws",
  }),
  Object.freeze({
    key: "openclaw.baseUrl",
    label: "OpenClaw Base URL",
    description: "Bridge endpoint URL for OpenClaw gateway.",
    kind: "text",
    allowEmpty: false,
    format: "url",
    maxLength: 512,
    defaultValue: "ws://127.0.0.1:18789",
  }),
  Object.freeze({
    key: "openclaw.allowNonLoopback",
    label: "Allow Non-Loopback Endpoint",
    description: "Allow remote/VPS OpenClaw endpoint hosts.",
    kind: "boolean",
    defaultValue: false,
  }),
  Object.freeze({
    key: "openclaw.authTokenRef",
    label: "OpenClaw Auth Token Ref",
    description: "Environment variable name that stores the OpenClaw auth token.",
    kind: "text",
    allowEmpty: true,
    format: "env_ref",
    maxLength: 128,
    defaultValue: "PET_OPENCLAW_AUTH_TOKEN",
  }),
  Object.freeze({
    key: "openclaw.petCommandSharedSecretRef",
    label: "Pet Command Secret Ref",
    description: "Environment variable name for the pet-command shared secret.",
    kind: "text",
    allowEmpty: true,
    format: "env_ref",
    maxLength: 128,
    defaultValue: "PET_OPENCLAW_PET_COMMAND_SECRET",
  }),
  Object.freeze({
    key: "openclaw.petCommandKeyId",
    label: "Pet Command Key ID",
    description: "Key identifier used for signed pet command requests.",
    kind: "text",
    allowEmpty: false,
    format: "token_id",
    maxLength: 64,
    defaultValue: "local-default",
  }),
  Object.freeze({
    key: "integrations.spotify.enabled",
    label: "Spotify Integration",
    description: "Allow Spotify integration checks and responses.",
    kind: "boolean",
    defaultValue: true,
  }),
  Object.freeze({
    key: "integrations.spotify.backgroundEnrichmentEnabled",
    label: "Spotify Background Enrichment",
    description: "Allow background Spotify enrichment polling.",
    kind: "boolean",
    defaultValue: true,
  }),
  Object.freeze({
    key: "integrations.freshRss.enabled",
    label: "FreshRSS Integration",
    description: "Allow FreshRSS integration checks and responses.",
    kind: "boolean",
    defaultValue: true,
  }),
  Object.freeze({
    key: "integrations.freshRss.backgroundEnrichmentEnabled",
    label: "FreshRSS Background Enrichment",
    description: "Allow background FreshRSS enrichment polling.",
    kind: "boolean",
    defaultValue: true,
  }),
  Object.freeze({
    key: "sensors.media.enabled",
    label: "Local Media Sensor",
    description: "Enable local media playback sensing.",
    kind: "boolean",
    defaultValue: true,
  }),
  Object.freeze({
    key: "ui.diagnosticsEnabled",
    label: "Diagnostics Overlay",
    description: "Enable diagnostics logs and renderer overlay.",
    kind: "boolean",
    defaultValue: false,
  }),
  Object.freeze({
    key: "dialog.alwaysShowBubble",
    label: "Always Show Bubble",
    description: "Keep speech bubble visible while idle.",
    kind: "boolean",
    defaultValue: true,
  }),
  Object.freeze({
    key: "ui.characterScalePercent",
    label: "Character Scale (0-1)",
    description:
      "0 = half size, 0.5 = default size, 1 = double size. Tick labels are shown as 0/25/50/75/100.",
    kind: "integer",
    min: MIN_CHARACTER_SCALE_PERCENT,
    max: MAX_CHARACTER_SCALE_PERCENT,
    defaultValue: DEFAULT_CHARACTER_SCALE_PERCENT,
  }),
]);

const SHELL_SETTINGS_FIELD_MAP = new Map(SHELL_SETTINGS_FIELDS.map((field) => [field.key, field]));

function toOptionalString(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function safeReadJson(filePath) {
  const normalizedPath = toOptionalString(filePath, null);
  if (!normalizedPath || !fs.existsSync(normalizedPath)) {
    return {
      ok: true,
      value: {},
      filePath: normalizedPath,
      missing: true,
    };
  }
  try {
    const raw = fs.readFileSync(normalizedPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ok: true,
      value: parsed && typeof parsed === "object" ? parsed : {},
      filePath: normalizedPath,
      missing: false,
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || String(error),
      value: {},
      filePath: normalizedPath,
      missing: false,
    };
  }
}

function getPathValue(source, key) {
  if (!source || typeof source !== "object") return undefined;
  const segments = String(key || "").split(".");
  let cursor = source;
  for (const segment of segments) {
    if (!segment || !cursor || typeof cursor !== "object") return undefined;
    if (!Object.prototype.hasOwnProperty.call(cursor, segment)) return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

function hasPathValue(source, key) {
  if (!source || typeof source !== "object") return false;
  const segments = String(key || "").split(".");
  let cursor = source;
  for (const segment of segments) {
    if (!segment || !cursor || typeof cursor !== "object") return false;
    if (!Object.prototype.hasOwnProperty.call(cursor, segment)) return false;
    cursor = cursor[segment];
  }
  return true;
}

function setPathValue(target, key, value) {
  const segments = String(key || "").split(".");
  if (!target || typeof target !== "object" || segments.length <= 0) return target;
  let cursor = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!segment) return target;
    if (!cursor[segment] || typeof cursor[segment] !== "object" || Array.isArray(cursor[segment])) {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  }
  const leaf = segments[segments.length - 1];
  if (!leaf) return target;
  cursor[leaf] = value;
  return target;
}

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return { ok: true, value };
  }
  if (typeof value === "number" && (value === 0 || value === 1)) {
    return { ok: true, value: value === 1 };
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
      return { ok: true, value: true };
    }
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
      return { ok: true, value: false };
    }
  }
  return { ok: false, reason: "invalid_boolean" };
}

function parseInteger(value) {
  if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)) {
    return { ok: true, value };
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return { ok: false, reason: "invalid_integer" };
    if (!/^-?\d+$/.test(trimmed)) return { ok: false, reason: "invalid_integer" };
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return { ok: true, value: parsed };
    }
  }
  return { ok: false, reason: "invalid_integer" };
}

function parseText(value) {
  if (typeof value === "string") {
    return { ok: true, value: value.trim() };
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return { ok: true, value: String(value).trim() };
  }
  return { ok: false, reason: "invalid_text" };
}

function parseEnum(field, value) {
  const text = parseText(value);
  if (!text.ok) return { ok: false, reason: "invalid_enum_value" };
  const options = Array.isArray(field?.options) ? field.options : [];
  if (options.includes(text.value)) {
    return { ok: true, value: text.value };
  }
  return { ok: false, reason: "invalid_enum_value" };
}

function validateTextFormat(field, value) {
  const maxLength = Number.isFinite(Number(field?.maxLength))
    ? Math.max(1, Math.round(Number(field.maxLength)))
    : 256;
  if (value.length > maxLength) {
    return {
      ok: false,
      reason: "text_too_long",
      maxLength,
    };
  }
  const allowEmpty = field?.allowEmpty === true;
  if (!allowEmpty && value.length <= 0) {
    return {
      ok: false,
      reason: "text_required",
    };
  }
  const format = toOptionalString(field?.format, null);
  if (!format || value.length <= 0) {
    return {
      ok: true,
      value,
      maxLength,
      format,
    };
  }
  if (format === "url") {
    try {
      // eslint-disable-next-line no-new
      new URL(value);
    } catch {
      return {
        ok: false,
        reason: "invalid_url",
      };
    }
    return {
      ok: true,
      value,
      maxLength,
      format,
    };
  }
  if (format === "env_ref") {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      return {
        ok: false,
        reason: "invalid_env_ref",
      };
    }
    return {
      ok: true,
      value,
      maxLength,
      format,
    };
  }
  if (format === "token_id") {
    if (!/^[A-Za-z0-9._-]+$/.test(value)) {
      return {
        ok: false,
        reason: "invalid_token_id",
      };
    }
    return {
      ok: true,
      value,
      maxLength,
      format,
    };
  }
  return {
    ok: true,
    value,
    maxLength,
    format,
  };
}

function normalizeFieldValue(field, rawValue) {
  if (field.kind === "boolean") {
    const parsed = parseBoolean(rawValue);
    if (parsed.ok) return parsed.value;
    return Boolean(field.defaultValue);
  }
  if (field.kind === "integer") {
    const parsed = parseInteger(rawValue);
    if (!parsed.ok) return Number(field.defaultValue);
    return Math.min(field.max, Math.max(field.min, parsed.value));
  }
  if (field.kind === "text") {
    const parsed = parseText(rawValue);
    const candidate = parsed.ok ? parsed.value : toOptionalString(field.defaultValue, "");
    const validated = validateTextFormat(field, candidate);
    if (validated.ok) return validated.value;
    return toOptionalString(field.defaultValue, "");
  }
  if (field.kind === "enum") {
    const parsed = parseEnum(field, rawValue);
    if (parsed.ok) return parsed.value;
    return toOptionalString(field.defaultValue, "");
  }
  return rawValue;
}

function validateFieldValue(field, rawValue) {
  if (field.kind === "boolean") {
    const parsed = parseBoolean(rawValue);
    if (!parsed.ok) {
      return {
        ok: false,
        reason: parsed.reason || "invalid_boolean",
      };
    }
    return {
      ok: true,
      value: parsed.value,
    };
  }
  if (field.kind === "integer") {
    const parsed = parseInteger(rawValue);
    if (!parsed.ok) {
      return {
        ok: false,
        reason: parsed.reason || "invalid_integer",
      };
    }
    if (parsed.value < field.min || parsed.value > field.max) {
      return {
        ok: false,
        reason: "out_of_range",
        min: field.min,
        max: field.max,
      };
    }
    return {
      ok: true,
      value: parsed.value,
    };
  }
  if (field.kind === "text") {
    const parsed = parseText(rawValue);
    if (!parsed.ok) {
      return {
        ok: false,
        reason: parsed.reason || "invalid_text",
      };
    }
    const validated = validateTextFormat(field, parsed.value);
    if (!validated.ok) {
      return {
        ok: false,
        reason: validated.reason || "invalid_text",
        maxLength: validated.maxLength,
      };
    }
    return {
      ok: true,
      value: validated.value,
    };
  }
  if (field.kind === "enum") {
    const parsed = parseEnum(field, rawValue);
    if (!parsed.ok) {
      return {
        ok: false,
        reason: parsed.reason || "invalid_enum_value",
      };
    }
    return {
      ok: true,
      value: parsed.value,
    };
  }
  return {
    ok: false,
    reason: "unsupported_field_type",
  };
}

function normalizePatchInput(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return {};
  return patch;
}

function getFieldSource({
  fieldKey,
  settingsSourceMap,
  inOverride,
  inBase,
  app,
}) {
  const sourceValue =
    settingsSourceMap && typeof settingsSourceMap === "object"
      ? settingsSourceMap[fieldKey]
      : null;
  if (toOptionalString(sourceValue, "") === "env") return "env";
  if (inOverride) {
    return app?.isPackaged ? "runtime" : "local";
  }
  if (inBase) return "base";
  return "base";
}

function buildShellSettingsSnapshot({
  app,
  projectRoot = process.cwd(),
  settingsSummary = {},
  settingsSourceMap = {},
  settingsFiles = {},
  ts = Date.now(),
} = {}) {
  const overridePath = resolveRuntimeOverridePath({ app, projectRoot });
  const baseConfigPath =
    toOptionalString(settingsFiles?.baseConfigPath, null) ||
    path.join(projectRoot, "config", "settings.json");
  const overrideRead = safeReadJson(overridePath);
  const baseRead = safeReadJson(baseConfigPath);
  const warnings = [];
  if (!overrideRead.ok) {
    warnings.push(`[settings-editor] failed to parse override config: ${overrideRead.error}`);
  }
  if (!baseRead.ok) {
    warnings.push(`[settings-editor] failed to parse base config: ${baseRead.error}`);
  }

  const overrideConfig = overrideRead.value && typeof overrideRead.value === "object" ? overrideRead.value : {};
  const baseConfig = baseRead.value && typeof baseRead.value === "object" ? baseRead.value : {};
  const fields = SHELL_SETTINGS_FIELDS.map((field) => {
    const inOverride = hasPathValue(overrideConfig, field.key);
    const inBase = hasPathValue(baseConfig, field.key);
    const persistedCandidate = inOverride
      ? getPathValue(overrideConfig, field.key)
      : inBase
        ? getPathValue(baseConfig, field.key)
        : field.defaultValue;
    const effectiveCandidate = getPathValue(settingsSummary, field.key);
    const value = normalizeFieldValue(field, persistedCandidate);
    const effectiveValue = normalizeFieldValue(field, effectiveCandidate);
    const source = getFieldSource({
      fieldKey: field.key,
      settingsSourceMap,
      inOverride,
      inBase,
      app,
    });
    return {
      key: field.key,
      label: field.label,
      description: field.description,
      kind: field.kind,
      editable: true,
      value,
      effectiveValue,
      source,
      envOverridden: source === "env",
      validation:
        field.kind === "integer"
          ? {
              kind: "integer",
              min: field.min,
              max: field.max,
            }
          : field.kind === "enum"
            ? {
                kind: "enum",
                options: Array.isArray(field.options) ? [...field.options] : [],
              }
            : field.kind === "text"
              ? {
                  kind: "text",
                  maxLength: Number.isFinite(Number(field.maxLength))
                    ? Math.max(1, Math.round(Number(field.maxLength)))
                    : 256,
                  format: toOptionalString(field.format, null),
                }
              : {
                  kind: "boolean",
                },
    };
  });

  return {
    kind: "shellSettingsSnapshot",
    ts,
    overridePath,
    fields,
    warnings,
  };
}

function validateShellSettingsPatch({ patch } = {}) {
  const input = normalizePatchInput(patch);
  const accepted = [];
  const rejected = [];
  const normalizedPatch = {};

  for (const [key, rawValue] of Object.entries(input)) {
    const field = SHELL_SETTINGS_FIELD_MAP.get(key);
    if (!field) {
      rejected.push({
        key,
        reason: "blocked_key",
      });
      continue;
    }
    const validated = validateFieldValue(field, rawValue);
    if (!validated.ok) {
      rejected.push({
        key,
        reason: validated.reason,
        min: validated.min,
        max: validated.max,
      });
      continue;
    }
    accepted.push({
      key,
      value: validated.value,
    });
    setPathValue(normalizedPatch, key, validated.value);
  }

  return {
    accepted,
    rejected,
    normalizedPatch,
  };
}

module.exports = {
  SHELL_SETTINGS_FIELDS,
  buildShellSettingsSnapshot,
  validateShellSettingsPatch,
};
