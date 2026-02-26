const { app, BrowserWindow, ipcMain, screen } = require("electron");
const fs = require("fs");
const path = require("path");
const { CAPABILITY_STATES, createCapabilityRegistry } = require("./capability-registry");
const { createExtensionPackRegistry, DEFAULT_EXTENSIONS_ROOT } = require("./extension-pack-registry");
const { createPetContractRouter } = require("./pet-contract-router");
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
      return {
        state: CAPABILITY_STATES.degraded,
        reason: "offlineFallback",
        details: {
          mode: "localOnly",
        },
      };
    },
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
  return (
    `Runtime ${runtime}. ` +
    `Capabilities healthy=${summary.healthyCount || 0}, ` +
    `degraded=${summary.degradedCount || 0}, failed=${summary.failedCount || 0}.`
  );
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
  }
}

function processPetContractEvent(eventType, payload = {}, context = {}) {
  if (!contractRouter) {
    return {
      ok: false,
      error: "contract_router_unavailable",
    };
  }

  const result = contractRouter.processEvent(
    {
      type: eventType,
      payload,
    },
    {
      source: deriveContractSource(),
      statusText: buildStatusText(),
      announcementCooldownMsByReason: {
        manual_test: 5000,
      },
      ...context,
    }
  );
  handleContractSuggestions(result);
  return result;
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
  };
});

ipcMain.handle("pet:getCapabilitySnapshot", () => {
  if (!capabilityRegistry) return latestCapabilitySnapshot;
  return capabilityRegistry.getSnapshot();
});

ipcMain.handle("pet:getContractTrace", () => {
  return latestContractTrace;
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

  processPetContractEvent("EXT_PROP_INTERACTED", {
    extensionId,
    propId,
    interactionType,
  });

  return result;
});

ipcMain.handle("pet:getAnimationManifest", (_event, characterId) => {
  return readAnimationManifest(characterId);
});

app.whenReady().then(async () => {
  initializeDiagnosticsLog();
  initializeContractRouter();
  createWindow();
  physicsTimer = setInterval(stepFling, FLING_CONFIG.stepMs);
  cursorTimer = setInterval(emitCursorState, CURSOR_EMIT_INTERVAL_MS);
  initializeExtensionPackRuntime();
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
