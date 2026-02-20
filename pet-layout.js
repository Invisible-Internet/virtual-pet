const BASE_LAYOUT = Object.freeze({
  scale: 1,
  squareWindow: true,
  rotationSafetyMargin: 18,
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

function buildMetrics({ visualWidth, visualHeight, padding, squareWindow, rotationSafetyMargin }) {
  let padTop = asPositiveNumber(padding?.top, 0);
  let padRight = asPositiveNumber(padding?.right, 0);
  let padBottom = asPositiveNumber(padding?.bottom, 0);
  let padLeft = asPositiveNumber(padding?.left, 0);

  let windowWidth = Math.round(visualWidth + padLeft + padRight);
  let windowHeight = Math.round(visualHeight + padTop + padBottom);

  if (squareWindow) {
    const side = Math.max(windowWidth, windowHeight);
    const extraX = side - windowWidth;
    const extraY = side - windowHeight;
    padLeft += Math.floor(extraX / 2);
    padRight += Math.ceil(extraX / 2);
    padTop += Math.floor(extraY / 2);
    padBottom += Math.ceil(extraY / 2);
    windowWidth = side;
    windowHeight = side;
  }

  const safetyMargin = asPositiveNumber(rotationSafetyMargin, 0);
  if (safetyMargin > 0) {
    padTop += safetyMargin;
    padRight += safetyMargin;
    padBottom += safetyMargin;
    padLeft += safetyMargin;
    windowWidth += safetyMargin * 2;
    windowHeight += safetyMargin * 2;
  }

  return Object.freeze({
    windowSize: Object.freeze({
      width: windowWidth,
      height: windowHeight,
    }),
    visualBounds: Object.freeze({
      x: Math.round(padLeft),
      y: Math.round(padTop),
      width: Math.round(visualWidth),
      height: Math.round(visualHeight),
    }),
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
}

function computePetLayout(layout = BASE_LAYOUT) {
  const scale = asPositiveNumber(layout?.scale, 1);
  const squareWindow =
    typeof layout?.squareWindow === "boolean" ? layout.squareWindow : BASE_LAYOUT.squareWindow;
  const rotationSafetyMargin = asPositiveNumber(
    layout?.rotationSafetyMargin,
    BASE_LAYOUT.rotationSafetyMargin
  );
  const visualWidth = asPositiveNumber(layout?.visualSize?.width, BASE_LAYOUT.visualSize.width);
  const visualHeight = asPositiveNumber(layout?.visualSize?.height, BASE_LAYOUT.visualSize.height);
  const padTop = asPositiveNumber(layout?.padding?.top, BASE_LAYOUT.padding.top);
  const padRight = asPositiveNumber(layout?.padding?.right, BASE_LAYOUT.padding.right);
  const padBottom = asPositiveNumber(layout?.padding?.bottom, BASE_LAYOUT.padding.bottom);
  const padLeft = asPositiveNumber(layout?.padding?.left, BASE_LAYOUT.padding.left);

  const baseMetrics = buildMetrics({
    visualWidth,
    visualHeight,
    padding: { top: padTop, right: padRight, bottom: padBottom, left: padLeft },
    squareWindow,
    rotationSafetyMargin,
  });

  const scaledMetrics = buildMetrics({
    visualWidth: scalePx(visualWidth, scale),
    visualHeight: scalePx(visualHeight, scale),
    padding: {
      top: scalePx(baseMetrics.padding.top, scale),
      right: scalePx(baseMetrics.padding.right, scale),
      bottom: scalePx(baseMetrics.padding.bottom, scale),
      left: scalePx(baseMetrics.padding.left, scale),
    },
    squareWindow,
    rotationSafetyMargin: 0,
  });

  const base = Object.freeze({
    windowSize: baseMetrics.windowSize,
    visualBounds: baseMetrics.visualBounds,
    visualSize: baseMetrics.visualSize,
    padding: baseMetrics.padding,
  });

  return Object.freeze({
    scale,
    squareWindow,
    rotationSafetyMargin,
    base,
    padding: scaledMetrics.padding,
    visualSize: scaledMetrics.visualSize,
    visualBounds: scaledMetrics.visualBounds,
    windowSize: scaledMetrics.windowSize,
  });
}

module.exports = {
  BASE_LAYOUT,
  computePetLayout,
};
