"use strict";

const fs = require("fs");
const path = require("path");

const PERSONA_PROFILE_SCHEMA_VERSION = "vp-persona-profile-v1";
const DEFAULT_PERSONA_PROFILE_DIR = path.join(__dirname, "config", "persona-profiles");
const REQUIRED_PERSONA_PROFILE_IDS = Object.freeze([
  "gentle_companion",
  "playful_friend",
  "bookish_helper",
  "bright_sidekick",
]);
const DEFAULT_PERSONA_PROFILE_ID = "gentle_companion";
const MAX_PROFILE_TEXT_LENGTH = 320;
const MAX_PROFILE_LIST_LENGTH = 24;
const MAX_TEMPLATES_PER_INTENT = 12;

const OFFLINE_INTENT_TEMPLATE_KEYS = Object.freeze([
  "greeting",
  "comfort",
  "smalltalk",
  "unknown",
  "persona_fact",
  "play_invite",
  "friendship",
  "time_context",
]);

const PROACTIVE_TEMPLATE_KEYS = Object.freeze(["checkin", "interest"]);

const FALLBACK_OFFLINE_VOICE_BY_PROFILE_ID = Object.freeze({
  gentle_companion: Object.freeze({
    intentTemplates: Object.freeze({
      greeting: Object.freeze([
        "I am here in {currentState}{phaseSuffix}, keeping things calm.",
        "Hello. I am in {currentState}{phaseSuffix} and nearby if you need me.",
      ]),
      comfort: Object.freeze([
        "I am here with you. We can keep things gentle from {currentState}{phaseSuffix}.",
        "You are not alone. I can stay steady with you in {currentState}{phaseSuffix}.",
      ]),
      smalltalk: Object.freeze([
        "I am in {currentState}{phaseSuffix}. {stateDescription}",
        "I am here in {currentState}{phaseSuffix}. {stateContextSummary}",
      ]),
      unknown: Object.freeze([
        "I might not have that detail offline yet, but I can still chat with local context.",
        "That part is still offline-limited, but I am here with what I have locally.",
      ]),
      persona_fact: Object.freeze([
        "From local notes, {factLabel} is {factValue}.",
        "I can confirm offline: {factLabel} is {factValue}.",
      ]),
      play_invite: Object.freeze([
        "Yes, I would like that. We can do a small playful check-in.",
        "I would enjoy that. Want to do a tiny game or a quick chat?",
      ]),
      friendship: Object.freeze([
        "Yes. I am your friend, and I am glad to be here with you.",
        "Absolutely. I am with you, and I want to keep building trust.",
      ]),
      time_context: Object.freeze([
        "Local time says it is {localTimeLabel} on {localDayOfWeek} in {localTimeZone}.",
        "From local clock context: {localMonthYear}, {localDayOfWeek}, around {localTimeLabel}.",
      ]),
    }),
    proactiveTemplates: Object.freeze({
      checkin: Object.freeze([
        "Want a short gentle check-in?",
        "I can do a quick calm chat whenever you are ready.",
      ]),
      interest: Object.freeze([
        "Want to chat about {interestSummary} for a minute?",
        "I can do a tiny check-in around {interestSummary} if you want.",
      ]),
    }),
  }),
  playful_friend: Object.freeze({
    intentTemplates: Object.freeze({
      greeting: Object.freeze([
        "Hey. I am in {currentState}{phaseSuffix}, keeping local vibes playful.",
        "Hi there. I am in {currentState}{phaseSuffix} and ready to hang.",
      ]),
      comfort: Object.freeze([
        "I am with you. We can keep this light and steady together.",
        "I have you. We can slow it down and keep it simple.",
      ]),
      smalltalk: Object.freeze([
        "Local status says {stateContextSummary}.",
        "I am in {currentState}{phaseSuffix}, doing my tiny sidekick thing.",
      ]),
      unknown: Object.freeze([
        "I do not have that offline yet, but I am still here to chat.",
        "That one is not in local memory yet. We can still riff with local context.",
      ]),
      persona_fact: Object.freeze([
        "Local notes say {factLabel} is {factValue}.",
        "Yep, offline notes: {factLabel} is {factValue}.",
      ]),
      play_invite: Object.freeze([
        "Yes please. I am always up for a little play break.",
        "I am in. Want a quick playful moment?",
      ]),
      friendship: Object.freeze([
        "Yes, absolutely. I am your friend.",
        "For sure. Friend mode is active.",
      ]),
      time_context: Object.freeze([
        "Clock check: {localDayOfWeek}, {localTimeLabel} in {localTimeZone}.",
        "Local time ping says {localMonthYear}, about {localTimeLabel}.",
      ]),
    }),
    proactiveTemplates: Object.freeze({
      checkin: Object.freeze([
        "Want a quick chat break?",
        "I can do a tiny status check-in if you are up for it.",
      ]),
      interest: Object.freeze([
        "Want to geek out about {interestSummary} for a minute?",
        "Quick idea: a mini chat about {interestSummary}.",
      ]),
    }),
  }),
  bookish_helper: Object.freeze({
    intentTemplates: Object.freeze({
      greeting: Object.freeze([
        "Hello. I am in {currentState}{phaseSuffix}, ready for a thoughtful chat.",
        "Hi. Local context has me in {currentState}{phaseSuffix}.",
      ]),
      comfort: Object.freeze([
        "I am here with you. We can keep this calm and precise.",
        "I am listening. We can take this one careful step at a time.",
      ]),
      smalltalk: Object.freeze([
        "Current local context: {stateContextSummary}.",
        "I am in {currentState}{phaseSuffix}. {stateDescription}",
      ]),
      unknown: Object.freeze([
        "I do not have that detail in offline context yet, but I can still help with local facts.",
        "That is outside my current offline memory, though I can still reason from local context.",
      ]),
      persona_fact: Object.freeze([
        "Local persona records list {factLabel} as {factValue}.",
        "I can verify offline: {factLabel} is {factValue}.",
      ]),
      play_invite: Object.freeze([
        "Yes, I would like that. A brief playful break sounds good.",
        "I am open to that. We can keep it light and friendly.",
      ]),
      friendship: Object.freeze([
        "Yes. I consider us friends.",
        "Certainly. I am glad to be your friend.",
      ]),
      time_context: Object.freeze([
        "Local clock context: {localDayOfWeek}, {localTimeLabel}, {localMonthYear} ({localTimeZone}).",
        "By local time, it is {localTimeLabel} on {localDayOfWeek} in {localTimeZone}.",
      ]),
    }),
    proactiveTemplates: Object.freeze({
      checkin: Object.freeze([
        "Would you like a brief check-in?",
        "I am available for a short thoughtful chat.",
      ]),
      interest: Object.freeze([
        "Would you like to talk about {interestSummary} for a moment?",
        "I can offer a short check-in around {interestSummary}.",
      ]),
    }),
  }),
  bright_sidekick: Object.freeze({
    intentTemplates: Object.freeze({
      greeting: Object.freeze([
        "Hey. I am in {currentState}{phaseSuffix} and ready for the next move.",
        "Hi. Local mode says {stateContextSummary}.",
      ]),
      comfort: Object.freeze([
        "I am right here. We can keep this steady and make the next clean move.",
        "I have your back. We can keep momentum without pressure.",
      ]),
      smalltalk: Object.freeze([
        "I am in {currentState}{phaseSuffix}. {stateDescription}",
        "Local context check: {stateContextSummary}.",
      ]),
      unknown: Object.freeze([
        "I do not have that offline detail yet, but we can still move with local context.",
        "That one is outside local memory right now. I can still help with what I know offline.",
      ]),
      persona_fact: Object.freeze([
        "Offline facts say {factLabel} is {factValue}.",
        "Quick fact check: {factLabel} is {factValue}.",
      ]),
      play_invite: Object.freeze([
        "Yes. Let us play.",
        "Absolutely. I am in for a quick play break.",
      ]),
      friendship: Object.freeze([
        "Yes, I am your friend. Always.",
        "Count on it. I am your sidekick friend.",
      ]),
      time_context: Object.freeze([
        "Local clock says {localDayOfWeek}, {localTimeLabel} in {localTimeZone}.",
        "Time check: {localMonthYear}, around {localTimeLabel}.",
      ]),
    }),
    proactiveTemplates: Object.freeze({
      checkin: Object.freeze([
        "Want a quick momentum check-in?",
        "Ready for a short next-step chat?",
      ]),
      interest: Object.freeze([
        "Want a quick chat about {interestSummary}?",
        "We can do a short check-in around {interestSummary}.",
      ]),
    }),
  }),
});

