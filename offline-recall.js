"use strict";

const fs = require("fs");
const path = require("path");
const { MANAGED_BLOCK_START, MANAGED_BLOCK_END } = require("./setup-bootstrap");

const OFFLINE_RECALL_TYPES = Object.freeze({
  identityName: "identity_name",
  identityNickname: "identity_nickname",
  identityBirthday: "identity_birthday",
  recentHighlights: "recent_highlights",
});

const ELIGIBLE_RECENT_OBSERVATION_TYPES = Object.freeze(
  new Set([
    "question_response",
    "hobby_summary",
    "spotify_playback",
    "media_playback",
    "track_rating",
  ])
);

const MAX_RESPONSE_TEXT = 240;
const MAX_RECENT_HIGHLIGHTS = 3;
const MAX_EVIDENCE_TAGS = 6;
const MAX_RUNTIME_OBSERVATIONS = 40;

function toOptionalString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function toNormalizedPrompt(value) {
  return toOptionalString(value, "")
    .toLowerCase()
    .replace(/[?!.,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, maxLength = MAX_RESPONSE_TEXT) {
  const normalized = toOptionalString(value, "");
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...`;
}

function sanitizeFactValue(value) {
  const normalized = toOptionalString(value, "");
  if (!normalized) return "";
  if (/^\{\{.+\}\}$/.test(normalized)) return "";
  return normalized;
}

function detectOfflineRecallIntent(promptText) {
  const normalized = toNormalizedPrompt(promptText);
  if (!normalized) return null;
  if (/\b(what('?s| is) your name|who are you|your name)\b/.test(normalized)) {
    return OFFLINE_RECALL_TYPES.identityName;
  }
  if (
    /\b(do you have a nickname|nickname|nicknames|what can i call you|what should i call you)\b/.test(
      normalized
    )
  ) {
    return OFFLINE_RECALL_TYPES.identityNickname;
  }
  if (/\b(when('?s| is) your birthday|your birthday|when were you born)\b/.test(normalized)) {
    return OFFLINE_RECALL_TYPES.identityBirthday;
  }
  if (
    /\b(what happened recently|what happened between us|recent highlights|recently between us|what have we done recently)\b/.test(
      normalized
    )
  ) {
    return OFFLINE_RECALL_TYPES.recentHighlights;
  }
  return null;
}

function readTextIfReadable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function extractManagedBlock(content) {
  if (typeof content !== "string" || !content) return "";
  const startIndex = content.indexOf(MANAGED_BLOCK_START);
  const endIndex = content.indexOf(MANAGED_BLOCK_END);
  if (startIndex >= 0 && endIndex > startIndex) {
    const offset = startIndex + MANAGED_BLOCK_START.length;
    return content.slice(offset, endIndex).trim();
  }
  return content.trim();
}

function parseMarkdownKeyValueLines(content) {
  const map = new Map();
  for (const line of String(content || "").split(/\r?\n/)) {
    const match = line.match(/^\s*-\s*([^:]+):\s*(.*)$/);
    if (!match) continue;
    const key = toOptionalString(match[1], "").toLowerCase();
    if (!key) continue;
    map.set(key, toOptionalString(match[2], ""));
  }
  return map;
}

function parseListLikeText(value) {
  const normalized = sanitizeFactValue(value);
  if (!normalized) return [];
  const parts = normalized
    .replace(/\band\b/gi, ",")
    .split(/[,;/|]/)
    .map((entry) =>
      sanitizeFactValue(
        entry
          .replace(/`/g, "")
          .replace(/^\s*[-*]\s*/, "")
          .replace(/\s*\([^)]*\)\s*$/g, "")
          .replace(/[.]+$/g, "")
          .trim()
      )
    )
    .filter(Boolean);
  if (parts.length > 0) return parts;
  return [normalized];
}

