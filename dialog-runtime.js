"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_DIALOG_TEMPLATES_PATH = path.join(
  __dirname,
  "config",
  "dialog",
  "offline-templates.json"
);
const DEFAULT_TEXT_LIMIT = 240;
const DEFAULT_SUMMARY_LIMIT = 180;

function asPositiveInteger(value, fallback, min = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < min) return fallback;
  return Math.max(min, Math.round(numeric));
}

function normalizeText(value, maxLength = DEFAULT_TEXT_LIMIT) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, Math.max(1, maxLength - 3)).trimEnd() + "...";
}

function sanitizeTemplateList(value, fallbackList) {
  const normalized = Array.isArray(value)
    ? value
        .map((entry) => normalizeText(entry))
        .filter(Boolean)
    : [];
  return normalized.length > 0 ? normalized : fallbackList.slice();
}

function createDefaultDialogTemplateCatalog() {
  return normalizeDialogTemplateCatalog({});
}

function normalizeDialogTemplateCatalog(rawCatalog = {}) {
  const rawTemplates =
    rawCatalog?.templates && typeof rawCatalog.templates === "object"
      ? rawCatalog.templates
      : {};
  return {
    version: asPositiveInteger(rawCatalog.version, 1),
    templates: {
      greeting: sanitizeTemplateList(rawTemplates.greeting, [
        "Hi. I'm in {currentState}{phaseSuffix}, and {stateDescription}",
        "Hello. Right now I'm in {currentState}{phaseSuffix}. {stateDescription}",
      ]),
      music: sanitizeTemplateList(rawTemplates.music, [
        "I'm in {currentState}{phaseSuffix}. The latest music cue I have is {recentMediaSummary}",
        "Right now I'm in {currentState}{phaseSuffix}, and the music context says {recentMediaSummary}",
      ]),
      reading: sanitizeTemplateList(rawTemplates.reading, [
        "I'm in {currentState}{phaseSuffix}. {stateDescription} Latest reading cue: {recentHobbySummary}",
        "I'm still in {currentState}{phaseSuffix}. {stateDescription} Reading context: {recentHobbySummary}",
      ]),
      hobby: sanitizeTemplateList(rawTemplates.hobby, [
        "I'm in {currentState}{phaseSuffix}. The latest hobby cue I have is {recentHobbySummary}",
        "Right now I'm in {currentState}{phaseSuffix}. Hobby context says {recentHobbySummary}",
      ]),
      general: sanitizeTemplateList(rawTemplates.general, [
        "I'm in {currentState}{phaseSuffix}. {stateDescription}",
        "Right now I'm in {currentState}{phaseSuffix}. {stateContextSummary}",
      ]),
      fallback: sanitizeTemplateList(rawTemplates.fallback, [
        "I'm here in {currentState}{phaseSuffix}. {stateContextSummary}",
      ]),
    },
  };
}

function loadDialogTemplateCatalog(filePath = DEFAULT_DIALOG_TEMPLATES_PATH) {
  const resolvedPath =
    typeof filePath === "string" && filePath.trim().length > 0
      ? filePath
      : DEFAULT_DIALOG_TEMPLATES_PATH;
  const raw = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  return normalizeDialogTemplateCatalog(raw);
}

function classifyOfflineDialogTrigger(text) {
  const normalized = normalizeText(text, DEFAULT_SUMMARY_LIMIT).toLowerCase();
  if (!normalized) return "generic";
  if (/^(hi|hello|hey|yo)\b/.test(normalized)) return "greeting";
  if (/\b(music|song|songs|listen|listening|track|album|artist)\b/.test(normalized)) {
    return "music";
  }
  if (/\b(read|reading|article|rss|feed|news)\b/.test(normalized)) {
    return "reading";
  }
  if (/\b(hobby|doing|working on|watching)\b/.test(normalized)) {
    return "hobby";
  }
  return "generic";
}

