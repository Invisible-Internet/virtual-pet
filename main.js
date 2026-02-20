const { app, BrowserWindow, ipcMain, screen } = require("electron");
const fs = require("fs");
const path = require("path");
const { BASE_LAYOUT, computePetLayout } = require("./pet-layout");

// Master diagnostics toggle: controls console logs, file logs, and renderer overlay.
const DIAGNOSTICS_ENABLED = false;
const CLAMP_TO_WORK_AREA = true;
const DRAG_LOG_SAMPLE_EVERY = 8;
const MAX_LOG_FILE_BYTES = 5 * 1024 * 1024;
const VELOCITY_SAMPLE_WINDOW_MS = 120;
const MAX_DRAG_SAMPLES = 12;
const CURSOR_EMIT_INTERVAL_MS = 33;
const ROTATION_CLAMP_MARGIN_MAX_PX = 82;
const ROTATION_SIDE_MAX_RAD = Math.PI * (34 / 180);
const ROTATION_DOWN_THRESHOLD = 180;
const ROTATION_DOWN_SPEED = 1250;
const ROTATION_FLY_MAX_RAD = Math.PI * (20 / 180);

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
let lastDragCursorSample = null;

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

function emitToRenderer(channel, payload) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send(channel, payload);
}

function resetMotionSampleFromWindow() {
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  lastMotionSample = { tMs: Date.now(), x, y };
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

  emitToRenderer("pet:motion", {
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
  });
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
  const rotationClampMargin = computeRotationClampMargin(flingState.vx, flingState.vy, "flying");
  const clamped = clampWindowPosition(targetX, targetY, clampArea, rotationClampMargin);
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

  if (flingTick % DRAG_LOG_SAMPLE_EVERY === 0 || collidedX || collidedY) {
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
      rotationClampMargin,
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

function estimateRigRotationTarget(vx, vy, mode) {
  if (mode === "dragging") {
    const sideTilt = Math.max(-1, Math.min(1, vx / 1050)) * ROTATION_SIDE_MAX_RAD;
    const downAmount = Math.max(
      0,
      Math.min(1, (vy - ROTATION_DOWN_THRESHOLD) / Math.max(1, ROTATION_DOWN_SPEED))
    );
    const inversionTarget = sideTilt >= 0 ? Math.PI : -Math.PI;
    return sideTilt * (1 - downAmount) + inversionTarget * downAmount;
  }

  if (mode === "flying" || mode === "impact") {
    return Math.max(-1, Math.min(1, vx / 1200)) * ROTATION_FLY_MAX_RAD;
  }

  return 0;
}

function computeRotationClampMargin(vx, vy, mode) {
  const angle = estimateRigRotationTarget(vx, vy, mode);
  const amount = Math.max(0, Math.min(1, Math.abs(angle) / Math.PI));
  return Math.round(ROTATION_CLAMP_MARGIN_MAX_PX * amount);
}

function clampWindowPosition(targetX, targetY, displayBounds, rotationMargin = 0) {
  const margin = Math.max(0, Math.round(rotationMargin));
  let minX = Math.round(displayBounds.x - PET_VISUAL_BOUNDS.x + margin);
  let maxX = Math.round(
    displayBounds.x + displayBounds.width - (PET_VISUAL_BOUNDS.x + PET_VISUAL_BOUNDS.width) - margin
  );
  let minY = Math.round(displayBounds.y - PET_VISUAL_BOUNDS.y + margin);
  let maxY = Math.round(
    displayBounds.y + displayBounds.height - (PET_VISUAL_BOUNDS.y + PET_VISUAL_BOUNDS.height) - margin
  );

  if (minX > maxX) {
    const midX = Math.round((minX + maxX) / 2);
    minX = midX;
    maxX = midX;
  }

  if (minY > maxY) {
    const midY = Math.round((minY + maxY) / 2);
    minY = midY;
    maxY = midY;
  }

  return {
    x: Math.max(minX, Math.min(maxX, targetX)),
    y: Math.max(minY, Math.min(maxY, targetY)),
  };
}

function createWindow() {
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
  const clamped = clampWindowPosition(x, y, getClampArea(display));
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
  lastDragCursorSample = { x: cursor.x, y: cursor.y, tMs: Date.now() };
  recordDragSample(winX, winY);

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
  emitMotionState({
    velocityOverride: { vx: 0, vy: 0 },
    collided: { x: false, y: false },
    impact: { triggered: false, strength: 0 },
  });
});

ipcMain.on("pet:endDrag", () => {
  dragging = false;
  dragDisplayId = null;
  lastDragCursorSample = null;

  const payload = { kind: "endDrag" };
  logDiagnostics("end-drag", payload);
  emitDiagnostics(payload);

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

  const cursor = screen.getCursorScreenPoint();
  const [winX, winY] = win.getPosition();
  const nowMs = Date.now();
  let dragVx = 0;
  let dragVy = 0;

  if (lastDragCursorSample) {
    const dtSec = (nowMs - lastDragCursorSample.tMs) / 1000;
    if (dtSec > 0) {
      dragVx = (cursor.x - lastDragCursorSample.x) / dtSec;
      dragVy = (cursor.y - lastDragCursorSample.y) / dtSec;
    }
  }
  lastDragCursorSample = { x: cursor.x, y: cursor.y, tMs: nowMs };

  const targetX = cursor.x - dragOffset.x;
  const targetY = cursor.y - dragOffset.y;
  const displayDecision = resolveDragDisplay(cursor);
  const clampArea = getClampArea(displayDecision.display);
  const rotationClampMargin = computeRotationClampMargin(dragVx, dragVy, "dragging");
  const clamped = clampWindowPosition(targetX, targetY, clampArea, rotationClampMargin);
  const roundedTarget = { x: Math.round(targetX), y: Math.round(targetY) };
  const clampedX = clamped.x !== roundedTarget.x;
  const clampedY = clamped.y !== roundedTarget.y;
  const boundsResult = applyWindowBounds(clamped.x, clamped.y);
  recordDragSample(boundsResult.contentAfter?.x ?? clamped.x, boundsResult.contentAfter?.y ?? clamped.y);

  const payload = {
    kind: "drag",
    tick: dragTick,
    cursor,
    windowPositionBefore: { x: winX, y: winY },
    target: roundedTarget,
    clamped,
    clampHit: { x: clampedX, y: clampedY },
    dragVelocity: { vx: dragVx, vy: dragVy },
    rotationClampMargin,
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
  emitMotionState({
    collided: { x: clampedX, y: clampedY },
    impact: { triggered: false, strength: 0 },
  });

  if (dragTick % DRAG_LOG_SAMPLE_EVERY === 0 || clampedX || clampedY) {
    logDiagnostics("drag", payload);
  }

  if (boundsResult.sizeCorrected) {
    logDiagnostics("size-corrected", payload);
  }
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
  };
});

app.whenReady().then(() => {
  initializeDiagnosticsLog();
  createWindow();
  physicsTimer = setInterval(stepFling, FLING_CONFIG.stepMs);
  cursorTimer = setInterval(emitCursorState, CURSOR_EMIT_INTERVAL_MS);

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
