"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");
const CHARACTERS_ROOT = path.join(PROJECT_ROOT, "assets", "characters");
const REQUIRED_DIRECTIONS = Object.freeze([
  "Down",
  "DownRight",
  "Right",
  "UpRight",
  "Up",
  "UpLeft",
  "Left",
  "DownLeft",
]);
const REQUIRED_STATES = Object.freeze([
  "IdleReady",
  "Walk",
  "Run",
  "Jump",
  "RunningJump",
  "Roll",
  "Grabbed",
]);

function asPositiveInt(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.round(numeric));
}

function fail(message) {
  throw new Error(message);
}

function ensureDirectionSet(manifest, characterId) {
  if (!Array.isArray(manifest.directions)) {
    fail(`[${characterId}] "directions" must be an array.`);
  }
  for (const requiredDirection of REQUIRED_DIRECTIONS) {
    if (!manifest.directions.includes(requiredDirection)) {
      fail(`[${characterId}] missing required direction "${requiredDirection}".`);
    }
  }
}

function validateState(characterId, stateName, state, cell) {
  if (!state || typeof state !== "object") {
    fail(`[${characterId}] state "${stateName}" is missing.`);
  }
  if (typeof state.sheetPattern !== "string" || state.sheetPattern.trim().length === 0) {
    fail(`[${characterId}] state "${stateName}" is missing "sheetPattern".`);
  }
  if (asPositiveInt(state.columns, 0) < 1) {
    fail(`[${characterId}] state "${stateName}" has invalid "columns".`);
  }
  if (asPositiveInt(state.frameCount, 0) < 1) {
    fail(`[${characterId}] state "${stateName}" has invalid "frameCount".`);
  }
  if (asPositiveInt(state.fps, 0) < 1) {
    fail(`[${characterId}] state "${stateName}" has invalid "fps".`);
  }
  if (typeof state.loop !== "boolean") {
    fail(`[${characterId}] state "${stateName}" is missing boolean "loop".`);
  }

  if (state.hitboxPx) {
    const hitbox = state.hitboxPx;
    const requiredHitboxKeys = ["x", "y", "width", "height"];
    for (const key of requiredHitboxKeys) {
      if (!Number.isFinite(Number(hitbox[key]))) {
        fail(`[${characterId}] state "${stateName}" hitbox is missing "${key}".`);
      }
    }
    if (hitbox.width <= 0 || hitbox.height <= 0) {
      fail(`[${characterId}] state "${stateName}" hitbox dimensions must be positive.`);
    }
    if (hitbox.x < 0 || hitbox.y < 0 || hitbox.x >= cell.width || hitbox.y >= cell.height) {
      fail(`[${characterId}] state "${stateName}" hitbox origin must be inside cell.`);
    }
  }
}

function checkCharacter(characterDir) {
  const characterId = path.basename(characterDir);
  const manifestPath = path.join(characterDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    fail(`[${characterId}] missing manifest.json`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const cell = {
    width: asPositiveInt(manifest?.cell?.width, 0),
    height: asPositiveInt(manifest?.cell?.height, 0),
  };
  if (!cell.width || !cell.height) {
    fail(`[${characterId}] invalid cell size.`);
  }
  if (asPositiveInt(manifest?.display?.targetHeightPx, 0) < 1) {
    fail(`[${characterId}] invalid display.targetHeightPx.`);
  }
  ensureDirectionSet(manifest, characterId);

  if (!manifest.states || typeof manifest.states !== "object") {
    fail(`[${characterId}] missing states object.`);
  }

  for (const requiredState of REQUIRED_STATES) {
    validateState(characterId, requiredState, manifest.states[requiredState], cell);
  }

  const missingFiles = [];
  for (const [stateName, state] of Object.entries(manifest.states)) {
    for (const direction of REQUIRED_DIRECTIONS) {
      const fileName = state.sheetPattern
        .replace(/\{dir\}/g, direction)
        .replace(/\{state\}/g, stateName);
      const filePath = path.join(characterDir, fileName);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(path.relative(PROJECT_ROOT, filePath).replace(/\\/g, "/"));
      }
    }
  }

  if (missingFiles.length > 0) {
    const preview = missingFiles.slice(0, 12);
    const suffix = missingFiles.length > preview.length ? `\n...and ${missingFiles.length - preview.length} more` : "";
    fail(
      `[${characterId}] missing sprite sheets:\n${preview.map((value) => `- ${value}`).join("\n")}${suffix}`
    );
  }

  console.log(`[assets] ${characterId}: manifest OK (${Object.keys(manifest.states).length} states)`);
}

function main() {
  if (!fs.existsSync(CHARACTERS_ROOT)) {
    fail("assets/characters directory does not exist.");
  }
  const characterDirs = fs
    .readdirSync(CHARACTERS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(CHARACTERS_ROOT, entry.name));

  if (characterDirs.length === 0) {
    fail("No character directories found in assets/characters.");
  }

  for (const characterDir of characterDirs) {
    checkCharacter(characterDir);
  }

  console.log("[assets] checks passed");
}

main();