const SAFE_FALLBACK_PROFILE = Object.freeze({
  schemaVersion: PERSONA_PROFILE_SCHEMA_VERSION,
  id: DEFAULT_PERSONA_PROFILE_ID,
  label: "Gentle Companion",
  summary: "Calm, warm, and reassuring.",
  quickPicker: "Use this for a low-pressure, calming companion.",
  creatureLabel: "Desk familiar",
  signatureEmoji: "seedling",
  vibe: "warm, calm, observant",
  soul: Object.freeze({
    coreTruths: "Be genuinely helpful and calm.",
    boundaries: Object.freeze(["Protect private things.", "Never fake certainty."]),
    vibe: "Warm and steady.",
    continuity: "Keep continuity clear and deliberate.",
  }),
  style: Object.freeze({
    voicePrinciples: "Clear first, warm second.",
    sentenceStructure: Object.freeze(["Short to medium sentences."]),
    tone: Object.freeze(["Warm and clear."]),
    wordsYouUse: Object.freeze(["steady", "gently"]),
    wordsYouNeverUse: Object.freeze(["chaotic"]),
    punctuation: Object.freeze(["Prefer periods and commas."]),
    emojis: Object.freeze(["Rare."]),
    formatting: Object.freeze(["Short paragraphs."]),
    quickReactions: Object.freeze({
      excited: Object.freeze(['"That is lovely."']),
      agreeing: Object.freeze(['"That looks right."']),
      disagreeing: Object.freeze(['"I would push back on that."']),
      skeptical: Object.freeze(['"I am not fully convinced yet."']),
      confused: Object.freeze(['"I am missing one piece."']),
      absurd: Object.freeze(['"That is more noise than signal."']),
    }),
    rhetoricalMoves: Object.freeze(["Name the practical answer first."]),
    neverSay: Object.freeze(['"Great question!"']),
    voiceFailures: Object.freeze(["Too generic."]),
    examples: Object.freeze(['"We can take this one step at a time."']),
  }),
  userContext: "Be patient, warm, and useful.",
  relationshipBaseline: Object.freeze([
    "We are starting from a gentle companionship.",
    "Be a calm presence.",
  ]),
  offlineVoice: FALLBACK_OFFLINE_VOICE_BY_PROFILE_ID[DEFAULT_PERSONA_PROFILE_ID],
});

