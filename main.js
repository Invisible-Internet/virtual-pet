const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } = require("electron");
const fs = require("fs");
const path = require("path");
const { CAPABILITY_STATES, createCapabilityRegistry } = require("./capability-registry");
const { createExtensionPackRegistry, DEFAULT_EXTENSIONS_ROOT } = require("./extension-pack-registry");
const { createPetContractRouter } = require("./pet-contract-router");
const {
  BRIDGE_MODES,
  BRIDGE_TRANSPORTS,
  createOpenClawBridge,
  requestWithTimeout,
} = require("./openclaw-bridge");
const {
  DEFAULT_DIALOG_TEMPLATES_PATH,
  buildOfflineDialogResponse,
  classifyOfflineDialogTrigger,
  createDefaultDialogTemplateCatalog,
  loadDialogTemplateCatalog,
} = require("./dialog-runtime");
const {
  DEFAULT_OPENCLAW_AGENT_ID,
  DEFAULT_OPENCLAW_AGENT_TIMEOUT_MS,
  buildSpotifyNowPlayingPrompt,
  buildSpotifyTopArtistPrompt,
  buildFreshRssPrompt,
  runOpenClawAgentPrompt,
  parseJsonPayload,
  detectAgentFailure,
  normalizeSpotifyNowPlayingPayload,
  normalizeSpotifyTopArtistPayload,
  normalizeFreshRssPayload,
  detectFreshRssPayloadFailure,
} = require("./openclaw-agent-probe");
const {
  INTEGRATION_TRANSPORTS,
  deriveIntegrationCapabilityState,
  createTrackRatingObservation,
} = require("./integration-runtime");
const {
  WINDOWS_MEDIA_SOURCE,
  buildLocalMediaEventPayload,
  buildLocalMediaProbeKey,
  buildLocalMediaResponseText,
  probeWindowsMediaState,
} = require("./windows-media-sensor");
const {
  MEMORY_ADAPTER_MODES,
  OPENCLAW_WORKSPACE_BOOTSTRAP_MODES,
  createMemoryPipeline,
} = require("./memory-pipeline");
const { DEFAULT_STATE_CATALOG_PATH, createStateRuntime } = require("./state-runtime");
const {
  DEFAULT_ROAMING_ZONE,
  loadRuntimeSettings,
  persistRuntimeSettingsPatch,
  ROAMING_MODES,
} = require("./settings-runtime");
const { BASE_LAYOUT, computePetLayout } = require("./pet-layout");
const {
  normalizePetBounds,
  clampWindowPosition,
  createDragClampLatch,
  applyDragClampHysteresis,
} = require("./main-clamp");
const {
  SHELL_WINDOW_TABS,
  buildObservabilitySnapshot,
  normalizeShellWindowTab,
  resolveShellWindowTabForAction,
} = require("./shell-observability");

// Master diagnostics toggle: controls console logs, file logs, and renderer overlay.
let DIAGNOSTICS_ENABLED = false;
const CLAMP_TO_WORK_AREA = true;
const DRAG_LOG_SAMPLE_EVERY = 8;
const MAX_LOG_FILE_BYTES = 5 * 1024 * 1024;
const VELOCITY_SAMPLE_WINDOW_MS = 120;
const MAX_DRAG_SAMPLES = 12;
const CURSOR_EMIT_INTERVAL_MS = 33;
const PET_BOUNDS_STALE_MS = 250;
const DRAG_CLAMP_HYSTERESIS_PX = 2;
const MOTION_POSITION_EPSILON = 0.25;
const MOTION_VELOCITY_EPSILON = 0.5;
const CHARACTER_ASSETS_ROOT = path.join(__dirname, "assets", "characters");
const DEFAULT_CHARACTER_ID = "girl";
const INVENTORY_WINDOW_SIZE = Object.freeze({
  width: 520,
  height: 560,
});
const INVENTORY_WINDOW_MIN_SIZE = Object.freeze({
  width: 460,
  height: 420,
});
const PROP_WINDOW_SPECS = Object.freeze({
  poolRing: Object.freeze({
    propId: "poolRing",
    label: "Pool Ring",
    windowSize: Object.freeze({
      width: 196,
      height: 176,
    }),
    visualBounds: Object.freeze({
      x: 20,
      y: 20,
      width: 156,
      height: 112,
    }),
  }),
});
const TRAY_ICON_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAMcSURBVFhH7VdLaFNBFO3SnZ/3QguCqb6XWPzQotRmpmJDxQ9qRS1+KgWrYiutlhgQA35BURBFCoK6KIIKdSEGxCLSRd2ULupCRCy6iRt1IwR0Ia5GzsQX37t3krwEu/PAWbzMzDl35t75pK7uP2pEJCZbLKc96RHftM8/RTTaMS8Sk32WK8csV/y0XalKMGu58vj8aMcCqlEzIGi58qvBrAxF3nYTKQRO9UIDs7AdMc3Fq6AjZ+uXtzVS7YrAINuVOSZYE0UedUI9SkLPvIL5UtmtmncPFRnr6GF9WBBx0US9GJCzcsu+Zl9aDY1/VBffK8bhiU9qff8VNsbHXMXiROEYBqrFzZvV/tvjzNTEw4+m1ZLWLqYBWo68RT2LwOxN1Q6x9KsvzKgcMzM/jGnBFo5EWxuotwa2Gx0AHrw7wQzCcCD7jmlpOvIa9dawXPmCdhZHLgRET01+VsMvc8ysVNuWM3dMAcxSb135phPOv/SDzz+ohY1rNXtHJwNGpdqQCqoJsh2xyG1P0E7Iod8Ewp7JnhtPQrcZa8ERuwIB4AfaaV1vJiAE7h15pg3OvfkVug1ppNrYbcEADAWYPHGdmdTCbedHWQCWIy4FArCXiQO0Ey3AWomJUG3LFZlAADiraadV248xsVrYtOkQCwATDgSAw4F1cqWuYk8IlY6tRg38RP77Hk4FvutXJJkuij4QAGC6A5A/z7xhZVJF27rUwNO3zBjMzHxXLd0n9U5AQeI3HN9UE6ct9dZAYdDOiB6XD8TjnT3FrbZ6Z7/aevaeOvr4ta78DYNXlR0Xug2BIuDTU9/0HUI1bVfcp94aSIPpMEIOsZQIAqaekYlYAZhj9rg5qRZY9v2I24oOAFGQuG4hjJlhiTtTN/VKYPYIzDuG0V7KHG9G6hlAYRX4jQgiHTsuP2C59xM5Ny974SZkR7AJqFBTKvzEK2hjekQXKS4cfJuqPUC69coBnSsFUQ3ZyRcGhcMJz2suGJZ6EtXMnOJPTYxR4ZDMhsp5GGDrYP+WKtC/FHn976maZ3i1KLwdEink1WPhew5N5wq/AcDTFGocRNoxAAAAAElFTkSuQmCC";
const ROAM_STEP_INTERVAL_MS = 16;
const ROAM_INITIAL_DELAY_MIN_MS = 1200;
const ROAM_INITIAL_DELAY_MAX_MS = 2400;
const ROAM_REST_MIN_MS = 2200;
const ROAM_REST_MAX_MS = 6200;
const ROAM_TARGET_MIN_DISTANCE_PX = 120;
const ROAM_TARGET_RETRY_COUNT = 10;
const ROAM_ARRIVAL_THRESHOLD_PX = 3;
const ROAM_WALK_SPEED_PX_PER_SEC = 88;
const ROAM_RUN_SPEED_PX_PER_SEC = 224;
const ROAM_RUN_DISTANCE_THRESHOLD_PX = 360;
const ROAM_ZONE_ENTRY_DELAY_MS = 140;
const MIN_ROAM_ZONE_RECT_SIZE = 120;
const ROAM_ZONE_INSET_RATIO = 0.22;
const ROAM_DIAGONAL_DIRECTION_RATIO = 0.18;
const REQUIRED_SPRITE_DIRECTIONS = Object.freeze([
  "Down",
  "DownRight",
  "Right",
  "UpRight",
  "Up",
  "UpLeft",
  "Left",
  "DownLeft",
]);
const REQUIRED_SPRITE_STATES = Object.freeze([
  "IdleReady",
  "Walk",
  "Run",
  "Jump",
  "RunningJump",
  "Roll",
  "Grabbed",
]);

const FLING_PRESETS = Object.freeze({
  default: Object.freeze({
    enabled: true,
    minSpeedPxS: 120,
    maxSpeedPxS: 3600,
    dampingPerSec: 2.2,
    bounceRestitution: 0.78,
    stopSpeedPxS: 12,
    stepMs: 8,
  }),
  floaty: Object.freeze({
    enabled: true,
    minSpeedPxS: 70,
    maxSpeedPxS: 5200,
    dampingPerSec: 1.0,
    bounceRestitution: 0.9,
    stopSpeedPxS: 6,
    stepMs: 8,
  }),
  heavy: Object.freeze({
    enabled: true,
    minSpeedPxS: 220,
    maxSpeedPxS: 2000,
    dampingPerSec: 6.4,
    bounceRestitution: 0.35,
    stopSpeedPxS: 28,
    stepMs: 8,
  }),
  off: Object.freeze({
    enabled: false,
    minSpeedPxS: 0,
    maxSpeedPxS: 0,
    dampingPerSec: 0,
    bounceRestitution: 0,
    stopSpeedPxS: 0,
    stepMs: 16,
  }),
});

// Set this to one of: default, floaty, heavy, off
const FLING_PRESET = "default";
const ACTIVE_FLING_PRESET = Object.prototype.hasOwnProperty.call(FLING_PRESETS, FLING_PRESET)
  ? FLING_PRESET
  : "default";
const FLING_CONFIG = FLING_PRESETS[ACTIVE_FLING_PRESET];
const CAPABILITY_CONTRACT_VERSION = "1.0";
const DIALOG_HISTORY_LIMIT = 24;
const DIALOG_TALK_FEEDBACK_MODE = "bubble_pulse";
const STATE_CATALOG_PATH = DEFAULT_STATE_CATALOG_PATH;
const CAPABILITY_IDS = Object.freeze({
  renderer: "renderer",
  brain: "brain",
  sensors: "sensors",
  openclawBridge: "openclawBridge",
  spotifyIntegration: "spotifyIntegration",
  freshRssIntegration: "freshRssIntegration",
  extensionRegistry: "extensionRegistry",
  permissionManager: "permissionManager",
  behaviorArbitrator: "behaviorArbitrator",
  propWorld: "propWorld",
});
const CAPABILITY_TEST_FLAGS = Object.freeze({
  sensorsFail: process.env.PET_FORCE_SENSORS_FAIL === "1",
  openclawFail: process.env.PET_FORCE_OPENCLAW_FAIL === "1",
});
const SHELL_ACTIONS = Object.freeze({
  openInventory: "open-inventory",
  openStatus: "open-status",
  roamDesktop: "roam-desktop",
  roamZone: "roam-zone",
  selectRoamZone: "select-roam-zone",
  toggleDiagnostics: "toggle-diagnostics",
  toggleHeadphones: "toggle-headphones",
  togglePoolRing: "toggle-pool-ring",
  toggleAlwaysShowBubble: "toggle-always-show-bubble",
});
const SHELL_ACCESSORY_IDS = Object.freeze({
  headphones: "headphones",
});
const SHELL_QUICK_PROP_IDS = Object.freeze({
  poolRing: "poolRing",
});
const EXTENSION_TEST_FLAGS = Object.freeze({
  disableAll: process.env.PET_DISABLE_EXTENSIONS === "1",
});

let win;
let dragging = false;
let dragOffset = { x: 0, y: 0 };
let dragDisplayId = null;
let dragTick = 0;
let dragSamples = [];
let flingTick = 0;
let logLineCount = 0;
let diagnosticsLogStream = null;
let physicsTimer = null;
let lastMotionSample = null;
let cursorTimer = null;
let localMediaPollTimer = null;
let freshRssPollTimer = null;
let dragClampLatch = createDragClampLatch();
let activePetBoundsUpdatedAtMs = 0;
let lastMotionPayload = null;
let capabilityRegistry = null;
let latestCapabilitySnapshot = null;
let extensionPackRegistry = null;
let latestExtensionSnapshot = null;
let contractRouter = null;
let latestContractTrace = null;
let dialogTemplateCatalog = createDefaultDialogTemplateCatalog();
let dialogHistory = [];
let openclawBridge = null;
let memoryPipeline = null;
let latestMemorySnapshot = null;
let latestIntegrationEvent = null;
let stateRuntime = null;
let latestStateSnapshot = null;
let integrationProbeStates = {
  spotify: createInitialIntegrationProbeState(),
  freshRss: createInitialIntegrationProbeState(),
};
let runtimeSettings = null;
let runtimeSettingsSourceMap = {};
let runtimeSettingsValidationWarnings = [];
let runtimeSettingsValidationErrors = [];
let runtimeSettingsResolvedPaths = null;
let runtimeSettingsFiles = null;
let latestLocalMediaSnapshot = null;
let lastLocalMediaEventKey = null;
let localMediaProbeInFlight = false;
let spotifyBackgroundProbeInFlight = false;
let freshRssBackgroundProbeInFlight = false;
let lastSpotifyBackgroundProbeAt = 0;
let shellTray = null;
let latestShellState = null;
let shellTraySupported = true;
let shellTrayError = null;
let inventoryWin = null;
let inventoryWindowActiveTab = SHELL_WINDOW_TABS.inventory;
let zoneSelectorWin = null;
let roamTimer = null;
let appIsQuitting = false;
const propWindows = new Map();

const flingState = {
  active: false,
  vx: 0,
  vy: 0,
  lastStepMs: 0,
  x: 0,
  y: 0,
};
const roamState = {
  phase: "idle",
  destination: null,
  queuedDestination: null,
  roamBounds: null,
  petBounds: null,
  speedPxPerSec: 0,
  clip: "Walk",
  direction: null,
  x: 0,
  y: 0,
  lastStepMs: 0,
  nextDecisionAtMs: 0,
};

const PET_LAYOUT = computePetLayout(BASE_LAYOUT);
const WINDOW_SIZE = PET_LAYOUT.windowSize;
// These bounds describe the visible pet shape inside the transparent window.
const PET_VISUAL_BOUNDS = PET_LAYOUT.visualBounds;
let activePetVisualBounds = { ...PET_VISUAL_BOUNDS };
const animationManifestCache = new Map();

function asPositiveInteger(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.round(numeric));
}

function asFiniteNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function sanitizeHitbox(rawHitbox, cell) {
  if (!rawHitbox || typeof rawHitbox !== "object") return null;
  const x = asFiniteNumber(rawHitbox.x, NaN);
  const y = asFiniteNumber(rawHitbox.y, NaN);
  const width = asFiniteNumber(rawHitbox.width, NaN);
  const height = asFiniteNumber(rawHitbox.height, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  if (width <= 0 || height <= 0) return null;

  const normalizedX = Math.max(0, Math.min(cell.width - 1, Math.round(x)));
  const normalizedY = Math.max(0, Math.min(cell.height - 1, Math.round(y)));
  return {
    x: normalizedX,
    y: normalizedY,
    width: Math.max(1, Math.min(cell.width - normalizedX, Math.round(width))),
    height: Math.max(1, Math.min(cell.height - normalizedY, Math.round(height))),
  };
}

function sanitizeStateDefinition(stateName, rawState, cell) {
  if (!rawState || typeof rawState !== "object") {
    throw new Error(`Animation state "${stateName}" is missing or invalid.`);
  }
  const sheetPattern =
    typeof rawState.sheetPattern === "string" && rawState.sheetPattern.trim().length > 0
      ? rawState.sheetPattern.trim()
      : null;
  if (!sheetPattern) {
    throw new Error(`Animation state "${stateName}" is missing "sheetPattern".`);
  }

  const columns = asPositiveInteger(rawState.columns, 4);
  const frameCount = asPositiveInteger(rawState.frameCount, 1);
  const fps = asPositiveInteger(rawState.fps, 10);
  const loop = typeof rawState.loop === "boolean" ? rawState.loop : true;
  const nextState =
    typeof rawState.nextState === "string" && rawState.nextState.trim().length > 0
      ? rawState.nextState.trim()
      : "IdleReady";

  return {
    sheetPattern,
    columns,
    frameCount,
    fps,
    loop,
    nextState,
    hitboxPx: sanitizeHitbox(rawState.hitboxPx, cell),
  };
}

function readAnimationManifest(characterId) {
  if (typeof characterId !== "string" || !/^[a-z0-9_-]+$/i.test(characterId)) {
    throw new Error(`Invalid character id "${characterId}".`);
  }

  const cached = animationManifestCache.get(characterId);
  if (cached) return cached;

  const characterDir = path.join(CHARACTER_ASSETS_ROOT, characterId);
  const manifestPath = path.join(characterDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing animation manifest: ${manifestPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const directions = Array.isArray(raw?.directions)
    ? raw.directions.filter((value) => typeof value === "string" && value.trim().length > 0)
    : [];
  if (directions.length !== REQUIRED_SPRITE_DIRECTIONS.length) {
    throw new Error(`Manifest "${characterId}" directions are incomplete.`);
  }
  for (const requiredDirection of REQUIRED_SPRITE_DIRECTIONS) {
    if (!directions.includes(requiredDirection)) {
      throw new Error(`Manifest "${characterId}" is missing direction "${requiredDirection}".`);
    }
  }

  const cell = {
    width: asPositiveInteger(raw?.cell?.width, 256),
    height: asPositiveInteger(raw?.cell?.height, 256),
  };
  const normalized = {
    version: asPositiveInteger(raw?.version, 1),
    characterId,
    directions,
    cell,
    pivotPx: {
      x: Math.max(0, Math.min(cell.width, asFiniteNumber(raw?.pivotPx?.x, Math.round(cell.width / 2)))),
      y: Math.max(0, Math.min(cell.height, asFiniteNumber(raw?.pivotPx?.y, cell.height))),
    },
    display: {
      targetHeightPx: asPositiveInteger(raw?.display?.targetHeightPx, 220),
    },
    states: {},
  };

  if (!raw?.states || typeof raw.states !== "object") {
    throw new Error(`Manifest "${characterId}" is missing states.`);
  }

  for (const [stateName, rawState] of Object.entries(raw.states)) {
    normalized.states[stateName] = sanitizeStateDefinition(stateName, rawState, cell);
  }

  for (const requiredState of REQUIRED_SPRITE_STATES) {
    if (!normalized.states[requiredState]) {
      throw new Error(`Manifest "${characterId}" is missing state "${requiredState}".`);
    }
  }

  const payload = {
    characterId,
    basePath: path.relative(__dirname, characterDir).split(path.sep).join("/"),
    manifest: normalized,
  };

  animationManifestCache.set(characterId, payload);
  return payload;
}

function getAvailableSpriteStateIds(characterId = DEFAULT_CHARACTER_ID) {
  try {
    return Object.keys(readAnimationManifest(characterId)?.manifest?.states || {});
  } catch (error) {
    console.warn(
      `[pet-state] failed to read sprite manifest for state runtime: ${error?.message || String(error)}`
    );
    return [...REQUIRED_SPRITE_STATES];
  }
}

function summarizeDisplay(display) {
  return {
    id: display.id,
    label: display.label,
    scaleFactor: display.scaleFactor,
    bounds: display.bounds,
    workArea: display.workArea,
  };
}

function createInitialIntegrationProbeState() {
  return {
    state: "pending",
    reason: "probePending",
    fallbackMode: "probe_pending",
    lastProbeAt: 0,
    lastSuccessAt: 0,
    lastFailureAt: 0,
    error: null,
  };
}

function createInitialLocalMediaSnapshot() {
  return {
    ok: false,
    source: WINDOWS_MEDIA_SOURCE,
    isPlaying: false,
    playbackStatus: "Idle",
    provider: "local_media",
    sourceAppLabel: "Windows Media",
    sourceAppUserModelId: null,
    title: null,
    artist: null,
    album: null,
    outputRoute: "unknown",
    outputDeviceName: "unknown_device",
    outputDeviceType: "unknown",
    ts: 0,
    error: "probe_pending",
  };
}

function isMusicStateId(stateId) {
  return stateId === "MusicChill" || stateId === "MusicDance";
}

function getLocalMediaSensorSettings() {
  const settings = runtimeSettings?.sensors?.media || {};
  return {
    enabled: Boolean(settings.enabled),
    backend: settings.backend || "powershell",
    pollIntervalMs: Number.isFinite(Number(settings.pollIntervalMs))
      ? Math.max(500, Math.round(Number(settings.pollIntervalMs)))
      : 2500,
    probeTimeoutMs: Number.isFinite(Number(settings.probeTimeoutMs))
      ? Math.max(250, Math.round(Number(settings.probeTimeoutMs)))
      : 1800,
    includeOutputDevice: settings.includeOutputDevice !== false,
  };
}

function getSpotifyBackgroundPollCadenceMs() {
  const cadenceMinutes = Number(runtimeSettings?.integrations?.spotify?.pollCadenceMinutes);
  if (!Number.isFinite(cadenceMinutes)) return 10 * 60 * 1000;
  return Math.max(60 * 1000, Math.round(cadenceMinutes * 60 * 1000));
}

function getFreshRssBackgroundPollCadenceMs() {
  const cadenceMinutes = Number(runtimeSettings?.integrations?.freshRss?.pollCadenceMinutes);
  if (!Number.isFinite(cadenceMinutes)) return 30 * 60 * 1000;
  return Math.max(5 * 60 * 1000, Math.round(cadenceMinutes * 60 * 1000));
}

function buildLocalMediaIntegrationEvent(snapshot, extras = {}) {
  let defaultText = buildLocalMediaResponseText(snapshot);
  if (!snapshot?.ok) {
    defaultText =
      snapshot?.error === "disabled_by_config"
        ? "Local media sensor is disabled by config."
        : `Local media probe degraded: ${snapshot?.error || "unknown_error"}.`;
  }
  return {
    kind: "localMedia",
    correlationId: extras.correlationId || createContractCorrelationId(),
    provider: snapshot?.provider || "local_media",
    source: "local",
    mediaSource: snapshot?.source || WINDOWS_MEDIA_SOURCE,
    sourceAppLabel: snapshot?.sourceAppLabel || "Windows Media",
    playbackStatus: snapshot?.playbackStatus || "Unknown",
    isPlaying: Boolean(snapshot?.isPlaying),
    outputRoute: snapshot?.outputRoute || "unknown",
    outputDeviceName: snapshot?.outputDeviceName || "unknown_device",
    capabilityState: snapshot?.ok ? "healthy" : "degraded",
    fallbackMode: snapshot?.ok ? "none" : snapshot?.error || "local_media_probe_failed",
    text:
      typeof extras.text === "string" && extras.text.length > 0
        ? extras.text
        : defaultText,
    ts: Number.isFinite(snapshot?.ts) ? snapshot.ts : Date.now(),
  };
}

function getPreferredSpotifyOutputContext() {
  if (!latestLocalMediaSnapshot?.isPlaying) return null;
  if (latestLocalMediaSnapshot.provider !== "spotify") return null;
  return {
    outputRoute: latestLocalMediaSnapshot.outputRoute || "unknown",
    outputDeviceName: latestLocalMediaSnapshot.outputDeviceName || "unknown_device",
    outputDeviceType: latestLocalMediaSnapshot.outputDeviceType || "unknown",
  };
}

function applyPreferredOutputContext(nowPlaying, preferredOutputContext) {
  const preferred =
    preferredOutputContext && typeof preferredOutputContext === "object"
      ? preferredOutputContext
      : null;
  if (!nowPlaying || !preferred) return nowPlaying;
  if (
    nowPlaying.outputRoute &&
    nowPlaying.outputRoute !== "unknown" &&
    nowPlaying.outputDeviceName &&
    nowPlaying.outputDeviceName !== "unknown_device"
  ) {
    return nowPlaying;
  }
  return {
    ...nowPlaying,
    outputRoute:
      nowPlaying.outputRoute && nowPlaying.outputRoute !== "unknown"
        ? nowPlaying.outputRoute
        : preferred.outputRoute || "unknown",
    outputDeviceName:
      nowPlaying.outputDeviceName && nowPlaying.outputDeviceName !== "unknown_device"
        ? nowPlaying.outputDeviceName
        : preferred.outputDeviceName || "unknown_device",
    outputDeviceType:
      nowPlaying.outputDeviceType && nowPlaying.outputDeviceType !== "unknown"
        ? nowPlaying.outputDeviceType
        : preferred.outputDeviceType || "unknown",
  };
}

function summarizeDisplays() {
  return screen.getAllDisplays().map(summarizeDisplay);
}

function getClampArea(display) {
  return CLAMP_TO_WORK_AREA ? display.workArea : display.bounds;
}

function summarizeBounds(bounds) {
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function getActivePetVisualBounds(nowMs = Date.now()) {
  const stale =
    activePetBoundsUpdatedAtMs > 0 &&
    nowMs - activePetBoundsUpdatedAtMs > PET_BOUNDS_STALE_MS &&
    (dragging || flingState.active);
  if (stale) return PET_VISUAL_BOUNDS;
  return activePetVisualBounds || PET_VISUAL_BOUNDS;
}

function emitToRenderer(channel, payload) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send(channel, payload);
}

function emitToWindow(targetWindow, channel, payload) {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  targetWindow.webContents.send(channel, payload);
}

function getWindowCenterPoint(targetWindow, windowSize = null) {
  if (!targetWindow || targetWindow.isDestroyed()) return { x: 0, y: 0 };
  const bounds = targetWindow.getContentBounds();
  const size = windowSize || bounds;
  return {
    x: Math.round(bounds.x + size.width * 0.5),
    y: Math.round(bounds.y + size.height * 0.5),
  };
}

function applyFixedContentBounds(targetWindow, size, targetX, targetY) {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  targetWindow.setContentBounds(
    {
      x: Math.round(targetX),
      y: Math.round(targetY),
      width: size.width,
      height: size.height,
    },
    false
  );
}

function resetMotionSampleFromWindow() {
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  lastMotionSample = { tMs: Date.now(), x, y };
}

function shouldEmitMotionPayload(nextPayload) {
  if (!lastMotionPayload) return true;
  if (nextPayload.dragging !== lastMotionPayload.dragging) return true;
  if (nextPayload.flinging !== lastMotionPayload.flinging) return true;
  if (nextPayload.preset !== lastMotionPayload.preset) return true;
  if (nextPayload.collided.x !== lastMotionPayload.collided.x) return true;
  if (nextPayload.collided.y !== lastMotionPayload.collided.y) return true;
  if (nextPayload.impact.triggered !== lastMotionPayload.impact.triggered) return true;
  if (
    Math.abs(nextPayload.impact.strength - lastMotionPayload.impact.strength) > MOTION_VELOCITY_EPSILON
  ) {
    return true;
  }
  if (
    Math.abs(nextPayload.position.x - lastMotionPayload.position.x) > MOTION_POSITION_EPSILON ||
    Math.abs(nextPayload.position.y - lastMotionPayload.position.y) > MOTION_POSITION_EPSILON
  ) {
    return true;
  }
  if (
    Math.abs(nextPayload.velocity.vx - lastMotionPayload.velocity.vx) > MOTION_VELOCITY_EPSILON ||
    Math.abs(nextPayload.velocity.vy - lastMotionPayload.velocity.vy) > MOTION_VELOCITY_EPSILON ||
    Math.abs(nextPayload.velocity.speed - lastMotionPayload.velocity.speed) > MOTION_VELOCITY_EPSILON
  ) {
    return true;
  }
  return false;
}

function emitMotionState({ collided, impact, velocityOverride } = {}) {
  if (!win || win.isDestroyed()) return;

  const nowMs = Date.now();
  const [x, y] = win.getPosition();

  let vx = 0;
  let vy = 0;

  if (
    velocityOverride &&
    Number.isFinite(velocityOverride.vx) &&
    Number.isFinite(velocityOverride.vy)
  ) {
    vx = velocityOverride.vx;
    vy = velocityOverride.vy;
  } else if (lastMotionSample) {
    const dtSec = (nowMs - lastMotionSample.tMs) / 1000;
    if (dtSec > 0) {
      vx = (x - lastMotionSample.x) / dtSec;
      vy = (y - lastMotionSample.y) / dtSec;
    }
  }

  const speed = Math.hypot(vx, vy);
  lastMotionSample = { tMs: nowMs, x, y };

  const payload = {
    tMs: nowMs,
    dragging,
    flinging: flingState.active,
    position: { x, y },
    velocity: { vx, vy, speed },
    collided: {
      x: Boolean(collided?.x),
      y: Boolean(collided?.y),
    },
    impact: {
      triggered: Boolean(impact?.triggered),
      strength: Number.isFinite(impact?.strength)
        ? Math.max(0, Math.min(1, impact.strength))
        : 0,
    },
    preset: ACTIVE_FLING_PRESET,
  };
  if (!shouldEmitMotionPayload(payload)) return;

  lastMotionPayload = payload;
  emitToRenderer("pet:motion", payload);
}

function emitCursorState() {
  if (!win || win.isDestroyed()) return;
  emitToRenderer("pet:cursor", {
    tMs: Date.now(),
    cursor: screen.getCursorScreenPoint(),
  });
}

function applyWindowBounds(targetX, targetY) {
  if (!win) {
    return {
      windowBefore: null,
      windowAfter: null,
      contentBefore: null,
      contentAfter: null,
      sizeCorrected: false,
    };
  }

  if (!DIAGNOSTICS_ENABLED) {
    applyFixedContentBounds(win, WINDOW_SIZE, targetX, targetY);
    return {
      windowBefore: null,
      windowAfter: null,
      contentBefore: null,
      contentAfter: null,
      sizeCorrected: false,
    };
  }

  const windowBefore = win.getBounds();
  const contentBefore = win.getContentBounds();
  const sizeCorrected =
    contentBefore.width !== WINDOW_SIZE.width || contentBefore.height !== WINDOW_SIZE.height;

  applyFixedContentBounds(win, WINDOW_SIZE, targetX, targetY);

  const windowAfter = win.getBounds();
  const contentAfter = win.getContentBounds();

  return {
    windowBefore: summarizeBounds(windowBefore),
    windowAfter: summarizeBounds(windowAfter),
    contentBefore: summarizeBounds(contentBefore),
    contentAfter: summarizeBounds(contentAfter),
    sizeCorrected,
  };
}

function recordDragSample(x, y, tMs = Date.now()) {
  dragSamples.push({ tMs, x: Math.round(x), y: Math.round(y) });

  const minTime = tMs - VELOCITY_SAMPLE_WINDOW_MS;
  dragSamples = dragSamples.filter((sample) => sample.tMs >= minTime);

  if (dragSamples.length > MAX_DRAG_SAMPLES) {
    dragSamples = dragSamples.slice(-MAX_DRAG_SAMPLES);
  }
}

function clearDragSamples() {
  dragSamples = [];
}

function cancelFling(reason = "cancelled") {
  const wasActive = flingState.active;

  flingState.active = false;
  flingState.vx = 0;
  flingState.vy = 0;
  flingState.lastStepMs = 0;
  flingState.x = 0;
  flingState.y = 0;
  flingTick = 0;

  if (wasActive) {
    const payload = { kind: "flingCancel", reason };
    logDiagnostics("fling-cancel", payload);
    emitDiagnostics(payload);
    emitMotionState({
      velocityOverride: { vx: 0, vy: 0 },
      collided: { x: false, y: false },
      impact: { triggered: false, strength: 0 },
    });
    if (reason === "belowStopSpeed") {
      maybeExitZoneRoamAfterManualMove("manual_fling_exit_zone");
    }
  }
}

function maybeStartFlingFromSamples() {
  if (!FLING_CONFIG.enabled) {
    const payload = { kind: "flingSkip", reason: "presetOff", preset: ACTIVE_FLING_PRESET };
    logDiagnostics("fling-skip", payload);
    emitDiagnostics(payload);
    return;
  }

  if (dragSamples.length < 2) {
    const payload = { kind: "flingSkip", reason: "insufficientSamples", sampleCount: dragSamples.length };
    logDiagnostics("fling-skip", payload);
    emitDiagnostics(payload);
    return;
  }

  const latest = dragSamples[dragSamples.length - 1];
  const oldest = dragSamples[0];
  const dtSec = (latest.tMs - oldest.tMs) / 1000;

  if (dtSec <= 0) {
    const payload = { kind: "flingSkip", reason: "invalidSampleWindow", dtSec };
    logDiagnostics("fling-skip", payload);
    emitDiagnostics(payload);
    return;
  }

  let vx = (latest.x - oldest.x) / dtSec;
  let vy = (latest.y - oldest.y) / dtSec;
  const rawSpeed = Math.hypot(vx, vy);

  if (rawSpeed > FLING_CONFIG.maxSpeedPxS) {
    const scale = FLING_CONFIG.maxSpeedPxS / rawSpeed;
    vx *= scale;
    vy *= scale;
  }

  const speed = Math.hypot(vx, vy);
  if (speed < FLING_CONFIG.minSpeedPxS) {
    const payload = {
      kind: "flingSkip",
      reason: "belowMinSpeed",
      speed,
      minSpeed: FLING_CONFIG.minSpeedPxS,
      sampleCount: dragSamples.length,
      dtSec,
      preset: ACTIVE_FLING_PRESET,
    };
    logDiagnostics("fling-skip", payload);
    emitDiagnostics(payload);
    return;
  }

  flingState.active = true;
  flingState.vx = vx;
  flingState.vy = vy;
  flingState.lastStepMs = Date.now();
  const [winX, winY] = win.getPosition();
  flingState.x = winX;
  flingState.y = winY;
  flingTick = 0;

  const payload = {
    kind: "flingStart",
    vx,
    vy,
    speed,
    sampleCount: dragSamples.length,
    dtSec,
    preset: ACTIVE_FLING_PRESET,
  };
  logDiagnostics("fling-start", payload);
  emitDiagnostics(payload);
  emitMotionState({
    velocityOverride: { vx, vy },
    collided: { x: false, y: false },
    impact: { triggered: false, strength: 0 },
  });
}

function stepFling() {
  if (!win || win.isDestroyed()) return;
  if (!FLING_CONFIG.enabled) {
    cancelFling("presetOff");
    return;
  }
  if (!flingState.active || dragging) return;

  const nowMs = Date.now();
  const elapsedMs = nowMs - flingState.lastStepMs;
  if (elapsedMs <= 0) return;

  const dtSec = Math.min(elapsedMs / 1000, 0.05);
  flingState.lastStepMs = nowMs;
  flingTick += 1;

  // Keep subpixel position state for smoother motion than integer window coordinates.
  if (!Number.isFinite(flingState.x) || !Number.isFinite(flingState.y)) {
    const [winX, winY] = win.getPosition();
    flingState.x = winX;
    flingState.y = winY;
  }

  const targetX = flingState.x + flingState.vx * dtSec;
  const targetY = flingState.y + flingState.vy * dtSec;

  const targetCenter = {
    x: Math.round(targetX + WINDOW_SIZE.width / 2),
    y: Math.round(targetY + WINDOW_SIZE.height / 2),
  };
  const display = screen.getDisplayNearestPoint(targetCenter);
  const clampArea = getClampArea(display);
  const petBounds = getActivePetVisualBounds(nowMs);
  const clamped = clampWindowPosition(targetX, targetY, clampArea, petBounds);
  const collidedX = Math.abs(clamped.x - targetX) > 0.001;
  const collidedY = Math.abs(clamped.y - targetY) > 0.001;
  let impactStrength = 0;

  applyWindowBounds(clamped.x, clamped.y);
  flingState.x = clamped.x;
  flingState.y = clamped.y;

  if (collidedX) {
    const oldVx = flingState.vx;
    impactStrength = Math.max(
      impactStrength,
      Math.abs(oldVx) / Math.max(1, FLING_CONFIG.maxSpeedPxS)
    );
    flingState.vx = -flingState.vx * FLING_CONFIG.bounceRestitution;
    const payload = { kind: "flingBounce", axis: "x", before: oldVx, after: flingState.vx };
    logDiagnostics("fling-bounce", payload);
    emitDiagnostics(payload);
  }

  if (collidedY) {
    const oldVy = flingState.vy;
    impactStrength = Math.max(
      impactStrength,
      Math.abs(oldVy) / Math.max(1, FLING_CONFIG.maxSpeedPxS)
    );
    flingState.vy = -flingState.vy * FLING_CONFIG.bounceRestitution;
    const payload = { kind: "flingBounce", axis: "y", before: oldVy, after: flingState.vy };
    logDiagnostics("fling-bounce", payload);
    emitDiagnostics(payload);
  }

  const damping = Math.exp(-FLING_CONFIG.dampingPerSec * dtSec);
  flingState.vx *= damping;
  flingState.vy *= damping;

  const speed = Math.hypot(flingState.vx, flingState.vy);
  if (speed < FLING_CONFIG.stopSpeedPxS) {
    const payload = { kind: "flingStop", reason: "belowStopSpeed", speed };
    logDiagnostics("fling-stop", payload);
    emitDiagnostics(payload);
    cancelFling("belowStopSpeed");
    return;
  }

  emitMotionState({
    velocityOverride: { vx: flingState.vx, vy: flingState.vy },
    collided: { x: collidedX, y: collidedY },
    impact: { triggered: collidedX || collidedY, strength: impactStrength },
  });

  if (DIAGNOSTICS_ENABLED && (flingTick % DRAG_LOG_SAMPLE_EVERY === 0 || collidedX || collidedY)) {
    const payload = {
      kind: "flingStep",
      tick: flingTick,
      dtSec,
      speed,
      vx: flingState.vx,
      vy: flingState.vy,
      clamped,
      collidedX,
      collidedY,
      clampAreaType: CLAMP_TO_WORK_AREA ? "workArea" : "bounds",
      clampArea: summarizeBounds(clampArea),
      activeDisplay: summarizeDisplay(display),
    };
    logDiagnostics("fling-step", payload);
    emitDiagnostics(payload);
  }
}

function getLogFilePath() {
  return path.join(__dirname, "pet-debug.log");
}

function maybeRotateDiagnosticsLog() {
  if (!DIAGNOSTICS_ENABLED || !diagnosticsLogStream) return;
  if (logLineCount % 250 !== 0) return;

  try {
    const logPath = getLogFilePath();
    const { size } = fs.statSync(logPath);
    if (size < MAX_LOG_FILE_BYTES) return;

    diagnosticsLogStream.end();
    diagnosticsLogStream = null;

    const truncatedHeader = `${new Date().toISOString()} [pet-debug] log rotated at ${size} bytes\n`;
    fs.writeFileSync(logPath, truncatedHeader, "utf8");
    diagnosticsLogStream = fs.createWriteStream(logPath, { flags: "a" });
  } catch (error) {
    console.error("[pet-debug] failed to rotate diagnostics log", error);
  }
}

function writeDiagnosticsLogLine(line) {
  if (!DIAGNOSTICS_ENABLED || !diagnosticsLogStream) return;

  diagnosticsLogStream.write(`${line}\n`);
  logLineCount += 1;
  maybeRotateDiagnosticsLog();
}

function initializeDiagnosticsLog() {
  if (!DIAGNOSTICS_ENABLED) return;

  try {
    const logPath = getLogFilePath();
    const header = `${new Date().toISOString()} [pet-debug] diagnostics log started\n`;
    fs.writeFileSync(logPath, header, "utf8");
    diagnosticsLogStream = fs.createWriteStream(logPath, { flags: "a" });
    diagnosticsLogStream.on("error", (error) => {
      console.error("[pet-debug] diagnostics log stream error", error);
    });
    console.log(`[pet-debug] writing diagnostics to ${logPath}`);
  } catch (error) {
    console.error("[pet-debug] failed to initialize diagnostics log", error);
  }
}

function closeDiagnosticsLog() {
  if (!diagnosticsLogStream) return;

  diagnosticsLogStream.end();
  diagnosticsLogStream = null;
}

function emitDiagnostics(payload) {
  if (!DIAGNOSTICS_ENABLED) return;
  emitToRenderer("pet:diagnostics", payload);
}

function logDiagnostics(label, payload) {
  if (!DIAGNOSTICS_ENABLED) return;
  const line = `${new Date().toISOString()} [pet-debug] ${label} ${JSON.stringify(payload)}`;
  console.log(line);
  writeDiagnosticsLogLine(line);
}

function emitCapabilitySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  latestCapabilitySnapshot = snapshot;
  emitToRenderer("pet:capabilities", snapshot);
}

function emitStateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  const previousSnapshot = latestStateSnapshot;
  latestStateSnapshot = snapshot;
  emitToRenderer("pet:state", snapshot);
  if (
    previousSnapshot &&
    previousSnapshot.currentState !== snapshot.currentState &&
    snapshot.currentState === "Idle" &&
    latestLocalMediaSnapshot?.ok &&
    latestLocalMediaSnapshot?.isPlaying
  ) {
    void pollLocalMediaState({
      force: true,
      trigger: "idle-resume",
    });
  } else if (
    previousSnapshot &&
    previousSnapshot.currentState !== snapshot.currentState &&
    snapshot.currentState === "Idle"
  ) {
    syncShellRoamingState("idle_resume_shell_roam");
  }
}

function logCapabilitySummary(label, snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  const summary = snapshot.summary || {};
  const line =
    `[pet-capability] ${label} runtime=${snapshot.runtimeState}` +
    ` healthy=${summary.healthyCount || 0}` +
    ` degraded=${summary.degradedCount || 0}` +
    ` failed=${summary.failedCount || 0}` +
    ` disabled=${summary.disabledCount || 0}`;
  console.log(line);

  if (!DIAGNOSTICS_ENABLED) return;
  logDiagnostics("capability-summary", {
    kind: "capabilitySummary",
    label,
    runtimeState: snapshot.runtimeState,
    summary,
  });
  emitDiagnostics({
    kind: "capabilitySummary",
    label,
    runtimeState: snapshot.runtimeState,
    summary,
  });
}

function logCapabilityTransition(transition) {
  if (!transition || typeof transition !== "object") return;

  const capabilityId = transition.capabilityId || "unknown";
  const fromState = transition.previous?.state || "none";
  const toState = transition.next?.state || "unknown";
  const reason = transition.next?.reason || "unspecified";
  const line = `[pet-capability] ${capabilityId} ${fromState} -> ${toState} (${reason})`;
  console.log(line);

  if (!DIAGNOSTICS_ENABLED) return;
  const payload = {
    kind: "capabilityTransition",
    capabilityId,
    fromState,
    toState,
    reason,
    runtimeState: transition.snapshot?.runtimeState || "unknown",
    summary: transition.snapshot?.summary || {},
    details: transition.next?.details || {},
  };
  logDiagnostics("capability-transition", payload);
  emitDiagnostics(payload);
}

function createCapabilityContext() {
  return {
    app,
    screen,
    getWindow: () => win,
    diagnosticsEnabled: DIAGNOSTICS_ENABLED,
    cursorTimerActive: Boolean(cursorTimer),
    flingEnabled: Boolean(FLING_CONFIG?.enabled),
    flingPreset: ACTIVE_FLING_PRESET,
  };
}

function initializeCapabilityRegistry() {
  capabilityRegistry = createCapabilityRegistry({
    onTransition: (transition) => {
      logCapabilityTransition(transition);
      emitCapabilitySnapshot(transition.snapshot);
    },
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.renderer,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: true,
    defaultEnabled: true,
    telemetryTags: ["core", "ui"],
    degradedPolicy: {
      fallback: "renderMinimal",
    },
    start: ({ context }) => {
      const currentWindow = context.getWindow();
      if (!currentWindow || currentWindow.isDestroyed()) {
        return {
          state: CAPABILITY_STATES.failed,
          reason: "windowUnavailable",
        };
      }
      if (currentWindow.webContents?.isLoadingMainFrame()) {
        return {
          state: CAPABILITY_STATES.degraded,
          reason: "windowLoading",
        };
      }
      return {
        state: CAPABILITY_STATES.healthy,
        reason: "windowReady",
      };
    },
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.brain,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: true,
    defaultEnabled: true,
    telemetryTags: ["core", "state-authority"],
    degradedPolicy: {
      fallback: "localDeterministicMode",
    },
    start: () => ({
      state: CAPABILITY_STATES.healthy,
      reason: "localAuthorityReady",
    }),
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.sensors,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: false,
    defaultEnabled: true,
    telemetryTags: ["input", "cursor", "display"],
    degradedPolicy: {
      fallback: "reducedSensorSet",
    },
    start: ({ context }) => {
      if (CAPABILITY_TEST_FLAGS.sensorsFail) {
        throw new Error("Forced sensors startup failure (PET_FORCE_SENSORS_FAIL=1)");
      }
      if (!context.screen || typeof context.screen.getCursorScreenPoint !== "function") {
        return {
          state: CAPABILITY_STATES.failed,
          reason: "screenApiUnavailable",
        };
      }
      if (!context.cursorTimerActive) {
        return {
          state: CAPABILITY_STATES.degraded,
          reason: "cursorTimerInactive",
        };
      }
      return {
        state: CAPABILITY_STATES.healthy,
        reason: "cursorAndDisplayReady",
      };
    },
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.openclawBridge,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: false,
    defaultEnabled: true,
    telemetryTags: ["ai", "bridge"],
    degradedPolicy: {
      fallback: "offlineLocalFallback",
    },
    start: () => {
      if (CAPABILITY_TEST_FLAGS.openclawFail) {
        throw new Error("Forced bridge startup failure (PET_FORCE_OPENCLAW_FAIL=1)");
      }
      if (!openclawBridge) {
        return {
          state: CAPABILITY_STATES.failed,
          reason: "bridgeRuntimeUnavailable",
        };
      }
      return openclawBridge.getStartupState();
    },
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.spotifyIntegration,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: false,
    defaultEnabled: true,
    telemetryTags: ["integrations", "spotify", "media"],
    degradedPolicy: {
      fallback: "localMusicMode",
    },
    start: () => deriveIntegrationState(CAPABILITY_IDS.spotifyIntegration),
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.freshRssIntegration,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: false,
    defaultEnabled: true,
    telemetryTags: ["integrations", "freshrss", "feeds"],
    degradedPolicy: {
      fallback: "skipFeedPolling",
    },
    start: () => deriveIntegrationState(CAPABILITY_IDS.freshRssIntegration),
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.extensionRegistry,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: false,
    defaultEnabled: true,
    telemetryTags: ["extensions", "registry"],
    degradedPolicy: {
      fallback: "coreOnlyRuntime",
    },
    start: () => deriveExtensionRegistryState(latestExtensionSnapshot),
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.permissionManager,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: false,
    defaultEnabled: true,
    telemetryTags: ["extensions", "permissions"],
    degradedPolicy: {
      fallback: "restrictiveDefault",
    },
    start: () => ({
      state: CAPABILITY_STATES.healthy,
      reason: "authorTrustedWarningModel",
      details: {
        warningMode: "oneTimePerExtension",
      },
    }),
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.behaviorArbitrator,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: false,
    defaultEnabled: true,
    telemetryTags: ["extensions", "arbitration"],
    degradedPolicy: {
      fallback: "corePriorityOnly",
    },
    start: () => ({
      state: CAPABILITY_STATES.healthy,
      reason: "coreAuthorityActive",
      details: {
        arbitrationMode: "coreAuthoritative",
      },
    }),
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.propWorld,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: false,
    defaultEnabled: true,
    telemetryTags: ["extensions", "props"],
    degradedPolicy: {
      fallback: "logOnlyPropWorld",
    },
    start: () => derivePropWorldCapabilityState(),
  });

  const snapshot = capabilityRegistry.getSnapshot();
  emitCapabilitySnapshot(snapshot);
  logCapabilitySummary("registered", snapshot);
}

async function startCapabilityRegistry() {
  if (!capabilityRegistry) return;
  const snapshot = await capabilityRegistry.startAll(createCapabilityContext());
  emitCapabilitySnapshot(snapshot);
  logCapabilitySummary("startup-complete", snapshot);
  refreshIntegrationCapabilityStates();
  refreshExtensionCapabilityStates();
}

function updateCapabilityState(capabilityId, state, reason, details = {}) {
  if (!capabilityRegistry) return;
  capabilityRegistry.updateCapabilityState(capabilityId, {
    state,
    reason,
    details,
  });
}

function emitExtensionSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  latestExtensionSnapshot = snapshot;
  emitToRenderer("pet:extensions", snapshot);
}

function logExtensionSummary(label, snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  const summary = snapshot.summary || {};
  const line =
    `[pet-extension] ${label}` +
    ` discovered=${summary.discoveredCount || 0}` +
    ` valid=${summary.validCount || 0}` +
    ` invalid=${summary.invalidCount || 0}` +
    ` enabled=${summary.enabledCount || 0}`;
  console.log(line);

  if (!DIAGNOSTICS_ENABLED) return;
  const payload = {
    kind: "extensionSummary",
    label,
    summary,
    warnings: snapshot.warnings || [],
  };
  logDiagnostics("extension-summary", payload);
  emitDiagnostics(payload);
}

