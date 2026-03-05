"use strict";

const fs = require("fs");
const path = require("path");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readProjectFile(fileName) {
  return fs.readFileSync(path.join(__dirname, "..", fileName), "utf8");
}

function assertIncludes(source, snippet, message) {
  assert(source.includes(snippet), `${message} (missing "${snippet}")`);
}

function assertIncludesAny(source, snippets, message) {
  assert(
    snippets.some((snippet) => source.includes(snippet)),
    `${message} (missing one of: ${snippets.map((snippet) => `"${snippet}"`).join(", ")})`
  );
}

function run() {
  const mainSource = readProjectFile("main.js");
  const preloadSource = readProjectFile("preload.js");
  const rendererSource = readProjectFile("renderer.js");

  assertIncludes(
    preloadSource,
    'beginDrag: () => ipcRenderer.send("pet:beginDrag")',
    "preload should expose beginDrag"
  );
  assertIncludes(
    preloadSource,
    'drag: () => ipcRenderer.send("pet:drag")',
    "preload should expose drag"
  );
  assertIncludes(
    preloadSource,
    'endDrag: () => ipcRenderer.send("pet:endDrag")',
    "preload should expose endDrag"
  );

  assertIncludes(
    mainSource,
    'ipcMain.on("pet:beginDrag"',
    "main process should own beginDrag handler"
  );
  assertIncludes(
    mainSource,
    'ipcMain.on("pet:drag"',
    "main process should own drag handler"
  );
  assertIncludes(
    mainSource,
    'ipcMain.on("pet:endDrag"',
    "main process should own endDrag handler"
  );
  assertIncludes(
    mainSource,
    "screen.getCursorScreenPoint()",
    "drag authority should read cursor in the main process"
  );
  assertIncludesAny(
    mainSource,
    ["applyFixedContentBounds(win, WINDOW_SIZE", "applyFixedContentBounds(win, petWindowSize"],
    "window size should be enforced through fixed content bounds"
  );
  assertIncludesAny(
    mainSource,
    [
      "win.setMinimumSize(WINDOW_SIZE.width, WINDOW_SIZE.height)",
      "win.setMinimumSize(petWindowSize.width, petWindowSize.height)",
    ],
    "main window minimum size should be fixed"
  );
  assertIncludesAny(
    mainSource,
    [
      "win.setMaximumSize(WINDOW_SIZE.width, WINDOW_SIZE.height)",
      "win.setMaximumSize(petWindowSize.width, petWindowSize.height)",
    ],
    "main window maximum size should be fixed"
  );
  assertIncludes(
    mainSource,
    "contextIsolation: true",
    "main window should preserve contextIsolation"
  );
  assertIncludes(
    mainSource,
    "nodeIntegration: false",
    "main window should preserve nodeIntegration=false"
  );
  assertIncludesAny(
    mainSource,
    ["layout: PET_LAYOUT", "layout: getPetLayout()"],
    "main config payload should expose the shared pet layout"
  );

  assertIncludes(
    rendererSource,
    "config?.layout",
    "renderer should consume layout from runtime config"
  );
  assertIncludes(
    rendererSource,
    "canvas.setPointerCapture",
    "pointer capture should remain on canvas"
  );
  assert(
    !rendererSource.includes("window.setPointerCapture"),
    "pointer capture must not be bound to window"
  );

  console.log("[runtime-invariants] checks passed");
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error.message || String(error));
    process.exit(1);
  }
}

module.exports = {
  run,
};
