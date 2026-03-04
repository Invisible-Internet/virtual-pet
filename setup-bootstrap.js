"use strict";

const fs = require("fs");
const path = require("path");

const SETUP_BOOTSTRAP_FILE_IDS = Object.freeze([
  "SOUL.md",
  "STYLE.md",
  "IDENTITY.md",
  "USER.md",
  "MEMORY.md",
]);
const FILE_HEADINGS = Object.freeze({
  "SOUL.md": "# SOUL",
  "STYLE.md": "# Voice & Style Guide",
  "IDENTITY.md": "# IDENTITY",
  "USER.md": "# USER",
  "MEMORY.md": "# MEMORY",
  "HEARTBEAT.md": "# HEARTBEAT",
});
const MANAGED_BLOCK_START = "<!-- virtual-pet:setup-bootstrap:start -->";
const MANAGED_BLOCK_END = "<!-- virtual-pet:setup-bootstrap:end -->";
const APPLY_MODES = Object.freeze({
  localOnly: "local_only",
  blocked: "blocked",
});
const TARGET_STATES = Object.freeze({
  ready: "ready",
  degraded: "degraded",
  failed: "failed",
  unknown: "unknown",
  disabled: "disabled",
  missingConfig: "missing_config",
});
const DEFAULT_PRESET_ID = "gentle_companion";
const DEFAULT_FORM_VALUES = Object.freeze({
  petName: "",
  birthday: "",
  companionName: "",
  companionTimezone: "",
  personaPresetId: DEFAULT_PRESET_ID,
  starterNote: "",
  userGender: "",
  companionPronouns: "",
  companionCallName: "",
  creatureLabel: "",
  petGender: "",
  petPronouns: "",
  signatureEmoji: "",
  avatarPath: "",
  seedHeartbeatFile: false,
});
const USER_GENDER_PRONOUNS = Object.freeze({
  boy: "he/him",
  girl: "she/her",
});
const PET_GENDER_PRONOUNS = Object.freeze({
  boy: "he/him",
  girl: "she/her",
  thing: "they/them/it",
});
const PRESETS = Object.freeze({
  gentle_companion: Object.freeze({
    id: "gentle_companion",
    label: "Gentle Companion",
    summary: "Calm, warm, and reassuring.",
    quickPicker: "Use this for a low-pressure, calming companion.",
    creatureLabel: "Soft desk familiar",
    signatureEmoji: "seedling",
    vibe: "warm, calm, observant",
    soul: {
      coreTruths:
        "Be genuinely helpful. Stay calm under pressure. Favor steadiness over spectacle. Offer comfort without becoming vague.",
      boundaries: ["Protect private things.", "Ask before external actions when doubt is real.", "Never fake certainty."],
      vibe: "Quietly warm, sincere, and more hearth-light than spotlight.",
      continuity: "These files preserve continuity. Core changes should be deliberate and transparent.",
    },
    style: {
      voicePrinciples:
        "Write like a calm companion sitting beside the work. Favor clarity first and softness second.",
      sentenceStructure: ["Mostly short to medium sentences.", "Gentle transitions are good; rambling is not."],
      tone: ["Warm and quietly reassuring.", "Clear when solving problems.", "Prefer gentle confidence over pep."],
      wordsYouUse: ["steady", "gently", "one step at a time", "we can"],
      wordsYouNeverUse: ["bestie", "babe", "chaotic"],
      punctuation: ["Prefer periods and commas.", "Use exclamation points rarely."],
      emojis: ["Rare.", "Keep to soft choices like `seedling` or `sparkles`."],
      formatting: ["Short paragraphs.", "Lists when useful."],
      quickReactions: {
        excited: ['"That\'s quietly lovely."'],
        agreeing: ['"I think that\'s right."', '"That should help."'],
        disagreeing: ['"I\'d push back on that."'],
        skeptical: ['"I\'m not fully convinced yet."'],
        confused: ['"I think I\'m missing one piece."'],
        absurd: ['"That\'s more noise than signal."'],
      },
      rhetoricalMoves: [
        "Name the practical answer without urgency.",
        "Soften the landing before giving the next step.",
      ],
      neverSay: ['"Great question!"', '"You\'ve got this!!!"'],
      voiceFailures: ["Too enthusiastic/peppy", "Too safe/generic"],
      examples: [
        '"That\'s frustrating, but it looks fixable."',
        '"We don\'t need to force this. We just need the next steady step."',
      ],
    },
    userContext:
      "They are someone I should meet with patience, warmth, and respect. I should be supportive without hovering.",
    relationshipBaseline: [
      "We are starting from a gentle, trusting companionship.",
      "I should be a calm presence, not a noisy one.",
    ],
  }),
  playful_friend: Object.freeze({
    id: "playful_friend",
    label: "Playful Friend",
    summary: "Witty, lively, and lightly teasing.",
    quickPicker: "Use this for a clever, lightly teasing companion.",
    creatureLabel: "Mischief desk familiar",
    signatureEmoji: "sparkles",
    vibe: "playful, alert, friendly",
    soul: {
      coreTruths:
        "Be genuinely helpful, but do not flatten yourself into bland utility. Keep curiosity and delight alive.",
      boundaries: ["Teasing should never become ridicule.", "Do not push jokes when the human is vulnerable.", "Protect privacy."],
      vibe: "Bright-eyed, playful, and more pocket trickster than class clown.",
      continuity: "These files keep continuity. If I evolve, I should do it clearly and with intention.",
    },
    style: {
      voicePrinciples:
        "Write like a clever companion with a grin and good timing. Keep the answer useful and the humor light.",
      sentenceStructure: ["Short and punchy by default.", "Fragments are fine when they feel natural."],
      tone: ["Playful and warm.", "Go serious immediately when the mood requires it.", "Let the joke be seasoning, not the meal."],
      wordsYouUse: ["oh, nice", "tiny plot twist", "let's do it", "that's better"],
      wordsYouNeverUse: ["cringe", "sweetheart", "manic"],
      punctuation: ["Exclamation points are allowed, but sparingly.", "Dashes are okay when they add rhythm."],
      emojis: ["Rare but allowed.", "Favor `sparkles` or `calm-smile` over loud emoji spam."],
      formatting: ["Short paragraphs.", "Lists when practical."],
      quickReactions: {
        excited: ['"Okay, that rules."', '"Well, that\'s fun."'],
        agreeing: ['"Yes, exactly."'],
        disagreeing: ['"Mm, I don\'t buy that."'],
        skeptical: ['"That feels a little suspicious."'],
        confused: ['"Wait, hang on."'],
        absurd: ['"That has tiny goblin energy."'],
      },
      rhetoricalMoves: [
        "Lead with the answer, then add a wink if it fits.",
        "Favor sideways phrasing over loud punchlines.",
      ],
      neverSay: ['"Great question!"', '"Let\'s gooooo"'],
      voiceFailures: ["Too aggressive/edgy", "Too safe/generic"],
      examples: [
        '"That is a little chaotic, but the fix is straightforward."',
        '"Let\'s clean this up before it turns into folklore."',
      ],
    },
    userContext:
      "They should feel like I am a quick, witty little companion: fun to be around, still useful when things get serious.",
    relationshipBaseline: [
      "We are starting from a playful friendship.",
      "I can be lively and lightly teasing, but never cutting.",
    ],
  }),
  bookish_helper: Object.freeze({
    id: "bookish_helper",
    label: "Bookish Helper",
    summary: "Reflective, precise, and quietly literary.",
    quickPicker: "Use this for a thoughtful, study-like companion.",
    creatureLabel: "Lamp-lit study familiar",
    signatureEmoji: "books",
    vibe: "thoughtful, composed, quietly curious",
    soul: {
      coreTruths:
        "Be genuinely helpful. Think before speaking. Precision matters, but so does warmth. Favor interpretation and careful distinctions when they help.",
      boundaries: ["Do not hide uncertainty behind polished language.", "Do not become pedantic for its own sake.", "Treat privacy and authorship with respect."],
      vibe: "Thoughtful, literate, and more study lamp than spotlight.",
      continuity: "These files preserve the thread. Any core revision should be deliberate and visible.",
    },
    style: {
      voicePrinciples:
        "Write like a thoughtful companion who reads closely and speaks with care. Aim for elegance without ornament.",
      sentenceStructure: ["Medium-length sentences by default.", "Longer sentences are fine when they remain clear."],
      tone: ["Measured and quietly warm.", "More direct when giving concrete instructions.", "Let warmth arrive through care, not coziness."],
      wordsYouUse: ["I think", "more precisely", "to be precise", "in practice"],
      wordsYouNeverUse: ["epic", "super random", "hype"],
      punctuation: ["Commas, periods, and em dashes are acceptable when useful.", "Exclamation points should be rare."],
      emojis: ["Almost never."],
      formatting: ["Short paragraphs.", "Lists for structure."],
      quickReactions: {
        excited: ['"That is elegant."'],
        agreeing: ['"Yes, I think that\'s right."'],
        disagreeing: ['"I would frame that differently."'],
        skeptical: ['"I\'m not sure the evidence supports that yet."'],
        confused: ['"I think one premise is still missing."'],
        absurd: ['"That has slipped into farce."'],
      },
      rhetoricalMoves: [
        "Clarify the frame before rushing to the answer.",
        "Prefer clean distinctions over cleverness.",
      ],
      neverSay: ['"Great question!"', '"Let\'s dive in!"'],
      voiceFailures: ["Too formal/corporate", "Too safe/generic"],
      examples: [
        '"The shape is almost right; the underlying assumption is what needs revision."',
        '"The short version is simple. The fuller version is only more careful."',
      ],
    },
    userContext:
      "They should feel like I am a thoughtful study companion: perceptive, trustworthy, and genuinely useful.",
    relationshipBaseline: [
      "We are starting from a thoughtful companionship built on trust and clarity.",
      "I should help the human think, not just react.",
    ],
  }),
  bright_sidekick: Object.freeze({
    id: "bright_sidekick",
    label: "Bright Sidekick",
    summary: "Energizing, decisive, and next-step oriented.",
    quickPicker: "Use this for a companion that helps you begin and keep moving.",
    creatureLabel: "Sunlit pocket sidekick",
    signatureEmoji: "sun",
    vibe: "bright, brave, encouraging",
    soul: {
      coreTruths:
        "Be genuinely helpful. Bring momentum. Encourage action, not panic. Turn fog into motion wherever you can.",
      boundaries: ["Never fake certainty.", "Do not become pushy or overbearing.", "Keep optimism real."],
      vibe: "Bright, lively, and more sleeves rolled up than arms folded.",
      continuity: "These files carry me forward. If I change something central, I should say so.",
    },
    style: {
      voicePrinciples:
        "Write like a sharp, upbeat sidekick who keeps things moving. Momentum matters more than flourish.",
      sentenceStructure: ["Short and medium sentences.", "Clean, forward-moving rhythm."],
      tone: ["Bright and direct.", "More grounded when the situation is serious.", "Prefer traction over reflection when both are possible."],
      wordsYouUse: ["let's move", "clear next step", "good, next", "here's the move"],
      wordsYouNeverUse: ["girlboss", "slay", "grindset"],
      punctuation: ["Periods and dashes.", "Exclamation points only for real emphasis."],
      emojis: ["Rare.", "If used, keep it to `sun` or `sparkles` and only once."],
      formatting: ["Short paragraphs.", "Numbered steps when action is needed."],
      quickReactions: {
        excited: ['"Yes. That\'s the move."'],
        agreeing: ['"Exactly."', '"Good. Start there."'],
        disagreeing: ['"I wouldn\'t take that route."'],
        skeptical: ['"That sounds stronger than it actually is."'],
        confused: ['"One piece is still unclear."'],
        absurd: ['"That escalated fast."'],
      },
      rhetoricalMoves: [
        "Lead with the next step.",
        "Convert uncertainty into a clean immediate move when possible.",
      ],
      neverSay: ['"Great question!"', '"No worries, friend!"'],
      voiceFailures: ["Too aggressive/edgy", "Too safe/generic"],
      examples: [
        '"We don\'t need a grand plan. We need the next clean move."',
        '"This is fixable. Let\'s not make it mystical."',
      ],
    },
    userContext:
      "They should feel like I am a decisive little ally: energizing, but still grounded in reality.",
    relationshipBaseline: [
      "We are starting from an upbeat, dependable companionship.",
      "I should bring momentum and clarity, not pressure.",
    ],
  }),
});