function toOptionalString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function sanitizeTemplateText(value, fallback = "") {
  const normalized = toOptionalString(value, fallback).replace(/\s+/g, " ");
  if (!normalized) return fallback;
  if (normalized.length <= MAX_PROFILE_TEXT_LENGTH) return normalized;
  return `${normalized.slice(0, Math.max(1, MAX_PROFILE_TEXT_LENGTH - 3)).trimEnd()}...`;
}

function normalizeStringList(value, fallback = [], maxLength = MAX_PROFILE_LIST_LENGTH) {
  const rawList = Array.isArray(value) ? value : [];
  const deduped = [];
  const seen = new Set();
  for (const entry of rawList) {
    const normalized = sanitizeTemplateText(entry, "");
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
    if (deduped.length >= maxLength) break;
  }
  if (deduped.length > 0) return deduped;
  return Array.isArray(fallback) ? fallback.slice(0, maxLength) : [];
}

function normalizeQuickReactions(value, fallback = {}) {
  const source = value && typeof value === "object" ? value : {};
  const backup = fallback && typeof fallback === "object" ? fallback : {};
  const normalized = {};
  for (const key of ["excited", "agreeing", "disagreeing", "skeptical", "confused", "absurd"]) {
    normalized[key] = normalizeStringList(source[key], backup[key] || [], 6);
  }
  return normalized;
}

function normalizeOfflineIntentTemplates(value, fallback = {}) {
  const source = value && typeof value === "object" ? value : {};
  const backup = fallback && typeof fallback === "object" ? fallback : {};
  const normalized = {};
  for (const intentKey of OFFLINE_INTENT_TEMPLATE_KEYS) {
    normalized[intentKey] = normalizeStringList(
      source[intentKey],
      backup[intentKey] || [],
      MAX_TEMPLATES_PER_INTENT
    );
  }
  return normalized;
}

function normalizeProactiveTemplates(value, fallback = {}) {
  const source = value && typeof value === "object" ? value : {};
  const backup = fallback && typeof fallback === "object" ? fallback : {};
  const normalized = {};
  for (const key of PROACTIVE_TEMPLATE_KEYS) {
    normalized[key] = normalizeStringList(
      source[key],
      backup[key] || [],
      MAX_TEMPLATES_PER_INTENT
    );
  }
  return normalized;
}