function deriveExtensionRegistryState(snapshot) {
  const summary = snapshot?.summary || null;
  if (!summary) {
    return {
      state: CAPABILITY_STATES.failed,
      reason: "snapshotUnavailable",
      details: {},
    };
  }

  if (summary.validCount <= 0 && summary.invalidCount > 0) {
    return {
      state: CAPABILITY_STATES.degraded,
      reason: "noValidPacks",
      details: summary,
    };
  }
  if (summary.validCount <= 0) {
    return {
      state: CAPABILITY_STATES.degraded,
      reason: "noPacksFound",
      details: summary,
    };
  }
  if (summary.invalidCount > 0) {
    return {
      state: CAPABILITY_STATES.degraded,
      reason: "partialInvalid",
      details: summary,
    };
  }
  return {
    state: CAPABILITY_STATES.healthy,
    reason: "packsDiscovered",
    details: summary,
  };
}

function derivePropWorldCapabilityState() {
  return {
    state: CAPABILITY_STATES.healthy,
    reason: "trustedQuickPropsActive",
    details: {
      mode: "trustedQuickProps",
      quickProps: Object.values(SHELL_QUICK_PROP_IDS),
    },
  };
}

function refreshExtensionCapabilityStates() {
  const extensionState = deriveExtensionRegistryState(latestExtensionSnapshot);
  updateCapabilityState(
    CAPABILITY_IDS.extensionRegistry,
    extensionState.state,
    extensionState.reason,
    extensionState.details
  );
  updateCapabilityState(
    CAPABILITY_IDS.permissionManager,
    CAPABILITY_STATES.healthy,
    "authorTrustedWarningModel",
    {
      warningMode: "oneTimePerExtension",
      source: "localAuthorTrusted",
    }
  );
  updateCapabilityState(
    CAPABILITY_IDS.behaviorArbitrator,
    CAPABILITY_STATES.healthy,
    "coreAuthorityActive",
    {
      arbitrationMode: "coreAuthoritative",
    }
  );
  updateCapabilityState(
    CAPABILITY_IDS.propWorld,
    derivePropWorldCapabilityState().state,
    derivePropWorldCapabilityState().reason,
    derivePropWorldCapabilityState().details
  );
}

function initializeExtensionPackRuntime() {
  extensionPackRegistry = createExtensionPackRegistry({
    rootDir: DEFAULT_EXTENSIONS_ROOT,
    logger: (label, payload) => {
      if (!DIAGNOSTICS_ENABLED) return;
      logDiagnostics(`extension-registry-${label}`, payload);
    },
  });

  const snapshot = extensionPackRegistry.discover();
  emitExtensionSnapshot(snapshot);
  logExtensionSummary("discover", snapshot);
  for (const warning of snapshot.warnings || []) {
    console.warn(`[pet-extension] warning ${warning}`);
  }

  if (!EXTENSION_TEST_FLAGS.disableAll) return;

  for (const extension of snapshot.extensions || []) {
    if (!extension.valid || !extension.enabled) continue;
    const result = extensionPackRegistry.setEnabled(extension.extensionId, false);
    if (!result.ok) continue;
  }
  const disabledSnapshot = extensionPackRegistry.getSnapshot();
  emitExtensionSnapshot(disabledSnapshot);
  logExtensionSummary("all-disabled-by-flag", disabledSnapshot);
}

function buildRuntimeSettingsSummary() {
  const settings = runtimeSettings && typeof runtimeSettings === "object" ? runtimeSettings : {};
  const integrations =
    settings.integrations && typeof settings.integrations === "object" ? settings.integrations : {};
  const sensors = settings.sensors && typeof settings.sensors === "object" ? settings.sensors : {};
  const memory = settings.memory && typeof settings.memory === "object" ? settings.memory : {};
  const openclaw = settings.openclaw && typeof settings.openclaw === "object" ? settings.openclaw : {};
  const paths = settings.paths && typeof settings.paths === "object" ? settings.paths : {};
  const roaming = settings.roaming && typeof settings.roaming === "object" ? settings.roaming : {};
  const ui = settings.ui && typeof settings.ui === "object" ? settings.ui : {};
  const wardrobe = settings.wardrobe && typeof settings.wardrobe === "object" ? settings.wardrobe : {};
  const inventory = settings.inventory && typeof settings.inventory === "object" ? settings.inventory : {};
  const dialog = settings.dialog && typeof settings.dialog === "object" ? settings.dialog : {};
  const resolvedPaths =
    runtimeSettingsResolvedPaths && typeof runtimeSettingsResolvedPaths === "object"
      ? runtimeSettingsResolvedPaths
      : null;
  return {
    integrations: {
      spotify: {
        enabled: Boolean(integrations.spotify?.enabled),
        available: Boolean(integrations.spotify?.available),
        transport: integrations.spotify?.transport || INTEGRATION_TRANSPORTS.stub,
        defaultTrackTitle: integrations.spotify?.defaultTrackTitle || "Night Drive",
        defaultArtist: integrations.spotify?.defaultArtist || "Primea FM",
        defaultAlbum: integrations.spotify?.defaultAlbum || "Sample Rotation",
        backgroundEnrichmentEnabled: integrations.spotify?.backgroundEnrichmentEnabled !== false,
        pollCadenceMinutes: Number.isFinite(Number(integrations.spotify?.pollCadenceMinutes))
          ? Math.max(1, Math.round(Number(integrations.spotify.pollCadenceMinutes)))
          : 10,
      },
      freshRss: {
        enabled: Boolean(integrations.freshRss?.enabled),
        available: Boolean(integrations.freshRss?.available),
        transport: integrations.freshRss?.transport || INTEGRATION_TRANSPORTS.stub,
        backgroundEnrichmentEnabled: integrations.freshRss?.backgroundEnrichmentEnabled !== false,
        pollCadenceMinutes: Number.isFinite(Number(integrations.freshRss?.pollCadenceMinutes))
          ? Math.max(5, Math.round(Number(integrations.freshRss.pollCadenceMinutes)))
          : 30,
        dailyTopItems: Number.isFinite(Number(integrations.freshRss?.dailyTopItems))
          ? Math.max(1, Math.min(3, Math.round(Number(integrations.freshRss.dailyTopItems))))
          : 3,
      },
    },
    sensors: {
      media: {
        enabled: Boolean(sensors.media?.enabled),
        backend: sensors.media?.backend || "powershell",
        pollIntervalMs: Number.isFinite(Number(sensors.media?.pollIntervalMs))
          ? Math.max(500, Math.round(Number(sensors.media.pollIntervalMs)))
          : 2500,
        probeTimeoutMs: Number.isFinite(Number(sensors.media?.probeTimeoutMs))
          ? Math.max(250, Math.round(Number(sensors.media.probeTimeoutMs)))
          : 1800,
        includeOutputDevice: sensors.media?.includeOutputDevice !== false,
      },
    },
    memory: {
      enabled: Boolean(memory.enabled),
      adapterMode: memory.adapterMode || MEMORY_ADAPTER_MODES.local,
      mutationTransparencyPolicy: memory.mutationTransparencyPolicy || "logged",
      writeLegacyJsonl: Boolean(memory.writeLegacyJsonl),
    },
    openclaw: {
      enabled: Boolean(openclaw.enabled),
      transport: openclaw.transport || BRIDGE_TRANSPORTS.stub,
      mode: openclaw.mode || BRIDGE_MODES.online,
      agentId: openclaw.agentId || DEFAULT_OPENCLAW_AGENT_ID,
      agentTimeoutMs: Number.isFinite(Number(openclaw.agentTimeoutMs))
        ? Math.max(1000, Math.round(Number(openclaw.agentTimeoutMs)))
        : DEFAULT_OPENCLAW_AGENT_TIMEOUT_MS,
      baseUrl: openclaw.baseUrl || "",
      timeoutMs: Number.isFinite(Number(openclaw.timeoutMs))
        ? Math.max(200, Math.round(Number(openclaw.timeoutMs)))
        : 1200,
      retryCount: Number.isFinite(Number(openclaw.retryCount))
        ? Math.max(0, Math.round(Number(openclaw.retryCount)))
        : 0,
      allowNonLoopback: Boolean(openclaw.allowNonLoopback),
      loopbackEndpoint: Boolean(openclaw.loopbackEndpoint),
      nonLoopbackAuthSatisfied: Boolean(openclaw.nonLoopbackAuthSatisfied),
      authTokenConfigured: Boolean(openclaw.authToken),
      authTokenRef: openclaw.authTokenRef || null,
    },
    paths: {
      localWorkspaceRoot: paths.localWorkspaceRoot || __dirname,
      openClawWorkspaceRoot: paths.openClawWorkspaceRoot || null,
      obsidianVaultRoot: paths.obsidianVaultRoot || null,
    },
    roaming: {
      mode: roaming.mode === ROAMING_MODES.zone ? ROAMING_MODES.zone : ROAMING_MODES.desktop,
      zone:
        typeof roaming.zone === "string" && roaming.zone.trim().length > 0
          ? roaming.zone.trim()
          : DEFAULT_ROAMING_ZONE,
      zoneRect: normalizeRoamZoneRect(roaming.zoneRect),
    },
    ui: {
      diagnosticsEnabled: Boolean(ui.diagnosticsEnabled),
    },
    wardrobe: {
      activeAccessories: Array.isArray(wardrobe.activeAccessories)
        ? wardrobe.activeAccessories.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
        : [],
    },
    inventory: {
      quickProps: Array.isArray(inventory.quickProps)
        ? inventory.quickProps.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
        : [],
    },
    dialog: {
      alwaysShowBubble: dialog.alwaysShowBubble !== false,
    },
    resolvedPaths,
  };
}

function buildShellStateSnapshot() {
  const settings = buildRuntimeSettingsSummary();
  const accessories = settings.wardrobe?.activeAccessories || [];
  const quickProps = settings.inventory?.quickProps || [];
  const trayAvailable = Boolean(shellTray);
  return {
    kind: "shellState",
    ts: Date.now(),
    roaming: {
      mode: settings.roaming?.mode || ROAMING_MODES.desktop,
      zone: settings.roaming?.zone || DEFAULT_ROAMING_ZONE,
      zoneRect: normalizeRoamZoneRect(settings.roaming?.zoneRect),
    },
    ui: {
      diagnosticsEnabled: Boolean(settings.ui?.diagnosticsEnabled),
    },
    wardrobe: {
      activeAccessories: [...accessories],
      hasHeadphones: accessories.includes(SHELL_ACCESSORY_IDS.headphones),
    },
    inventory: {
      quickProps: [...quickProps],
      hasPoolRing: quickProps.includes(SHELL_QUICK_PROP_IDS.poolRing),
    },
    dialog: {
      alwaysShowBubble: settings.dialog?.alwaysShowBubble !== false,
    },
    inventoryUi: {
      open: Boolean(inventoryWin && !inventoryWin.isDestroyed()),
      activeTab: normalizeShellWindowTab(inventoryWindowActiveTab, SHELL_WINDOW_TABS.inventory),
    },
    tray: {
      available: trayAvailable,
      supported: shellTraySupported,
      error: shellTrayError,
    },
    devFallback: {
      enabled: !trayAvailable,
      hotkeys: ["F6", "F7", "F8", "F9", "F10"],
    },
  };
}

function emitShellState(snapshot = buildShellStateSnapshot()) {
  latestShellState = snapshot;
  emitToRenderer("pet:shell-state", snapshot);
  emitToWindow(inventoryWin, "pet:shell-state", snapshot);
  syncShellQuickPropWindows();
  return snapshot;
}

function setInventoryWindowActiveTab(nextTab, emitSnapshot = true) {
  inventoryWindowActiveTab = normalizeShellWindowTab(nextTab, inventoryWindowActiveTab);
  if (!emitSnapshot) return latestShellState || buildShellStateSnapshot();
  return emitShellState(buildShellStateSnapshot());
}

function buildCurrentObservabilitySnapshot() {
  const capabilitySnapshot =
    latestCapabilitySnapshot ||
    (capabilityRegistry && typeof capabilityRegistry.getSnapshot === "function"
      ? capabilityRegistry.getSnapshot()
      : null);
  const openclawCapabilityState =
    capabilityRegistry && typeof capabilityRegistry.getCapabilityState === "function"
      ? capabilityRegistry.getCapabilityState(CAPABILITY_IDS.openclawBridge)
      : capabilitySnapshot?.capabilities?.find(
          (entry) => entry?.capabilityId === CAPABILITY_IDS.openclawBridge
        ) || null;
  return buildObservabilitySnapshot({
    capabilitySnapshot,
    openclawCapabilityState,
    memorySnapshot:
      latestMemorySnapshot ||
      (memoryPipeline && typeof memoryPipeline.getSnapshot === "function"
        ? memoryPipeline.getSnapshot()
        : null),
    settingsSummary: buildRuntimeSettingsSummary(),
    settingsSourceMap: runtimeSettingsSourceMap,
    settingsFiles: runtimeSettingsFiles,
    validationWarnings: runtimeSettingsValidationWarnings,
    validationErrors: runtimeSettingsValidationErrors,
    resolvedPaths: runtimeSettingsResolvedPaths,
    trayAvailable: Boolean(shellTray),
    ts: Date.now(),
  });
}

function setDiagnosticsEnabled(nextEnabled, reason = "settings_update") {
  const previousEnabled = DIAGNOSTICS_ENABLED;
  DIAGNOSTICS_ENABLED = Boolean(nextEnabled);
  if (previousEnabled === DIAGNOSTICS_ENABLED) return;

  if (DIAGNOSTICS_ENABLED) {
    initializeDiagnosticsLog();
    logDiagnostics("diagnostics-enabled", {
      kind: "shellDiagnosticsToggle",
      reason,
      enabled: true,
    });
    return;
  }

  console.log(`[pet-shell] diagnostics disabled (${reason})`);
  closeDiagnosticsLog();
}

function initializeRuntimeSettings(reason = "startup") {
  const loaded = loadRuntimeSettings({
    app,
    projectRoot: __dirname,
    env: process.env,
  });
  runtimeSettings = loaded.settings;
  runtimeSettingsSourceMap = loaded.sourceMap || {};
  runtimeSettingsValidationWarnings = Array.isArray(loaded.validationWarnings)
    ? loaded.validationWarnings
    : [];
  runtimeSettingsValidationErrors = Array.isArray(loaded.validationErrors)
    ? loaded.validationErrors
    : [];
  runtimeSettingsResolvedPaths = loaded.resolvedPaths || null;
  runtimeSettingsFiles = loaded.files || null;

  if (runtimeSettingsValidationWarnings.length > 0) {
    for (const warning of runtimeSettingsValidationWarnings) {
      console.warn(warning);
    }
  }
  if (runtimeSettingsValidationErrors.length > 0) {
    for (const error of runtimeSettingsValidationErrors) {
      console.warn(error);
    }
  }
  setDiagnosticsEnabled(Boolean(runtimeSettings?.ui?.diagnosticsEnabled), reason);
}

function createShellTrayIcon() {
  return nativeImage
    .createFromBuffer(Buffer.from(TRAY_ICON_PNG_BASE64, "base64"))
    .resize({ width: 16, height: 16, quality: "best" });
}

function toggleMembership(list, value) {
  const source = Array.isArray(list) ? list.filter((entry) => typeof entry === "string") : [];
  return source.includes(value) ? source.filter((entry) => entry !== value) : [...source, value];
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function getPropWindowSpec(propId) {
  return Object.prototype.hasOwnProperty.call(PROP_WINDOW_SPECS, propId)
    ? PROP_WINDOW_SPECS[propId]
    : null;
}

function buildPropWindowModel(propId) {
  const spec = getPropWindowSpec(propId);
  if (!spec) return null;
  return {
    propId: spec.propId,
    label: spec.label,
    windowSize: spec.windowSize,
    visualBounds: spec.visualBounds,
  };
}

function getWindowDisplay(targetWindow, windowSize = null) {
  const center = getWindowCenterPoint(targetWindow, windowSize);
  return screen.getDisplayNearestPoint(center);
}

function findPropWindowRecordByWebContentsId(webContentsId) {
  if (!Number.isFinite(Number(webContentsId))) return null;
  for (const record of propWindows.values()) {
    if (!record?.window || record.window.isDestroyed()) continue;
    if (record.window.webContents.id === webContentsId) {
      return record;
    }
  }
  return null;
}

function getDefaultInventoryWindowPosition() {
  const margin = 28;
  if (win && !win.isDestroyed()) {
    const [petX, petY] = win.getPosition();
    const display = getWindowDisplay(win, WINDOW_SIZE);
    const area = getClampArea(display);
    const preferredX = petX + WINDOW_SIZE.width + margin;
    const preferredY = petY + margin;
    return {
      x: Math.max(
        area.x + margin,
        Math.min(preferredX, area.x + area.width - INVENTORY_WINDOW_SIZE.width - margin)
      ),
      y: Math.max(
        area.y + margin,
        Math.min(preferredY, area.y + area.height - INVENTORY_WINDOW_SIZE.height - margin)
      ),
    };
  }

  const area = getClampArea(screen.getPrimaryDisplay());
  return {
    x: area.x + Math.max(margin, Math.round(area.width * 0.16)),
    y: area.y + Math.max(margin, Math.round(area.height * 0.12)),
  };
}

function normalizeRoamZoneRect(rect) {
  if (!rect || typeof rect !== "object") return null;
  const x = Number(rect.x);
  const y = Number(rect.y);
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  if (width < MIN_ROAM_ZONE_RECT_SIZE || height < MIN_ROAM_ZONE_RECT_SIZE) {
    return null;
  }
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function getRoamZoneLabel(snapshot = latestShellState) {
  if (snapshot?.roaming?.zoneRect) return "custom";
  return snapshot?.roaming?.zone || DEFAULT_ROAMING_ZONE;
}

function getRoamPetBounds(nowMs = Date.now()) {
  const sourceBounds = getActivePetVisualBounds(nowMs) || PET_VISUAL_BOUNDS;
  const normalized = normalizePetBounds(
    {
      ...sourceBounds,
      tMs: nowMs,
    },
    WINDOW_SIZE
  );
  if (normalized) return normalized;
  return {
    ...PET_VISUAL_BOUNDS,
    tMs: nowMs,
  };
}

function isAmbientStateId(stateId) {
  return stateId === "Idle" || stateId === "Roam" || stateId === "WatchMode";
}

function pickAmbientRestStateId() {
  return Math.random() < 0.55 ? "WatchMode" : "Idle";
}

function getBoundsUnion(boundsList) {
  if (!Array.isArray(boundsList) || boundsList.length <= 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const bounds of boundsList) {
    if (
      !bounds ||
      !Number.isFinite(bounds.x) ||
      !Number.isFinite(bounds.y) ||
      !Number.isFinite(bounds.width) ||
      !Number.isFinite(bounds.height) ||
      bounds.width <= 0 ||
      bounds.height <= 0
    ) {
      continue;
    }
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.max(1, Math.round(maxX - minX)),
    height: Math.max(1, Math.round(maxY - minY)),
  };
}

function getDesktopRoamLayout() {
  const areas = screen
    .getAllDisplays()
    .map((display) => summarizeBounds(getClampArea(display)))
    .filter((bounds) => bounds.width > 0 && bounds.height > 0);
  if (areas.length > 0) {
    return {
      areas,
      bounds: getBoundsUnion(areas),
    };
  }

  const fallbackDisplay = screen.getPrimaryDisplay();
  const fallbackBounds = summarizeBounds(getClampArea(fallbackDisplay));
  return {
    areas: [fallbackBounds],
    bounds: fallbackBounds,
  };
}

function pickRoamSamplingArea(areas) {
  if (!Array.isArray(areas) || areas.length <= 0) return null;
  let totalArea = 0;
  const weightedAreas = areas.map((area) => {
    const weight = Math.max(1, Math.round(area.width * area.height));
    totalArea += weight;
    return {
      area,
      weight,
    };
  });
  let remaining = randomBetween(0, Math.max(1, totalArea));
  for (const entry of weightedAreas) {
    remaining -= entry.weight;
    if (remaining <= 0) {
      return entry.area;
    }
  }
  return weightedAreas[weightedAreas.length - 1]?.area || null;
}

function resolveRoamVisualDirection(dx, dy, fallbackDirection = "Down") {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < 0.001 && absY < 0.001) {
    return fallbackDirection;
  }

  const dominantAxis = Math.max(absX, absY);
  const diagonalRatio = dominantAxis > 0 ? Math.min(absX, absY) / dominantAxis : 0;
  if (diagonalRatio >= ROAM_DIAGONAL_DIRECTION_RATIO) {
    if (dx >= 0 && dy >= 0) return "DownRight";
    if (dx >= 0 && dy < 0) return "UpRight";
    if (dx < 0 && dy < 0) return "UpLeft";
    return "DownLeft";
  }

  if (absX >= absY) {
    return dx >= 0 ? "Right" : "Left";
  }
  return dy >= 0 ? "Down" : "Up";
}

function getRoamBounds(display, mode, zone, zoneRect = null) {
  const normalizedZoneRect = normalizeRoamZoneRect(zoneRect);
  if (mode === ROAMING_MODES.zone && normalizedZoneRect) {
    return normalizedZoneRect;
  }
  const clampArea = getClampArea(display);
  if (mode !== ROAMING_MODES.zone) {
    return clampArea;
  }

  const width = Math.max(420, Math.round(clampArea.width * (1 - ROAM_ZONE_INSET_RATIO * 2)));
  const height = Math.max(320, Math.round(clampArea.height * (1 - ROAM_ZONE_INSET_RATIO * 2)));
  let x = clampArea.x + Math.round((clampArea.width - width) * 0.5);
  if (zone === "desk-left") {
    x = clampArea.x + Math.round(clampArea.width * 0.08);
  } else if (zone === "desk-right") {
    x = clampArea.x + clampArea.width - width - Math.round(clampArea.width * 0.08);
  }
  const y = clampArea.y + Math.round((clampArea.height - height) * 0.5);
  return {
    x,
    y,
    width,
    height,
  };
}

function computeRoamWindowRange(roamBounds, petBounds) {
  if (!roamBounds || !petBounds) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };
  }
  const minX = Math.round(roamBounds.x - petBounds.x);
  const maxX = Math.round(roamBounds.x + roamBounds.width - petBounds.x - petBounds.width);
  const minY = Math.round(roamBounds.y - petBounds.y);
  const maxY = Math.round(roamBounds.y + roamBounds.height - petBounds.y - petBounds.height);
  if (maxX >= minX && maxY >= minY) {
    return { minX, maxX, minY, maxY };
  }
  return {
    minX: minX,
    maxX: minX,
    minY: minY,
    maxY: minY,
  };
}

function isWindowPositionWithinRange(x, y, range) {
  return x >= range.minX && x <= range.maxX && y >= range.minY && y <= range.maxY;
}

function getActiveZoneRoamWindowRange(snapshot = latestShellState, petBounds = getRoamPetBounds()) {
  if (!snapshot || snapshot.roaming?.mode !== ROAMING_MODES.zone) return null;
  const zoneRect = normalizeRoamZoneRect(snapshot.roaming?.zoneRect);
  if (!zoneRect) return null;
  return computeRoamWindowRange(zoneRect, petBounds);
}

function maybeExitZoneRoamAfterManualMove(reason = "manual_zone_escape") {
  if (!win || win.isDestroyed()) return false;

  const petBounds = getRoamPetBounds();
  const activeZoneRange = getActiveZoneRoamWindowRange(latestShellState, petBounds);
  if (!activeZoneRange) return false;

  const [winX, winY] = win.getPosition();
  if (isWindowPositionWithinRange(winX, winY, activeZoneRange)) {
    return false;
  }

  applyRuntimeSettingsPatch(
    {
      roaming: {
        mode: ROAMING_MODES.desktop,
      },
    },
    reason
  );
  roamState.queuedDestination = null;
  cancelRoamMotion();
  syncShellRoamingState(reason, true);
  return true;
}

