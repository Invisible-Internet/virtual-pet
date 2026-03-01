const { app, BrowserWindow, ipcMain, screen } = require("electron");
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
  MEMORY_ADAPTER_MODES,
  OPENCLAW_WORKSPACE_BOOTSTRAP_MODES,
  createMemoryPipeline,
} = require("./memory-pipeline");
const { loadRuntimeSettings } = require("./settings-runtime");
const { BASE_LAYOUT, computePetLayout } = require("./pet-layout");
const {
  normalizePetBounds,
  clampWindowPosition,
  createDragClampLatch,
  applyDragClampHysteresis,
} = require("./main-clamp");

// Master diagnostics toggle: controls console logs, file logs, and renderer overlay.
const DIAGNOSTICS_ENABLED = false;
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
let dragClampLatch = createDragClampLatch();
let activePetBoundsUpdatedAtMs = 0;
let lastMotionPayload = null;
let capabilityRegistry = null;
let latestCapabilitySnapshot = null;
let extensionPackRegistry = null;
let latestExtensionSnapshot = null;
let contractRouter = null;
let latestContractTrace = null;
let openclawBridge = null;
let memoryPipeline = null;
let latestMemorySnapshot = null;
let latestIntegrationEvent = null;
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

const flingState = {
  active: false,
  vx: 0,
  vy: 0,
  lastStepMs: 0,
  x: 0,
  y: 0,
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
    win.setContentBounds(
      {
        x: Math.round(targetX),
        y: Math.round(targetY),
        width: WINDOW_SIZE.width,
        height: WINDOW_SIZE.height,
      },
      false
    );
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

  win.setContentBounds(
    {
      x: Math.round(targetX),
      y: Math.round(targetY),
      width: WINDOW_SIZE.width,
      height: WINDOW_SIZE.height,
    },
    false
  );

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
    start: () => ({
      state: CAPABILITY_STATES.degraded,
      reason: "logOnlyPropWorld",
      details: {
        mode: "logOnly",
      },
    }),
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
    CAPABILITY_STATES.degraded,
    "logOnlyPropWorld",
    {
      mode: "logOnly",
    }
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
  const memory = settings.memory && typeof settings.memory === "object" ? settings.memory : {};
  const openclaw = settings.openclaw && typeof settings.openclaw === "object" ? settings.openclaw : {};
  const paths = settings.paths && typeof settings.paths === "object" ? settings.paths : {};
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
      },
      freshRss: {
        enabled: Boolean(integrations.freshRss?.enabled),
        available: Boolean(integrations.freshRss?.available),
        transport: integrations.freshRss?.transport || INTEGRATION_TRANSPORTS.stub,
        pollCadenceMinutes: Number.isFinite(Number(integrations.freshRss?.pollCadenceMinutes))
          ? Math.max(5, Math.round(Number(integrations.freshRss.pollCadenceMinutes)))
          : 30,
        dailyTopItems: Number.isFinite(Number(integrations.freshRss?.dailyTopItems))
          ? Math.max(1, Math.min(3, Math.round(Number(integrations.freshRss.dailyTopItems))))
          : 3,
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
    resolvedPaths,
  };
}

function initializeRuntimeSettings() {
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
    segments.push(
      `Spotify ${nowPlaying.isPlaying ? "is playing" : "last reported"} ${nowPlaying.trackName} by ${nowPlaying.artistName}.`
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
  const raw = explicitType || command || text;
  if (raw === "status" || raw === "introspect" || raw === "what are you doing") return "status";
  if (raw === "announce-test" || raw === "announce") return "announce-test";
  if (raw === "bridge-test" || raw === "bridge") return "bridge-test";
  if (raw === "guardrail-test" || raw === "guardrail") return "guardrail-test";
  return raw || "unknown";
}

function deriveContractSource() {
  const bridgeState = capabilityRegistry?.getCapabilityState(CAPABILITY_IDS.openclawBridge);
  if (bridgeState?.state === CAPABILITY_STATES.healthy) {
    return "online";
  }
  return "offline";
}

function buildStatusText() {
  const runtime = latestCapabilitySnapshot?.runtimeState || "unknown";
  const summary = latestCapabilitySnapshot?.summary || {};
  const spotifyState =
    capabilityRegistry?.getCapabilityState(CAPABILITY_IDS.spotifyIntegration)?.state || "unknown";
  const freshRssState =
    capabilityRegistry?.getCapabilityState(CAPABILITY_IDS.freshRssIntegration)?.state || "unknown";
  return (
    `Runtime ${runtime}. ` +
    `Capabilities healthy=${summary.healthyCount || 0}, ` +
    `degraded=${summary.degradedCount || 0}, failed=${summary.failedCount || 0}. ` +
    `Integrations spotify=${spotifyState}, freshrss=${freshRssState}.`
  );
}

function deriveBridgeCurrentState() {
  if (dragging) return "Dragging";
  if (flingState.active) return "Flinging";
  return "Idle";
}

function buildActivePropsSummary() {
  if (!latestExtensionSnapshot || !Array.isArray(latestExtensionSnapshot.extensions)) return "none";
  const summaries = [];
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
    stateContextSummary: buildStatusText(),
    activePropsSummary: buildActivePropsSummary(),
    extensionContextSummary: buildExtensionContextSummary(),
    source: deriveContractSource(),
  };
}

