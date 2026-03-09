"use strict";

const { createStateRuntime } = require("../state-runtime");

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

function createClock(startMs = 1000) {
  let nowMs = startMs;
  return {
    now() {
      return nowMs;
    },
    advance(deltaMs) {
      nowMs += deltaMs;
      return nowMs;
    },
  };
}

function createRuntime(clock) {
  return createStateRuntime({
    now: () => clock.now(),
    availableClipIds: [
      "IdleReady",
      "Walk",
      "Run",
      "Jump",
      "RunningJump",
      "Roll",
      "Grabbed",
    ],
    scheduleTimeout: () => null,
    clearScheduledTimeout: () => {},
  });
}

function testStartupState() {
  const clock = createClock(1000);
  const runtime = createRuntime(clock);
  const snapshot = runtime.start();

  assertEqual(snapshot.currentState, "Idle", "startup state should be Idle");
  assertEqual(snapshot.visual.clip, "IdleReady", "Idle visual clip mismatch");
  assert(snapshot.visualFallbackUsed === false, "Idle should not start in fallback mode");
}

function testReadingState() {
  const clock = createClock(2000);
  const runtime = createRuntime(clock);
  runtime.start();

  const snapshot = runtime.activateState("Reading", {
    source: "manual",
    reason: "check-script",
    context: {
      title: "FreshRSS release notes",
      sourceLabel: "FreshRSS",
      itemType: "rss article",
    },
  });
  const readingDescription = runtime.describeReading();

  assertEqual(snapshot.currentState, "Reading", "Reading should become active");
  assertEqual(snapshot.visual.clip, "IdleReady", "Reading clip mismatch");
  assertEqual(snapshot.visual.overlay, "book", "Reading overlay mismatch");
  assert(snapshot.visualFallbackUsed === false, "Reading should not need fallback with valid resources");
  assertIncludes(
    readingDescription.text,
    "FreshRSS release notes",
    "Reading description should include the reading title"
  );
}

function testManualReadingDurationOverride() {
  const clock = createClock(2400);
  const runtime = createRuntime(clock);
  runtime.start();

  let snapshot = runtime.activateState("Reading", {
    source: "manual",
    reason: "manual-duration-check",
    durationMs: 900,
    onCompleteStateId: "Idle",
    context: {
      title: "The Pragmatic Programmer",
      sourceLabel: "local library",
    },
  });
  assertEqual(snapshot.currentState, "Reading", "manual reading should start as Reading");

  clock.advance(899);
  snapshot = runtime.tick(clock.now());
  assertEqual(snapshot.currentState, "Reading", "manual reading should remain active before expiry");

  clock.advance(1);
  snapshot = runtime.tick(clock.now());
  assertEqual(snapshot.currentState, "Idle", "manual reading should return to Idle after expiry");
}

function testPoolPlayPhases() {
  const clock = createClock(3000);
  const runtime = createRuntime(clock);
  runtime.start();

  let snapshot = runtime.activateState("PoolPlay", {
    source: "manual",
    reason: "check-script",
  });
  assertEqual(snapshot.phase, "enter", "PoolPlay should start at enter");
  assertEqual(snapshot.visual.clip, "Jump", "PoolPlay enter clip mismatch");

  clock.advance(450);
  snapshot = runtime.tick(clock.now());
  assertEqual(snapshot.phase, "loop", "PoolPlay should advance to loop");
  assertEqual(snapshot.visual.overlay, "poolRing", "PoolPlay loop overlay mismatch");

  clock.advance(1200);
  snapshot = runtime.tick(clock.now());
  assertEqual(snapshot.phase, "exit", "PoolPlay should advance to exit");

  clock.advance(450);
  snapshot = runtime.tick(clock.now());
  assertEqual(snapshot.phase, "recover", "PoolPlay should advance to recover");

  clock.advance(650);
  snapshot = runtime.tick(clock.now());
  assertEqual(snapshot.currentState, "Idle", "PoolPlay should resolve back to Idle");
}

function testMissingVisualFallbackAndNarrationFallback() {
  const clock = createClock(4000);
  const runtime = createRuntime(clock);
  runtime.start();

  const snapshot = runtime.simulateMissingVisualFallback();
  const readingDescription = runtime.describeReading();

  assertEqual(snapshot.currentState, "Reading", "Fallback simulation should still target Reading");
  assert(snapshot.visualFallbackUsed === true, "Fallback simulation should mark visualFallbackUsed");
  assertEqual(snapshot.visual.clip, "IdleReady", "Fallback simulation should resolve to IdleReady");
  assert(
    Array.isArray(snapshot.fallbackReasons) &&
      snapshot.fallbackReasons.includes("clip:MissingClip"),
    "Fallback simulation should report missing clip"
  );
  assert(readingDescription.fallbackUsed === true, "Missing reading context should use fallback narration");
  assertIncludes(
    readingDescription.text,
    "do not have the title handy",
    "Reading fallback narration mismatch"
  );
}

