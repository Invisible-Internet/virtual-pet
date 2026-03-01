"use strict";

const { execFile } = require("child_process");

const DEFAULT_OPENCLAW_AGENT_ID = "main";
const DEFAULT_OPENCLAW_AGENT_TIMEOUT_MS = 60000;

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

function normalizeDisplayText(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .replace(/ΓÇö/g, "-")
    .replace(/ΓÇô/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

function firstNonEmpty(values = []) {
  for (const value of values) {
    const text = normalizeDisplayText(value, null);
    if (text) return text;
  }
  return null;
}

function firstNamedEntry(value) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const named = firstNamedEntry(entry);
      if (named) return named;
    }
    return null;
  }
  if (typeof value === "string") {
    return normalizeDisplayText(value, null);
  }
  if (value && typeof value === "object") {
    return firstNonEmpty([value.name, value.artist, value.artistName, value.title]);
  }
  return null;
}

function splitTrackArtistString(value) {
  const text = normalizeDisplayText(value, null);
  if (!text) {
    return {
      trackName: null,
      artistName: null,
    };
  }

  const byMatch = text.match(/^(.*?)\s*(?:-)?\s*by\s+(.+)$/i);
  if (byMatch) {
    return {
      trackName: normalizeDisplayText(byMatch[1], text),
      artistName: normalizeDisplayText(byMatch[2], null),
    };
  }

  const dashMatch = text.match(/^(.*?)\s+-\s+(.+)$/);
  if (dashMatch) {
    return {
      trackName: normalizeDisplayText(dashMatch[1], text),
      artistName: normalizeDisplayText(dashMatch[2], null),
    };
  }

  return {
    trackName: text,
    artistName: null,
  };
}

function shellQuote(value) {
  const text = typeof value === "string" ? value : String(value ?? "");
  return `'${text.replace(/'/g, `'\"'\"'`)}'`;
}

function execFileAsync(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        const nextError = error;
        nextError.stdout = stdout;
        nextError.stderr = stderr;
        reject(nextError);
        return;
      }
      resolve({
        stdout,
        stderr,
      });
    });
  });
}

function buildSpotifyNowPlayingPrompt() {
  return [
    "Use the spotify-history or spotify-player skill as needed.",
    "Return JSON only.",
    "Shape:",
    '{"is_playing":boolean,"timestamp":number|null,"track":string|null,"artist":string|null,"album":string|null,"context":object|null}.',
    "No markdown.",
  ].join(" ");
}

function buildSpotifyTopArtistPrompt() {
  return [
    "Use the spotify-history skill as needed.",
    "Return JSON only.",
    "Shape:",
    '{"time_range":"long_term","ranked_artists":string[],"top_artist":string|null}.',
    "No markdown.",
  ].join(" ");
}

function buildFreshRssPrompt() {
  return [
    "Use the freshrss skill as needed.",
    "Return JSON only.",
    "Shape:",
    '{"summary":string,"items":[{"date":string,"source":string,"title":string,"url":string,"categories":string[]}]}',
    "Include the latest 5 FreshRSS items.",
    "No markdown.",
  ].join(" ");
}

function parseAgentEnvelope(rawText) {
  const text = toOptionalString(rawText, "") || "";
  const parsed = JSON.parse(text);
  const payloadText = parsed?.result?.payloads?.[0]?.text;
  return {
    runId: toOptionalString(parsed?.runId, null),
    status: toOptionalString(parsed?.status, "error") || "error",
    summary: toOptionalString(parsed?.summary, null),
    payloadText: typeof payloadText === "string" ? payloadText.trim() : "",
    meta: parsed?.result?.meta || null,
    raw: parsed,
  };
}

function parseJsonPayload(payloadText) {
  if (typeof payloadText !== "string" || payloadText.trim().length <= 0) {
    throw new Error("empty_payload");
  }
  const trimmed = payloadText.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return JSON.parse(fencedMatch[1].trim());
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1));
  }

  throw new Error("invalid_json_payload");
}