function buildBridgeFallbackText(route, promptText) {
  if (route === "introspection_status") {
    return `${buildStatusText()} (offline fallback)`;
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

async function buildBridgeCommandContext(payload, correlationId) {
  const normalizedCommand = normalizeUserCommandForBridge(payload);
  if (normalizedCommand === "announce-test" || normalizedCommand === "unknown") {
    return {};
  }
  if (
    normalizedCommand !== "status" &&
    normalizedCommand !== "bridge-test" &&
    normalizedCommand !== "guardrail-test"
  ) {
    return {};
  }

  const route = normalizedCommand === "status" ? "introspection_status" : "dialog_user_command";
  const promptText =
    typeof payload?.text === "string" && payload.text.trim().length > 0
      ? payload.text.trim()
      : normalizedCommand;
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
  if (eventType === "USER_COMMAND") {
    const command =
      typeof payload?.command === "string" && payload.command.trim().length > 0
        ? payload.command.trim().toLowerCase()
        : "unknown";
    const responseSuggestion = extractFirstResponseSuggestion(result);
    return {
      observationType: "question_response",
      source: "contract_user_command",
      correlationId,
      evidenceTag: command,
      payload: {
        command,
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
      observationType: "spotify_playback",
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

function handleContractSuggestions(result) {
  if (!result || !Array.isArray(result.suggestions)) return;
  for (const suggestion of result.suggestions) {
    emitToRenderer("pet:contract-suggestion", suggestion);
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
    eventType === "USER_COMMAND"
      ? await buildBridgeCommandContext(payload, correlationId)
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
  handleContractSuggestions(result);
  queueMemoryObservation(
    createMemoryObservationFromContractResult(eventType, payload, result, correlationId)
  );
  return result;
}

async function probeSpotifyIntegration() {
  const settings = buildRuntimeSettingsSummary();
  const correlationId = createContractCorrelationId();
  const nowMs = Date.now();

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
      nowPlaying = normalizeSpotifyNowPlayingPayload(nowPlayingProbe.json);
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

  let contractResult = null;
  if (nowPlaying) {
    contractResult = await processPetContractEvent(
      "MEDIA",
      {
        playing: Boolean(nowPlaying.isPlaying),
        confidence: succeeded ? 0.98 : 0.8,
        provider: "spotify",
        source: "spotify",
        title: nowPlaying.trackName,
        artist: nowPlaying.artistName,
        album: nowPlaying.albumName,
        suggestedState: "MusicChill",
        activeProp: "headphones",
        entryDialogue: responseText,
        fallbackMode,
        topArtistSummary,
      },
      {
        correlationId,
        source: succeeded ? "online" : "offline",
        mediaResponseText: responseText,
        mediaSuggestedState: "MusicChill",
        integrationFallbackMode: fallbackMode,
      }
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
    degradedParts,
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

async function probeFreshRssIntegration() {
  const settings = buildRuntimeSettingsSummary();
  const correlationId = createContractCorrelationId();
  const nowMs = Date.now();

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

  let contractResult = null;
  if (normalized) {
    contractResult = await processPetContractEvent(
      "FRESHRSS_ITEMS",
      {
        summary: normalized.summary,
        items: normalized.items,
        fallbackMode,
      },
      {
        correlationId,
        source: succeeded ? "online" : "offline",
        freshRssResponseText: responseText,
      }
    );
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
    if (latestIntegrationEvent) {
      emitIntegrationEvent(latestIntegrationEvent);
    }
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
    contractTraceStage: latestContractTrace?.stage || null,
    memoryAdapterMode: latestMemorySnapshot?.activeAdapterMode || "unknown",
    memoryFallbackReason: latestMemorySnapshot?.fallbackReason || "none",
    openclawEnabled: settingsSummary.openclaw.enabled,
    openclawTransport: settingsSummary.openclaw.transport,
    openclawMode: settingsSummary.openclaw.mode,
    openclawBaseUrl: settingsSummary.openclaw.baseUrl,
    openclawLoopbackEndpoint: settingsSummary.openclaw.loopbackEndpoint,
    openclawAuthTokenConfigured: settingsSummary.openclaw.authTokenConfigured,
    settingsSummary,
    settingsSourceMap: runtimeSettingsSourceMap,
    settingsValidationWarnings: runtimeSettingsValidationWarnings,
    settingsValidationErrors: runtimeSettingsValidationErrors,
    settingsFiles: runtimeSettingsFiles,
  };
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
  initializeDiagnosticsLog();
  initializeRuntimeSettings();
  initializeContractRouter();
  await initializeMemoryPipelineRuntime();
  createWindow();
  physicsTimer = setInterval(stepFling, FLING_CONFIG.stepMs);
  cursorTimer = setInterval(emitCursorState, CURSOR_EMIT_INTERVAL_MS);
  initializeExtensionPackRuntime();
  initializeOpenClawBridgeRuntime();
  initializeCapabilityRegistry();
  await startCapabilityRegistry();

  if (!DIAGNOSTICS_ENABLED) return;

  screen.on("display-added", (_event, display) => {
    logDiagnostics("display-added", summarizeDisplay(display));
  });

  screen.on("display-removed", (_event, display) => {
    logDiagnostics("display-removed", summarizeDisplay(display));
  });

  screen.on("display-metrics-changed", (_event, display, changedMetrics) => {
    logDiagnostics("display-metrics-changed", {
      changedMetrics,
      display: summarizeDisplay(display),
    });
  });
});

app.on("before-quit", () => {
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
  cancelFling("appQuit");
  closeDiagnosticsLog();
});
