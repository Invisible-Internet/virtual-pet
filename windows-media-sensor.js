"use strict";

const path = require("path");
const { execFile } = require("child_process");

const LOCAL_MEDIA_SENSOR_BACKENDS = Object.freeze({
  powershell: "powershell",
});

const WINDOWS_MEDIA_SOURCE = "GSMTC";
const DEFAULT_WINDOWS_MEDIA_PROBE_SCRIPT = path.join(
  __dirname,
  "scripts",
  "windows-media-probe.ps1"
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

function buildDefaultLocalMediaSensorSettings() {
  return {
    enabled: true,
    backend: LOCAL_MEDIA_SENSOR_BACKENDS.powershell,
    pollIntervalMs: 2500,
    probeTimeoutMs: 1800,
    includeOutputDevice: true,
  };
}

function normalizeLocalMediaSensorSettings(rawMedia = {}) {
  const defaults = buildDefaultLocalMediaSensorSettings();
  const raw = rawMedia && typeof rawMedia === "object" ? rawMedia : {};
  return {
    enabled: toBoolean(raw.enabled, defaults.enabled),
    backend:
      toOptionalString(raw.backend, defaults.backend) === LOCAL_MEDIA_SENSOR_BACKENDS.powershell
        ? LOCAL_MEDIA_SENSOR_BACKENDS.powershell
        : LOCAL_MEDIA_SENSOR_BACKENDS.powershell,
    pollIntervalMs: toPositiveInteger(raw.pollIntervalMs, defaults.pollIntervalMs, 500),
    probeTimeoutMs: toPositiveInteger(raw.probeTimeoutMs, defaults.probeTimeoutMs, 250),
    includeOutputDevice: toBoolean(raw.includeOutputDevice, defaults.includeOutputDevice),
  };
}

function classifyOutputRoute(input = {}) {
  const explicitRoute = toOptionalString(input.outputRoute, null);
  if (explicitRoute === "speaker" || explicitRoute === "headphones") {
    return explicitRoute;
  }
  const combined = [
    explicitRoute,
    input.outputDeviceType,
    input.outputDeviceName,
    input.routeHint,
  ]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  if (
    combined.includes("headphone") ||
    combined.includes("headset") ||
    combined.includes("earbud") ||
    combined.includes("airpod")
  ) {
    return "headphones";
  }
  if (
    combined.includes("speaker") ||
    combined.includes("stereo") ||
    combined.includes("receiver") ||
    combined.includes("tv") ||
    combined.includes("monitor")
  ) {
    return "speaker";
  }
  return "unknown";
}

function deriveSourceAppLabel(sourceAppUserModelId) {
  const raw = toOptionalString(sourceAppUserModelId, null);
  if (!raw) return "Windows Media";
  const normalized = raw.replace(/\//g, "\\");

  const known = [
    ["spotify", "Spotify"],
    ["msedge", "Microsoft Edge"],
    ["chrome", "Google Chrome"],
    ["firefox", "Firefox"],
    ["vlc", "VLC"],
    ["wmplayer", "Windows Media Player"],
    ["netflix", "Netflix"],
    ["discord", "Discord"],
  ];
  for (const [fragment, label] of known) {
    if (normalized.toLowerCase().includes(fragment)) {
      return label;
    }
  }

  const bangSplit = normalized.split("!");
  const preferred = bangSplit[bangSplit.length - 1];
  const slashSplit = preferred.split(/[\\.:_]/);
  const candidate = slashSplit.find((entry) => entry && entry.trim().length > 0) || preferred;
  const cleaned = candidate.replace(/\.exe$/i, "").replace(/[^a-zA-Z0-9 ]+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : "Windows Media";
}

function deriveMediaProvider(sourceAppUserModelId, sourceAppLabel) {
  const normalized = `${toOptionalString(sourceAppUserModelId, "")} ${toOptionalString(sourceAppLabel, "")}`
    .trim()
    .toLowerCase();
  if (normalized.includes("spotify")) return "spotify";
  if (normalized.includes("msedge")) return "msedge";
  if (normalized.includes("chrome")) return "chrome";
  if (normalized.includes("firefox")) return "firefox";
  if (normalized.includes("vlc")) return "vlc";
  if (normalized.includes("netflix")) return "netflix";
  if (normalized.includes("youtube")) return "youtube";
  return "local_media";
}

function normalizeWindowsMediaProbePayload(value = {}) {
  const input = value && typeof value === "object" ? value : {};
  const playbackStatus = toOptionalString(input.playbackStatus, "Unknown") || "Unknown";
  const sourceAppUserModelId = toOptionalString(input.sourceAppUserModelId, null);
  const sourceAppLabel =
    toOptionalString(input.sourceAppLabel, null) || deriveSourceAppLabel(sourceAppUserModelId);
  const outputDeviceName = toOptionalString(input.outputDeviceName, "unknown_device") || "unknown_device";
  const outputRoute = classifyOutputRoute({
    outputRoute: input.outputRoute,
    outputDeviceType: input.outputDeviceType,
    outputDeviceName,
  });
  return {
    ok: Boolean(input.ok),
    source: WINDOWS_MEDIA_SOURCE,
    isPlaying:
      Boolean(input.isPlaying) ||
      playbackStatus.toLowerCase() === "playing" ||
      playbackStatus.toLowerCase() === "changing",
    playbackStatus,
    title: toOptionalString(input.title, null),
    artist: toOptionalString(input.artist, null),
    album: toOptionalString(input.album, null),
    sourceAppUserModelId,
    sourceAppLabel,
    provider: deriveMediaProvider(sourceAppUserModelId, sourceAppLabel),
    outputDeviceId: toOptionalString(input.outputDeviceId, null),
    outputDeviceName,
    outputDeviceType:
      toOptionalString(input.outputDeviceType, null) ||
      (outputRoute === "unknown" ? "unknown" : outputRoute),
    outputRoute,
    ts: Number.isFinite(Number(input.ts)) ? Number(input.ts) : Date.now(),
    error: toOptionalString(input.error, null),
    raw: input,
  };
}

function buildLocalMediaEventPayload(snapshot = {}) {
  const normalized = normalizeWindowsMediaProbePayload(snapshot);
  return {
    playing: Boolean(normalized.isPlaying),
    confidence: normalized.ok ? 0.96 : 0.6,
    provider: "local_media",
    source: normalized.source,
    title: normalized.title || "",
    artist: normalized.artist || "",
    album: normalized.album || "",
    suggestedState: "MusicChill",
    activeProp:
      normalized.outputRoute === "speaker"
        ? "speaker"
        : normalized.outputRoute === "headphones"
          ? "headphones"
          : "musicNote",
    outputRoute: normalized.outputRoute,
    outputDeviceName: normalized.outputDeviceName,
    outputDeviceType: normalized.outputDeviceType,
    sourceAppLabel: normalized.sourceAppLabel,
    sourceAppUserModelId: normalized.sourceAppUserModelId || "",
  };
}

function buildLocalMediaProbeKey(snapshot = {}) {
  const normalized = normalizeWindowsMediaProbePayload(snapshot);
  return JSON.stringify({
    ok: normalized.ok,
    isPlaying: normalized.isPlaying,
    playbackStatus: normalized.playbackStatus,
    title: normalized.title || "",
    artist: normalized.artist || "",
    album: normalized.album || "",
    provider: normalized.provider,
    sourceAppUserModelId: normalized.sourceAppUserModelId || "",
    outputRoute: normalized.outputRoute,
    outputDeviceName: normalized.outputDeviceName,
  });
}

function buildLocalMediaResponseText(snapshot = {}) {
  const normalized = normalizeWindowsMediaProbePayload(snapshot);
  const routeText =
    normalized.outputRoute === "speaker"
      ? " on speakers"
      : normalized.outputRoute === "headphones"
        ? " on headphones"
        : normalized.outputDeviceName && normalized.outputDeviceName !== "unknown_device"
          ? ` on ${normalized.outputDeviceName}`
          : "";
  if (!normalized.isPlaying) {
    return "Local media playback is idle.";
  }
  if (normalized.title && normalized.artist) {
    return `Local media says ${normalized.title} by ${normalized.artist} is playing from ${normalized.sourceAppLabel}${routeText}.`;
  }
  if (normalized.title) {
    return `Local media says ${normalized.title} is playing from ${normalized.sourceAppLabel}${routeText}.`;
  }
  return `Local media playback detected from ${normalized.sourceAppLabel}${routeText}.`;
}

function summarizeProbeError(error) {
  if (!error) return "unknown_error";
  const stderr = toOptionalString(error.stderr, "");
  const stdout = toOptionalString(error.stdout, "");
  const combined = `${stderr}\n${stdout}\n${error.message || ""}`.toLowerCase();
  if (combined.includes("timed out")) return "probe_timeout";
  if (combined.includes("cannot find path")) return "probe_script_missing";
  if (combined.includes("access is denied")) return "access_denied";
  return "probe_failed";
}

async function probeWindowsMediaState(options = {}) {
  const settings = normalizeLocalMediaSensorSettings(options.settings);
  if (process.platform !== "win32") {
    return normalizeWindowsMediaProbePayload({
      ok: false,
      isPlaying: false,
      playbackStatus: "UnsupportedPlatform",
      sourceAppLabel: "Windows Media",
      outputDeviceName: "unknown_device",
      outputDeviceType: "unknown",
      error: "unsupported_platform",
      ts: Date.now(),
    });
  }
  if (!settings.enabled) {
    return normalizeWindowsMediaProbePayload({
      ok: false,
      isPlaying: false,
      playbackStatus: "Disabled",
      sourceAppLabel: "Windows Media",
      outputDeviceName: "unknown_device",
      outputDeviceType: "unknown",
      error: "disabled_by_config",
      ts: Date.now(),
    });
  }

  const scriptPath = options.scriptPath || DEFAULT_WINDOWS_MEDIA_PROBE_SCRIPT;
  const args = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
  ];
  if (!settings.includeOutputDevice) {
    args.push("-SkipOutputDevice");
  }

  try {
    const result = await execFileAsync("powershell.exe", args, {
      timeout: settings.probeTimeoutMs,
      windowsHide: true,
      cwd: path.dirname(scriptPath),
      maxBuffer: 1024 * 1024,
    });
    const parsed = JSON.parse(toOptionalString(result.stdout, "{}") || "{}");
    return normalizeWindowsMediaProbePayload(parsed);
  } catch (error) {
    return normalizeWindowsMediaProbePayload({
      ok: false,
      isPlaying: false,
      playbackStatus: "Error",
      sourceAppLabel: "Windows Media",
      outputDeviceName: "unknown_device",
      outputDeviceType: "unknown",
      error: summarizeProbeError(error),
      ts: Date.now(),
    });
  }
}

module.exports = {
  LOCAL_MEDIA_SENSOR_BACKENDS,
  WINDOWS_MEDIA_SOURCE,
  buildDefaultLocalMediaSensorSettings,
  normalizeLocalMediaSensorSettings,
  classifyOutputRoute,
  deriveSourceAppLabel,
  deriveMediaProvider,
  normalizeWindowsMediaProbePayload,
  buildLocalMediaEventPayload,
  buildLocalMediaProbeKey,
  buildLocalMediaResponseText,
  probeWindowsMediaState,
};