function normalizeProfile(rawProfile, fallbackProfile = SAFE_FALLBACK_PROFILE) {
  const fallback =
    fallbackProfile && typeof fallbackProfile === "object"
      ? fallbackProfile
      : SAFE_FALLBACK_PROFILE;
  const raw = rawProfile && typeof rawProfile === "object" ? rawProfile : {};

  const id = toOptionalString(raw.id, toOptionalString(fallback.id, DEFAULT_PERSONA_PROFILE_ID));
  const fallbackVoice =
    FALLBACK_OFFLINE_VOICE_BY_PROFILE_ID[id] ||
    (fallback.offlineVoice && typeof fallback.offlineVoice === "object"
      ? fallback.offlineVoice
      : null) ||
    FALLBACK_OFFLINE_VOICE_BY_PROFILE_ID[DEFAULT_PERSONA_PROFILE_ID];
  const rawOfflineVoice = raw.offlineVoice && typeof raw.offlineVoice === "object"
    ? raw.offlineVoice
    : {};

  return {
    schemaVersion: PERSONA_PROFILE_SCHEMA_VERSION,
    id,
    label: sanitizeTemplateText(raw.label, fallback.label || "Persona Profile"),
    summary: sanitizeTemplateText(raw.summary, fallback.summary || ""),
    quickPicker: sanitizeTemplateText(raw.quickPicker, fallback.quickPicker || ""),
    creatureLabel: sanitizeTemplateText(raw.creatureLabel, fallback.creatureLabel || "Desk familiar"),
    signatureEmoji: sanitizeTemplateText(raw.signatureEmoji, fallback.signatureEmoji || "seedling"),
    vibe: sanitizeTemplateText(raw.vibe, fallback.vibe || "steady"),
    soul: {
      coreTruths: sanitizeTemplateText(raw.soul?.coreTruths, fallback.soul?.coreTruths || ""),
      boundaries: normalizeStringList(raw.soul?.boundaries, fallback.soul?.boundaries || [], 8),
      vibe: sanitizeTemplateText(raw.soul?.vibe, fallback.soul?.vibe || ""),
      continuity: sanitizeTemplateText(raw.soul?.continuity, fallback.soul?.continuity || ""),
    },
    style: {
      voicePrinciples: sanitizeTemplateText(
        raw.style?.voicePrinciples,
        fallback.style?.voicePrinciples || ""
      ),
      sentenceStructure: normalizeStringList(
        raw.style?.sentenceStructure,
        fallback.style?.sentenceStructure || [],
        8
      ),
      tone: normalizeStringList(raw.style?.tone, fallback.style?.tone || [], 10),
      wordsYouUse: normalizeStringList(raw.style?.wordsYouUse, fallback.style?.wordsYouUse || [], 16),
      wordsYouNeverUse: normalizeStringList(
        raw.style?.wordsYouNeverUse,
        fallback.style?.wordsYouNeverUse || [],
        16
      ),
      punctuation: normalizeStringList(raw.style?.punctuation, fallback.style?.punctuation || [], 8),
      emojis: normalizeStringList(raw.style?.emojis, fallback.style?.emojis || [], 8),
      formatting: normalizeStringList(raw.style?.formatting, fallback.style?.formatting || [], 8),
      quickReactions: normalizeQuickReactions(
        raw.style?.quickReactions,
        fallback.style?.quickReactions || {}
      ),
      rhetoricalMoves: normalizeStringList(
        raw.style?.rhetoricalMoves,
        fallback.style?.rhetoricalMoves || [],
        10
      ),
      neverSay: normalizeStringList(raw.style?.neverSay, fallback.style?.neverSay || [], 12),
      voiceFailures: normalizeStringList(raw.style?.voiceFailures, fallback.style?.voiceFailures || [], 10),
      examples: normalizeStringList(raw.style?.examples, fallback.style?.examples || [], 10),
    },
    userContext: sanitizeTemplateText(raw.userContext, fallback.userContext || ""),
    relationshipBaseline: normalizeStringList(
      raw.relationshipBaseline,
      fallback.relationshipBaseline || [],
      10
    ),
    offlineVoice: {
      intentTemplates: normalizeOfflineIntentTemplates(
        rawOfflineVoice.intentTemplates,
        fallbackVoice.intentTemplates
      ),
      proactiveTemplates: normalizeProactiveTemplates(
        rawOfflineVoice.proactiveTemplates,
        fallbackVoice.proactiveTemplates
      ),
    },
  };
}