function testMusicState() {
  const clock = createClock(5000);
  const runtime = createRuntime(clock);
  runtime.start();

  const snapshot = runtime.applyMusicState({
    suggestedState: "MusicChill",
    title: "Night Drive",
    artist: "Primea FM",
    album: "Sample Rotation",
    outputRoute: "speaker",
    outputDeviceName: "Desktop Speakers",
    outputDeviceType: "computer",
  });
  const activityDescription = runtime.describeActivity();

  assertEqual(snapshot.currentState, "MusicChill", "Music state should resolve to MusicChill");
  assertEqual(snapshot.visual.overlay, "speaker", "Music state overlay mismatch");
  assertIncludes(
    activityDescription.text,
    "Night Drive",
    "Music description should include the active track"
  );
}

function testMusicStateUnknownRouteFallback() {
  const clock = createClock(5500);
  const runtime = createRuntime(clock);
  runtime.start();

  const snapshot = runtime.applyMusicState({
    suggestedState: "MusicChill",
    title: "Indie Rokkers",
    artist: "MGMT",
    album: "Time to Pretend",
    outputRoute: "unknown",
    outputDeviceName: "unknown_device",
    outputDeviceType: "unknown",
  });

  assertEqual(snapshot.visual.overlay, "musicNote", "Unknown route should use generic music overlay");
}

function testMusicStateWithoutArtistUsesTitle() {
  const clock = createClock(5750);
  const runtime = createRuntime(clock);
  runtime.start();

  const snapshot = runtime.applyMusicState({
    suggestedState: "MusicChill",
    title: "Lo-fi Coding Stream",
    artist: "",
    sourceAppLabel: "Google Chrome",
    outputRoute: "speaker",
    outputDeviceName: "Speakers (Realtek(R) Audio)",
    outputDeviceType: "speaker",
  });
  const activityDescription = runtime.describeActivity();

  assertEqual(snapshot.visual.overlay, "speaker", "Speaker route should remain speaker");
  assertIncludes(
    activityDescription.text,
    "Lo-fi Coding Stream",
    "Music description should still include title when artist is missing"
  );
}

function testMusicStateRespectsHigherPriorityState() {
  const clock = createClock(5900);
  const runtime = createRuntime(clock);
  runtime.start();
  runtime.activateState("Reading", {
    source: "manual",
    reason: "priority-check",
    context: {
      title: "The Pragmatic Programmer",
      sourceLabel: "local library",
    },
  });

  const snapshot = runtime.applyMusicState({
    suggestedState: "MusicChill",
    title: "Wolf Like Me",
    artist: "TV On The Radio",
    outputRoute: "speaker",
  });

  assertEqual(snapshot.currentState, "Reading", "Music should not preempt higher-priority Reading");
}

function testMusicDanceDurationOverride() {
  const clock = createClock(5950);
  const runtime = createRuntime(clock);
  runtime.start();

  let snapshot = runtime.applyMusicState({
    suggestedState: "MusicDance",
    title: "Quick Burst",
    artist: "Test Artist",
    durationMs: 1200,
    onCompleteStateId: "Idle",
  });
  assertEqual(snapshot.currentState, "MusicDance", "MusicDance override should become active");

  clock.advance(1199);
  snapshot = runtime.tick(clock.now());
  assertEqual(snapshot.currentState, "MusicDance", "MusicDance should remain before override expiry");

  clock.advance(1);
  snapshot = runtime.tick(clock.now());
  assertEqual(snapshot.currentState, "Idle", "MusicDance should resolve to Idle after override expiry");
}

function testFreshRssReadingState() {
  const clock = createClock(6000);
  const runtime = createRuntime(clock);
  runtime.start();

  let snapshot = runtime.applyFreshRssReading({
    items: [
      {
        source: "FreshRSS releases",
        title: "FreshRSS 1.28.1",
        url: "https://example.invalid/freshrss",
      },
    ],
  });
  const readingDescription = runtime.describeReading();

  assertEqual(snapshot.currentState, "Reading", "FreshRSS reading should resolve to Reading");
  assertEqual(snapshot.visual.overlay, "rssCard", "FreshRSS reading overlay mismatch");
  assertIncludes(
    readingDescription.text,
    "FreshRSS 1.28.1",
    "FreshRSS reading description should include the latest title"
  );

  clock.advance(11999);
  snapshot = runtime.tick(clock.now());
  assertEqual(snapshot.currentState, "Reading", "FreshRSS reading should remain active before expiry");

  clock.advance(1);
  snapshot = runtime.tick(clock.now());
  assertEqual(snapshot.currentState, "Idle", "FreshRSS reading should return to Idle after expiry");
}

function run() {
  testStartupState();
  testReadingState();
  testManualReadingDurationOverride();
  testPoolPlayPhases();
  testMissingVisualFallbackAndNarrationFallback();
  testMusicState();
  testMusicStateUnknownRouteFallback();
  testMusicStateWithoutArtistUsesTitle();
  testMusicStateRespectsHigherPriorityState();
  testMusicDanceDurationOverride();
  testFreshRssReadingState();
  console.log("[state-runtime] checks passed");
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
