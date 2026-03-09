"use strict";

const {
  buildDefaultForegroundWindowSensorSettings,
  buildForegroundWindowProbeKey,
  normalizeForegroundWindowProbePayload,
  normalizeForegroundWindowSensorSettings,
  probeForegroundWindowState,
  summarizeProbeError,
} = require("../foreground-window-runtime");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} (expected "${expected}", got "${actual}")`);
  }
}

function testSettingsNormalization() {
  const defaults = buildDefaultForegroundWindowSensorSettings();
  assertEqual(defaults.enabled, true, "default enabled mismatch");
  assertEqual(defaults.backend, "powershell", "default backend mismatch");
  assertEqual(defaults.pollIntervalMs, 250, "default poll interval mismatch");
  assertEqual(defaults.probeTimeoutMs, 800, "default timeout mismatch");

  const normalized = normalizeForegroundWindowSensorSettings({
    enabled: "false",
    backend: "invalid",
    pollIntervalMs: "40",
    probeTimeoutMs: "20",
  });
  assertEqual(normalized.enabled, false, "enabled flag normalization mismatch");
  assertEqual(normalized.backend, "powershell", "backend should normalize to powershell");
  assertEqual(normalized.pollIntervalMs, 100, "poll interval minimum clamp mismatch");
  assertEqual(normalized.probeTimeoutMs, 100, "timeout minimum clamp mismatch");
}

function testPayloadNormalizationAndKeys() {
  const healthy = normalizeForegroundWindowProbePayload({
    ok: true,
    windowId: "0xABC",
    processId: 1000,
    processName: "chrome",
    title: "YouTube",
    bounds: { x: 10, y: 20, width: 1920, height: 1080 },
    ts: 1700000000123,
  });
  assertEqual(healthy.ok, true, "healthy payload should normalize as ok");
  assertEqual(healthy.windowId, "0xABC", "windowId normalization mismatch");
  assertEqual(healthy.processId, 1000, "processId normalization mismatch");
  assertEqual(healthy.bounds.width, 1920, "bounds width normalization mismatch");
  assertEqual(healthy.error, null, "healthy payload should not include error");

  const degraded = normalizeForegroundWindowProbePayload({
    ok: false,
    error: "probe_timeout",
    bounds: { x: 0, y: 0, width: 0, height: 100 },
  });
  assertEqual(degraded.ok, false, "degraded payload should normalize as not ok");
  assertEqual(degraded.bounds, null, "invalid bounds should normalize to null");
  assertEqual(degraded.error, "probe_timeout", "degraded error should be preserved");

  const keyA = buildForegroundWindowProbeKey(healthy);
  const keyB = buildForegroundWindowProbeKey({
    ...healthy,
  });
  assertEqual(keyA, keyB, "probe keys should be deterministic for same payload");
}

function testErrorClassification() {
  assertEqual(
    summarizeProbeError({ message: "timed out" }),
    "probe_timeout",
    "timeout error classification mismatch"
  );
  assertEqual(
    summarizeProbeError({ stderr: "Cannot find path C:\\missing.ps1" }),
    "probe_script_missing",
    "missing script error classification mismatch"
  );
  assertEqual(
    summarizeProbeError({ stderr: "Access is denied." }),
    "access_denied",
    "access denied error classification mismatch"
  );
}

async function testDisabledOrUnsupportedProbe() {
  const result = await probeForegroundWindowState({
    settings: {
      enabled: false,
      backend: "powershell",
      pollIntervalMs: 250,
      probeTimeoutMs: 800,
    },
  });
  if (process.platform === "win32") {
    assertEqual(result.error, "disabled_by_config", "disabled probe should report disabled_by_config on windows");
  } else {
    assertEqual(result.error, "unsupported_platform", "non-windows probe should report unsupported_platform");
  }
  assertEqual(result.ok, false, "disabled/unsupported probe should be non-ok");
}

async function run() {
  testSettingsNormalization();
  testPayloadNormalizationAndKeys();
  testErrorClassification();
  await testDisabledOrUnsupportedProbe();
  console.log("[foreground-window-runtime] checks passed");
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error.message || String(error));
    process.exit(1);
  });
}

module.exports = {
  run,
};