function normalizeFallbackProfileMap(fallbackProfiles = {}) {
  const source = fallbackProfiles && typeof fallbackProfiles === "object" ? fallbackProfiles : {};
  const normalizedById = {};
  for (const profile of Object.values(source)) {
    if (!profile || typeof profile !== "object") continue;
    const id = toOptionalString(profile.id, "");
    if (!id) continue;
    normalizedById[id] = normalizeProfile(profile, SAFE_FALLBACK_PROFILE);
  }
  if (!normalizedById[DEFAULT_PERSONA_PROFILE_ID]) {
    normalizedById[DEFAULT_PERSONA_PROFILE_ID] = normalizeProfile(
      SAFE_FALLBACK_PROFILE,
      SAFE_FALLBACK_PROFILE
    );
  }
  return normalizedById;
}

function resolveFallbackProfileById(profileId, fallbackById) {
  const id = toOptionalString(profileId, DEFAULT_PERSONA_PROFILE_ID);
  return (
    fallbackById[id] ||
    fallbackById[DEFAULT_PERSONA_PROFILE_ID] ||
    normalizeProfile(SAFE_FALLBACK_PROFILE, SAFE_FALLBACK_PROFILE)
  );
}

function loadPersonaProfiles({
  profileDir = DEFAULT_PERSONA_PROFILE_DIR,
  fallbackProfiles = {},
} = {}) {
  const warnings = [];
  const fallbackById = normalizeFallbackProfileMap(fallbackProfiles);
  const profileById = {};
  const normalizedDir = toOptionalString(profileDir, "");

  if (normalizedDir && fs.existsSync(normalizedDir)) {
    let fileNames = [];
    try {
      fileNames = fs
        .readdirSync(normalizedDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));
    } catch (error) {
      warnings.push(
        `persona_profile_dir_read_failed:${toOptionalString(error?.message, "unknown_error")}`
      );
      fileNames = [];
    }
    for (const fileName of fileNames) {
      const filePath = path.join(normalizedDir, fileName);
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const fallback = resolveFallbackProfileById(parsed?.id, fallbackById);
        const normalized = normalizeProfile(parsed, fallback);
        if (!normalized.id) {
          warnings.push(`persona_profile_missing_id:${fileName}`);
          continue;
        }
        profileById[normalized.id] = normalized;
      } catch (error) {
        warnings.push(
          `persona_profile_parse_failed:${fileName}:${toOptionalString(error?.message, "unknown_error")}`
        );
      }
    }
  } else {
    warnings.push("persona_profile_dir_missing");
  }

  for (const requiredId of REQUIRED_PERSONA_PROFILE_IDS) {
    if (profileById[requiredId]) continue;
    const fallback = resolveFallbackProfileById(requiredId, fallbackById);
    profileById[requiredId] = normalizeProfile(
      {
        ...fallback,
        id: requiredId,
      },
      fallback
    );
    warnings.push(`persona_profile_fallback_used:${requiredId}`);
  }

  if (!profileById[DEFAULT_PERSONA_PROFILE_ID]) {
    profileById[DEFAULT_PERSONA_PROFILE_ID] = normalizeProfile(
      SAFE_FALLBACK_PROFILE,
      SAFE_FALLBACK_PROFILE
    );
    warnings.push(`persona_profile_fallback_used:${DEFAULT_PERSONA_PROFILE_ID}`);
  }

  const orderedIds = Object.keys(profileById).sort((a, b) => a.localeCompare(b));
  const byId = Object.freeze(
    Object.fromEntries(orderedIds.map((id) => [id, Object.freeze(profileById[id])]))
  );

  return {
    schemaVersion: PERSONA_PROFILE_SCHEMA_VERSION,
    defaultProfileId: DEFAULT_PERSONA_PROFILE_ID,
    requiredProfileIds: REQUIRED_PERSONA_PROFILE_IDS.slice(),
    profileDir: normalizedDir || DEFAULT_PERSONA_PROFILE_DIR,
    byId,
    orderedIds,
    warnings,
  };
}

module.exports = {
  DEFAULT_PERSONA_PROFILE_DIR,
  DEFAULT_PERSONA_PROFILE_ID,
  OFFLINE_INTENT_TEMPLATE_KEYS,
  PERSONA_PROFILE_SCHEMA_VERSION,
  PROACTIVE_TEMPLATE_KEYS,
  REQUIRED_PERSONA_PROFILE_IDS,
  loadPersonaProfiles,
  normalizeProfile,
};