function detectAgentFailure(payloadText, error = null) {
  const text = toOptionalString(payloadText, "") || "";
  const normalized = text.toLowerCase();
  const stderr = toOptionalString(error?.stderr, "") || "";
  const stdout = toOptionalString(error?.stdout, "") || "";
  const combined = `${normalized}\n${stderr.toLowerCase()}\n${stdout.toLowerCase()}`;

  if (
    combined.includes("approval") ||
    combined.includes("approve") ||
    combined.includes("requires your approval") ||
    combined.includes("pending execution")
  ) {
    return {
      reason: "approval_required",
      message: text || "OpenClaw agent requested execution approval.",
    };
  }
  if (combined.includes("credentials") || combined.includes("not authenticated")) {
    return {
      reason: "credentials_unavailable",
      message: text || stderr || "OpenClaw provider credentials are unavailable.",
    };
  }
  if (
    combined.includes("not configured") ||
    combined.includes("required environment variables are missing") ||
    combined.includes("environment variables are missing")
  ) {
    return {
      reason: "provider_misconfigured",
      message: text || stderr || "Provider is not configured correctly.",
    };
  }
  if (combined.includes("timed out") || error?.killed === true || error?.signal === "SIGTERM") {
    return {
      reason: "probe_timeout",
      message: text || stderr || "OpenClaw probe timed out.",
    };
  }
  if (combined.includes("unauthorized")) {
    return {
      reason: "provider_unauthorized",
      message: text || stderr || "Provider authorization failed.",
    };
  }
  if (combined.includes("skill") && combined.includes("not found")) {
    return {
      reason: "skill_unavailable",
      message: text || stderr || "Required OpenClaw skill is unavailable.",
    };
  }
  if (combined.includes("unavailable")) {
    return {
      reason: "provider_unavailable",
      message: text || stderr || "Provider is unavailable.",
    };
  }
  if (combined.includes("wsl")) {
    return {
      reason: "wsl_unavailable",
      message: text || stderr || "WSL is unavailable from the runtime.",
    };
  }
  if (error) {
    return {
      reason: "agent_command_failed",
      message: stderr || stdout || error.message || "OpenClaw agent command failed.",
    };
  }
  return {
    reason: "invalid_agent_payload",
    message: text || "OpenClaw agent did not return valid JSON payload text.",
  };
}

function normalizeSpotifyNowPlayingPayload(value) {
  const input = value && typeof value === "object" ? value : {};
  const track = input.track;
  const artist = input.artist;
  const album = input.album;
  const derivedTrack = splitTrackArtistString(
    firstNonEmpty([
      typeof track === "string" ? track : null,
      track?.name,
      input.title,
      input.name,
    ])
  );
  const artistName =
    firstNamedEntry([
      artist,
      input.artists,
      track?.artist,
      track?.artists,
      track?.artistName,
      input.artistName,
    ]) ||
    derivedTrack.artistName ||
    "unknown_artist";
  return {
    isPlaying: Boolean(input.is_playing),
    timestamp: Number.isFinite(Number(input.timestamp)) ? Number(input.timestamp) : null,
    trackName: derivedTrack.trackName || "unknown_track",
    artistName,
    albumName:
      firstNonEmpty([typeof album === "string" ? album : null, album?.name, track?.album?.name]) ||
      "unknown_album",
    context: input.context && typeof input.context === "object" ? input.context : null,
    raw: input,
  };
}

function normalizeSpotifyTopArtistPayload(value) {
  const input = value && typeof value === "object" ? value : {};
  const rankedArtists = Array.isArray(input.ranked_artists)
    ? input.ranked_artists
        .filter((entry) => typeof entry === "string" && entry.trim().length > 0)
        .map((entry) => entry.trim())
    : [];
  return {
    timeRange: toOptionalString(input.time_range, "long_term") || "long_term",
    rankedArtists,
    topArtist: toOptionalString(input.top_artist, rankedArtists[0] || null),
    raw: input,
  };
}

function buildFreshRssSummary(items) {
  if (!Array.isArray(items) || items.length <= 0) {
    return "FreshRSS returned no recent items.";
  }
  const top = items[0];
  const source = toOptionalString(top?.source, "FreshRSS");
  const title = toOptionalString(top?.title, "latest item");
  return `FreshRSS returned ${items.length} recent items. Latest from ${source}: ${title}.`;
}

