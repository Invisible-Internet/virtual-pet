"use strict";

const {
  buildSpotifyNowPlayingPrompt,
  buildSpotifyTopArtistPrompt,
  buildFreshRssPrompt,
  parseJsonPayload,
  detectAgentFailure,
  normalizeSpotifyNowPlayingPayload,
  normalizeSpotifyTopArtistPayload,
  normalizeFreshRssPayload,
  detectFreshRssPayloadFailure,
} = require("../openclaw-agent-probe");

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

function testPromptBuilders() {
  assertIncludes(buildSpotifyNowPlayingPrompt(), "spotify-history", "now playing prompt should mention spotify-history");
  assertIncludes(buildSpotifyTopArtistPrompt(), "top_artist", "top artist prompt should mention top_artist");
  assertIncludes(buildFreshRssPrompt(), "latest 5 FreshRSS items", "freshrss prompt should mention latest items");
}

function testParseJsonPayload() {
  const parsed = parseJsonPayload('{"ok":true,"value":3}');
  assertEqual(parsed.ok, true, "parseJsonPayload ok mismatch");
  assertEqual(parsed.value, 3, "parseJsonPayload value mismatch");

  const fenced = parseJsonPayload("```json\n{\"ok\":true,\"value\":4}\n```");
  assertEqual(fenced.value, 4, "parseJsonPayload fenced JSON mismatch");
}

function testDetectAgentFailure() {
  const approval = detectAgentFailure(
    "Running the FreshRSS query script requires your approval before I can retrieve the headlines."
  );
  assertEqual(approval.reason, "approval_required", "approval failure reason mismatch");

  const credentials = detectAgentFailure(
    "Spotify credentials haven't been set up yet."
  );
  assertEqual(credentials.reason, "credentials_unavailable", "credentials failure reason mismatch");

  const misconfigured = detectAgentFailure(
    "FreshRSS is not configured (required environment variables are missing)."
  );
  assertEqual(misconfigured.reason, "provider_misconfigured", "misconfigured failure reason mismatch");
}

function testSpotifyNormalizers() {
  const nowPlaying = normalizeSpotifyNowPlayingPayload({
    is_playing: false,
    timestamp: 123,
    track: "Lifting",
    artist: "Silva Bumpa, Riordan",
    album: "Lifting",
    context: {
      type: "playlist",
    },
  });
  assertEqual(nowPlaying.isPlaying, false, "spotify now playing boolean mismatch");
  assertEqual(nowPlaying.trackName, "Lifting", "spotify now playing track mismatch");
  assertEqual(nowPlaying.artistName, "Silva Bumpa, Riordan", "spotify now playing artist mismatch");

  const derivedArtist = normalizeSpotifyNowPlayingPayload({
    is_playing: true,
    track: {
      name: "My Coco",
      artists: [{ name: "Stella Soleil" }],
    },
    album: {
      name: "Kiss Kiss",
    },
  });
  assertEqual(derivedArtist.trackName, "My Coco", "spotify nested track name mismatch");
  assertEqual(derivedArtist.artistName, "Stella Soleil", "spotify nested artist mismatch");

  const splitArtist = normalizeSpotifyNowPlayingPayload({
    is_playing: true,
    track: "Lifting - Silva Bumpa, Riordan",
  });
  assertEqual(splitArtist.trackName, "Lifting", "spotify split track name mismatch");
  assertEqual(splitArtist.artistName, "Silva Bumpa, Riordan", "spotify split artist mismatch");

  const topArtist = normalizeSpotifyTopArtistPayload({
    time_range: "long_term",
    ranked_artists: ["Bloodhound Gang", "Metric"],
    top_artist: "Bloodhound Gang",
  });
  assertEqual(topArtist.timeRange, "long_term", "spotify top artist time range mismatch");
  assertEqual(topArtist.rankedArtists.length, 2, "spotify top artist list length mismatch");
  assertEqual(topArtist.topArtist, "Bloodhound Gang", "spotify top artist mismatch");
}

function testFreshRssNormalizer() {
  const normalized = normalizeFreshRssPayload({
    summary: "FreshRSS returned 2 recent items.",
    items: [
      {
        date: "2026-01-25T18:20:16Z",
        source: "FreshRSS releases",
        title: "FreshRSS 1.28.1",
        url: "https://github.com/FreshRSS/FreshRSS/releases/tag/1.28.1",
        categories: ["Uncategorized"],
      },
      {
        date: "2025-12-24T19:27:23Z",
        source: "FreshRSS releases",
        title: "FreshRSS 1.28.0",
        url: "https://github.com/FreshRSS/FreshRSS/releases/tag/1.28.0",
        categories: ["Uncategorized"],
      },
    ],
  });
  assertEqual(normalized.items.length, 2, "freshrss items length mismatch");
  assertEqual(normalized.summary, "FreshRSS returned 2 recent items.", "freshrss summary mismatch");

  const failed = normalizeFreshRssPayload({
    summary: "FreshRSS is not configured (required environment variables are missing).",
    items: [],
  });
  const failure = detectFreshRssPayloadFailure(failed);
  assertEqual(failure.reason, "provider_misconfigured", "freshrss structured failure mismatch");
}

function run() {
  testPromptBuilders();
  testParseJsonPayload();
  testDetectAgentFailure();
  testSpotifyNormalizers();
  testFreshRssNormalizer();
  console.log("[openclaw-agent-probe] checks passed");
}

try {
  run();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
