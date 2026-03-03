"use strict";

const {
  buildDefaultLocalMediaSensorSettings,
  normalizeLocalMediaSensorSettings,
  classifyOutputRoute,
  deriveSourceAppLabel,
  deriveMediaProvider,
  normalizeWindowsMediaProbePayload,
  buildLocalMediaEventPayload,
  buildLocalMediaProbeKey,
  buildLocalMediaResponseText,
} = require("../windows-media-sensor");

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

function assertIncludes(value, expectedPart, message) {
  if (typeof value !== "string" || !value.includes(expectedPart)) {
    throw new Error(`${message} (expected to include "${expectedPart}")`);
  }
}

function testSettings() {
  const defaults = buildDefaultLocalMediaSensorSettings();
  assertEqual(defaults.enabled, true, "local media sensor should default enabled");
  assertEqual(defaults.pollIntervalMs, 2500, "local media poll interval mismatch");

  const normalized = normalizeLocalMediaSensorSettings({
    enabled: false,
    pollIntervalMs: 900,
    probeTimeoutMs: 1200,
    includeOutputDevice: false,
  });
  assertEqual(normalized.enabled, false, "local media enabled should normalize");
  assertEqual(normalized.pollIntervalMs, 900, "local media poll interval should normalize");
  assertEqual(normalized.probeTimeoutMs, 1200, "local media timeout should normalize");
  assertEqual(normalized.includeOutputDevice, false, "local media output flag should normalize");
}

function testRouteClassification() {
  assertEqual(
    classifyOutputRoute({ outputDeviceName: "Speakers (Realtek(R) Audio)" }),
    "speaker",
    "speaker route classification mismatch"
  );
  assertEqual(
    classifyOutputRoute({ outputDeviceName: "Headphones (Bluetooth Audio)" }),
    "headphones",
    "headphones route classification mismatch"
  );
  assertEqual(
    classifyOutputRoute({ outputDeviceName: "USB Audio Device" }),
    "unknown",
    "unknown route classification mismatch"
  );
}

function testSourceNormalization() {
  const label = deriveSourceAppLabel("SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify");
  assertEqual(label, "Spotify", "source app label mismatch");
  assertEqual(
    deriveMediaProvider("SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify", label),
    "spotify",
    "source provider mismatch"
  );
}

function testPayloadNormalization() {
  const normalized = normalizeWindowsMediaProbePayload({
    ok: true,
    source: "GSMTC",
    isPlaying: true,
    playbackStatus: "Playing",
    sourceAppUserModelId: "SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify",
    title: "Wolf Like Me",
    artist: "TV On The Radio",
    album: "Return To Cookie Mountain",
    outputDeviceName: "Speakers (Realtek(R) Audio)",
  });
  assertEqual(normalized.provider, "spotify", "normalized provider mismatch");
  assertEqual(normalized.outputRoute, "speaker", "normalized route mismatch");
  assertEqual(normalized.sourceAppLabel, "Spotify", "normalized app label mismatch");

  const eventPayload = buildLocalMediaEventPayload(normalized);
  assertEqual(eventPayload.activeProp, "speaker", "event payload prop mismatch");
  assertEqual(eventPayload.source, "GSMTC", "event payload source mismatch");

  const responseText = buildLocalMediaResponseText(normalized);
  assertIncludes(responseText, "Wolf Like Me", "response text should include title");
  assertIncludes(responseText, "Spotify", "response text should include source app");

  const key = buildLocalMediaProbeKey(normalized);
  assertIncludes(key, "Wolf Like Me", "probe key should include title");
}

function run() {
  testSettings();
  testRouteClassification();
  testSourceNormalization();
  testPayloadNormalization();
  console.log("[windows-media-sensor] checks passed");
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