function chooseRoamDestination(nowMs = Date.now(), options = {}) {
  if (!win || win.isDestroyed()) return null;
  const [currentWinX, currentWinY] = win.getPosition();
  const winX = Number.isFinite(Number(options.fromX)) ? Math.round(Number(options.fromX)) : currentWinX;
  const winY = Number.isFinite(Number(options.fromY)) ? Math.round(Number(options.fromY)) : currentWinY;
  const display = options.display || getWindowDisplay(win, WINDOW_SIZE);
  const roamMode = options.mode || latestShellState?.roaming?.mode || ROAMING_MODES.desktop;
  const roamZone = options.zone || getRoamZoneLabel(latestShellState);
  const roamZoneRect =
    Object.prototype.hasOwnProperty.call(options, "zoneRect")
      ? options.zoneRect
      : latestShellState?.roaming?.zoneRect || null;
  const desktopRoamLayout = roamMode === ROAMING_MODES.desktop ? getDesktopRoamLayout() : null;
  const roamBounds =
    options.roamBounds ||
    desktopRoamLayout?.bounds ||
    getRoamBounds(display, roamMode, roamZone, roamZoneRect);
  const samplingAreas =
    Array.isArray(options.samplingAreas) && options.samplingAreas.length > 0
      ? options.samplingAreas
      : desktopRoamLayout?.areas || [roamBounds];
  const petBounds = options.petBounds || getRoamPetBounds();
  const minDistancePx = Number.isFinite(Number(options.minDistancePx))
    ? Math.max(0, Math.round(Number(options.minDistancePx)))
    : ROAM_TARGET_MIN_DISTANCE_PX;
  let bestCandidate = null;
  for (let attempt = 0; attempt < ROAM_TARGET_RETRY_COUNT; attempt += 1) {
    const samplingArea = pickRoamSamplingArea(samplingAreas) || roamBounds;
    const range = computeRoamWindowRange(samplingArea, petBounds);
    const candidate = {
      x: Math.round(randomBetween(range.minX, range.maxX)),
      y: Math.round(randomBetween(range.minY, range.maxY)),
    };
    const distance = Math.hypot(candidate.x - winX, candidate.y - winY);
    if (distance >= minDistancePx) {
      return {
        ...candidate,
        distance,
        bounds: roamBounds,
        petBounds,
      };
    }
    if (!bestCandidate || distance > bestCandidate.distance) {
      bestCandidate = {
        ...candidate,
        distance,
        bounds: roamBounds,
        petBounds,
      };
    }
  }
  return bestCandidate;
}

function buildRoamModeEntryDestination(snapshot = latestShellState) {
  if (!win || win.isDestroyed()) return null;
  if (snapshot?.roaming?.mode !== ROAMING_MODES.zone) return null;
  const display = getWindowDisplay(win, WINDOW_SIZE);
  const desktopBounds = getDesktopRoamLayout().bounds || getClampArea(display);
  const zoneBounds = getRoamBounds(
    display,
    ROAMING_MODES.zone,
    getRoamZoneLabel(snapshot),
    snapshot?.roaming?.zoneRect || null
  );
  const petBounds = getRoamPetBounds();
  const range = computeRoamWindowRange(zoneBounds, petBounds);
  const [winX, winY] = win.getPosition();
  if (isWindowPositionWithinRange(winX, winY, range)) {
    return null;
  }
  const targetX = Math.max(range.minX, Math.min(winX, range.maxX));
  const targetY = Math.max(range.minY, Math.min(winY, range.maxY));
  return {
    x: targetX,
    y: targetY,
    distance: Math.hypot(targetX - winX, targetY - winY),
    bounds: desktopBounds,
    petBounds,
    preferRun: true,
  };
}

function queueRoamDestination(destination, reason = "roam_queue") {
  if (!destination) return false;
  const nowMs = Date.now();
  const [winX, winY] = win && !win.isDestroyed() ? win.getPosition() : [0, 0];
  roamState.phase = "rest";
  roamState.destination = null;
  roamState.queuedDestination = {
    x: Math.round(destination.x),
    y: Math.round(destination.y),
    distance: Number.isFinite(Number(destination.distance))
      ? Math.max(0, Number(destination.distance))
      : null,
    bounds: destination.bounds ? summarizeBounds(destination.bounds) : null,
    petBounds: destination.petBounds ? summarizeBounds(destination.petBounds) : null,
    preferRun: destination.preferRun === true,
    reason,
  };
  roamState.roamBounds = null;
  roamState.petBounds = null;
  roamState.speedPxPerSec = 0;
  roamState.clip = roamState.queuedDestination.preferRun ? "Run" : "Walk";
  roamState.direction = null;
  roamState.x = winX;
  roamState.y = winY;
  roamState.lastStepMs = nowMs;
  roamState.nextDecisionAtMs = nowMs + ROAM_ZONE_ENTRY_DELAY_MS;
  return true;
}

function queueRoamModeEntryIfOutside(snapshot = latestShellState, reason = "roam_zone_entry") {
  return queueRoamDestination(buildRoamModeEntryDestination(snapshot), reason);
}

function cancelRoamMotion() {
  const nowMs = Date.now();
  const [winX, winY] = win && !win.isDestroyed() ? win.getPosition() : [0, 0];
  const shouldEmitStop = roamState.phase === "moving" && !dragging && !flingState.active;
  roamState.phase = "idle";
  roamState.destination = null;
  roamState.roamBounds = null;
  roamState.petBounds = null;
  roamState.speedPxPerSec = 0;
  roamState.clip = roamState.queuedDestination?.preferRun ? "Run" : "Walk";
  roamState.direction = null;
  roamState.x = winX;
  roamState.y = winY;
  roamState.lastStepMs = nowMs;
  roamState.nextDecisionAtMs = roamState.queuedDestination ? nowMs + ROAM_ZONE_ENTRY_DELAY_MS : 0;
  if (shouldEmitStop) {
    resetMotionSampleFromWindow();
    emitMotionState({
      velocityOverride: {
        vx: 0,
        vy: 0,
      },
    });
  }
}

function enterAmbientRestState(reason = "roam_rest", stateId = pickAmbientRestStateId()) {
  if (!stateRuntime || !latestShellState) return latestStateSnapshot;
  const currentState = latestStateSnapshot?.currentState || "Idle";
  if (!isAmbientStateId(currentState)) return latestStateSnapshot;
  if (currentState === stateId) return latestStateSnapshot;
  return stateRuntime.activateState(stateId, {
    source: "shell",
    reason,
    trigger: "roam",
    context: {
      roamMode: latestShellState.roaming?.mode || ROAMING_MODES.desktop,
      roamZone: getRoamZoneLabel(latestShellState),
    },
  });
}

function scheduleRoamDecision(reason = "roam_schedule", delayMs = null, force = false) {
  const nowMs = Date.now();
  const [winX, winY] = win && !win.isDestroyed() ? win.getPosition() : [0, 0];
  if (!force && roamState.nextDecisionAtMs > nowMs && roamState.phase !== "moving") {
    return latestStateSnapshot;
  }
  roamState.phase = "rest";
  roamState.destination = null;
  roamState.queuedDestination = null;
  roamState.roamBounds = null;
  roamState.petBounds = null;
  roamState.speedPxPerSec = 0;
  roamState.clip = "Walk";
  roamState.direction = null;
  roamState.x = winX;
  roamState.y = winY;
  roamState.lastStepMs = nowMs;
  roamState.nextDecisionAtMs =
    nowMs +
    Math.round(
      Number.isFinite(delayMs)
        ? delayMs
        : randomBetween(ROAM_REST_MIN_MS, ROAM_REST_MAX_MS)
    );
  if (latestStateSnapshot?.currentState === "Roam") {
    enterAmbientRestState(reason);
  }
  return latestStateSnapshot;
}

function scheduleInitialRoamDecision(reason = "roam_initial_schedule", force = false) {
  return scheduleRoamDecision(
    reason,
    randomBetween(ROAM_INITIAL_DELAY_MIN_MS, ROAM_INITIAL_DELAY_MAX_MS),
    force
  );
}

function beginRoamLeg(nowMs = Date.now()) {
  if (!stateRuntime || !latestShellState) return latestStateSnapshot;
  const [winX, winY] = win.getPosition();
  const queuedDestination = roamState.queuedDestination;
  const destination =
    queuedDestination ||
    chooseRoamDestination(nowMs, {
      petBounds: getRoamPetBounds(),
    });
  if (
    !destination ||
    destination.distance <
      (queuedDestination ? ROAM_ARRIVAL_THRESHOLD_PX : ROAM_TARGET_MIN_DISTANCE_PX)
  ) {
    roamState.queuedDestination = null;
    scheduleRoamDecision("roam_leg_retry", randomBetween(ROAM_REST_MIN_MS, ROAM_REST_MAX_MS), true);
    enterAmbientRestState("roam_leg_retry");
    return latestStateSnapshot;
  }
  const shouldRun =
    queuedDestination?.preferRun === true ||
    (destination.distance >= ROAM_RUN_DISTANCE_THRESHOLD_PX && Math.random() < 0.55);
  const roamBounds =
    destination.bounds ||
    getRoamBounds(
      getWindowDisplay(win, WINDOW_SIZE),
      latestShellState?.roaming?.mode || ROAMING_MODES.desktop,
      getRoamZoneLabel(latestShellState),
      latestShellState?.roaming?.zoneRect || null
    );
  const petBounds = destination.petBounds || getRoamPetBounds();
  const direction = resolveRoamVisualDirection(
    destination.x - winX,
    destination.y - winY,
    roamState.direction || "Down"
  );
  roamState.phase = "moving";
  roamState.destination = {
    x: destination.x,
    y: destination.y,
  };
  roamState.queuedDestination = null;
  roamState.roamBounds = summarizeBounds(roamBounds);
  roamState.petBounds = summarizeBounds(petBounds);
  roamState.speedPxPerSec = shouldRun ? ROAM_RUN_SPEED_PX_PER_SEC : ROAM_WALK_SPEED_PX_PER_SEC;
  roamState.clip = shouldRun ? "Run" : "Walk";
  roamState.direction = direction;
  roamState.x = winX;
  roamState.y = winY;
  roamState.lastStepMs = nowMs;
  roamState.nextDecisionAtMs = 0;
  return stateRuntime.activateState("Roam", {
    source: "shell",
    reason: "roam_leg_start",
    trigger: "roam",
    context: {
      roamMode: latestShellState.roaming?.mode || ROAMING_MODES.desktop,
      roamZone: getRoamZoneLabel(latestShellState),
      roamDistance: Math.round(destination.distance),
    },
    visualOverrides: {
      clip: roamState.clip,
      direction,
    },
  });
}

function finishRoamLeg(reason = "roam_leg_complete", nowMs = Date.now()) {
  const queuedDestination = roamState.queuedDestination ? { ...roamState.queuedDestination } : null;
  const [winX, winY] = win && !win.isDestroyed() ? win.getPosition() : [0, 0];
  scheduleRoamDecision(reason, randomBetween(ROAM_REST_MIN_MS, ROAM_REST_MAX_MS), true);
  if (queuedDestination) {
    roamState.queuedDestination = queuedDestination;
    roamState.clip = queuedDestination.preferRun ? "Run" : "Walk";
    roamState.nextDecisionAtMs = nowMs + ROAM_ZONE_ENTRY_DELAY_MS;
  }
  enterAmbientRestState(reason);
  roamState.x = winX;
  roamState.y = winY;
  roamState.lastStepMs = nowMs;
  resetMotionSampleFromWindow();
  emitMotionState({
    velocityOverride: {
      vx: 0,
      vy: 0,
    },
  });
}

function shouldRoamAutonomously() {
  if (!win || win.isDestroyed()) return false;
  if (dragging || flingState.active) return false;
  return isAmbientStateId(latestStateSnapshot?.currentState || "Idle");
}

function stepRoam() {
  if (!shouldRoamAutonomously()) {
    cancelRoamMotion();
    return;
  }

  const nowMs = Date.now();
  if (roamState.phase !== "moving") {
    if (roamState.nextDecisionAtMs <= 0) {
      if (roamState.queuedDestination) {
        roamState.nextDecisionAtMs = nowMs + ROAM_ZONE_ENTRY_DELAY_MS;
      } else {
        scheduleInitialRoamDecision("roam_controller_start");
      }
      return;
    }
    if (nowMs >= roamState.nextDecisionAtMs) {
      beginRoamLeg(nowMs);
    }
    return;
  }

  if (!roamState.destination) {
    finishRoamLeg("roam_missing_destination", nowMs);
    return;
  }

  const dtSec = Math.max(0.001, Math.min(0.05, (nowMs - roamState.lastStepMs) / 1000));
  roamState.lastStepMs = nowMs;
  if (!Number.isFinite(roamState.x) || !Number.isFinite(roamState.y)) {
    const [winX, winY] = win.getPosition();
    roamState.x = winX;
    roamState.y = winY;
  }

  const dx = roamState.destination.x - roamState.x;
  const dy = roamState.destination.y - roamState.y;
  const remainingDistance = Math.hypot(dx, dy);
  if (remainingDistance <= ROAM_ARRIVAL_THRESHOLD_PX) {
    applyWindowBounds(roamState.destination.x, roamState.destination.y);
    roamState.x = roamState.destination.x;
    roamState.y = roamState.destination.y;
    finishRoamLeg("roam_arrived", nowMs);
    return;
  }

  const roamBounds =
    roamState.roamBounds ||
    getRoamBounds(
      getWindowDisplay(win, WINDOW_SIZE),
      latestShellState?.roaming?.mode || ROAMING_MODES.desktop,
      getRoamZoneLabel(latestShellState),
      latestShellState?.roaming?.zoneRect || null
    );
  const petBounds = roamState.petBounds || getRoamPetBounds();
  const stepDistance = Math.min(roamState.speedPxPerSec * dtSec, remainingDistance);
  const moveX = (dx / remainingDistance) * stepDistance;
  const moveY = (dy / remainingDistance) * stepDistance;
  const velocityScale = remainingDistance > 0 ? roamState.speedPxPerSec / remainingDistance : 0;
  const velocityOverride = {
    vx: dx * velocityScale,
    vy: dy * velocityScale,
  };
  // Keep subpixel roam position so slow walk speeds do not stall on integer window coordinates.
  const targetX = roamState.x + moveX;
  const targetY = roamState.y + moveY;
  const clamped = clampWindowPosition(targetX, targetY, roamBounds, petBounds);
  const collidedX = Math.abs(targetX - clamped.x) > 0.001;
  const collidedY = Math.abs(targetY - clamped.y) > 0.001;

  applyWindowBounds(clamped.x, clamped.y);
  roamState.x = clamped.x;
  roamState.y = clamped.y;
  emitMotionState({
    velocityOverride,
    collided: {
      x: collidedX,
      y: collidedY,
    },
    impact: {
      triggered: false,
      strength: 0,
    },
  });
  if (collidedX || collidedY) {
    finishRoamLeg("roam_bounds_clamped", nowMs);
    return;
  }
  if (remainingDistance - stepDistance <= ROAM_ARRIVAL_THRESHOLD_PX) {
    applyWindowBounds(roamState.destination.x, roamState.destination.y);
    roamState.x = roamState.destination.x;
    roamState.y = roamState.destination.y;
    finishRoamLeg("roam_arrived", nowMs);
  }
}

function startRoamController() {
  if (roamTimer) {
    clearInterval(roamTimer);
  }
  roamTimer = setInterval(stepRoam, ROAM_STEP_INTERVAL_MS);
}

function getDefaultPropWindowPosition(propId) {
  const spec = getPropWindowSpec(propId);
  if (!spec) return { x: 0, y: 0 };

  if (win && !win.isDestroyed()) {
    const [petX, petY] = win.getPosition();
    const proposedX = petX - Math.round(spec.windowSize.width * 0.72);
    const proposedY = petY + WINDOW_SIZE.height - spec.windowSize.height - 28;
    const display = getWindowDisplay(win, WINDOW_SIZE);
    return clampWindowPosition(
      proposedX,
      proposedY,
      getClampArea(display),
      spec.visualBounds
    );
  }

  const display = screen.getPrimaryDisplay();
  const area = getClampArea(display);
  return clampWindowPosition(
    area.x + Math.round(area.width * 0.2),
    area.y + Math.round(area.height * 0.72),
    area,
    spec.visualBounds
  );
}

function applyPropWindowBounds(propId, targetX, targetY) {
  const record = propWindows.get(propId);
  if (!record || !record.window || record.window.isDestroyed()) return null;
  const display = screen.getDisplayNearestPoint({
    x: Math.round(targetX + record.spec.windowSize.width * 0.5),
    y: Math.round(targetY + record.spec.windowSize.height * 0.5),
  });
  const clamped = clampWindowPosition(
    targetX,
    targetY,
    getClampArea(display),
    record.spec.visualBounds
  );
  applyFixedContentBounds(record.window, record.spec.windowSize, clamped.x, clamped.y);
  return clamped;
}

function positionPropWindowAtCursor(propId) {
  const record = propWindows.get(propId);
  if (!record) return null;
  const cursor = screen.getCursorScreenPoint();
  return applyPropWindowBounds(
    propId,
    cursor.x - Math.round(record.spec.windowSize.width * 0.5),
    cursor.y - Math.round(record.spec.windowSize.height * 0.5)
  );
}

function refreshPropWorldCapabilityState() {
  updateCapabilityState(
    CAPABILITY_IDS.propWorld,
    CAPABILITY_STATES.healthy,
    "separateWindowPropWorldReady",
    {
      mode: "separateWindowProps",
      activeQuickProps: [...(latestShellState?.inventory?.quickProps || [])],
      activeWindowCount: propWindows.size,
    }
  );
}

function createPropWindow(propId, initialPosition = null) {
  const existing = propWindows.get(propId);
  if (existing && existing.window && !existing.window.isDestroyed()) {
    if (initialPosition) {
      applyPropWindowBounds(propId, initialPosition.x, initialPosition.y);
    }
    return existing;
  }

  const spec = getPropWindowSpec(propId);
  if (!spec) return null;

  const propWindow = new BrowserWindow({
    width: spec.windowSize.width,
    height: spec.windowSize.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "prop-window-preload.js"),
    },
  });

  propWindow.setMinimumSize(spec.windowSize.width, spec.windowSize.height);
  propWindow.setMaximumSize(spec.windowSize.width, spec.windowSize.height);

  const record = {
    propId,
    spec,
    window: propWindow,
    dragging: false,
    dragOffset: { x: 0, y: 0 },
    placing: false,
    createdForPlacement: false,
  };
  propWindows.set(propId, record);

  propWindow.on("closed", () => {
    propWindows.delete(propId);
    if (appIsQuitting) return;
    refreshPropWorldCapabilityState();
  });

  propWindow.loadFile("prop-window.html");
  propWindow.webContents.once("did-finish-load", () => {
    emitToWindow(propWindow, "prop:model", buildPropWindowModel(propId));
    const position = initialPosition || getDefaultPropWindowPosition(propId);
    applyPropWindowBounds(propId, position.x, position.y);
    propWindow.show();
  });

  refreshPropWorldCapabilityState();
  return record;
}

function destroyPropWindow(propId) {
  const record = propWindows.get(propId);
  if (!record) return;
  propWindows.delete(propId);
  if (record.window && !record.window.isDestroyed()) {
    record.window.destroy();
  }
  refreshPropWorldCapabilityState();
}

function syncShellQuickPropWindows() {
  const activeQuickProps = new Set(latestShellState?.inventory?.quickProps || []);
  for (const propId of Object.keys(PROP_WINDOW_SPECS)) {
    if (activeQuickProps.has(propId)) {
      createPropWindow(propId);
      continue;
    }
    destroyPropWindow(propId);
  }
  refreshPropWorldCapabilityState();
}

function removeQuickPropFromDesktop(propId, reason = "shell_remove_quick_prop") {
  const snapshot = latestShellState || buildShellStateSnapshot();
  const nextQuickProps = (snapshot.inventory?.quickProps || []).filter((entry) => entry !== propId);
  if (nextQuickProps.length === (snapshot.inventory?.quickProps || []).length) {
    return {
      ok: true,
      shellState: snapshot,
    };
  }
  const nextSnapshot = applyRuntimeSettingsPatch(
    {
      inventory: {
        quickProps: nextQuickProps,
      },
    },
    reason
  );
  return {
    ok: true,
    shellState: latestShellState || nextSnapshot,
  };
}

function beginPropPlacement(propId) {
  const spec = getPropWindowSpec(propId);
  if (!spec) {
    return {
      ok: false,
      error: "unknown_prop_id",
    };
  }

  let snapshot = latestShellState || buildShellStateSnapshot();
  let createdForPlacement = false;
  if (!snapshot.inventory?.quickProps?.includes(propId)) {
    snapshot = applyRuntimeSettingsPatch(
      {
        inventory: {
          quickProps: toggleMembership(snapshot.inventory?.quickProps, propId),
        },
      },
      `shell_place_${propId}`
    );
    createdForPlacement = true;
  }

  const record = createPropWindow(propId);
  if (!record) {
    return {
      ok: false,
      error: "prop_window_unavailable",
    };
  }

  record.placing = true;
  record.createdForPlacement = createdForPlacement;
  if (!record.window.isDestroyed()) {
    record.window.setIgnoreMouseEvents(true);
  }
  positionPropWindowAtCursor(propId);
  return {
    ok: true,
    shellState: latestShellState || snapshot,
  };
}

function updatePropPlacement(propId) {
  const record = propWindows.get(propId);
  if (!record || !record.placing) {
    return {
      ok: false,
      error: "placement_not_active",
    };
  }
  positionPropWindowAtCursor(propId);
  return {
    ok: true,
  };
}

function endPropPlacement(propId, commit = true) {
  const record = propWindows.get(propId);
  if (!record) {
    return {
      ok: false,
      error: "prop_window_unavailable",
    };
  }

  const shouldRemove = !commit && record.createdForPlacement;
  record.placing = false;
  record.createdForPlacement = false;
  if (!record.window.isDestroyed()) {
    record.window.setIgnoreMouseEvents(false);
  }

  if (shouldRemove) {
    removeQuickPropFromDesktop(propId, `shell_cancel_place_${propId}`);
    destroyPropWindow(propId);
  }

  return {
    ok: true,
    shellState: latestShellState || buildShellStateSnapshot(),
  };
}

function beginPropWindowDrag(propId) {
  const record = propWindows.get(propId);
  if (!record || !record.window || record.window.isDestroyed()) {
    return {
      ok: false,
      error: "prop_window_unavailable",
    };
  }
  if (record.placing) {
    return {
      ok: false,
      error: "prop_window_placing",
    };
  }

  const cursor = screen.getCursorScreenPoint();
  const [x, y] = record.window.getPosition();
  record.dragging = true;
  record.dragOffset = {
    x: cursor.x - x,
    y: cursor.y - y,
  };
  return {
    ok: true,
  };
}

function dragPropWindow(propId) {
  const record = propWindows.get(propId);
  if (!record || !record.window || record.window.isDestroyed()) {
    return {
      ok: false,
      error: "prop_window_unavailable",
    };
  }
  if (!record.dragging) {
    return {
      ok: false,
      error: "prop_window_not_dragging",
    };
  }

  const cursor = screen.getCursorScreenPoint();
  const clamped = applyPropWindowBounds(
    propId,
    cursor.x - record.dragOffset.x,
    cursor.y - record.dragOffset.y
  );
  return {
    ok: true,
    position: clamped,
  };
}

function endPropWindowDrag(propId) {
  const record = propWindows.get(propId);
  if (!record) {
    return {
      ok: false,
      error: "prop_window_unavailable",
    };
  }
  record.dragging = false;
  return {
    ok: true,
  };
}

function createInventoryWindow() {
  if (inventoryWin && !inventoryWin.isDestroyed()) return inventoryWin;

  const position = getDefaultInventoryWindowPosition();

  inventoryWin = new BrowserWindow({
    x: position.x,
    y: position.y,
    width: INVENTORY_WINDOW_SIZE.width,
    height: INVENTORY_WINDOW_SIZE.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "inventory-preload.js"),
    },
  });
  inventoryWin.setMinimumSize(INVENTORY_WINDOW_MIN_SIZE.width, INVENTORY_WINDOW_MIN_SIZE.height);

  inventoryWin.on("closed", () => {
    inventoryWin = null;
    if (appIsQuitting) return;
    emitShellState(buildShellStateSnapshot());
  });

  inventoryWin.loadFile("inventory.html");
  inventoryWin.webContents.once("did-finish-load", () => {
    emitShellState(buildShellStateSnapshot());
    inventoryWin.show();
    inventoryWin.focus();
  });

  return inventoryWin;
}

function openInventoryWindow(targetTab = SHELL_WINDOW_TABS.inventory) {
  setInventoryWindowActiveTab(targetTab, false);
  const targetWindow = createInventoryWindow();
  if (!targetWindow) return null;
  if (!targetWindow.isVisible()) {
    targetWindow.show();
  }
  targetWindow.focus();
  emitShellState(buildShellStateSnapshot());
  return targetWindow;
}