function normalizeFreshRssPayload(value) {
  const input =
    Array.isArray(value) || (value && typeof value === "object") ? value : { summary: "", items: [] };
  const rawItems = Array.isArray(input) ? input : Array.isArray(input.items) ? input.items : [];
  const items = rawItems
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      date: toOptionalString(entry.date, null),
      source: toOptionalString(entry.source, "FreshRSS"),
      title: toOptionalString(entry.title, "Untitled"),
      url: toOptionalString(entry.url, null),
      categories: Array.isArray(entry.categories)
        ? entry.categories.filter((item) => typeof item === "string" && item.trim().length > 0)
        : [],
    }));
  const summary =
    normalizeDisplayText(!Array.isArray(input) ? input.summary : "", null) || buildFreshRssSummary(items);
  const error =
    normalizeDisplayText(!Array.isArray(input) ? input.error : "", null) ||
    normalizeDisplayText(!Array.isArray(input) ? input.message : "", null);
  return {
    summary,
    items,
    error,
    raw: input,
  };
}

function detectFreshRssPayloadFailure(value) {
  const payload = value && typeof value === "object" ? value : null;
  if (!payload) return null;

  const explicitFailure = detectAgentFailure(payload.error || "", null);
  if (payload.error && explicitFailure.reason !== "invalid_agent_payload") {
    return explicitFailure;
  }

  const summaryFailure = detectAgentFailure(payload.summary || "", null);
  if (payload.summary && summaryFailure.reason !== "invalid_agent_payload") {
    return summaryFailure;
  }

  return null;
}

async function runOpenClawAgentPrompt({
  agentId = DEFAULT_OPENCLAW_AGENT_ID,
  prompt,
  timeoutMs = DEFAULT_OPENCLAW_AGENT_TIMEOUT_MS,
  logger = null,
} = {}) {
  const resolvedAgentId = toOptionalString(agentId, DEFAULT_OPENCLAW_AGENT_ID) || DEFAULT_OPENCLAW_AGENT_ID;
  const resolvedPrompt = toOptionalString(prompt, "");
  if (!resolvedPrompt) {
    throw new Error("prompt_required");
  }
  const resolvedTimeoutMs = toPositiveInteger(
    timeoutMs,
    DEFAULT_OPENCLAW_AGENT_TIMEOUT_MS,
    1000
  );
  const timeoutSeconds = Math.max(5, Math.ceil(resolvedTimeoutMs / 1000));
  const command = [
    "openclaw agent",
    `--agent ${shellQuote(resolvedAgentId)}`,
    `--message ${shellQuote(resolvedPrompt)}`,
    "--json",
    "--thinking off",
    `--timeout ${timeoutSeconds}`,
  ].join(" ");

  if (typeof logger === "function") {
    logger("agentPromptStart", {
      agentId: resolvedAgentId,
      timeoutMs: resolvedTimeoutMs,
    });
  }

  const result = await execFileAsync(
    "wsl",
    ["bash", "-lc", command],
    {
      timeout: resolvedTimeoutMs,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    }
  );
  const envelope = parseAgentEnvelope(result.stdout);
  if (typeof logger === "function") {
    logger("agentPromptComplete", {
      agentId: resolvedAgentId,
      runId: envelope.runId,
      status: envelope.status,
      summary: envelope.summary,
      durationMs: envelope.meta?.durationMs || null,
    });
  }
  return envelope;
}

module.exports = {
  DEFAULT_OPENCLAW_AGENT_ID,
  DEFAULT_OPENCLAW_AGENT_TIMEOUT_MS,
  buildSpotifyNowPlayingPrompt,
  buildSpotifyTopArtistPrompt,
  buildFreshRssPrompt,
  runOpenClawAgentPrompt,
  parseJsonPayload,
  detectAgentFailure,
  normalizeSpotifyNowPlayingPayload,
  normalizeSpotifyTopArtistPayload,
  normalizeFreshRssPayload,
  detectFreshRssPayloadFailure,
};
