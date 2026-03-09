"use strict";

const path = require("path");
const { execFile } = require("child_process");

const FOREGROUND_WINDOW_SENSOR_BACKENDS = Object.freeze({
  powershell: "powershell",
});

const WINDOWS_FOREGROUND_WINDOW_SOURCE = "WIN32_FOREGROUND_WINDOW";
const DEFAULT_FOREGROUND_WINDOW_PROBE_SCRIPT = path.join(
  __dirname,
  "scripts",
  "foreground-window-probe.ps1"
);

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

function toOptionalInteger(value, fallback = null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.round(numeric);
}

function execFileAsync(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        const nextError = error;
        nextError.stdout = stdout;
        nextError.stderr = stderr;
        reject(nextError);
        return;
      }
      resolve({
        stdout,
        stderr,
      });
    });
  });
}

function buildDefaultForegroundWindowSensorSettings() {
  return {
    enabled: true,
    backend: FOREGROUND_WINDOW_SENSOR_BACKENDS.powershell,
    pollIntervalMs: 250,
    probeTimeoutMs: 800,
  };
}

function normalizeForegroundWindowSensorSettings(rawSettings = {}) {
  const defaults = buildDefaultForegroundWindowSensorSettings();
  const raw = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
  return {
    enabled: toBoolean(raw.enabled, defaults.enabled),
    backend:
      toOptionalString(raw.backend, defaults.backend) === FOREGROUND_WINDOW_SENSOR_BACKENDS.powershell
        ? FOREGROUND_WINDOW_SENSOR_BACKENDS.powershell
        : FOREGROUND_WINDOW_SENSOR_BACKENDS.powershell,
    pollIntervalMs: toPositiveInteger(raw.pollIntervalMs, defaults.pollIntervalMs, 100),
    probeTimeoutMs: toPositiveInteger(raw.probeTimeoutMs, defaults.probeTimeoutMs, 100),
  };
}

function normalizeBounds(rawBounds = null) {
  if (!rawBounds || typeof rawBounds !== "object") return null;
  const x = Number(rawBounds.x);
  const y = Number(rawBounds.y);
  const width = Number(rawBounds.width);
  const height = Number(rawBounds.height);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  if (width <= 0 || height <= 0) return null;
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function normalizeForegroundWindowProbePayload(value = {}) {
  const input = value && typeof value === "object" ? value : {};
  const windowId = toOptionalString(input.windowId, null);
  const bounds = normalizeBounds(input.bounds);
  const processId = toOptionalInteger(input.processId, null);
  const processName = toOptionalString(input.processName, null);
  const title = toOptionalString(input.title, null);
  const source = toOptionalString(input.source, WINDOWS_FOREGROUND_WINDOW_SOURCE);
  const error = toOptionalString(input.error, null);
  const ts = Number.isFinite(Number(input.ts)) ? Math.round(Number(input.ts)) : Date.now();
  const ok = Boolean(input.ok) && Boolean(windowId) && Boolean(bounds);

  return {
    ok,
    source,
    windowId: windowId || null,
    bounds,
    processId: Number.isFinite(processId) ? processId : null,
    processName,
    title,
    ts,
    error: ok ? null : error || "invalid_probe_payload",
    raw: input,
  };
}

function buildForegroundWindowProbeKey(snapshot = {}) {
  const normalized = normalizeForegroundWindowProbePayload(snapshot);
  return JSON.stringify({
    ok: normalized.ok,
    windowId: normalized.windowId || "",
    processId: Number.isFinite(normalized.processId) ? normalized.processId : 0,
    bounds: normalized.bounds || null,
    error: normalized.error || "none",
  });
}

function summarizeProbeError(error) {
  if (!error) return "probe_failed";
  const stderr = toOptionalString(error.stderr, "");
  const stdout = toOptionalString(error.stdout, "");
  const combined = `${stderr}\n${stdout}\n${error.message || ""}`.toLowerCase();
  if (combined.includes("timed out")) return "probe_timeout";
  if (combined.includes("cannot find path")) return "probe_script_missing";
  if (combined.includes("access is denied")) return "access_denied";
  if (combined.includes("foreground_window_unavailable")) return "foreground_window_unavailable";
  if (combined.includes("foreground_window_invalid_bounds")) return "foreground_window_invalid_bounds";
  return "probe_failed";
}

async function probeForegroundWindowState(options = {}) {
  const settings = normalizeForegroundWindowSensorSettings(options.settings);
  if (process.platform !== "win32") {
    return normalizeForegroundWindowProbePayload({
      ok: false,
      source: WINDOWS_FOREGROUND_WINDOW_SOURCE,
      error: "unsupported_platform",
      ts: Date.now(),
    });
  }
  if (!settings.enabled) {
    return normalizeForegroundWindowProbePayload({
      ok: false,
      source: WINDOWS_FOREGROUND_WINDOW_SOURCE,
      error: "disabled_by_config",
      ts: Date.now(),
    });
  }

  const scriptPath = options.scriptPath || DEFAULT_FOREGROUND_WINDOW_PROBE_SCRIPT;
  const args = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
  ];

  try {
    const result = await execFileAsync("powershell.exe", args, {
      timeout: settings.probeTimeoutMs,
      windowsHide: true,
      cwd: path.dirname(scriptPath),
      maxBuffer: 1024 * 1024,
    });
    const parsed = JSON.parse(toOptionalString(result.stdout, "{}") || "{}");
    return normalizeForegroundWindowProbePayload(parsed);
  } catch (error) {
    return normalizeForegroundWindowProbePayload({
      ok: false,
      source: WINDOWS_FOREGROUND_WINDOW_SOURCE,
      error: summarizeProbeError(error),
      ts: Date.now(),
    });
  }
}

module.exports = {
  DEFAULT_FOREGROUND_WINDOW_PROBE_SCRIPT,
  FOREGROUND_WINDOW_SENSOR_BACKENDS,
  WINDOWS_FOREGROUND_WINDOW_SOURCE,
  buildDefaultForegroundWindowSensorSettings,
  normalizeForegroundWindowProbePayload,
  normalizeForegroundWindowSensorSettings,
  buildForegroundWindowProbeKey,
  probeForegroundWindowState,
  summarizeProbeError,
};
