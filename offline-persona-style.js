"use strict";

const { DEFAULT_PERSONA_PROFILE_ID, loadPersonaProfiles } = require("./persona-profiles");

const PERSONA_SNAPSHOT_VERSION = "vp-persona-snapshot-v1";
const MAX_REPLY_LENGTH = 220;
const MAX_SENTENCES = 2;
const MAX_FOLLOW_UP_QUESTIONS = 1;
const MAX_TONE_KEYWORDS = 6;
const MAX_CUSTOM_FACTS_FOR_LOOKUP = 48;

const PERSONA_STATES = Object.freeze({ ready: "ready", degraded: "degraded" });

const PERSONA_INTENTS = Object.freeze({
  identityName: "identity_name",
  identityBirthday: "identity_birthday",
  identityNickname: "identity_nickname",
  recentHighlights: "recent_highlights",
  personaFact: "persona_fact",
  playInvite: "play_invite",
  friendship: "friendship",
  timeContext: "time_context",
  greeting: "greeting",
  comfort: "comfort",
  smalltalk: "smalltalk",
  unknown: "unknown",
});

const PERSONA_MODES = Object.freeze({
  gentleCompanion: "gentle_companion",
  playfulFriend: "playful_friend",
  bookishHelper: "bookish_helper",
  brightSidekick: "bright_sidekick",
  steadyCompanion: "steady_companion",
  neutralFallback: "neutral_fallback",
});

const DEFAULT_STYLE_PROFILE = Object.freeze({
  warmth: "medium",
  playfulness: "low",
  curiosity: "medium",
  verbosity: "short",
  emojiPolicy: "none",
  addressStyle: "pet_name_only",
  openerStyle: "direct",
  closerStyle: "none",
  toneKeywords: [],
  personaProfileId: DEFAULT_PERSONA_PROFILE_ID,
});

const TONE_BUCKETS = Object.freeze({
  warmth: new Set(["warm", "gentle", "kind", "cozy", "caring", "supportive"]),
  playfulness: new Set(["playful", "silly", "goofy", "bouncy", "sparkly", "cheerful"]),
  curiosity: new Set(["curious", "inquisitive", "explorer", "questioning"]),
  concise: new Set(["concise", "brief", "short", "compact"]),
  chatty: new Set(["chatty", "detailed", "expressive", "story"]),
});

const OPENER_TOKENS = Object.freeze({
  direct: Object.freeze(["Hi.", "Hello.", "Hey."]),
  warm_short: Object.freeze(["Hi there.", "Hey friend.", "Hello there."]),
  warm_reflective: Object.freeze([
    "Hi, thanks for checking in.",
    "Hey, I am glad you asked.",
    "Hello, it is good to hear from you.",
  ]),
});

const CLOSER_TOKENS = Object.freeze({
  none: Object.freeze([""]),
  gentle_prompt: Object.freeze(["Want to keep chatting?", "We can keep talking if you want."]),
  supportive_note: Object.freeze(["I am here with you.", "I can stay with you here."]),
});

const FOLLOW_UP_TOKENS = Object.freeze({
  greeting: Object.freeze(["How is your day going?", "How are you feeling today?"]),
  comfort: Object.freeze([
    "Want me to keep things calm for a bit?",
    "Do you want a gentle check-in in a little while?",
  ]),
  smalltalk: Object.freeze(["Want a quick status recap too?", "Want to hear a short local highlight?"]),
  unknown: Object.freeze(["I can still chat with local context here."]),
});

const DEFAULT_INTENT_TEMPLATES = Object.freeze({
  greeting: Object.freeze([
    "I am {petName} and I am in {currentState}{phaseSuffix}. {stateDescription}",
    "I am here in {currentState}{phaseSuffix}. {stateContextSummary}",
  ]),
  comfort: Object.freeze([
    "I am right here with you in {currentState}{phaseSuffix}.",
    "I am here with you and we can keep this steady from {currentState}{phaseSuffix}.",
  ]),
  smalltalk: Object.freeze([
    "I am in {currentState}{phaseSuffix}. {stateDescription}",
    "Local context says {stateContextSummary}.",
  ]),
  unknown: Object.freeze([
    "I might not have that detail offline yet, but I can still chat from local context.",
    "That one is not in local memory yet, though I can still help with local context.",
  ]),
  persona_fact: Object.freeze([
    "From local persona notes, {factLabel} is {factValue}.",
    "I can confirm offline: {factLabel} is {factValue}.",
  ]),
  play_invite: Object.freeze([
    "Yes, I would like to play. We can do a short playful check-in.",
    "I am in. Want a tiny game or a quick chat?",
  ]),
  friendship: Object.freeze([
    "Yes, I want to be your friend.",
    "Absolutely. I am your friend and I am here with you.",
  ]),
  time_context: Object.freeze([
    "Local time says {localTimeLabel} on {localDayOfWeek} in {localTimeZone}.",
    "Clock context says {localMonthYear}, {localDayOfWeek}, around {localTimeLabel}.",
  ]),
});

