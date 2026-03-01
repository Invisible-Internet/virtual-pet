"use strict";

const {
  FRESHRSS_STREAMS,
  buildDefaultIntegrationSettings,
  normalizeIntegrationSettings,
  deriveIntegrationCapabilityState,
  createSpotifyPlaybackEvent,
  createTrackRatingObservation,
  rankFreshRssCandidates,
} = require("../integration-runtime");

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

function testSettingsNormalization() {
  const defaults = buildDefaultIntegrationSettings();
  assert(defaults.spotify.enabled === true, "spotify should default enabled");
  assert(defaults.freshRss.dailyTopItems === 3, "freshRss dailyTopItems should default to 3");

  const normalized = normalizeIntegrationSettings({
    spotify: {
      available: false,
      defaultTrackTitle: "After Hours",
    },
    freshRss: {
      available: true,
      dailyTopItems: 9,
    },
  });
  assertEqual(normalized.spotify.available, false, "spotify available should normalize");
  assertEqual(normalized.spotify.defaultTrackTitle, "After Hours", "spotify default track should normalize");
  assertEqual(normalized.freshRss.available, true, "freshRss available should normalize");
  assertEqual(normalized.freshRss.dailyTopItems, 3, "freshRss dailyTopItems should cap at 3");
}

function testCapabilityStates() {
  const healthy = deriveIntegrationCapabilityState(
    "spotify",
    { enabled: true, available: true, transport: "stub" },
    {
      openclawEnabled: true,
      probeState: {
        state: "healthy",
        reason: "probeHealthy",
        lastProbeAt: 1,
        lastSuccessAt: 1,
      },
    }
  );
  assertEqual(healthy.state, "healthy", "spotify healthy state mismatch");

  const unavailable = deriveIntegrationCapabilityState(
    "spotify",
    { enabled: true, available: false, transport: "stub" },
    {
      openclawEnabled: true,
      probeState: {
        state: "healthy",
        reason: "probeHealthy",
      },
    }
  );
  assertEqual(unavailable.state, "degraded", "spotify unavailable state mismatch");
  assertEqual(unavailable.reason, "providerUnavailable", "spotify unavailable reason mismatch");

  const pending = deriveIntegrationCapabilityState(
    "spotify",
    { enabled: true, available: true, transport: "stub" },
    {
      openclawEnabled: true,
      probeState: {
        state: "pending",
        reason: "probePending",
      },
    }
  );
  assertEqual(pending.state, "degraded", "spotify pending probe should degrade");
  assertEqual(pending.reason, "probePending", "spotify pending probe reason mismatch");

  const fallback = deriveIntegrationCapabilityState(
    "spotify",
    { enabled: true, available: true, transport: "stub" },
    {
      openclawEnabled: false,
      probeState: {
        state: "degraded",
        reason: "agent_command_failed",
      },
    }
  );
  assertEqual(fallback.state, "degraded", "spotify disabled openclaw should degrade");
  assertEqual(fallback.reason, "openclawDisabledFallback", "spotify disabled openclaw reason mismatch");
}

function testSpotifyPlaybackEvent() {
  const online = createSpotifyPlaybackEvent(
    {
      enabled: true,
      available: true,
      defaultTrackTitle: "Night Drive",
      defaultArtist: "Primea FM",
      defaultAlbum: "Sample Rotation",
    },
    {},
    {
      openclawEnabled: true,
      probeState: {
        state: "healthy",
        reason: "probeHealthy",
        lastProbeAt: 1,
        lastSuccessAt: 1,
      },
    }
  );
  assertEqual(online.source, "online", "spotify playback should be online when healthy");
  assertEqual(online.suggestedState, "MusicChill", "spotify suggested state mismatch");
  assertEqual(online.eventPayload.activeProp, "headphones", "spotify active prop mismatch");
  assertIncludes(online.responseText, "Spotify playback detected", "spotify online text mismatch");

  const fallback = createSpotifyPlaybackEvent(
    {
      enabled: true,
      available: false,
      defaultTrackTitle: "Night Drive",
      defaultArtist: "Primea FM",
      defaultAlbum: "Sample Rotation",
    },
    {
      trackTitle: "Night Drive",
      artist: "Primea FM",
    },
    {
      openclawEnabled: true,
      probeState: {
        state: "healthy",
        reason: "probeHealthy",
        lastProbeAt: 1,
        lastSuccessAt: 1,
      },
    }
  );
  assertEqual(fallback.source, "offline", "spotify fallback should be offline");
  assertEqual(fallback.fallbackMode, "spotify_provider_unavailable", "spotify fallback mode mismatch");
  assertIncludes(fallback.responseText, "Local MusicChill fallback", "spotify fallback text mismatch");
}

function testTrackRatingObservation() {
  const observation = createTrackRatingObservation(
    {
      provider: "spotify",
      rating: 11,
      trackTitle: "Night Drive",
      artist: "Primea FM",
      album: "Sample Rotation",
    },
    "corr-track"
  );
  assertEqual(observation.observationType, "track_rating", "track rating observation type mismatch");
  assertEqual(observation.payload.rating, 10, "track rating should clamp to 10");
  assertEqual(observation.correlationId, "corr-track", "track rating correlationId mismatch");
  assertIncludes(observation.evidenceTag, "spotify-night-drive", "track rating evidence tag mismatch");
}

function testFreshRssRanking() {
  const ranked = rankFreshRssCandidates(
    [
      {
        title: "A",
        stream: FRESHRSS_STREAMS.discovery,
        tags: ["indie"],
        positiveReinforcement: 0,
      },
      {
        title: "B",
        stream: FRESHRSS_STREAMS.curated,
        tags: ["indie", "synth"],
        positiveReinforcement: 2,
      },
      {
        title: "C",
        stream: FRESHRSS_STREAMS.demographic,
        tags: ["ambient"],
        positiveReinforcement: 1,
      },
    ],
    {
      identityTags: ["synth", "ambient"],
    },
    3
  );

  assertEqual(ranked.length, 3, "freshRss ranking length mismatch");
  assertEqual(ranked[0].title, "B", "freshRss top-ranked title mismatch");
  assertEqual(ranked[0].score, 7, "freshRss top-ranked score mismatch");
  assertEqual(ranked[1].title, "C", "freshRss second-ranked title mismatch");
  assertEqual(ranked[2].title, "A", "freshRss third-ranked title mismatch");
}

function run() {
  testSettingsNormalization();
  testCapabilityStates();
  testSpotifyPlaybackEvent();
  testTrackRatingObservation();
  testFreshRssRanking();
  console.log("[integration-runtime] checks passed");
}

try {
  run();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