function hashSeed(parts) {
  const joined = parts.filter(Boolean).join("|");
  let hash = 0;
  for (let index = 0; index < joined.length; index += 1) {
    hash = (hash * 31 + joined.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function selectTemplateKey({
  triggerReason,
  currentState,
  recentMediaSummary,
  recentHobbySummary,
}) {
  const normalizedTrigger = normalizeText(triggerReason, 32).toLowerCase();
  const normalizedState = normalizeText(currentState, 48).toLowerCase();

  if (normalizedTrigger === "greeting") return "greeting";
  if (normalizedTrigger === "music" && recentMediaSummary) return "music";
  if ((normalizedTrigger === "reading" || normalizedState === "reading") && recentHobbySummary) {
    return "reading";
  }
  if (normalizedTrigger === "hobby" && recentHobbySummary) return "hobby";
  if (normalizedState === "reading") return "reading";
  return "general";
}

function interpolateTemplate(template, context = {}) {
  return String(template || "")
    .replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
      const value = context[key];
      return value == null ? "" : String(value);
    })
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildOfflineDialogResponse(options = {}) {
  const templates =
    options.templates && typeof options.templates === "object"
      ? options.templates
      : createDefaultDialogTemplateCatalog();
  const normalizedText = normalizeText(options.text, DEFAULT_SUMMARY_LIMIT);
  const currentState = normalizeText(options.currentState, 48) || "Idle";
  const phase = normalizeText(options.phase, 48);
  const source = normalizeText(options.source, 16) || "offline";
  const triggerReason =
    normalizeText(options.triggerReason, 32) || classifyOfflineDialogTrigger(normalizedText);
  const stateDescription =
    normalizeText(options.stateDescription, DEFAULT_TEXT_LIMIT) || "I'm keeping to local routines.";
  const stateContextSummary =
    normalizeText(options.stateContextSummary, DEFAULT_SUMMARY_LIMIT) || "local context only";
  const recentMediaSummary = normalizeText(options.recentMediaSummary, DEFAULT_SUMMARY_LIMIT);
  const recentHobbySummary = normalizeText(options.recentHobbySummary, DEFAULT_SUMMARY_LIMIT);
  const templateKey = selectTemplateKey({
    triggerReason,
    currentState,
    recentMediaSummary,
    recentHobbySummary,
  });
  const context = {
    currentState,
    phase: phase || "none",
    phaseSuffix: phase ? `/${phase}` : "",
    source,
    stateDescription,
    stateContextSummary,
    recentMediaSummary: recentMediaSummary || "no active media",
    recentHobbySummary: recentHobbySummary || "no recent hobby updates",
    userText: normalizedText || "your message",
  };
  const templateOptions =
    templates.templates?.[templateKey] || templates.templates?.fallback || [];
  const seed = hashSeed([
    normalizedText,
    currentState,
    phase,
    source,
    triggerReason,
    recentMediaSummary,
    recentHobbySummary,
  ]);
  const selectedTemplate =
    templateOptions.length > 0
      ? templateOptions[seed % templateOptions.length]
      : "I'm here in {currentState}{phaseSuffix}. {stateContextSummary}";
  let responseText = interpolateTemplate(selectedTemplate, context);
  if (!responseText) {
    const fallbackTemplate =
      templates.templates?.fallback?.[0] ||
      "I'm here in {currentState}{phaseSuffix}. {stateContextSummary}";
    responseText = interpolateTemplate(fallbackTemplate, context);
  }

  return {
    source: "offline",
    fallbackMode: normalizeText(options.fallbackMode, 64) || "dialog_offline_template",
    triggerReason,
    templateKey,
    currentState,
    phase: phase || null,
    stateContextSummary,
    text: responseText,
  };
}

module.exports = {
  DEFAULT_DIALOG_TEMPLATES_PATH,
  buildOfflineDialogResponse,
  classifyOfflineDialogTrigger,
  createDefaultDialogTemplateCatalog,
  loadDialogTemplateCatalog,
};