function openStatusWindow() {
  return openInventoryWindow(SHELL_WINDOW_TABS.status);
}

function closeZoneSelectorWindow() {
  if (!zoneSelectorWin || zoneSelectorWin.isDestroyed()) {
    zoneSelectorWin = null;
    return;
  }
  zoneSelectorWin.close();
}

function getZoneSelectorDisplay() {
  if (win && !win.isDestroyed()) {
    return getWindowDisplay(win, WINDOW_SIZE);
  }
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}

function buildZoneSelectorModel(display = getZoneSelectorDisplay()) {
  const area = getClampArea(display);
  const existingRect = normalizeRoamZoneRect(latestShellState?.roaming?.zoneRect);
  return {
    displayId: display.id,
    area: summarizeBounds(area),
    existingRect,
  };
}

function createZoneSelectorWindow() {
  if (zoneSelectorWin && !zoneSelectorWin.isDestroyed()) {
    zoneSelectorWin.destroy();
    zoneSelectorWin = null;
  }

  const display = getZoneSelectorDisplay();
  const area = getClampArea(display);
  zoneSelectorWin = new BrowserWindow({
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "zone-selector-preload.js"),
    },
  });

  zoneSelectorWin.on("closed", () => {
    zoneSelectorWin = null;
  });

  zoneSelectorWin.loadFile("zone-selector.html");
  zoneSelectorWin.webContents.once("did-finish-load", () => {
    emitToWindow(zoneSelectorWin, "zone-selector:model", buildZoneSelectorModel(display));
    zoneSelectorWin.show();
    zoneSelectorWin.focus();
  });

  return zoneSelectorWin;
}

function openZoneSelectorWindow() {
  const targetWindow = createZoneSelectorWindow();
  if (!targetWindow) return null;
  if (!targetWindow.isVisible()) {
    targetWindow.show();
  }
  targetWindow.focus();
  return targetWindow;
}

function commitRoamZoneSelection(rawRect) {
  const rect = normalizeRoamZoneRect(rawRect);
  if (!rect) {
    return {
      ok: false,
      error: "invalid_zone_rect",
    };
  }
  const snapshot = applyRuntimeSettingsPatch(
    {
      roaming: {
        mode: ROAMING_MODES.zone,
        zone: "custom",
        zoneRect: rect,
      },
    },
    "shell_commit_roam_zone"
  );
  queueRoamModeEntryIfOutside(snapshot, "shell_commit_roam_zone");
  syncShellRoamingState("shell_commit_roam_zone", true);
  closeZoneSelectorWindow();
  return {
    ok: true,
    shellState: latestShellState || snapshot,
  };
}

function getPreferredRoamStateId(snapshot = latestShellState) {
  return snapshot?.roaming?.mode === ROAMING_MODES.zone ? "WatchMode" : "Idle";
}

function syncShellRoamingState(reason = "shell_roam_sync", force = false) {
  if (!stateRuntime || !latestShellState) return null;
  const currentState = latestStateSnapshot?.currentState || "Idle";
  if (!isAmbientStateId(currentState)) {
    return latestStateSnapshot;
  }
  const targetStateId = getPreferredRoamStateId(latestShellState);
  if (force) {
    cancelRoamMotion();
    roamState.queuedDestination = null;
    if (
      latestShellState.roaming?.mode === ROAMING_MODES.zone &&
      !queueRoamModeEntryIfOutside(latestShellState, reason)
    ) {
      scheduleInitialRoamDecision(reason, true);
    } else if (latestShellState.roaming?.mode !== ROAMING_MODES.zone) {
      scheduleInitialRoamDecision(reason, true);
    }
    if (currentState === "Roam") {
      return enterAmbientRestState(reason, targetStateId);
    }
    if (currentState !== targetStateId) {
      return enterAmbientRestState(reason, targetStateId);
    }
    return latestStateSnapshot;
  }
  if (roamState.phase === "moving") {
    return latestStateSnapshot;
  }
  if (roamState.queuedDestination) {
    roamState.phase = "rest";
    roamState.nextDecisionAtMs = Math.max(
      Date.now() + ROAM_ZONE_ENTRY_DELAY_MS,
      roamState.nextDecisionAtMs || 0
    );
  } else {
    scheduleInitialRoamDecision(
      reason,
      force || currentState === "Roam" || roamState.nextDecisionAtMs <= 0
    );
  }
  if (currentState === "Roam") {
    return enterAmbientRestState(reason, targetStateId);
  }
  if (currentState !== targetStateId) {
    return enterAmbientRestState(reason, targetStateId);
  }
  return latestStateSnapshot;
}

function refreshShellTrayMenu() {
  const snapshot = buildShellStateSnapshot();
  if (!shellTray) {
    emitShellState(snapshot);
    return snapshot;
  }

  const menu = Menu.buildFromTemplate([
    {
      label: "Inventory...",
      click: () => {
        void runShellAction(SHELL_ACTIONS.openInventory);
      },
    },
    {
      label: "Status...",
      click: () => {
        void runShellAction(SHELL_ACTIONS.openStatus);
      },
    },
    { type: "separator" },
    {
      label: "Roam",
      submenu: [
        {
          label: "Desktop",
          type: "radio",
          checked: snapshot.roaming.mode === ROAMING_MODES.desktop,
          click: () => {
            void runShellAction(SHELL_ACTIONS.roamDesktop);
          },
        },
        {
          label: `Zone (${getRoamZoneLabel(snapshot)})`,
          type: "radio",
          checked: snapshot.roaming.mode === ROAMING_MODES.zone,
          click: () => {
            void runShellAction(SHELL_ACTIONS.roamZone);
          },
        },
        {
          label: "Draw Zone...",
          click: () => {
            void runShellAction(SHELL_ACTIONS.selectRoamZone);
          },
        },
      ],
    },
    { type: "separator" },
    {
      label: "Diagnostics Overlay",
      type: "checkbox",
      checked: snapshot.ui.diagnosticsEnabled,
      click: () => {
        void runShellAction(SHELL_ACTIONS.toggleDiagnostics);
      },
    },
    {
      label: "Pin Latest Speech Bubble",
      type: "checkbox",
      checked: snapshot.dialog.alwaysShowBubble,
      click: () => {
        void runShellAction(SHELL_ACTIONS.toggleAlwaysShowBubble);
      },
    },
    { type: "separator" },
    {
      label: `Fallback Hotkeys ${snapshot.devFallback.hotkeys.join(", ")}`,
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);

  shellTray.setToolTip("Virtual Pet");
  shellTray.setContextMenu(menu);
  emitShellState(snapshot);
  return snapshot;
}

function initializeShellSurface() {
  try {
    shellTray = new Tray(createShellTrayIcon());
    shellTraySupported = true;
    shellTrayError = null;
    shellTray.on("click", () => {
      if (shellTray) {
        shellTray.popUpContextMenu();
      }
    });
    refreshShellTrayMenu();
    syncShellRoamingState("shell_startup", true);
    console.log("[pet-shell] tray surface ready");
  } catch (error) {
    shellTray = null;
    shellTraySupported = false;
    shellTrayError = error?.message || String(error);
    console.warn(`[pet-shell] tray surface unavailable: ${shellTrayError}`);
    emitShellState(buildShellStateSnapshot());
    syncShellRoamingState("shell_startup_no_tray", true);
  }
}

function applyRuntimeSettingsPatch(patch, reason = "shell_settings_patch") {
  persistRuntimeSettingsPatch({
    app,
    projectRoot: __dirname,
    patch,
  });
  initializeRuntimeSettings(reason);
  const snapshot = refreshShellTrayMenu();
  return snapshot;
}

async function runShellAction(actionId) {
  try {
    let snapshot = latestShellState || buildShellStateSnapshot();
    if (actionId === SHELL_ACTIONS.openInventory) {
      openInventoryWindow(resolveShellWindowTabForAction(actionId, inventoryWindowActiveTab));
      snapshot = emitShellState(buildShellStateSnapshot());
    } else if (actionId === SHELL_ACTIONS.openStatus) {
      openStatusWindow();
      snapshot = emitShellState(buildShellStateSnapshot());
    } else if (actionId === SHELL_ACTIONS.roamDesktop) {
      snapshot = applyRuntimeSettingsPatch(
        {
          roaming: {
            mode: ROAMING_MODES.desktop,
          },
        },
        "shell_roam_desktop"
      );
      syncShellRoamingState("shell_roam_desktop", true);
    } else if (actionId === SHELL_ACTIONS.roamZone) {
      snapshot = applyRuntimeSettingsPatch(
        {
          roaming: {
            mode: ROAMING_MODES.zone,
            zone: snapshot?.roaming?.zoneRect ? "custom" : snapshot?.roaming?.zone || DEFAULT_ROAMING_ZONE,
          },
        },
        "shell_roam_zone"
      );
      if (!snapshot?.roaming?.zoneRect) {
        openZoneSelectorWindow();
      }
      syncShellRoamingState("shell_roam_zone", true);
    } else if (actionId === SHELL_ACTIONS.selectRoamZone) {
      snapshot = applyRuntimeSettingsPatch(
        {
          roaming: {
            mode: ROAMING_MODES.zone,
            zone: "custom",
          },
        },
        "shell_select_roam_zone"
      );
      openZoneSelectorWindow();
      syncShellRoamingState("shell_select_roam_zone", true);
    } else if (actionId === SHELL_ACTIONS.toggleDiagnostics) {
      snapshot = applyRuntimeSettingsPatch(
        {
          ui: {
            diagnosticsEnabled: !snapshot?.ui?.diagnosticsEnabled,
          },
        },
        "shell_toggle_diagnostics"
      );
    } else if (actionId === SHELL_ACTIONS.toggleHeadphones) {
      snapshot = applyRuntimeSettingsPatch(
        {
          wardrobe: {
            activeAccessories: toggleMembership(
              snapshot?.wardrobe?.activeAccessories,
              SHELL_ACCESSORY_IDS.headphones
            ),
          },
        },
        "shell_toggle_headphones"
      );
    } else if (actionId === SHELL_ACTIONS.togglePoolRing) {
      snapshot = applyRuntimeSettingsPatch(
        {
          inventory: {
            quickProps: toggleMembership(
              snapshot?.inventory?.quickProps,
              SHELL_QUICK_PROP_IDS.poolRing
            ),
          },
        },
        "shell_toggle_pool_ring"
      );
    } else if (actionId === SHELL_ACTIONS.toggleAlwaysShowBubble) {
      snapshot = applyRuntimeSettingsPatch(
        {
          dialog: {
            alwaysShowBubble: !snapshot?.dialog?.alwaysShowBubble,
          },
        },
        "shell_toggle_always_show_bubble"
      );
    } else {
      return {
        ok: false,
        error: "unknown_shell_action",
      };
    }

    return {
      ok: true,
      actionId,
      shellState: latestShellState || snapshot,
    };
  } catch (error) {
    return {
      ok: false,
      actionId,
      error: error?.message || String(error),
    };
  }
}

function getBridgeRequestTimeoutMs() {
  const configured = Number(runtimeSettings?.openclaw?.timeoutMs);
  if (!Number.isFinite(configured) || configured < 200) return 1200;
  return Math.round(configured);
}

function initializeOpenClawBridgeRuntime() {
  const settings = runtimeSettings?.openclaw || {};
  const configuredMode = typeof settings.mode === "string" ? settings.mode : BRIDGE_MODES.online;
  const configuredTransport =
    settings.transport === BRIDGE_TRANSPORTS.http
      ? BRIDGE_TRANSPORTS.http
      : BRIDGE_TRANSPORTS.stub;
  const openclawEnabled = Boolean(settings.enabled);
  const bridgeMode =
    CAPABILITY_TEST_FLAGS.openclawFail || !openclawEnabled ? BRIDGE_MODES.offline : configuredMode;

  openclawBridge = createOpenClawBridge({
    mode: bridgeMode,
    transport: configuredTransport,
    baseUrl: typeof settings.baseUrl === "string" ? settings.baseUrl : "",
    retryCount: Number.isFinite(Number(settings.retryCount))
      ? Math.max(0, Math.round(Number(settings.retryCount)))
      : 0,
    authToken: typeof settings.authToken === "string" ? settings.authToken : null,
    allowNonLoopback: Boolean(settings.allowNonLoopback),
    requestTimeoutMs: getBridgeRequestTimeoutMs(),
    logger: (kind, payload) => {
      console.log(
        `[pet-openclaw] ${kind} correlationId=${payload?.correlationId || "n/a"} route=${
          payload?.route || "n/a"
        } mode=${payload?.mode || bridgeMode} transport=${
          payload?.transport || configuredTransport
        }`
      );
    },
  });
}

function emitIntegrationEvent(payload) {
  if (!payload || typeof payload !== "object") return;
  latestIntegrationEvent = payload;
  emitToRenderer("pet:integration", payload);
}

function setIntegrationProbeState(integrationId, update = {}) {
  if (integrationId !== "spotify" && integrationId !== "freshRss") return;
  const previous = integrationProbeStates[integrationId] || createInitialIntegrationProbeState();
  const next = {
    ...previous,
    ...update,
    state: typeof update.state === "string" ? update.state : previous.state,
    reason: typeof update.reason === "string" ? update.reason : previous.reason,
    fallbackMode:
      typeof update.fallbackMode === "string" ? update.fallbackMode : previous.fallbackMode,
    lastProbeAt: Number.isFinite(update.lastProbeAt)
      ? update.lastProbeAt
      : Number.isFinite(previous.lastProbeAt)
        ? previous.lastProbeAt
        : 0,
    lastSuccessAt: Number.isFinite(update.lastSuccessAt)
      ? update.lastSuccessAt
      : Number.isFinite(previous.lastSuccessAt)
        ? previous.lastSuccessAt
        : 0,
    lastFailureAt: Number.isFinite(update.lastFailureAt)
      ? update.lastFailureAt
      : Number.isFinite(previous.lastFailureAt)
        ? previous.lastFailureAt
        : 0,
    error:
      typeof update.error === "string" || update.error === null ? update.error : previous.error,
  };
  integrationProbeStates = {
    ...integrationProbeStates,
    [integrationId]: next,
  };
  refreshIntegrationCapabilityStates();
}

function getOpenClawAgentProbeOptions() {
  const settings = buildRuntimeSettingsSummary();
  return {
    agentId: settings.openclaw.agentId || DEFAULT_OPENCLAW_AGENT_ID,
    timeoutMs: settings.openclaw.agentTimeoutMs || DEFAULT_OPENCLAW_AGENT_TIMEOUT_MS,
  };
}

async function runAgentProbeWithJson(prompt, label) {
  const options = getOpenClawAgentProbeOptions();
  const envelope = await runOpenClawAgentPrompt({
    agentId: options.agentId,
    timeoutMs: options.timeoutMs,
    prompt,
    logger: (kind, payload) => {
      console.log(
        `[pet-openclaw-agent] ${label} ${kind} agent=${options.agentId} runId=${
          payload?.runId || "n/a"
        } status=${payload?.status || "n/a"}`
      );
    },
  });
  try {
    return {
      ok: true,
      text: envelope.payloadText,
      json: parseJsonPayload(envelope.payloadText),
      envelope,
    };
  } catch {
    return {
      ok: false,
      text: envelope.payloadText,
      failure: detectAgentFailure(envelope.payloadText),
      envelope,
    };
  }
}

function buildSpotifyProbeResponseText(nowPlaying, topArtistSummary, degradedParts = []) {
  const segments = [];
  if (nowPlaying) {
    const outputSuffix =
      nowPlaying.outputRoute && nowPlaying.outputRoute !== "unknown"
        ? ` on ${nowPlaying.outputRoute === "speaker" ? "Speakers" : "Headphones"}`
        : nowPlaying.outputDeviceName && nowPlaying.outputDeviceName !== "unknown_device"
          ? ` on ${nowPlaying.outputDeviceName}`
          : "";
    segments.push(
      `Spotify ${nowPlaying.isPlaying ? "is playing" : "last reported"} ${nowPlaying.trackName} by ${nowPlaying.artistName}${outputSuffix}.`
    );
  }
  if (topArtistSummary?.topArtist) {
    segments.push(`Top artist (${topArtistSummary.timeRange}): ${topArtistSummary.topArtist}.`);
  }
  if (degradedParts.length > 0) {
    segments.push(`Degraded: ${degradedParts.join("; ")}.`);
  }
  return segments.join(" ").trim() || "Spotify probe returned no usable data.";
}

function buildFreshRssResponseText(summary, items = [], degradedReason = null, degradedMessage = null) {
  const normalizedSummary =
    typeof summary === "string" && summary.trim().length > 0
      ? summary.trim()
      : `FreshRSS returned ${items.length} items.`;
  if (!degradedReason) return normalizedSummary;
  const detail =
    typeof degradedMessage === "string" && degradedMessage.trim().length > 0
      ? degradedMessage.trim()
      : degradedReason;
  if (normalizedSummary === detail) {
    return normalizedSummary;
  }
  return `${normalizedSummary} Degraded: ${detail}.`;
}

function deriveIntegrationState(capabilityId) {
  const settings = buildRuntimeSettingsSummary();
  if (capabilityId === CAPABILITY_IDS.spotifyIntegration) {
    return deriveIntegrationCapabilityState("spotify", settings.integrations.spotify, {
      openclawEnabled: settings.openclaw.enabled,
      probeState: integrationProbeStates.spotify,
    });
  }
  if (capabilityId === CAPABILITY_IDS.freshRssIntegration) {
    return deriveIntegrationCapabilityState("freshRss", settings.integrations.freshRss, {
      openclawEnabled: settings.openclaw.enabled,
      probeState: integrationProbeStates.freshRss,
    });
  }
  return null;
}

function refreshIntegrationCapabilityStates() {
  if (!capabilityRegistry) return;
  const spotifyState = deriveIntegrationState(CAPABILITY_IDS.spotifyIntegration);
  if (spotifyState) {
    updateCapabilityState(
      CAPABILITY_IDS.spotifyIntegration,
      spotifyState.state,
      spotifyState.reason,
      spotifyState.details
    );
  }
  const freshRssState = deriveIntegrationState(CAPABILITY_IDS.freshRssIntegration);
  if (freshRssState) {
    updateCapabilityState(
      CAPABILITY_IDS.freshRssIntegration,
      freshRssState.state,
      freshRssState.reason,
      freshRssState.details
    );
  }
}

function emitMemorySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  latestMemorySnapshot = snapshot;
  emitToRenderer("pet:memory", {
    kind: "memorySnapshot",
    snapshot,
    ts: Date.now(),
  });
}

function logMemoryEvent(kind, payload = {}) {
  const suffix =
    payload && typeof payload === "object" ? ` ${JSON.stringify(payload)}` : "";
  console.log(`[pet-memory] ${kind}${suffix}`);
  if (!DIAGNOSTICS_ENABLED) return;
  emitDiagnostics({
    kind: "memoryEvent",
    eventKind: kind,
    payload,
  });
}

async function initializeMemoryPipelineRuntime() {
  const settings = buildRuntimeSettingsSummary();
  if (!settings.memory.enabled) {
    memoryPipeline = null;
    latestMemorySnapshot = {
      requestedAdapterMode: settings.memory.adapterMode,
      activeAdapterMode: "disabled",
      fallbackReason: "memory_disabled",
      localWorkspaceRoot: settings.paths.localWorkspaceRoot,
      openClawWorkspaceRoot: settings.paths.openClawWorkspaceRoot,
      obsidianVaultPath: settings.paths.obsidianVaultRoot,
      openclawEnabled: settings.openclaw.enabled,
      writeLegacyJsonl: settings.memory.writeLegacyJsonl,
      paths: null,
    };
    emitMemorySnapshot(latestMemorySnapshot);
    logMemoryEvent("runtimeDisabled", latestMemorySnapshot);
    return;
  }

  memoryPipeline = createMemoryPipeline({
    workspaceRoot: settings.paths.localWorkspaceRoot,
    paths: {
      localWorkspaceRoot: settings.paths.localWorkspaceRoot,
      openClawWorkspaceRoot: settings.paths.openClawWorkspaceRoot,
      obsidianVaultRoot: settings.paths.obsidianVaultRoot,
    },
    openclawEnabled: settings.openclaw.enabled,
    openclawWorkspaceBootstrapMode: OPENCLAW_WORKSPACE_BOOTSTRAP_MODES.warn_only,
    adapterMode: settings.memory.adapterMode,
    obsidianVaultPath: settings.paths.obsidianVaultRoot,
    mutationTransparencyPolicy: settings.memory.mutationTransparencyPolicy,
    writeLegacyJsonl: settings.memory.writeLegacyJsonl,
    logger: (kind, payload) => {
      logMemoryEvent(kind, payload);
      emitToRenderer("pet:memory", {
        kind,
        payload,
        ts: Date.now(),
      });
    },
  });

  try {
    const snapshot = await memoryPipeline.start();
    emitMemorySnapshot(snapshot);
    logMemoryEvent("runtimeReady", snapshot);
  } catch (error) {
    console.warn(`[pet-memory] runtime initialization failed: ${error?.message || String(error)}`);
    const fallbackSettings = buildRuntimeSettingsSummary();
    latestMemorySnapshot = {
      requestedAdapterMode: fallbackSettings.memory.adapterMode,
      activeAdapterMode: MEMORY_ADAPTER_MODES.local,
      fallbackReason: "startup_failed",
      error: error?.message || String(error),
      localWorkspaceRoot: fallbackSettings.paths.localWorkspaceRoot,
      openClawWorkspaceRoot: fallbackSettings.paths.openClawWorkspaceRoot,
      obsidianVaultPath: fallbackSettings.paths.obsidianVaultRoot,
      openclawEnabled: fallbackSettings.openclaw.enabled,
      writeLegacyJsonl: fallbackSettings.memory.writeLegacyJsonl,
    };
    emitMemorySnapshot(latestMemorySnapshot);
  }
}

function emitContractTrace(trace) {
  if (!trace || typeof trace !== "object") return;
  latestContractTrace = trace;
  emitToRenderer("pet:contract-trace", trace);
}

function logContractTrace(trace) {
  if (!trace || typeof trace !== "object") return;
  const stage = trace.stage || "unknown";
  const payload = trace.payload || {};
  const correlationId = payload.correlationId || "n/a";
  const type = payload.type || "unknown";
  const source = trace.context?.source || "offline";
  console.log(
    `[pet-contract] stage=${stage} type=${type} correlationId=${correlationId} source=${source}`
  );

  if (!DIAGNOSTICS_ENABLED) return;
  emitDiagnostics({
    kind: "contractTrace",
    stage,
    type,
    correlationId,
    source,
    payload,
  });
}

function initializeContractRouter() {
  contractRouter = createPetContractRouter({
    onTrace: (trace) => {
      logContractTrace(trace);
      emitContractTrace(trace);
    },
    announcementCooldownMs: 10000,
  });
}

function initializeDialogRuntime() {
  try {
    dialogTemplateCatalog = loadDialogTemplateCatalog(DEFAULT_DIALOG_TEMPLATES_PATH);
  } catch (error) {
    dialogTemplateCatalog = createDefaultDialogTemplateCatalog();
    console.warn(`[pet-dialog] failed to load offline templates: ${error?.message || String(error)}`);
  }
}

function logStateRuntimeEvent(kind, payload) {
  const safePayload = payload && typeof payload === "object" ? payload : {};
  const stateLabel = safePayload.currentState || safePayload.stateId || "unknown";
  const phaseLabel = safePayload.phase ? ` phase=${safePayload.phase}` : "";
  console.log(`[pet-state] ${kind} state=${stateLabel}${phaseLabel}`);
  if (!DIAGNOSTICS_ENABLED) return;
  emitDiagnostics({
    kind: "stateRuntime",
    event: kind,
    ...safePayload,
  });
}

function initializeStateRuntime() {
  stateRuntime = createStateRuntime({
    catalogPath: STATE_CATALOG_PATH,
    availableClipIds: getAvailableSpriteStateIds(),
    onSnapshot: (snapshot) => {
      emitStateSnapshot(snapshot);
    },
    logger: (kind, payload) => {
      logStateRuntimeEvent(kind, payload);
    },
  });
  latestStateSnapshot = stateRuntime.start();
}

function createContractCorrelationId() {
  const randomPart = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0");
  return `evt-${Date.now().toString(36)}-${randomPart}`;
}

function normalizeUserCommandForBridge(payload) {
  const rawPayload = payload && typeof payload === "object" ? payload : {};
  const explicitType =
    typeof rawPayload.type === "string" ? rawPayload.type.trim().toLowerCase() : "";
  const command = typeof rawPayload.command === "string" ? rawPayload.command.trim().toLowerCase() : "";
  const text = typeof rawPayload.text === "string" ? rawPayload.text.trim().toLowerCase() : "";
  const raw = (explicitType || command || text).replace(/[?!.,]+$/g, "");
  if (raw === "status" || raw === "introspect") return "status";
  if (raw === "what are you doing") return "what-are-you-doing";
  if (raw === "what are you reading") return "what-are-you-reading";
  if (raw === "announce-test" || raw === "announce") return "announce-test";
  if (raw === "bridge-test" || raw === "bridge") return "bridge-test";
  if (raw === "guardrail-test" || raw === "guardrail") return "guardrail-test";
  return raw || "unknown";
}

function extractUserInputText(payload) {
  const rawPayload = payload && typeof payload === "object" ? payload : {};
  if (typeof rawPayload.text === "string" && rawPayload.text.trim().length > 0) {
    return rawPayload.text.trim();
  }
  if (typeof rawPayload.command === "string" && rawPayload.command.trim().length > 0) {
    return rawPayload.command.trim();
  }
  if (typeof rawPayload.type === "string" && rawPayload.type.trim().length > 0) {
    return rawPayload.type.trim();
  }
  return "";
}

function deriveContractSource() {
  const bridgeState = capabilityRegistry?.getCapabilityState(CAPABILITY_IDS.openclawBridge);
  if (bridgeState?.state === CAPABILITY_STATES.healthy) {
    return "online";
  }
  return "offline";
}

function summarizeShellAccessories() {
  const accessories = latestShellState?.wardrobe?.activeAccessories || [];
  return accessories.length > 0 ? accessories.join(",") : "none";
}

function summarizeShellQuickProps() {
  const quickProps = latestShellState?.inventory?.quickProps || [];
  return quickProps.length > 0 ? quickProps.join(",") : "none";
}

function buildStatusText() {
  const runtime = latestCapabilitySnapshot?.runtimeState || "unknown";
  const summary = latestCapabilitySnapshot?.summary || {};
  const spotifyState =
    capabilityRegistry?.getCapabilityState(CAPABILITY_IDS.spotifyIntegration)?.state || "unknown";
  const freshRssState =
    capabilityRegistry?.getCapabilityState(CAPABILITY_IDS.freshRssIntegration)?.state || "unknown";
  const activeState = latestStateSnapshot?.currentState || "Idle";
  const activePhase = latestStateSnapshot?.phase ? `/${latestStateSnapshot.phase}` : "";
  const activeVisual = latestStateSnapshot?.visual?.clip || "IdleReady";
  const fallbackLabel = latestStateSnapshot?.visualFallbackUsed ? "yes" : "no";
  const motionState = dragging ? "dragging" : flingState.active ? "flinging" : "steady";
  const roamMode = latestShellState?.roaming?.mode || ROAMING_MODES.desktop;
  const roamZone = getRoamZoneLabel(latestShellState);
  const diagnosticsLabel = latestShellState?.ui?.diagnosticsEnabled ? "on" : "off";
  return (
    `Runtime ${runtime}. ` +
    `Capabilities healthy=${summary.healthyCount || 0}, ` +
    `degraded=${summary.degradedCount || 0}, failed=${summary.failedCount || 0}. ` +
    `Integrations spotify=${spotifyState}, freshrss=${freshRssState}. ` +
    `Shell roam=${roamMode}${roamMode === ROAMING_MODES.zone ? `:${roamZone}` : ""} diagnostics=${diagnosticsLabel} accessories=${summarizeShellAccessories()} props=${summarizeShellQuickProps()}. ` +
    `State ${activeState}${activePhase} visual=${activeVisual} fallback=${fallbackLabel} motion=${motionState}.`
  );
}

function deriveBridgeCurrentState() {
  return latestStateSnapshot?.currentState || "Idle";
}

function buildActivePropsSummary() {
  const summaries = [];
  const quickProps = latestShellState?.inventory?.quickProps || [];
  if (quickProps.length > 0) {
    summaries.push(`shell:${quickProps.join("+")}`);
  }
  if (!latestExtensionSnapshot || !Array.isArray(latestExtensionSnapshot.extensions)) {
    return summaries.length > 0 ? summaries.join(", ").slice(0, 180) : "none";
  }
  for (const extension of latestExtensionSnapshot.extensions) {
    if (!extension?.valid || !extension?.enabled || !Array.isArray(extension.props)) continue;
    const enabledProps = extension.props.filter((prop) => prop?.enabled).length;
    if (enabledProps <= 0) continue;
    summaries.push(`${extension.extensionId}:${enabledProps}`);
  }
  if (summaries.length <= 0) return "none";
  return summaries.join(", ").slice(0, 180);
}

function buildExtensionContextSummary() {
  const summary = latestExtensionSnapshot?.summary || {};
  return (
    `discovered=${summary.discoveredCount || 0}, ` +
    `valid=${summary.validCount || 0}, enabled=${summary.enabledCount || 0}`
  );
}

function buildBridgeRequestContext() {
  return {
    currentState: deriveBridgeCurrentState(),
    stateContextSummary: latestStateSnapshot?.contextSummary || buildStatusText(),
    activePropsSummary: buildActivePropsSummary(),
    extensionContextSummary: buildExtensionContextSummary(),
    source: deriveContractSource(),
  };
}

function summarizeDialogStateContext() {
  const summary = latestStateSnapshot?.contextSummary || buildStatusText();
  if (typeof summary !== "string" || summary.length <= 0) return "none";
  return summary.slice(0, 180);
}

function buildRecentMediaSummary() {
  if (latestLocalMediaSnapshot?.isPlaying) {
    const title =
      typeof latestLocalMediaSnapshot.title === "string" && latestLocalMediaSnapshot.title.trim().length > 0
        ? latestLocalMediaSnapshot.title.trim()
        : "unknown track";
    const artist =
      typeof latestLocalMediaSnapshot.artist === "string" && latestLocalMediaSnapshot.artist.trim().length > 0
        ? latestLocalMediaSnapshot.artist.trim()
        : "unknown artist";
    const sourceLabel =
      typeof latestLocalMediaSnapshot.sourceAppLabel === "string" &&
      latestLocalMediaSnapshot.sourceAppLabel.trim().length > 0
        ? latestLocalMediaSnapshot.sourceAppLabel.trim()
        : "Windows Media";
    const route =
      typeof latestLocalMediaSnapshot.outputRoute === "string" &&
      latestLocalMediaSnapshot.outputRoute.trim().length > 0
        ? latestLocalMediaSnapshot.outputRoute.trim()
        : "unknown";
    return `${title} by ${artist} via ${sourceLabel} (${route})`.slice(0, 180);
  }
  if (typeof latestIntegrationEvent?.text === "string" && latestIntegrationEvent.text.trim().length > 0) {
    return latestIntegrationEvent.text.trim().slice(0, 180);
  }
  return "no active media";
}

function buildRecentHobbySummary() {
  if (latestStateSnapshot?.currentState === "Reading") {
    const title =
      typeof latestStateSnapshot?.context?.title === "string" && latestStateSnapshot.context.title.trim().length > 0
        ? latestStateSnapshot.context.title.trim()
        : typeof latestStateSnapshot?.context?.titleLabel === "string" &&
            latestStateSnapshot.context.titleLabel.trim().length > 0
          ? latestStateSnapshot.context.titleLabel.trim()
          : "current reading item";
    const sourceLabel =
      typeof latestStateSnapshot?.context?.sourceLabel === "string" &&
      latestStateSnapshot.context.sourceLabel.trim().length > 0
        ? latestStateSnapshot.context.sourceLabel.trim()
        : typeof latestStateSnapshot?.context?.itemType === "string" &&
            latestStateSnapshot.context.itemType.trim().length > 0
          ? latestStateSnapshot.context.itemType.trim()
          : "reading";
    return `${title} from ${sourceLabel}`.slice(0, 180);
  }
  if (
    latestIntegrationEvent?.kind === "freshRssProbe" &&
    typeof latestIntegrationEvent.summary === "string" &&
    latestIntegrationEvent.summary.trim().length > 0
  ) {
    return latestIntegrationEvent.summary.trim().slice(0, 180);
  }
  if (
    latestIntegrationEvent?.kind === "freshRssProbe" &&
    typeof latestIntegrationEvent.text === "string" &&
    latestIntegrationEvent.text.trim().length > 0
  ) {
    return latestIntegrationEvent.text.trim().slice(0, 180);
  }
  return "no recent hobby updates";
}

function buildOfflineDialogFallback(promptText, fallbackMode) {
  const triggerReason = classifyOfflineDialogTrigger(promptText);
  const preferReading =
    triggerReason === "reading" || latestStateSnapshot?.currentState === "Reading";
  const stateDescription = preferReading
    ? stateRuntime?.describeReading?.()
    : stateRuntime?.describeActivity?.();
  const fallbackText =
    stateDescription?.text ||
    (preferReading
      ? buildBridgeFallbackText("state_description", "what-are-you-reading")
      : buildBridgeFallbackText("state_description", "what-are-you-doing"));
  return buildOfflineDialogResponse({
    templates: dialogTemplateCatalog,
    text: promptText,
    currentState: latestStateSnapshot?.currentState || "Idle",
    phase: latestStateSnapshot?.phase || null,
    triggerReason,
    source: "offline",
    fallbackMode,
    stateDescription: fallbackText,
    stateContextSummary: summarizeDialogStateContext(),
    recentMediaSummary: buildRecentMediaSummary(),
    recentHobbySummary: buildRecentHobbySummary(),
  });
}

function createDialogMessageId() {
  const randomPart = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0");
  return `dlg-${Date.now().toString(36)}-${randomPart}`;
}

function appendDialogHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  dialogHistory = [...dialogHistory, entry].slice(-DIALOG_HISTORY_LIMIT);
  return entry;
}

