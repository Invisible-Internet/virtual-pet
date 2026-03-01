"use strict";

const INTEGRATION_TRANSPORTS = Object.freeze({
  stub: "stub",
});

const MUSIC_MODE_STATES = Object.freeze({
  chill: "MusicChill",
});

const FRESHRSS_STREAMS = Object.freeze({
  curated: "Mic/Curated",
  demographic: "Primea/Demographic",
  discovery: "Discovery/Trending",
});

const FRESHRSS_SCORE_WEIGHTS = Object.freeze({
  personalFavorites: 3,
  demographicCategory: 2,
  discovery: 1,
  identityTagMatch: 2,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
      return true;
    }
    if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
      return false;
    }
  }
  return fallback;
}

function toOptionalString(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function toPositiveInteger(value, fallback, min = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.round(numeric));
}

function normalizeTagList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const tags = [];
  for (const entry of value) {
    const tag = toOptionalString(entry, "");
    if (!tag) continue;
    const normalized = tag.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    tags.push(normalized);
  }
  return tags;
}

function buildDefaultIntegrationSettings() {
  return {
    spotify: {
      enabled: true,
      available: true,
      transport: INTEGRATION_TRANSPORTS.stub,
      defaultTrackTitle: "Night Drive",
      defaultArtist: "Primea FM",
      defaultAlbum: "Sample Rotation",
    },
    freshRss: {
      enabled: true,
      available: false,
      transport: INTEGRATION_TRANSPORTS.stub,
      pollCadenceMinutes: 30,
      dailyTopItems: 3,
    },
  };
}

function normalizeSpotifySettings(rawSpotify = {}) {
  const defaults = buildDefaultIntegrationSettings().spotify;
  return {
    enabled: toBoolean(rawSpotify.enabled, defaults.enabled),
    available: toBoolean(rawSpotify.available, defaults.available),
    transport: INTEGRATION_TRANSPORTS.stub,
    defaultTrackTitle: toOptionalString(rawSpotify.defaultTrackTitle, defaults.defaultTrackTitle),
    defaultArtist: toOptionalString(rawSpotify.defaultArtist, defaults.defaultArtist),
    defaultAlbum: toOptionalString(rawSpotify.defaultAlbum, defaults.defaultAlbum),
  };
}

function normalizeFreshRssSettings(rawFreshRss = {}) {
  const defaults = buildDefaultIntegrationSettings().freshRss;
  return {
    enabled: toBoolean(rawFreshRss.enabled, defaults.enabled),
    available: toBoolean(rawFreshRss.available, defaults.available),
    transport: INTEGRATION_TRANSPORTS.stub,
    pollCadenceMinutes: toPositiveInteger(rawFreshRss.pollCadenceMinutes, defaults.pollCadenceMinutes, 5),
    dailyTopItems: clamp(toPositiveInteger(rawFreshRss.dailyTopItems, defaults.dailyTopItems, 1), 1, 3),
  };
}

function normalizeIntegrationSettings(rawIntegrations = {}) {
  const raw = rawIntegrations && typeof rawIntegrations === "object" ? rawIntegrations : {};
  return {
    spotify: normalizeSpotifySettings(raw.spotify),
    freshRss: normalizeFreshRssSettings(raw.freshRss),
  };
}

function deriveIntegrationCapabilityState(integrationId, integrationSettings = {}, status = {}) {
  const settings = integrationSettings && typeof integrationSettings === "object" ? integrationSettings : {};
  const openclawEnabled = Boolean(status.openclawEnabled);
  const probeState = status.probeState && typeof status.probeState === "object" ? status.probeState : null;

  if (!settings.enabled) {
    return {
      state: "disabled",
      reason: "disabledByConfig",
      details: {
        integrationId,
        transport: settings.transport || INTEGRATION_TRANSPORTS.stub,
      },
    };
  }

  if (!settings.available) {
    return {
      state: "degraded",
      reason: "providerUnavailable",
      details: {
        integrationId,
        transport: settings.transport || INTEGRATION_TRANSPORTS.stub,
        fallbackMode: `${integrationId}_provider_unavailable`,
      },
    };
  }

  if (!openclawEnabled) {
    return {
      state: "degraded",
      reason: "openclawDisabledFallback",
      details: {
        integrationId,
        transport: settings.transport || INTEGRATION_TRANSPORTS.stub,
        fallbackMode: "openclaw_disabled",
      },
    };
  }

  if (!probeState || probeState.state === "pending") {
    return {
      state: "degraded",
      reason: "probePending",
      details: {
        integrationId,
        transport: settings.transport || INTEGRATION_TRANSPORTS.stub,
        fallbackMode: "probe_pending",
      },
    };
  }

  if (probeState.state !== "healthy") {
    return {
      state: "degraded",
      reason: probeState.reason || "probeFailed",
      details: {
        integrationId,
        transport: settings.transport || INTEGRATION_TRANSPORTS.stub,
        fallbackMode: probeState.fallbackMode || probeState.reason || "probe_failed",
        lastProbeAt: probeState.lastProbeAt || null,
        lastFailureAt: probeState.lastFailureAt || null,
      },
    };
  }

  return {
    state: "healthy",
    reason: "probeHealthy",
    details: {
      integrationId,
      transport: settings.transport || INTEGRATION_TRANSPORTS.stub,
      fallbackMode: "none",
      lastProbeAt: probeState.lastProbeAt || null,
      lastSuccessAt: probeState.lastSuccessAt || null,
    },
  };
}

