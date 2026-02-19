const { app, BrowserWindow, ipcMain, screen } = require("electron");
const fs = require("fs");
const path = require("path");

// Master diagnostics toggle: controls console logs, file logs, and renderer overlay.
const DIAGNOSTICS_ENABLED = false;
const CLAMP_TO_WORK_AREA = true;
const DRAG_LOG_SAMPLE_EVERY = 8;
const MAX_LOG_FILE_BYTES = 5 * 1024 * 1024;

let win;
let dragging = false;
let dragOffset = { x: 0, y: 0 };
let dragDisplayId = null;
let dragTick = 0;
let logLineCount = 0;
let diagnosticsLogStream = null;

const WINDOW_SIZE = Object.freeze({
  width: 320,
  height: 320,
});

// These bounds describe the visible pet shape inside the transparent window.
const PET_VISUAL_BOUNDS = Object.freeze({
  x: 50,
  y: 50,
  width: 220,
  height: 220,
});

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
  if (!win || win.isDestroyed()) return;
  win.webContents.send("pet:diagnostics", payload);
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

function clampWindowPosition(targetX, targetY, displayBounds) {
  const minX = Math.round(displayBounds.x - PET_VISUAL_BOUNDS.x);
  const maxX = Math.round(
    displayBounds.x + displayBounds.width - (PET_VISUAL_BOUNDS.x + PET_VISUAL_BOUNDS.width)
  );
  const minY = Math.round(displayBounds.y - PET_VISUAL_BOUNDS.y);
  const maxY = Math.round(
    displayBounds.y + displayBounds.height - (PET_VISUAL_BOUNDS.y + PET_VISUAL_BOUNDS.height)
  );

  return {
    x: Math.max(minX, Math.min(maxX, Math.round(targetX))),
    y: Math.max(minY, Math.min(maxY, Math.round(targetY))),
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

  logDiagnostics("window-created", {
    windowSize: WINDOW_SIZE,
    petVisualBounds: PET_VISUAL_BOUNDS,
    clampAreaType: CLAMP_TO_WORK_AREA ? "workArea" : "bounds",
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
});

ipcMain.on("pet:beginDrag", () => {
  if (!win) return;

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
});

ipcMain.on("pet:endDrag", () => {
  dragging = false;
  dragDisplayId = null;

  const payload = { kind: "endDrag" };
  logDiagnostics("end-drag", payload);
  emitDiagnostics(payload);
});

ipcMain.on("pet:drag", () => {
  if (!win || !dragging) return;

  dragTick += 1;

  const cursor = screen.getCursorScreenPoint();
  const [winX, winY] = win.getPosition();
  const targetX = cursor.x - dragOffset.x;
  const targetY = cursor.y - dragOffset.y;
  const displayDecision = resolveDragDisplay(cursor);
  const clampArea = getClampArea(displayDecision.display);
  const clamped = clampWindowPosition(targetX, targetY, clampArea);
  const roundedTarget = { x: Math.round(targetX), y: Math.round(targetY) };
  const clampedX = clamped.x !== roundedTarget.x;
  const clampedY = clamped.y !== roundedTarget.y;
  const boundsResult = applyWindowBounds(clamped.x, clamped.y);

  const payload = {
    kind: "drag",
    tick: dragTick,
    cursor,
    windowPositionBefore: { x: winX, y: winY },
    target: roundedTarget,
    clamped,
    clampHit: { x: clampedX, y: clampedY },
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
  };
});

app.whenReady().then(() => {
  initializeDiagnosticsLog();
  createWindow();

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
  closeDiagnosticsLog();
});