function emitDialogMessage(entry) {
  if (!entry || typeof entry !== "object") return;
  emitToRenderer("pet:dialog-message", entry);
}

function recordDialogUserMessage({ correlationId, text }) {
  const normalizedText = typeof text === "string" ? text.trim() : "";
  if (!normalizedText) return null;
  const entry = appendDialogHistoryEntry({
    messageId: createDialogMessageId(),
    correlationId,
    role: "user",
    kind: "userMessage",
    channel: "dialog",
    source: "local_ui",
    text: normalizedText,
    fallbackMode: "none",
    talkFeedbackMode: "none",
    stateContextSummary: summarizeDialogStateContext(),
    currentState: latestStateSnapshot?.currentState || "Idle",
    phase: latestStateSnapshot?.phase || null,
    ts: Date.now(),
  });
  emitDialogMessage(entry);
  return entry;
}

function recordDialogSuggestion(suggestion) {
  if (!suggestion || typeof suggestion !== "object") return null;
  if (suggestion.type !== "PET_RESPONSE" && suggestion.type !== "PET_ANNOUNCEMENT") return null;
  const text = typeof suggestion.text === "string" ? suggestion.text.trim() : "";
  if (!text) return null;

  const entry = appendDialogHistoryEntry({
    messageId: createDialogMessageId(),
    correlationId:
      typeof suggestion.correlationId === "string" && suggestion.correlationId.length > 0
        ? suggestion.correlationId
        : createContractCorrelationId(),
    role: "pet",
    kind: suggestion.type === "PET_ANNOUNCEMENT" ? "announcement" : "response",
    channel:
      typeof suggestion.channel === "string" && suggestion.channel.trim().length > 0
        ? suggestion.channel.trim()
        : "bubble",
    source:
      typeof suggestion.source === "string" && suggestion.source.trim().length > 0
        ? suggestion.source.trim()
        : "offline",
    text,
    fallbackMode:
      typeof suggestion.fallbackMode === "string" && suggestion.fallbackMode.trim().length > 0
        ? suggestion.fallbackMode.trim()
        : "none",
    talkFeedbackMode: DIALOG_TALK_FEEDBACK_MODE,
    stateContextSummary: summarizeDialogStateContext(),
    currentState: latestStateSnapshot?.currentState || "Idle",
    phase: latestStateSnapshot?.phase || null,
    ts: Number.isFinite(suggestion.ts) ? suggestion.ts : Date.now(),
  });
  emitDialogMessage(entry);
  return entry;
}

function buildBridgeFallbackText(route, promptText) {
  if (route === "introspection_status") {
    return `${buildStatusText()} (offline fallback)`;
  }
  if (route === "state_description") {
    const readingMatch = typeof promptText === "string" && promptText.toLowerCase().includes("reading");
    const description = readingMatch
      ? stateRuntime?.describeReading()
      : stateRuntime?.describeActivity();
    return description?.text || "I am keeping to a safe local fallback.";
  }
  const normalizedPrompt =
    typeof promptText === "string" && promptText.trim().length > 0 ? promptText.trim() : "your request";
  return `Bridge unavailable. Local fallback response for "${normalizedPrompt}".`;
}

function blockBridgeActions(actions, correlationId) {
  if (!Array.isArray(actions) || actions.length <= 0) return [];
  const blockedActionTypes = new Set(["set_state", "render_control", "identity_mutation"]);
  const blocked = [];
  for (const action of actions) {
    const actionType =
      typeof action?.type === "string" ? action.type.trim().toLowerCase() : "unknown";
    if (!blockedActionTypes.has(actionType)) continue;
    blocked.push(actionType);
    console.warn(
      `[pet-openclaw] blocked-action correlationId=${correlationId} action=${actionType} reason=non_authority_guardrail`
    );
    if (DIAGNOSTICS_ENABLED) {
      emitDiagnostics({
        kind: "openclawBlockedAction",
        correlationId,
        actionType,
        reason: "non_authority_guardrail",
      });
    }
  }
  return blocked;
}

async function requestBridgeDialog({ correlationId, route, promptText }) {
  if (!runtimeSettings?.openclaw?.enabled) {
    return {
      source: "offline",
      text: buildBridgeFallbackText(route, promptText),
      fallbackMode: "bridge_disabled",
    };
  }

  if (!openclawBridge) {
    return {
      source: "offline",
      text: buildBridgeFallbackText(route, promptText),
      fallbackMode: "bridge_unavailable",
    };
  }

  try {
    const outcome = await requestWithTimeout(
      openclawBridge.sendDialog({
        correlationId,
        route,
        promptText,
        context: buildBridgeRequestContext(),
      }),
      getBridgeRequestTimeoutMs()
    );

    const blockedActions = blockBridgeActions(outcome?.response?.proposedActions, correlationId);
    const blockedSuffix =
      blockedActions.length > 0 ? ` Blocked actions: ${blockedActions.join(", ")}.` : "";
    updateCapabilityState(
      CAPABILITY_IDS.openclawBridge,
      CAPABILITY_STATES.healthy,
      "requestSuccess",
      {
        mode: openclawBridge.getMode(),
        route,
      }
    );
    refreshIntegrationCapabilityStates();

    return {
      source: outcome?.response?.source || "online",
      text: `${outcome?.response?.text || "OpenClaw response unavailable."}${blockedSuffix}`.trim(),
      fallbackMode: "none",
    };
  } catch (error) {
    const fallbackMode = error?.code || "bridge_unavailable";
    const reason = fallbackMode === "bridge_timeout" ? "requestTimeout" : "requestFailed";
    updateCapabilityState(
      CAPABILITY_IDS.openclawBridge,
      CAPABILITY_STATES.degraded,
      reason,
      {
        mode: openclawBridge.getMode(),
        route,
        fallbackMode,
      }
    );
    refreshIntegrationCapabilityStates();
    console.warn(
      `[pet-openclaw] fallback correlationId=${correlationId} route=${route} reason=${fallbackMode}`
    );
    return {
      source: "offline",
      text: buildBridgeFallbackText(route, promptText),
      fallbackMode,
    };
  }
}

async function buildUserInputContext(eventType, payload, correlationId) {
  const normalizedCommand = normalizeUserCommandForBridge(payload);
  const inputText = extractUserInputText(payload);
  const isGenericUserMessage =
    eventType === "USER_MESSAGE" &&
    normalizedCommand !== "status" &&
    normalizedCommand !== "bridge-test" &&
    normalizedCommand !== "guardrail-test";
  if (normalizedCommand === "announce-test" || normalizedCommand === "unknown") {
    return {};
  }
  if (normalizedCommand === "what-are-you-doing" || normalizedCommand === "what-are-you-reading") {
    const description =
      normalizedCommand === "what-are-you-reading"
        ? stateRuntime?.describeReading()
        : stateRuntime?.describeActivity();
    return {
      source: "offline",
      stateDescriptionText: description?.text || buildBridgeFallbackText("state_description", normalizedCommand),
      bridgeFallbackMode: description?.fallbackUsed ? "state_context_fallback" : "state_local",
    };
  }
  if (
    normalizedCommand !== "status" &&
    normalizedCommand !== "bridge-test" &&
    normalizedCommand !== "guardrail-test" &&
    !isGenericUserMessage
  ) {
    return {};
  }

  const route =
    normalizedCommand === "status"
      ? "introspection_status"
      : isGenericUserMessage
        ? "dialog_user_message"
        : "dialog_user_command";
  const promptText = inputText || normalizedCommand;
  const bridgeResult = await requestBridgeDialog({
    correlationId,
    route,
    promptText,
  });

  if (normalizedCommand === "status") {
    return {
      source: bridgeResult.source,
      statusText: bridgeResult.text,
      bridgeFallbackMode: bridgeResult.fallbackMode,
    };
  }

  if (isGenericUserMessage && bridgeResult.source !== "online") {
    const offlineResult = buildOfflineDialogFallback(promptText, bridgeResult.fallbackMode);
    return {
      source: offlineResult.source,
      bridgeDialogText: offlineResult.text,
      bridgeFallbackMode: offlineResult.fallbackMode,
    };
  }

  return {
    source: bridgeResult.source,
    bridgeDialogText: bridgeResult.text,
    bridgeFallbackMode: bridgeResult.fallbackMode,
  };
}

function extractFirstResponseSuggestion(result) {
  if (!result || !Array.isArray(result.suggestions)) return null;
  return (
    result.suggestions.find((suggestion) => suggestion?.type === "PET_RESPONSE") || null
  );
}

function createMemoryObservationFromContractResult(eventType, payload, result, correlationId) {
  if (eventType === "USER_COMMAND" || eventType === "USER_MESSAGE") {
    const inputText = extractUserInputText(payload);
    const normalizedInput =
      typeof inputText === "string" && inputText.trim().length > 0
        ? inputText.trim().toLowerCase()
        : "unknown";
    const responseSuggestion = extractFirstResponseSuggestion(result);
    return {
      observationType: "question_response",
      source: eventType === "USER_MESSAGE" ? "contract_user_message" : "contract_user_command",
      correlationId,
      evidenceTag: normalizedInput.replace(/\s+/g, "-").slice(0, 80),
      payload: {
        inputType: eventType,
        command: eventType === "USER_COMMAND" ? normalizedInput : null,
        text: inputText || "",
        responseText: responseSuggestion?.text || "",
        responseSource: responseSuggestion?.source || "offline",
        suggestionTypes: Array.isArray(result?.suggestions)
          ? result.suggestions.map((entry) => entry?.type || "unknown")
          : [],
      },
    };
  }

  if (eventType === "EXT_PROP_INTERACTED") {
    const extensionId =
      typeof payload?.extensionId === "string" && payload.extensionId.trim().length > 0
        ? payload.extensionId.trim()
        : "unknown_extension";
    const propId =
      typeof payload?.propId === "string" && payload.propId.trim().length > 0
        ? payload.propId.trim()
        : "unknown_prop";
    return {
      observationType: "hobby_summary",
      source: "extension_prop_interaction",
      correlationId,
      evidenceTag: `${extensionId}:${propId}`,
      payload: {
        extensionId,
        propId,
        interactionType:
          typeof payload?.interactionType === "string" && payload.interactionType.trim().length > 0
            ? payload.interactionType.trim()
            : "click",
      },
    };
  }

  if (eventType === "MEDIA") {
    const title =
      typeof payload?.title === "string" && payload.title.trim().length > 0
        ? payload.title.trim()
        : "unknown_track";
    const artist =
      typeof payload?.artist === "string" && payload.artist.trim().length > 0
        ? payload.artist.trim()
        : "unknown_artist";
    const provider =
      typeof payload?.provider === "string" && payload.provider.trim().length > 0
        ? payload.provider.trim()
        : "media";
    return {
      observationType: provider === "spotify" ? "spotify_playback" : "media_playback",
      source: `${provider}_playback`,
      correlationId,
      evidenceTag: `${provider}:${title}`.toLowerCase().replace(/\s+/g, "-"),
      payload: {
        playing: Boolean(payload?.playing),
        confidence: Number.isFinite(Number(payload?.confidence))
          ? Number(payload.confidence)
          : 0,
        title,
        artist,
        album:
          typeof payload?.album === "string" && payload.album.trim().length > 0
            ? payload.album.trim()
            : "unknown_album",
        provider,
        suggestedState:
          typeof payload?.suggestedState === "string" && payload.suggestedState.trim().length > 0
            ? payload.suggestedState.trim()
            : "MusicChill",
        mediaSource:
          typeof payload?.source === "string" && payload.source.trim().length > 0
            ? payload.source.trim()
            : "media",
        outputRoute:
          typeof payload?.outputRoute === "string" && payload.outputRoute.trim().length > 0
            ? payload.outputRoute.trim()
            : "unknown",
        sourceAppLabel:
          typeof payload?.sourceAppLabel === "string" && payload.sourceAppLabel.trim().length > 0
            ? payload.sourceAppLabel.trim()
            : "Windows Media",
        fallbackMode:
          typeof payload?.fallbackMode === "string" && payload.fallbackMode.trim().length > 0
            ? payload.fallbackMode.trim()
            : "none",
        topArtistSummary:
          payload?.topArtistSummary && typeof payload.topArtistSummary === "object"
            ? payload.topArtistSummary
            : null,
      },
    };
  }

  if (eventType === "FRESHRSS_ITEMS") {
    const fallbackMode =
      typeof payload?.fallbackMode === "string" && payload.fallbackMode.trim().length > 0
        ? payload.fallbackMode.trim()
        : "none";
    if (fallbackMode !== "none") {
      return null;
    }
    const items = Array.isArray(payload?.items) ? payload.items.slice(0, 5) : [];
    return {
      observationType: "freshrss_summary",
      source: "openclaw_freshrss_probe",
      correlationId,
      evidenceTag:
        items.length > 0 && typeof items[0]?.source === "string" && items[0].source.trim().length > 0
          ? items[0].source.trim().toLowerCase().replace(/\s+/g, "-")
          : "freshrss",
      payload: {
        summary:
          typeof payload?.summary === "string" && payload.summary.trim().length > 0
            ? payload.summary.trim()
            : "FreshRSS summary unavailable.",
        items,
        fallbackMode,
      },
    };
  }

  return null;
}

function queueMemoryObservation(observation) {
  if (!memoryPipeline || !observation) return;
  void memoryPipeline
    .recordObservation(observation)
    .then((outcome) => {
      if (!outcome?.ok) return;
      emitToRenderer("pet:memory", {
        kind: "observationWritten",
        observationType: outcome.observation?.observationType || "unknown",
        source: outcome.observation?.source || "local",
        targetPath: outcome.targetPath || null,
        adapterMode: outcome.adapterMode || latestMemorySnapshot?.activeAdapterMode || "local",
        ts: Date.now(),
      });
    })
    .catch((error) => {
      console.warn(`[pet-memory] observation write failed: ${error?.message || String(error)}`);
    });
}

function applyStateRuntimeForEvent(eventType, payload, result) {
  if (!stateRuntime) return null;
  if (eventType === "MEDIA") {
    const intent = Array.isArray(result?.intents)
      ? result.intents.find((entry) => entry?.type === "INTENT_STATE_MUSIC_MODE")
      : null;
    if (!intent) return null;
    return stateRuntime.applyMusicState(payload);
  }
  return null;
}

