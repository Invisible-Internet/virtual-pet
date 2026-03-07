"use strict";

const fs = require("fs");
const path = require("path");
const { buildRecentHighlights } = require("./offline-recall");
const { MANAGED_BLOCK_START, MANAGED_BLOCK_END } = require("./setup-bootstrap");

const PERSONA_SNAPSHOT_SCHEMA_VERSION = "vp-persona-snapshot-v1";
const PERSONA_EXPORT_SCHEMA_VERSION = "vp-persona-export-v1";
const PERSONA_SNAPSHOT_STATES = Object.freeze({
  ready: "ready",
  degraded: "degraded",
});
const PERSONA_DEGRADED_REASONS = Object.freeze({
  none: "none",
  canonicalMissing: "canonical_missing",
  canonicalUnreadable: "canonical_unreadable",
  parseIncomplete: "parse_incomplete",
  memoryUnavailable: "memory_unavailable",
});
const REQUIRED_CANONICAL_FILES = Object.freeze(["SOUL.md", "STYLE.md", "IDENTITY.md", "USER.md"]);
const OPTIONAL_CANONICAL_FILES = Object.freeze(["MEMORY.md"]);
const MAX_FIELD_LIST_VALUES = 8;
const MAX_FACTS = 12;
const MAX_STYLE_HINTS = 6;
const MAX_HIGHLIGHTS = 3;
const MAX_SUMMARY_LENGTH = 220;
const MAX_EXPORT_BYTES = 4096;

function toOptionalString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function sanitizeValue(value) {
  const normalized = toOptionalString(value, "");
  if (!normalized) return "";
  if (/^\{\{.+\}\}$/.test(normalized)) return "";
  return normalized;
}

function normalizeTimestamp(ts) {
  if (Number.isFinite(Number(ts))) {
    return Math.max(0, Math.round(Number(ts)));
  }
  return Date.now();
}

