const BASE_LAYOUT = Object.freeze({
  scale: 1,
  visualSize: Object.freeze({
    width: 220,
    height: 440,
  }),
  padding: Object.freeze({
    top: 50,
    right: 50,
    bottom: 50,
    left: 50,
  }),
});

function asPositiveNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function scalePx(value, scale) {
  return Math.round(value * scale);
}

function computePetLayout(layout = BASE_LAYOUT) {
  const scale = asPositiveNumber(layout?.scale, 1);
  const visualWidth = asPositiveNumber(layout?.visualSize?.width, BASE_LAYOUT.visualSize.width);
  const visualHeight = asPositiveNumber(layout?.visualSize?.height, BASE_LAYOUT.visualSize.height);
  const padTop = asPositiveNumber(layout?.padding?.top, BASE_LAYOUT.padding.top);
  const padRight = asPositiveNumber(layout?.padding?.right, BASE_LAYOUT.padding.right);
  const padBottom = asPositiveNumber(layout?.padding?.bottom, BASE_LAYOUT.padding.bottom);
  const padLeft = asPositiveNumber(layout?.padding?.left, BASE_LAYOUT.padding.left);

  const baseWindowSize = Object.freeze({
    width: Math.round(visualWidth + padLeft + padRight),
    height: Math.round(visualHeight + padTop + padBottom),
  });

  const baseVisualBounds = Object.freeze({
    x: Math.round(padLeft),
    y: Math.round(padTop),
    width: Math.round(visualWidth),
    height: Math.round(visualHeight),
  });

  const padding = Object.freeze({
    top: scalePx(padTop, scale),
    right: scalePx(padRight, scale),
    bottom: scalePx(padBottom, scale),
    left: scalePx(padLeft, scale),
  });

  const visualSize = Object.freeze({
    width: scalePx(visualWidth, scale),
    height: scalePx(visualHeight, scale),
  });

  const windowSize = Object.freeze({
    width: visualSize.width + padding.left + padding.right,
    height: visualSize.height + padding.top + padding.bottom,
  });

  const visualBounds = Object.freeze({
    x: padding.left,
    y: padding.top,
    width: visualSize.width,
    height: visualSize.height,
  });

  const base = Object.freeze({
    windowSize: baseWindowSize,
    visualBounds: baseVisualBounds,
    visualSize: Object.freeze({
      width: Math.round(visualWidth),
      height: Math.round(visualHeight),
    }),
    padding: Object.freeze({
      top: Math.round(padTop),
      right: Math.round(padRight),
      bottom: Math.round(padBottom),
      left: Math.round(padLeft),
    }),
  });

  return Object.freeze({
    scale,
    base,
    padding,
    visualSize,
    visualBounds,
    windowSize,
  });
}

module.exports = {
  BASE_LAYOUT,
  computePetLayout,
};