const DEFAULT_PROACTIVE_TEMPLATES = Object.freeze({
  checkin: Object.freeze(["Want a short check-in?", "I can do a quick local chat whenever you want."]),
  interest: Object.freeze([
    "Want to chat about {interestSummary} for a minute?",
    "I can do a tiny check-in around {interestSummary} if you want.",
  ]),
});

const TIME_CONTEXT_TEMPLATES = Object.freeze({
  day: Object.freeze(["{localDayOfWeek}."]),
  date: Object.freeze(["{localDateLabel}."]),
  time: Object.freeze(["{localTimeWithZone}."]),
  month: Object.freeze(["{localMonthLabel}."]),
  year: Object.freeze(["{localYearLabel}."]),
  datetime: Object.freeze(["{localDateLabel}, {localTimeWithZone}."]),
});

const FACT_LOOKUP_RULES = Object.freeze([
  Object.freeze({ fieldKey: "companion_name", factLabel: "your name", patterns: Object.freeze([/\b(what('?s| is) my name|who am i)\b/]) }),
  Object.freeze({ fieldKey: "companion_call_name", factLabel: "what I should call you", patterns: Object.freeze([/\b(what should you call me|what do you call me|my call name|my preferred name)\b/]) }),
  Object.freeze({ fieldKey: "companion_timezone", factLabel: "your timezone", patterns: Object.freeze([/\b(my timezone|my time zone|timezone am i in|time zone am i in)\b/]) }),
  Object.freeze({ fieldKey: "pet_creature", factLabel: "my creature type", patterns: Object.freeze([/\b(your creature|your species|what type of creature are you)\b/]) }),
  Object.freeze({ fieldKey: "pet_pronouns", factLabel: "my pronouns", patterns: Object.freeze([/\b(your pronouns|what are your pronouns)\b/]) }),
  Object.freeze({ fieldKey: "pet_favorite_color", factLabel: "my favorite color", patterns: Object.freeze([/\b(your favorite color|favourite color)\b/]) }),
  Object.freeze({ fieldKey: "pet_favorite_movie", factLabel: "my favorite movie", patterns: Object.freeze([/\b(your favorite movie|favourite movie)\b/]) }),
  Object.freeze({ fieldKey: "pet_favorite_song", factLabel: "my favorite song", patterns: Object.freeze([/\b(your favorite song|favourite song)\b/]) }),
  Object.freeze({ fieldKey: "pet_favorite_book", factLabel: "my favorite book", patterns: Object.freeze([/\b(your favorite book|favourite book)\b/]) }),
  Object.freeze({ fieldKey: "pet_hobby", factLabel: "my hobby", patterns: Object.freeze([/\b(your hobby|what do you like to do|what do you do for fun)\b/]) }),
  Object.freeze({ fieldKey: "persona_profile_id", factLabel: "my personality profile", patterns: Object.freeze([/\b(your personality|your profile|what kind of pet are you)\b/]) }),
]);

const PERSONA_PROFILES_REGISTRY = loadPersonaProfiles();
const PERSONA_PROFILES = PERSONA_PROFILES_REGISTRY.byId;

function toOptionalString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizePrompt(value) {
  return toOptionalString(value, "").replace(/\s+/g, " ").trim();
}

function normalizeLowerPrompt(value) {
  return normalizePrompt(value).toLowerCase();
}

function normalizeState(value, fallback = "Idle") {
  return toOptionalString(value, fallback);
}

function normalizeSummary(value, maxLength = 140, fallback = "local context only") {
  const normalized = toOptionalString(value, fallback).replace(/\s+/g, " ");
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...`;
}

function normalizeMatchingText(value) {
  return normalizeLowerPrompt(value).replace(/[?!.,;:]+/g, "").trim();
}

function fnv1a32(value) {
  const text = String(value || "");
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function hashHex(value) {
  return fnv1a32(value).toString(16).padStart(8, "0");
}

function pickDeterministic(list, seed) {
  const entries = Array.isArray(list) ? list.filter(Boolean) : [];
  if (entries.length <= 0) return "";
  const index = fnv1a32(seed) % entries.length;
  return entries[index];
}

function readSnapshotField(snapshot, key) {
  if (!snapshot || typeof snapshot !== "object") return "";
  const fields = snapshot.fields && typeof snapshot.fields === "object" ? snapshot.fields : {};
  const field = fields[key] && typeof fields[key] === "object" ? fields[key] : null;
  if (!field) return "";
  if (Array.isArray(field.value)) {
    return field.value.map((entry) => toOptionalString(entry, "")).filter(Boolean).join(", ");
  }
  return toOptionalString(field.value, "");
}

function readSnapshotFieldList(snapshot, key, maxItems = MAX_TONE_KEYWORDS) {
  if (!snapshot || typeof snapshot !== "object") return [];
  const fields = snapshot.fields && typeof snapshot.fields === "object" ? snapshot.fields : {};
  const field = fields[key] && typeof fields[key] === "object" ? fields[key] : null;
  if (!field) return [];
  const raw = Array.isArray(field.value) ? field.value : [field.value];
  const deduped = [];
  const seen = new Set();
  for (const entry of raw) {
    const normalized = toOptionalString(entry, "").toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
    if (deduped.length >= maxItems) break;
  }
  return deduped;
}
function parseCustomFactEntries(snapshot) {
  const entries = [];
  const rawList = readSnapshotFieldList(snapshot, "extra_offline_facts", MAX_CUSTOM_FACTS_FOR_LOOKUP);
  for (const rawEntry of rawList) {
    const match = String(rawEntry).match(/^(.+?)\s*=>\s*(.+)$/);
    if (!match) continue;
    const question = normalizeMatchingText(match[1]);
    const answer = normalizeSummary(match[2], 96, "");
    if (!question || !answer) continue;
    entries.push({
      question,
      answer,
      rawQuestion: normalizeSummary(match[1], 72, "offline fact"),
    });
  }
  return entries;
}

function humanizeReason(value) {
  const normalized = toOptionalString(value, "parse_incomplete");
  return normalized.replace(/_/g, " ");
}

function countKeywordMatches(keywords, bucket) {
  let count = 0;
  for (const keyword of keywords) {
    if (bucket.has(keyword)) count += 1;
  }
  return count;
}

function deriveLevel(keywords, bucket, { highThreshold = 2, mediumThreshold = 1 } = {}) {
  const score = countKeywordMatches(keywords, bucket);
  if (score >= highThreshold) return "high";
  if (score >= mediumThreshold) return "medium";
  return "low";
}

function deriveVerbosity(keywords) {
  if (countKeywordMatches(keywords, TONE_BUCKETS.concise) > 0) return "short";
  if (countKeywordMatches(keywords, TONE_BUCKETS.chatty) > 0) return "medium";
  return DEFAULT_STYLE_PROFILE.verbosity;
}

function deriveAddressStyle(snapshot) {
  const companionName = readSnapshotField(snapshot, "companion_name");
  const callName = readSnapshotField(snapshot, "companion_call_name");
  if (callName) return "friendly_nickname";
  if (companionName) return "pet_plus_user";
  return DEFAULT_STYLE_PROFILE.addressStyle;
}

function normalizePersonaProfileId(value) {
  const normalized = toOptionalString(value, "").toLowerCase();
  if (!normalized) return DEFAULT_PERSONA_PROFILE_ID;
  if (PERSONA_PROFILES[normalized]) return normalized;
  return DEFAULT_PERSONA_PROFILE_ID;
}

function buildStyleProfileFromPersonaSnapshot(snapshot) {
  const personaState =
    toOptionalString(snapshot?.state, PERSONA_STATES.degraded).toLowerCase() === PERSONA_STATES.ready
      ? PERSONA_STATES.ready
      : PERSONA_STATES.degraded;
  const personaReason = toOptionalString(snapshot?.degradedReason, "parse_incomplete") || "parse_incomplete";
  const toneKeywords = readSnapshotFieldList(snapshot, "tone_keywords").sort();
  const profileId = normalizePersonaProfileId(readSnapshotField(snapshot, "persona_profile_id"));

  const profile = {
    warmth: deriveLevel(toneKeywords, TONE_BUCKETS.warmth, { highThreshold: 1, mediumThreshold: 1 }),
    playfulness: deriveLevel(toneKeywords, TONE_BUCKETS.playfulness, { highThreshold: 1, mediumThreshold: 1 }),
    curiosity: deriveLevel(toneKeywords, TONE_BUCKETS.curiosity, { highThreshold: 1, mediumThreshold: 1 }),
    verbosity: deriveVerbosity(toneKeywords),
    emojiPolicy: "none",
    addressStyle: deriveAddressStyle(snapshot),
    openerStyle: "direct",
    closerStyle: "none",
    toneKeywords: toneKeywords.slice(0, MAX_TONE_KEYWORDS),
    personaProfileId: profileId,
  };

  if (profile.warmth === "high") {
    profile.openerStyle = "warm_short";
    profile.closerStyle = "gentle_prompt";
  }
  if (profile.playfulness === "high") {
    profile.emojiPolicy = "light";
    profile.openerStyle = "warm_short";
  }
  if (profile.curiosity === "high" && profile.warmth === "high") {
    profile.openerStyle = "warm_reflective";
    profile.closerStyle = "supportive_note";
  }

  if (personaState !== PERSONA_STATES.ready) {
    return {
      ...DEFAULT_STYLE_PROFILE,
      emojiPolicy: "none",
      playfulness: "low",
      openerStyle: "direct",
      closerStyle: "none",
      toneKeywords: [],
      personaProfileId: profileId,
      personaState,
      personaReason,
    };
  }

  return {
    ...DEFAULT_STYLE_PROFILE,
    ...profile,
    personaState,
    personaReason: "none",
  };
}

function selectPersonaMode(styleProfile) {
  if (!styleProfile || styleProfile.personaState !== PERSONA_STATES.ready) {
    return PERSONA_MODES.neutralFallback;
  }
  const profileId = normalizePersonaProfileId(styleProfile.personaProfileId);
  if (profileId === PERSONA_MODES.gentleCompanion) return PERSONA_MODES.gentleCompanion;
  if (profileId === PERSONA_MODES.playfulFriend) return PERSONA_MODES.playfulFriend;
  if (profileId === PERSONA_MODES.bookishHelper) return PERSONA_MODES.bookishHelper;
  if (profileId === PERSONA_MODES.brightSidekick) return PERSONA_MODES.brightSidekick;
  return PERSONA_MODES.steadyCompanion;
}

function resolveFixedFactLookup(snapshot, promptText) {
  const normalized = normalizeLowerPrompt(promptText);
  if (!normalized) return null;
  for (const rule of FACT_LOOKUP_RULES) {
    const patternList = Array.isArray(rule.patterns) ? rule.patterns : [];
    const matched = patternList.some((pattern) => pattern instanceof RegExp && pattern.test(normalized));
    if (!matched) continue;
    const value = readSnapshotField(snapshot, rule.fieldKey);
    return {
      fieldKey: rule.fieldKey,
      factLabel: rule.factLabel,
      factValue: value,
      hasValue: Boolean(value),
    };
  }
  return null;
}

function resolveCustomFactLookup(snapshot, promptText) {
  const normalizedPrompt = normalizeMatchingText(promptText);
  if (!normalizedPrompt) return null;
  for (const entry of parseCustomFactEntries(snapshot)) {
    if (!entry.question) continue;
    if (normalizedPrompt.includes(entry.question) || entry.question.includes(normalizedPrompt)) {
      return {
        fieldKey: "extra_offline_facts",
        factLabel: entry.rawQuestion,
        factValue: entry.answer,
        hasValue: true,
      };
    }
  }
  return null;
}

function resolvePersonaFactLookup(snapshot, promptText) {
  const fixed = resolveFixedFactLookup(snapshot, promptText);
  if (fixed) return fixed;
  return resolveCustomFactLookup(snapshot, promptText);
}
function classifyOfflinePersonaIntent(promptText) {
  const normalized = normalizeLowerPrompt(promptText);
  if (!normalized) return PERSONA_INTENTS.unknown;
  if (/\b(what('?s| is) your name|who are you|your name)\b/.test(normalized)) {
    return PERSONA_INTENTS.identityName;
  }
  if (/\b(when('?s| is) your birthday|your birthday|when were you born)\b/.test(normalized)) {
    return PERSONA_INTENTS.identityBirthday;
  }
  if (/\b(do you have a nickname|nickname|nicknames|what can i call you|what should i call you)\b/.test(normalized)) {
    return PERSONA_INTENTS.identityNickname;
  }
  if (/\b(what happened recently|what happened between us|recent highlights|recently between us|what have we done recently)\b/.test(normalized)) {
    return PERSONA_INTENTS.recentHighlights;
  }
  if (/\b(what('?s| is) my name|who am i|what should you call me|what do you call me|my timezone|my time zone|your pronouns|your creature|your species|what type of creature are you|favorite color|favourite color|favorite movie|favourite movie|favorite song|favourite song|favorite book|favourite book|your hobby|what do you do for fun|your personality|your profile)\b/.test(normalized)) {
    return PERSONA_INTENTS.personaFact;
  }
  if (/\b(do you want to play|wanna play|want to play|play with me)\b/.test(normalized)) {
    return PERSONA_INTENTS.playInvite;
  }
  if (/\b(will you be my friend|are you my friend|do you want to be my friend)\b/.test(normalized)) {
    return PERSONA_INTENTS.friendship;
  }
  if (
    /\b(what day is it|what day is today|what day today|day of the week|what time is it|what's the time|whats the time|current time|time now|tell me the time|what month is it|what month is this|what year is it|what year is this|what date is it|what is today's date|what's today's date|whats today's date|today's date|todays date|current date|date today|date and time|time and date)\b/.test(
      normalized
    )
  ) {
    return PERSONA_INTENTS.timeContext;
  }
  if (/^(hi|hello|hey|yo)\b/.test(normalized)) return PERSONA_INTENTS.greeting;
  if (/\b(i am sad|i'm sad|lonely|anxious|worried|upset|stressed|bad day|overwhelmed)\b/.test(normalized)) {
    return PERSONA_INTENTS.comfort;
  }
  if (/\b(how are you|how are you doing|how you feeling|how do you feel|what are you doing|what's up|whats up|what are you up to|hows it going|how is it going|chat)\b/.test(normalized)) {
    return PERSONA_INTENTS.smalltalk;
  }
  return PERSONA_INTENTS.unknown;
}

function classifyTimeContextQuestion(promptText) {
  const normalized = normalizeLowerPrompt(promptText);
  if (!normalized) return "time";
  if (/\b(date and time|time and date)\b/.test(normalized)) return "datetime";
  if (/\b(what day is it|what day is today|what day today|day of the week)\b/.test(normalized)) {
    return "day";
  }
  if (
    /\b(what date is it|what is today's date|what's today's date|whats today's date|today's date|todays date|current date|date today)\b/.test(
      normalized
    )
  ) {
    return "date";
  }
  if (/\b(what month is it|what month is this|current month)\b/.test(normalized)) return "month";
  if (/\b(what year is it|what year is this|current year)\b/.test(normalized)) return "year";
  if (/\b(what time is it|what's the time|whats the time|current time|time now|tell me the time)\b/.test(normalized)) {
    return "time";
  }
  return "time";
}

function normalizeIntentForFallback(intent) {
  if (
    intent === PERSONA_INTENTS.identityName ||
    intent === PERSONA_INTENTS.identityBirthday ||
    intent === PERSONA_INTENTS.identityNickname ||
    intent === PERSONA_INTENTS.recentHighlights
  ) {
    return PERSONA_INTENTS.smalltalk;
  }
  if (intent === PERSONA_INTENTS.greeting) return PERSONA_INTENTS.greeting;
  if (intent === PERSONA_INTENTS.comfort) return PERSONA_INTENTS.comfort;
  if (intent === PERSONA_INTENTS.personaFact) return PERSONA_INTENTS.personaFact;
  if (intent === PERSONA_INTENTS.smalltalk) return PERSONA_INTENTS.smalltalk;
  if (intent === PERSONA_INTENTS.playInvite) return PERSONA_INTENTS.playInvite;
  if (intent === PERSONA_INTENTS.friendship) return PERSONA_INTENTS.friendship;
  if (intent === PERSONA_INTENTS.timeContext) return PERSONA_INTENTS.timeContext;
  return PERSONA_INTENTS.unknown;
}

function buildSnapshotFingerprint(snapshot) {
  const schemaVersion = toOptionalString(snapshot?.schemaVersion, PERSONA_SNAPSHOT_VERSION);
  const state = toOptionalString(snapshot?.state, PERSONA_STATES.degraded);
  const degradedReason = toOptionalString(snapshot?.degradedReason, "parse_incomplete");
  const petName = readSnapshotField(snapshot, "pet_name");
  const profileId = normalizePersonaProfileId(readSnapshotField(snapshot, "persona_profile_id"));
  const toneKeywords = readSnapshotFieldList(snapshot, "tone_keywords").sort().join(",");
  const favorites = [
    readSnapshotField(snapshot, "pet_favorite_color"),
    readSnapshotField(snapshot, "pet_favorite_movie"),
    readSnapshotField(snapshot, "pet_favorite_song"),
    readSnapshotField(snapshot, "pet_favorite_book"),
    readSnapshotField(snapshot, "pet_hobby"),
  ].filter(Boolean).join("|");
  return `${schemaVersion}|${state}|${degradedReason}|${petName}|${profileId}|${toneKeywords}|${favorites}`;
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

function sanitizeOutputText(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimToSentenceLimit(text, maxSentences = MAX_SENTENCES) {
  const normalized = sanitizeOutputText(text);
  if (!normalized) return "";
  const sentences = normalized.match(/[^.!?]+[.!?]?/g) || [normalized];
  const trimmed = sentences
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, maxSentences)
    .join(" ")
    .trim();
  return trimmed || normalized;
}

function truncateText(value, maxLength = MAX_REPLY_LENGTH) {
  const normalized = sanitizeOutputText(value);
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...`;
}

function countQuestionMarks(text) {
  return (String(text || "").match(/\?/g) || []).length;
}

function enforceReplyBounds(parts) {
  const next = {
    openerToken: toOptionalString(parts.openerToken, ""),
    coreText: toOptionalString(parts.coreText, ""),
    optionalFollowUp: toOptionalString(parts.optionalFollowUp, ""),
    closerToken: toOptionalString(parts.closerToken, ""),
  };

  const compose = () =>
    [next.openerToken, next.coreText, next.optionalFollowUp, next.closerToken]
      .filter(Boolean)
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();

  let text = compose();
  if (countQuestionMarks(text) > MAX_FOLLOW_UP_QUESTIONS) {
    next.optionalFollowUp = "";
    text = compose();
  }
  text = trimToSentenceLimit(text, MAX_SENTENCES);
  if (text.length > MAX_REPLY_LENGTH) {
    next.optionalFollowUp = "";
    text = trimToSentenceLimit(compose(), MAX_SENTENCES);
  }
  if (text.length > MAX_REPLY_LENGTH) {
    next.closerToken = "";
    text = trimToSentenceLimit(compose(), MAX_SENTENCES);
  }
  text = truncateText(text, MAX_REPLY_LENGTH);
  return { text, openerToken: next.openerToken, optionalFollowUp: next.optionalFollowUp, closerToken: next.closerToken };
}

function resolveTimeZoneLabel(snapshot) {
  const preferred = toOptionalString(readSnapshotField(snapshot, "companion_timezone"), "");
  if (!preferred) {
    return toOptionalString(Intl.DateTimeFormat().resolvedOptions().timeZone, "Local time");
  }
  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat("en-US", { timeZone: preferred });
    return preferred;
  } catch {
    return toOptionalString(Intl.DateTimeFormat().resolvedOptions().timeZone, "Local time");
  }
}

function formatTimeComponent(nowMs, timeZone, options, fallbackValue) {
  const safeNow = Number.isFinite(Number(nowMs)) ? Math.max(0, Math.round(Number(nowMs))) : Date.now();
  try {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(new Date(safeNow));
  } catch {
    return fallbackValue;
  }
}

function buildLocalTimeContext(snapshot, nowMs) {
  const timeZone = resolveTimeZoneLabel(snapshot);
  return {
    localTimeZone: timeZone,
    localDayOfWeek: formatTimeComponent(nowMs, timeZone, { weekday: "long" }, "today"),
    localDateLabel: formatTimeComponent(nowMs, timeZone, { month: "long", day: "numeric", year: "numeric" }, "today"),
    localMonthYear: formatTimeComponent(nowMs, timeZone, { month: "long", year: "numeric" }, "this month"),
    localMonthLabel: formatTimeComponent(nowMs, timeZone, { month: "long" }, "this month"),
    localYearLabel: formatTimeComponent(nowMs, timeZone, { year: "numeric" }, "this year"),
    localTimeLabel: formatTimeComponent(nowMs, timeZone, { hour: "numeric", minute: "2-digit" }, "now"),
    localTimeWithZone: formatTimeComponent(
      nowMs,
      timeZone,
      { hour: "numeric", minute: "2-digit", timeZoneName: "short" },
      "now"
    ),
  };
}

function buildInterestCandidates(snapshot) {
  const candidates = [];
  const pushInterest = (label, value) => {
    const normalized = normalizeSummary(value, 80, "");
    if (!normalized) return;
    candidates.push(`${label} ${normalized}`);
  };
  pushInterest("favorite color", readSnapshotField(snapshot, "pet_favorite_color"));
  pushInterest("favorite movie", readSnapshotField(snapshot, "pet_favorite_movie"));
  pushInterest("favorite song", readSnapshotField(snapshot, "pet_favorite_song"));
  pushInterest("favorite book", readSnapshotField(snapshot, "pet_favorite_book"));
  pushInterest("hobby", readSnapshotField(snapshot, "pet_hobby"));
  for (const custom of parseCustomFactEntries(snapshot).slice(0, 8)) {
    pushInterest(custom.rawQuestion, custom.answer);
  }
  return candidates;
}
function buildPersonaResponseContext(options = {}) {
  const snapshot = options.personaSnapshot && typeof options.personaSnapshot === "object" ? options.personaSnapshot : null;
  const petName = readSnapshotField(snapshot, "pet_name") || "friend";
  const currentState = normalizeState(options.currentState, "Idle");
  const phase = toOptionalString(options.phase, "");
  const factLabel = normalizeSummary(options.factLabel, 72, "that detail");
  const factValue = normalizeSummary(options.factValue, 96, "unavailable");
  const nowMs = Number.isFinite(Number(options.ts)) ? Math.max(0, Math.round(Number(options.ts))) : Date.now();
  const timeContext = buildLocalTimeContext(snapshot, nowMs);
  const interestSummary = normalizeSummary(options.interestSummary, 96, "local interests");
  return {
    petName,
    currentState,
    phaseSuffix: phase ? `/${phase}` : "",
    stateDescription: normalizeSummary(options.stateDescription, 140, "I am keeping to local routines."),
    stateContextSummary: normalizeSummary(options.stateContextSummary, 140, "local context only"),
    userPrompt: normalizeSummary(options.promptText, 120, "your message"),
    factLabel,
    factValue,
    interestSummary,
    ...timeContext,
  };
}

function resolvePersonaProfile(profileId) {
  if (!profileId || profileId === PERSONA_MODES.neutralFallback || profileId === PERSONA_MODES.steadyCompanion) {
    return null;
  }
  return PERSONA_PROFILES[profileId] || null;
}

function resolveIntentTemplates(intent, personaMode) {
  const profile = resolvePersonaProfile(personaMode);
  const fromProfile = profile?.offlineVoice?.intentTemplates?.[intent];
  if (Array.isArray(fromProfile) && fromProfile.length > 0) return fromProfile;
  return DEFAULT_INTENT_TEMPLATES[intent] || DEFAULT_INTENT_TEMPLATES.unknown;
}

function resolveProactiveTemplates(flavor, personaMode) {
  const profile = resolvePersonaProfile(personaMode);
  const fromProfile = profile?.offlineVoice?.proactiveTemplates?.[flavor];
  if (Array.isArray(fromProfile) && fromProfile.length > 0) return fromProfile;
  return DEFAULT_PROACTIVE_TEMPLATES[flavor] || DEFAULT_PROACTIVE_TEMPLATES.checkin;
}

function buildPersonaAwareOfflineFallbackResponse(options = {}) {
  const normalizedPrompt = normalizePrompt(options.promptText);
  const snapshot = options.personaSnapshot && typeof options.personaSnapshot === "object" ? options.personaSnapshot : null;
  const styleProfile = buildStyleProfileFromPersonaSnapshot(snapshot);
  const personaMode = selectPersonaMode(styleProfile);
  const personaFact = resolvePersonaFactLookup(snapshot, normalizedPrompt);
  const rawIntent = classifyOfflinePersonaIntent(normalizedPrompt);
  let intent = normalizeIntentForFallback(rawIntent);
  if (rawIntent === PERSONA_INTENTS.personaFact && personaFact?.hasValue) {
    intent = PERSONA_INTENTS.personaFact;
  } else if (rawIntent === PERSONA_INTENTS.personaFact && !personaFact?.hasValue) {
    intent = PERSONA_INTENTS.unknown;
  }
  const variationKey = toOptionalString(options.variationKey, "");
  const timeContextKind = intent === PERSONA_INTENTS.timeContext ? classifyTimeContextQuestion(normalizedPrompt) : "";
  const snapshotFingerprint = buildSnapshotFingerprint(snapshot);
  const personaReason = styleProfile.personaState === PERSONA_STATES.ready ? "none" : styleProfile.personaReason;
  const selectionKey = `${intent}|${normalizedPrompt.toLowerCase()}|${snapshotFingerprint}|${personaReason}|${personaMode}|${variationKey}`;
  const selectionHash = hashHex(selectionKey);
  const interestCandidates = buildInterestCandidates(snapshot);
  const selectedInterest = pickDeterministic(interestCandidates, `${selectionKey}|interest`) || "local interests";

  const context = buildPersonaResponseContext({
    ...options,
    promptText: normalizedPrompt,
    personaSnapshot: snapshot,
    factLabel: personaFact?.factLabel,
    factValue:
      personaFact?.fieldKey === "persona_profile_id" && personaFact?.factValue
        ? PERSONA_PROFILES[normalizePersonaProfileId(personaFact.factValue)]?.label || personaFact.factValue
        : personaFact?.factValue,
    interestSummary: selectedInterest,
  });

  const openerOptions =
    intent === PERSONA_INTENTS.timeContext
      ? Object.freeze([""])
      : OPENER_TOKENS[styleProfile.openerStyle] || OPENER_TOKENS.direct;
  const closerOptions =
    intent === PERSONA_INTENTS.timeContext
      ? Object.freeze([""])
      : CLOSER_TOKENS[styleProfile.closerStyle] || CLOSER_TOKENS.none;
  const followUpOptions =
    intent === PERSONA_INTENTS.timeContext
      ? []
      : (styleProfile.curiosity === "high" || intent === PERSONA_INTENTS.comfort) && intent !== PERSONA_INTENTS.personaFact
      ? FOLLOW_UP_TOKENS[intent] || FOLLOW_UP_TOKENS.unknown
      : [];
  const coreTemplates =
    intent === PERSONA_INTENTS.timeContext
      ? TIME_CONTEXT_TEMPLATES[timeContextKind] || TIME_CONTEXT_TEMPLATES.time
      : resolveIntentTemplates(intent, personaMode);

  const openerToken = pickDeterministic(openerOptions, `${selectionKey}|opener`);
  const coreTemplate = pickDeterministic(coreTemplates, `${selectionKey}|core`);
  const optionalFollowUp = pickDeterministic(followUpOptions, `${selectionKey}|follow`);
  let closerToken = pickDeterministic(closerOptions, `${selectionKey}|closer`);
  if (styleProfile.emojiPolicy === "light") {
    closerToken = `${closerToken}${closerToken ? " " : ""}:)`;
  }

  let coreText = interpolateTemplate(coreTemplate, context);
  if (styleProfile.personaState !== PERSONA_STATES.ready && intent !== PERSONA_INTENTS.timeContext) {
    const reasonLabel = humanizeReason(styleProfile.personaReason);
    coreText = `${coreText} I am using neutral offline tone while persona context recovers (${reasonLabel}).`;
  }

  const bounded = enforceReplyBounds({ openerToken, coreText, optionalFollowUp, closerToken });
  const evidenceTags = ["persona.tone", "offline.reply", `persona.intent.${intent}`];
  if (intent === PERSONA_INTENTS.personaFact && personaFact?.fieldKey) {
    evidenceTags.push(`persona.fact.${personaFact.fieldKey}`);
  }

  return {
    kind: "offlinePersonaReply",
    ts: Number.isFinite(Number(options.ts)) ? Math.max(0, Math.round(Number(options.ts))) : Date.now(),
    source: "offline",
    fallbackMode: styleProfile.personaState === PERSONA_STATES.ready ? "offline_persona_dialog" : "offline_persona_dialog_degraded",
    triggerReason: intent,
    templateKey: `${intent}:${personaMode}`,
    currentState: context.currentState,
    phase: toOptionalString(options.phase, null),
    stateContextSummary: context.stateContextSummary,
    text: bounded.text,
    personaSnapshotVersion: toOptionalString(snapshot?.schemaVersion, PERSONA_SNAPSHOT_VERSION),
    personaState: styleProfile.personaState,
    personaReason,
    personaMode,
    styleProfile: {
      warmth: styleProfile.warmth,
      playfulness: styleProfile.playfulness,
      curiosity: styleProfile.curiosity,
      verbosity: styleProfile.verbosity,
      emojiPolicy: styleProfile.emojiPolicy,
      addressStyle: styleProfile.addressStyle,
      openerStyle: styleProfile.openerStyle,
      closerStyle: styleProfile.closerStyle,
      toneKeywords: Array.isArray(styleProfile.toneKeywords) ? styleProfile.toneKeywords.slice(0, MAX_TONE_KEYWORDS) : [],
      personaProfileId: normalizePersonaProfileId(styleProfile.personaProfileId),
    },
    intent,
    factFieldKey: intent === PERSONA_INTENTS.personaFact ? personaFact?.fieldKey || "" : "",
    factLabel: intent === PERSONA_INTENTS.personaFact ? personaFact?.factLabel || "" : "",
    factResolved: Boolean(intent === PERSONA_INTENTS.personaFact && personaFact?.hasValue),
    timeContextKind,
    variationKey,
    selectionHash,
    openerToken: bounded.openerToken,
    coreTemplate,
    optionalFollowUp: bounded.optionalFollowUp,
    closerToken: bounded.closerToken,
    evidenceTags,
  };
}

function buildPersonaAwareProactivePrompt(options = {}) {
  const snapshot = options.personaSnapshot && typeof options.personaSnapshot === "object" ? options.personaSnapshot : null;
  const styleProfile = buildStyleProfileFromPersonaSnapshot(snapshot);
  const personaMode = selectPersonaMode(styleProfile);
  const reason = toOptionalString(options.reason, "proactive_conversation");
  const backoffTier = Number.isFinite(Number(options.backoffTier)) ? Math.max(0, Math.round(Number(options.backoffTier))) : 0;
  const tsMs = Number.isFinite(Number(options.ts)) ? Math.max(0, Math.round(Number(options.ts))) : Date.now();
  const tsBucket = Math.max(0, Math.floor(tsMs / 60000));
  const snapshotFingerprint = buildSnapshotFingerprint(snapshot);
  const interestCandidates = buildInterestCandidates(snapshot);
  const promptFlavor = interestCandidates.length > 0 && tsBucket % 2 === 1 ? "interest" : "checkin";
  const selectionKey = `${reason}|${snapshotFingerprint}|${backoffTier}|${toOptionalString(options.lastOpenerHash, "none")}|${personaMode}|${promptFlavor}|${tsBucket}`;
  const selectedInterest = pickDeterministic(interestCandidates, `${selectionKey}|interest`) || "local interests";
  const proactiveTemplates = resolveProactiveTemplates(promptFlavor, personaMode);
  const context = buildPersonaResponseContext({ ...options, ts: tsMs, personaSnapshot: snapshot, interestSummary: selectedInterest });

  const openerToken = pickDeterministic(OPENER_TOKENS[styleProfile.openerStyle] || OPENER_TOKENS.direct, `${selectionKey}|opener`);
  const coreTemplate = pickDeterministic(proactiveTemplates, `${selectionKey}|core`);
  const closerToken = pickDeterministic(CLOSER_TOKENS[styleProfile.closerStyle] || CLOSER_TOKENS.none, `${selectionKey}|closer`);
  const bounded = enforceReplyBounds({
    openerToken,
    coreText: interpolateTemplate(coreTemplate, context),
    optionalFollowUp: "",
    closerToken: styleProfile.emojiPolicy === "light" ? `${closerToken}${closerToken ? " " : ""}:)` : closerToken,
  });
  const openerHash = hashHex(`${reason}|${bounded.text.toLowerCase()}`);

  return {
    text: bounded.text,
    openerHash,
    reason,
    promptFlavor,
    personaSnapshotVersion: toOptionalString(snapshot?.schemaVersion, PERSONA_SNAPSHOT_VERSION),
    personaState: styleProfile.personaState,
    personaReason: styleProfile.personaState === PERSONA_STATES.ready ? "none" : styleProfile.personaReason,
    personaMode,
    styleProfile: {
      warmth: styleProfile.warmth,
      playfulness: styleProfile.playfulness,
      curiosity: styleProfile.curiosity,
      verbosity: styleProfile.verbosity,
      emojiPolicy: styleProfile.emojiPolicy,
      addressStyle: styleProfile.addressStyle,
      openerStyle: styleProfile.openerStyle,
      closerStyle: styleProfile.closerStyle,
      toneKeywords: Array.isArray(styleProfile.toneKeywords) ? styleProfile.toneKeywords.slice(0, MAX_TONE_KEYWORDS) : [],
      personaProfileId: normalizePersonaProfileId(styleProfile.personaProfileId),
    },
    selectionHash: hashHex(selectionKey),
  };
}

module.exports = {
  PERSONA_INTENTS,
  PERSONA_MODES,
  PERSONA_STATES,
  MAX_REPLY_LENGTH,
  buildPersonaAwareOfflineFallbackResponse,
  buildPersonaAwareProactivePrompt,
  buildStyleProfileFromPersonaSnapshot,
  classifyOfflinePersonaIntent,
  resolvePersonaFactLookup,
  fnv1a32,
  hashHex,
};