function handleContractSuggestions(result) {
  if (!result || !Array.isArray(result.suggestions)) return;
  for (const suggestion of result.suggestions) {
    emitToRenderer("pet:contract-suggestion", suggestion);
    recordDialogSuggestion(suggestion);
    if (DIAGNOSTICS_ENABLED) {
      emitDiagnostics({
        kind: "contractSuggestion",
        ...suggestion,
      });
    }
    if (suggestion.type === "PET_ANNOUNCEMENT") {
      console.log(
        `[pet-contract] announcement correlationId=${suggestion.correlationId} reason=${suggestion.reason}`
      );
    }
    if (suggestion.type === "PET_ANNOUNCEMENT_SKIPPED") {
      console.log(
        `[pet-contract] announcement-skipped correlationId=${suggestion.correlationId} reason=${suggestion.reason} skipReason=${suggestion.skipReason}`
      );
    }
    if (suggestion.type === "PET_RESPONSE") {
      const text =
        typeof suggestion.text === "string" && suggestion.text.length > 0
          ? suggestion.text.slice(0, 120)
          : "";
      console.log(
        `[pet-contract] response correlationId=${suggestion.correlationId} mode=${suggestion.mode || "text"} text="${text}"`
      );
    }
  }
}

async function processPetContractEvent(eventType, payload = {}, context = {}) {
  if (!contractRouter) {
    return {
      ok: false,
      error: "contract_router_unavailable",
    };
  }

  const correlationId =
    typeof context?.correlationId === "string" && context.correlationId.length > 0
      ? context.correlationId
      : createContractCorrelationId();
  const bridgeContext =
    eventType === "USER_COMMAND" || eventType === "USER_MESSAGE"
      ? await buildUserInputContext(eventType, payload, correlationId)
      : {};
  const result = contractRouter.processEvent(
    {
      type: eventType,
      payload,
      correlationId,
    },
    {
      source: deriveContractSource(),
      statusText: buildStatusText(),
      announcementCooldownMsByReason: {
        manual_test: 5000,
      },
      ...bridgeContext,
      ...context,
    }
  );
  applyStateRuntimeForEvent(eventType, payload, result);
  handleContractSuggestions(result);
  queueMemoryObservation(
    createMemoryObservationFromContractResult(eventType, payload, result, correlationId)
  );
  return result;
}

async function probeSpotifyIntegration(options = {}) {
  const settings = buildRuntimeSettingsSummary();
  const correlationId = createContractCorrelationId();
  const nowMs = Date.now();
  const routeContractEvent = options.routeContractEvent !== false;
  const queueObservation = options.queueObservation !== false;
  const preferredOutputContext = options.preferredOutputContext || getPreferredSpotifyOutputContext();

  if (!settings.openclaw.enabled || !settings.integrations.spotify.enabled) {
    const reason = !settings.integrations.spotify.enabled ? "disabledByConfig" : "openclawDisabledFallback";
    setIntegrationProbeState("spotify", {
      state: "degraded",
      reason,
      fallbackMode: reason,
      lastProbeAt: nowMs,
      lastFailureAt: nowMs,
      error: reason,
    });
    const integrationEvent = {
      kind: "spotifyProbe",
      correlationId,
      provider: "spotify",
      fallbackMode: reason,
      source: "offline",
      capabilityState: "degraded",
      text: "Spotify probe is unavailable because integration or OpenClaw is disabled.",
      ts: nowMs,
    };
    emitIntegrationEvent(integrationEvent);
    return {
      ok: false,
      error: reason,
      probe: integrationEvent,
    };
  }

  if (!settings.integrations.spotify.available) {
    setIntegrationProbeState("spotify", {
      state: "degraded",
      reason: "providerUnavailable",
      fallbackMode: "spotify_provider_unavailable",
      lastProbeAt: nowMs,
      lastFailureAt: nowMs,
      error: "provider unavailable by config",
    });
    const integrationEvent = {
      kind: "spotifyProbe",
      correlationId,
      provider: "spotify",
      fallbackMode: "spotify_provider_unavailable",
      source: "offline",
      capabilityState: "degraded",
      text: "Spotify probe is configured unavailable.",
      ts: nowMs,
    };
    emitIntegrationEvent(integrationEvent);
    return {
      ok: false,
      error: "providerUnavailable",
      probe: integrationEvent,
    };
  }

  const degradedParts = [];
  let nowPlaying = null;
  let topArtistSummary = null;

  try {
    const nowPlayingProbe = await runAgentProbeWithJson(
      buildSpotifyNowPlayingPrompt(),
      "spotify-now-playing"
    );
    if (nowPlayingProbe.ok) {
      nowPlaying = applyPreferredOutputContext(
        normalizeSpotifyNowPlayingPayload(nowPlayingProbe.json),
        preferredOutputContext
      );
    } else {
      degradedParts.push(`now_playing=${nowPlayingProbe.failure.reason}`);
    }
  } catch (error) {
    degradedParts.push(`now_playing=${detectAgentFailure("", error).reason}`);
  }

  try {
    const topArtistProbe = await runAgentProbeWithJson(
      buildSpotifyTopArtistPrompt(),
      "spotify-top-artist"
    );
    if (topArtistProbe.ok) {
      topArtistSummary = normalizeSpotifyTopArtistPayload(topArtistProbe.json);
    } else {
      degradedParts.push(`top_artist=${topArtistProbe.failure.reason}`);
    }
  } catch (error) {
    degradedParts.push(`top_artist=${detectAgentFailure("", error).reason}`);
  }

  const succeeded = Boolean(nowPlaying && topArtistSummary);
  const fallbackMode = succeeded ? "none" : degradedParts[0] || "spotify_probe_failed";
  const responseText = buildSpotifyProbeResponseText(nowPlaying, topArtistSummary, degradedParts);

  if (succeeded) {
    setIntegrationProbeState("spotify", {
      state: "healthy",
      reason: "probeHealthy",
      fallbackMode: "none",
      lastProbeAt: nowMs,
      lastSuccessAt: nowMs,
      error: null,
    });
  } else {
    setIntegrationProbeState("spotify", {
      state: "degraded",
      reason: fallbackMode,
      fallbackMode,
      lastProbeAt: nowMs,
      lastFailureAt: nowMs,
      error: responseText,
    });
  }

  const mediaEventPayload = nowPlaying
    ? {
        playing: Boolean(nowPlaying.isPlaying),
        confidence: succeeded ? 0.98 : 0.8,
        provider: "spotify",
        source: "spotify",
        title: nowPlaying.trackName,
        artist: nowPlaying.artistName,
        album: nowPlaying.albumName,
        suggestedState: "MusicChill",
        activeProp:
          nowPlaying.outputRoute === "speaker"
            ? "speaker"
            : nowPlaying.outputRoute === "headphones"
              ? "headphones"
              : "musicNote",
        outputRoute: nowPlaying.outputRoute || "unknown",
        outputDeviceName: nowPlaying.outputDeviceName || "unknown_device",
        outputDeviceType: nowPlaying.outputDeviceType || "unknown",
        sourceAppLabel: latestLocalMediaSnapshot?.sourceAppLabel || "Spotify",
        entryDialogue: responseText,
        fallbackMode,
        topArtistSummary,
      }
    : null;

  let contractResult = null;
  if (mediaEventPayload && routeContractEvent) {
    contractResult = await processPetContractEvent(
      "MEDIA",
      mediaEventPayload,
      {
        correlationId,
        source: succeeded ? "online" : "offline",
        mediaResponseText: responseText,
        mediaSuggestedState: "MusicChill",
        integrationFallbackMode: fallbackMode,
      }
    );
  } else if (mediaEventPayload && queueObservation) {
    queueMemoryObservation(
      createMemoryObservationFromContractResult("MEDIA", mediaEventPayload, null, correlationId)
    );
  }

  const integrationEvent = {
    kind: "spotifyProbe",
    correlationId,
    provider: "spotify",
    nowPlaying,
    topArtistSummary,
    fallbackMode,
    source: succeeded ? "online" : "offline",
    capabilityState: succeeded ? "healthy" : "degraded",
    outputRoute: nowPlaying?.outputRoute || "unknown",
    outputDeviceName: nowPlaying?.outputDeviceName || "unknown_device",
    degradedParts,
    trigger:
      typeof options.trigger === "string" && options.trigger.trim().length > 0
        ? options.trigger.trim()
        : routeContractEvent
          ? "interactive"
          : "background",
    text: responseText,
    ts: nowMs,
  };
  console.log(
    `[pet-integration] spotify probe correlationId=${correlationId} state=${integrationEvent.capabilityState} fallback=${fallbackMode}`
  );
  emitIntegrationEvent(integrationEvent);
  return {
    ok: succeeded,
    correlationId,
    probe: integrationEvent,
    contractResult,
  };
}

async function probeFreshRssIntegration(options = {}) {
  const settings = buildRuntimeSettingsSummary();
  const correlationId = createContractCorrelationId();
  const nowMs = Date.now();
  const routeContractEvent = options.routeContractEvent !== false;
  const queueObservation = options.queueObservation !== false;

  if (!settings.openclaw.enabled || !settings.integrations.freshRss.enabled) {
    const reason = !settings.integrations.freshRss.enabled ? "disabledByConfig" : "openclawDisabledFallback";
    setIntegrationProbeState("freshRss", {
      state: "degraded",
      reason,
      fallbackMode: reason,
      lastProbeAt: nowMs,
      lastFailureAt: nowMs,
      error: reason,
    });
    const integrationEvent = {
      kind: "freshRssProbe",
      correlationId,
      provider: "freshRss",
      fallbackMode: reason,
      source: "offline",
      capabilityState: "degraded",
      text: "FreshRSS probe is unavailable because integration or OpenClaw is disabled.",
      ts: nowMs,
    };
    emitIntegrationEvent(integrationEvent);
    return {
      ok: false,
      error: reason,
      probe: integrationEvent,
    };
  }

  if (!settings.integrations.freshRss.available) {
    setIntegrationProbeState("freshRss", {
      state: "degraded",
      reason: "providerUnavailable",
      fallbackMode: "freshrss_provider_unavailable",
      lastProbeAt: nowMs,
      lastFailureAt: nowMs,
      error: "provider unavailable by config",
    });
    const integrationEvent = {
      kind: "freshRssProbe",
      correlationId,
      provider: "freshRss",
      fallbackMode: "freshrss_provider_unavailable",
      source: "offline",
      capabilityState: "degraded",
      text: "FreshRSS probe is configured unavailable.",
      ts: nowMs,
    };
    emitIntegrationEvent(integrationEvent);
    return {
      ok: false,
      error: "providerUnavailable",
      probe: integrationEvent,
    };
  }

  let normalized = null;
  let failure = null;
  try {
    const probe = await runAgentProbeWithJson(buildFreshRssPrompt(), "freshrss-latest");
    if (probe.ok) {
      normalized = normalizeFreshRssPayload(probe.json);
      failure = detectFreshRssPayloadFailure(normalized);
    } else {
      failure = probe.failure;
    }
  } catch (error) {
    failure = detectAgentFailure("", error);
  }

  const succeeded = Boolean(
    normalized &&
      !failure &&
      (normalized.items.length > 0 || normalized.summary === "FreshRSS returned no recent items.")
  );
  const fallbackMode = succeeded ? "none" : failure?.reason || "freshrss_probe_failed";
  const responseText = buildFreshRssResponseText(
    normalized?.summary || "",
    normalized?.items || [],
    succeeded ? null : failure?.reason || "probe failed",
    succeeded ? null : failure?.message || null
  );

  if (succeeded) {
    setIntegrationProbeState("freshRss", {
      state: "healthy",
      reason: "probeHealthy",
      fallbackMode: "none",
      lastProbeAt: nowMs,
      lastSuccessAt: nowMs,
      error: null,
    });
  } else {
    setIntegrationProbeState("freshRss", {
      state: "degraded",
      reason: fallbackMode,
      fallbackMode,
      lastProbeAt: nowMs,
      lastFailureAt: nowMs,
      error: failure?.message || responseText,
    });
  }

  const freshRssEventPayload = normalized
    ? {
        summary: normalized.summary,
        items: normalized.items,
        fallbackMode,
      }
    : null;

  let contractResult = null;
  if (freshRssEventPayload && routeContractEvent) {
    contractResult = await processPetContractEvent(
      "FRESHRSS_ITEMS",
      freshRssEventPayload,
      {
        correlationId,
        source: succeeded ? "online" : "offline",
        freshRssResponseText: responseText,
      }
    );
  } else if (freshRssEventPayload && queueObservation) {
    queueMemoryObservation(
      createMemoryObservationFromContractResult(
        "FRESHRSS_ITEMS",
        freshRssEventPayload,
        null,
        correlationId
      )
    );
  }
  if (routeContractEvent && succeeded && normalized?.items?.length > 0 && stateRuntime) {
    stateRuntime.applyFreshRssReading({
      items: normalized.items,
    });
  }

  const integrationEvent = {
    kind: "freshRssProbe",
    correlationId,
    provider: "freshRss",
    summary: normalized?.summary || null,
    items: normalized?.items || [],
    fallbackMode,
    source: succeeded ? "online" : "offline",
    capabilityState: succeeded ? "healthy" : "degraded",
    trigger:
      typeof options.trigger === "string" && options.trigger.trim().length > 0
        ? options.trigger.trim()
        : routeContractEvent
          ? "interactive"
          : "background",
    text: responseText,
    ts: nowMs,
  };
  console.log(
    `[pet-integration] freshrss probe correlationId=${correlationId} state=${integrationEvent.capabilityState} fallback=${fallbackMode}`
  );
  emitIntegrationEvent(integrationEvent);
  return {
    ok: succeeded,
    correlationId,
    probe: integrationEvent,
    contractResult,
  };
}

async function runBackgroundSpotifyEnrichment(snapshot, trigger = "background-local-media") {
  const settings = buildRuntimeSettingsSummary();
  if (!settings.openclaw.enabled || !settings.integrations.spotify.enabled) return null;
  if (!settings.integrations.spotify.available) return null;
  if (!settings.integrations.spotify.backgroundEnrichmentEnabled) return null;
  if (!snapshot?.isPlaying || snapshot.provider !== "spotify") return null;
  if (spotifyBackgroundProbeInFlight) return null;
  const nowMs = Date.now();
  if (nowMs - lastSpotifyBackgroundProbeAt < getSpotifyBackgroundPollCadenceMs()) {
    return null;
  }

  spotifyBackgroundProbeInFlight = true;
  lastSpotifyBackgroundProbeAt = nowMs;
  try {
    return await probeSpotifyIntegration({
      routeContractEvent: false,
      queueObservation: true,
      preferredOutputContext: snapshot,
      trigger,
    });
  } finally {
    spotifyBackgroundProbeInFlight = false;
  }
}

async function pollLocalMediaState(options = {}) {
  const sensorSettings = getLocalMediaSensorSettings();
  const force = options.force === true;
  const trigger = typeof options.trigger === "string" ? options.trigger : "interval";
  const correlationId = createContractCorrelationId();
  const previousSnapshot = latestLocalMediaSnapshot || createInitialLocalMediaSnapshot();

  if (!sensorSettings.enabled) {
    const disabledSnapshot = createInitialLocalMediaSnapshot();
    disabledSnapshot.playbackStatus = "Disabled";
    disabledSnapshot.error = "disabled_by_config";
    latestLocalMediaSnapshot = disabledSnapshot;
    if (force) {
      emitIntegrationEvent(buildLocalMediaIntegrationEvent(disabledSnapshot, { correlationId }));
    }
    return {
      ok: false,
      error: "disabled_by_config",
      snapshot: disabledSnapshot,
    };
  }

  if (localMediaProbeInFlight) {
    return {
      ok: false,
      skipped: true,
      error: "probe_in_flight",
      snapshot: previousSnapshot,
    };
  }

  localMediaProbeInFlight = true;
  try {
    const snapshot = await probeWindowsMediaState({
      settings: sensorSettings,
    });
    latestLocalMediaSnapshot = snapshot;
    emitIntegrationEvent(buildLocalMediaIntegrationEvent(snapshot, { correlationId }));

    const nextEventKey = buildLocalMediaProbeKey(snapshot);
    const changed = force || nextEventKey !== lastLocalMediaEventKey;
    let contractResult = null;
    if (changed) {
      lastLocalMediaEventKey = nextEventKey;

      if (snapshot.ok && snapshot.isPlaying) {
        const payload = buildLocalMediaEventPayload(snapshot);
        contractResult = await processPetContractEvent("MEDIA", payload, {
          correlationId,
          source: "local",
          mediaResponseText: buildLocalMediaResponseText(snapshot),
          mediaSuggestedState: "MusicChill",
          integrationFallbackMode: "none",
        });
      }
    }

    if (
      previousSnapshot.ok &&
      previousSnapshot.isPlaying &&
      snapshot.ok &&
      !snapshot.isPlaying &&
      isMusicStateId(latestStateSnapshot?.currentState) &&
      stateRuntime
    ) {
      stateRuntime.activateState("Idle", {
        source: "system",
        reason: "local_media_stopped",
        trigger: "local-media",
      });
    }

    if (snapshot.isPlaying) {
      void runBackgroundSpotifyEnrichment(snapshot, `local-media-${trigger}`);
    }

    return {
      ok: snapshot.ok && (!changed || !snapshot.isPlaying || Boolean(contractResult) || force),
      snapshot,
      contractResult,
      error: snapshot.error || null,
    };
  } finally {
    localMediaProbeInFlight = false;
  }
}

async function runBackgroundFreshRssProbe(trigger = "background-poll") {
  const settings = buildRuntimeSettingsSummary();
  if (!settings.openclaw.enabled || !settings.integrations.freshRss.enabled) return null;
  if (!settings.integrations.freshRss.available) return null;
  if (!settings.integrations.freshRss.backgroundEnrichmentEnabled) return null;
  if (freshRssBackgroundProbeInFlight) return null;
  freshRssBackgroundProbeInFlight = true;
  try {
    return await probeFreshRssIntegration({
      routeContractEvent: false,
      queueObservation: true,
      trigger,
    });
  } finally {
    freshRssBackgroundProbeInFlight = false;
  }
}

function startLocalMediaPoller() {
  if (localMediaPollTimer) {
    clearInterval(localMediaPollTimer);
    localMediaPollTimer = null;
  }
  const settings = getLocalMediaSensorSettings();
  if (!settings.enabled || process.platform !== "win32") return;
  void pollLocalMediaState({
    force: true,
    trigger: "startup",
  });
  localMediaPollTimer = setInterval(() => {
    void pollLocalMediaState({
      trigger: "interval",
    });
  }, settings.pollIntervalMs);
}

function startBackgroundFreshRssPoller() {
  if (freshRssPollTimer) {
    clearInterval(freshRssPollTimer);
    freshRssPollTimer = null;
  }
  const settings = buildRuntimeSettingsSummary();
  if (!settings.integrations.freshRss.backgroundEnrichmentEnabled) return;
  if (!settings.openclaw.enabled || !settings.integrations.freshRss.enabled) return;
  if (!settings.integrations.freshRss.available) return;
  freshRssPollTimer = setInterval(() => {
    void runBackgroundFreshRssProbe("background-interval");
  }, getFreshRssBackgroundPollCadenceMs());
}

async function recordTrackRating(payload = {}) {
  if (!memoryPipeline) {
    return {
      ok: false,
      error: "memory_pipeline_unavailable",
    };
  }
  const correlationId = createContractCorrelationId();
  const observation = createTrackRatingObservation(payload, correlationId);
  const outcome = await memoryPipeline.recordObservation(observation);
  const integrationEvent = {
    kind: "trackRatingRecorded",
    correlationId,
    provider: observation.payload.provider,
    trackTitle: observation.payload.trackTitle,
    artist: observation.payload.artist,
    rating: observation.payload.rating,
    targetPath: outcome?.targetPath || null,
    adapterMode: outcome?.adapterMode || latestMemorySnapshot?.activeAdapterMode || "local",
    ts: Date.now(),
  };
  emitIntegrationEvent(integrationEvent);
  emitToRenderer("pet:memory", integrationEvent);
  return outcome;
}

function pointInBounds(point, bounds) {
  return (
    point.x >= bounds.x &&
    point.x < bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y < bounds.y + bounds.height
  );
}

function getDisplayContainingPoint(point) {
  for (const display of screen.getAllDisplays()) {
    if (pointInBounds(point, display.bounds)) {
      return display;
    }
  }

  return null;
}

function resolveDragDisplay(cursor) {
  const containingDisplay = getDisplayContainingPoint(cursor);
  if (containingDisplay) {
    dragDisplayId = containingDisplay.id;
    return { display: containingDisplay, source: "containing" };
  }

  if (dragDisplayId !== null) {
    const previousDisplay = screen.getAllDisplays().find((display) => display.id === dragDisplayId);
    if (previousDisplay) {
      return { display: previousDisplay, source: "stickyPrevious" };
    }
  }

  const nearestDisplay = screen.getDisplayNearestPoint(cursor);
  dragDisplayId = nearestDisplay.id;
  return { display: nearestDisplay, source: "nearestFallback" };
}