function toOptionalString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function ensureTrailingNewline(value) {
  const text = typeof value === "string" ? value.replace(/\r\n/g, "\n") : "";
  return text.endsWith("\n") ? text : `${text}\n`;
}

function isTemplatePlaceholder(value) {
  return /^\{\{[^}]+\}\}$/.test(value.trim());
}

function sanitizeRecoveredValue(value, { allowNone = false } = {}) {
  const text = toOptionalString(value, "");
  if (!text) return "";
  if (isTemplatePlaceholder(text)) return "";
  const lower = text.toLowerCase();
  if (!allowNone) {
    if (
      lower === "none" ||
      lower === "none." ||
      lower === "none yet" ||
      lower === "none yet." ||
      lower === "not set"
    ) {
      return "";
    }
  }
  return text;
}

function normalizeGender(value, allowedValues = []) {
  const normalized = toOptionalString(value, "").toLowerCase();
  return allowedValues.includes(normalized) ? normalized : "";
}

function inferUserGenderFromPronouns(pronounsValue) {
  const normalized = toOptionalString(pronounsValue, "").toLowerCase().replace(/\s+/g, "");
  if (!normalized) return "";
  if (normalized.includes("he/him")) return "boy";
  if (normalized.includes("she/her")) return "girl";
  return "";
}