function dedupeFactValues(values, { exclude = [] } = {}) {
  const excluded = new Set(
    (Array.isArray(exclude) ? exclude : [])
      .map((entry) => toOptionalString(entry, "").toLowerCase())
      .filter(Boolean)
  );
  const deduped = [];
  const seen = new Set();
  for (const entry of Array.isArray(values) ? values : []) {
    const normalized = sanitizeFactValue(entry);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (excluded.has(key) || seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
  }
  return deduped;
}

function extractBoldBulletSection(content, label) {
  const lines = String(content || "").split(/\r?\n/);
  if (lines.length <= 0) return "";
  const startPattern = new RegExp(`^\\s*-\\s*\\*\\*${label}\\s*:\\*\\*\\s*(.*)$`, "i");
  const nextSectionPattern = /^\s*-\s*\*\*[^*]+:\*\*\s*(.*)$/i;
  let collecting = false;
  const collected = [];

  for (const line of lines) {
    if (!collecting) {
      const startMatch = line.match(startPattern);
      if (!startMatch) continue;
      collecting = true;
      const firstValue = toOptionalString(startMatch[1], "");
      if (firstValue) collected.push(firstValue);
      continue;
    }
    if (nextSectionPattern.test(line)) break;
    if (/^\s*---\s*$/.test(line)) break;
    if (/^\s*<!--\s*virtual-pet:setup-bootstrap:start/.test(line)) break;
    collected.push(line);
  }

  return collected
    .map((line) => toOptionalString(line, ""))
    .filter(Boolean)
    .join("\n");
}

function extractNameAndNicknamesFromIdentityText(content) {
  const nameSection = extractBoldBulletSection(content, "Name");
  if (!nameSection) {
    return {
      name: "",
      nicknames: [],
    };
  }

  const candidates = [];
  const nicknameCandidates = [];
  for (const rawLine of nameSection.split(/\r?\n/)) {
    const line = toOptionalString(rawLine, "");
    if (!line) continue;
    const parts = parseListLikeText(line);
    for (const part of parts) {
      candidates.push(part);
      if (/nickname/i.test(rawLine)) {
        nicknameCandidates.push(part);
      }
    }
  }

  const name = candidates.length > 0 ? candidates[0] : "";
  const nicknames = dedupeFactValues(
    nicknameCandidates.length > 0 ? nicknameCandidates : candidates.slice(1),
    { exclude: [name] }
  );
  return {
    name,
    nicknames,
  };
}

function extractBirthdayFromIdentityText(content) {
  const birthdaySection = extractBoldBulletSection(content, "Birthday");
  if (!birthdaySection) return "";
  const firstLine = birthdaySection.split(/\r?\n/).find((line) => toOptionalString(line, "").length > 0) || "";
  return sanitizeFactValue(firstLine);
}

function readCanonicalIdentityFacts(workspaceRoot) {
  const root = toOptionalString(workspaceRoot, "");
  if (!root) {
    return {
      name: "",
      nicknames: [],
      birthday: "",
      evidenceRefs: [],
    };
  }

  const identityPath = path.join(root, "IDENTITY.md");
  const memoryPath = path.join(root, "MEMORY.md");
  const identityRaw = readTextIfReadable(identityPath);
  const identityBody = extractManagedBlock(identityRaw);
  const memoryBody = extractManagedBlock(readTextIfReadable(memoryPath));
  const identityMap = parseMarkdownKeyValueLines(identityBody);
  const identityFullMap = parseMarkdownKeyValueLines(identityRaw);

  const extractedNameBlock = extractNameAndNicknamesFromIdentityText(identityRaw);
  let name =
    sanitizeFactValue(identityMap.get("name")) ||
    sanitizeFactValue(identityFullMap.get("name")) ||
    sanitizeFactValue(extractedNameBlock.name);
  let birthday =
    sanitizeFactValue(identityMap.get("birthday")) ||
    sanitizeFactValue(identityFullMap.get("birthday")) ||
    extractBirthdayFromIdentityText(identityRaw);
  const nicknameCandidates = [];

  if (extractedNameBlock.nicknames.length > 0) {
    nicknameCandidates.push(...extractedNameBlock.nicknames);
  }
  for (const [key, rawValue] of [...identityMap.entries(), ...identityFullMap.entries()]) {
    if (!String(key || "").toLowerCase().includes("nickname")) continue;
    nicknameCandidates.push(...parseListLikeText(rawValue));
  }

  const evidenceRefs = [];

  if (name) {
    evidenceRefs.push({
      kind: "canonical_file",
      fileId: "IDENTITY.md",
      field: "Name",
    });
  }
  if (birthday) {
    evidenceRefs.push({
      kind: "canonical_file",
      fileId: "IDENTITY.md",
      field: "Birthday",
    });
  }
  const nicknames = dedupeFactValues(nicknameCandidates, { exclude: [name] });
  if (nicknames.length > 0) {
    evidenceRefs.push({
      kind: "canonical_file",
      fileId: "IDENTITY.md",
      field: "Nicknames",
    });
  }

  if (!name && memoryBody) {
    const memoryNameMatch = memoryBody.match(/^\s*-\s*My name is\s*`([^`]+)`\./im);
    name = sanitizeFactValue(memoryNameMatch?.[1] || "");
    if (name) {
      evidenceRefs.push({
        kind: "canonical_file",
        fileId: "MEMORY.md",
        field: "Durable Facts:name",
      });
    }
  }

  if (!birthday && memoryBody) {
    const memoryBirthdayMatch = memoryBody.match(/^\s*-\s*My birthday is\s*`([^`]+)`\./im);
    birthday = sanitizeFactValue(memoryBirthdayMatch?.[1] || "");
    if (birthday) {
      evidenceRefs.push({
        kind: "canonical_file",
        fileId: "MEMORY.md",
        field: "Durable Facts:birthday",
      });
    }
  }

  if (nicknames.length <= 0 && memoryBody) {
    const nicknameMatches = [
      memoryBody.match(/^\s*-\s*My nickname is\s*`([^`]+)`\./im),
      memoryBody.match(/^\s*-\s*My nicknames are\s*`([^`]+)`\./im),
      memoryBody.match(/^\s*-\s*I also go by\s*`([^`]+)`\./im),
    ];
    for (const match of nicknameMatches) {
      const raw = sanitizeFactValue(match?.[1] || "");
      if (!raw) continue;
      const parsed = dedupeFactValues(parseListLikeText(raw), { exclude: [name] });
      if (parsed.length <= 0) continue;
      nicknames.push(...parsed);
      evidenceRefs.push({
        kind: "canonical_file",
        fileId: "MEMORY.md",
        field: "Durable Facts:nicknames",
      });
      break;
    }
  }

  return {
    name,
    nicknames: dedupeFactValues(nicknames, { exclude: [name] }),
    birthday,
    evidenceRefs,
  };
}

function toSafeEvidenceTag(value) {
  const normalized = toOptionalString(value, "none");
  return normalized || "none";
}

function toObservationTimestampMs(entry) {
  if (Number.isFinite(Number(entry?.tsMs))) {
    return Math.max(0, Math.round(Number(entry.tsMs)));
  }
  if (typeof entry?.ts === "string") {
    const parsed = Date.parse(entry.ts);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return 0;
}

function normalizeObservationEntry(entry, index) {
  if (!entry || typeof entry !== "object") return null;
  const observationType = toOptionalString(entry.observationType, "unknown");
  const evidenceTag = toSafeEvidenceTag(entry.evidenceTag);
  const tsMs = toObservationTimestampMs(entry);
  const payload = entry.payload && typeof entry.payload === "object" ? entry.payload : {};
  return {
    observationId:
      toOptionalString(entry.observationId, "") || `obs-fallback-${tsMs}-${Math.max(0, index)}`,
    ts: toOptionalString(entry.ts, ""),
    tsMs,
    observationType,
    source: toOptionalString(entry.source, "unknown"),
    evidenceTag,
    payload,
  };
}

function parseObservationLogLine(line, index) {
  if (typeof line !== "string" || !line.trim().startsWith("- ")) return null;
  const match = line.match(
    /^-\s*([^|]+)\s+\|\s*type=([^|]+)\s+\|\s*source=([^|]+)\s+\|\s*evidence=([^|]+)\s+\|\s*correlationId=([^|]+)\s+\|\s*payload=(.+)$/
  );
  if (!match) return null;
  let payload = {};
  try {
    payload = JSON.parse(match[6]);
  } catch {
    payload = {};
  }
  return normalizeObservationEntry(
    {
      observationId: `obs-log-${Math.max(0, index)}`,
      ts: toOptionalString(match[1], ""),
      observationType: toOptionalString(match[2], "unknown"),
      source: toOptionalString(match[3], "unknown"),
      evidenceTag: toSafeEvidenceTag(match[4]),
      payload,
    },
    index
  );
}

function readRecentObservationsFromMarkdown(memoryDir, limit = MAX_RUNTIME_OBSERVATIONS) {
  const root = toOptionalString(memoryDir, "");
  if (!root) return [];
  let fileNames = [];
  try {
    fileNames = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry?.isFile?.() && entry.name.toLowerCase().endsWith(".md"))
      .map((entry) => entry.name)
      .sort()
      .reverse();
  } catch {
    return [];
  }
  if (fileNames.length <= 0) return [];

  const maxEntries = Number.isFinite(Number(limit))
    ? Math.max(1, Math.min(MAX_RUNTIME_OBSERVATIONS, Math.round(Number(limit))))
    : MAX_RUNTIME_OBSERVATIONS;
  const observations = [];
  let runningIndex = 0;
  for (const fileName of fileNames) {
    if (observations.length >= maxEntries) break;
    const lines = readTextIfReadable(path.join(root, fileName)).split(/\r?\n/).reverse();
    for (const line of lines) {
      const parsed = parseObservationLogLine(line, runningIndex);
      runningIndex += 1;
      if (!parsed) continue;
      observations.push(parsed);
      if (observations.length >= maxEntries) break;
    }
  }
  return observations;
}

function buildRecentHighlightSummary(entry) {
  const payload = entry.payload && typeof entry.payload === "object" ? entry.payload : {};
  if (entry.observationType === "question_response") {
    const question = toOptionalString(payload.text, "") || toOptionalString(payload.command, "");
    const response = toOptionalString(payload.responseText, "");
    if (question && response) {
      return truncateText(`Q: ${question} -> ${response}`, 120);
    }
    return truncateText(`Q: ${question || entry.evidenceTag}`, 120);
  }

  if (entry.observationType === "hobby_summary") {
    const extensionId = toOptionalString(payload.extensionId, "");
    const propId = toOptionalString(payload.propId, "");
    if (extensionId && propId) {
      return truncateText(`Interacted with ${propId} from ${extensionId}`, 120);
    }
    return truncateText(`Hobby update: ${entry.evidenceTag}`, 120);
  }

  if (entry.observationType === "spotify_playback" || entry.observationType === "media_playback") {
    const title = toOptionalString(payload.title, "unknown_track");
    const artist = toOptionalString(payload.artist, "unknown_artist");
    return truncateText(`Listened to ${title} by ${artist}`, 120);
  }

  if (entry.observationType === "track_rating") {
    const trackTitle = toOptionalString(payload.trackTitle, "unknown_track");
    const rating = Number.isFinite(Number(payload.rating)) ? Math.round(Number(payload.rating)) : 0;
    return truncateText(`Rated ${trackTitle} as ${rating}/10`, 120);
  }

  return truncateText(`${entry.observationType}: ${entry.evidenceTag}`, 120);
}

function buildRecentHighlights({ runtimeObservations = [], memoryDir = "" } = {}) {
  const runtime = Array.isArray(runtimeObservations)
    ? runtimeObservations
        .slice(0, MAX_RUNTIME_OBSERVATIONS)
        .map((entry, index) => normalizeObservationEntry(entry, index))
        .filter(Boolean)
    : [];
  const sourceObservations =
    runtime.length > 0
      ? runtime
      : readRecentObservationsFromMarkdown(memoryDir, MAX_RUNTIME_OBSERVATIONS);

  const sorted = sourceObservations
    .filter(
      (entry) =>
        ELIGIBLE_RECENT_OBSERVATION_TYPES.has(entry.observationType) &&
        entry.evidenceTag &&
        entry.evidenceTag !== "none"
    )
    .sort((left, right) => right.tsMs - left.tsMs);

  const deduped = [];
  const seenEvidence = new Set();
  for (const entry of sorted) {
    const key = entry.evidenceTag.toLowerCase();
    if (seenEvidence.has(key)) continue;
    seenEvidence.add(key);
    deduped.push(entry);
    if (deduped.length >= MAX_RECENT_HIGHLIGHTS) break;
  }

  return deduped.map((entry) => ({
    observationId: entry.observationId,
    observationType: entry.observationType,
    evidenceTag: entry.evidenceTag,
    summary: buildRecentHighlightSummary(entry),
    ts: entry.ts || null,
    tsMs: entry.tsMs,
  }));
}

function buildRecentHighlightsText(highlights) {
  if (!Array.isArray(highlights) || highlights.length <= 0) {
    return "I do not have recent highlights yet.";
  }
  const segments = highlights.map((entry, index) => `${index + 1}) ${entry.summary}`);
  return truncateText(`Recent highlights: ${segments.join(" | ")}`);
}

function normalizeEvidenceTags(tags) {
  if (!Array.isArray(tags)) return [];
  const deduped = [];
  const seen = new Set();
  for (const tag of tags) {
    const normalized = toSafeEvidenceTag(tag);
    if (!normalized || normalized === "none") continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
    if (deduped.length >= MAX_EVIDENCE_TAGS) break;
  }
  return deduped;
}

function buildOfflineRecallResult({
  promptText = "",
  workspaceRoot = "",
  runtimeObservations = [],
  memoryDir = "",
  memoryAvailable = true,
  ts = Date.now(),
} = {}) {
  const recallType = detectOfflineRecallIntent(promptText);
  if (!recallType) return null;

  const timestamp = Number.isFinite(Number(ts)) ? Math.max(0, Math.round(Number(ts))) : Date.now();
  if (
    recallType === OFFLINE_RECALL_TYPES.identityName ||
    recallType === OFFLINE_RECALL_TYPES.identityNickname ||
    recallType === OFFLINE_RECALL_TYPES.identityBirthday
  ) {
    const identity = readCanonicalIdentityFacts(workspaceRoot);
    const isName = recallType === OFFLINE_RECALL_TYPES.identityName;
    const isNickname = recallType === OFFLINE_RECALL_TYPES.identityNickname;
    const fact = isName
      ? identity.name
      : isNickname
        ? Array.isArray(identity.nicknames) && identity.nicknames.length > 0
          ? identity.nicknames.join(", ")
          : ""
        : identity.birthday;
    const degradedReason = fact ? "none" : "identity_unavailable";
    const text = fact
      ? isName
        ? truncateText(`My name is ${identity.name}.`)
        : isNickname
          ? (() => {
              const nicknameList = Array.isArray(identity.nicknames)
                ? identity.nicknames.slice(0, 3)
                : [];
              if (nicknameList.length <= 0) {
                return "I cannot read my nickname from local identity files right now.";
              }
              if (nicknameList.length === 1) {
                return truncateText(`You can call me ${nicknameList[0]}.`);
              }
              if (nicknameList.length === 2) {
                return truncateText(`You can call me ${nicknameList[0]} or ${nicknameList[1]}.`);
              }
              return truncateText(
                `You can call me ${nicknameList[0]}, ${nicknameList[1]}, or ${nicknameList[2]}.`
              );
            })()
          : truncateText(`My birthday is ${identity.birthday}.`)
      : isName
        ? "I cannot read my name from local identity files right now."
        : isNickname
          ? "I cannot read my nickname from local identity files right now."
          : "I cannot read my birthday from local identity files right now.";
    const evidenceTag = isName
      ? "identity.name"
      : isNickname
        ? "identity.nickname"
        : "identity.birthday";
    const evidenceRefs = identity.evidenceRefs.filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        ((isName && entry.field && String(entry.field).toLowerCase().includes("name")) ||
          (isNickname && entry.field && String(entry.field).toLowerCase().includes("nickname")) ||
          (!isName &&
            !isNickname &&
            entry.field &&
            String(entry.field).toLowerCase().includes("birthday")))
    );
    return {
      kind: "offlineRecallResult",
      ts: timestamp,
      recallType,
      source: "offline",
      text,
      degradedReason,
      evidenceTags: normalizeEvidenceTags([evidenceTag]),
      evidenceRefs,
      highlights: [],
      fallbackMode:
        degradedReason === "none" ? "offline_identity_recall" : "offline_identity_recall_degraded",
    };
  }

  const highlights = buildRecentHighlights({
    runtimeObservations,
    memoryDir,
  });
  const degradedReason = !memoryAvailable
    ? "memory_unavailable"
    : highlights.length > 0
      ? "none"
      : "no_recent_highlights";
  const text =
    degradedReason === "memory_unavailable"
      ? "I cannot read recent highlights because memory runtime is unavailable right now."
      : buildRecentHighlightsText(highlights);

  return {
    kind: "offlineRecallResult",
    ts: timestamp,
    recallType,
    source: "offline",
    text,
    degradedReason,
    evidenceTags: normalizeEvidenceTags(highlights.map((entry) => entry.evidenceTag)),
    evidenceRefs: highlights.map((entry) => ({
      kind: "memory_observation",
      observationId: entry.observationId,
      observationType: entry.observationType,
      evidenceTag: entry.evidenceTag,
    })),
    highlights,
    fallbackMode:
      degradedReason === "none" ? "offline_recent_recall" : "offline_recent_recall_degraded",
  };
}

module.exports = {
  OFFLINE_RECALL_TYPES,
  buildOfflineRecallResult,
  buildRecentHighlights,
  detectOfflineRecallIntent,
};
