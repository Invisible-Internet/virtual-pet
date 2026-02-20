"use strict";

const { BASE_LAYOUT, computePetLayout } = require("../pet-layout");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function checkLayout(layout, label) {
  const windowSize = layout.windowSize;
  const visualBounds = layout.visualBounds;

  assert(windowSize.width > 0, `${label}: window width must be > 0`);
  assert(windowSize.height > 0, `${label}: window height must be > 0`);
  assert(visualBounds.width > 0, `${label}: visual width must be > 0`);
  assert(visualBounds.height > 0, `${label}: visual height must be > 0`);

  assert(visualBounds.x >= 0, `${label}: visual x must be >= 0`);
  assert(visualBounds.y >= 0, `${label}: visual y must be >= 0`);
  assert(
    visualBounds.x + visualBounds.width <= windowSize.width,
    `${label}: visual bounds must fit inside window width`
  );
  assert(
    visualBounds.y + visualBounds.height <= windowSize.height,
    `${label}: visual bounds must fit inside window height`
  );

  if (layout.squareWindow) {
    assert(
      windowSize.width === windowSize.height,
      `${label}: squareWindow enabled but window is not square`
    );
  }
}

function run() {
  const scales = [1, 1.25, 1.5, 2];
  const layouts = [
    { name: "base", config: BASE_LAYOUT },
    ...scales.map((scale) => ({
      name: `scale-${scale}`,
      config: { ...BASE_LAYOUT, scale },
    })),
  ];

  for (const item of layouts) {
    const resolved = computePetLayout(item.config);
    checkLayout(resolved, item.name);
    checkLayout(resolved.base, `${item.name}-base`);
  }

  console.log("layout checks passed");
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