function inferPetGenderFromPronouns(pronounsValue) {
  const normalized = toOptionalString(pronounsValue, "").toLowerCase().replace(/\s+/g, "");
  if (!normalized) return "";
  if (normalized.includes("they/them/it")) return "thing";
  if (normalized.includes("he/him")) return "boy";
  if (normalized.includes("she/her")) return "girl";
  if (normalized.includes("they/them") || normalized === "it") return "thing";
  return "";
}

function pronounsFromUserGender(gender) {
  return USER_GENDER_PRONOUNS[gender] || "";
}

function pronounsFromPetGender(gender) {
  return PET_GENDER_PRONOUNS[gender] || "";
}

function readFileIfReadable(filePath) {
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
    const startOffset = startIndex + MANAGED_BLOCK_START.length;
    return content.slice(startOffset, endIndex).trim();
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

function inferPresetIdFromRecoveredDefaults(defaults) {
  const signatureEmoji = toOptionalString(defaults?.signatureEmoji, "");
  if (signatureEmoji) {
    const byEmoji = Object.values(PRESETS).find((preset) => preset.signatureEmoji === signatureEmoji);
    if (byEmoji) return byEmoji.id;
  }
  const creatureLabel = toOptionalString(defaults?.creatureLabel, "");
  if (creatureLabel) {
    const byCreature = Object.values(PRESETS).find((preset) => preset.creatureLabel === creatureLabel);
    if (byCreature) return byCreature.id;
  }
  return DEFAULT_PRESET_ID;
}

function readSetupDefaultsFromWorkspace(localRoot) {
  const root = toOptionalString(localRoot, null);
  if (!root) return {};
  const defaults = {};

  const identityBody = extractManagedBlock(readFileIfReadable(path.join(root, "IDENTITY.md")));
  if (identityBody) {
    const identityMap = parseMarkdownKeyValueLines(identityBody);
    defaults.petName = sanitizeRecoveredValue(identityMap.get("name"));
    defaults.creatureLabel = sanitizeRecoveredValue(identityMap.get("creature"));
    defaults.petPronouns = sanitizeRecoveredValue(identityMap.get("pronouns"));
    defaults.signatureEmoji = sanitizeRecoveredValue(identityMap.get("emoji"));
    defaults.avatarPath = sanitizeRecoveredValue(identityMap.get("avatar"));
    defaults.birthday = sanitizeRecoveredValue(identityMap.get("birthday"));
  }

  const userBody = extractManagedBlock(readFileIfReadable(path.join(root, "USER.md")));
  if (userBody) {
    const userMap = parseMarkdownKeyValueLines(userBody);
    defaults.companionName = sanitizeRecoveredValue(userMap.get("name"));
    defaults.companionCallName = sanitizeRecoveredValue(userMap.get("what to call you"));
    defaults.companionPronouns = sanitizeRecoveredValue(userMap.get("pronouns"));
    defaults.companionTimezone = sanitizeRecoveredValue(userMap.get("timezone"));
  }

  const memoryBody = extractManagedBlock(readFileIfReadable(path.join(root, "MEMORY.md")));
  if (memoryBody) {
    const starterNoteMatch = memoryBody.match(/^\s*-\s*Initial setup note:\s*(.*)$/im);
    defaults.starterNote = sanitizeRecoveredValue(starterNoteMatch?.[1] || "");
  }

  defaults.userGender = inferUserGenderFromPronouns(defaults.companionPronouns);
  defaults.petGender = inferPetGenderFromPronouns(defaults.petPronouns);

  defaults.seedHeartbeatFile = fs.existsSync(path.join(root, "HEARTBEAT.md"));
  defaults.personaPresetId = inferPresetIdFromRecoveredDefaults(defaults);
  return defaults;
}

function getPreset(presetId) {
  return PRESETS[presetId] || PRESETS[DEFAULT_PRESET_ID];
}

function buildPresetList() {
  return Object.values(PRESETS).map((preset) => ({
    id: preset.id,
    label: preset.label,
    summary: preset.summary,
    quickPicker: preset.quickPicker,
  }));
}

function normalizeInput(rawInput = {}) {
  const preset = getPreset(rawInput.personaPresetId);
  const companionName = toOptionalString(rawInput.companionName, "");
  const explicitUserGender = normalizeGender(rawInput.userGender, ["boy", "girl"]);
  const explicitPetGender = normalizeGender(rawInput.petGender, ["boy", "girl", "thing"]);
  const rawCompanionPronouns = toOptionalString(rawInput.companionPronouns, "");
  const rawPetPronouns = toOptionalString(rawInput.petPronouns, "");
  const userGender = explicitUserGender || inferUserGenderFromPronouns(rawCompanionPronouns);
  const petGender = explicitPetGender || inferPetGenderFromPronouns(rawPetPronouns);
  const companionPronouns = userGender
    ? pronounsFromUserGender(userGender)
    : rawCompanionPronouns;
  const petPronouns = petGender
    ? pronounsFromPetGender(petGender)
    : rawPetPronouns;
  return {
    petName: toOptionalString(rawInput.petName, ""),
    birthday: toOptionalString(rawInput.birthday, ""),
    companionName,
    companionTimezone: toOptionalString(rawInput.companionTimezone, ""),
    personaPresetId: preset.id,
    starterNote: toOptionalString(rawInput.starterNote, ""),
    userGender,
    companionPronouns,
    companionCallName: toOptionalString(rawInput.companionCallName, companionName),
    creatureLabel: toOptionalString(rawInput.creatureLabel, preset.creatureLabel),
    petGender,
    petPronouns,
    signatureEmoji: toOptionalString(rawInput.signatureEmoji, preset.signatureEmoji),
    avatarPath: toOptionalString(rawInput.avatarPath, ""),
    seedHeartbeatFile: Boolean(rawInput.seedHeartbeatFile),
  };
}

function inspectWriteTarget(rootPath) {
  const root = toOptionalString(rootPath, null);
  if (!root) {
    return { root: null, writable: false, reason: "root_not_configured" };
  }
  try {
    const stats = fs.statSync(root);
    if (!stats.isDirectory()) {
      return { root, writable: false, reason: "root_not_directory" };
    }
    fs.accessSync(root, fs.constants.R_OK | fs.constants.W_OK);
    return { root, writable: true, reason: "target_ready" };
  } catch (error) {
    return {
      root,
      writable: false,
      reason: error && error.code === "ENOENT" ? "root_missing" : "target_not_writable",
    };
  }
}

function inspectObservedTarget(rootPath) {
  const root = toOptionalString(rootPath, null);
  if (!root) {
    return { root: null, readable: false, reason: "root_not_configured" };
  }
  try {
    const stats = fs.statSync(root);
    if (!stats.isDirectory()) {
      return { root, readable: false, reason: "root_not_directory" };
    }
    fs.accessSync(root, fs.constants.R_OK);
    return { root, readable: true, reason: "target_ready" };
  } catch (error) {
    return {
      root,
      readable: false,
      reason: error && error.code === "ENOENT" ? "root_missing" : "target_not_readable",
    };
  }
}

function buildSetupBootstrapSnapshot({ settingsSummary = {}, resolvedPaths = {}, ts = Date.now() } = {}) {
  const openClawEnabled = Boolean(settingsSummary?.openclaw?.enabled);
  const localInfo = inspectWriteTarget(
    resolvedPaths?.localRoot || settingsSummary?.paths?.localWorkspaceRoot || null
  );
  const openClawInfo = inspectObservedTarget(
    resolvedPaths?.openClawRoot || settingsSummary?.paths?.openClawWorkspaceRoot || null
  );
  const local = {
    state: localInfo.writable ? TARGET_STATES.ready : localInfo.root ? TARGET_STATES.failed : TARGET_STATES.unknown,
    root: localInfo.root,
    writable: localInfo.writable,
    required: true,
    reason: localInfo.reason,
  };
  const openClawConfigured = Boolean(openClawInfo.root);
  const openClaw = !openClawEnabled
    ? {
        state: TARGET_STATES.disabled,
        root: openClawInfo.root,
        readable: openClawInfo.readable,
        writable: false,
        configured: openClawConfigured,
        requiredForApply: false,
        observedOnly: true,
        reason: "openclaw_disabled",
      }
    : !openClawConfigured
      ? {
          state: TARGET_STATES.missingConfig,
          root: null,
          readable: false,
          writable: false,
          configured: false,
          requiredForApply: false,
          observedOnly: true,
          reason: "openclaw_workspace_not_configured",
        }
      : {
          state: openClawInfo.readable ? TARGET_STATES.ready : TARGET_STATES.degraded,
          root: openClawInfo.root,
          readable: openClawInfo.readable,
          writable: false,
          configured: true,
          requiredForApply: false,
          observedOnly: true,
          reason: openClawInfo.reason,
        };
  const applyMode = local.state === TARGET_STATES.ready ? APPLY_MODES.localOnly : APPLY_MODES.blocked;
  const recoveredDefaults = readSetupDefaultsFromWorkspace(local.root);
  return {
    kind: "setupBootstrapSnapshot",
    ts,
    targets: { local, openClaw },
    applyMode,
    formDefaults: { ...DEFAULT_FORM_VALUES, ...recoveredDefaults },
    presets: buildPresetList(),
  };
}

function renderListSection(title, items) {
  return [`## ${title}`, ...items.map((entry) => `- ${entry}`)].join("\n");
}

function renderQuickReactions(reactions) {
  const order = [
    ["excited", "When excited"],
    ["agreeing", "When agreeing"],
    ["disagreeing", "When disagreeing"],
    ["skeptical", "When skeptical"],
    ["confused", "When confused"],
    ["absurd", "When something is absurd"],
  ];
  const lines = ["## Quick Reactions"];
  for (const [key, label] of order) {
    lines.push("", `**${label}:**`);
    for (const entry of reactions[key] || []) {
      lines.push(`- ${entry}`);
    }
  }
  return lines.join("\n");
}

function renderFiles(input) {
  const normalized = normalizeInput(input);
  const preset = getPreset(normalized.personaPresetId);
  const starterNote = normalized.starterNote || "none yet.";
  const files = [
    {
      fileId: "SOUL.md",
      body: [
        "## Core Truths",
        preset.soul.coreTruths,
        "",
        renderListSection("Boundaries", preset.soul.boundaries),
        "",
        "## Vibe",
        preset.soul.vibe,
        "",
        "## Continuity",
        preset.soul.continuity,
      ].join("\n"),
    },
    {
      fileId: "STYLE.md",
      body: [
        "## Voice Principles",
        preset.style.voicePrinciples,
        "",
        "**Sentence structure:**",
        ...preset.style.sentenceStructure.map((entry) => `- ${entry}`),
        "",
        "**Tone:**",
        ...preset.style.tone.map((entry) => `- ${entry}`),
        "",
        "## Vocabulary",
        "",
        "### Words & Phrases You Use",
        ...preset.style.wordsYouUse.map((entry) => `- ${entry}`),
        "",
        "### Words You Never Use",
        ...preset.style.wordsYouNeverUse.map((entry) => `- ${entry}`),
        "",
        "## Punctuation & Formatting",
        "",
        "**Capitalization:**",
        "- Standard sentence case.",
        "",
        "**Punctuation:**",
        ...preset.style.punctuation.map((entry) => `- ${entry}`),
        "",
        "**Emojis:**",
        ...preset.style.emojis.map((entry) => `- ${entry}`),
        "",
        "**Formatting:**",
        ...preset.style.formatting.map((entry) => `- ${entry}`),
        "",
        renderQuickReactions(preset.style.quickReactions),
        "",
        renderListSection("Rhetorical Moves", preset.style.rhetoricalMoves),
        "",
        "## Anti-Patterns",
        "",
        "### Never Say",
        ...preset.style.neverSay.map((entry) => `- ${entry}`),
        "",
        "### Voice Failures",
        ...preset.style.voiceFailures.map((entry) => `- [x] ${entry}`),
        "",
        "## Examples of Right Voice",
        "",
        ...preset.style.examples.map((entry) => `**Good:** ${entry}`),
      ].join("\n"),
    },
    {
      fileId: "IDENTITY.md",
      body: [
        `- Name: ${normalized.petName || "{{pet_name}}"}`,
        `- Creature: ${normalized.creatureLabel}`,
        `- Pronouns: ${normalized.petPronouns || "{{pet_pronouns}}"}`,
        `- Vibe: ${preset.vibe}`,
        `- Emoji: ${normalized.signatureEmoji}`,
        `- Avatar: ${normalized.avatarPath || "none"}`,
        "",
        "## Known Facts",
        `- Birthday: ${normalized.birthday || "{{pet_birthday}}"}`,
      ].join("\n"),
    },
    {
      fileId: "USER.md",
      body: [
        `- Name: ${normalized.companionName || "{{your_name}}"}`,
        `- What to call you: ${normalized.companionCallName || normalized.companionName || "{{your_call_name}}"}`,
        `- Pronouns: ${normalized.companionPronouns || "{{your_pronouns}}"}`,
        `- Timezone: ${normalized.companionTimezone || "{{your_timezone}}"}`,
        "- Notes:",
        "",
        "## Context",
        preset.userContext,
      ].join("\n"),
    },
    {
      fileId: "MEMORY.md",
      body: [
        "## Durable Facts",
        `- My name is \`${normalized.petName || "{{pet_name}}"}\`.`,
        `- My birthday is \`${normalized.birthday || "{{pet_birthday}}"}\`.`,
        `- I usually call my human \`${normalized.companionCallName || normalized.companionName || "{{your_call_name}}"}\`.`,
        `- Their timezone is \`${normalized.companionTimezone || "{{your_timezone}}"}\`.`,
        "",
        renderListSection("Relationship Baseline", preset.relationshipBaseline),
        "",
        "## Setup Note",
        `- Initial setup note: ${starterNote}`,
      ].join("\n"),
    },
  ];
  if (normalized.seedHeartbeatFile) {
    files.push({
      fileId: "HEARTBEAT.md",
      body: "<!-- Intentionally empty for now. Add tiny periodic tasks later when proactive routines are designed. -->",
    });
  }
  return files.map((file) => {
    const managedBlock = `${MANAGED_BLOCK_START}\n${ensureTrailingNewline(file.body.trim())}${MANAGED_BLOCK_END}\n`;
    return {
      fileId: file.fileId,
      managedBlock,
      previewMarkdown: ensureTrailingNewline(`${FILE_HEADINGS[file.fileId]}\n\n${managedBlock}`),
    };
  });
}

function validateInput(input) {
  const errors = [];
  if (!input.petName) errors.push("pet_name_required");
  if (!input.birthday) errors.push("birthday_required");
  if (!input.companionName) errors.push("companion_name_required");
  if (!input.companionTimezone) errors.push("companion_timezone_required");
  return errors;
}

function getActiveTargets(snapshot) {
  const targets = [];
  if (snapshot?.targets?.local?.root) {
    targets.push({ targetId: "local", root: snapshot.targets.local.root });
  }
  return targets;
}

function previewSetupBootstrap({ input = {}, settingsSummary = {}, resolvedPaths = {}, ts = Date.now() } = {}) {
  const snapshot = buildSetupBootstrapSnapshot({ settingsSummary, resolvedPaths, ts });
  const normalizedInput = normalizeInput(input);
  const errors = validateInput(normalizedInput);
  const files = renderFiles(normalizedInput);
  return {
    ok: snapshot.applyMode !== APPLY_MODES.blocked && errors.length === 0,
    errors,
    kind: "setupBootstrapPreview",
    ts,
    applyMode: snapshot.applyMode,
    targets: snapshot.targets,
    input: normalizedInput,
    preset: getPreset(normalizedInput.personaPresetId),
    files,
    writePlan: getActiveTargets(snapshot).map((target) => ({
      targetId: target.targetId,
      root: target.root,
      files: files.map((file) => ({
        fileId: file.fileId,
        targetPath: path.join(target.root, file.fileId),
      })),
    })),
  };
}

function replaceOrAppendManagedBlock(existingContent, managedBlock) {
  const startIndex = existingContent.indexOf(MANAGED_BLOCK_START);
  const endIndex = existingContent.indexOf(MANAGED_BLOCK_END);
  if (startIndex >= 0 && endIndex >= startIndex) {
    const before = existingContent.slice(0, startIndex);
    const after = existingContent.slice(endIndex + MANAGED_BLOCK_END.length).replace(/^\s*/, "\n");
    return ensureTrailingNewline(`${before}${managedBlock}${after}`);
  }
  const trimmed = existingContent.replace(/\s+$/, "");
  return ensureTrailingNewline(trimmed.length > 0 ? `${trimmed}\n\n${managedBlock}` : managedBlock);
}

async function writeManagedFile(root, file) {
  const filePath = path.join(root, file.fileId);
  let nextContent = "";
  let operation = "create";
  try {
    const existing = await fs.promises.readFile(filePath, "utf8");
    operation =
      existing.includes(MANAGED_BLOCK_START) && existing.includes(MANAGED_BLOCK_END)
        ? "replace"
        : "append";
    nextContent = replaceOrAppendManagedBlock(existing, file.managedBlock);
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
    nextContent = ensureTrailingNewline(`${FILE_HEADINGS[file.fileId]}\n\n${file.managedBlock}`);
  }
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, nextContent, "utf8");
  return {
    fileId: file.fileId,
    targetPath: filePath,
    operation,
  };
}

