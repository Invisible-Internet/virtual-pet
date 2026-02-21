"use strict";

(function initSpriteRuntime(global) {
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

  const CORE_STATES = Object.freeze([
    "IdleReady",
    "Walk",
    "Run",
    "Jump",
    "RunningJump",
    "Roll",
    "Grabbed",
  ]);
  const ROLL_SPEED_FPS_MULTIPLIER = 0.006;
  const ROLL_FPS_MIN_FACTOR = 0.65;
  const ROLL_FPS_MAX_FACTOR = 3.4;
  const DRAG_CARDINAL_DEADBAND_DEG = 10;
  const DRAG_DIRECTION_MIN_SPEED = 35;
  const FLING_DIRECTION_MIN_SPEED = 35;
  const DRAG_DIRECTION_FILTER_HZ = 12;
  const DRAG_DIRECTION_SWITCH_CONFIRM_MS = 80;

  function asPositiveInt(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
    return Math.max(1, Math.round(numeric));
  }

  function asFiniteNumber(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function asBoolean(value, fallback) {
    if (typeof value === "boolean") return value;
    return fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeDirectionList(list) {
    if (!Array.isArray(list)) return null;
    const normalized = list.filter((item) => typeof item === "string" && item.trim());
    if (normalized.length !== REQUIRED_DIRECTIONS.length) return null;
    const seen = new Set(normalized);
    if (seen.size !== REQUIRED_DIRECTIONS.length) return null;
    for (const required of REQUIRED_DIRECTIONS) {
      if (!seen.has(required)) return null;
    }
    return normalized;
  }

  function normalizeHitbox(rawHitbox, cell) {
    if (!rawHitbox || typeof rawHitbox !== "object") return null;
    const x = asFiniteNumber(rawHitbox.x, NaN);
    const y = asFiniteNumber(rawHitbox.y, NaN);
    const width = asFiniteNumber(rawHitbox.width, NaN);
    const height = asFiniteNumber(rawHitbox.height, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
      return null;
    }
    if (width <= 0 || height <= 0) return null;
    const clampedX = clamp(Math.round(x), 0, cell.width - 1);
    const clampedY = clamp(Math.round(y), 0, cell.height - 1);
    const maxWidth = Math.max(1, cell.width - clampedX);
    const maxHeight = Math.max(1, cell.height - clampedY);
    return {
      x: clampedX,
      y: clampedY,
      width: clamp(Math.round(width), 1, maxWidth),
      height: clamp(Math.round(height), 1, maxHeight),
    };
  }

  function normalizeStateDefinition(stateName, rawState, normalizedManifest) {
    if (!rawState || typeof rawState !== "object") {
      throw new Error(`State "${stateName}" is missing or invalid.`);
    }
    const pattern =
      typeof rawState.sheetPattern === "string" && rawState.sheetPattern.trim().length > 0
        ? rawState.sheetPattern.trim()
        : null;
    if (!pattern) {
      throw new Error(`State "${stateName}" is missing "sheetPattern".`);
    }

    const columns = asPositiveInt(rawState.columns, 4);
    const frameCount = asPositiveInt(rawState.frameCount, 1);
    const fps = asPositiveInt(rawState.fps, 10);
    const loop = asBoolean(rawState.loop, stateName !== "Jump" && stateName !== "RunningJump");
    const nextState =
      typeof rawState.nextState === "string" && rawState.nextState.trim().length > 0
        ? rawState.nextState.trim()
        : "IdleReady";

    return {
      sheetPattern: pattern,
      columns,
      frameCount,
      fps,
      loop,
      nextState,
      hitboxPx: normalizeHitbox(rawState.hitboxPx, normalizedManifest.cell),
    };
  }

  function normalizeManifestPayload(payload) {
    const manifestSource = payload && typeof payload === "object" ? payload.manifest || payload : null;
    if (!manifestSource || typeof manifestSource !== "object") {
      throw new Error("Animation manifest payload is missing.");
    }

    const characterId =
      typeof (payload && payload.characterId) === "string" && payload.characterId.trim().length > 0
        ? payload.characterId.trim()
        : typeof manifestSource.characterId === "string" && manifestSource.characterId.trim().length > 0
          ? manifestSource.characterId.trim()
          : "unknown";
    const basePath =
      typeof (payload && payload.basePath) === "string" && payload.basePath.trim().length > 0
        ? payload.basePath.replace(/\\/g, "/").replace(/\/+$/, "")
        : "";

    const directions = normalizeDirectionList(manifestSource.directions);
    if (!directions) {
      throw new Error("Animation manifest directions are invalid.");
    }

    const cell = {
      width: asPositiveInt(manifestSource?.cell?.width, 256),
      height: asPositiveInt(manifestSource?.cell?.height, 256),
    };
    const pivotPx = {
      x: clamp(asFiniteNumber(manifestSource?.pivotPx?.x, Math.round(cell.width / 2)), 0, cell.width),
      y: clamp(asFiniteNumber(manifestSource?.pivotPx?.y, cell.height), 0, cell.height),
    };
    const display = {
      targetHeightPx: asPositiveInt(manifestSource?.display?.targetHeightPx, 220),
    };

    const rawStates = manifestSource.states;
    if (!rawStates || typeof rawStates !== "object") {
      throw new Error("Animation manifest is missing states.");
    }

    const states = {};
    for (const [stateName, rawState] of Object.entries(rawStates)) {
      states[stateName] = normalizeStateDefinition(stateName, rawState, { cell });
    }

    for (const requiredState of CORE_STATES) {
      if (!states[requiredState]) {
        throw new Error(`Animation manifest is missing required state "${requiredState}".`);
      }
    }

    return {
      version: asPositiveInt(manifestSource.version, 1),
      characterId,
      basePath,
      directions,
      cell,
      pivotPx,
      display,
      states,
    };
  }

  function resolveDirectionFromVector(x, y, fallbackDirection) {
    const magnitude = Math.hypot(x, y);
    if (magnitude < 0.001) return fallbackDirection;

    const angle = (Math.atan2(y, x) * 180) / Math.PI;
    if (angle >= -22.5 && angle < 22.5) return "Right";
    if (angle >= 22.5 && angle < 67.5) return "DownRight";
    if (angle >= 67.5 && angle < 112.5) return "Down";
    if (angle >= 112.5 && angle < 157.5) return "DownLeft";
    if (angle >= 157.5 || angle < -157.5) return "Left";
    if (angle >= -157.5 && angle < -112.5) return "UpLeft";
    if (angle >= -112.5 && angle < -67.5) return "Up";
    return "UpRight";
  }

  function angleDistanceDeg(a, b) {
    let delta = Math.abs(a - b);
    while (delta > 180) delta = Math.abs(delta - 360);
    return delta;
  }

  function resolveDirectionPreferDiagonal(x, y, fallbackDirection, deadbandDeg = DRAG_CARDINAL_DEADBAND_DEG) {
    const magnitude = Math.hypot(x, y);
    if (magnitude < 0.001) return fallbackDirection;

    const angle = (Math.atan2(y, x) * 180) / Math.PI;
    const cardinalCandidates = [
      { dir: "Right", angle: 0 },
      { dir: "Down", angle: 90 },
      { dir: "Left", angle: 180 },
      { dir: "Up", angle: -90 },
    ];

    let nearestCardinal = cardinalCandidates[0];
    let nearestDistance = angleDistanceDeg(angle, nearestCardinal.angle);
    for (let i = 1; i < cardinalCandidates.length; i += 1) {
      const candidate = cardinalCandidates[i];
      const distance = angleDistanceDeg(angle, candidate.angle);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestCardinal = candidate;
      }
    }

    if (nearestDistance <= deadbandDeg) {
      return nearestCardinal.dir;
    }

    if (x >= 0 && y >= 0) return "DownRight";
    if (x >= 0 && y < 0) return "UpRight";
    if (x < 0 && y < 0) return "UpLeft";
    return "DownLeft";
  }

  function buildSheetUrl(basePath, pattern, stateName, direction) {
    const fileName = pattern
      .replace(/\{dir\}/g, direction)
      .replace(/\{state\}/g, stateName);
    if (!basePath) return encodeURI(fileName);
    return encodeURI(`${basePath}/${fileName}`);
  }

  function createSpriteRuntime(payload) {
    const manifest = normalizeManifestPayload(payload);
    const imageCache = new Map();

    let stateName = "IdleReady";
    let direction = "Down";
    let frameIndex = 0;
    let frameElapsedMs = 0;
    let oneshotActive = false;
    let dragFilteredVX = 0;
    let dragFilteredVY = 0;
    let pendingDragDirection = null;
    let pendingDragDirectionMs = 0;

    function getStateDefinition(nextStateName) {
      const definition = manifest.states[nextStateName];
      if (definition) return definition;
      return manifest.states.IdleReady;
    }

    function getOrCreateImage(url) {
      const existing = imageCache.get(url);
      if (existing) return existing;

      const image = new Image();
      const entry = {
        url,
        image,
        loaded: false,
        failed: false,
      };

      image.onload = () => {
        entry.loaded = true;
      };
      image.onerror = () => {
        entry.failed = true;
      };
      image.src = url;
      imageCache.set(url, entry);
      return entry;
    }

    function setState(nextStateName, { oneshot = false, preservePhase = false } = {}) {
      const currentState = getStateDefinition(stateName);
      const nextState = getStateDefinition(nextStateName);
      const resolvedName = manifest.states[nextStateName] ? nextStateName : "IdleReady";
      if (resolvedName === stateName && oneshotActive === oneshot) return;

      if (preservePhase) {
        const currentDuration = 1000 / Math.max(1, currentState.fps);
        const phase = (frameIndex + frameElapsedMs / currentDuration) / Math.max(1, currentState.frameCount);
        const wrappedPhase = phase - Math.floor(phase);
        const nextFrameFloat = wrappedPhase * Math.max(1, nextState.frameCount);
        frameIndex = clamp(Math.floor(nextFrameFloat), 0, Math.max(0, nextState.frameCount - 1));
        const nextDuration = 1000 / Math.max(1, nextState.fps);
        frameElapsedMs = (nextFrameFloat - Math.floor(nextFrameFloat)) * nextDuration;
      } else {
        frameIndex = 0;
        frameElapsedMs = 0;
      }

      stateName = resolvedName;
      oneshotActive = oneshot;
    }

    function resolveLocomotionState(input) {
      const moving = Math.hypot(input.moveX, input.moveY) > 0.001;
      if (!moving) return "IdleReady";
      return input.running ? "Run" : "Walk";
    }

    function update(dtMs, input = {}) {
      const resolvedDtMs = Math.max(0, asFiniteNumber(dtMs, 0));
      const moveX = asFiniteNumber(input.moveX, 0);
      const moveY = asFiniteNumber(input.moveY, 0);
      const running = Boolean(input.running);
      const jumpPressed = Boolean(input.jumpPressed);
      const dragging = Boolean(input.dragging);
      const dragVX = asFiniteNumber(input.dragVX, 0);
      const dragVY = asFiniteNumber(input.dragVY, 0);
      const flinging = Boolean(input.flinging);
      const motionVX = asFiniteNumber(input.motionVX, 0);
      const motionVY = asFiniteNumber(input.motionVY, 0);
      const motionSpeed = asFiniteNumber(input.motionSpeed, Math.hypot(motionVX, motionVY));

      if (dragging) {
        const filterBlend = 1 - Math.exp(-DRAG_DIRECTION_FILTER_HZ * (resolvedDtMs / 1000));
        dragFilteredVX += (dragVX - dragFilteredVX) * filterBlend;
        dragFilteredVY += (dragVY - dragFilteredVY) * filterBlend;

        const dragSpeed = Math.hypot(dragFilteredVX, dragFilteredVY);
        if (dragSpeed >= DRAG_DIRECTION_MIN_SPEED) {
          const candidateDirection = resolveDirectionPreferDiagonal(
            dragFilteredVX,
            dragFilteredVY,
            direction
          );
          if (candidateDirection === direction) {
            pendingDragDirection = null;
            pendingDragDirectionMs = 0;
          } else if (pendingDragDirection !== candidateDirection) {
            pendingDragDirection = candidateDirection;
            pendingDragDirectionMs = 0;
          } else {
            pendingDragDirectionMs += resolvedDtMs;
            if (pendingDragDirectionMs >= DRAG_DIRECTION_SWITCH_CONFIRM_MS) {
              direction = candidateDirection;
              pendingDragDirection = null;
              pendingDragDirectionMs = 0;
            }
          }
        }
      } else {
        dragFilteredVX = 0;
        dragFilteredVY = 0;
        pendingDragDirection = null;
        pendingDragDirectionMs = 0;
        const flingSpeed = Math.hypot(motionVX, motionVY);
        if (flinging && flingSpeed >= FLING_DIRECTION_MIN_SPEED) {
          direction = resolveDirectionFromVector(motionVX, motionVY, direction);
        } else {
          direction = resolveDirectionFromVector(moveX, moveY, direction);
        }
      }
      const locomotionState = resolveLocomotionState({ moveX, moveY, running });
      const grabbedState = manifest.states.Grabbed ? "Grabbed" : "IdleReady";
      const rollState = manifest.states.Roll ? "Roll" : locomotionState;

      if (dragging) {
        setState(grabbedState, { oneshot: false, preservePhase: false });
        oneshotActive = false;
      } else if (flinging) {
        const preservePhase = stateName === "Roll" && rollState === "Roll";
        setState(rollState, { oneshot: false, preservePhase });
        oneshotActive = false;
      } else if (jumpPressed && !oneshotActive) {
        const jumpState = running || stateName === "Run" ? "RunningJump" : "Jump";
        setState(jumpState, { oneshot: true, preservePhase: false });
      } else if (!oneshotActive) {
        const preservePhase =
          (stateName === "Walk" && locomotionState === "Run") ||
          (stateName === "Run" && locomotionState === "Walk");
        setState(locomotionState, { oneshot: false, preservePhase });
      }

      const state = getStateDefinition(stateName);
      let playbackFps = Math.max(1, state.fps);
      if (stateName === "Roll" && flinging) {
        const minRollFps = Math.max(1, state.fps * ROLL_FPS_MIN_FACTOR);
        const maxRollFps = Math.max(minRollFps, state.fps * ROLL_FPS_MAX_FACTOR);
        playbackFps = clamp(
          state.fps + motionSpeed * ROLL_SPEED_FPS_MULTIPLIER,
          minRollFps,
          maxRollFps
        );
      }
      const frameDurationMs = 1000 / playbackFps;
      frameElapsedMs += resolvedDtMs;

      while (frameElapsedMs >= frameDurationMs) {
        frameElapsedMs -= frameDurationMs;
        frameIndex += 1;
      }

      if (frameIndex >= state.frameCount) {
        if (state.loop && !oneshotActive) {
          frameIndex %= state.frameCount;
        } else {
          frameIndex = Math.max(0, state.frameCount - 1);
          if (oneshotActive) {
            let fallback = locomotionState;
            if (stateName === "Jump") {
              if (locomotionState === "Run") {
                fallback = "Run";
              } else if (manifest.states[state.nextState]) {
                fallback = state.nextState;
              }
            } else if (stateName !== "RunningJump" && manifest.states[state.nextState]) {
              fallback = state.nextState;
            }
            setState(fallback, { oneshot: false, preservePhase: false });
          }
        }
      }

      const resolvedState = getStateDefinition(stateName);
      const frameX = (frameIndex % resolvedState.columns) * manifest.cell.width;
      const frameY = Math.floor(frameIndex / resolvedState.columns) * manifest.cell.height;
      const url = buildSheetUrl(manifest.basePath, resolvedState.sheetPattern, stateName, direction);
      const imageEntry = getOrCreateImage(url);

      return {
        state: stateName,
        direction,
        frameIndex,
        frameCount: resolvedState.frameCount,
        columns: resolvedState.columns,
        cell: manifest.cell,
        pivotPx: manifest.pivotPx,
        targetHeightPx: manifest.display.targetHeightPx,
        hitboxPx: resolvedState.hitboxPx,
        loop: resolvedState.loop,
        fps: playbackFps,
        baseFps: resolvedState.fps,
        imageUrl: url,
        image: imageEntry.image,
        imageLoaded: imageEntry.loaded,
        imageFailed: imageEntry.failed,
        srcRect: {
          x: frameX,
          y: frameY,
          width: manifest.cell.width,
          height: manifest.cell.height,
        },
      };
    }

    function getManifest() {
      return manifest;
    }

    function getCacheStats() {
      let loaded = 0;
      let failed = 0;
      for (const entry of imageCache.values()) {
        if (entry.loaded) loaded += 1;
        if (entry.failed) failed += 1;
      }
      return {
        total: imageCache.size,
        loaded,
        failed,
      };
    }

    return {
      update,
      getManifest,
      getCacheStats,
    };
  }

  global.PetSpriteRuntime = {
    REQUIRED_DIRECTIONS,
    CORE_STATES,
    normalizeManifestPayload,
    createSpriteRuntime,
  };
})(window);