function truncateText(value, maxLength = MAX_SUMMARY_LENGTH) {
  const normalized = toOptionalString(value, "");
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...`;
}

function parseListValue(value) {
  const normalized = sanitizeValue(value);
  if (!normalized) return [];
  return normalized
    .replace(/\band\b/gi, ",")
    .split(/[,;/|]/)
    .map((entry) => sanitizeValue(entry))
    .filter(Boolean);
}

function dedupeStrings(values, maxLength = MAX_FIELD_LIST_VALUES) {
  const deduped = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = sanitizeValue(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
    if (deduped.length >= maxLength) break;
  }
  return deduped;
}

function inspectFile(root, fileId) {
  const normalizedRoot = toOptionalString(root, "");
  if (!normalizedRoot) {
    return {
      fileId,
      path: null,
      present: false,
      readable: false,
      text: "",
      status: "missing_root",
    };
  }

  const targetPath = path.join(normalizedRoot, fileId);
  if (!fs.existsSync(targetPath)) {
    return {
      fileId,
      path: targetPath,
      present: false,
      readable: false,
      text: "",
      status: "file_missing",
    };
  }

  try {
    fs.accessSync(targetPath, fs.constants.R_OK);
    return {
      fileId,
      path: targetPath,
      present: true,
      readable: true,
      text: fs.readFileSync(targetPath, "utf8"),
      status: "ready",
    };
  } catch {
    return {
      fileId,
      path: targetPath,
      present: true,
      readable: false,
      text: "",
      status: "file_unreadable",
    };
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

function extractBulletSection(content, headingPattern) {
  const normalizedContent = String(content || "");
  if (!normalizedContent) return [];
  const lines = normalizedContent.split(/\r?\n/);
  const bullets = [];
  let collecting = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!collecting) {
      if (headingPattern.test(trimmed)) {
        collecting = true;
      }
      continue;
    }
    if (!trimmed) {
      if (bullets.length > 0) break;
      continue;
    }
    if (/^(##|###)\s+/.test(trimmed)) break;
    if (/^\*\*[^*]+:\*\*$/.test(trimmed) && !headingPattern.test(trimmed)) {
      if (bullets.length > 0) break;
      collecting = false;
      continue;
    }
    if (!/^-/.test(trimmed)) {
      if (bullets.length > 0) break;
      continue;
    }
    bullets.push(trimmed.replace(/^-+\s*/, ""));
  }

  return bullets;
}

function buildProvenanceTag(provenance) {
  if (!provenance || typeof provenance !== "object") return "unknown";
  if (provenance.fileId && provenance.field) {
    return `${provenance.fileId}:${provenance.field}`;
  }
  if (provenance.fileId && provenance.section) {
    return `${provenance.fileId}:${provenance.section}`;
  }
  if (provenance.observationId) {
    return `obs:${provenance.observationId}`;
  }
  return "unknown";
}

function addField(fields, key, value, provenance) {
  if (!fields || typeof fields !== "object") return;
  if (!key || typeof key !== "string") return;

  if (Array.isArray(value)) {
    const normalizedList = dedupeStrings(value);
    if (normalizedList.length <= 0) return;
    fields[key] = {
      value: normalizedList,
      provenance,
    };
    return;
  }

  const normalized = sanitizeValue(value);
  if (!normalized) return;
  fields[key] = {
    value: normalized,
    provenance,
  };
}

function deriveCoreFields({ identityText, userText, styleText }) {
  const fields = {};
  const identityBody = extractManagedBlock(identityText);
  const userBody = extractManagedBlock(userText);
  const styleBody = extractManagedBlock(styleText);
  const identityMap = parseMarkdownKeyValueLines(identityBody || identityText);
  const userMap = parseMarkdownKeyValueLines(userBody || userText);

  addField(fields, "pet_name", identityMap.get("name"), {
    sourceKind: "canonical_field",
    fileId: "IDENTITY.md",
    field: "Name",
  });
  addField(fields, "pet_pronouns", identityMap.get("pronouns"), {
    sourceKind: "canonical_field",
    fileId: "IDENTITY.md",
    field: "Pronouns",
  });
  addField(fields, "pet_birthday", identityMap.get("birthday"), {
    sourceKind: "canonical_field",
    fileId: "IDENTITY.md",
    field: "Birthday",
  });
  addField(fields, "pet_creature", identityMap.get("creature"), {
    sourceKind: "canonical_field",
    fileId: "IDENTITY.md",
    field: "Creature",
  });
  addField(fields, "companion_name", userMap.get("name"), {
    sourceKind: "canonical_field",
    fileId: "USER.md",
    field: "Name",
  });
  addField(fields, "companion_call_name", userMap.get("what to call you"), {
    sourceKind: "canonical_field",
    fileId: "USER.md",
    field: "What to call you",
  });
  addField(fields, "companion_timezone", userMap.get("timezone"), {
    sourceKind: "canonical_field",
    fileId: "USER.md",
    field: "Timezone",
  });

  const toneBullets = extractBulletSection(styleBody || styleText, /^\*\*tone:\*\*$/i);
  const vibeValues = parseListValue(identityMap.get("vibe"));
  const toneKeywords = dedupeStrings([...toneBullets, ...vibeValues], MAX_STYLE_HINTS);
  if (toneKeywords.length > 0) {
    addField(fields, "tone_keywords", toneKeywords, {
      sourceKind: "canonical_section",
      fileId: toneBullets.length > 0 ? "STYLE.md" : "IDENTITY.md",
      section: toneBullets.length > 0 ? "Tone" : "Vibe",
    });
  }

  return fields;
}

function deriveRecentHighlights({ runtimeObservations, memoryDir }) {
  const highlights = buildRecentHighlights({
    runtimeObservations: Array.isArray(runtimeObservations) ? runtimeObservations : [],
    memoryDir: toOptionalString(memoryDir, ""),
  }).slice(0, MAX_HIGHLIGHTS);
  return highlights.map((entry) => ({
    summary: truncateText(entry.summary, 140),
    evidenceTag: sanitizeValue(entry.evidenceTag) || "none",
    provenance: {
      sourceKind: "memory_observation",
      observationId: sanitizeValue(entry.observationId) || "unknown",
    },
  }));
}

function deriveSnapshotState({ root, requiredStatuses, fieldCount, memoryAvailable }) {
  if (!toOptionalString(root, "")) {
    return {
      state: PERSONA_SNAPSHOT_STATES.degraded,
      degradedReason: PERSONA_DEGRADED_REASONS.canonicalMissing,
    };
  }
  if (requiredStatuses.some((entry) => !entry.present)) {
    return {
      state: PERSONA_SNAPSHOT_STATES.degraded,
      degradedReason: PERSONA_DEGRADED_REASONS.canonicalMissing,
    };
  }
  if (requiredStatuses.some((entry) => !entry.readable)) {
    return {
      state: PERSONA_SNAPSHOT_STATES.degraded,
      degradedReason: PERSONA_DEGRADED_REASONS.canonicalUnreadable,
    };
  }
  if (fieldCount <= 0) {
    return {
      state: PERSONA_SNAPSHOT_STATES.degraded,
      degradedReason: PERSONA_DEGRADED_REASONS.parseIncomplete,
    };
  }
  if (!memoryAvailable) {
    return {
      state: PERSONA_SNAPSHOT_STATES.degraded,
      degradedReason: PERSONA_DEGRADED_REASONS.memoryUnavailable,
    };
  }
  return {
    state: PERSONA_SNAPSHOT_STATES.ready,
    degradedReason: PERSONA_DEGRADED_REASONS.none,
  };
}

function buildPersonaSnapshot({
  workspaceRoot = "",
  runtimeObservations = [],
  memoryDir = "",
  memoryAvailable = true,
  ts = Date.now(),
} = {}) {
  const normalizedRoot = toOptionalString(workspaceRoot, "");
  const requiredStatuses = REQUIRED_CANONICAL_FILES.map((fileId) => inspectFile(normalizedRoot, fileId));
  const optionalStatuses = OPTIONAL_CANONICAL_FILES.map((fileId) => inspectFile(normalizedRoot, fileId));
  const allStatuses = [...requiredStatuses, ...optionalStatuses];
  const readableFiles = allStatuses.filter((entry) => entry.readable).map((entry) => entry.fileId);
  const statusByFile = Object.fromEntries(allStatuses.map((entry) => [entry.fileId, entry]));
  const fields = deriveCoreFields({
    identityText: statusByFile["IDENTITY.md"]?.text || "",
    userText: statusByFile["USER.md"]?.text || "",
    styleText: statusByFile["STYLE.md"]?.text || "",
  });
  const fieldCount = Object.keys(fields).length;
  const snapshotState = deriveSnapshotState({
    root: normalizedRoot,
    requiredStatuses,
    fieldCount,
    memoryAvailable: Boolean(memoryAvailable),
  });
  const recentHighlights = deriveRecentHighlights({
    runtimeObservations,
    memoryDir,
  });
  const derivedFrom = dedupeStrings(
    [
      ...readableFiles,
      recentHighlights.length > 0 ? "MEMORY.md" : "",
    ],
    REQUIRED_CANONICAL_FILES.length + OPTIONAL_CANONICAL_FILES.length
  );

  return {
    kind: "personaSnapshot",
    schemaVersion: PERSONA_SNAPSHOT_SCHEMA_VERSION,
    builtAt: normalizeTimestamp(ts),
    state: snapshotState.state,
    degradedReason: snapshotState.degradedReason,
    derivedFrom,
    fields,
    recentHighlights,
  };
}

function flattenFieldValue(value) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return sanitizeValue(value);
}

function buildExportSummary({ state, degradedReason, facts, styleHints, recentHighlights }) {
  if (state !== PERSONA_SNAPSHOT_STATES.ready) {
    return truncateText(`Persona context degraded (${degradedReason}).`, MAX_SUMMARY_LENGTH);
  }
  const petName = facts.find((entry) => entry.key === "pet_name")?.value || "pet";
  const stylePart = styleHints.length > 0 ? ` style=${styleHints.join(", ")}` : "";
  const highlightsPart =
    recentHighlights.length > 0 ? ` highlights=${recentHighlights.length}` : "";
  return truncateText(`Persona ready for ${petName}.${stylePart}${highlightsPart}`.trim(), MAX_SUMMARY_LENGTH);
}

function enforceExportSize(payload) {
  const next = payload && typeof payload === "object" ? payload : {};
  const measure = () => Buffer.byteLength(JSON.stringify(next), "utf8");
  let byteSize = measure();

  while (byteSize > MAX_EXPORT_BYTES && Array.isArray(next.recentHighlights) && next.recentHighlights.length > 0) {
    next.recentHighlights.pop();
    byteSize = measure();
  }
  while (byteSize > MAX_EXPORT_BYTES && Array.isArray(next.styleHints) && next.styleHints.length > 0) {
    next.styleHints.pop();
    byteSize = measure();
  }
  while (byteSize > MAX_EXPORT_BYTES && Array.isArray(next.facts) && next.facts.length > 1) {
    next.facts.pop();
    byteSize = measure();
  }
  if (byteSize > MAX_EXPORT_BYTES) {
    next.summary = truncateText(next.summary, Math.max(64, Math.floor(MAX_SUMMARY_LENGTH / 2)));
    byteSize = measure();
  }
  if (byteSize > MAX_EXPORT_BYTES) {
    next.summary = truncateText(next.summary, 64);
    byteSize = measure();
  }
  return {
    payload: next,
    byteSize,
  };
}

function buildPersonaExport({
  snapshot = null,
  mode = "online_dialog",
  ts = Date.now(),
} = {}) {
  const normalizedSnapshot =
    snapshot && typeof snapshot === "object"
      ? snapshot
      : {
          schemaVersion: PERSONA_SNAPSHOT_SCHEMA_VERSION,
          state: PERSONA_SNAPSHOT_STATES.degraded,
          degradedReason: PERSONA_DEGRADED_REASONS.parseIncomplete,
          fields: {},
          recentHighlights: [],
        };

  const facts = Object.keys(normalizedSnapshot.fields || {})
    .sort()
    .slice(0, MAX_FACTS)
    .map((key) => {
      const field = normalizedSnapshot.fields[key] || {};
      return {
        key,
        value: truncateText(flattenFieldValue(field.value), 140),
        provenanceTag: buildProvenanceTag(field.provenance),
      };
    })
    .filter((entry) => entry.value);

  const styleHints = dedupeStrings(
    Array.isArray(normalizedSnapshot.fields?.tone_keywords?.value)
      ? normalizedSnapshot.fields.tone_keywords.value
      : [],
    MAX_STYLE_HINTS
  );

  const recentHighlights = (Array.isArray(normalizedSnapshot.recentHighlights)
    ? normalizedSnapshot.recentHighlights
    : []
  )
    .slice(0, MAX_HIGHLIGHTS)
    .map((entry) => truncateText(entry?.summary, 140))
    .filter(Boolean);

  const payload = {
    kind: "personaExport",
    schemaVersion: PERSONA_EXPORT_SCHEMA_VERSION,
    snapshotVersion: toOptionalString(
      normalizedSnapshot.schemaVersion,
      PERSONA_SNAPSHOT_SCHEMA_VERSION
    ),
    ts: normalizeTimestamp(ts),
    mode: toOptionalString(mode, "online_dialog"),
    state:
      normalizedSnapshot.state === PERSONA_SNAPSHOT_STATES.ready
        ? PERSONA_SNAPSHOT_STATES.ready
        : PERSONA_SNAPSHOT_STATES.degraded,
    degradedReason: toOptionalString(
      normalizedSnapshot.degradedReason,
      PERSONA_DEGRADED_REASONS.parseIncomplete
    ),
    summary: "",
    facts,
    styleHints,
    recentHighlights,
  };
  payload.summary = buildExportSummary(payload);
  const sized = enforceExportSize(payload);
  return {
    ...sized.payload,
    byteSize: sized.byteSize,
  };
}

module.exports = {
  MAX_EXPORT_BYTES,
  MAX_FACTS,
  MAX_HIGHLIGHTS,
  MAX_STYLE_HINTS,
  PERSONA_DEGRADED_REASONS,
  PERSONA_EXPORT_SCHEMA_VERSION,
  PERSONA_SNAPSHOT_SCHEMA_VERSION,
  PERSONA_SNAPSHOT_STATES,
  REQUIRED_CANONICAL_FILES,
  buildPersonaExport,
  buildPersonaSnapshot,
};