function createSpotifyPlaybackEvent(spotifySettings = {}, input = {}, status = {}) {
  const settings = normalizeSpotifySettings(spotifySettings);
  const capability = deriveIntegrationCapabilityState("spotify", settings, status);
  const fallbackMode = capability.details?.fallbackMode || "none";
  const source = capability.state === "healthy" ? "online" : "offline";
  const trackTitle = toOptionalString(input.trackTitle, settings.defaultTrackTitle);
  const artist = toOptionalString(input.artist, settings.defaultArtist);
  const album = toOptionalString(input.album, settings.defaultAlbum);
  const suggestedState = MUSIC_MODE_STATES.chill;
  const entryDialogue =
    fallbackMode === "none"
      ? `Now playing ${trackTitle} by ${artist}.`
      : `Spotify unavailable, using local ${suggestedState} fallback.`;
  const responseText =
    fallbackMode === "none"
      ? `Spotify playback detected: ${trackTitle} by ${artist}. Suggesting ${suggestedState} with headphones.`
      : `Spotify unavailable. Local ${suggestedState} fallback for ${trackTitle} by ${artist}.`;

  return {
    source,
    fallbackMode,
    suggestedState,
    responseText,
    capability,
    eventPayload: {
      playing: true,
      confidence: 0.98,
      provider: "spotify",
      source: "spotify",
      title: trackTitle,
      artist,
      album,
      suggestedState,
      activeProp: "headphones",
      entryDialogue,
      fallbackMode,
    },
  };
}

function normalizeTrackRatingInput(input = {}) {
  const rating = Number.isFinite(Number(input.rating))
    ? clamp(Math.round(Number(input.rating)), 1, 10)
    : 8;
  const trackTitle = toOptionalString(input.trackTitle, "unknown_track");
  const artist = toOptionalString(input.artist, "unknown_artist");
  const album = toOptionalString(input.album, "unknown_album");
  const provider = toOptionalString(input.provider, "spotify");
  return {
    provider,
    rating,
    trackTitle,
    artist,
    album,
  };
}

function createTrackRatingObservation(input = {}, correlationId = "n/a") {
  const normalized = normalizeTrackRatingInput(input);
  const evidenceTag = `${normalized.provider}:${normalized.trackTitle}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "track-rating";

  return {
    observationType: "track_rating",
    source: `${normalized.provider}_track_rating`,
    correlationId,
    evidenceTag,
    payload: normalized,
  };
}

function scoreFreshRssCandidate(item = {}, profile = {}) {
  const stream = toOptionalString(item.stream, FRESHRSS_STREAMS.discovery);
  const title = toOptionalString(item.title, "Untitled");
  const identityTags = normalizeTagList(profile.identityTags);
  const itemTags = normalizeTagList(item.tags);
  const reasons = [];
  let score = 0;

  if (stream === FRESHRSS_STREAMS.curated) {
    score += FRESHRSS_SCORE_WEIGHTS.personalFavorites;
    reasons.push({
      kind: "stream",
      delta: FRESHRSS_SCORE_WEIGHTS.personalFavorites,
      rule: "personal_favorites",
      value: stream,
    });
  } else if (stream === FRESHRSS_STREAMS.demographic) {
    score += FRESHRSS_SCORE_WEIGHTS.demographicCategory;
    reasons.push({
      kind: "stream",
      delta: FRESHRSS_SCORE_WEIGHTS.demographicCategory,
      rule: "demographic_category",
      value: stream,
    });
  } else {
    score += FRESHRSS_SCORE_WEIGHTS.discovery;
    reasons.push({
      kind: "stream",
      delta: FRESHRSS_SCORE_WEIGHTS.discovery,
      rule: "discovery",
      value: stream,
    });
  }

  const matchedTags = itemTags.filter((tag) => identityTags.includes(tag));
  if (matchedTags.length > 0) {
    score += FRESHRSS_SCORE_WEIGHTS.identityTagMatch;
    reasons.push({
      kind: "tag_match",
      delta: FRESHRSS_SCORE_WEIGHTS.identityTagMatch,
      rule: "identity_tag_match",
      tags: matchedTags,
    });
  }

  const reinforcement = Number.isFinite(Number(item.positiveReinforcement))
    ? Math.max(0, Math.round(Number(item.positiveReinforcement)))
    : 0;
  if (reinforcement > 0) {
    score += reinforcement;
    reasons.push({
      kind: "reinforcement",
      delta: reinforcement,
      rule: "user_positive_reinforcement",
    });
  }

  return {
    title,
    stream,
    tags: itemTags,
    score,
    reasons,
  };
}

function rankFreshRssCandidates(items = [], profile = {}, limit = 3) {
  const cappedLimit = clamp(toPositiveInteger(limit, 3, 1), 1, 3);
  return items
    .map((item) => scoreFreshRssCandidate(item, profile))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.title.localeCompare(right.title);
    })
    .slice(0, cappedLimit);
}

module.exports = {
  INTEGRATION_TRANSPORTS,
  MUSIC_MODE_STATES,
  FRESHRSS_STREAMS,
  FRESHRSS_SCORE_WEIGHTS,
  buildDefaultIntegrationSettings,
  normalizeIntegrationSettings,
  deriveIntegrationCapabilityState,
  createSpotifyPlaybackEvent,
  normalizeTrackRatingInput,
  createTrackRatingObservation,
  scoreFreshRssCandidate,
  rankFreshRssCandidates,
};
