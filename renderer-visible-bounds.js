(function attachVisibleBoundsMath(globalScope) {
  "use strict";

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rotatePointAround(point, center, angleRad) {
    if (!point || !center) return null;
    if (!Number.isFinite(angleRad) || Math.abs(angleRad) < 0.00001) {
      return { x: point.x, y: point.y };
    }

    const s = Math.sin(angleRad);
    const c = Math.cos(angleRad);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
      x: center.x + dx * c - dy * s,
      y: center.y + dx * s + dy * c,
    };
  }

  function includeCircle(bounds, point, radius) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0;
    bounds.minX = Math.min(bounds.minX, point.x - safeRadius);
    bounds.maxX = Math.max(bounds.maxX, point.x + safeRadius);
    bounds.minY = Math.min(bounds.minY, point.y - safeRadius);
    bounds.maxY = Math.max(bounds.maxY, point.y + safeRadius);
  }

  function clampBoundsToWindow(bounds, windowWidth, windowHeight) {
    const minX = clamp(bounds.minX, 0, windowWidth);
    const maxX = clamp(bounds.maxX, 0, windowWidth);
    const minY = clamp(bounds.minY, 0, windowHeight);
    const maxY = clamp(bounds.maxY, 0, windowHeight);
    return {
      x: Math.min(minX, maxX),
      y: Math.min(minY, maxY),
      width: Math.max(1, Math.abs(maxX - minX)),
      height: Math.max(1, Math.abs(maxY - minY)),
    };
  }

  function toGlobalPoint(localPoint, globalTransform) {
    const rotation = Number.isFinite(globalTransform?.rotation) ? globalTransform.rotation : 0;
    const anchor = {
      x: Number.isFinite(globalTransform?.anchorX) ? globalTransform.anchorX : 0,
      y: Number.isFinite(globalTransform?.anchorY) ? globalTransform.anchorY : 0,
    };
    return rotatePointAround(localPoint, anchor, rotation);
  }

  function includePolyline(bounds, points, radius, globalTransform) {
    if (!Array.isArray(points)) return;
    for (const point of points) {
      includeCircle(bounds, toGlobalPoint(point, globalTransform), radius);
    }
  }

  function computeVisiblePetBounds(layerTransforms, windowWidth, windowHeight, fallbackBounds) {
    const body = layerTransforms?.body;
    const tail = layerTransforms?.tail;
    const globalTransform = layerTransforms?.global;
    const fallback =
      fallbackBounds && Number.isFinite(fallbackBounds.width) && Number.isFinite(fallbackBounds.height)
        ? fallbackBounds
        : { x: 0, y: 0, width: Math.max(1, windowWidth), height: Math.max(1, windowHeight) };

    if (!body || !tail) {
      return {
        x: fallback.x,
        y: fallback.y,
        width: fallback.width,
        height: fallback.height,
      };
    }

    const bounds = {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    };

    includeCircle(
      bounds,
      toGlobalPoint({ x: body.x, y: body.y }, globalTransform),
      Number.isFinite(body.radius) ? body.radius : 0
    );

    const tailHalfWidth = Number.isFinite(tail.hitHalfWidth) ? tail.hitHalfWidth : 6;
    const tailTipRadius = Number.isFinite(tail.tipHitRadius) ? tail.tipHitRadius : 8;
    if (Array.isArray(tail.points) && tail.points.length > 1) {
      includePolyline(bounds, tail.points, tailHalfWidth, globalTransform);
      includeCircle(
        bounds,
        toGlobalPoint(tail.points[tail.points.length - 1], globalTransform),
        tailTipRadius
      );
    } else {
      includeCircle(bounds, toGlobalPoint({ x: tail.rootX, y: tail.rootY }, globalTransform), tailHalfWidth);
      includeCircle(bounds, toGlobalPoint({ x: tail.ctrlX, y: tail.ctrlY }, globalTransform), tailHalfWidth);
      includeCircle(bounds, toGlobalPoint({ x: tail.tipX, y: tail.tipY }, globalTransform), tailTipRadius);
    }

    if (
      !Number.isFinite(bounds.minX) ||
      !Number.isFinite(bounds.minY) ||
      !Number.isFinite(bounds.maxX) ||
      !Number.isFinite(bounds.maxY)
    ) {
      return {
        x: fallback.x,
        y: fallback.y,
        width: fallback.width,
        height: fallback.height,
      };
    }

    return clampBoundsToWindow(bounds, windowWidth, windowHeight);
  }

  globalScope.PetVisibleBoundsMath = Object.freeze({
    computeVisiblePetBounds,
  });
})(window);
