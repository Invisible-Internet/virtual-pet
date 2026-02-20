"use strict";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizePetBounds(bounds, windowSize) {
  if (!bounds || typeof bounds !== "object") return null;
  if (!windowSize || !Number.isFinite(windowSize.width) || !Number.isFinite(windowSize.height)) {
    return null;
  }

  const x = Number(bounds.x);
  const y = Number(bounds.y);
  const width = Number(bounds.width);
  const height = Number(bounds.height);
  const tMs = Number(bounds.tMs);

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(tMs)
  ) {
    return null;
  }
  if (width <= 0 || height <= 0) {
    return null;
  }

  const minX = -windowSize.width;
  const minY = -windowSize.height;
  const maxX = windowSize.width;
  const maxY = windowSize.height;

  return {
    x: clamp(Math.round(x), minX, maxX),
    y: clamp(Math.round(y), minY, maxY),
    width: clamp(Math.round(width), 1, windowSize.width * 2),
    height: clamp(Math.round(height), 1, windowSize.height * 2),
    tMs,
  };
}

function computeClampRange(displayBounds, petBounds) {
  let minX = Math.round(displayBounds.x - petBounds.x);
  let maxX = Math.round(displayBounds.x + displayBounds.width - (petBounds.x + petBounds.width));
  let minY = Math.round(displayBounds.y - petBounds.y);
  let maxY = Math.round(displayBounds.y + displayBounds.height - (petBounds.y + petBounds.height));

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

  return { minX, maxX, minY, maxY };
}

function clampWindowPosition(targetX, targetY, displayBounds, petBounds) {
  const range = computeClampRange(displayBounds, petBounds);
  return {
    x: clamp(targetX, range.minX, range.maxX),
    y: clamp(targetY, range.minY, range.maxY),
    range,
  };
}

function createDragClampLatch() {
  return { x: null, y: null };
}

function applyAxisClampWithHysteresis({
  target,
  rawClamped,
  min,
  max,
  side,
  hysteresisPx,
}) {
  const rawHit = Math.abs(rawClamped - target) > 0.001;

  if (rawHit) {
    if (target <= min + 0.001) {
      return { value: min, side: "min", clamped: true };
    }
    if (target >= max - 0.001) {
      return { value: max, side: "max", clamped: true };
    }
    return {
      value: rawClamped,
      side: rawClamped <= (min + max) * 0.5 ? "min" : "max",
      clamped: true,
    };
  }

  if (!side) {
    return { value: rawClamped, side: null, clamped: false };
  }

  if (side === "min") {
    if (target <= min + hysteresisPx) {
      return { value: min, side: "min", clamped: true };
    }
    return { value: rawClamped, side: null, clamped: false };
  }

  if (target >= max - hysteresisPx) {
    return { value: max, side: "max", clamped: true };
  }
  return { value: rawClamped, side: null, clamped: false };
}

function applyDragClampHysteresis({
  targetX,
  targetY,
  rawClampedX,
  rawClampedY,
  range,
  latch,
  hysteresisPx = 2,
}) {
  const resolvedLatch = latch || createDragClampLatch();
  const xState = applyAxisClampWithHysteresis({
    target: targetX,
    rawClamped: rawClampedX,
    min: range.minX,
    max: range.maxX,
    side: resolvedLatch.x,
    hysteresisPx,
  });
  const yState = applyAxisClampWithHysteresis({
    target: targetY,
    rawClamped: rawClampedY,
    min: range.minY,
    max: range.maxY,
    side: resolvedLatch.y,
    hysteresisPx,
  });

  resolvedLatch.x = xState.side;
  resolvedLatch.y = yState.side;

  return {
    x: xState.value,
    y: yState.value,
    clampHit: { x: xState.clamped, y: yState.clamped },
    latch: resolvedLatch,
  };
}

module.exports = {
  normalizePetBounds,
  computeClampRange,
  clampWindowPosition,
  createDragClampLatch,
  applyDragClampHysteresis,
};
