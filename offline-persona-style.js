"use strict";

const PERSONA_SNAPSHOT_VERSION = "vp-persona-snapshot-v1";
const MAX_REPLY_LENGTH = 220;
const MAX_SENTENCES = 2;
const MAX_FOLLOW_UP_QUESTIONS = 1;
const MAX_TONE_KEYWORDS = 6;

const PERSONA_STATES = Object.freeze({
  ready: "ready",
  degraded: "degraded",
});

const PERSONA_INTENTS = Object.freeze({
  identityName: "identity_name",
  identityBirthday: "identity_birthday",
  identityNickname: "identity_nickname",
  recentHighlights: "recent_highlights",
  personaFact: "persona_fact",
  greeting: "greeting",
  comfort: "comfort",
  smalltalk: "smalltalk",
  unknown: "unknown",
});

const PERSONA_MODES = Object.freeze({
  gentleHelper: "gentle_helper",
  playfulFriend: "playful_friend",
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
  supportive_note: Object.freeze([
    "I am here with you.",
    "I can stay with you here.",
  ]),
});

const FOLLOW_UP_TOKENS = Object.freeze({
  greeting: Object.freeze(["How is your day going?", "How are you feeling today?"]),
  comfort: Object.freeze([
    "Want me to keep things calm for a bit?",
    "Do you want a gentle check-in in a little while?",
  ]),
  smalltalk: Object.freeze([
    "Want a quick status recap too?",
    "Want to hear a short local highlight?",
  ]),
  unknown: Object.freeze(["I can still chat with local context here."]),
});

const CORE_TEMPLATES = Object.freeze({
  greeting: Object.freeze({
    gentle_helper: Object.freeze([
      "I am {petName}, and I am in {currentState}{phaseSuffix}. {stateDescription}",
      "I am here in {currentState}{phaseSuffix}. {stateContextSummary}",
    ]),
    playful_friend: Object.freeze([
      "I am {petName} in {currentState}{phaseSuffix}, keeping local vibes steady.",
      "I am hanging out in {currentState}{phaseSuffix}. {stateDescription}",
    ]),
    steady_companion: Object.freeze([
      "I am in {currentState}{phaseSuffix}. {stateDescription}",
      "I am here in {currentState}{phaseSuffix}. {stateContextSummary}",
    ]),
    neutral_fallback: Object.freeze([
      "I am in {currentState}{phaseSuffix}, using local context only.",
      "Local context says {stateContextSummary}.",
    ]),
  }),
  comfort: Object.freeze({
    gentle_helper: Object.freeze([
      "Thanks for telling me. I am staying calm in {currentState}{phaseSuffix}.",
      "I am right here with you in {currentState}{phaseSuffix}.",
    ]),
    playful_friend: Object.freeze([
      "I am here with you. We can keep it light and steady from {currentState}{phaseSuffix}.",
      "You are not alone here. I am nearby in {currentState}{phaseSuffix}.",
    ]),
    steady_companion: Object.freeze([
      "I am here and listening in {currentState}{phaseSuffix}.",
      "I can stay close and quiet in {currentState}{phaseSuffix}.",
    ]),
    neutral_fallback: Object.freeze([
      "I can stay with you in local mode from {currentState}{phaseSuffix}.",
      "I am here in local context and can keep a steady pace.",
    ]),
  }),
  smalltalk: Object.freeze({
    gentle_helper: Object.freeze([
      "{stateDescription}",
      "I am in {currentState}{phaseSuffix}, and local context is {stateContextSummary}.",
    ]),
    playful_friend: Object.freeze([
      "I am in {currentState}{phaseSuffix}, keeping a bright local rhythm.",
      "{stateDescription}",
    ]),
    steady_companion: Object.freeze([
      "I am in {currentState}{phaseSuffix}. {stateDescription}",
      "Local context: {stateContextSummary}.",
    ]),
    neutral_fallback: Object.freeze([
      "I am in {currentState}{phaseSuffix}, using local fallback context.",
      "I can answer from local context only right now.",
    ]),
  }),
  persona_fact: Object.freeze({
    gentle_helper: Object.freeze([
      "From local persona notes, {factLabel} is {factValue}.",
      "I have that in local context: {factLabel} is {factValue}.",
    ]),
    playful_friend: Object.freeze([
      "From our local notes: {factLabel} is {factValue}.",
      "Yep, local memory says {factLabel} is {factValue}.",
    ]),
    steady_companion: Object.freeze([
      "Local persona context says {factLabel} is {factValue}.",
      "I have that offline: {factLabel} is {factValue}.",
    ]),
    neutral_fallback: Object.freeze([
      "Local context says {factLabel} is {factValue}.",
      "I can confirm offline: {factLabel} is {factValue}.",
    ]),
  }),
  unknown: Object.freeze({
    gentle_helper: Object.freeze([
      "I might not have a perfect local answer yet, but I can still chat from {currentState}{phaseSuffix}.",
      "I am still learning this offline, and I am here with local context.",
    ]),
    playful_friend: Object.freeze([
      "I do not fully know that offline yet, but I can still hang out and chat.",
      "That one is not in local memory yet, but I am still here to talk.",
    ]),
    steady_companion: Object.freeze([
      "I do not have that in local memory yet. I can still share local context.",
      "That detail is not in local memory yet, but I can keep chatting.",
    ]),
    neutral_fallback: Object.freeze([
      "That detail is unavailable offline right now.",
      "I can only use bounded local context for that right now.",
    ]),
  }),
});

