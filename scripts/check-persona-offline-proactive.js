"use strict";

const { run: runOfflinePersonaStyle } = require("./check-offline-persona-style");
const { run: runProactivePolicy } = require("./check-proactive-policy");

function run() {
  runOfflinePersonaStyle();
  runProactivePolicy();
  console.log("[persona-offline-proactive] checks passed");
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