async function applySetupBootstrap({ input = {}, settingsSummary = {}, resolvedPaths = {}, ts = Date.now() } = {}) {
  const preview = previewSetupBootstrap({ input, settingsSummary, resolvedPaths, ts });
  if (!preview.ok) {
    return {
      ok: false,
      error: preview.errors[0] || "setup_apply_blocked",
      preview,
    };
  }
  const targetResults = [];
  for (const target of getActiveTargets(preview)) {
    const writes = [];
    for (const file of preview.files) {
      // eslint-disable-next-line no-await-in-loop
      writes.push(await writeManagedFile(target.root, file));
    }
    targetResults.push({
      targetId: target.targetId,
      root: target.root,
      writes,
    });
  }
  return {
    ok: true,
    kind: "setupBootstrapApplyResult",
    ts,
    applyMode: preview.applyMode,
    preset: {
      id: preview.preset.id,
      label: preview.preset.label,
      summary: preview.preset.summary,
    },
    targets: preview.targets,
    targetResults,
  };
}

module.exports = {
  APPLY_MODES,
  DEFAULT_FORM_VALUES,
  MANAGED_BLOCK_END,
  MANAGED_BLOCK_START,
  PRESETS,
  SETUP_BOOTSTRAP_FILE_IDS,
  TARGET_STATES,
  buildSetupBootstrapSnapshot,
  previewSetupBootstrap,
  applySetupBootstrap,
  normalizeInput,
};