const PROACTIVE_CORE_TEMPLATES = Object.freeze({
  gentle_helper: Object.freeze([
    "Want a short gentle chat check-in?",
    "I can do a quick calm check-in if you want.",
  ]),
  playful_friend: Object.freeze([
    "Want a quick chat break?",
    "Want a tiny chat moment together?",
  ]),
  steady_companion: Object.freeze([
    "Want to chat for a minute?",
    "I am ready if you want a quick chat.",
  ]),
  neutral_fallback: Object.freeze([
    "I am available for a short local chat.",
    "I can do a quick local check-in.",
  ]),
});

const FACT_LOOKUP_RULES = Object.freeze([
  Object.freeze({
    fieldKey: "companion_name",
    factLabel: "your name",
    patterns: Object.freeze([/\b(what('?s| is) my name|who am i)\b/]),
  }),
  Object.freeze({
    fieldKey: "companion_call_name",
    factLabel: "what I should call you",
    patterns: Object.freeze([
      /\b(what should you call me|what do you call me|my call name|my preferred name)\b/,
    ]),
  }),
  Object.freeze({
    fieldKey: "companion_timezone",
    factLabel: "your timezone",
    patterns: Object.freeze([/\b(my timezone|my time zone|timezone am i in|time zone am i in)\b/]),
  }),
  Object.freeze({
    fieldKey: "pet_creature",
    factLabel: "my creature type",
    patterns: Object.freeze([/\b(your creature|your species|what type of creature are you)\b/]),
  }),
  Object.freeze({
    fieldKey: "pet_pronouns",
    factLabel: "my pronouns",
    patterns: Object.freeze([/\b(your pronouns|what are your pronouns)\b/]),
  }),
]);

function toOptionalString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizePrompt(value) {
  return toOptionalString(value, "")
    .replace(/\s+/g, " ")
    .trim();
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
    return field.value
      .map((entry) => toOptionalString(entry, ""))
      .filter(Boolean)
      .join(", ");
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

function buildStyleProfileFromPersonaSnapshot(snapshot) {
  const personaState =
    toOptionalString(snapshot?.state, PERSONA_STATES.degraded).toLowerCase() === PERSONA_STATES.ready
      ? PERSONA_STATES.ready
      : PERSONA_STATES.degraded;
  const personaReason =
    toOptionalString(snapshot?.degradedReason, "parse_incomplete") || "parse_incomplete";
  const toneKeywords = readSnapshotFieldList(snapshot, "tone_keywords").sort();

  const profile = {
    warmth: deriveLevel(toneKeywords, TONE_BUCKETS.warmth, {
      highThreshold: 1,
      mediumThreshold: 1,
    }),
    playfulness: deriveLevel(toneKeywords, TONE_BUCKETS.playfulness, {
      highThreshold: 1,
      mediumThreshold: 1,
    }),
    curiosity: deriveLevel(toneKeywords, TONE_BUCKETS.curiosity, {
      highThreshold: 1,
      mediumThreshold: 1,
    }),
    verbosity: deriveVerbosity(toneKeywords),
    emojiPolicy: "none",
    addressStyle: deriveAddressStyle(snapshot),
    openerStyle: "direct",
    closerStyle: "none",
    toneKeywords: toneKeywords.slice(0, MAX_TONE_KEYWORDS),
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
  if (styleProfile.playfulness === "high") return PERSONA_MODES.playfulFriend;
  if (styleProfile.warmth === "high") return PERSONA_MODES.gentleHelper;
  return PERSONA_MODES.steadyCompanion;
}

function resolvePersonaFactLookup(snapshot, promptText) {
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

function classifyOfflinePersonaIntent(promptText) {
  const normalized = normalizeLowerPrompt(promptText);
  if (!normalized) return PERSONA_INTENTS.unknown;
  if (/\b(what('?s| is) your name|who are you|your name)\b/.test(normalized)) {
    return PERSONA_INTENTS.identityName;
  }
  if (/\b(when('?s| is) your birthday|your birthday|when were you born)\b/.test(normalized)) {
    return PERSONA_INTENTS.identityBirthday;
  }
  if (
    /\b(do you have a nickname|nickname|nicknames|what can i call you|what should i call you)\b/.test(
      normalized
    )
  ) {
    return PERSONA_INTENTS.identityNickname;
  }
  if (
    /\b(what happened recently|what happened between us|recent highlights|recently between us|what have we done recently)\b/.test(
      normalized
    )
  ) {
    return PERSONA_INTENTS.recentHighlights;
  }
  if (
    /\b(what('?s| is) my name|who am i|what should you call me|what do you call me|my timezone|my time zone|your pronouns|your creature|your species|what type of creature are you)\b/.test(
      normalized
    )
  ) {
    return PERSONA_INTENTS.personaFact;
  }
  if (/^(hi|hello|hey|yo)\b/.test(normalized)) return PERSONA_INTENTS.greeting;
  if (
    /\b(i am sad|i'm sad|lonely|anxious|worried|upset|stressed|bad day|overwhelmed)\b/.test(
      normalized
    )
  ) {
    return PERSONA_INTENTS.comfort;
  }
  if (
    /\b(how are you|what are you doing|what's up|hows it going|how is it going|chat)\b/.test(
      normalized
    )
  ) {
    return PERSONA_INTENTS.smalltalk;
  }
  return PERSONA_INTENTS.unknown;
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
  return PERSONA_INTENTS.unknown;
}

function buildSnapshotFingerprint(snapshot) {
  const schemaVersion = toOptionalString(snapshot?.schemaVersion, PERSONA_SNAPSHOT_VERSION);
  const state = toOptionalString(snapshot?.state, PERSONA_STATES.degraded);
  const degradedReason = toOptionalString(snapshot?.degradedReason, "parse_incomplete");
  const petName = readSnapshotField(snapshot, "pet_name");
  const toneKeywords = readSnapshotFieldList(snapshot, "tone_keywords").sort().join(",");
  return `${schemaVersion}|${state}|${degradedReason}|${petName}|${toneKeywords}`;
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
  return {
    text,
    openerToken: next.openerToken,
    optionalFollowUp: next.optionalFollowUp,
    closerToken: next.closerToken,
  };
}

function buildPersonaResponseContext(options = {}) {
  const snapshot = options.personaSnapshot && typeof options.personaSnapshot === "object"
    ? options.personaSnapshot
    : null;
  const petName = readSnapshotField(snapshot, "pet_name") || "friend";
  const currentState = normalizeState(options.currentState, "Idle");
  const phase = toOptionalString(options.phase, "");
  const factLabel = normalizeSummary(options.factLabel, 72, "that detail");
  const factValue = normalizeSummary(options.factValue, 96, "unavailable");
  return {
    petName,
    currentState,
    phaseSuffix: phase ? `/${phase}` : "",
    stateDescription: normalizeSummary(options.stateDescription, 140, "I am keeping to local routines."),
    stateContextSummary: normalizeSummary(options.stateContextSummary, 140, "local context only"),
    userPrompt: normalizeSummary(options.promptText, 120, "your message"),
    factLabel,
    factValue,
  };
}

function buildPersonaAwareOfflineFallbackResponse(options = {}) {
  const normalizedPrompt = normalizePrompt(options.promptText);
  const snapshot = options.personaSnapshot && typeof options.personaSnapshot === "object"
    ? options.personaSnapshot
    : null;
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
  const snapshotFingerprint = buildSnapshotFingerprint(snapshot);
  const personaReason = styleProfile.personaState === PERSONA_STATES.ready ? "none" : styleProfile.personaReason;
  const selectionKey = `${intent}|${normalizedPrompt.toLowerCase()}|${snapshotFingerprint}|${personaReason}|${personaMode}|${variationKey}`;
  const selectionHash = hashHex(selectionKey);
  const context = buildPersonaResponseContext({
    ...options,
    promptText: normalizedPrompt,
    personaSnapshot: snapshot,
    factLabel: personaFact?.factLabel,
    factValue: personaFact?.factValue,
  });

  const openerOptions = OPENER_TOKENS[styleProfile.openerStyle] || OPENER_TOKENS.direct;
  const closerOptions = CLOSER_TOKENS[styleProfile.closerStyle] || CLOSER_TOKENS.none;
  const followUpOptions =
    (styleProfile.curiosity === "high" || intent === PERSONA_INTENTS.comfort) &&
    intent !== PERSONA_INTENTS.personaFact
      ? FOLLOW_UP_TOKENS[intent] || FOLLOW_UP_TOKENS.unknown
      : [];
  const coreTemplatesForIntent = CORE_TEMPLATES[intent] || CORE_TEMPLATES.unknown;
  const coreTemplates =
    coreTemplatesForIntent[personaMode] || coreTemplatesForIntent[PERSONA_MODES.neutralFallback];

  const openerToken = pickDeterministic(openerOptions, `${selectionKey}|opener`);
  const coreTemplate = pickDeterministic(coreTemplates, `${selectionKey}|core`);
  const optionalFollowUp = pickDeterministic(followUpOptions, `${selectionKey}|follow`);
  let closerToken = pickDeterministic(closerOptions, `${selectionKey}|closer`);
  if (styleProfile.emojiPolicy === "light") {
    closerToken = `${closerToken}${closerToken ? " " : ""}:)`;
  }

  let coreText = interpolateTemplate(coreTemplate, context);
  if (styleProfile.personaState !== PERSONA_STATES.ready) {
    const reasonLabel = humanizeReason(styleProfile.personaReason);
    coreText = `${coreText} I am using neutral offline tone while persona context recovers (${reasonLabel}).`;
  }

  const bounded = enforceReplyBounds({
    openerToken,
    coreText,
    optionalFollowUp,
    closerToken,
  });
  const evidenceTags = ["persona.tone", "offline.reply", `persona.intent.${intent}`];
  if (intent === PERSONA_INTENTS.personaFact && personaFact?.fieldKey) {
    evidenceTags.push(`persona.fact.${personaFact.fieldKey}`);
  }

  return {
    kind: "offlinePersonaReply",
    ts: Number.isFinite(Number(options.ts)) ? Math.max(0, Math.round(Number(options.ts))) : Date.now(),
    source: "offline",
    fallbackMode:
      styleProfile.personaState === PERSONA_STATES.ready
        ? "offline_persona_dialog"
        : "offline_persona_dialog_degraded",
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
    },
    intent,
    factFieldKey: intent === PERSONA_INTENTS.personaFact ? personaFact?.fieldKey || "" : "",
    factLabel: intent === PERSONA_INTENTS.personaFact ? personaFact?.factLabel || "" : "",
    factResolved: Boolean(intent === PERSONA_INTENTS.personaFact && personaFact?.hasValue),
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
  const snapshot = options.personaSnapshot && typeof options.personaSnapshot === "object"
    ? options.personaSnapshot
    : null;
  const styleProfile = buildStyleProfileFromPersonaSnapshot(snapshot);
  const personaMode = selectPersonaMode(styleProfile);
  const reason = toOptionalString(options.reason, "proactive_conversation");
  const backoffTier = Number.isFinite(Number(options.backoffTier))
    ? Math.max(0, Math.round(Number(options.backoffTier)))
    : 0;
  const tsBucket = Number.isFinite(Number(options.ts))
    ? Math.max(0, Math.floor(Number(options.ts) / 60000))
    : 0;
  const snapshotFingerprint = buildSnapshotFingerprint(snapshot);
  const selectionKey = `${reason}|${snapshotFingerprint}|${backoffTier}|${toOptionalString(options.lastOpenerHash, "none")}|${personaMode}|${tsBucket}`;
  const openerToken = pickDeterministic(
    OPENER_TOKENS[styleProfile.openerStyle] || OPENER_TOKENS.direct,
    `${selectionKey}|opener`
  );
  const coreTemplate = pickDeterministic(
    PROACTIVE_CORE_TEMPLATES[personaMode] || PROACTIVE_CORE_TEMPLATES.neutral_fallback,
    `${selectionKey}|core`
  );
  const closerToken = pickDeterministic(
    CLOSER_TOKENS[styleProfile.closerStyle] || CLOSER_TOKENS.none,
    `${selectionKey}|closer`
  );
  const bounded = enforceReplyBounds({
    openerToken,
    coreText: coreTemplate,
    optionalFollowUp: "",
    closerToken: styleProfile.emojiPolicy === "light" ? `${closerToken}${closerToken ? " " : ""}:)` : closerToken,
  });
  const openerHash = hashHex(`${reason}|${bounded.text.toLowerCase()}`);

  return {
    text: bounded.text,
    openerHash,
    reason,
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