function createWindow() {
  activePetVisualBounds = { ...PET_VISUAL_BOUNDS };
  activePetBoundsUpdatedAtMs = 0;

  win = new BrowserWindow({
    width: WINDOW_SIZE.width,
    height: WINDOW_SIZE.height,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.setMinimumSize(WINDOW_SIZE.width, WINDOW_SIZE.height);
  win.setMaximumSize(WINDOW_SIZE.width, WINDOW_SIZE.height);

  win.loadFile("index.html");
  win.webContents.once("did-finish-load", () => {
    updateCapabilityState(CAPABILITY_IDS.renderer, CAPABILITY_STATES.healthy, "didFinishLoad", {
      windowId: win?.id || null,
    });
    if (latestCapabilitySnapshot) {
      emitCapabilitySnapshot(latestCapabilitySnapshot);
    }
    if (latestExtensionSnapshot) {
      emitExtensionSnapshot(latestExtensionSnapshot);
    }
    if (latestContractTrace) {
      emitContractTrace(latestContractTrace);
    }
    if (latestMemorySnapshot) {
      emitMemorySnapshot(latestMemorySnapshot);
    }
    if (latestStateSnapshot) {
      emitStateSnapshot(latestStateSnapshot);
    }
    if (latestIntegrationEvent) {
      emitIntegrationEvent(latestIntegrationEvent);
    }
    emitShellState(latestShellState || buildShellStateSnapshot());
    resetMotionSampleFromWindow();
    emitMotionState({
      velocityOverride: { vx: 0, vy: 0 },
      collided: { x: false, y: false },
      impact: { triggered: false, strength: 0 },
    });
    emitCursorState();
  });

  logDiagnostics("window-created", {
    windowSize: WINDOW_SIZE,
    petVisualBounds: PET_VISUAL_BOUNDS,
    activePetVisualBounds,
    petBoundsStaleMs: PET_BOUNDS_STALE_MS,
    clampAreaType: CLAMP_TO_WORK_AREA ? "workArea" : "bounds",
    flingPreset: ACTIVE_FLING_PRESET,
    flingConfig: FLING_CONFIG,
    displays: summarizeDisplays(),
  });
}

ipcMain.on("pet:setPosition", (_event, x, y) => {
  if (!win) return;

  const targetPoint = {
    x: Math.round(x + WINDOW_SIZE.width / 2),
    y: Math.round(y + WINDOW_SIZE.height / 2),
  };
  const display = screen.getDisplayNearestPoint(targetPoint);
  const petBounds = getActivePetVisualBounds(Date.now());
  const clamped = clampWindowPosition(x, y, getClampArea(display), petBounds);
  applyWindowBounds(clamped.x, clamped.y);
  emitMotionState({
    collided: { x: false, y: false },
    impact: { triggered: false, strength: 0 },
  });
});

ipcMain.on("pet:beginDrag", () => {
  if (!win) return;

  cancelFling("grabbed");
  clearDragSamples();

  const cursor = screen.getCursorScreenPoint();
  const [winX, winY] = win.getPosition();
  const windowBounds = win.getBounds();
  const displayDecision = resolveDragDisplay(cursor);

  dragOffset = {
    x: cursor.x - winX,
    y: cursor.y - winY,
  };
  dragTick = 0;
  dragging = true;
  dragClampLatch = createDragClampLatch();
  recordDragSample(winX, winY);
  if (DIAGNOSTICS_ENABLED) {
    const payload = {
      kind: "beginDrag",
      cursor,
      windowPosition: { x: winX, y: winY },
      windowBounds: summarizeBounds(windowBounds),
      clampAreaType: CLAMP_TO_WORK_AREA ? "workArea" : "bounds",
      clampArea: summarizeBounds(getClampArea(displayDecision.display)),
      dragOffset,
      displaySource: displayDecision.source,
      activeDisplay: summarizeDisplay(displayDecision.display),
      displays: summarizeDisplays(),
    };

    logDiagnostics("begin-drag", payload);
    emitDiagnostics(payload);
  }
  emitMotionState({
    velocityOverride: { vx: 0, vy: 0 },
    collided: { x: false, y: false },
    impact: { triggered: false, strength: 0 },
  });
});

ipcMain.on("pet:endDrag", () => {
  dragging = false;
  dragDisplayId = null;
  dragClampLatch = createDragClampLatch();
  if (DIAGNOSTICS_ENABLED) {
    const payload = { kind: "endDrag" };
    logDiagnostics("end-drag", payload);
    emitDiagnostics(payload);
  }

  maybeExitZoneRoamAfterManualMove("manual_drag_exit_zone");
  maybeStartFlingFromSamples();
  if (!flingState.active) {
    emitMotionState({
      velocityOverride: { vx: 0, vy: 0 },
      collided: { x: false, y: false },
      impact: { triggered: false, strength: 0 },
    });
  }
  clearDragSamples();
});

ipcMain.on("pet:drag", () => {
  if (!win || !dragging) return;

  dragTick += 1;

  const nowMs = Date.now();
  const cursor = screen.getCursorScreenPoint();
  const [winX, winY] = win.getPosition();
  const targetX = cursor.x - dragOffset.x;
  const targetY = cursor.y - dragOffset.y;
  const displayDecision = resolveDragDisplay(cursor);
  const clampArea = getClampArea(displayDecision.display);
  const petBounds = getActivePetVisualBounds(nowMs);
  const rawClamp = clampWindowPosition(targetX, targetY, clampArea, petBounds);
  const clamped = applyDragClampHysteresis({
    targetX,
    targetY,
    rawClampedX: rawClamp.x,
    rawClampedY: rawClamp.y,
    range: rawClamp.range,
    latch: dragClampLatch,
    hysteresisPx: DRAG_CLAMP_HYSTERESIS_PX,
  });
  dragClampLatch = clamped.latch;
  const roundedTarget = { x: Math.round(targetX), y: Math.round(targetY) };
  const clampedX = clamped.x !== roundedTarget.x;
  const clampedY = clamped.y !== roundedTarget.y;
  const boundsResult = applyWindowBounds(clamped.x, clamped.y);
  recordDragSample(boundsResult.contentAfter?.x ?? clamped.x, boundsResult.contentAfter?.y ?? clamped.y);

  if (DIAGNOSTICS_ENABLED) {
    const payload = {
      kind: "drag",
      tick: dragTick,
      cursor,
      windowPositionBefore: { x: winX, y: winY },
      target: roundedTarget,
      clamped: { x: clamped.x, y: clamped.y },
      rawClamped: { x: rawClamp.x, y: rawClamp.y },
      clampHit: { x: clampedX, y: clampedY },
      clampLatch: dragClampLatch,
      activePetBounds: petBounds,
      clampAreaType: CLAMP_TO_WORK_AREA ? "workArea" : "bounds",
      clampArea: summarizeBounds(clampArea),
      windowBoundsBefore: boundsResult.windowBefore,
      windowBoundsAfter: boundsResult.windowAfter,
      contentBoundsBefore: boundsResult.contentBefore,
      contentBoundsAfter: boundsResult.contentAfter,
      sizeCorrected: boundsResult.sizeCorrected,
      dragOffset,
      displaySource: displayDecision.source,
      activeDisplay: summarizeDisplay(displayDecision.display),
    };

    emitDiagnostics(payload);
    if (dragTick % DRAG_LOG_SAMPLE_EVERY === 0 || clampedX || clampedY) {
      logDiagnostics("drag", payload);
    }
    if (boundsResult.sizeCorrected) {
      logDiagnostics("size-corrected", payload);
    }
  }

  emitMotionState({
    collided: { x: clampedX, y: clampedY },
    impact: { triggered: false, strength: 0 },
  });
});

ipcMain.on("pet:setVisibleBounds", (_event, bounds) => {
  const normalized = normalizePetBounds(bounds, WINDOW_SIZE);
  if (!normalized) return;
  activePetVisualBounds = {
    x: normalized.x,
    y: normalized.y,
    width: normalized.width,
    height: normalized.height,
  };
  activePetBoundsUpdatedAtMs = Math.max(0, normalized.tMs);
});

ipcMain.on("pet:setIgnoreMouseEvents", (_event, payload) => {
  if (!win || win.isDestroyed()) return;

  const ignore = Boolean(payload?.ignore);
  const forward = Boolean(payload?.forward);

  if (ignore) {
    win.setIgnoreMouseEvents(true, forward ? { forward: true } : undefined);
    return;
  }

  win.setIgnoreMouseEvents(false);
});

ipcMain.handle("pet:getPosition", () => {
  if (!win) return { x: 0, y: 0 };
  const [x, y] = win.getPosition();
  return { x, y };
});

ipcMain.handle("pet:getConfig", () => {
  const settingsSummary = buildRuntimeSettingsSummary();
  return {
    diagnosticsEnabled: DIAGNOSTICS_ENABLED,
    clampToWorkArea: CLAMP_TO_WORK_AREA,
    flingPreset: ACTIVE_FLING_PRESET,
    flingEnabled: FLING_CONFIG.enabled,
    availableFlingPresets: Object.keys(FLING_PRESETS),
    layout: PET_LAYOUT,
    capabilityRuntimeState: latestCapabilitySnapshot?.runtimeState || "unknown",
    capabilitySummary: latestCapabilitySnapshot?.summary || null,
    stateCurrentState: latestStateSnapshot?.currentState || "Idle",
    statePhase: latestStateSnapshot?.phase || null,
    stateVisualClip: latestStateSnapshot?.visual?.clip || "IdleReady",
    stateVisualFallbackUsed: Boolean(latestStateSnapshot?.visualFallbackUsed),
    contractTraceStage: latestContractTrace?.stage || null,
    memoryAdapterMode: latestMemorySnapshot?.activeAdapterMode || "unknown",
    memoryFallbackReason: latestMemorySnapshot?.fallbackReason || "none",
    localMediaPlaying: Boolean(latestLocalMediaSnapshot?.isPlaying),
    localMediaSource: latestLocalMediaSnapshot?.sourceAppLabel || "Windows Media",
    localMediaOutputRoute: latestLocalMediaSnapshot?.outputRoute || "unknown",
    openclawEnabled: settingsSummary.openclaw.enabled,
    openclawTransport: settingsSummary.openclaw.transport,
    openclawMode: settingsSummary.openclaw.mode,
    openclawBaseUrl: settingsSummary.openclaw.baseUrl,
    openclawLoopbackEndpoint: settingsSummary.openclaw.loopbackEndpoint,
    openclawAuthTokenConfigured: settingsSummary.openclaw.authTokenConfigured,
    settingsSummary,
    shellState: latestShellState || buildShellStateSnapshot(),
    settingsSourceMap: runtimeSettingsSourceMap,
    settingsValidationWarnings: runtimeSettingsValidationWarnings,
    settingsValidationErrors: runtimeSettingsValidationErrors,
    settingsFiles: runtimeSettingsFiles,
  };
});

ipcMain.handle("pet:getShellState", () => {
  return latestShellState || buildShellStateSnapshot();
});

ipcMain.handle("pet:getObservabilitySnapshot", () => {
  return buildCurrentObservabilitySnapshot();
});

ipcMain.handle("pet:runShellAction", (_event, payload) => {
  const actionId =
    typeof payload?.actionId === "string" && payload.actionId.trim().length > 0
      ? payload.actionId.trim()
      : "";
  return runShellAction(actionId);
});

ipcMain.handle("inventory:setActiveTab", (_event, payload) => {
  const nextTab = normalizeShellWindowTab(payload?.tabId, inventoryWindowActiveTab);
  const snapshot = setInventoryWindowActiveTab(nextTab, true);
  return {
    ok: true,
    tabId: nextTab,
    shellState: snapshot,
  };
});

ipcMain.handle("inventory:beginPropPlacement", (_event, payload) => {
  const propId =
    typeof payload?.propId === "string" && payload.propId.trim().length > 0
      ? payload.propId.trim()
      : "";
  return beginPropPlacement(propId);
});

ipcMain.handle("inventory:updatePropPlacement", (_event, payload) => {
  const propId =
    typeof payload?.propId === "string" && payload.propId.trim().length > 0
      ? payload.propId.trim()
      : "";
  return updatePropPlacement(propId);
});

ipcMain.handle("inventory:endPropPlacement", (_event, payload) => {
  const propId =
    typeof payload?.propId === "string" && payload.propId.trim().length > 0
      ? payload.propId.trim()
      : "";
  return endPropPlacement(propId, payload?.commit !== false);
});

ipcMain.handle("zoneSelector:getModel", () => {
  return buildZoneSelectorModel();
});

ipcMain.handle("zoneSelector:commit", (_event, payload) => {
  return commitRoamZoneSelection(payload?.rect);
});

ipcMain.handle("zoneSelector:cancel", () => {
  closeZoneSelectorWindow();
  return {
    ok: true,
  };
});

ipcMain.handle("prop:getModel", (event) => {
  const record = findPropWindowRecordByWebContentsId(event.sender.id);
  if (!record) return null;
  return buildPropWindowModel(record.propId);
});

ipcMain.handle("prop:beginDrag", (event, payload) => {
  const requestedPropId =
    typeof payload?.propId === "string" && payload.propId.trim().length > 0
      ? payload.propId.trim()
      : "";
  const record = findPropWindowRecordByWebContentsId(event.sender.id);
  if (!record || record.propId !== requestedPropId) {
    return {
      ok: false,
      error: "prop_window_mismatch",
    };
  }
  return beginPropWindowDrag(requestedPropId);
});

ipcMain.handle("prop:drag", (event, payload) => {
  const requestedPropId =
    typeof payload?.propId === "string" && payload.propId.trim().length > 0
      ? payload.propId.trim()
      : "";
  const record = findPropWindowRecordByWebContentsId(event.sender.id);
  if (!record || record.propId !== requestedPropId) {
    return {
      ok: false,
      error: "prop_window_mismatch",
    };
  }
  return dragPropWindow(requestedPropId);
});

ipcMain.handle("prop:endDrag", (event, payload) => {
  const requestedPropId =
    typeof payload?.propId === "string" && payload.propId.trim().length > 0
      ? payload.propId.trim()
      : "";
  const record = findPropWindowRecordByWebContentsId(event.sender.id);
  if (!record || record.propId !== requestedPropId) {
    return {
      ok: false,
      error: "prop_window_mismatch",
    };
  }
  return endPropWindowDrag(requestedPropId);
});

ipcMain.handle("prop:returnToInventory", (event, payload) => {
  const requestedPropId =
    typeof payload?.propId === "string" && payload.propId.trim().length > 0
      ? payload.propId.trim()
      : "";
  const record = findPropWindowRecordByWebContentsId(event.sender.id);
  if (!record || record.propId !== requestedPropId) {
    return {
      ok: false,
      error: "prop_window_mismatch",
    };
  }
  return removeQuickPropFromDesktop(requestedPropId, `prop_return_${requestedPropId}`);
});

ipcMain.handle("pet:getCapabilitySnapshot", () => {
  if (!capabilityRegistry) return latestCapabilitySnapshot;
  return capabilityRegistry.getSnapshot();
});

ipcMain.handle("pet:getContractTrace", () => {
  return latestContractTrace;
});

ipcMain.handle("pet:getMemorySnapshot", () => {
  if (!memoryPipeline) return latestMemorySnapshot;
  return memoryPipeline.getSnapshot();
});

ipcMain.handle("pet:getStateSnapshot", () => {
  if (!stateRuntime) return latestStateSnapshot;
  return stateRuntime.getSnapshot();
});

ipcMain.handle("pet:triggerBehaviorState", (_event, payload) => {
  if (!stateRuntime) {
    return {
      ok: false,
      error: "state_runtime_unavailable",
    };
  }
  const stateId =
    typeof payload?.stateId === "string" && payload.stateId.trim().length > 0
      ? payload.stateId.trim()
      : "";
  if (!stateId) {
    return {
      ok: false,
      error: "invalid_state_id",
    };
  }
  const snapshot = stateRuntime.activateState(stateId, {
    source: "manual",
    reason:
      typeof payload?.reason === "string" && payload.reason.trim().length > 0
        ? payload.reason.trim()
        : "manual_trigger",
    trigger:
      typeof payload?.trigger === "string" && payload.trigger.trim().length > 0
        ? payload.trigger.trim()
        : "manual",
    durationMs: Number.isFinite(Number(payload?.durationMs))
      ? Math.max(100, Math.round(Number(payload.durationMs)))
      : null,
    onCompleteStateId:
      typeof payload?.onCompleteStateId === "string" && payload.onCompleteStateId.trim().length > 0
        ? payload.onCompleteStateId.trim()
        : null,
    context: payload?.context,
  });
  return {
    ok: true,
    snapshot,
  };
});

ipcMain.handle("pet:simulateStateFallback", () => {
  if (!stateRuntime) {
    return {
      ok: false,
      error: "state_runtime_unavailable",
    };
  }
  const snapshot = stateRuntime.simulateMissingVisualFallback();
  return {
    ok: true,
    snapshot,
  };
});

ipcMain.handle("pet:getDialogHistory", () => {
  return dialogHistory.map((entry) => ({ ...entry }));
});

ipcMain.handle("pet:sendUserMessage", async (_event, payload) => {
  const text =
    typeof payload?.text === "string" && payload.text.trim().length > 0
      ? payload.text.trim()
      : "";
  if (!text) {
    return {
      ok: false,
      error: "invalid_text",
    };
  }

  const correlationId = createContractCorrelationId();
  const historyEntry = recordDialogUserMessage({
    correlationId,
    text,
  });
  const contractResult = await processPetContractEvent(
    "USER_MESSAGE",
    {
      text,
      command: text,
      type: text,
    },
    {
      correlationId,
    }
  );

  return {
    ok: Boolean(contractResult?.ok),
    correlationId,
    historyEntry,
    contractResult,
  };
});

ipcMain.handle("pet:runUserCommand", (_event, payload) => {
  const command =
    typeof payload?.command === "string" && payload.command.trim().length > 0
      ? payload.command.trim()
      : "";
  if (!command) {
    return {
      ok: false,
      error: "invalid_command",
    };
  }
  return processPetContractEvent("USER_COMMAND", {
    command,
    type: command,
    text: command,
  });
});

ipcMain.handle("pet:probeSpotifyIntegration", () => {
  return probeSpotifyIntegration();
});

ipcMain.handle("pet:probeFreshRssIntegration", () => {
  return probeFreshRssIntegration();
});

ipcMain.handle("pet:probeLocalMedia", () => {
  return pollLocalMediaState({
    force: true,
    trigger: "manual",
  });
});

ipcMain.handle("pet:simulateSpotifyPlayback", () => {
  return probeSpotifyIntegration();
});

ipcMain.handle("pet:recordTrackRating", (_event, payload) => {
  return recordTrackRating(payload);
});

ipcMain.handle("pet:recordMusicRating", async (_event, payload) => {
  if (!memoryPipeline) {
    return {
      ok: false,
      error: "memory_pipeline_unavailable",
    };
  }
  const rating = Number.isFinite(Number(payload?.rating))
    ? Math.max(1, Math.min(10, Math.round(Number(payload.rating))))
    : 7;
  const trackTitle =
    typeof payload?.trackTitle === "string" && payload.trackTitle.trim().length > 0
      ? payload.trackTitle.trim()
      : "unknown_track";
  const outcome = await memoryPipeline.recordObservation({
    observationType: "music_rating",
    source: "manual_music_rating",
    evidenceTag: trackTitle.toLowerCase(),
    correlationId: createContractCorrelationId(),
    payload: {
      trackTitle,
      rating,
    },
  });
  emitToRenderer("pet:memory", {
    kind: "musicRatingRecorded",
    rating,
    trackTitle,
    targetPath: outcome?.targetPath || null,
    adapterMode: outcome?.adapterMode || latestMemorySnapshot?.activeAdapterMode || "local",
    ts: Date.now(),
  });
  return outcome;
});

ipcMain.handle("pet:runMemoryPromotionCheck", async (_event, payload) => {
  if (!memoryPipeline) {
    return {
      ok: false,
      error: "memory_pipeline_unavailable",
    };
  }
  const result = await memoryPipeline.evaluatePromotionCandidate({
    candidateType:
      typeof payload?.candidateType === "string" && payload.candidateType.trim().length > 0
        ? payload.candidateType.trim()
        : "adaptive_music_preference",
    focusObservationType:
      typeof payload?.focusObservationType === "string" && payload.focusObservationType.trim().length > 0
        ? payload.focusObservationType.trim()
        : "",
    thresholds: payload?.thresholds,
  });
  emitToRenderer("pet:memory", {
    kind: "promotionDecision",
    outcome: result?.decision?.outcome || "unknown",
    reasons: result?.decision?.reasons || [],
    targetPath: result?.targetPath || null,
    adapterMode: result?.adapterMode || latestMemorySnapshot?.activeAdapterMode || "local",
    ts: Date.now(),
  });
  return result;
});

ipcMain.handle("pet:testProtectedIdentityWrite", async () => {
  if (!memoryPipeline) {
    return {
      ok: false,
      error: "memory_pipeline_unavailable",
    };
  }
  const result = await memoryPipeline.attemptIdentityMutation({
    section: "Immutable Core",
    evidence: ["manual_protected_write_test"],
    patch: {
      operation: "replace",
      key: "core_identity",
      value: "forbidden_mutation_attempt",
    },
  });
  emitToRenderer("pet:memory", {
    kind: "identityMutationTest",
    outcome: result?.auditEntry?.outcome || "unknown",
    reason: result?.auditEntry?.reason || "none",
    targetPath: result?.targetPath || null,
    adapterMode: result?.adapterMode || latestMemorySnapshot?.activeAdapterMode || "local",
    ts: Date.now(),
  });
  return result;
});

ipcMain.handle("pet:getExtensions", () => {
  if (!extensionPackRegistry) return latestExtensionSnapshot;
  return extensionPackRegistry.getSnapshot();
});

ipcMain.handle("pet:setExtensionEnabled", (_event, payload) => {
  if (!extensionPackRegistry) {
    return { ok: false, error: "extension_registry_unavailable" };
  }

  const extensionId =
    typeof payload?.extensionId === "string" ? payload.extensionId.trim() : "";
  if (!extensionId) {
    return { ok: false, error: "invalid_extension_id" };
  }

  const result = extensionPackRegistry.setEnabled(extensionId, Boolean(payload?.enabled));
  const snapshot = result.snapshot || extensionPackRegistry.getSnapshot();
  emitExtensionSnapshot(snapshot);
  logExtensionSummary("set-enabled", snapshot);
  refreshExtensionCapabilityStates();

  if (result.trustWarning) {
    console.warn(`[pet-extension] trust-warning ${extensionId}: ${result.trustWarning}`);
    if (DIAGNOSTICS_ENABLED) {
      emitDiagnostics({
        kind: "extensionTrustWarning",
        extensionId,
        message: result.trustWarning,
      });
    }
  }

  return result;
});

ipcMain.handle("pet:interactWithExtensionProp", (_event, payload) => {
  if (!extensionPackRegistry) {
    const unavailable = { ok: false, error: "extension_registry_unavailable" };
    console.warn("[pet-extension] interaction failed: extension_registry_unavailable");
    emitToRenderer("pet:extension-event", {
      kind: "extensionPropInteraction",
      ...unavailable,
      ts: Date.now(),
    });
    return unavailable;
  }

  const extensionId =
    typeof payload?.extensionId === "string" ? payload.extensionId.trim() : "";
  const propId = typeof payload?.propId === "string" ? payload.propId.trim() : "";
  const interactionType =
    typeof payload?.interactionType === "string" && payload.interactionType.trim().length > 0
      ? payload.interactionType.trim()
      : "click";
  if (!extensionId || !propId) {
    const invalidPayload = { ok: false, error: "invalid_interaction_payload" };
    console.warn("[pet-extension] interaction failed: invalid_interaction_payload");
    emitToRenderer("pet:extension-event", {
      kind: "extensionPropInteraction",
      ...invalidPayload,
      ts: Date.now(),
    });
    return invalidPayload;
  }

  const interaction = extensionPackRegistry.triggerPropInteraction(
    extensionId,
    propId,
    interactionType
  );
  if (!interaction.ok) {
    console.warn(
      `[pet-extension] interaction failed extension=${extensionId} prop=${propId} error=${interaction.error}`
    );
    emitToRenderer("pet:extension-event", {
      kind: "extensionPropInteraction",
      ...interaction,
      extensionId,
      propId,
      interactionType,
      ts: Date.now(),
    });
    if (DIAGNOSTICS_ENABLED) {
      emitDiagnostics({
        kind: "extensionPropInteraction",
        ...interaction,
        extensionId,
        propId,
        interactionType,
      });
    }
    return interaction;
  }

  const arbitration = {
    authority: "core",
    decision: "allow",
    reason: "extensionEnabledAndPropAvailable",
    ts: Date.now(),
  };
  const result = {
    ok: true,
    intent: interaction.intent,
    prop: interaction.prop,
    arbitration,
  };

  const eventPayload = {
    kind: "extensionPropInteraction",
    ...result,
  };
  console.log(
    `[pet-extension] interaction extension=${extensionId} prop=${propId} type=${interactionType} decision=${arbitration.decision}`
  );
  emitToRenderer("pet:extension-event", eventPayload);
  if (DIAGNOSTICS_ENABLED) {
    emitDiagnostics(eventPayload);
  }

  void processPetContractEvent("EXT_PROP_INTERACTED", {
    extensionId,
    propId,
    interactionType,
  }).catch((error) => {
    console.warn(
      `[pet-contract] extension-event processing failed: ${error?.message || String(error)}`
    );
  });

  return result;
});

ipcMain.handle("pet:getAnimationManifest", (_event, characterId) => {
  return readAnimationManifest(characterId);
});

app.whenReady().then(async () => {
  initializeRuntimeSettings("startup");
  initializeStateRuntime();
  initializeDialogRuntime();
  initializeContractRouter();
  await initializeMemoryPipelineRuntime();
  createWindow();
  initializeShellSurface();
  startRoamController();
  physicsTimer = setInterval(stepFling, FLING_CONFIG.stepMs);
  cursorTimer = setInterval(emitCursorState, CURSOR_EMIT_INTERVAL_MS);
  initializeExtensionPackRuntime();
  initializeOpenClawBridgeRuntime();
  initializeCapabilityRegistry();
  await startCapabilityRegistry();
  startLocalMediaPoller();
  startBackgroundFreshRssPoller();

  screen.on("display-added", (_event, display) => {
    if (!DIAGNOSTICS_ENABLED) return;
    logDiagnostics("display-added", summarizeDisplay(display));
  });

  screen.on("display-removed", (_event, display) => {
    if (!DIAGNOSTICS_ENABLED) return;
    logDiagnostics("display-removed", summarizeDisplay(display));
  });

  screen.on("display-metrics-changed", (_event, display, changedMetrics) => {
    if (!DIAGNOSTICS_ENABLED) return;
    logDiagnostics("display-metrics-changed", {
      changedMetrics,
      display: summarizeDisplay(display),
    });
  });
});

app.on("before-quit", () => {
  appIsQuitting = true;
  if (stateRuntime) {
    stateRuntime.stop();
  }
  if (capabilityRegistry) {
    capabilityRegistry.stopAll({
      reason: "appQuit",
    });
  }
  if (physicsTimer) {
    clearInterval(physicsTimer);
    physicsTimer = null;
  }
  if (cursorTimer) {
    clearInterval(cursorTimer);
    cursorTimer = null;
  }
  if (roamTimer) {
    clearInterval(roamTimer);
    roamTimer = null;
  }
  if (localMediaPollTimer) {
    clearInterval(localMediaPollTimer);
    localMediaPollTimer = null;
  }
  if (freshRssPollTimer) {
    clearInterval(freshRssPollTimer);
    freshRssPollTimer = null;
  }
  if (shellTray) {
    shellTray.destroy();
    shellTray = null;
  }
  if (inventoryWin && !inventoryWin.isDestroyed()) {
    inventoryWin.destroy();
    inventoryWin = null;
  }
  if (zoneSelectorWin && !zoneSelectorWin.isDestroyed()) {
    zoneSelectorWin.destroy();
    zoneSelectorWin = null;
  }
  for (const record of propWindows.values()) {
    if (record?.window && !record.window.isDestroyed()) {
      record.window.destroy();
    }
  }
  propWindows.clear();
  cancelFling("appQuit");
  closeDiagnosticsLog();
});
