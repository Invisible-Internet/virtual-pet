const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen, clipboard } = require("electron");
const fs = require("fs");
const path = require("path");
const { CAPABILITY_STATES, createCapabilityRegistry } = require("./capability-registry");
const { createExtensionPackRegistry, DEFAULT_EXTENSIONS_ROOT } = require("./extension-pack-registry");
const { createPetContractRouter } = require("./pet-contract-router");
const {
  BRIDGE_MODES,
  BRIDGE_TRANSPORTS,
  createOpenClawBridge,
  requestWithTimeout,
} = require("./openclaw-bridge");
const {
  ALLOWLIST_ACTION_IDS: OPENCLAW_PET_COMMAND_ALLOWLIST_ACTION_IDS,
  COMMAND_AUTH_SCHEME: OPENCLAW_PET_COMMAND_AUTH_SCHEME,
  DEFAULT_KEY_ID: DEFAULT_OPENCLAW_PET_COMMAND_KEY_ID,
  DEFAULT_SHARED_SECRET_REF: DEFAULT_OPENCLAW_PET_COMMAND_SECRET_REF,
  REJECT_REASONS: PET_COMMAND_REJECT_REASONS,
  createOpenClawPetCommandLane,
} = require("./openclaw-pet-command-lane");
const {
  CALL_IDS: OPENCLAW_PLUGIN_SKILL_CALL_IDS,
  CONTRACT_VERSION: OPENCLAW_PLUGIN_SKILL_CONTRACT_VERSION,
  REJECT_REASONS: OPENCLAW_PLUGIN_SKILL_REJECT_REASONS,
  RESULT_STATES: OPENCLAW_PLUGIN_SKILL_RESULT_STATES,
  STATUS_SCOPES: OPENCLAW_PLUGIN_SKILL_STATUS_SCOPES,
  VIRTUAL_PET_LANE_ACTION: OPENCLAW_PLUGIN_SKILL_ACTION_ID,
  createOpenClawPluginSkillLane,
} = require("./openclaw-plugin-skill-lane");
const {
  DEFAULT_DIALOG_TEMPLATES_PATH,
  buildOfflineDialogResponse,
  classifyOfflineDialogTrigger,
  createDefaultDialogTemplateCatalog,
  loadDialogTemplateCatalog,
} = require("./dialog-runtime");
const {
  buildPersonaAwareOfflineFallbackResponse,
  buildPersonaAwareProactivePrompt,
} = require("./offline-persona-style");
const { buildOfflineRecallResult } = require("./offline-recall");
const {
  PROACTIVE_SUPPRESSED_RETRY_MS,
  applyIgnoredBackoffIfNeeded,
  buildProactivePolicySnapshot,
  createInitialProactivePolicyState,
  evaluateProactiveSuppression,
  getProactiveCooldownMsForTier,
  getCooldownRemainingMs,
  recordProactiveAnnouncement,
  recordProactiveSuppression,
  recordProactiveUserEngagement,
} = require("./proactive-policy");
const {
  buildPersonaSnapshot: buildRuntimePersonaSnapshot,
  buildPersonaExport: buildRuntimePersonaExport,
} = require("./persona-snapshot");
const {
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
} = require("./openclaw-agent-probe");
const {
  INTEGRATION_TRANSPORTS,
  deriveIntegrationCapabilityState,
  createTrackRatingObservation,
} = require("./integration-runtime");
const {
  WINDOWS_MEDIA_SOURCE,
  buildLocalMediaEventPayload,
  buildLocalMediaProbeKey,
  buildLocalMediaResponseText,
  probeWindowsMediaState,
} = require("./windows-media-sensor");
const {
  WINDOWS_FOREGROUND_WINDOW_SOURCE,
  buildForegroundWindowProbeKey,
  probeForegroundWindowState,
} = require("./foreground-window-runtime");
const {
  MEMORY_ADAPTER_MODES,
  OPENCLAW_WORKSPACE_BOOTSTRAP_MODES,
  createMemoryPipeline,
} = require("./memory-pipeline");
const { DEFAULT_STATE_CATALOG_PATH, createStateRuntime } = require("./state-runtime");
const {
  DEFAULT_CHARACTER_SCALE_PERCENT,
  DEFAULT_ROAMING_ZONE,
  loadRuntimeSettings,
  MAX_CHARACTER_SCALE_PERCENT,
  MIN_CHARACTER_SCALE_PERCENT,
  persistRuntimeSettingsPatch,
  ROAMING_MODES,
} = require("./settings-runtime");
const { BASE_LAYOUT, computePetLayout } = require("./pet-layout");
const {
  normalizePetBounds,
  clampWindowPosition,
  createDragClampLatch,
  applyDragClampHysteresis,
} = require("./main-clamp");
const {
  DEFAULT_MONITOR_AVOID_MS,
  ROAM_POLICY_DECISION_REASONS,
  applyRoamPacingDecision,
  buildRoamPolicySnapshot,
  intersectBoundsRect,
  isWindowAvoidActive,
  listActiveAvoidedWindows,
  normalizeBoundsRect,
  createInitialRoamPolicyState,
  markRoamPolicyDecision,
  planActiveWindowAvoidanceSampling,
  planDesktopRoamSampling,
  recordManualDisplayAvoidance,
  recordManualWindowAvoidance,
  resolveBottomEdgeInspectAnchor,
  resolveRoamPacingDelay,
} = require("./roam-policy");
const {
  DEFAULT_OBSERVABILITY_SUBJECT_ID,
  OBSERVABILITY_DETAIL_ACTION_IDS,
  SHELL_WINDOW_TABS,
  buildObservabilityDetail,
  buildObservabilitySnapshot,
  normalizeShellWindowTab,
  resolveShellWindowTabForAction,
} = require("./shell-observability");
const {
  buildSetupBootstrapSnapshot,
  previewSetupBootstrap,
  applySetupBootstrap,
} = require("./setup-bootstrap");
const {
  buildShellSettingsSnapshot,
  validateShellSettingsPatch,
} = require("./shell-settings-editor");
const {
  PAIRING_CHECK_IDS: OPENCLAW_PAIRING_CHECK_IDS,
  PAIRING_CHECK_STATES: OPENCLAW_PAIRING_CHECK_STATES,
  PAIRING_STATES: OPENCLAW_PAIRING_STATES,
  createOpenClawPairingGuidance,
} = require("./openclaw-pairing-guidance");
const { buildPairingQrDataUrl } = require("./openclaw-pairing-qr");
const { evaluateOpenClawDialogGate } = require("./openclaw-runtime-gate");
const {
  REFLECTION_CONTEXT_SOURCE,
  REFLECTION_CYCLE_IDS,
  REFLECTION_DEFAULTS,
  REFLECTION_OUTCOMES,
  REFLECTION_ROUTES,
  applyRunHistoryEntries,
  createInitialReflectionRuntimeState,
  markCycleSuppressedInFlight,
  markRunCompleted,
  markRunStarted,
  normalizeCycleId,
  selectDueCycle,
} = require("./online-reflection-runtime");

// Master diagnostics toggle: controls console logs, file logs, and renderer overlay.
let DIAGNOSTICS_ENABLED = false;
const CLAMP_TO_WORK_AREA = true;
const DRAG_LOG_SAMPLE_EVERY = 8;
const MAX_LOG_FILE_BYTES = 5 * 1024 * 1024;
const VELOCITY_SAMPLE_WINDOW_MS = 120;
const MAX_DRAG_SAMPLES = 12;
const CURSOR_EMIT_INTERVAL_MS = 33;
const PET_BOUNDS_STALE_MS = 250;
const DRAG_CLAMP_HYSTERESIS_PX = 2;
const MOTION_POSITION_EPSILON = 0.25;
const MOTION_VELOCITY_EPSILON = 0.5;
const CHARACTER_ASSETS_ROOT = path.join(__dirname, "assets", "characters");
const DEFAULT_CHARACTER_ID = "girl";
const INVENTORY_WINDOW_SIZE = Object.freeze({
  width: 520,
  height: 560,
});
const INVENTORY_WINDOW_MIN_SIZE = Object.freeze({
  width: 460,
  height: 420,
});
const PROP_WINDOW_SPECS = Object.freeze({
  poolRing: Object.freeze({
    propId: "poolRing",
    label: "Pool Ring",
    windowSize: Object.freeze({
      width: 196,
      height: 176,
    }),
    visualBounds: Object.freeze({
      x: 20,
      y: 20,
      width: 156,
      height: 112,
    }),
  }),
});
const TRAY_ICON_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAMcSURBVFhH7VdLaFNBFO3SnZ/3QguCqb6XWPzQotRmpmJDxQ9qRS1+KgWrYiutlhgQA35BURBFCoK6KIIKdSEGxCLSRd2ULupCRCy6iRt1IwR0Ia5GzsQX37t3krwEu/PAWbzMzDl35t75pK7uP2pEJCZbLKc96RHftM8/RTTaMS8Sk32WK8csV/y0XalKMGu58vj8aMcCqlEzIGi58qvBrAxF3nYTKQRO9UIDs7AdMc3Fq6AjZ+uXtzVS7YrAINuVOSZYE0UedUI9SkLPvIL5UtmtmncPFRnr6GF9WBBx0US9GJCzcsu+Zl9aDY1/VBffK8bhiU9qff8VNsbHXMXiROEYBqrFzZvV/tvjzNTEw4+m1ZLWLqYBWo68RT2LwOxN1Q6x9KsvzKgcMzM/jGnBFo5EWxuotwa2Gx0AHrw7wQzCcCD7jmlpOvIa9dawXPmCdhZHLgRET01+VsMvc8ysVNuWM3dMAcxSb135phPOv/SDzz+ohY1rNXtHJwNGpdqQCqoJsh2xyG1P0E7Iod8Ewp7JnhtPQrcZa8ERuwIB4AfaaV1vJiAE7h15pg3OvfkVug1ppNrYbcEADAWYPHGdmdTCbedHWQCWIy4FArCXiQO0Ey3AWomJUG3LFZlAADiraadV248xsVrYtOkQCwATDgSAw4F1cqWuYk8IlY6tRg38RP77Hk4FvutXJJkuij4QAGC6A5A/z7xhZVJF27rUwNO3zBjMzHxXLd0n9U5AQeI3HN9UE6ct9dZAYdDOiB6XD8TjnT3FrbZ6Z7/aevaeOvr4ta78DYNXlR0Xug2BIuDTU9/0HUI1bVfcp94aSIPpMEIOsZQIAqaekYlYAZhj9rg5qRZY9v2I24oOAFGQuG4hjJlhiTtTN/VKYPYIzDuG0V7KHG9G6hlAYRX4jQgiHTsuP2C59xM5Ny974SZkR7AJqFBTKvzEK2hjekQXKS4cfJuqPUC69coBnSsFUQ3ZyRcGhcMJz2suGJZ6EtXMnOJPTYxR4ZDMhsp5GGDrYP+WKtC/FHn976maZ3i1KLwdEink1WPhew5N5wq/AcDTFGocRNoxAAAAAElFTkSuQmCC";
const ROAM_STEP_INTERVAL_MS = 16;
const ROAM_INITIAL_DELAY_MIN_MS = 1200;
const ROAM_INITIAL_DELAY_MAX_MS = 2400;
const ROAM_REST_MIN_MS = 2200;
const ROAM_REST_MAX_MS = 6200;
const ROAM_TARGET_MIN_DISTANCE_PX = 120;
const ROAM_TARGET_RETRY_COUNT = 10;
const ROAM_ARRIVAL_THRESHOLD_PX = 3;
const ROAM_WALK_SPEED_PX_PER_SEC = 88;
const ROAM_RUN_SPEED_PX_PER_SEC = 224;
const ROAM_RUN_DISTANCE_THRESHOLD_PX = 360;
const ROAM_ZONE_ENTRY_DELAY_MS = 140;
const IDLE_STATE_MIN_DWELL_MS = 5000;
const ROAM_DIRECTION_REVERSAL_MIN_IDLE_MS = 6000;
const ROAM_DIRECTION_REVERSAL_MIN_DISTANCE_PX = 140;
const MIN_ROAM_ZONE_RECT_SIZE = 120;
const ROAM_ZONE_INSET_RATIO = 0.22;
const ROAM_DIAGONAL_DIRECTION_RATIO = 0.18;
const ACTIVE_WINDOW_AVOID_MARGIN_PX = 24;
const WINDOW_EDGE_INSPECT_DWELL_MS = 6000;
const WINDOW_AVOID_MS = 300000;
const WINDOW_WATCH_BOTTOM_BAND_PX = 64;
const WINDOW_WATCH_BOTTOM_INSET_PX = 12;
const WINDOW_WATCH_BOTTOM_GRACE_PX = 220;
const WINDOW_INSPECT_MIN_FOCUS_MS = 1800;
const WINDOW_INSPECT_GLOBAL_COOLDOWN_MS = 22000;
const WINDOW_INSPECT_WINDOW_COOLDOWN_MS = 70000;
const WINDOW_INSPECT_TRIGGER_PROBABILITY = 0.45;
const FOREGROUND_WINDOW_POLL_MS = 250;
const FOREGROUND_WINDOW_PROBE_TIMEOUT_MS = 800;
const MEDIA_WATCHMODE_DWELL_MS = 30000;
const MEDIA_WATCHMODE_FOCUS_HOLD_EXTENSION_MS = 12000;
const MEDIA_WATCHMODE_FOCUS_LOSS_GRACE_MS = 1200;
const LOCAL_MEDIA_STOP_DEBOUNCE_MS = 8000;
const MUSIC_DANCE_DURATION_MS = 5200;
const MEDIA_VIDEO_PROVIDERS = new Set(["youtube", "netflix"]);
const MEDIA_BROWSER_PROVIDERS = new Set(["msedge", "chrome", "firefox"]);
const MEDIA_BROWSER_PROVIDER_HINTS = ["msedge", "edge", "chrome", "firefox", "brave", "opera", "vivaldi"];
const MEDIA_BROWSER_VIDEO_HINTS = [
  "youtube",
  "netflix",
  "twitch",
  "vimeo",
  "prime video",
  "disney",
  "hulu",
  "trailer",
  "episode",
  "watch",
];
const MEDIA_BROWSER_STRONG_MUSIC_HINTS = [
  "music.youtube.com",
  "youtube music",
  "yt music",
  "open.spotify.com",
  "soundcloud",
  "bandcamp",
  "apple music",
  "deezer",
  "tidal",
  "pandora",
];
const MEDIA_BROWSER_MUSIC_HINTS = [
  "spotify",
  "soundcloud",
  "bandcamp",
  "apple music",
  "yt music",
  "youtube music",
  "deezer",
  "tidal",
  "pandora",
  "radio",
];
const MEDIA_AUDIO_EXTENSIONS = [".mp3", ".wav", ".flac", ".aac", ".m4a", ".ogg", ".wma", ".opus"];
const MEDIA_VIDEO_EXTENSIONS = [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".webm", ".m4v", ".mpeg"];
const REQUIRED_SPRITE_DIRECTIONS = Object.freeze([
  "Down",
  "DownRight",
  "Right",
  "UpRight",
  "Up",
  "UpLeft",
  "Left",
  "DownLeft",
]);
const REQUIRED_SPRITE_STATES = Object.freeze([
  "IdleReady",
  "Walk",
  "Run",
  "Jump",
  "RunningJump",
  "Roll",
  "Grabbed",
]);

const FLING_PRESETS = Object.freeze({
  default: Object.freeze({
    enabled: true,
    minSpeedPxS: 120,
    maxSpeedPxS: 3600,
    dampingPerSec: 2.2,
    bounceRestitution: 0.78,
    stopSpeedPxS: 12,
    stepMs: 8,
  }),
  floaty: Object.freeze({
    enabled: true,
    minSpeedPxS: 70,
    maxSpeedPxS: 5200,
    dampingPerSec: 1.0,
    bounceRestitution: 0.9,
    stopSpeedPxS: 6,
    stepMs: 8,
  }),
  heavy: Object.freeze({
    enabled: true,
    minSpeedPxS: 220,
    maxSpeedPxS: 2000,
    dampingPerSec: 6.4,
    bounceRestitution: 0.35,
    stopSpeedPxS: 28,
    stepMs: 8,
  }),
  off: Object.freeze({
    enabled: false,
    minSpeedPxS: 0,
    maxSpeedPxS: 0,
    dampingPerSec: 0,
    bounceRestitution: 0,
    stopSpeedPxS: 0,
    stepMs: 16,
  }),
});

// Set this to one of: default, floaty, heavy, off
const FLING_PRESET = "default";
const ACTIVE_FLING_PRESET = Object.prototype.hasOwnProperty.call(FLING_PRESETS, FLING_PRESET)
  ? FLING_PRESET
  : "default";
const FLING_CONFIG = FLING_PRESETS[ACTIVE_FLING_PRESET];
const CAPABILITY_CONTRACT_VERSION = "1.0";
const DIALOG_HISTORY_LIMIT = 24;
const DIALOG_TALK_FEEDBACK_MODE = "bubble_pulse";
const PROACTIVE_CONVERSATION_REASON = "proactive_conversation";
const PROACTIVE_CONVERSATION_START_DELAY_MS = 20000;
const PROACTIVE_CONVERSATION_CHECK_INTERVAL_MS = 2000;
const BRIDGE_RECENT_DIALOG_TURNS_LIMIT = 6;
const BRIDGE_RECENT_DIALOG_TEXT_LIMIT = 140;
const BRIDGE_RECENT_DIALOG_SUMMARY_LIMIT = 360;
const REFLECTION_SCHEDULER_TICK_MS = REFLECTION_DEFAULTS.schedulerTickMs;
const REFLECTION_MAX_INTENTS_PER_CYCLE = REFLECTION_DEFAULTS.maxIntentsPerCycle;
const REFLECTION_MAX_ACCEPTED_SUMMARY_CHARS = REFLECTION_DEFAULTS.maxAcceptedSummaryChars;
const REFLECTION_LOG_OBSERVATION_TYPE = "online_reflection_run";
const REFLECTION_HEARTBEAT_OBSERVATION_TYPE = "online_reflection_heartbeat";
const REFLECTION_DIGEST_OBSERVATION_TYPE = "online_reflection_digest";
const REFLECTION_ROUTER_SOURCE = "openclaw_reflection";
const REFLECTION_RUNTIME_SCHEMA = "vp-reflection-runtime-v1";
const REFLECTION_INTENT_SCHEMA = "vp-reflection-intent-v1";
const OPENCLAW_PET_COMMAND_AUDIT_LIMIT = 50;
const OPENCLAW_PLUGIN_SKILL_AUDIT_LIMIT = 50;
const STATE_CATALOG_PATH = DEFAULT_STATE_CATALOG_PATH;
const CAPABILITY_IDS = Object.freeze({
  renderer: "renderer",
  brain: "brain",
  sensors: "sensors",
  openclawBridge: "openclawBridge",
  spotifyIntegration: "spotifyIntegration",
  freshRssIntegration: "freshRssIntegration",
  extensionRegistry: "extensionRegistry",
  permissionManager: "permissionManager",
  behaviorArbitrator: "behaviorArbitrator",
  propWorld: "propWorld",
});
const CAPABILITY_TEST_FLAGS = Object.freeze({
  sensorsFail: process.env.PET_FORCE_SENSORS_FAIL === "1",
  openclawFail: process.env.PET_FORCE_OPENCLAW_FAIL === "1",
});
const SHELL_ACTIONS = Object.freeze({
  openChat: "open-chat",
  openInventory: "open-inventory",
  openStatus: "open-status",
  openSetup: "open-setup",
  openSettings: "open-settings",
  roamDesktop: "roam-desktop",
  roamZone: "roam-zone",
  selectRoamZone: "select-roam-zone",
  toggleDiagnostics: "toggle-diagnostics",
  toggleHeadphones: "toggle-headphones",
  togglePoolRing: "toggle-pool-ring",
  toggleAlwaysShowBubble: "toggle-always-show-bubble",
});
const SHELL_ACCESSORY_IDS = Object.freeze({
  headphones: "headphones",
});
const SHELL_QUICK_PROP_IDS = Object.freeze({
  poolRing: "poolRing",
});
const EXTENSION_TEST_FLAGS = Object.freeze({
  disableAll: process.env.PET_DISABLE_EXTENSIONS === "1",
});

let win;
let dragging = false;
let dragOffset = { x: 0, y: 0 };
let dragDisplayId = null;
let dragTick = 0;
let dragSamples = [];
let flingTick = 0;
let logLineCount = 0;
let diagnosticsLogStream = null;
let physicsTimer = null;
let lastMotionSample = null;
let cursorTimer = null;
let localMediaPollTimer = null;
let freshRssPollTimer = null;
let proactiveConversationTimer = null;
let reflectionSchedulerTimer = null;
let dragClampLatch = createDragClampLatch();
let activePetBoundsUpdatedAtMs = 0;
let lastMotionPayload = null;
let capabilityRegistry = null;
let latestCapabilitySnapshot = null;
let extensionPackRegistry = null;
let latestExtensionSnapshot = null;
let contractRouter = null;
let latestContractTrace = null;
let dialogTemplateCatalog = createDefaultDialogTemplateCatalog();
let dialogHistory = [];
let openclawBridge = null;
let openclawPetCommandLane = null;
let openclawPetCommandAuditHistory = [];
let openclawPluginSkillLane = null;
let openclawPluginSkillAuditHistory = [];
let openclawPairingGuidance = createOpenClawPairingGuidance();
let memoryPipeline = null;
let latestMemorySnapshot = null;
let latestOfflineRecallSnapshot = null;
let latestOfflinePersonaReplySnapshot = null;
let latestPersonaSnapshot = null;
let latestPersonaSnapshotRuntime = null;
let latestPersonaExportSnapshot = null;
let latestProactivePolicySnapshot = null;
let latestReflectionRuntimeSnapshot = null;
let latestIntegrationEvent = null;
let stateRuntime = null;
let latestStateSnapshot = null;
let integrationProbeStates = {
  spotify: createInitialIntegrationProbeState(),
  freshRss: createInitialIntegrationProbeState(),
};
let runtimeSettings = null;
let runtimeSettingsSourceMap = {};
let runtimeSettingsValidationWarnings = [];
let runtimeSettingsValidationErrors = [];
let runtimeSettingsResolvedPaths = null;
let runtimeSettingsFiles = null;
let latestLocalMediaSnapshot = null;
let lastLocalMediaEventKey = null;
let lastLocalMediaContractSignature = null;
let localMediaLastPlayingAtMs = 0;
let localMediaStoppedSinceMs = 0;
let localMediaPendingStopFromPlaying = false;
let localMediaProbeInFlight = false;
let idleStateDwellUntilMs = 0;
let latestForegroundWindowSnapshot = null;
let lastForegroundWindowProbeKey = null;
let foregroundWindowProbeInFlight = false;
let lastForegroundWindowPollRequestAtMs = 0;
let spotifyBackgroundProbeInFlight = false;
let freshRssBackgroundProbeInFlight = false;
let lastSpotifyBackgroundProbeAt = 0;
let shellTray = null;
let latestShellState = null;
let shellTraySupported = true;
let shellTrayError = null;
let inventoryWin = null;
let inventoryWindowActiveTab = SHELL_WINDOW_TABS.inventory;
let zoneSelectorWin = null;
let roamTimer = null;
let appIsQuitting = false;
const propWindows = new Map();
const dialogPresence = {
  surfaceOpen: false,
  updatedAtMs: 0,
};
let dialogUserMessageInFlightCount = 0;
const proactiveConversationState = createInitialProactivePolicyState();
latestProactivePolicySnapshot = buildProactivePolicySnapshot(proactiveConversationState, Date.now());
const reflectionContextTokens = new Set();
const reflectionRuntimeState = createInitialReflectionRuntimeState({
  nowMs: Date.now(),
  digestHourLocal: REFLECTION_DEFAULTS.digestHourLocal,
  digestMinuteLocal: REFLECTION_DEFAULTS.digestMinuteLocal,
});
latestReflectionRuntimeSnapshot = {
  ...reflectionRuntimeState,
};

const flingState = {
  active: false,
  vx: 0,
  vy: 0,
  lastStepMs: 0,
  x: 0,
  y: 0,
};
const roamState = {
  phase: "idle",
  destination: null,
  inspectAnchor: null,
  queuedDestination: null,
  roamBounds: null,
  petBounds: null,
  speedPxPerSec: 0,
  clip: "Walk",
  direction: null,
  x: 0,
  y: 0,
  legStartX: null,
  legStartY: null,
  lastLegVector: null,
  lastLegCompletedAtMs: 0,
  lastStepMs: 0,
  nextDecisionAtMs: 0,
  foregroundRevisionAtLegStart: 0,
  mediaWatchFocusMismatchSinceMs: 0,
};
const roamPolicyState = createInitialRoamPolicyState({
  nowMs: Date.now(),
  monitorAvoidMs: DEFAULT_MONITOR_AVOID_MS,
  windowAvoidMs: WINDOW_AVOID_MS,
});
let manualCorrectionStartDisplayId = null;
let manualWindowCorrectionStartContext = null;

const foregroundWindowRuntime = {
  source: WINDOWS_FOREGROUND_WINDOW_SOURCE,
  state: process.platform === "win32" ? "degraded" : "disabled",
  reason:
    process.platform === "win32"
      ? ROAM_POLICY_DECISION_REASONS.foregroundWindowProviderUnavailable
      : ROAM_POLICY_DECISION_REASONS.windowAvoidanceNotSupportedPlatform,
  decisionReason: "none",
  fallbackReason: "none",
  avoidMaskBounds: null,
  avoidMarginPx: ACTIVE_WINDOW_AVOID_MARGIN_PX,
  foregroundWindowBounds: null,
  foregroundWindowWindowId: null,
  foregroundWindowRevision: 0,
  windowInspectState: "idle",
  windowInspectReason: "none",
  windowInspectAnchorLane: "none",
  windowInspectAnchorPoint: null,
  windowInspectDwellMs: WINDOW_EDGE_INSPECT_DWELL_MS,
};

const windowInspectPolicy = {
  focusedWindowId: null,
  focusedSinceMs: 0,
  lastInspectAtMs: 0,
  lastInspectWindowId: null,
  byWindowLastInspectAtMs: new Map(),
};

const PET_LAYOUT = computePetLayout(BASE_LAYOUT);
const WINDOW_SIZE = PET_LAYOUT.windowSize;
// These bounds describe the visible pet shape inside the transparent window.
const PET_VISUAL_BOUNDS = PET_LAYOUT.visualBounds;
let activePetVisualBounds = { ...PET_VISUAL_BOUNDS };
let runtimePetLayout = PET_LAYOUT;
let runtimeWindowSize = WINDOW_SIZE;
let runtimeVisualBounds = PET_VISUAL_BOUNDS;
let runtimeHitboxScale = 1;
const animationManifestCache = new Map();

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function getPetWindowSize() {
  return runtimeWindowSize || WINDOW_SIZE;
}

function getPetLayout() {
  return runtimePetLayout || PET_LAYOUT;
}

function getBasePetVisualBounds() {
  return runtimeVisualBounds || PET_VISUAL_BOUNDS;
}

function scalePetBounds(bounds, scale, windowSize = getPetWindowSize()) {
  if (
    !bounds ||
    !Number.isFinite(bounds.x) ||
    !Number.isFinite(bounds.y) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height)
  ) {
    return null;
  }
  const safeScale = Number.isFinite(scale) ? Math.max(0.2, scale) : 1;
  const width = Math.max(1, Math.round(bounds.width * safeScale));
  const height = Math.max(1, Math.round(bounds.height * safeScale));
  const centerX = bounds.x + bounds.width * 0.5;
  const centerY = bounds.y + bounds.height * 0.5;
  const nextWidth = Math.min(width, windowSize.width);
  const nextHeight = Math.min(height, windowSize.height);
  const unclampedX = Math.round(centerX - nextWidth * 0.5);
  const unclampedY = Math.round(centerY - nextHeight * 0.5);
  return {
    x: clampNumber(unclampedX, 0, Math.max(0, windowSize.width - nextWidth)),
    y: clampNumber(unclampedY, 0, Math.max(0, windowSize.height - nextHeight)),
    width: nextWidth,
    height: nextHeight,
  };
}

function resolveCharacterScalePercent(settings = runtimeSettings) {
  const requested = Number(settings?.ui?.characterScalePercent);
  return clampNumber(
    Number.isFinite(requested) ? requested : DEFAULT_CHARACTER_SCALE_PERCENT,
    MIN_CHARACTER_SCALE_PERCENT,
    MAX_CHARACTER_SCALE_PERCENT
  );
}

function resolveCharacterHitboxScalePercent(settings = runtimeSettings) {
  return resolveCharacterScalePercent(settings);
}

function asPositiveInteger(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.round(numeric));
}

function asFiniteNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function sanitizeHitbox(rawHitbox, cell) {
  if (!rawHitbox || typeof rawHitbox !== "object") return null;
  const x = asFiniteNumber(rawHitbox.x, NaN);
  const y = asFiniteNumber(rawHitbox.y, NaN);
  const width = asFiniteNumber(rawHitbox.width, NaN);
  const height = asFiniteNumber(rawHitbox.height, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  if (width <= 0 || height <= 0) return null;

  const normalizedX = Math.max(0, Math.min(cell.width - 1, Math.round(x)));
  const normalizedY = Math.max(0, Math.min(cell.height - 1, Math.round(y)));
  return {
    x: normalizedX,
    y: normalizedY,
    width: Math.max(1, Math.min(cell.width - normalizedX, Math.round(width))),
    height: Math.max(1, Math.min(cell.height - normalizedY, Math.round(height))),
  };
}

function sanitizeStateDefinition(stateName, rawState, cell) {
  if (!rawState || typeof rawState !== "object") {
    throw new Error(`Animation state "${stateName}" is missing or invalid.`);
  }
  const sheetPattern =
    typeof rawState.sheetPattern === "string" && rawState.sheetPattern.trim().length > 0
      ? rawState.sheetPattern.trim()
      : null;
  if (!sheetPattern) {
    throw new Error(`Animation state "${stateName}" is missing "sheetPattern".`);
  }

  const columns = asPositiveInteger(rawState.columns, 4);
  const frameCount = asPositiveInteger(rawState.frameCount, 1);
  const fps = asPositiveInteger(rawState.fps, 10);
  const loop = typeof rawState.loop === "boolean" ? rawState.loop : true;
  const nextState =
    typeof rawState.nextState === "string" && rawState.nextState.trim().length > 0
      ? rawState.nextState.trim()
      : "IdleReady";

  return {
    sheetPattern,
    columns,
    frameCount,
    fps,
    loop,
    nextState,
    hitboxPx: sanitizeHitbox(rawState.hitboxPx, cell),
  };
}

function readAnimationManifest(characterId) {
  if (typeof characterId !== "string" || !/^[a-z0-9_-]+$/i.test(characterId)) {
    throw new Error(`Invalid character id "${characterId}".`);
  }

  const cached = animationManifestCache.get(characterId);
  if (cached) return cached;

  const characterDir = path.join(CHARACTER_ASSETS_ROOT, characterId);
  const manifestPath = path.join(characterDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing animation manifest: ${manifestPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const directions = Array.isArray(raw?.directions)
    ? raw.directions.filter((value) => typeof value === "string" && value.trim().length > 0)
    : [];
  if (directions.length !== REQUIRED_SPRITE_DIRECTIONS.length) {
    throw new Error(`Manifest "${characterId}" directions are incomplete.`);
  }
  for (const requiredDirection of REQUIRED_SPRITE_DIRECTIONS) {
    if (!directions.includes(requiredDirection)) {
      throw new Error(`Manifest "${characterId}" is missing direction "${requiredDirection}".`);
    }
  }

  const cell = {
    width: asPositiveInteger(raw?.cell?.width, 256),
    height: asPositiveInteger(raw?.cell?.height, 256),
  };
  const normalized = {
    version: asPositiveInteger(raw?.version, 1),
    characterId,
    directions,
    cell,
    pivotPx: {
      x: Math.max(0, Math.min(cell.width, asFiniteNumber(raw?.pivotPx?.x, Math.round(cell.width / 2)))),
      y: Math.max(0, Math.min(cell.height, asFiniteNumber(raw?.pivotPx?.y, cell.height))),
    },
    display: {
      targetHeightPx: asPositiveInteger(raw?.display?.targetHeightPx, 220),
    },
    states: {},
  };

  if (!raw?.states || typeof raw.states !== "object") {
    throw new Error(`Manifest "${characterId}" is missing states.`);
  }

  for (const [stateName, rawState] of Object.entries(raw.states)) {
    normalized.states[stateName] = sanitizeStateDefinition(stateName, rawState, cell);
  }

  for (const requiredState of REQUIRED_SPRITE_STATES) {
    if (!normalized.states[requiredState]) {
      throw new Error(`Manifest "${characterId}" is missing state "${requiredState}".`);
    }
  }

  const payload = {
    characterId,
    basePath: path.relative(__dirname, characterDir).split(path.sep).join("/"),
    manifest: normalized,
  };

  animationManifestCache.set(characterId, payload);
  return payload;
}

function getAvailableSpriteStateIds(characterId = DEFAULT_CHARACTER_ID) {
  try {
    return Object.keys(readAnimationManifest(characterId)?.manifest?.states || {});
  } catch (error) {
    console.warn(
      `[pet-state] failed to read sprite manifest for state runtime: ${error?.message || String(error)}`
    );
    return [...REQUIRED_SPRITE_STATES];
  }
}

function summarizeDisplay(display) {
  return {
    id: display.id,
    label: display.label,
    scaleFactor: display.scaleFactor,
    bounds: display.bounds,
    workArea: display.workArea,
  };
}

function createInitialIntegrationProbeState() {
  return {
    state: "pending",
    reason: "probePending",
    fallbackMode: "probe_pending",
    lastProbeAt: 0,
    lastSuccessAt: 0,
    lastFailureAt: 0,
    error: null,
  };
}

function createInitialLocalMediaSnapshot() {
  return {
    ok: false,
    source: WINDOWS_MEDIA_SOURCE,
    isPlaying: false,
    playbackStatus: "Idle",
    provider: "local_media",
    sourceAppLabel: "Windows Media",
    sourceAppUserModelId: null,
    title: null,
    artist: null,
    album: null,
    outputRoute: "unknown",
    outputDeviceName: "unknown_device",
    outputDeviceType: "unknown",
    ts: 0,
    error: "probe_pending",
  };
}

function isMusicStateId(stateId) {
  return stateId === "MusicChill" || stateId === "MusicDance";
}

function getLocalMediaSensorSettings() {
  const settings = runtimeSettings?.sensors?.media || {};
  return {
    enabled: Boolean(settings.enabled),
    backend: settings.backend || "powershell",
    pollIntervalMs: Number.isFinite(Number(settings.pollIntervalMs))
      ? Math.max(500, Math.round(Number(settings.pollIntervalMs)))
      : 2500,
    probeTimeoutMs: Number.isFinite(Number(settings.probeTimeoutMs))
      ? Math.max(250, Math.round(Number(settings.probeTimeoutMs)))
      : 1800,
    includeOutputDevice: settings.includeOutputDevice !== false,
  };
}

function getForegroundWindowSensorSettings() {
  return {
    enabled: true,
    backend: "powershell",
    pollIntervalMs: FOREGROUND_WINDOW_POLL_MS,
    probeTimeoutMs: FOREGROUND_WINDOW_PROBE_TIMEOUT_MS,
  };
}

function createInitialForegroundWindowSnapshot(error = "probe_pending") {
  return {
    ok: false,
    source: WINDOWS_FOREGROUND_WINDOW_SOURCE,
    windowId: null,
    processId: null,
    processName: null,
    title: null,
    bounds: null,
    ts: 0,
    error,
  };
}

function resolveForegroundWindowProbeReason(errorCode = "") {
  const normalized = typeof errorCode === "string" ? errorCode.trim() : "";
  if (normalized === "probe_script_missing" || normalized === "disabled_by_config") {
    return ROAM_POLICY_DECISION_REASONS.foregroundWindowProviderUnavailable;
  }
  return ROAM_POLICY_DECISION_REASONS.foregroundWindowQueryFailed;
}

function isForegroundWindowAvoidanceSupported() {
  return process.platform === "win32";
}

function isForegroundWindowAvoidanceDesktopMode() {
  const roamMode = latestShellState?.roaming?.mode || ROAMING_MODES.desktop;
  return roamMode === ROAMING_MODES.desktop;
}

function updateForegroundWindowRuntimeDisabled(reason) {
  foregroundWindowRuntime.state = "disabled";
  foregroundWindowRuntime.reason = reason;
  foregroundWindowRuntime.decisionReason = reason;
  foregroundWindowRuntime.fallbackReason = "none";
  foregroundWindowRuntime.foregroundWindowBounds = null;
  foregroundWindowRuntime.foregroundWindowWindowId = null;
  foregroundWindowRuntime.avoidMaskBounds = null;
  resetWindowInspectFocusTracking();
  if (roamState.phase !== "inspect_dwell") {
    foregroundWindowRuntime.windowInspectState = "idle";
    foregroundWindowRuntime.windowInspectReason = "none";
    foregroundWindowRuntime.windowInspectAnchorLane = "none";
    foregroundWindowRuntime.windowInspectAnchorPoint = null;
  }
}

function getForegroundWindowCenterPoint(bounds) {
  const normalized = normalizeBoundsRect(bounds);
  if (!normalized) return null;
  return {
    x: Math.round(normalized.x + normalized.width * 0.5),
    y: Math.round(normalized.y + normalized.height * 0.5),
  };
}

function getPetVisualCenterAtWindowPosition(windowX, windowY, petBounds = null) {
  const safePetBounds = petBounds || getRoamPetBounds();
  const normalized = normalizeBoundsRect(safePetBounds);
  if (!normalized) return null;
  return {
    x: Math.round(windowX + normalized.x + normalized.width * 0.5),
    y: Math.round(windowY + normalized.y + normalized.height * 0.5),
  };
}

function resetWindowInspectFocusTracking() {
  windowInspectPolicy.focusedWindowId = null;
  windowInspectPolicy.focusedSinceMs = 0;
}

function updateWindowInspectFocusTracking(windowId, nowMs = Date.now()) {
  const normalizedWindowId =
    typeof windowId === "string" && windowId.trim().length > 0 ? windowId.trim() : null;
  if (!normalizedWindowId) {
    resetWindowInspectFocusTracking();
    return null;
  }
  if (windowInspectPolicy.focusedWindowId !== normalizedWindowId) {
    windowInspectPolicy.focusedWindowId = normalizedWindowId;
    windowInspectPolicy.focusedSinceMs = nowMs;
  }
  return normalizedWindowId;
}

function pruneWindowInspectHistory(nowMs = Date.now()) {
  const cutoffMs = nowMs - Math.max(WINDOW_INSPECT_WINDOW_COOLDOWN_MS * 3, WINDOW_AVOID_MS * 2);
  for (const [windowId, lastAtMs] of windowInspectPolicy.byWindowLastInspectAtMs.entries()) {
    if (!Number.isFinite(Number(lastAtMs)) || Number(lastAtMs) < cutoffMs) {
      windowInspectPolicy.byWindowLastInspectAtMs.delete(windowId);
    }
  }
}

function canTriggerWindowInspect(windowId, nowMs = Date.now()) {
  const normalizedWindowId = updateWindowInspectFocusTracking(windowId, nowMs);
  if (!normalizedWindowId) {
    return {
      allowed: false,
      reason: "window_id_missing",
    };
  }

  pruneWindowInspectHistory(nowMs);

  if (nowMs - windowInspectPolicy.focusedSinceMs < WINDOW_INSPECT_MIN_FOCUS_MS) {
    return {
      allowed: false,
      reason: "focus_unstable",
    };
  }
  if (nowMs - windowInspectPolicy.lastInspectAtMs < WINDOW_INSPECT_GLOBAL_COOLDOWN_MS) {
    return {
      allowed: false,
      reason: "global_cooldown",
    };
  }
  const lastInspectAtForWindow = Number(windowInspectPolicy.byWindowLastInspectAtMs.get(normalizedWindowId));
  if (
    Number.isFinite(lastInspectAtForWindow) &&
    nowMs - lastInspectAtForWindow < WINDOW_INSPECT_WINDOW_COOLDOWN_MS
  ) {
    return {
      allowed: false,
      reason: "window_cooldown",
    };
  }
  if (Math.random() > WINDOW_INSPECT_TRIGGER_PROBABILITY) {
    return {
      allowed: false,
      reason: "random_defer",
    };
  }
  return {
    allowed: true,
    reason: "eligible",
  };
}

function recordWindowInspectActivation(windowId, nowMs = Date.now()) {
  const normalizedWindowId =
    typeof windowId === "string" && windowId.trim().length > 0 ? windowId.trim() : null;
  if (!normalizedWindowId) return;
  windowInspectPolicy.lastInspectAtMs = nowMs;
  windowInspectPolicy.lastInspectWindowId = normalizedWindowId;
  windowInspectPolicy.byWindowLastInspectAtMs.set(normalizedWindowId, nowMs);
}

function intersectsAnySamplingArea(bounds, samplingAreas = []) {
  const normalizedBounds = normalizeBoundsRect(bounds);
  if (!normalizedBounds) return false;
  if (!Array.isArray(samplingAreas) || samplingAreas.length <= 0) return false;
  return samplingAreas.some((entry) => Boolean(intersectBoundsRect(normalizedBounds, entry)));
}

function buildPetVisualWorldBoundsAt(windowX, windowY, nowMs = Date.now()) {
  const petBounds = getRoamPetBounds(nowMs);
  return normalizeBoundsRect({
    x: Math.round(windowX + petBounds.x),
    y: Math.round(windowY + petBounds.y),
    width: petBounds.width,
    height: petBounds.height,
  });
}

async function pollForegroundWindowState({ force = false, trigger = "interval" } = {}) {
  const sensorSettings = getForegroundWindowSensorSettings();
  const nowMs = Date.now();
  if (!isForegroundWindowAvoidanceSupported()) {
    latestForegroundWindowSnapshot = createInitialForegroundWindowSnapshot("unsupported_platform");
    updateForegroundWindowRuntimeDisabled(
      ROAM_POLICY_DECISION_REASONS.windowAvoidanceNotSupportedPlatform
    );
    return {
      ok: true,
      snapshot: latestForegroundWindowSnapshot,
      trigger,
    };
  }
  if (!isForegroundWindowAvoidanceDesktopMode()) {
    updateForegroundWindowRuntimeDisabled(
      ROAM_POLICY_DECISION_REASONS.windowAvoidanceNotDesktopMode
    );
    return {
      ok: true,
      snapshot: latestForegroundWindowSnapshot || createInitialForegroundWindowSnapshot(),
      trigger,
    };
  }
  if (!sensorSettings.enabled) {
    foregroundWindowRuntime.state = "degraded";
    foregroundWindowRuntime.reason = ROAM_POLICY_DECISION_REASONS.foregroundWindowProviderUnavailable;
    foregroundWindowRuntime.decisionReason = foregroundWindowRuntime.reason;
    latestForegroundWindowSnapshot = createInitialForegroundWindowSnapshot("disabled_by_config");
    return {
      ok: false,
      snapshot: latestForegroundWindowSnapshot,
      error: "disabled_by_config",
      trigger,
    };
  }
  if (
    !force &&
    nowMs - lastForegroundWindowPollRequestAtMs <
      Math.max(100, Math.round(Number(sensorSettings.pollIntervalMs) || FOREGROUND_WINDOW_POLL_MS))
  ) {
    return {
      ok: true,
      snapshot: latestForegroundWindowSnapshot || createInitialForegroundWindowSnapshot(),
      trigger,
    };
  }
  if (foregroundWindowProbeInFlight) {
    return {
      ok: true,
      snapshot: latestForegroundWindowSnapshot || createInitialForegroundWindowSnapshot(),
      trigger,
    };
  }

  lastForegroundWindowPollRequestAtMs = nowMs;
  foregroundWindowProbeInFlight = true;
  try {
    const snapshot = await probeForegroundWindowState({
      settings: sensorSettings,
    });
    latestForegroundWindowSnapshot = snapshot;
    const nextProbeKey = buildForegroundWindowProbeKey(snapshot);
    const changed = force || nextProbeKey !== lastForegroundWindowProbeKey;
    if (changed) {
      lastForegroundWindowProbeKey = nextProbeKey;
      if (snapshot.ok) {
        foregroundWindowRuntime.foregroundWindowRevision += 1;
      }
    }
    if (snapshot.ok) {
      foregroundWindowRuntime.state = "healthy";
      foregroundWindowRuntime.reason = ROAM_POLICY_DECISION_REASONS.foregroundWindowNominal;
      foregroundWindowRuntime.foregroundWindowWindowId = snapshot.windowId || null;
      foregroundWindowRuntime.foregroundWindowBounds = normalizeBoundsRect(snapshot.bounds);
      if (changed && roamState.phase === "moving" && roamState.foregroundRevisionAtLegStart > 0) {
        const currentRevision = foregroundWindowRuntime.foregroundWindowRevision;
        if (currentRevision > roamState.foregroundRevisionAtLegStart) {
          markRoamPolicyDecision(
            roamPolicyState,
            ROAM_POLICY_DECISION_REASONS.foregroundWindowBoundsUpdated,
            Date.now()
          );
          finishRoamLeg("foreground_window_bounds_updated", Date.now());
        }
      }
      return {
        ok: true,
        snapshot,
        changed,
        trigger,
      };
    }

    foregroundWindowRuntime.state = "degraded";
    foregroundWindowRuntime.reason = resolveForegroundWindowProbeReason(snapshot.error);
    foregroundWindowRuntime.decisionReason = foregroundWindowRuntime.reason;
    foregroundWindowRuntime.foregroundWindowWindowId = null;
    foregroundWindowRuntime.foregroundWindowBounds = null;
    foregroundWindowRuntime.avoidMaskBounds = null;
    if (roamState.phase !== "inspect_dwell") {
      foregroundWindowRuntime.windowInspectState = "idle";
      foregroundWindowRuntime.windowInspectReason = "none";
      foregroundWindowRuntime.windowInspectAnchorLane = "none";
      foregroundWindowRuntime.windowInspectAnchorPoint = null;
    }
    return {
      ok: false,
      snapshot,
      changed,
      error: snapshot.error || "probe_failed",
      trigger,
    };
  } finally {
    foregroundWindowProbeInFlight = false;
  }
}

function requestForegroundWindowPoll(trigger = "interval", force = false) {
  void pollForegroundWindowState({
    force,
    trigger,
  });
}

function resolveForegroundWindowCandidate({
  samplingAreas = [],
  nowMs = Date.now(),
} = {}) {
  if (!isForegroundWindowAvoidanceSupported()) {
    updateForegroundWindowRuntimeDisabled(
      ROAM_POLICY_DECISION_REASONS.windowAvoidanceNotSupportedPlatform
    );
    return {
      state: "disabled",
      reason: ROAM_POLICY_DECISION_REASONS.windowAvoidanceNotSupportedPlatform,
      candidate: null,
    };
  }
  if (!isForegroundWindowAvoidanceDesktopMode()) {
    updateForegroundWindowRuntimeDisabled(
      ROAM_POLICY_DECISION_REASONS.windowAvoidanceNotDesktopMode
    );
    return {
      state: "disabled",
      reason: ROAM_POLICY_DECISION_REASONS.windowAvoidanceNotDesktopMode,
      candidate: null,
    };
  }

  const snapshot = latestForegroundWindowSnapshot || createInitialForegroundWindowSnapshot();
  if (!snapshot.ok) {
    foregroundWindowRuntime.state = "degraded";
    foregroundWindowRuntime.reason = resolveForegroundWindowProbeReason(snapshot.error);
    foregroundWindowRuntime.decisionReason = foregroundWindowRuntime.reason;
    foregroundWindowRuntime.foregroundWindowBounds = null;
    foregroundWindowRuntime.foregroundWindowWindowId = null;
    foregroundWindowRuntime.avoidMaskBounds = null;
    return {
      state: "degraded",
      reason: foregroundWindowRuntime.reason,
      candidate: null,
    };
  }

  const normalizedBounds = normalizeBoundsRect(snapshot.bounds);
  if (!normalizedBounds) {
    foregroundWindowRuntime.state = "healthy";
    foregroundWindowRuntime.reason = ROAM_POLICY_DECISION_REASONS.foregroundWindowNominal;
    foregroundWindowRuntime.decisionReason = ROAM_POLICY_DECISION_REASONS.foregroundWindowNominal;
    foregroundWindowRuntime.foregroundWindowBounds = null;
    foregroundWindowRuntime.foregroundWindowWindowId = null;
    return {
      state: "healthy",
      reason: ROAM_POLICY_DECISION_REASONS.foregroundWindowNominal,
      candidate: null,
    };
  }

  if (Number.isFinite(Number(snapshot.processId)) && Math.round(Number(snapshot.processId)) === process.pid) {
    foregroundWindowRuntime.state = "healthy";
    foregroundWindowRuntime.reason = ROAM_POLICY_DECISION_REASONS.foregroundWindowNominal;
    foregroundWindowRuntime.decisionReason = ROAM_POLICY_DECISION_REASONS.foregroundWindowNominal;
    foregroundWindowRuntime.foregroundWindowBounds = null;
    foregroundWindowRuntime.foregroundWindowWindowId = null;
    return {
      state: "healthy",
      reason: ROAM_POLICY_DECISION_REASONS.foregroundWindowNominal,
      candidate: null,
    };
  }

  if (!intersectsAnySamplingArea(normalizedBounds, samplingAreas)) {
    foregroundWindowRuntime.state = "healthy";
    foregroundWindowRuntime.reason = ROAM_POLICY_DECISION_REASONS.foregroundWindowNominal;
    foregroundWindowRuntime.decisionReason = ROAM_POLICY_DECISION_REASONS.foregroundWindowNominal;
    foregroundWindowRuntime.foregroundWindowBounds = null;
    foregroundWindowRuntime.foregroundWindowWindowId = null;
    return {
      state: "healthy",
      reason: ROAM_POLICY_DECISION_REASONS.foregroundWindowNominal,
      candidate: null,
    };
  }

  const center = getForegroundWindowCenterPoint(normalizedBounds);
  const display = center ? screen.getDisplayNearestPoint(center) : null;
  const displayId = Number.isFinite(Number(display?.id)) ? String(Math.round(Number(display.id))) : null;
  foregroundWindowRuntime.state = "healthy";
  foregroundWindowRuntime.reason = ROAM_POLICY_DECISION_REASONS.foregroundWindowNominal;
  foregroundWindowRuntime.decisionReason = ROAM_POLICY_DECISION_REASONS.foregroundWindowNominal;
  foregroundWindowRuntime.foregroundWindowBounds = normalizedBounds;
  foregroundWindowRuntime.foregroundWindowWindowId = snapshot.windowId || null;
  return {
    state: "healthy",
    reason: ROAM_POLICY_DECISION_REASONS.foregroundWindowNominal,
    candidate: {
      windowId: snapshot.windowId,
      bounds: normalizedBounds,
      displayId,
      processId: Number.isFinite(Number(snapshot.processId))
        ? Math.round(Number(snapshot.processId))
        : null,
      processName: snapshot.processName || null,
      title: snapshot.title || null,
      ts: Number.isFinite(Number(snapshot.ts)) ? Math.round(Number(snapshot.ts)) : nowMs,
    },
  };
}

function getSpotifyBackgroundPollCadenceMs() {
  const cadenceMinutes = Number(runtimeSettings?.integrations?.spotify?.pollCadenceMinutes);
  if (!Number.isFinite(cadenceMinutes)) return 10 * 60 * 1000;
  return Math.max(60 * 1000, Math.round(cadenceMinutes * 60 * 1000));
}

function getFreshRssBackgroundPollCadenceMs() {
  const cadenceMinutes = Number(runtimeSettings?.integrations?.freshRss?.pollCadenceMinutes);
  if (!Number.isFinite(cadenceMinutes)) return 30 * 60 * 1000;
  return Math.max(5 * 60 * 1000, Math.round(cadenceMinutes * 60 * 1000));
}

function buildLocalMediaIntegrationEvent(snapshot, extras = {}) {
  let defaultText = buildLocalMediaResponseText(snapshot);
  if (!snapshot?.ok) {
    defaultText =
      snapshot?.error === "disabled_by_config"
        ? "Local media sensor is disabled by config."
        : `Local media probe degraded: ${snapshot?.error || "unknown_error"}.`;
  }
  return {
    kind: "localMedia",
    correlationId: extras.correlationId || createContractCorrelationId(),
    provider: snapshot?.provider || "local_media",
    source: "local",
    mediaSource: snapshot?.source || WINDOWS_MEDIA_SOURCE,
    sourceAppLabel: snapshot?.sourceAppLabel || "Windows Media",
    playbackStatus: snapshot?.playbackStatus || "Unknown",
    isPlaying: Boolean(snapshot?.isPlaying),
    outputRoute: snapshot?.outputRoute || "unknown",
    outputDeviceName: snapshot?.outputDeviceName || "unknown_device",
    capabilityState: snapshot?.ok ? "healthy" : "degraded",
    fallbackMode: snapshot?.ok ? "none" : snapshot?.error || "local_media_probe_failed",
    text:
      typeof extras.text === "string" && extras.text.length > 0
        ? extras.text
        : defaultText,
    ts: Number.isFinite(snapshot?.ts) ? snapshot.ts : Date.now(),
  };
}

function getPreferredSpotifyOutputContext() {
  if (!latestLocalMediaSnapshot?.isPlaying) return null;
  if (latestLocalMediaSnapshot.provider !== "spotify") return null;
  return {
    outputRoute: latestLocalMediaSnapshot.outputRoute || "unknown",
    outputDeviceName: latestLocalMediaSnapshot.outputDeviceName || "unknown_device",
    outputDeviceType: latestLocalMediaSnapshot.outputDeviceType || "unknown",
  };
}

function applyPreferredOutputContext(nowPlaying, preferredOutputContext) {
  const preferred =
    preferredOutputContext && typeof preferredOutputContext === "object"
      ? preferredOutputContext
      : null;
  if (!nowPlaying || !preferred) return nowPlaying;
  if (
    nowPlaying.outputRoute &&
    nowPlaying.outputRoute !== "unknown" &&
    nowPlaying.outputDeviceName &&
    nowPlaying.outputDeviceName !== "unknown_device"
  ) {
    return nowPlaying;
  }
  return {
    ...nowPlaying,
    outputRoute:
      nowPlaying.outputRoute && nowPlaying.outputRoute !== "unknown"
        ? nowPlaying.outputRoute
        : preferred.outputRoute || "unknown",
    outputDeviceName:
      nowPlaying.outputDeviceName && nowPlaying.outputDeviceName !== "unknown_device"
        ? nowPlaying.outputDeviceName
        : preferred.outputDeviceName || "unknown_device",
    outputDeviceType:
      nowPlaying.outputDeviceType && nowPlaying.outputDeviceType !== "unknown"
        ? nowPlaying.outputDeviceType
        : preferred.outputDeviceType || "unknown",
  };
}

function normalizeLowerText(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function hasAnyHint(text, hints = []) {
  const normalized = normalizeLowerText(text);
  if (!normalized) return false;
  return hints.some((hint) => normalized.includes(normalizeLowerText(hint)));
}

function hasKnownMediaExtension(text, extensions = []) {
  const normalized = normalizeLowerText(text);
  if (!normalized) return false;
  return extensions.some((ext) => normalized.includes(normalizeLowerText(ext)));
}

function stableStringHash(value) {
  const input = typeof value === "string" ? value : String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashUnitFromString(value) {
  return (stableStringHash(value) % 1000000) / 1000000;
}

function chooseMusicSuggestedState(snapshot = {}) {
  const provider = normalizeLowerText(snapshot.provider || snapshot.sourceAppLabel || "local_media");
  const outputRoute = normalizeLowerText(snapshot.outputRoute || "unknown");
  const identity = [
    provider,
    normalizeLowerText(snapshot.sourceAppLabel || ""),
    normalizeLowerText(snapshot.title || ""),
    normalizeLowerText(snapshot.artist || ""),
    normalizeLowerText(snapshot.album || ""),
    outputRoute,
  ].join("|");
  const unit = hashUnitFromString(identity);
  let danceBias = 0.62;
  if (provider.includes("spotify")) danceBias += 0.1;
  if (outputRoute === "speaker") danceBias += 0.12;
  if (outputRoute === "headphones") danceBias += 0.05;
  danceBias = Math.max(0.2, Math.min(0.9, danceBias));
  return unit < danceBias ? "MusicDance" : "MusicChill";
}

function getForegroundCoverageRatio(bounds) {
  const normalizedBounds = normalizeBoundsRect(bounds);
  if (!normalizedBounds) return 0;
  const center = getForegroundWindowCenterPoint(normalizedBounds);
  const display = center ? screen.getDisplayNearestPoint(center) : null;
  const area = display ? getClampArea(display) : null;
  const normalizedArea = normalizeBoundsRect(area);
  if (!normalizedArea) return 0;
  const overlap = intersectBoundsRect(normalizedBounds, normalizedArea);
  if (!overlap) return 0;
  const overlapArea = overlap.width * overlap.height;
  const displayArea = normalizedArea.width * normalizedArea.height;
  if (displayArea <= 0) return 0;
  return Math.max(0, Math.min(1, overlapArea / displayArea));
}

function deriveMediaPlaybackSuggestion(snapshot = {}, options = {}) {
  const mediaSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
  if (!mediaSnapshot.isPlaying) {
    return {
      mediaKind: "idle",
      suggestedState: "Idle",
      reason: "not_playing",
    };
  }

  const provider = normalizeLowerText(mediaSnapshot.provider || "local_media");
  const sourceAppLabel = normalizeLowerText(mediaSnapshot.sourceAppLabel || "");
  const sourceAppUserModelId = normalizeLowerText(mediaSnapshot.sourceAppUserModelId || "");
  const title = normalizeLowerText(mediaSnapshot.title || "");
  const foregroundSnapshot =
    options.foregroundSnapshot && typeof options.foregroundSnapshot === "object"
      ? options.foregroundSnapshot
      : latestForegroundWindowSnapshot;
  const foregroundTitle = normalizeLowerText(foregroundSnapshot?.title || "");
  const foregroundProcessName = normalizeLowerText(foregroundSnapshot?.processName || "");
  const sourceIdentity = `${provider} ${sourceAppLabel} ${sourceAppUserModelId} ${foregroundProcessName}`.trim();
  const combined = `${sourceIdentity} ${title} ${foregroundTitle}`.trim();
  const titleLooksAudio = hasKnownMediaExtension(title, MEDIA_AUDIO_EXTENSIONS);
  const titleLooksVideo = hasKnownMediaExtension(title, MEDIA_VIDEO_EXTENSIONS);
  const sourceLooksBrowser =
    MEDIA_BROWSER_PROVIDERS.has(provider) || hasAnyHint(sourceIdentity, MEDIA_BROWSER_PROVIDER_HINTS);
  const browserStrongMusicHint = hasAnyHint(combined, MEDIA_BROWSER_STRONG_MUSIC_HINTS);
  const browserMusicHint = hasAnyHint(combined, MEDIA_BROWSER_MUSIC_HINTS);
  const browserVideoHint = hasAnyHint(combined, MEDIA_BROWSER_VIDEO_HINTS);

  if (MEDIA_VIDEO_PROVIDERS.has(provider)) {
    return {
      mediaKind: "video",
      suggestedState: "WatchMode",
      reason: "video_provider",
    };
  }
  if (provider === "spotify") {
    return {
      mediaKind: "music",
      suggestedState: chooseMusicSuggestedState(mediaSnapshot),
      reason: "spotify_music",
    };
  }
  if (provider === "vlc" || sourceAppLabel.includes("vlc")) {
    if (titleLooksAudio) {
      return {
        mediaKind: "music",
        suggestedState: chooseMusicSuggestedState(mediaSnapshot),
        reason: "vlc_audio_track",
      };
    }
    return {
      mediaKind: "video",
      suggestedState: "WatchMode",
      reason: titleLooksVideo ? "vlc_video_track" : "vlc_default_video",
    };
  }
  if (
    sourceAppLabel.includes("windows media player") ||
    sourceAppLabel.includes("media player")
  ) {
    if (titleLooksAudio) {
      return {
        mediaKind: "music",
        suggestedState: chooseMusicSuggestedState(mediaSnapshot),
        reason: "wmp_audio_track",
      };
    }
    if (titleLooksVideo) {
      return {
        mediaKind: "video",
        suggestedState: "WatchMode",
        reason: "wmp_video_track",
      };
    }
  }
  if (sourceLooksBrowser) {
    if (browserStrongMusicHint) {
      return {
        mediaKind: "music",
        suggestedState: chooseMusicSuggestedState(mediaSnapshot),
        reason: "browser_music_strong_hint",
      };
    }
    if (browserVideoHint) {
      return {
        mediaKind: "video",
        suggestedState: "WatchMode",
        reason: "browser_video_hint",
      };
    }
    if (browserMusicHint) {
      return {
        mediaKind: "music",
        suggestedState: chooseMusicSuggestedState(mediaSnapshot),
        reason: "browser_music_hint",
      };
    }
    if (getForegroundCoverageRatio(foregroundSnapshot?.bounds) >= 0.55) {
      return {
        mediaKind: "video",
        suggestedState: "WatchMode",
        reason: "browser_large_foreground_window",
      };
    }
    return {
      mediaKind: "video",
      suggestedState: "WatchMode",
      reason: "browser_default_video",
    };
  }
  if (titleLooksVideo) {
    return {
      mediaKind: "video",
      suggestedState: "WatchMode",
      reason: "video_extension_hint",
    };
  }
  if (titleLooksAudio) {
    return {
      mediaKind: "music",
      suggestedState: chooseMusicSuggestedState(mediaSnapshot),
      reason: "audio_extension_hint",
    };
  }
  return {
    mediaKind: "music",
    suggestedState: chooseMusicSuggestedState(mediaSnapshot),
    reason: "default_music_fallback",
  };
}

function buildLocalMediaContractSignature(snapshot = {}, mediaSuggestion = {}) {
  const normalizedSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
  const normalizedSuggestion = mediaSuggestion && typeof mediaSuggestion === "object" ? mediaSuggestion : {};
  return JSON.stringify({
    playing: Boolean(normalizedSnapshot.isPlaying),
    provider: normalizeLowerText(normalizedSnapshot.provider || "local_media"),
    sourceAppLabel: normalizeLowerText(normalizedSnapshot.sourceAppLabel || ""),
    title: normalizeLowerText(normalizedSnapshot.title || ""),
    artist: normalizeLowerText(normalizedSnapshot.artist || ""),
    album: normalizeLowerText(normalizedSnapshot.album || ""),
    outputRoute: normalizeLowerText(normalizedSnapshot.outputRoute || "unknown"),
    mediaKind: normalizeLowerText(normalizedSuggestion.mediaKind || "music"),
    suggestedState: normalizeLowerText(normalizedSuggestion.suggestedState || "MusicChill"),
  });
}

function summarizeDisplays() {
  return screen.getAllDisplays().map(summarizeDisplay);
}

function getClampArea(display) {
  return CLAMP_TO_WORK_AREA ? display.workArea : display.bounds;
}

function summarizeBounds(bounds) {
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function getActivePetVisualBounds(nowMs = Date.now()) {
  const stale =
    activePetBoundsUpdatedAtMs > 0 &&
    nowMs - activePetBoundsUpdatedAtMs > PET_BOUNDS_STALE_MS &&
    (dragging || flingState.active);
  const baseBounds = stale ? getBasePetVisualBounds() : activePetVisualBounds || getBasePetVisualBounds();
  return scalePetBounds(baseBounds, runtimeHitboxScale, getPetWindowSize()) || getBasePetVisualBounds();
}

function emitToRenderer(channel, payload) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send(channel, payload);
}

function emitToWindow(targetWindow, channel, payload) {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  targetWindow.webContents.send(channel, payload);
}

function getWindowCenterPoint(targetWindow, windowSize = null) {
  if (!targetWindow || targetWindow.isDestroyed()) return { x: 0, y: 0 };
  const bounds = targetWindow.getContentBounds();
  const size = windowSize || bounds;
  return {
    x: Math.round(bounds.x + size.width * 0.5),
    y: Math.round(bounds.y + size.height * 0.5),
  };
}

function applyFixedContentBounds(targetWindow, size, targetX, targetY) {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  targetWindow.setContentBounds(
    {
      x: Math.round(targetX),
      y: Math.round(targetY),
      width: size.width,
      height: size.height,
    },
    false
  );
}

function resetMotionSampleFromWindow() {
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  lastMotionSample = { tMs: Date.now(), x, y };
}

function shouldEmitMotionPayload(nextPayload) {
  if (!lastMotionPayload) return true;
  if (nextPayload.dragging !== lastMotionPayload.dragging) return true;
  if (nextPayload.flinging !== lastMotionPayload.flinging) return true;
  if (nextPayload.preset !== lastMotionPayload.preset) return true;
  if (nextPayload.collided.x !== lastMotionPayload.collided.x) return true;
  if (nextPayload.collided.y !== lastMotionPayload.collided.y) return true;
  if (nextPayload.impact.triggered !== lastMotionPayload.impact.triggered) return true;
  if (
    Math.abs(nextPayload.impact.strength - lastMotionPayload.impact.strength) > MOTION_VELOCITY_EPSILON
  ) {
    return true;
  }
  if (
    Math.abs(nextPayload.position.x - lastMotionPayload.position.x) > MOTION_POSITION_EPSILON ||
    Math.abs(nextPayload.position.y - lastMotionPayload.position.y) > MOTION_POSITION_EPSILON
  ) {
    return true;
  }
  if (
    Math.abs(nextPayload.velocity.vx - lastMotionPayload.velocity.vx) > MOTION_VELOCITY_EPSILON ||
    Math.abs(nextPayload.velocity.vy - lastMotionPayload.velocity.vy) > MOTION_VELOCITY_EPSILON ||
    Math.abs(nextPayload.velocity.speed - lastMotionPayload.velocity.speed) > MOTION_VELOCITY_EPSILON
  ) {
    return true;
  }
  return false;
}

function emitMotionState({ collided, impact, velocityOverride } = {}) {
  if (!win || win.isDestroyed()) return;

  const nowMs = Date.now();
  const [x, y] = win.getPosition();

  let vx = 0;
  let vy = 0;

  if (
    velocityOverride &&
    Number.isFinite(velocityOverride.vx) &&
    Number.isFinite(velocityOverride.vy)
  ) {
    vx = velocityOverride.vx;
    vy = velocityOverride.vy;
  } else if (lastMotionSample) {
    const dtSec = (nowMs - lastMotionSample.tMs) / 1000;
    if (dtSec > 0) {
      vx = (x - lastMotionSample.x) / dtSec;
      vy = (y - lastMotionSample.y) / dtSec;
    }
  }

  const speed = Math.hypot(vx, vy);
  lastMotionSample = { tMs: nowMs, x, y };

  const payload = {
    tMs: nowMs,
    dragging,
    flinging: flingState.active,
    position: { x, y },
    velocity: { vx, vy, speed },
    collided: {
      x: Boolean(collided?.x),
      y: Boolean(collided?.y),
    },
    impact: {
      triggered: Boolean(impact?.triggered),
      strength: Number.isFinite(impact?.strength)
        ? Math.max(0, Math.min(1, impact.strength))
        : 0,
    },
    preset: ACTIVE_FLING_PRESET,
  };
  if (!shouldEmitMotionPayload(payload)) return;

  lastMotionPayload = payload;
  emitToRenderer("pet:motion", payload);
}

function emitCursorState() {
  if (!win || win.isDestroyed()) return;
  emitToRenderer("pet:cursor", {
    tMs: Date.now(),
    cursor: screen.getCursorScreenPoint(),
  });
}

function applyWindowBounds(targetX, targetY) {
  if (!win) {
    return {
      windowBefore: null,
      windowAfter: null,
      contentBefore: null,
      contentAfter: null,
      sizeCorrected: false,
    };
  }

  const petWindowSize = getPetWindowSize();

  if (!DIAGNOSTICS_ENABLED) {
    applyFixedContentBounds(win, petWindowSize, targetX, targetY);
    return {
      windowBefore: null,
      windowAfter: null,
      contentBefore: null,
      contentAfter: null,
      sizeCorrected: false,
    };
  }

  const windowBefore = win.getBounds();
  const contentBefore = win.getContentBounds();
  const sizeCorrected =
    contentBefore.width !== petWindowSize.width || contentBefore.height !== petWindowSize.height;

  applyFixedContentBounds(win, petWindowSize, targetX, targetY);

  const windowAfter = win.getBounds();
  const contentAfter = win.getContentBounds();

  return {
    windowBefore: summarizeBounds(windowBefore),
    windowAfter: summarizeBounds(windowAfter),
    contentBefore: summarizeBounds(contentBefore),
    contentAfter: summarizeBounds(contentAfter),
    sizeCorrected,
  };
}

function recordDragSample(x, y, tMs = Date.now()) {
  dragSamples.push({ tMs, x: Math.round(x), y: Math.round(y) });

  const minTime = tMs - VELOCITY_SAMPLE_WINDOW_MS;
  dragSamples = dragSamples.filter((sample) => sample.tMs >= minTime);

  if (dragSamples.length > MAX_DRAG_SAMPLES) {
    dragSamples = dragSamples.slice(-MAX_DRAG_SAMPLES);
  }
}

function clearDragSamples() {
  dragSamples = [];
}

function cancelFling(reason = "cancelled") {
  const wasActive = flingState.active;

  flingState.active = false;
  flingState.vx = 0;
  flingState.vy = 0;
  flingState.lastStepMs = 0;
  flingState.x = 0;
  flingState.y = 0;
  flingTick = 0;

  if (wasActive) {
    const payload = { kind: "flingCancel", reason };
    logDiagnostics("fling-cancel", payload);
    emitDiagnostics(payload);
    emitMotionState({
      velocityOverride: { vx: 0, vy: 0 },
      collided: { x: false, y: false },
      impact: { triggered: false, strength: 0 },
    });
    if (reason === "belowStopSpeed") {
      maybeExitZoneRoamAfterManualMove("manual_fling_exit_zone");
      maybeRecordManualMonitorAvoidance("manual_fling_monitor_correction");
      manualWindowCorrectionStartContext = null;
    } else {
      manualCorrectionStartDisplayId = null;
      manualWindowCorrectionStartContext = null;
    }
  }
}

function maybeStartFlingFromSamples() {
  if (!FLING_CONFIG.enabled) {
    const payload = { kind: "flingSkip", reason: "presetOff", preset: ACTIVE_FLING_PRESET };
    logDiagnostics("fling-skip", payload);
    emitDiagnostics(payload);
    return;
  }

  if (dragSamples.length < 2) {
    const payload = { kind: "flingSkip", reason: "insufficientSamples", sampleCount: dragSamples.length };
    logDiagnostics("fling-skip", payload);
    emitDiagnostics(payload);
    return;
  }

  const latest = dragSamples[dragSamples.length - 1];
  const oldest = dragSamples[0];
  const dtSec = (latest.tMs - oldest.tMs) / 1000;

  if (dtSec <= 0) {
    const payload = { kind: "flingSkip", reason: "invalidSampleWindow", dtSec };
    logDiagnostics("fling-skip", payload);
    emitDiagnostics(payload);
    return;
  }

  let vx = (latest.x - oldest.x) / dtSec;
  let vy = (latest.y - oldest.y) / dtSec;
  const rawSpeed = Math.hypot(vx, vy);

  if (rawSpeed > FLING_CONFIG.maxSpeedPxS) {
    const scale = FLING_CONFIG.maxSpeedPxS / rawSpeed;
    vx *= scale;
    vy *= scale;
  }

  const speed = Math.hypot(vx, vy);
  if (speed < FLING_CONFIG.minSpeedPxS) {
    const payload = {
      kind: "flingSkip",
      reason: "belowMinSpeed",
      speed,
      minSpeed: FLING_CONFIG.minSpeedPxS,
      sampleCount: dragSamples.length,
      dtSec,
      preset: ACTIVE_FLING_PRESET,
    };
    logDiagnostics("fling-skip", payload);
    emitDiagnostics(payload);
    return;
  }

  flingState.active = true;
  flingState.vx = vx;
  flingState.vy = vy;
  flingState.lastStepMs = Date.now();
  const [winX, winY] = win.getPosition();
  flingState.x = winX;
  flingState.y = winY;
  resetRoamDirectionMemory();
  flingTick = 0;

  const payload = {
    kind: "flingStart",
    vx,
    vy,
    speed,
    sampleCount: dragSamples.length,
    dtSec,
    preset: ACTIVE_FLING_PRESET,
  };
  logDiagnostics("fling-start", payload);
  emitDiagnostics(payload);
  emitMotionState({
    velocityOverride: { vx, vy },
    collided: { x: false, y: false },
    impact: { triggered: false, strength: 0 },
  });
}

function stepFling() {
  if (!win || win.isDestroyed()) return;
  if (!FLING_CONFIG.enabled) {
    cancelFling("presetOff");
    return;
  }
  if (!flingState.active || dragging) return;

  const nowMs = Date.now();
  const elapsedMs = nowMs - flingState.lastStepMs;
  if (elapsedMs <= 0) return;

  const dtSec = Math.min(elapsedMs / 1000, 0.05);
  flingState.lastStepMs = nowMs;
  flingTick += 1;

  // Keep subpixel position state for smoother motion than integer window coordinates.
  if (!Number.isFinite(flingState.x) || !Number.isFinite(flingState.y)) {
    const [winX, winY] = win.getPosition();
    flingState.x = winX;
    flingState.y = winY;
  }

  const targetX = flingState.x + flingState.vx * dtSec;
  const targetY = flingState.y + flingState.vy * dtSec;

  const petWindowSize = getPetWindowSize();
  const targetCenter = {
    x: Math.round(targetX + petWindowSize.width / 2),
    y: Math.round(targetY + petWindowSize.height / 2),
  };
  const display = screen.getDisplayNearestPoint(targetCenter);
  const clampArea = getClampArea(display);
  const petBounds = getActivePetVisualBounds(nowMs);
  const clamped = clampWindowPosition(targetX, targetY, clampArea, petBounds);
  const collidedX = Math.abs(clamped.x - targetX) > 0.001;
  const collidedY = Math.abs(clamped.y - targetY) > 0.001;
  let impactStrength = 0;

  applyWindowBounds(clamped.x, clamped.y);
  flingState.x = clamped.x;
  flingState.y = clamped.y;

  if (collidedX) {
    const oldVx = flingState.vx;
    impactStrength = Math.max(
      impactStrength,
      Math.abs(oldVx) / Math.max(1, FLING_CONFIG.maxSpeedPxS)
    );
    flingState.vx = -flingState.vx * FLING_CONFIG.bounceRestitution;
    const payload = { kind: "flingBounce", axis: "x", before: oldVx, after: flingState.vx };
    logDiagnostics("fling-bounce", payload);
    emitDiagnostics(payload);
  }

  if (collidedY) {
    const oldVy = flingState.vy;
    impactStrength = Math.max(
      impactStrength,
      Math.abs(oldVy) / Math.max(1, FLING_CONFIG.maxSpeedPxS)
    );
    flingState.vy = -flingState.vy * FLING_CONFIG.bounceRestitution;
    const payload = { kind: "flingBounce", axis: "y", before: oldVy, after: flingState.vy };
    logDiagnostics("fling-bounce", payload);
    emitDiagnostics(payload);
  }

  const damping = Math.exp(-FLING_CONFIG.dampingPerSec * dtSec);
  flingState.vx *= damping;
  flingState.vy *= damping;

  const speed = Math.hypot(flingState.vx, flingState.vy);
  if (speed < FLING_CONFIG.stopSpeedPxS) {
    const payload = { kind: "flingStop", reason: "belowStopSpeed", speed };
    logDiagnostics("fling-stop", payload);
    emitDiagnostics(payload);
    cancelFling("belowStopSpeed");
    return;
  }

  emitMotionState({
    velocityOverride: { vx: flingState.vx, vy: flingState.vy },
    collided: { x: collidedX, y: collidedY },
    impact: { triggered: collidedX || collidedY, strength: impactStrength },
  });

  if (DIAGNOSTICS_ENABLED && (flingTick % DRAG_LOG_SAMPLE_EVERY === 0 || collidedX || collidedY)) {
    const payload = {
      kind: "flingStep",
      tick: flingTick,
      dtSec,
      speed,
      vx: flingState.vx,
      vy: flingState.vy,
      clamped,
      collidedX,
      collidedY,
      clampAreaType: CLAMP_TO_WORK_AREA ? "workArea" : "bounds",
      clampArea: summarizeBounds(clampArea),
      activeDisplay: summarizeDisplay(display),
    };
    logDiagnostics("fling-step", payload);
    emitDiagnostics(payload);
  }
}

function getLogFilePath() {
  return path.join(__dirname, "pet-debug.log");
}

function maybeRotateDiagnosticsLog() {
  if (!DIAGNOSTICS_ENABLED || !diagnosticsLogStream) return;
  if (logLineCount % 250 !== 0) return;

  try {
    const logPath = getLogFilePath();
    const { size } = fs.statSync(logPath);
    if (size < MAX_LOG_FILE_BYTES) return;

    diagnosticsLogStream.end();
    diagnosticsLogStream = null;

    const truncatedHeader = `${new Date().toISOString()} [pet-debug] log rotated at ${size} bytes\n`;
    fs.writeFileSync(logPath, truncatedHeader, "utf8");
    diagnosticsLogStream = fs.createWriteStream(logPath, { flags: "a" });
  } catch (error) {
    console.error("[pet-debug] failed to rotate diagnostics log", error);
  }
}

function writeDiagnosticsLogLine(line) {
  if (!DIAGNOSTICS_ENABLED || !diagnosticsLogStream) return;

  diagnosticsLogStream.write(`${line}\n`);
  logLineCount += 1;
  maybeRotateDiagnosticsLog();
}

function initializeDiagnosticsLog() {
  if (!DIAGNOSTICS_ENABLED) return;

  try {
    const logPath = getLogFilePath();
    const header = `${new Date().toISOString()} [pet-debug] diagnostics log started\n`;
    fs.writeFileSync(logPath, header, "utf8");
    diagnosticsLogStream = fs.createWriteStream(logPath, { flags: "a" });
    diagnosticsLogStream.on("error", (error) => {
      console.error("[pet-debug] diagnostics log stream error", error);
    });
    console.log(`[pet-debug] writing diagnostics to ${logPath}`);
  } catch (error) {
    console.error("[pet-debug] failed to initialize diagnostics log", error);
  }
}

function closeDiagnosticsLog() {
  if (!diagnosticsLogStream) return;

  diagnosticsLogStream.end();
  diagnosticsLogStream = null;
}

function emitDiagnostics(payload) {
  if (!DIAGNOSTICS_ENABLED) return;
  emitToRenderer("pet:diagnostics", payload);
}

function logDiagnostics(label, payload) {
  if (!DIAGNOSTICS_ENABLED) return;
  const line = `${new Date().toISOString()} [pet-debug] ${label} ${JSON.stringify(payload)}`;
  console.log(line);
  writeDiagnosticsLogLine(line);
}

function emitCapabilitySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  latestCapabilitySnapshot = snapshot;
  emitToRenderer("pet:capabilities", snapshot);
}

function emitStateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  const previousSnapshot = latestStateSnapshot;
  latestStateSnapshot = snapshot;
  emitToRenderer("pet:state", snapshot);
  if (
    previousSnapshot &&
    previousSnapshot.currentState !== snapshot.currentState &&
    snapshot.currentState === "Idle" &&
    latestLocalMediaSnapshot?.ok &&
    latestLocalMediaSnapshot?.isPlaying
  ) {
    void pollLocalMediaState({
      trigger: "idle-resume",
    });
  } else if (
    previousSnapshot &&
    previousSnapshot.currentState !== snapshot.currentState &&
    snapshot.currentState === "Idle"
  ) {
    syncShellRoamingState("idle_resume_shell_roam");
  }
}

function logCapabilitySummary(label, snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  const summary = snapshot.summary || {};
  const line =
    `[pet-capability] ${label} runtime=${snapshot.runtimeState}` +
    ` healthy=${summary.healthyCount || 0}` +
    ` degraded=${summary.degradedCount || 0}` +
    ` failed=${summary.failedCount || 0}` +
    ` disabled=${summary.disabledCount || 0}`;
  console.log(line);

  if (!DIAGNOSTICS_ENABLED) return;
  logDiagnostics("capability-summary", {
    kind: "capabilitySummary",
    label,
    runtimeState: snapshot.runtimeState,
    summary,
  });
  emitDiagnostics({
    kind: "capabilitySummary",
    label,
    runtimeState: snapshot.runtimeState,
    summary,
  });
}

function logCapabilityTransition(transition) {
  if (!transition || typeof transition !== "object") return;

  const capabilityId = transition.capabilityId || "unknown";
  const fromState = transition.previous?.state || "none";
  const toState = transition.next?.state || "unknown";
  const reason = transition.next?.reason || "unspecified";
  const line = `[pet-capability] ${capabilityId} ${fromState} -> ${toState} (${reason})`;
  console.log(line);

  if (!DIAGNOSTICS_ENABLED) return;
  const payload = {
    kind: "capabilityTransition",
    capabilityId,
    fromState,
    toState,
    reason,
    runtimeState: transition.snapshot?.runtimeState || "unknown",
    summary: transition.snapshot?.summary || {},
    details: transition.next?.details || {},
  };
  logDiagnostics("capability-transition", payload);
  emitDiagnostics(payload);
}

function createCapabilityContext() {
  return {
    app,
    screen,
    getWindow: () => win,
    diagnosticsEnabled: DIAGNOSTICS_ENABLED,
    cursorTimerActive: Boolean(cursorTimer),
    flingEnabled: Boolean(FLING_CONFIG?.enabled),
    flingPreset: ACTIVE_FLING_PRESET,
  };
}

function initializeCapabilityRegistry() {
  capabilityRegistry = createCapabilityRegistry({
    onTransition: (transition) => {
      logCapabilityTransition(transition);
      emitCapabilitySnapshot(transition.snapshot);
    },
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.renderer,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: true,
    defaultEnabled: true,
    telemetryTags: ["core", "ui"],
    degradedPolicy: {
      fallback: "renderMinimal",
    },
    start: ({ context }) => {
      const currentWindow = context.getWindow();
      if (!currentWindow || currentWindow.isDestroyed()) {
        return {
          state: CAPABILITY_STATES.failed,
          reason: "windowUnavailable",
        };
      }
      if (currentWindow.webContents?.isLoadingMainFrame()) {
        return {
          state: CAPABILITY_STATES.degraded,
          reason: "windowLoading",
        };
      }
      return {
        state: CAPABILITY_STATES.healthy,
        reason: "windowReady",
      };
    },
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.brain,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: true,
    defaultEnabled: true,
    telemetryTags: ["core", "state-authority"],
    degradedPolicy: {
      fallback: "localDeterministicMode",
    },
    start: () => ({
      state: CAPABILITY_STATES.healthy,
      reason: "localAuthorityReady",
    }),
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.sensors,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: false,
    defaultEnabled: true,
    telemetryTags: ["input", "cursor", "display"],
    degradedPolicy: {
      fallback: "reducedSensorSet",
    },
    start: ({ context }) => {
      if (CAPABILITY_TEST_FLAGS.sensorsFail) {
        throw new Error("Forced sensors startup failure (PET_FORCE_SENSORS_FAIL=1)");
      }
      if (!context.screen || typeof context.screen.getCursorScreenPoint !== "function") {
        return {
          state: CAPABILITY_STATES.failed,
          reason: "screenApiUnavailable",
        };
      }
      if (!context.cursorTimerActive) {
        return {
          state: CAPABILITY_STATES.degraded,
          reason: "cursorTimerInactive",
        };
      }
      return {
        state: CAPABILITY_STATES.healthy,
        reason: "cursorAndDisplayReady",
      };
    },
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.openclawBridge,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: false,
    defaultEnabled: true,
    telemetryTags: ["ai", "bridge"],
    degradedPolicy: {
      fallback: "offlineLocalFallback",
    },
    start: () => {
      if (runtimeSettings?.openclaw?.enabled === false) {
        const transport =
          runtimeSettings?.openclaw?.transport === BRIDGE_TRANSPORTS.http
            ? BRIDGE_TRANSPORTS.http
            : runtimeSettings?.openclaw?.transport === BRIDGE_TRANSPORTS.ws
              ? BRIDGE_TRANSPORTS.ws
              : BRIDGE_TRANSPORTS.stub;
        return {
          state: CAPABILITY_STATES.disabled,
          reason: "disabledByConfig",
          details: {
            mode: BRIDGE_MODES.offline,
            transport,
          },
        };
      }
      if (CAPABILITY_TEST_FLAGS.openclawFail) {
        throw new Error("Forced bridge startup failure (PET_FORCE_OPENCLAW_FAIL=1)");
      }
      if (!openclawBridge) {
        return {
          state: CAPABILITY_STATES.failed,
          reason: "bridgeRuntimeUnavailable",
        };
      }
      return openclawBridge.getStartupState();
    },
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.spotifyIntegration,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: false,
    defaultEnabled: true,
    telemetryTags: ["integrations", "spotify", "media"],
    degradedPolicy: {
      fallback: "localMusicMode",
    },
    start: () => deriveIntegrationState(CAPABILITY_IDS.spotifyIntegration),
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.freshRssIntegration,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: false,
    defaultEnabled: true,
    telemetryTags: ["integrations", "freshrss", "feeds"],
    degradedPolicy: {
      fallback: "skipFeedPolling",
    },
    start: () => deriveIntegrationState(CAPABILITY_IDS.freshRssIntegration),
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.extensionRegistry,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: false,
    defaultEnabled: true,
    telemetryTags: ["extensions", "registry"],
    degradedPolicy: {
      fallback: "coreOnlyRuntime",
    },
    start: () => deriveExtensionRegistryState(latestExtensionSnapshot),
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.permissionManager,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: false,
    defaultEnabled: true,
    telemetryTags: ["extensions", "permissions"],
    degradedPolicy: {
      fallback: "restrictiveDefault",
    },
    start: () => ({
      state: CAPABILITY_STATES.healthy,
      reason: "authorTrustedWarningModel",
      details: {
        warningMode: "oneTimePerExtension",
      },
    }),
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.behaviorArbitrator,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: false,
    defaultEnabled: true,
    telemetryTags: ["extensions", "arbitration"],
    degradedPolicy: {
      fallback: "corePriorityOnly",
    },
    start: () => ({
      state: CAPABILITY_STATES.healthy,
      reason: "coreAuthorityActive",
      details: {
        arbitrationMode: "coreAuthoritative",
      },
    }),
  });

  capabilityRegistry.register({
    capabilityId: CAPABILITY_IDS.propWorld,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    required: false,
    defaultEnabled: true,
    telemetryTags: ["extensions", "props"],
    degradedPolicy: {
      fallback: "logOnlyPropWorld",
    },
    start: () => derivePropWorldCapabilityState(),
  });

  const snapshot = capabilityRegistry.getSnapshot();
  emitCapabilitySnapshot(snapshot);
  logCapabilitySummary("registered", snapshot);
}

async function startCapabilityRegistry() {
  if (!capabilityRegistry) return;
  const snapshot = await capabilityRegistry.startAll(createCapabilityContext());
  emitCapabilitySnapshot(snapshot);
  logCapabilitySummary("startup-complete", snapshot);
  syncOpenClawBridgeCapabilityState("startup");
  refreshIntegrationCapabilityStates();
  refreshExtensionCapabilityStates();
}

function updateCapabilityState(capabilityId, state, reason, details = {}) {
  if (!capabilityRegistry) return;
  let nextState = state;
  let nextReason = reason;
  let nextDetails = details;

  // Hard guard: OpenClaw bridge cannot surface healthy/degraded/failed while disabled by settings.
  if (
    capabilityId === CAPABILITY_IDS.openclawBridge &&
    runtimeSettings?.openclaw?.enabled === false &&
    state !== CAPABILITY_STATES.disabled
  ) {
    const transport =
      runtimeSettings?.openclaw?.transport === BRIDGE_TRANSPORTS.http
        ? BRIDGE_TRANSPORTS.http
        : runtimeSettings?.openclaw?.transport === BRIDGE_TRANSPORTS.ws
          ? BRIDGE_TRANSPORTS.ws
          : BRIDGE_TRANSPORTS.stub;
    nextState = CAPABILITY_STATES.disabled;
    nextReason = "disabledByConfig";
    nextDetails = {
      ...(details && typeof details === "object" ? details : {}),
      enforcedBy: "openclawDisabledGuard",
      mode: BRIDGE_MODES.offline,
      transport,
    };
  }

  capabilityRegistry.updateCapabilityState(capabilityId, {
    state: nextState,
    reason: nextReason,
    details: nextDetails,
  });
}

function emitExtensionSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  latestExtensionSnapshot = snapshot;
  emitToRenderer("pet:extensions", snapshot);
}

function logExtensionSummary(label, snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  const summary = snapshot.summary || {};
  const line =
    `[pet-extension] ${label}` +
    ` discovered=${summary.discoveredCount || 0}` +
    ` valid=${summary.validCount || 0}` +
    ` invalid=${summary.invalidCount || 0}` +
    ` enabled=${summary.enabledCount || 0}`;
  console.log(line);

  if (!DIAGNOSTICS_ENABLED) return;
  const payload = {
    kind: "extensionSummary",
    label,
    summary,
    warnings: snapshot.warnings || [],
  };
  logDiagnostics("extension-summary", payload);
  emitDiagnostics(payload);
}

function deriveExtensionRegistryState(snapshot) {
  const summary = snapshot?.summary || null;
  if (!summary) {
    return {
      state: CAPABILITY_STATES.failed,
      reason: "snapshotUnavailable",
      details: {},
    };
  }

  if (summary.validCount <= 0 && summary.invalidCount > 0) {
    return {
      state: CAPABILITY_STATES.degraded,
      reason: "noValidPacks",
      details: summary,
    };
  }
  if (summary.validCount <= 0) {
    return {
      state: CAPABILITY_STATES.degraded,
      reason: "noPacksFound",
      details: summary,
    };
  }
  if (summary.invalidCount > 0) {
    return {
      state: CAPABILITY_STATES.degraded,
      reason: "partialInvalid",
      details: summary,
    };
  }
  return {
    state: CAPABILITY_STATES.healthy,
    reason: "packsDiscovered",
    details: summary,
  };
}

function derivePropWorldCapabilityState() {
  return {
    state: CAPABILITY_STATES.healthy,
    reason: "trustedQuickPropsActive",
    details: {
      mode: "trustedQuickProps",
      quickProps: Object.values(SHELL_QUICK_PROP_IDS),
    },
  };
}

function refreshExtensionCapabilityStates() {
  const extensionState = deriveExtensionRegistryState(latestExtensionSnapshot);
  updateCapabilityState(
    CAPABILITY_IDS.extensionRegistry,
    extensionState.state,
    extensionState.reason,
    extensionState.details
  );
  updateCapabilityState(
    CAPABILITY_IDS.permissionManager,
    CAPABILITY_STATES.healthy,
    "authorTrustedWarningModel",
    {
      warningMode: "oneTimePerExtension",
      source: "localAuthorTrusted",
    }
  );
  updateCapabilityState(
    CAPABILITY_IDS.behaviorArbitrator,
    CAPABILITY_STATES.healthy,
    "coreAuthorityActive",
    {
      arbitrationMode: "coreAuthoritative",
    }
  );
  updateCapabilityState(
    CAPABILITY_IDS.propWorld,
    derivePropWorldCapabilityState().state,
    derivePropWorldCapabilityState().reason,
    derivePropWorldCapabilityState().details
  );
}

function initializeExtensionPackRuntime() {
  extensionPackRegistry = createExtensionPackRegistry({
    rootDir: DEFAULT_EXTENSIONS_ROOT,
    logger: (label, payload) => {
      if (!DIAGNOSTICS_ENABLED) return;
      logDiagnostics(`extension-registry-${label}`, payload);
    },
  });

  const snapshot = extensionPackRegistry.discover();
  emitExtensionSnapshot(snapshot);
  logExtensionSummary("discover", snapshot);
  for (const warning of snapshot.warnings || []) {
    console.warn(`[pet-extension] warning ${warning}`);
  }

  if (!EXTENSION_TEST_FLAGS.disableAll) return;

  for (const extension of snapshot.extensions || []) {
    if (!extension.valid || !extension.enabled) continue;
    const result = extensionPackRegistry.setEnabled(extension.extensionId, false);
    if (!result.ok) continue;
  }
  const disabledSnapshot = extensionPackRegistry.getSnapshot();
  emitExtensionSnapshot(disabledSnapshot);
  logExtensionSummary("all-disabled-by-flag", disabledSnapshot);
}

function resolvePetCommandSecretSource(openclaw = {}) {
  const secret = typeof openclaw.petCommandSharedSecret === "string" ? openclaw.petCommandSharedSecret.trim() : "";
  if (!secret) return "none";
  if (runtimeSettingsSourceMap?.["openclaw.petCommandSharedSecret"] === "env") {
    return "env";
  }
  const secretRef =
    typeof openclaw.petCommandSharedSecretRef === "string"
      ? openclaw.petCommandSharedSecretRef.trim()
      : DEFAULT_OPENCLAW_PET_COMMAND_SECRET_REF;
  if (
    secretRef &&
    process.env &&
    Object.prototype.hasOwnProperty.call(process.env, secretRef) &&
    typeof process.env[secretRef] === "string" &&
    process.env[secretRef].trim().length > 0
  ) {
    return "env";
  }
  return app?.isPackaged ? "runtime" : "local";
}

function appendOpenClawPetCommandAudit(entry) {
  if (!entry || typeof entry !== "object") return;
  openclawPetCommandAuditHistory = [...openclawPetCommandAuditHistory, entry].slice(
    -OPENCLAW_PET_COMMAND_AUDIT_LIMIT
  );
  const logReason = typeof entry.reason === "string" && entry.reason.length > 0 ? entry.reason : "unknown";
  const logAction = typeof entry.actionId === "string" && entry.actionId.length > 0 ? entry.actionId : "unknown";
  const decision = entry.decision === "accepted" ? "accepted" : "rejected";
  const correlationId = entry.correlationId || "n/a";
  console.log(
    `[pet-openclaw-command] ${decision} correlationId=${correlationId} action=${logAction} reason=${logReason}`
  );
  if (DIAGNOSTICS_ENABLED) {
    emitDiagnostics({
      kind: "openclawPetCommandLane",
      ...entry,
    });
  }
}

function appendOpenClawPluginSkillAudit(entry) {
  if (!entry || typeof entry !== "object") return;
  openclawPluginSkillAuditHistory = [...openclawPluginSkillAuditHistory, entry].slice(
    -OPENCLAW_PLUGIN_SKILL_AUDIT_LIMIT
  );
  const outcome = typeof entry.result === "string" && entry.result.length > 0 ? entry.result : "unknown";
  const logReason = typeof entry.reason === "string" && entry.reason.length > 0 ? entry.reason : "unknown";
  const logCall = typeof entry.call === "string" && entry.call.length > 0 ? entry.call : "unknown";
  const correlationId = entry.correlationId || "n/a";
  console.log(
    `[pet-openclaw-plugin] ${outcome} correlationId=${correlationId} call=${logCall} reason=${logReason}`
  );
  if (DIAGNOSTICS_ENABLED) {
    emitDiagnostics({
      kind: "openclawPluginSkillLane",
      ...entry,
    });
  }
}

function recordCommandInjectedAnnouncement({ correlationId, requestId, text, source, keyId }) {
  const normalizedText = typeof text === "string" ? text.trim() : "";
  if (!normalizedText) {
    return {
      ok: false,
      error: "invalid_args",
    };
  }
  const normalizedSource =
    typeof source?.skillId === "string" && source.skillId.trim().length > 0
      ? source.skillId.trim()
      : "openclaw_command_lane";
  const entry = appendDialogHistoryEntry({
    messageId: createDialogMessageId(),
    correlationId:
      typeof correlationId === "string" && correlationId.length > 0
        ? correlationId
        : createContractCorrelationId(),
    role: "pet",
    kind: "announcement",
    channel: "dialog",
    source: normalizedSource,
    text: normalizedText,
    fallbackMode: "none",
    talkFeedbackMode: DIALOG_TALK_FEEDBACK_MODE,
    stateContextSummary: summarizeDialogStateContext(),
    currentState: latestStateSnapshot?.currentState || "Idle",
    phase: latestStateSnapshot?.phase || null,
    ts: Date.now(),
    commandMeta: {
      requestId: typeof requestId === "string" ? requestId : null,
      keyId: typeof keyId === "string" ? keyId : null,
      lane: "openclaw",
    },
  });
  emitDialogMessage(entry);
  return {
    ok: true,
    entry,
  };
}

function buildRuntimeSettingsSummary() {
  const settings = runtimeSettings && typeof runtimeSettings === "object" ? runtimeSettings : {};
  const integrations =
    settings.integrations && typeof settings.integrations === "object" ? settings.integrations : {};
  const sensors = settings.sensors && typeof settings.sensors === "object" ? settings.sensors : {};
  const memory = settings.memory && typeof settings.memory === "object" ? settings.memory : {};
  const openclaw = settings.openclaw && typeof settings.openclaw === "object" ? settings.openclaw : {};
  const openclawEnabled = Boolean(openclaw.enabled);
  const openclawPetCommandKeyId =
    typeof openclaw.petCommandKeyId === "string" && openclaw.petCommandKeyId.trim().length > 0
      ? openclaw.petCommandKeyId.trim()
      : DEFAULT_OPENCLAW_PET_COMMAND_KEY_ID;
  const openclawPetCommandReadiness =
    openclawPetCommandLane && typeof openclawPetCommandLane.getReadiness === "function"
      ? openclawPetCommandLane.getReadiness({
          keyId: openclawPetCommandKeyId,
        })
      : null;
  const paths = settings.paths && typeof settings.paths === "object" ? settings.paths : {};
  const roaming = settings.roaming && typeof settings.roaming === "object" ? settings.roaming : {};
  const ui = settings.ui && typeof settings.ui === "object" ? settings.ui : {};
  const wardrobe = settings.wardrobe && typeof settings.wardrobe === "object" ? settings.wardrobe : {};
  const inventory = settings.inventory && typeof settings.inventory === "object" ? settings.inventory : {};
  const dialog = settings.dialog && typeof settings.dialog === "object" ? settings.dialog : {};
  const resolvedPaths =
    runtimeSettingsResolvedPaths && typeof runtimeSettingsResolvedPaths === "object"
      ? runtimeSettingsResolvedPaths
      : null;
  return {
    integrations: {
      spotify: {
        enabled: Boolean(integrations.spotify?.enabled),
        available: Boolean(integrations.spotify?.available),
        transport: integrations.spotify?.transport || INTEGRATION_TRANSPORTS.stub,
        defaultTrackTitle: integrations.spotify?.defaultTrackTitle || "Night Drive",
        defaultArtist: integrations.spotify?.defaultArtist || "Primea FM",
        defaultAlbum: integrations.spotify?.defaultAlbum || "Sample Rotation",
        backgroundEnrichmentEnabled: integrations.spotify?.backgroundEnrichmentEnabled !== false,
        pollCadenceMinutes: Number.isFinite(Number(integrations.spotify?.pollCadenceMinutes))
          ? Math.max(1, Math.round(Number(integrations.spotify.pollCadenceMinutes)))
          : 10,
      },
      freshRss: {
        enabled: Boolean(integrations.freshRss?.enabled),
        available: Boolean(integrations.freshRss?.available),
        transport: integrations.freshRss?.transport || INTEGRATION_TRANSPORTS.stub,
        backgroundEnrichmentEnabled: integrations.freshRss?.backgroundEnrichmentEnabled !== false,
        pollCadenceMinutes: Number.isFinite(Number(integrations.freshRss?.pollCadenceMinutes))
          ? Math.max(5, Math.round(Number(integrations.freshRss.pollCadenceMinutes)))
          : 30,
        dailyTopItems: Number.isFinite(Number(integrations.freshRss?.dailyTopItems))
          ? Math.max(1, Math.min(3, Math.round(Number(integrations.freshRss.dailyTopItems))))
          : 3,
      },
    },
    sensors: {
      media: {
        enabled: Boolean(sensors.media?.enabled),
        backend: sensors.media?.backend || "powershell",
        pollIntervalMs: Number.isFinite(Number(sensors.media?.pollIntervalMs))
          ? Math.max(500, Math.round(Number(sensors.media.pollIntervalMs)))
          : 2500,
        probeTimeoutMs: Number.isFinite(Number(sensors.media?.probeTimeoutMs))
          ? Math.max(250, Math.round(Number(sensors.media.probeTimeoutMs)))
          : 1800,
        includeOutputDevice: sensors.media?.includeOutputDevice !== false,
      },
    },
    memory: {
      enabled: Boolean(memory.enabled),
      adapterMode: memory.adapterMode || MEMORY_ADAPTER_MODES.local,
      mutationTransparencyPolicy: memory.mutationTransparencyPolicy || "logged",
      writeLegacyJsonl: Boolean(memory.writeLegacyJsonl),
    },
    openclaw: {
      enabled: openclawEnabled,
      transport: openclaw.transport || BRIDGE_TRANSPORTS.stub,
      mode: openclawEnabled
        ? openclaw.mode || BRIDGE_MODES.online
        : BRIDGE_MODES.offline,
      agentId: openclaw.agentId || DEFAULT_OPENCLAW_AGENT_ID,
      agentTimeoutMs: Number.isFinite(Number(openclaw.agentTimeoutMs))
        ? Math.max(1000, Math.round(Number(openclaw.agentTimeoutMs)))
        : DEFAULT_OPENCLAW_AGENT_TIMEOUT_MS,
      baseUrl: openclaw.baseUrl || "",
      timeoutMs: Number.isFinite(Number(openclaw.timeoutMs))
        ? Math.max(200, Math.round(Number(openclaw.timeoutMs)))
        : 1200,
      retryCount: Number.isFinite(Number(openclaw.retryCount))
        ? Math.max(0, Math.round(Number(openclaw.retryCount)))
        : 0,
      allowNonLoopback: Boolean(openclaw.allowNonLoopback),
      loopbackEndpoint: Boolean(openclaw.loopbackEndpoint),
      nonLoopbackAuthSatisfied: Boolean(openclaw.nonLoopbackAuthSatisfied),
      authTokenConfigured: Boolean(openclaw.authToken),
      authTokenRef: openclaw.authTokenRef || null,
      petCommandKeyId: openclawPetCommandKeyId,
      petCommandSharedSecretRef:
        typeof openclaw.petCommandSharedSecretRef === "string" && openclaw.petCommandSharedSecretRef.trim().length > 0
          ? openclaw.petCommandSharedSecretRef.trim()
          : DEFAULT_OPENCLAW_PET_COMMAND_SECRET_REF,
      petCommandSharedSecretConfigured: Boolean(openclaw.petCommandSharedSecret),
      petCommandSharedSecretSource: resolvePetCommandSecretSource(openclaw),
      petCommandNonceCacheSize: Number.isFinite(Number(openclawPetCommandReadiness?.nonceCacheSize))
        ? Math.max(0, Math.round(Number(openclawPetCommandReadiness.nonceCacheSize)))
        : 0,
      petCommandPolicy:
        openclawPetCommandReadiness && typeof openclawPetCommandReadiness.policy === "object"
          ? { ...openclawPetCommandReadiness.policy }
          : null,
    },
    paths: {
      localWorkspaceRoot: paths.localWorkspaceRoot || __dirname,
      openClawWorkspaceRoot: paths.openClawWorkspaceRoot || null,
      obsidianVaultRoot: paths.obsidianVaultRoot || null,
    },
    roaming: {
      mode: roaming.mode === ROAMING_MODES.zone ? ROAMING_MODES.zone : ROAMING_MODES.desktop,
      zone:
        typeof roaming.zone === "string" && roaming.zone.trim().length > 0
          ? roaming.zone.trim()
          : DEFAULT_ROAMING_ZONE,
      zoneRect: normalizeRoamZoneRect(roaming.zoneRect),
    },
    ui: {
      diagnosticsEnabled: Boolean(ui.diagnosticsEnabled),
      characterScalePercent: resolveCharacterScalePercent(settings),
      characterHitboxScalePercent: resolveCharacterHitboxScalePercent(settings),
    },
    wardrobe: {
      activeAccessories: Array.isArray(wardrobe.activeAccessories)
        ? wardrobe.activeAccessories.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
        : [],
    },
    inventory: {
      quickProps: Array.isArray(inventory.quickProps)
        ? inventory.quickProps.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
        : [],
    },
    dialog: {
      alwaysShowBubble: dialog.alwaysShowBubble !== false,
    },
    resolvedPaths,
  };
}

function buildOpenClawPluginSkillStatusRead(scope) {
  const normalizedScope = typeof scope === "string" ? scope.trim().toLowerCase() : "";
  const settingsSummary = buildRuntimeSettingsSummary();
  const openclaw = settingsSummary?.openclaw && typeof settingsSummary.openclaw === "object"
    ? settingsSummary.openclaw
    : {};
  const commandAuth = {
    configured: Boolean(openclaw.petCommandSharedSecretConfigured),
    source: typeof openclaw.petCommandSharedSecretSource === "string"
      ? openclaw.petCommandSharedSecretSource
      : "none",
    keyId: typeof openclaw.petCommandKeyId === "string" ? openclaw.petCommandKeyId : DEFAULT_OPENCLAW_PET_COMMAND_KEY_ID,
    secretRef:
      typeof openclaw.petCommandSharedSecretRef === "string"
        ? openclaw.petCommandSharedSecretRef
        : DEFAULT_OPENCLAW_PET_COMMAND_SECRET_REF,
    nonceCacheSize: Number.isFinite(Number(openclaw.petCommandNonceCacheSize))
      ? Math.max(0, Math.round(Number(openclaw.petCommandNonceCacheSize)))
      : 0,
    policy:
      openclaw.petCommandPolicy && typeof openclaw.petCommandPolicy === "object"
        ? { ...openclaw.petCommandPolicy }
        : null,
  };
  const commandPolicy = {
    authScheme: OPENCLAW_PET_COMMAND_AUTH_SCHEME,
    allowlistActionIds: [...OPENCLAW_PET_COMMAND_ALLOWLIST_ACTION_IDS],
    rejectReasons: [...Object.values(PET_COMMAND_REJECT_REASONS)],
  };
  const laneState = !openclaw.enabled ? "disabled" : !commandAuth.configured ? "degraded" : "ready";
  const base = {
    contractVersion: OPENCLAW_PLUGIN_SKILL_CONTRACT_VERSION,
    laneState,
  };

  if (normalizedScope === OPENCLAW_PLUGIN_SKILL_STATUS_SCOPES.bridgeSummary) {
    return {
      ...base,
      scope: OPENCLAW_PLUGIN_SKILL_STATUS_SCOPES.bridgeSummary,
      bridge: {
        enabled: Boolean(openclaw.enabled),
        transport: typeof openclaw.transport === "string" ? openclaw.transport : BRIDGE_TRANSPORTS.stub,
        mode: typeof openclaw.mode === "string" ? openclaw.mode : BRIDGE_MODES.offline,
        loopbackEndpoint: Boolean(openclaw.loopbackEndpoint),
        nonLoopbackAuthSatisfied: Boolean(openclaw.nonLoopbackAuthSatisfied),
      },
      commandPolicy: {
        allowlistActionIds: [...commandPolicy.allowlistActionIds],
        authScheme: commandPolicy.authScheme,
      },
      commandAuth: {
        configured: commandAuth.configured,
        source: commandAuth.source,
        keyId: commandAuth.keyId,
      },
    };
  }

  if (normalizedScope === OPENCLAW_PLUGIN_SKILL_STATUS_SCOPES.commandAuth) {
    return {
      ...base,
      scope: OPENCLAW_PLUGIN_SKILL_STATUS_SCOPES.commandAuth,
      commandAuth: {
        ...commandAuth,
      },
    };
  }

  if (normalizedScope === OPENCLAW_PLUGIN_SKILL_STATUS_SCOPES.commandPolicy) {
    return {
      ...base,
      scope: OPENCLAW_PLUGIN_SKILL_STATUS_SCOPES.commandPolicy,
      commandPolicy: {
        ...commandPolicy,
      },
    };
  }

  const error = new Error("plugin status scope is invalid");
  error.code = OPENCLAW_PLUGIN_SKILL_REJECT_REASONS.invalidCallShape;
  throw error;
}

function buildShellStateSnapshot() {
  const settings = buildRuntimeSettingsSummary();
  const accessories = settings.wardrobe?.activeAccessories || [];
  const quickProps = settings.inventory?.quickProps || [];
  const trayAvailable = Boolean(shellTray);
  const nowMs = Date.now();
  latestProactivePolicySnapshot = normalizeProactivePolicySnapshot(
    buildProactivePolicySnapshot(proactiveConversationState, nowMs)
  );
  const proactiveCooldownRemainingMs = getProactiveCooldownRemainingMs(nowMs);
  const proactiveSuppressionReason = getProactiveSuppressionReason({ nowMs });
  return {
    kind: "shellState",
    ts: nowMs,
    roaming: {
      mode: settings.roaming?.mode || ROAMING_MODES.desktop,
      zone: settings.roaming?.zone || DEFAULT_ROAMING_ZONE,
      zoneRect: normalizeRoamZoneRect(settings.roaming?.zoneRect),
    },
    ui: {
      diagnosticsEnabled: Boolean(settings.ui?.diagnosticsEnabled),
      characterScalePercent: resolveCharacterScalePercent(runtimeSettings),
      characterHitboxScalePercent: resolveCharacterHitboxScalePercent(runtimeSettings),
    },
    layout: getPetLayout(),
    wardrobe: {
      activeAccessories: [...accessories],
      hasHeadphones: accessories.includes(SHELL_ACCESSORY_IDS.headphones),
    },
    inventory: {
      quickProps: [...quickProps],
      hasPoolRing: quickProps.includes(SHELL_QUICK_PROP_IDS.poolRing),
    },
    dialog: {
      alwaysShowBubble: settings.dialog?.alwaysShowBubble !== false,
      surfaceOpen: isDialogSurfaceOpen(),
      conversationHoldActive: isConversationHoldActive(),
      inputActive: isDialogInputActive(),
      proactiveCooldownRemainingMs,
      proactiveEligible: !proactiveSuppressionReason && proactiveCooldownRemainingMs <= 0,
      proactiveSuppressionReason:
        proactiveSuppressionReason ||
        (proactiveConversationState.lastSuppressedReason === "none"
          ? ""
          : proactiveConversationState.lastSuppressedReason),
      proactiveLastSuppressedAtMs: proactiveConversationState.lastSuppressedAtMs || 0,
      proactiveNextCheckAtMs: proactiveConversationState.nextCheckAtMs || 0,
      proactiveBackoffTier: proactiveConversationState.backoffTier || 0,
      proactiveLastReason:
        typeof proactiveConversationState.lastAttemptReason === "string"
          ? proactiveConversationState.lastAttemptReason
          : "none",
      proactiveNextEligibleAtMs: proactiveConversationState.nextEligibleAtMs || nowMs,
      proactiveRepeatGuardWindowMs:
        latestProactivePolicySnapshot?.repeatGuardWindowMs || 0,
      proactiveLastOpenerHash:
        typeof proactiveConversationState.lastOpenerHash === "string"
          ? proactiveConversationState.lastOpenerHash
          : "none",
    },
    inventoryUi: {
      open: Boolean(inventoryWin && !inventoryWin.isDestroyed()),
      activeTab: normalizeShellWindowTab(inventoryWindowActiveTab, SHELL_WINDOW_TABS.inventory),
    },
    tray: {
      available: trayAvailable,
      supported: shellTraySupported,
      error: shellTrayError,
    },
    devFallback: {
      enabled: !trayAvailable,
      hotkeys: ["F6", "F7", "F8", "F9", "F10", "F11"],
    },
  };
}

function emitShellState(snapshot = buildShellStateSnapshot()) {
  latestShellState = snapshot;
  emitToRenderer("pet:shell-state", snapshot);
  emitToWindow(inventoryWin, "pet:shell-state", snapshot);
  syncShellQuickPropWindows();
  return snapshot;
}

function setInventoryWindowActiveTab(nextTab, emitSnapshot = true) {
  inventoryWindowActiveTab = normalizeShellWindowTab(nextTab, inventoryWindowActiveTab);
  if (!emitSnapshot) return latestShellState || buildShellStateSnapshot();
  return emitShellState(buildShellStateSnapshot());
}

function asOptionalString(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function buildPairingCheck(id, state, reason, detail) {
  return {
    id,
    state,
    reason,
    detail,
  };
}

function isPairingProbeSevereFailure(reason) {
  return (
    reason === "bridge_config_invalid" ||
    reason === "bridge_non_loopback_disabled" ||
    reason === "bridge_unavailable" ||
    reason === "plugin_lane_unavailable" ||
    reason === "bridge_unavailable_runtime"
  );
}

function derivePairingProbeOverallState(openclawEnabled, checks) {
  if (!openclawEnabled) return "disabled";
  const normalizedChecks = Array.isArray(checks) ? checks : [];
  const failedChecks = normalizedChecks.filter(
    (check) => check?.state === OPENCLAW_PAIRING_CHECK_STATES.fail
  );
  if (failedChecks.length <= 0) {
    const warned = normalizedChecks.some(
      (check) => check?.state === OPENCLAW_PAIRING_CHECK_STATES.warn
    );
    return warned ? "degraded" : "ready";
  }
  const severeFailure = failedChecks.some((check) =>
    isPairingProbeSevereFailure(asOptionalString(check?.reason, "unknown") || "unknown")
  );
  return severeFailure ? "failed" : "degraded";
}

function getOpenClawPairingSnapshot() {
  if (!openclawPairingGuidance || typeof openclawPairingGuidance.getSnapshot !== "function") {
    return null;
  }
  const openclawEnabled = Boolean(buildRuntimeSettingsSummary()?.openclaw?.enabled);
  if (!openclawEnabled && typeof openclawPairingGuidance.markProbeOutcome === "function") {
    openclawPairingGuidance.markProbeOutcome({
      kind: "openclawPairingSnapshot",
      ts: Date.now(),
      overallState: "disabled",
      checks: [],
    });
  }
  const snapshot = openclawPairingGuidance.getSnapshot();
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }
  const challenge =
    snapshot.challenge && typeof snapshot.challenge === "object"
      ? snapshot.challenge
      : null;
  const qrPayload = asOptionalString(challenge?.qrPayload, null);
  if (!challenge || !qrPayload) {
    return snapshot;
  }
  const qrImageDataUrl = buildPairingQrDataUrl(qrPayload, {
    cellSize: 8,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  if (!qrImageDataUrl) {
    return snapshot;
  }
  return {
    ...snapshot,
    challenge: {
      ...challenge,
      qrImageDataUrl,
    },
  };
}

async function runOpenClawPairingProbe() {
  const settingsSummary = buildRuntimeSettingsSummary();
  const openclaw =
    settingsSummary?.openclaw && typeof settingsSummary.openclaw === "object"
      ? settingsSummary.openclaw
      : {};
  const openclawEnabled = Boolean(openclaw.enabled);
  const checks = [];

  checks.push(
    openclawEnabled
      ? buildPairingCheck(
          OPENCLAW_PAIRING_CHECK_IDS.bridgeEnabled,
          OPENCLAW_PAIRING_CHECK_STATES.pass,
          "openclaw_enabled",
          "OpenClaw bridge is enabled."
        )
      : buildPairingCheck(
          OPENCLAW_PAIRING_CHECK_IDS.bridgeEnabled,
          OPENCLAW_PAIRING_CHECK_STATES.fail,
          "openclaw_disabled",
          "Enable OpenClaw Service in Settings before pairing."
        )
  );

  const transport = asOptionalString(openclaw.transport, BRIDGE_TRANSPORTS.stub) || BRIDGE_TRANSPORTS.stub;
  const endpoint = asOptionalString(openclaw.baseUrl, "");
  const endpointCheck = {
    ok: false,
    reason: "bridge_config_invalid",
    detail: "OpenClaw endpoint configuration is invalid.",
  };
  if (!openclawEnabled) {
    endpointCheck.ok = false;
    endpointCheck.reason = "openclaw_disabled";
    endpointCheck.detail = "OpenClaw is disabled.";
  } else if (transport === BRIDGE_TRANSPORTS.stub) {
    endpointCheck.ok = false;
    endpointCheck.reason = "bridge_transport_stub";
    endpointCheck.detail = "Switch transport to ws or http for pairing.";
  } else {
    try {
      const parsed = new URL(endpoint || "");
      const host = String(parsed.hostname || "").toLowerCase();
      const isLoopback =
        host === "localhost" || host === "127.0.0.1" || host === "::1";
      if (!isLoopback && !openclaw.allowNonLoopback) {
        endpointCheck.ok = false;
        endpointCheck.reason = "bridge_non_loopback_disabled";
        endpointCheck.detail = "Enable non-loopback endpoints for remote/VPS pairing.";
      } else {
        endpointCheck.ok = true;
        endpointCheck.reason = "endpoint_policy_ok";
        endpointCheck.detail = isLoopback
          ? "Loopback endpoint is valid."
          : "Remote endpoint policy is satisfied.";
      }
    } catch {
      endpointCheck.ok = false;
      endpointCheck.reason = "bridge_config_invalid";
      endpointCheck.detail = "OpenClaw Base URL is not a valid URL.";
    }
  }
  checks.push(
    buildPairingCheck(
      OPENCLAW_PAIRING_CHECK_IDS.bridgeEndpointPolicy,
      endpointCheck.ok ? OPENCLAW_PAIRING_CHECK_STATES.pass : OPENCLAW_PAIRING_CHECK_STATES.fail,
      endpointCheck.reason,
      endpointCheck.detail
    )
  );

  let bridgeAuthReason = "bridge_unavailable_runtime";
  let bridgeAuthDetail = "OpenClaw bridge runtime is unavailable.";
  let bridgeAuthState = OPENCLAW_PAIRING_CHECK_STATES.fail;
  if (!openclawEnabled) {
    bridgeAuthReason = "openclaw_disabled";
    bridgeAuthDetail = "OpenClaw is disabled.";
  } else if (!endpointCheck.ok) {
    bridgeAuthReason = endpointCheck.reason;
    bridgeAuthDetail = "Fix endpoint policy issues before auth pairing.";
  } else {
    const correlationId = `pair-probe-${Date.now().toString(36)}`;
    const bridgeResult = await requestBridgeDialog({
      correlationId,
      route: "introspection_status",
      promptText: "status",
    });
    const fallbackMode = asOptionalString(bridgeResult?.fallbackMode, "bridge_unavailable") || "bridge_unavailable";
    if (bridgeResult?.source === "online" && fallbackMode === "none") {
      bridgeAuthState = OPENCLAW_PAIRING_CHECK_STATES.pass;
      bridgeAuthReason = "bridge_auth_ok";
      bridgeAuthDetail = "Bridge auth is healthy.";
    } else if (fallbackMode === "bridge_auth_required") {
      bridgeAuthReason = "bridge_auth_required";
      bridgeAuthDetail = "Complete OpenClaw pairing/auth approval, then rerun probe.";
    } else {
      bridgeAuthReason = fallbackMode;
      bridgeAuthDetail = `Bridge request fell back: ${fallbackMode}.`;
    }
  }
  checks.push(
    buildPairingCheck(
      OPENCLAW_PAIRING_CHECK_IDS.bridgeAuth,
      bridgeAuthState,
      bridgeAuthReason,
      bridgeAuthDetail
    )
  );

  const commandAuthConfigured = Boolean(openclaw.petCommandSharedSecretConfigured);
  checks.push(
    !openclawEnabled
      ? buildPairingCheck(
          OPENCLAW_PAIRING_CHECK_IDS.commandAuth,
          OPENCLAW_PAIRING_CHECK_STATES.fail,
          "openclaw_disabled",
          "OpenClaw is disabled."
        )
      : commandAuthConfigured
        ? buildPairingCheck(
            OPENCLAW_PAIRING_CHECK_IDS.commandAuth,
            OPENCLAW_PAIRING_CHECK_STATES.pass,
            "command_auth_ready",
            "Pet command shared-secret ref is configured."
          )
        : buildPairingCheck(
            OPENCLAW_PAIRING_CHECK_IDS.commandAuth,
            OPENCLAW_PAIRING_CHECK_STATES.fail,
            "command_auth_missing",
            "Set pet-command shared-secret ref in Settings."
          )
  );

  if (!openclawEnabled) {
    checks.push(
      buildPairingCheck(
        OPENCLAW_PAIRING_CHECK_IDS.pluginLaneStatus,
        OPENCLAW_PAIRING_CHECK_STATES.fail,
        "openclaw_disabled",
        "OpenClaw is disabled."
      )
    );
  } else if (
    !openclawPluginSkillLane ||
    typeof openclawPluginSkillLane.processCall !== "function"
  ) {
    checks.push(
      buildPairingCheck(
        OPENCLAW_PAIRING_CHECK_IDS.pluginLaneStatus,
        OPENCLAW_PAIRING_CHECK_STATES.fail,
        "plugin_lane_unavailable",
        "Plugin lane runtime is unavailable."
      )
    );
  } else {
    const correlationId = `pair-plugin-${Date.now().toString(36)}`;
    const laneOutcome = await openclawPluginSkillLane.processCall(
      {
        contractVersion: OPENCLAW_PLUGIN_SKILL_CONTRACT_VERSION,
        call: OPENCLAW_PLUGIN_SKILL_CALL_IDS.statusRead,
        correlationId,
        payload: {
          scope: OPENCLAW_PLUGIN_SKILL_STATUS_SCOPES.bridgeSummary,
        },
      },
      { correlationId }
    );
    const laneOk = Boolean(laneOutcome?.ok);
    checks.push(
      buildPairingCheck(
        OPENCLAW_PAIRING_CHECK_IDS.pluginLaneStatus,
        laneOk ? OPENCLAW_PAIRING_CHECK_STATES.pass : OPENCLAW_PAIRING_CHECK_STATES.fail,
        laneOk ? "plugin_lane_ready" : asOptionalString(laneOutcome?.reason, "plugin_lane_rejected") || "plugin_lane_rejected",
        laneOk
          ? "Plugin lane status-read call succeeded."
          : asOptionalString(laneOutcome?.detail, "Plugin lane status-read call failed.") ||
              "Plugin lane status-read call failed."
      )
    );
  }

  const probe = {
    kind: "openclawPairingSnapshot",
    ts: Date.now(),
    overallState: derivePairingProbeOverallState(openclawEnabled, checks),
    checks,
  };

  if (
    openclawPairingGuidance &&
    typeof openclawPairingGuidance.markProbeOutcome === "function"
  ) {
    openclawPairingGuidance.markProbeOutcome(probe);
  }
  return probe;
}

function buildCurrentBehaviorRuntimeSnapshot(nowMs = Date.now()) {
  const safeNow = Math.max(0, Math.round(Number(nowMs) || 0));
  const roamMode = latestShellState?.roaming?.mode || ROAMING_MODES.desktop;
  const snapshot = buildRoamPolicySnapshot(roamPolicyState, {
    roamMode,
    nowMs: safeNow || Date.now(),
  });
  const activeAvoidedWindows = listActiveAvoidedWindows(roamPolicyState, safeNow || Date.now());
  const windowAvoidanceState = !isForegroundWindowAvoidanceSupported()
    ? "disabled"
    : roamMode !== ROAMING_MODES.desktop
      ? "disabled"
      : foregroundWindowRuntime.state || "unknown";
  const windowAvoidanceReason = !isForegroundWindowAvoidanceSupported()
    ? ROAM_POLICY_DECISION_REASONS.windowAvoidanceNotSupportedPlatform
    : roamMode !== ROAMING_MODES.desktop
      ? ROAM_POLICY_DECISION_REASONS.windowAvoidanceNotDesktopMode
      : foregroundWindowRuntime.reason || "none";
  return {
    ...snapshot,
    roamPhase: typeof roamState.phase === "string" ? roamState.phase : "idle",
    nextDecisionAtMs: Math.max(0, Math.round(Number(roamState.nextDecisionAtMs) || 0)),
    hasQueuedDestination: Boolean(roamState.queuedDestination),
    windowAvoidanceState,
    windowAvoidanceReason,
    windowAvoidMarginPx: ACTIVE_WINDOW_AVOID_MARGIN_PX,
    foregroundWindowBounds: foregroundWindowRuntime.foregroundWindowBounds
      ? summarizeBounds(foregroundWindowRuntime.foregroundWindowBounds)
      : null,
    foregroundWindowWindowId: foregroundWindowRuntime.foregroundWindowWindowId || null,
    foregroundWindowRevision: Math.max(
      0,
      Math.round(Number(foregroundWindowRuntime.foregroundWindowRevision) || 0)
    ),
    windowInspectState: foregroundWindowRuntime.windowInspectState || "idle",
    windowInspectReason: foregroundWindowRuntime.windowInspectReason || "none",
    windowInspectAnchorLane: foregroundWindowRuntime.windowInspectAnchorLane || "none",
    windowInspectAnchorPoint:
      foregroundWindowRuntime.windowInspectAnchorPoint &&
      Number.isFinite(Number(foregroundWindowRuntime.windowInspectAnchorPoint.x)) &&
      Number.isFinite(Number(foregroundWindowRuntime.windowInspectAnchorPoint.y))
        ? {
            x: Math.round(Number(foregroundWindowRuntime.windowInspectAnchorPoint.x)),
            y: Math.round(Number(foregroundWindowRuntime.windowInspectAnchorPoint.y)),
          }
        : null,
    windowInspectDwellMs: Math.max(
      0,
      Math.round(Number(foregroundWindowRuntime.windowInspectDwellMs) || WINDOW_EDGE_INSPECT_DWELL_MS)
    ),
    avoidMaskBounds: foregroundWindowRuntime.avoidMaskBounds
      ? summarizeBounds(foregroundWindowRuntime.avoidMaskBounds)
      : null,
    windowAvoidFallback: foregroundWindowRuntime.fallbackReason || "none",
    windowAvoidCooldownEntries: activeAvoidedWindows,
    windowAvoidCooldownCount: activeAvoidedWindows.length,
  };
}

function buildCurrentObservabilitySnapshot() {
  const nowMs = Date.now();
  const capabilitySnapshot =
    latestCapabilitySnapshot ||
    (capabilityRegistry && typeof capabilityRegistry.getSnapshot === "function"
      ? capabilityRegistry.getSnapshot()
      : null);
  const openclawCapabilityState =
    capabilityRegistry && typeof capabilityRegistry.getCapabilityState === "function"
      ? capabilityRegistry.getCapabilityState(CAPABILITY_IDS.openclawBridge)
      : capabilitySnapshot?.capabilities?.find(
          (entry) => entry?.capabilityId === CAPABILITY_IDS.openclawBridge
        ) || null;
  const snapshot = buildObservabilitySnapshot({
    capabilitySnapshot,
    openclawCapabilityState,
    behaviorSnapshot: buildCurrentBehaviorRuntimeSnapshot(nowMs),
    memorySnapshot:
      latestMemorySnapshot ||
      (memoryPipeline && typeof memoryPipeline.getSnapshot === "function"
        ? memoryPipeline.getSnapshot()
        : null),
    settingsSummary: buildRuntimeSettingsSummary(),
    settingsSourceMap: runtimeSettingsSourceMap,
    settingsFiles: runtimeSettingsFiles,
    validationWarnings: runtimeSettingsValidationWarnings,
    validationErrors: runtimeSettingsValidationErrors,
    resolvedPaths: runtimeSettingsResolvedPaths,
    trayAvailable: Boolean(shellTray),
    ts: nowMs,
  });
  const pairingSnapshot = getOpenClawPairingSnapshot();
  if (
    pairingSnapshot &&
    snapshot?.rows &&
    snapshot.rows.bridge &&
    typeof snapshot.rows.bridge === "object"
  ) {
    snapshot.rows.bridge.pairing = pairingSnapshot;
  }
  return snapshot;
}

function buildCurrentSetupBootstrapSnapshot() {
  return buildSetupBootstrapSnapshot({
    settingsSummary: buildRuntimeSettingsSummary(),
    resolvedPaths: runtimeSettingsResolvedPaths,
    ts: Date.now(),
  });
}

function buildCurrentShellSettingsSnapshot() {
  return buildShellSettingsSnapshot({
    app,
    projectRoot: __dirname,
    settingsSummary: buildRuntimeSettingsSummary(),
    settingsSourceMap: runtimeSettingsSourceMap,
    settingsFiles: runtimeSettingsFiles,
    ts: Date.now(),
  });
}

function shouldRefreshMemoryRuntimeForSettingsPatchKeys(keys = []) {
  if (!Array.isArray(keys) || keys.length <= 0) return false;
  return keys.some((key) => {
    if (typeof key !== "string" || key.trim().length <= 0) return false;
    return (
      key.startsWith("memory.") ||
      key === "openclaw.enabled" ||
      key === "paths.localWorkspaceRoot" ||
      key === "paths.openClawWorkspaceRoot" ||
      key === "paths.obsidianVaultRoot"
    );
  });
}

async function applyShellSettingsEditorPatch(patchInput = {}) {
  const validation = validateShellSettingsPatch({ patch: patchInput });
  const acceptedKeys = validation.accepted.map((entry) => entry.key);
  const normalizedPatch =
    validation.normalizedPatch && typeof validation.normalizedPatch === "object"
      ? validation.normalizedPatch
      : {};
  const characterScaleEntry = validation.accepted.find(
    (entry) => entry.key === "ui.characterScalePercent"
  );
  if (characterScaleEntry && Number.isFinite(Number(characterScaleEntry.value))) {
    if (!normalizedPatch.ui || typeof normalizedPatch.ui !== "object") {
      normalizedPatch.ui = {};
    }
    normalizedPatch.ui.characterHitboxScalePercent = Math.round(
      Number(characterScaleEntry.value)
    );
  }
  if (acceptedKeys.length > 0) {
    applyRuntimeSettingsPatch(normalizedPatch, "shell_settings_editor_apply");
    if (shouldRefreshMemoryRuntimeForSettingsPatchKeys(acceptedKeys)) {
      await initializeMemoryPipelineRuntime();
    }
  }

  const shellState = latestShellState || buildShellStateSnapshot();
  const observability = buildCurrentObservabilitySnapshot();
  const settingsSnapshot = buildCurrentShellSettingsSnapshot();
  const fieldByKey = new Map((settingsSnapshot.fields || []).map((field) => [field.key, field]));
  const envOverrides = acceptedKeys.filter((key) => fieldByKey.get(key)?.source === "env");
  return {
    ok: validation.rejected.length === 0,
    acceptedKeys,
    rejected: validation.rejected,
    envOverrides,
    overridePath: settingsSnapshot.overridePath || null,
    shellState,
    observability,
    settingsSnapshot,
  };
}

function buildCurrentObservabilityDetail(
  subjectId = DEFAULT_OBSERVABILITY_SUBJECT_ID,
  snapshot = buildCurrentObservabilitySnapshot()
) {
  return buildObservabilityDetail({
    snapshot,
    subjectId,
    settingsSourceMap: runtimeSettingsSourceMap,
    ts: Date.now(),
  });
}

function buildObservabilityDetailClipboardText(detail) {
  const subject = detail?.subject || {};
  const summary = detail?.summary || {};
  const provenance = Array.isArray(detail?.provenance) ? detail.provenance : [];
  const suggestedSteps = Array.isArray(detail?.suggestedSteps) ? detail.suggestedSteps : [];
  const pairing = detail?.pairing && typeof detail.pairing === "object" ? detail.pairing : null;
  const lines = [
    `${subject.label || "Observability Detail"}`,
    `State: ${subject.state || "unknown"}`,
    `Reason: ${subject.reason || "unknown"}`,
    "",
    `${summary.headline || "No headline available."}`,
    `${summary.impact || "No impact text available."}`,
    `Ownership: ${summary.ownership || "unknown"}`,
    `Repairability: ${summary.repairability || "unknown"}`,
  ];
  if (provenance.length > 0) {
    lines.push("", "Provenance:");
    for (const entry of provenance) {
      lines.push(`- ${entry.label || "Detail"}: ${entry.value || "unknown"}`);
    }
  }
  if (pairing) {
    lines.push(
      "",
      "Pairing:",
      `- Pairing State: ${pairing.pairingState || "unknown"}`,
      `- Last Method: ${pairing.lastMethod || "none"}`
    );
    if (pairing.challenge && typeof pairing.challenge === "object") {
      lines.push(
        `- Pairing Id: ${pairing.challenge.pairingId || "unknown"}`,
        `- Challenge Expires: ${
          Number.isFinite(Number(pairing.challenge.expiresAtMs))
            ? Math.round(Number(pairing.challenge.expiresAtMs))
            : "unknown"
        }`,
        `- QR Payload: ${pairing.challenge.qrPayload || "none"}`,
        `- Pairing Code: ${pairing.challenge.code || "none"}`
      );
    }
  }
  if (suggestedSteps.length > 0) {
    lines.push("", "Suggested Steps:");
    for (const step of suggestedSteps) {
      lines.push(`- ${step}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function getObservabilityDetailPath(detail) {
  const provenance = Array.isArray(detail?.provenance) ? detail.provenance : [];
  const pathEntry = provenance.find(
    (entry) =>
      entry?.kind === "path" &&
      typeof entry.value === "string" &&
      entry.value.trim().length > 0 &&
      entry.value !== "Unavailable"
  );
  return pathEntry ? pathEntry.value.trim() : null;
}

async function runObservabilityAction(actionId, subjectId) {
  const snapshot = buildCurrentObservabilitySnapshot();
  const detail = buildCurrentObservabilityDetail(subjectId, snapshot);
  const normalizedActionId = typeof actionId === "string" ? actionId.trim() : "";
  const enabledActions = Array.isArray(detail?.actions) ? detail.actions : [];
  const selectedAction = enabledActions.find(
    (entry) => entry.actionId === normalizedActionId && entry.enabled !== false
  );
  if (!selectedAction) {
    return {
      ok: false,
      error: "observability_action_unavailable",
      actionId: normalizedActionId,
      subjectId: detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      snapshot,
      detail,
    };
  }

  if (normalizedActionId === OBSERVABILITY_DETAIL_ACTION_IDS.refreshStatus) {
    const refreshedSnapshot = buildCurrentObservabilitySnapshot();
    const refreshedDetail = buildCurrentObservabilityDetail(
      detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      refreshedSnapshot
    );
    return {
      ok: true,
      actionId: normalizedActionId,
      subjectId: refreshedDetail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      snapshot: refreshedSnapshot,
      detail: refreshedDetail,
      shellState: latestShellState || buildShellStateSnapshot(),
    };
  }

  if (normalizedActionId === OBSERVABILITY_DETAIL_ACTION_IDS.openSetup) {
    const shellResult = await runShellAction(SHELL_ACTIONS.openSetup);
    if (!shellResult?.ok) {
      return {
        ...shellResult,
        actionId: normalizedActionId,
        subjectId: detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
        snapshot,
        detail,
      };
    }
    const refreshedSnapshot = buildCurrentObservabilitySnapshot();
    const refreshedDetail = buildCurrentObservabilityDetail(
      detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      refreshedSnapshot
    );
    return {
      ok: true,
      actionId: normalizedActionId,
      subjectId: refreshedDetail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      snapshot: refreshedSnapshot,
      detail: refreshedDetail,
      shellState: shellResult?.shellState || latestShellState || buildShellStateSnapshot(),
    };
  }

  if (normalizedActionId === OBSERVABILITY_DETAIL_ACTION_IDS.openSettings) {
    const shellResult = await runShellAction(SHELL_ACTIONS.openSettings);
    if (!shellResult?.ok) {
      return {
        ...shellResult,
        actionId: normalizedActionId,
        subjectId: detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
        snapshot,
        detail,
      };
    }
    const refreshedSnapshot = buildCurrentObservabilitySnapshot();
    const refreshedDetail = buildCurrentObservabilityDetail(
      detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      refreshedSnapshot
    );
    return {
      ok: true,
      actionId: normalizedActionId,
      subjectId: refreshedDetail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      snapshot: refreshedSnapshot,
      detail: refreshedDetail,
      shellState: shellResult?.shellState || latestShellState || buildShellStateSnapshot(),
    };
  }

  if (normalizedActionId === OBSERVABILITY_DETAIL_ACTION_IDS.runReflectionNow) {
    const reflectionOutcome = await runReflectionCycle({
      cycleId: REFLECTION_CYCLE_IDS.heartbeat,
      trigger: "manual_action",
      scheduledAtMs: Date.now(),
      isRetry: false,
    });
    const refreshedSnapshot = buildCurrentObservabilitySnapshot();
    const refreshedDetail = buildCurrentObservabilityDetail(
      detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      refreshedSnapshot
    );
    return {
      ok: true,
      actionId: normalizedActionId,
      subjectId: refreshedDetail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      snapshot: refreshedSnapshot,
      detail: refreshedDetail,
      reflectionOutcome,
      shellState: latestShellState || buildShellStateSnapshot(),
    };
  }

  if (normalizedActionId === OBSERVABILITY_DETAIL_ACTION_IDS.startPairingQr) {
    if (
      !openclawPairingGuidance ||
      typeof openclawPairingGuidance.startChallenge !== "function"
    ) {
      return {
        ok: false,
        error: "pairing_guidance_unavailable",
        actionId: normalizedActionId,
        subjectId: detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
        snapshot,
        detail,
      };
    }
    const pairingSnapshot = openclawPairingGuidance.startChallenge("qr");
    const refreshedSnapshot = buildCurrentObservabilitySnapshot();
    const refreshedDetail = buildCurrentObservabilityDetail(
      detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      refreshedSnapshot
    );
    return {
      ok: true,
      actionId: normalizedActionId,
      pairingChallenge:
        pairingSnapshot?.challenge && typeof pairingSnapshot.challenge === "object"
          ? pairingSnapshot.challenge
          : null,
      subjectId: refreshedDetail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      snapshot: refreshedSnapshot,
      detail: refreshedDetail,
      shellState: latestShellState || buildShellStateSnapshot(),
    };
  }

  if (normalizedActionId === OBSERVABILITY_DETAIL_ACTION_IDS.copyPairingCode) {
    if (
      !openclawPairingGuidance ||
      typeof openclawPairingGuidance.ensureChallenge !== "function"
    ) {
      return {
        ok: false,
        error: "pairing_guidance_unavailable",
        actionId: normalizedActionId,
        subjectId: detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
        snapshot,
        detail,
      };
    }
    const pairingSnapshot = openclawPairingGuidance.ensureChallenge("code");
    const pairingCode = asOptionalString(pairingSnapshot?.challenge?.code, null);
    if (!pairingCode) {
      return {
        ok: false,
        error: "pairing_code_unavailable",
        actionId: normalizedActionId,
        subjectId: detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
        snapshot,
        detail,
      };
    }
    clipboard.writeText(pairingCode);
    const refreshedSnapshot = buildCurrentObservabilitySnapshot();
    const refreshedDetail = buildCurrentObservabilityDetail(
      detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      refreshedSnapshot
    );
    return {
      ok: true,
      actionId: normalizedActionId,
      copiedText: pairingCode,
      pairingChallenge:
        pairingSnapshot?.challenge && typeof pairingSnapshot.challenge === "object"
          ? pairingSnapshot.challenge
          : null,
      subjectId: refreshedDetail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      snapshot: refreshedSnapshot,
      detail: refreshedDetail,
      shellState: latestShellState || buildShellStateSnapshot(),
    };
  }

  if (normalizedActionId === OBSERVABILITY_DETAIL_ACTION_IDS.retryPairing) {
    if (
      !openclawPairingGuidance ||
      typeof openclawPairingGuidance.retryChallenge !== "function"
    ) {
      return {
        ok: false,
        error: "pairing_guidance_unavailable",
        actionId: normalizedActionId,
        subjectId: detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
        snapshot,
        detail,
      };
    }
    const pairingSnapshot = openclawPairingGuidance.retryChallenge();
    const refreshedSnapshot = buildCurrentObservabilitySnapshot();
    const refreshedDetail = buildCurrentObservabilityDetail(
      detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      refreshedSnapshot
    );
    return {
      ok: true,
      actionId: normalizedActionId,
      pairingChallenge:
        pairingSnapshot?.challenge && typeof pairingSnapshot.challenge === "object"
          ? pairingSnapshot.challenge
          : null,
      subjectId: refreshedDetail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      snapshot: refreshedSnapshot,
      detail: refreshedDetail,
      shellState: latestShellState || buildShellStateSnapshot(),
    };
  }

  if (normalizedActionId === OBSERVABILITY_DETAIL_ACTION_IDS.runPairingProbe) {
    const pairingProbe = await runOpenClawPairingProbe();
    const refreshedSnapshot = buildCurrentObservabilitySnapshot();
    const refreshedDetail = buildCurrentObservabilityDetail(
      detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      refreshedSnapshot
    );
    return {
      ok: true,
      actionId: normalizedActionId,
      pairingProbe,
      subjectId: refreshedDetail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      snapshot: refreshedSnapshot,
      detail: refreshedDetail,
      shellState: latestShellState || buildShellStateSnapshot(),
    };
  }

  if (normalizedActionId === OBSERVABILITY_DETAIL_ACTION_IDS.copyPath) {
    const pathValue = getObservabilityDetailPath(detail);
    if (!pathValue) {
      return {
        ok: false,
        error: "observability_path_unavailable",
        actionId: normalizedActionId,
        subjectId: detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
        snapshot,
        detail,
      };
    }
    clipboard.writeText(pathValue);
    return {
      ok: true,
      actionId: normalizedActionId,
      subjectId: detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      copiedText: pathValue,
      snapshot,
      detail,
    };
  }

  if (normalizedActionId === OBSERVABILITY_DETAIL_ACTION_IDS.copyDetails) {
    const copiedText = buildObservabilityDetailClipboardText(detail);
    clipboard.writeText(copiedText);
    return {
      ok: true,
      actionId: normalizedActionId,
      subjectId: detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
      copiedText,
      snapshot,
      detail,
    };
  }

  return {
    ok: false,
    error: "unknown_observability_action",
    actionId: normalizedActionId,
    subjectId: detail?.subject?.subjectId || DEFAULT_OBSERVABILITY_SUBJECT_ID,
    snapshot,
    detail,
  };
}

function setDiagnosticsEnabled(nextEnabled, reason = "settings_update") {
  const previousEnabled = DIAGNOSTICS_ENABLED;
  DIAGNOSTICS_ENABLED = Boolean(nextEnabled);
  if (previousEnabled === DIAGNOSTICS_ENABLED) return;

  if (DIAGNOSTICS_ENABLED) {
    initializeDiagnosticsLog();
    logDiagnostics("diagnostics-enabled", {
      kind: "shellDiagnosticsToggle",
      reason,
      enabled: true,
    });
    return;
  }

  console.log(`[pet-shell] diagnostics disabled (${reason})`);
  closeDiagnosticsLog();
}

function applyRuntimePetLayout(reason = "settings_update") {
  const previousWindowSize = getPetWindowSize();
  const scalePercent = resolveCharacterScalePercent(runtimeSettings);
  const nextScale = scalePercent / 100;
  const nextLayout = computePetLayout({
    ...BASE_LAYOUT,
    scale: nextScale,
  });

  runtimePetLayout = nextLayout;
  runtimeWindowSize = nextLayout.windowSize;
  runtimeVisualBounds = nextLayout.visualBounds;
  runtimeHitboxScale = nextScale;
  activePetVisualBounds = { ...runtimeVisualBounds };
  activePetBoundsUpdatedAtMs = 0;
  syncPropWindowScale(reason);

  if (!win || win.isDestroyed()) return;

  const contentBounds = win.getContentBounds();
  const center = {
    x: Math.round(contentBounds.x + previousWindowSize.width * 0.5),
    y: Math.round(contentBounds.y + previousWindowSize.height * 0.5),
  };
  const targetX = Math.round(center.x - runtimeWindowSize.width * 0.5);
  const targetY = Math.round(center.y - runtimeWindowSize.height * 0.5);
  const display = screen.getDisplayNearestPoint(center);
  const clamped = clampWindowPosition(
    targetX,
    targetY,
    getClampArea(display),
    getActivePetVisualBounds(Date.now())
  );

  win.setMinimumSize(runtimeWindowSize.width, runtimeWindowSize.height);
  win.setMaximumSize(runtimeWindowSize.width, runtimeWindowSize.height);
  applyFixedContentBounds(win, runtimeWindowSize, clamped.x, clamped.y);
  resetMotionSampleFromWindow();
  emitMotionState({
    velocityOverride: { vx: 0, vy: 0 },
    collided: { x: false, y: false },
    impact: { triggered: false, strength: 0 },
  });

  logDiagnostics("layout-updated", {
    reason,
    scalePercent,
    hitboxScalePercent: scalePercent,
    windowSize: runtimeWindowSize,
    visualBounds: runtimeVisualBounds,
  });
}

function initializeRuntimeSettings(reason = "startup") {
  const loaded = loadRuntimeSettings({
    app,
    projectRoot: __dirname,
    env: process.env,
  });
  runtimeSettings = loaded.settings;
  runtimeSettingsSourceMap = loaded.sourceMap || {};
  runtimeSettingsValidationWarnings = Array.isArray(loaded.validationWarnings)
    ? loaded.validationWarnings
    : [];
  runtimeSettingsValidationErrors = Array.isArray(loaded.validationErrors)
    ? loaded.validationErrors
    : [];
  runtimeSettingsResolvedPaths = loaded.resolvedPaths || null;
  runtimeSettingsFiles = loaded.files || null;

  const activeEnvOverrideKeys = Object.entries(runtimeSettingsSourceMap)
    .filter(
      ([key, source]) =>
        source === "env" &&
        typeof key === "string" &&
        key.includes(".")
    )
    .map(([key]) => key)
    .sort();
  if (activeEnvOverrideKeys.length > 0) {
    console.warn(
      `[settings] active environment overrides (${activeEnvOverrideKeys.length}): ${activeEnvOverrideKeys.join(
        ", "
      )}`
    );
  }

  if (runtimeSettingsValidationWarnings.length > 0) {
    for (const warning of runtimeSettingsValidationWarnings) {
      console.warn(warning);
    }
  }
  if (runtimeSettingsValidationErrors.length > 0) {
    for (const error of runtimeSettingsValidationErrors) {
      console.warn(error);
    }
  }
  setDiagnosticsEnabled(Boolean(runtimeSettings?.ui?.diagnosticsEnabled), reason);
  applyRuntimePetLayout(reason);
  initializeOpenClawPetCommandLaneRuntime();
  initializeOpenClawPluginSkillLaneRuntime();
}

function createShellTrayIcon() {
  return nativeImage
    .createFromBuffer(Buffer.from(TRAY_ICON_PNG_BASE64, "base64"))
    .resize({ width: 16, height: 16, quality: "best" });
}

function toggleMembership(list, value) {
  const source = Array.isArray(list) ? list.filter((entry) => typeof entry === "string") : [];
  return source.includes(value) ? source.filter((entry) => entry !== value) : [...source, value];
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function getPropWindowSpec(propId) {
  if (!Object.prototype.hasOwnProperty.call(PROP_WINDOW_SPECS, propId)) {
    return null;
  }
  const baseSpec = PROP_WINDOW_SPECS[propId];
  const scale = clampNumber(getPetLayout()?.scale ?? 1, 0.5, 2);
  return buildScaledPropWindowSpec(baseSpec, scale);
}

function scalePropMetric(value, scale) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.max(1, Math.round(Number(value) * scale));
}

function buildScaledPropWindowSpec(baseSpec, scale) {
  if (!baseSpec || typeof baseSpec !== "object") return null;
  const safeScale = clampNumber(scale, 0.5, 2);
  return {
    propId: baseSpec.propId,
    label: baseSpec.label,
    windowSize: {
      width: scalePropMetric(baseSpec.windowSize?.width, safeScale),
      height: scalePropMetric(baseSpec.windowSize?.height, safeScale),
    },
    visualBounds: {
      x: Math.max(0, Math.round(Number(baseSpec.visualBounds?.x || 0) * safeScale)),
      y: Math.max(0, Math.round(Number(baseSpec.visualBounds?.y || 0) * safeScale)),
      width: scalePropMetric(baseSpec.visualBounds?.width, safeScale),
      height: scalePropMetric(baseSpec.visualBounds?.height, safeScale),
    },
  };
}

function buildPropWindowModel(propId) {
  const spec = getPropWindowSpec(propId);
  if (!spec) return null;
  return {
    propId: spec.propId,
    label: spec.label,
    windowSize: spec.windowSize,
    visualBounds: spec.visualBounds,
  };
}

function getWindowDisplay(targetWindow, windowSize = null) {
  const center = getWindowCenterPoint(targetWindow, windowSize);
  return screen.getDisplayNearestPoint(center);
}

function findPropWindowRecordByWebContentsId(webContentsId) {
  if (!Number.isFinite(Number(webContentsId))) return null;
  for (const record of propWindows.values()) {
    if (!record?.window || record.window.isDestroyed()) continue;
    if (record.window.webContents.id === webContentsId) {
      return record;
    }
  }
  return null;
}

function getDefaultInventoryWindowPosition() {
  const margin = 28;
  if (win && !win.isDestroyed()) {
    const petWindowSize = getPetWindowSize();
    const [petX, petY] = win.getPosition();
    const display = getWindowDisplay(win, petWindowSize);
    const area = getClampArea(display);
    const preferredX = petX + petWindowSize.width + margin;
    const preferredY = petY + margin;
    return {
      x: Math.max(
        area.x + margin,
        Math.min(preferredX, area.x + area.width - INVENTORY_WINDOW_SIZE.width - margin)
      ),
      y: Math.max(
        area.y + margin,
        Math.min(preferredY, area.y + area.height - INVENTORY_WINDOW_SIZE.height - margin)
      ),
    };
  }

  const area = getClampArea(screen.getPrimaryDisplay());
  return {
    x: area.x + Math.max(margin, Math.round(area.width * 0.16)),
    y: area.y + Math.max(margin, Math.round(area.height * 0.12)),
  };
}

function normalizeRoamZoneRect(rect) {
  if (!rect || typeof rect !== "object") return null;
  const x = Number(rect.x);
  const y = Number(rect.y);
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  if (width < MIN_ROAM_ZONE_RECT_SIZE || height < MIN_ROAM_ZONE_RECT_SIZE) {
    return null;
  }
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function getRoamZoneLabel(snapshot = latestShellState) {
  if (snapshot?.roaming?.zoneRect) return "custom";
  return snapshot?.roaming?.zone || DEFAULT_ROAMING_ZONE;
}

function getRoamPetBounds(nowMs = Date.now()) {
  const sourceBounds = getActivePetVisualBounds(nowMs) || getBasePetVisualBounds();
  const petWindowSize = getPetWindowSize();
  const normalized = normalizePetBounds(
    {
      ...sourceBounds,
      tMs: nowMs,
    },
    petWindowSize
  );
  if (normalized) return normalized;
  return {
    ...getBasePetVisualBounds(),
    tMs: nowMs,
  };
}

function isAmbientStateId(stateId) {
  return (
    stateId === "Idle" ||
    stateId === "Roam" ||
    stateId === "WatchMode" ||
    stateId === "MusicChill"
  );
}

function isDialogSurfaceOpen() {
  return dialogPresence.surfaceOpen === true;
}

function isConversationHoldActive() {
  return isDialogSurfaceOpen();
}

function isDialogInputActive() {
  return dialogUserMessageInFlightCount > 0;
}

function getProactiveCooldownRemainingMs(nowMs = Date.now()) {
  return getCooldownRemainingMs(proactiveConversationState, nowMs);
}

function isProactiveQuietHoursActive() {
  return false;
}

function getProactiveSuppressionReason({
  nowMs = Date.now(),
  candidateOpenerHash = "",
} = {}) {
  const evaluation = evaluateProactiveSuppression({
    state: proactiveConversationState,
    nowMs,
    dialogOpen: isDialogSurfaceOpen(),
    inputActive: isDialogInputActive(),
    stateEligible: isAmbientStateId(latestStateSnapshot?.currentState || "Idle"),
    quietHoursActive: isProactiveQuietHoursActive(),
    candidateOpenerHash,
  });
  return evaluation.suppressed ? evaluation.reason : "";
}

function getCurrentPersonaSnapshotForOffline() {
  if (latestPersonaSnapshotRuntime && typeof latestPersonaSnapshotRuntime === "object") {
    return latestPersonaSnapshotRuntime;
  }
  const personaContext = refreshPersonaSnapshotCache({
    recordExportMode: null,
  });
  return personaContext?.personaSnapshot || null;
}

function buildProactiveConversationPrompt(nowMs = Date.now()) {
  const personaSnapshot = getCurrentPersonaSnapshotForOffline();
  const currentState = latestStateSnapshot?.currentState || "Idle";
  let stateDescription = "I am keeping to local routines.";
  if (latestStateSnapshot?.currentState === "Reading") {
    stateDescription =
      stateRuntime?.describeReading?.()?.text ||
      "I am in reading mode with local context.";
  } else if (isMusicStateId(currentState)) {
    stateDescription = "I can chat about what is playing right now.";
  } else {
    stateDescription = stateRuntime?.describeActivity?.()?.text || "I am keeping to local routines.";
  }
  return buildPersonaAwareProactivePrompt({
    ts: nowMs,
    reason: PROACTIVE_CONVERSATION_REASON,
    backoffTier: proactiveConversationState.backoffTier || 0,
    lastOpenerHash:
      typeof proactiveConversationState.lastOpenerHash === "string"
        ? proactiveConversationState.lastOpenerHash
        : "none",
    personaSnapshot,
    currentState,
    phase: latestStateSnapshot?.phase || null,
    stateDescription,
    stateContextSummary: summarizeDialogStateContext(),
  });
}

function pickAmbientRestStateId(snapshot = latestShellState) {
  const roamMode = snapshot?.roaming?.mode || ROAMING_MODES.desktop;
  if (roamMode === ROAMING_MODES.zone) {
    return "WatchMode";
  }
  return "Idle";
}

function getBoundsUnion(boundsList) {
  if (!Array.isArray(boundsList) || boundsList.length <= 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const bounds of boundsList) {
    if (
      !bounds ||
      !Number.isFinite(bounds.x) ||
      !Number.isFinite(bounds.y) ||
      !Number.isFinite(bounds.width) ||
      !Number.isFinite(bounds.height) ||
      bounds.width <= 0 ||
      bounds.height <= 0
    ) {
      continue;
    }
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.max(1, Math.round(maxX - minX)),
    height: Math.max(1, Math.round(maxY - minY)),
  };
}

function getDesktopRoamLayout() {
  const displayAreas = screen
    .getAllDisplays()
    .map((display) => ({
      displayId: display.id,
      bounds: summarizeBounds(getClampArea(display)),
    }))
    .filter((entry) => entry.bounds.width > 0 && entry.bounds.height > 0);
  if (displayAreas.length > 0) {
    const areas = displayAreas.map((entry) => entry.bounds);
    return {
      displayAreas,
      areas,
      bounds: getBoundsUnion(areas),
    };
  }

  const fallbackDisplay = screen.getPrimaryDisplay();
  const fallbackBounds = summarizeBounds(getClampArea(fallbackDisplay));
  return {
    displayAreas: [
      {
        displayId: fallbackDisplay?.id,
        bounds: fallbackBounds,
      },
    ],
    areas: [fallbackBounds],
    bounds: fallbackBounds,
  };
}

function pickRoamSamplingArea(areas) {
  if (!Array.isArray(areas) || areas.length <= 0) return null;
  let totalArea = 0;
  const weightedAreas = areas.map((area) => {
    const weight = Math.max(1, Math.round(area.width * area.height));
    totalArea += weight;
    return {
      area,
      weight,
    };
  });
  let remaining = randomBetween(0, Math.max(1, totalArea));
  for (const entry of weightedAreas) {
    remaining -= entry.weight;
    if (remaining <= 0) {
      return entry.area;
    }
  }
  return weightedAreas[weightedAreas.length - 1]?.area || null;
}

function resolveRoamVisualDirection(dx, dy, fallbackDirection = "Down") {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < 0.001 && absY < 0.001) {
    return fallbackDirection;
  }

  const dominantAxis = Math.max(absX, absY);
  const diagonalRatio = dominantAxis > 0 ? Math.min(absX, absY) / dominantAxis : 0;
  if (diagonalRatio >= ROAM_DIAGONAL_DIRECTION_RATIO) {
    if (dx >= 0 && dy >= 0) return "DownRight";
    if (dx >= 0 && dy < 0) return "UpRight";
    if (dx < 0 && dy < 0) return "UpLeft";
    return "DownLeft";
  }

  if (absX >= absY) {
    return dx >= 0 ? "Right" : "Left";
  }
  return dy >= 0 ? "Down" : "Up";
}

function getRoamBounds(display, mode, zone, zoneRect = null) {
  const normalizedZoneRect = normalizeRoamZoneRect(zoneRect);
  if (mode === ROAMING_MODES.zone && normalizedZoneRect) {
    return normalizedZoneRect;
  }
  const clampArea = getClampArea(display);
  if (mode !== ROAMING_MODES.zone) {
    return clampArea;
  }

  const width = Math.max(420, Math.round(clampArea.width * (1 - ROAM_ZONE_INSET_RATIO * 2)));
  const height = Math.max(320, Math.round(clampArea.height * (1 - ROAM_ZONE_INSET_RATIO * 2)));
  let x = clampArea.x + Math.round((clampArea.width - width) * 0.5);
  if (zone === "desk-left") {
    x = clampArea.x + Math.round(clampArea.width * 0.08);
  } else if (zone === "desk-right") {
    x = clampArea.x + clampArea.width - width - Math.round(clampArea.width * 0.08);
  }
  const y = clampArea.y + Math.round((clampArea.height - height) * 0.5);
  return {
    x,
    y,
    width,
    height,
  };
}

function computeRoamWindowRange(roamBounds, petBounds) {
  if (!roamBounds || !petBounds) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };
  }
  const minX = Math.round(roamBounds.x - petBounds.x);
  const maxX = Math.round(roamBounds.x + roamBounds.width - petBounds.x - petBounds.width);
  const minY = Math.round(roamBounds.y - petBounds.y);
  const maxY = Math.round(roamBounds.y + roamBounds.height - petBounds.y - petBounds.height);
  if (maxX >= minX && maxY >= minY) {
    return { minX, maxX, minY, maxY };
  }
  return {
    minX: minX,
    maxX: minX,
    minY: minY,
    maxY: minY,
  };
}

function isWindowPositionWithinRange(x, y, range) {
  return x >= range.minX && x <= range.maxX && y >= range.minY && y <= range.maxY;
}

function getActiveZoneRoamWindowRange(snapshot = latestShellState, petBounds = getRoamPetBounds()) {
  if (!snapshot || snapshot.roaming?.mode !== ROAMING_MODES.zone) return null;
  const zoneRect = normalizeRoamZoneRect(snapshot.roaming?.zoneRect);
  if (!zoneRect) return null;
  return computeRoamWindowRange(zoneRect, petBounds);
}

function maybeExitZoneRoamAfterManualMove(reason = "manual_zone_escape") {
  if (!win || win.isDestroyed()) return false;

  const petBounds = getRoamPetBounds();
  const activeZoneRange = getActiveZoneRoamWindowRange(latestShellState, petBounds);
  if (!activeZoneRange) return false;

  const [winX, winY] = win.getPosition();
  if (isWindowPositionWithinRange(winX, winY, activeZoneRange)) {
    return false;
  }

  applyRuntimeSettingsPatch(
    {
      roaming: {
        mode: ROAMING_MODES.desktop,
      },
    },
    reason
  );
  roamState.queuedDestination = null;
  cancelRoamMotion();
  syncShellRoamingState(reason, true);
  return true;
}

function getCurrentPetDisplayId() {
  if (!win || win.isDestroyed()) return null;
  const display = getWindowDisplay(win, getPetWindowSize());
  const displayId = Number(display?.id);
  if (!Number.isFinite(displayId)) return null;
  return Math.round(displayId);
}

function maybeRecordManualMonitorAvoidance(reason = "manual_monitor_correction") {
  const nowMs = Date.now();
  const roamMode = latestShellState?.roaming?.mode || ROAMING_MODES.desktop;
  const fromDisplayId = manualCorrectionStartDisplayId;
  const toDisplayId = getCurrentPetDisplayId();
  manualCorrectionStartDisplayId = null;
  if (roamMode !== ROAMING_MODES.desktop) {
    return null;
  }
  if (!Number.isFinite(Number(fromDisplayId)) || !Number.isFinite(Number(toDisplayId))) {
    return null;
  }
  return recordManualDisplayAvoidance(roamPolicyState, {
    fromDisplayId,
    toDisplayId,
    nowMs,
    sourceReason: reason,
  });
}

function buildWindowAvoidMaskForCandidate(candidateBounds, samplingAreas, petBounds) {
  const plan = planActiveWindowAvoidanceSampling({
    samplingAreas,
    activeWindowBounds: candidateBounds,
    avoidMarginPx: ACTIVE_WINDOW_AVOID_MARGIN_PX,
    petBounds,
    strictAvoidActive: false,
  });
  return plan?.avoidMaskBounds || null;
}

function maybeRecordManualWindowAvoidance(reason = "manual_window_correction") {
  const start = manualWindowCorrectionStartContext;
  manualWindowCorrectionStartContext = null;
  if (!start || !start.startedInsideMask) return null;
  const roamMode = latestShellState?.roaming?.mode || ROAMING_MODES.desktop;
  if (roamMode !== ROAMING_MODES.desktop) return null;
  if (!win || win.isDestroyed()) return null;

  const nowMs = Date.now();
  const [winX, winY] = win.getPosition();
  const petWorldBounds = buildPetVisualWorldBoundsAt(winX, winY, nowMs);
  const maskBounds = normalizeBoundsRect(start.maskBounds);
  if (!petWorldBounds || !maskBounds) return null;
  const endedInsideMask = Boolean(intersectBoundsRect(petWorldBounds, maskBounds));
  if (endedInsideMask) return null;

  const outcome = recordManualWindowAvoidance(roamPolicyState, {
    windowId: start.windowId,
    nowMs,
    sourceReason: reason,
  });
  if (outcome?.recorded) {
    foregroundWindowRuntime.windowInspectState = "suppressed";
    foregroundWindowRuntime.windowInspectReason =
      ROAM_POLICY_DECISION_REASONS.windowAvoidCooldownActive;
    foregroundWindowRuntime.windowInspectAnchorLane = "none";
    foregroundWindowRuntime.windowInspectAnchorPoint = null;
    foregroundWindowRuntime.decisionReason = ROAM_POLICY_DECISION_REASONS.manualWindowAvoidRecorded;
    roamPolicyState.windowDecisionReason = ROAM_POLICY_DECISION_REASONS.manualWindowAvoidRecorded;
  }
  return outcome;
}

function resetRoamDirectionMemory() {
  roamState.lastLegVector = null;
  roamState.lastLegCompletedAtMs = 0;
}

function getPrimaryHorizontalDirectionSign(vector) {
  if (!vector || typeof vector !== "object") return 0;
  const dx = Number(vector.x);
  const dy = Number(vector.y);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
  if (Math.abs(dx) < Math.max(60, Math.abs(dy) * 1.1)) return 0;
  return dx > 0 ? 1 : -1;
}

function shouldAvoidImmediateReverseRoamDirection(candidate, {
  fromX,
  fromY,
  nowMs = Date.now(),
} = {}) {
  if (!candidate || !roamState.lastLegVector) return false;
  if (
    !Number.isFinite(Number(roamState.lastLegCompletedAtMs)) ||
    nowMs - Number(roamState.lastLegCompletedAtMs) >= ROAM_DIRECTION_REVERSAL_MIN_IDLE_MS
  ) {
    return false;
  }

  const previousDirectionSign = getPrimaryHorizontalDirectionSign(roamState.lastLegVector);
  if (!previousDirectionSign) return false;
  const candidateVector = {
    x: Number(candidate.x) - Number(fromX),
    y: Number(candidate.y) - Number(fromY),
  };
  const candidateDirectionSign = getPrimaryHorizontalDirectionSign(candidateVector);
  if (!candidateDirectionSign) return false;
  if (candidateDirectionSign !== -previousDirectionSign) return false;

  const candidateDistance = Math.hypot(candidateVector.x, candidateVector.y);
  return candidateDistance >= ROAM_DIRECTION_REVERSAL_MIN_DISTANCE_PX;
}

function chooseRoamDestination(nowMs = Date.now(), options = {}) {
  if (!win || win.isDestroyed()) return null;
  requestForegroundWindowPoll("decision_boundary");
  const [currentWinX, currentWinY] = win.getPosition();
  const winX = Number.isFinite(Number(options.fromX)) ? Math.round(Number(options.fromX)) : currentWinX;
  const winY = Number.isFinite(Number(options.fromY)) ? Math.round(Number(options.fromY)) : currentWinY;
  const display = options.display || getWindowDisplay(win, getPetWindowSize());
  const roamMode = options.mode || latestShellState?.roaming?.mode || ROAMING_MODES.desktop;
  const roamZone = options.zone || getRoamZoneLabel(latestShellState);
  const roamZoneRect =
    Object.prototype.hasOwnProperty.call(options, "zoneRect")
      ? options.zoneRect
      : latestShellState?.roaming?.zoneRect || null;
  const desktopRoamLayout = roamMode === ROAMING_MODES.desktop ? getDesktopRoamLayout() : null;
  const desktopSamplingPlan =
    roamMode === ROAMING_MODES.desktop
      ? planDesktopRoamSampling(roamPolicyState, {
          displayAreas: desktopRoamLayout?.displayAreas || [],
          nowMs,
        })
      : null;
  const roamBounds =
    options.roamBounds ||
    desktopRoamLayout?.bounds ||
    getRoamBounds(display, roamMode, roamZone, roamZoneRect);
  const baseSamplingAreas =
    Array.isArray(options.samplingAreas) && options.samplingAreas.length > 0
      ? options.samplingAreas
      : desktopSamplingPlan?.samplingAreas || desktopRoamLayout?.areas || [roamBounds];
  const petBounds = options.petBounds || getRoamPetBounds();
  let samplingAreas = baseSamplingAreas;
  let inspectDestination = null;

  if (roamMode === ROAMING_MODES.desktop) {
    const foregroundContext = resolveForegroundWindowCandidate({
      samplingAreas: baseSamplingAreas,
      nowMs,
    });
    if (foregroundContext.candidate) {
      const windowId = updateWindowInspectFocusTracking(foregroundContext.candidate.windowId, nowMs);
      const strictAvoidActive = isWindowAvoidActive(roamPolicyState, windowId, nowMs);
      const clippingPlan = planActiveWindowAvoidanceSampling({
        samplingAreas: baseSamplingAreas,
        activeWindowBounds: foregroundContext.candidate.bounds,
        avoidMarginPx: ACTIVE_WINDOW_AVOID_MARGIN_PX,
        petBounds,
        strictAvoidActive,
      });
      if (Array.isArray(clippingPlan.samplingAreas) && clippingPlan.samplingAreas.length > 0) {
        samplingAreas = clippingPlan.samplingAreas;
      }
      foregroundWindowRuntime.avoidMaskBounds = clippingPlan.avoidMaskBounds
        ? summarizeBounds(clippingPlan.avoidMaskBounds)
        : null;
      foregroundWindowRuntime.fallbackReason = clippingPlan.fallbackReason || "none";
      roamPolicyState.windowFallbackReason = clippingPlan.fallbackReason || "none";

      if (strictAvoidActive) {
        foregroundWindowRuntime.decisionReason =
          ROAM_POLICY_DECISION_REASONS.foregroundWindowAvoidanceActive;
        roamPolicyState.windowDecisionReason =
          ROAM_POLICY_DECISION_REASONS.foregroundWindowAvoidanceActive;
        markRoamPolicyDecision(
          roamPolicyState,
          ROAM_POLICY_DECISION_REASONS.foregroundWindowAvoidanceActive,
          nowMs
        );
        foregroundWindowRuntime.windowInspectState = "suppressed";
        foregroundWindowRuntime.windowInspectReason =
          ROAM_POLICY_DECISION_REASONS.windowAvoidCooldownActive;
        foregroundWindowRuntime.windowInspectAnchorLane = "none";
        foregroundWindowRuntime.windowInspectAnchorPoint = null;
      } else {
        foregroundWindowRuntime.decisionReason =
          ROAM_POLICY_DECISION_REASONS.foregroundWindowSoftInspectOnly;
        roamPolicyState.windowDecisionReason =
          ROAM_POLICY_DECISION_REASONS.foregroundWindowSoftInspectOnly;
        const inspectEligibility = canTriggerWindowInspect(windowId, nowMs);
        const currentPetPoint = getPetVisualCenterAtWindowPosition(winX, winY, petBounds);
        const anchorResult = resolveBottomEdgeInspectAnchor({
          windowBounds: foregroundContext.candidate.bounds,
          samplingAreas,
          petBounds,
          bottomBandPx: WINDOW_WATCH_BOTTOM_BAND_PX,
          bottomInsetPx: WINDOW_WATCH_BOTTOM_INSET_PX,
          bottomGracePx: WINDOW_WATCH_BOTTOM_GRACE_PX,
          currentPetPoint,
          randomUnit: Math.random(),
        });
        if (anchorResult?.anchor && inspectEligibility.allowed) {
          const destination = anchorResult.anchor.destination;
          const distance = Math.hypot(destination.x - winX, destination.y - winY);
          inspectDestination = {
            x: destination.x,
            y: destination.y,
            distance,
            bounds: roamBounds,
            petBounds,
            preferRun: false,
            inspectAnchor: {
              windowId,
              lane: anchorResult.anchor.lane,
              key: anchorResult.anchor.key,
              point: anchorResult.anchor.point,
              dwellMs: WINDOW_EDGE_INSPECT_DWELL_MS,
            },
          };
          foregroundWindowRuntime.windowInspectState = "pending";
          foregroundWindowRuntime.windowInspectReason =
            ROAM_POLICY_DECISION_REASONS.foregroundWindowInspectEdgePending;
          foregroundWindowRuntime.windowInspectAnchorLane = anchorResult.anchor.lane;
          foregroundWindowRuntime.windowInspectAnchorPoint = {
            x: Math.round(anchorResult.anchor.point.x),
            y: Math.round(anchorResult.anchor.point.y),
          };
          markRoamPolicyDecision(
            roamPolicyState,
            ROAM_POLICY_DECISION_REASONS.foregroundWindowInspectEdgePending,
            nowMs
          );
        } else if (anchorResult?.anchor) {
          foregroundWindowRuntime.windowInspectState = "idle";
          foregroundWindowRuntime.windowInspectReason =
            ROAM_POLICY_DECISION_REASONS.foregroundWindowSoftInspectOnly;
          foregroundWindowRuntime.windowInspectAnchorLane = "none";
          foregroundWindowRuntime.windowInspectAnchorPoint = null;
          markRoamPolicyDecision(
            roamPolicyState,
            ROAM_POLICY_DECISION_REASONS.foregroundWindowSoftInspectOnly,
            nowMs
          );
        } else {
          foregroundWindowRuntime.windowInspectState = "suppressed";
          foregroundWindowRuntime.windowInspectReason =
            ROAM_POLICY_DECISION_REASONS.foregroundWindowInspectAnchorUnavailable;
          foregroundWindowRuntime.windowInspectAnchorLane = "none";
          foregroundWindowRuntime.windowInspectAnchorPoint = null;
          markRoamPolicyDecision(
            roamPolicyState,
            ROAM_POLICY_DECISION_REASONS.foregroundWindowSoftInspectOnly,
            nowMs
          );
        }
      }
    } else {
      resetWindowInspectFocusTracking();
      foregroundWindowRuntime.avoidMaskBounds = null;
      foregroundWindowRuntime.fallbackReason = "none";
      foregroundWindowRuntime.decisionReason = foregroundContext.reason || "none";
      roamPolicyState.windowDecisionReason = foregroundContext.reason || "none";
      roamPolicyState.windowFallbackReason = "none";
      markRoamPolicyDecision(
        roamPolicyState,
        ROAM_POLICY_DECISION_REASONS.foregroundWindowNominal,
        nowMs
      );
      if (roamState.phase !== "inspect_dwell") {
        foregroundWindowRuntime.windowInspectState = "idle";
        foregroundWindowRuntime.windowInspectReason = "none";
        foregroundWindowRuntime.windowInspectAnchorLane = "none";
        foregroundWindowRuntime.windowInspectAnchorPoint = null;
      }
    }
  } else {
    updateForegroundWindowRuntimeDisabled(
      ROAM_POLICY_DECISION_REASONS.windowAvoidanceNotDesktopMode
    );
    foregroundWindowRuntime.avoidMaskBounds = null;
    foregroundWindowRuntime.fallbackReason = "none";
    roamPolicyState.windowFallbackReason = "none";
    roamPolicyState.windowDecisionReason =
      ROAM_POLICY_DECISION_REASONS.windowAvoidanceNotDesktopMode;
    if (roamState.phase !== "inspect_dwell") {
      foregroundWindowRuntime.windowInspectState = "idle";
      foregroundWindowRuntime.windowInspectReason = "none";
      foregroundWindowRuntime.windowInspectAnchorLane = "none";
      foregroundWindowRuntime.windowInspectAnchorPoint = null;
    }
  }

  if (inspectDestination) {
    return inspectDestination;
  }

  const minDistancePx = Number.isFinite(Number(options.minDistancePx))
    ? Math.max(0, Math.round(Number(options.minDistancePx)))
    : ROAM_TARGET_MIN_DISTANCE_PX;
  let bestCandidate = null;
  let bestNonReverseCandidate = null;
  let reverseFallbackCandidate = null;
  for (let attempt = 0; attempt < ROAM_TARGET_RETRY_COUNT; attempt += 1) {
    const samplingArea = pickRoamSamplingArea(samplingAreas) || roamBounds;
    const range = computeRoamWindowRange(samplingArea, petBounds);
    const candidate = {
      x: Math.round(randomBetween(range.minX, range.maxX)),
      y: Math.round(randomBetween(range.minY, range.maxY)),
    };
    const distance = Math.hypot(candidate.x - winX, candidate.y - winY);
    const candidateRecord = {
      ...candidate,
      distance,
      bounds: roamBounds,
      petBounds,
    };
    const reverseRejected = shouldAvoidImmediateReverseRoamDirection(candidate, {
      fromX: winX,
      fromY: winY,
      nowMs,
    });

    if (!reverseRejected && distance >= minDistancePx) {
      return candidateRecord;
    }
    if (reverseRejected && distance >= minDistancePx) {
      if (!reverseFallbackCandidate || distance > reverseFallbackCandidate.distance) {
        reverseFallbackCandidate = candidateRecord;
      }
    }
    if (!reverseRejected && (!bestNonReverseCandidate || distance > bestNonReverseCandidate.distance)) {
      bestNonReverseCandidate = candidateRecord;
    }
    if (!bestCandidate || distance > bestCandidate.distance) {
      bestCandidate = {
        ...candidateRecord,
      };
    }
  }
  if (bestNonReverseCandidate) {
    return bestNonReverseCandidate;
  }
  if (reverseFallbackCandidate) {
    return reverseFallbackCandidate;
  }
  return bestCandidate;
}

function buildRoamModeEntryDestination(snapshot = latestShellState) {
  if (!win || win.isDestroyed()) return null;
  if (snapshot?.roaming?.mode !== ROAMING_MODES.zone) return null;
  const display = getWindowDisplay(win, getPetWindowSize());
  const desktopBounds = getDesktopRoamLayout().bounds || getClampArea(display);
  const zoneBounds = getRoamBounds(
    display,
    ROAMING_MODES.zone,
    getRoamZoneLabel(snapshot),
    snapshot?.roaming?.zoneRect || null
  );
  const petBounds = getRoamPetBounds();
  const range = computeRoamWindowRange(zoneBounds, petBounds);
  const [winX, winY] = win.getPosition();
  if (isWindowPositionWithinRange(winX, winY, range)) {
    return null;
  }
  const targetX = Math.max(range.minX, Math.min(winX, range.maxX));
  const targetY = Math.max(range.minY, Math.min(winY, range.maxY));
  return {
    x: targetX,
    y: targetY,
    distance: Math.hypot(targetX - winX, targetY - winY),
    bounds: desktopBounds,
    petBounds,
    preferRun: true,
  };
}

function buildMediaWatchInspectDestination(payload = {}, nowMs = Date.now()) {
  if (!win || win.isDestroyed()) return null;
  if (!isForegroundWindowAvoidanceSupported()) return null;
  if (!isForegroundWindowAvoidanceDesktopMode()) return null;
  if (!latestShellState) return null;
  const roamMode = latestShellState.roaming?.mode || ROAMING_MODES.desktop;
  if (roamMode !== ROAMING_MODES.desktop) return null;

  const desktopRoamLayout = getDesktopRoamLayout();
  const desktopSamplingPlan = planDesktopRoamSampling(roamPolicyState, {
    displayAreas: desktopRoamLayout?.displayAreas || [],
    nowMs,
  });
  const display = getWindowDisplay(win, getPetWindowSize());
  const roamBounds =
    desktopRoamLayout?.bounds ||
    getRoamBounds(
      display,
      roamMode,
      getRoamZoneLabel(latestShellState),
      latestShellState.roaming?.zoneRect || null
    );
  const samplingAreas =
    desktopSamplingPlan?.samplingAreas || desktopRoamLayout?.areas || [roamBounds];
  const foregroundContext = resolveForegroundWindowCandidate({
    samplingAreas,
    nowMs,
  });
  if (!foregroundContext.candidate) return null;

  const [winX, winY] = win.getPosition();
  const petBounds = getRoamPetBounds(nowMs);
  const currentPetPoint = getPetVisualCenterAtWindowPosition(winX, winY, petBounds);
  const foregroundCenter = getForegroundWindowCenterPoint(foregroundContext.candidate.bounds);
  const foregroundDisplay = foregroundCenter
    ? screen.getDisplayNearestPoint(foregroundCenter)
    : getWindowDisplay(win, getPetWindowSize());
  const displayClampArea = normalizeBoundsRect(getClampArea(foregroundDisplay));
  const displayFullBounds = normalizeBoundsRect(foregroundDisplay?.bounds);
  const samplingPrioritySets = [];
  if (displayClampArea) {
    samplingPrioritySets.push({
      roamBounds: displayClampArea,
      samplingAreas: [displayClampArea],
    });
  }
  if (
    displayFullBounds &&
    (!displayClampArea ||
      displayFullBounds.x !== displayClampArea.x ||
      displayFullBounds.y !== displayClampArea.y ||
      displayFullBounds.width !== displayClampArea.width ||
      displayFullBounds.height !== displayClampArea.height)
  ) {
    samplingPrioritySets.push({
      roamBounds: displayFullBounds,
      samplingAreas: [displayFullBounds],
    });
  }
  if (Array.isArray(samplingAreas) && samplingAreas.length > 0) {
    samplingPrioritySets.push({
      roamBounds,
      samplingAreas,
    });
  }

  let selectedAnchorResult = null;
  let selectedRoamBounds = roamBounds;
  for (const samplingSet of samplingPrioritySets) {
    const anchorResult = resolveBottomEdgeInspectAnchor({
      windowBounds: foregroundContext.candidate.bounds,
      samplingAreas: samplingSet.samplingAreas,
      petBounds,
      bottomBandPx: WINDOW_WATCH_BOTTOM_BAND_PX,
      bottomInsetPx: WINDOW_WATCH_BOTTOM_INSET_PX,
      bottomGracePx: WINDOW_WATCH_BOTTOM_GRACE_PX,
      currentPetPoint,
      randomUnit: Math.random(),
      preferenceProfile: "corner_preferred_media_watch",
    });
    if (anchorResult?.anchor) {
      selectedAnchorResult = anchorResult;
      selectedRoamBounds = samplingSet.roamBounds;
      break;
    }
  }
  if (!selectedAnchorResult?.anchor) return null;

  const destination = selectedAnchorResult.anchor.destination;
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const artist = typeof payload.artist === "string" ? payload.artist.trim() : "";
  const sourceAppLabel =
    typeof payload.sourceAppLabel === "string" && payload.sourceAppLabel.trim().length > 0
      ? payload.sourceAppLabel.trim()
      : "media window";
  const titleLabel = title
    ? artist
      ? `${title} by ${artist}`
      : title
    : "active media";

  return {
    x: destination.x,
    y: destination.y,
    distance: Math.hypot(destination.x - winX, destination.y - winY),
    bounds: selectedRoamBounds,
    petBounds,
    preferRun: false,
    inspectAnchor: {
      windowId: foregroundContext.candidate.windowId || "unknown",
      lane: selectedAnchorResult.anchor.lane,
      key: selectedAnchorResult.anchor.key,
      point: selectedAnchorResult.anchor.point,
      dwellMs: MEDIA_WATCHMODE_DWELL_MS,
      decisionReason: ROAM_POLICY_DECISION_REASONS.foregroundWindowInspectBottomEdgeActive,
      stateReason: "media_playing_video_watch_mode",
      stateTrigger: "media",
      stateSource:
        typeof payload.provider === "string" && payload.provider.trim().length > 0
          ? payload.provider.trim()
          : "media",
      sourceAppLabel,
      titleLabel,
    },
  };
}

function routeMediaWatchModeToBottomEdge(payload = {}, nowMs = Date.now()) {
  if (!stateRuntime || !latestShellState || !win || win.isDestroyed()) return null;
  const destination = buildMediaWatchInspectDestination(payload, nowMs);
  if (!destination?.inspectAnchor) return null;

  if (destination.distance <= ROAM_ARRIVAL_THRESHOLD_PX) {
    roamState.inspectAnchor = {
      ...destination.inspectAnchor,
    };
    const activated = beginWindowInspectDwell(nowMs);
    return activated ? latestStateSnapshot : null;
  }

  const queued = queueRoamDestination(destination, "media_watch_anchor_pending");
  if (!queued) return null;
  roamState.nextDecisionAtMs = nowMs;
  return beginRoamLeg(nowMs);
}

function queueRoamDestination(destination, reason = "roam_queue") {
  if (!destination) return false;
  const nowMs = Date.now();
  const [winX, winY] = win && !win.isDestroyed() ? win.getPosition() : [0, 0];
  roamState.phase = "rest";
  roamState.destination = null;
  roamState.inspectAnchor = null;
  roamState.mediaWatchFocusMismatchSinceMs = 0;
  roamState.queuedDestination = {
    x: Math.round(destination.x),
    y: Math.round(destination.y),
    distance: Number.isFinite(Number(destination.distance))
      ? Math.max(0, Number(destination.distance))
      : null,
    bounds: destination.bounds ? summarizeBounds(destination.bounds) : null,
    petBounds: destination.petBounds ? summarizeBounds(destination.petBounds) : null,
    preferRun: destination.preferRun === true,
    inspectAnchor:
      destination.inspectAnchor && typeof destination.inspectAnchor === "object"
        ? {
            ...destination.inspectAnchor,
          }
        : null,
    reason,
  };
  roamState.roamBounds = null;
  roamState.petBounds = null;
  roamState.speedPxPerSec = 0;
  roamState.clip = roamState.queuedDestination.preferRun ? "Run" : "Walk";
  roamState.direction = null;
  roamState.x = winX;
  roamState.y = winY;
  roamState.legStartX = null;
  roamState.legStartY = null;
  roamState.lastStepMs = nowMs;
  roamState.nextDecisionAtMs = nowMs + ROAM_ZONE_ENTRY_DELAY_MS;
  roamState.foregroundRevisionAtLegStart = 0;
  return true;
}

function queueRoamModeEntryIfOutside(snapshot = latestShellState, reason = "roam_zone_entry") {
  return queueRoamDestination(buildRoamModeEntryDestination(snapshot), reason);
}

function cancelRoamMotion() {
  const nowMs = Date.now();
  const [winX, winY] = win && !win.isDestroyed() ? win.getPosition() : [0, 0];
  const shouldEmitStop = roamState.phase === "moving" && !dragging && !flingState.active;
  roamState.phase = "idle";
  roamState.destination = null;
  roamState.inspectAnchor = null;
  roamState.mediaWatchFocusMismatchSinceMs = 0;
  roamState.roamBounds = null;
  roamState.petBounds = null;
  roamState.speedPxPerSec = 0;
  roamState.clip = roamState.queuedDestination?.preferRun ? "Run" : "Walk";
  roamState.direction = null;
  roamState.x = winX;
  roamState.y = winY;
  roamState.legStartX = null;
  roamState.legStartY = null;
  roamState.lastStepMs = nowMs;
  roamState.nextDecisionAtMs = roamState.queuedDestination ? nowMs + ROAM_ZONE_ENTRY_DELAY_MS : 0;
  roamState.foregroundRevisionAtLegStart = 0;
  if (foregroundWindowRuntime.windowInspectState === "active" && roamState.phase !== "inspect_dwell") {
    foregroundWindowRuntime.windowInspectState = "idle";
    foregroundWindowRuntime.windowInspectReason = "none";
    foregroundWindowRuntime.windowInspectAnchorLane = "none";
    foregroundWindowRuntime.windowInspectAnchorPoint = null;
  }
  if (shouldEmitStop) {
    resetMotionSampleFromWindow();
    emitMotionState({
      velocityOverride: {
        vx: 0,
        vy: 0,
      },
    });
  }
}

function enterAmbientRestState(reason = "roam_rest", stateId = pickAmbientRestStateId()) {
  if (!stateRuntime || !latestShellState) return latestStateSnapshot;
  const currentState = latestStateSnapshot?.currentState || "Idle";
  if (!isAmbientStateId(currentState)) return latestStateSnapshot;
  // Allow Idle re-activation so Idle remains the dominant ambient state and can be reasserted.
  if (currentState === stateId && stateId !== "Idle") return latestStateSnapshot;
  const snapshot = stateRuntime.activateState(stateId, {
    source: "shell",
    reason,
    trigger: "roam",
    context: {
      roamMode: latestShellState.roaming?.mode || ROAMING_MODES.desktop,
      roamZone: getRoamZoneLabel(latestShellState),
    },
  });
  if (stateId === "Idle" && currentState !== "Idle") {
    idleStateDwellUntilMs = Date.now() + IDLE_STATE_MIN_DWELL_MS;
  }
  return snapshot;
}

function scheduleRoamDecision(
  reason = "roam_schedule",
  delayMs = null,
  force = false,
  pacingPhase = "rest"
) {
  const nowMs = Date.now();
  const [winX, winY] = win && !win.isDestroyed() ? win.getPosition() : [0, 0];
  if (!force && roamState.nextDecisionAtMs > nowMs && roamState.phase !== "moving") {
    return latestStateSnapshot;
  }
  const numericDelayMs = Number(delayMs);
  const hasExplicitDelay = Number.isFinite(numericDelayMs);
  const pacingDecision = hasExplicitDelay
    ? {
        phase: "rest",
        reason: ROAM_POLICY_DECISION_REASONS.pacingExternalDelay,
        delayMs: Math.max(0, Math.round(numericDelayMs)),
        minMs: Math.max(0, Math.round(numericDelayMs)),
        maxMs: Math.max(0, Math.round(numericDelayMs)),
      }
    : resolveRoamPacingDelay({
        phase: pacingPhase,
        randomUnit: Math.random(),
        windows: {
          initial: {
            minMs: ROAM_INITIAL_DELAY_MIN_MS,
            maxMs: ROAM_INITIAL_DELAY_MAX_MS,
          },
          rest: {
            minMs: ROAM_REST_MIN_MS,
            maxMs: ROAM_REST_MAX_MS,
          },
          retry: {
            minMs: ROAM_REST_MIN_MS,
            maxMs: ROAM_REST_MAX_MS,
          },
        },
      });
  applyRoamPacingDecision(roamPolicyState, pacingDecision, nowMs);

  roamState.phase = "rest";
  roamState.destination = null;
  roamState.inspectAnchor = null;
  roamState.mediaWatchFocusMismatchSinceMs = 0;
  roamState.queuedDestination = null;
  roamState.roamBounds = null;
  roamState.petBounds = null;
  roamState.speedPxPerSec = 0;
  roamState.clip = "Walk";
  roamState.direction = null;
  roamState.x = winX;
  roamState.y = winY;
  roamState.legStartX = null;
  roamState.legStartY = null;
  roamState.lastStepMs = nowMs;
  roamState.nextDecisionAtMs = nowMs + Math.max(0, Math.round(pacingDecision.delayMs));
  roamState.foregroundRevisionAtLegStart = 0;
  if (foregroundWindowRuntime.windowInspectState !== "active") {
    foregroundWindowRuntime.windowInspectState = "idle";
    foregroundWindowRuntime.windowInspectReason = "none";
    foregroundWindowRuntime.windowInspectAnchorLane = "none";
    foregroundWindowRuntime.windowInspectAnchorPoint = null;
  }
  if (latestStateSnapshot?.currentState === "Roam") {
    enterAmbientRestState(reason);
  }
  return latestStateSnapshot;
}

function scheduleInitialRoamDecision(reason = "roam_initial_schedule", force = false) {
  return scheduleRoamDecision(reason, null, force, "initial");
}

function beginRoamLeg(nowMs = Date.now()) {
  if (!stateRuntime || !latestShellState) return latestStateSnapshot;
  idleStateDwellUntilMs = 0;
  const [winX, winY] = win.getPosition();
  const queuedDestination = roamState.queuedDestination;
  const destination =
    queuedDestination ||
    chooseRoamDestination(nowMs, {
      petBounds: getRoamPetBounds(),
    });
  const isInspectDestination = Boolean(destination?.inspectAnchor);
  const legDistance =
    destination && Number.isFinite(Number(destination.x)) && Number.isFinite(Number(destination.y))
      ? Math.hypot(Number(destination.x) - winX, Number(destination.y) - winY)
      : 0;
  const minDistanceThreshold = isInspectDestination
    ? ROAM_ARRIVAL_THRESHOLD_PX
    : queuedDestination
      ? ROAM_ARRIVAL_THRESHOLD_PX
      : ROAM_TARGET_MIN_DISTANCE_PX;
  if (destination && isInspectDestination && legDistance < ROAM_ARRIVAL_THRESHOLD_PX) {
    roamState.inspectAnchor =
      destination.inspectAnchor && typeof destination.inspectAnchor === "object"
        ? {
            ...destination.inspectAnchor,
          }
        : null;
    roamState.mediaWatchFocusMismatchSinceMs = 0;
    beginWindowInspectDwell(nowMs);
    return latestStateSnapshot;
  }
  if (
    !destination ||
    legDistance < minDistanceThreshold
  ) {
    roamState.queuedDestination = null;
    roamState.inspectAnchor = null;
    roamState.mediaWatchFocusMismatchSinceMs = 0;
    markRoamPolicyDecision(roamPolicyState, ROAM_POLICY_DECISION_REASONS.roamLegRetry, nowMs);
    scheduleRoamDecision("roam_leg_retry", null, true, "retry");
    enterAmbientRestState("roam_leg_retry");
    return latestStateSnapshot;
  }
  const canRunDistance = legDistance >= ROAM_RUN_DISTANCE_THRESHOLD_PX;
  const shouldRun =
    !isInspectDestination &&
    canRunDistance &&
    (queuedDestination?.preferRun === true || Math.random() < 0.55);
  const roamBounds =
    destination.bounds ||
    getRoamBounds(
      getWindowDisplay(win, getPetWindowSize()),
      latestShellState?.roaming?.mode || ROAMING_MODES.desktop,
      getRoamZoneLabel(latestShellState),
      latestShellState?.roaming?.zoneRect || null
    );
  const petBounds = destination.petBounds || getRoamPetBounds();
  const direction = resolveRoamVisualDirection(
    destination.x - winX,
    destination.y - winY,
    roamState.direction || "Down"
  );
  roamState.phase = "moving";
  roamState.destination = {
    x: destination.x,
    y: destination.y,
  };
  roamState.inspectAnchor =
    destination.inspectAnchor && typeof destination.inspectAnchor === "object"
      ? {
          ...destination.inspectAnchor,
        }
      : null;
  roamState.mediaWatchFocusMismatchSinceMs = 0;
  roamState.queuedDestination = null;
  roamState.roamBounds = summarizeBounds(roamBounds);
  roamState.petBounds = summarizeBounds(petBounds);
  roamState.speedPxPerSec = shouldRun ? ROAM_RUN_SPEED_PX_PER_SEC : ROAM_WALK_SPEED_PX_PER_SEC;
  roamState.clip = shouldRun ? "Run" : "Walk";
  roamState.direction = direction;
  roamState.x = winX;
  roamState.y = winY;
  roamState.legStartX = winX;
  roamState.legStartY = winY;
  roamState.lastStepMs = nowMs;
  roamState.nextDecisionAtMs = 0;
  roamState.foregroundRevisionAtLegStart = foregroundWindowRuntime.foregroundWindowRevision;
  markRoamPolicyDecision(
    roamPolicyState,
    isInspectDestination
      ? ROAM_POLICY_DECISION_REASONS.foregroundWindowInspectEdgePending
      : ROAM_POLICY_DECISION_REASONS.roamLegStarted,
    nowMs
  );
  return stateRuntime.activateState("Roam", {
    source: "shell",
    reason: "roam_leg_start",
    trigger: "roam",
    context: {
      roamMode: latestShellState.roaming?.mode || ROAMING_MODES.desktop,
      roamZone: getRoamZoneLabel(latestShellState),
      roamDistance: Math.round(legDistance),
    },
    visualOverrides: {
      clip: roamState.clip,
      direction,
    },
  });
}

function beginWindowInspectDwell(nowMs = Date.now()) {
  if (!stateRuntime) return false;
  const inspectAnchor = roamState.inspectAnchor;
  if (!inspectAnchor) return false;
  const dwellMs = Number.isFinite(Number(inspectAnchor.dwellMs))
    ? Math.max(100, Math.round(Number(inspectAnchor.dwellMs)))
    : WINDOW_EDGE_INSPECT_DWELL_MS;
  const decisionReason =
    typeof inspectAnchor.decisionReason === "string" && inspectAnchor.decisionReason.trim().length > 0
      ? inspectAnchor.decisionReason.trim()
      : ROAM_POLICY_DECISION_REASONS.foregroundWindowInspectBottomEdgeActive;
  const stateReason =
    typeof inspectAnchor.stateReason === "string" && inspectAnchor.stateReason.trim().length > 0
      ? inspectAnchor.stateReason.trim()
      : "foreground_window_inspect_bottom_edge_active";
  const stateSource =
    typeof inspectAnchor.stateSource === "string" && inspectAnchor.stateSource.trim().length > 0
      ? inspectAnchor.stateSource.trim()
      : "shell";
  const stateTrigger =
    typeof inspectAnchor.stateTrigger === "string" && inspectAnchor.stateTrigger.trim().length > 0
      ? inspectAnchor.stateTrigger.trim()
      : "roam";
  roamState.phase = "inspect_dwell";
  roamState.destination = null;
  roamState.roamBounds = null;
  roamState.petBounds = null;
  roamState.speedPxPerSec = 0;
  roamState.clip = "Walk";
  roamState.direction = "Up";
  roamState.legStartX = null;
  roamState.legStartY = null;
  roamState.lastStepMs = nowMs;
  roamState.nextDecisionAtMs = nowMs + dwellMs;
  roamState.mediaWatchFocusMismatchSinceMs = 0;
  roamState.foregroundRevisionAtLegStart = foregroundWindowRuntime.foregroundWindowRevision;
  foregroundWindowRuntime.windowInspectState = "active";
  foregroundWindowRuntime.windowInspectReason = decisionReason;
  foregroundWindowRuntime.windowInspectAnchorLane = inspectAnchor.lane || "bottom_edge";
  foregroundWindowRuntime.windowInspectAnchorPoint =
    inspectAnchor.point && Number.isFinite(Number(inspectAnchor.point.x)) && Number.isFinite(Number(inspectAnchor.point.y))
      ? {
          x: Math.round(Number(inspectAnchor.point.x)),
          y: Math.round(Number(inspectAnchor.point.y)),
        }
      : null;
  foregroundWindowRuntime.windowInspectDwellMs = dwellMs;
  foregroundWindowRuntime.decisionReason = decisionReason;
  roamPolicyState.windowDecisionReason = decisionReason;
  markRoamPolicyDecision(
    roamPolicyState,
    decisionReason,
    nowMs
  );
  recordWindowInspectActivation(inspectAnchor.windowId, nowMs);
  stateRuntime.activateState("WatchMode", {
    source: stateSource,
    reason: stateReason,
    trigger: stateTrigger,
    durationMs: dwellMs,
    context: {
      roamMode: latestShellState?.roaming?.mode || ROAMING_MODES.desktop,
      windowId: inspectAnchor.windowId || "unknown",
      anchorKey: inspectAnchor.key || "bottom_center",
      ...(inspectAnchor.sourceAppLabel ? { sourceAppLabel: inspectAnchor.sourceAppLabel } : {}),
      ...(inspectAnchor.titleLabel ? { titleLabel: inspectAnchor.titleLabel } : {}),
    },
    visualOverrides: {
      clip: "IdleReady",
      direction: "Up",
    },
  });
  emitMotionState({
    velocityOverride: {
      vx: 0,
      vy: 0,
    },
    collided: {
      x: false,
      y: false,
    },
    impact: {
      triggered: false,
      strength: 0,
    },
  });
  return true;
}

function normalizeWindowIdForComparison(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : "";
}

function isMediaWatchInspectAnchor(inspectAnchor = roamState.inspectAnchor) {
  if (!inspectAnchor || typeof inspectAnchor !== "object") return false;
  return normalizeLowerText(inspectAnchor.stateReason || "") === "media_playing_video_watch_mode";
}

function isFocusedWindowMatchingInspectAnchor(inspectAnchor = roamState.inspectAnchor) {
  const anchorWindowId = normalizeWindowIdForComparison(inspectAnchor?.windowId);
  if (!anchorWindowId) return false;
  const focusedWindowId = normalizeWindowIdForComparison(
    foregroundWindowRuntime.foregroundWindowWindowId || latestForegroundWindowSnapshot?.windowId
  );
  if (!focusedWindowId) return false;
  return focusedWindowId === anchorWindowId;
}

function shouldHoldMediaWatchInspectByFocus(inspectAnchor = roamState.inspectAnchor) {
  if (!isMediaWatchInspectAnchor(inspectAnchor)) return false;
  if (!isFocusedWindowMatchingInspectAnchor(inspectAnchor)) return false;
  return true;
}

function extendMediaWatchInspectDwell(nowMs = Date.now()) {
  if (!stateRuntime) return false;
  const inspectAnchor = roamState.inspectAnchor;
  if (!shouldHoldMediaWatchInspectByFocus(inspectAnchor)) return false;
  const extensionMs = Math.max(1000, Math.round(MEDIA_WATCHMODE_FOCUS_HOLD_EXTENSION_MS));
  roamState.nextDecisionAtMs = nowMs + extensionMs;
  roamState.mediaWatchFocusMismatchSinceMs = 0;
  foregroundWindowRuntime.windowInspectState = "active";
  foregroundWindowRuntime.windowInspectReason =
    ROAM_POLICY_DECISION_REASONS.foregroundWindowInspectBottomEdgeActive;
  foregroundWindowRuntime.windowInspectDwellMs = extensionMs;
  if (
    latestStateSnapshot?.currentState !== "WatchMode" ||
    latestStateSnapshot?.reason !== "media_playing_video_watch_mode"
  ) {
    stateRuntime.activateState("WatchMode", {
      source: typeof inspectAnchor.stateSource === "string" ? inspectAnchor.stateSource : "media",
      reason: "media_playing_video_watch_mode",
      trigger: "media",
      durationMs: extensionMs,
      context: {
        roamMode: latestShellState?.roaming?.mode || ROAMING_MODES.desktop,
        windowId: inspectAnchor.windowId || "unknown",
        anchorKey: inspectAnchor.key || "bottom_center",
        ...(inspectAnchor.sourceAppLabel ? { sourceAppLabel: inspectAnchor.sourceAppLabel } : {}),
        ...(inspectAnchor.titleLabel ? { titleLabel: inspectAnchor.titleLabel } : {}),
      },
      visualOverrides: {
        clip: "IdleReady",
        direction: "Up",
      },
    });
  }
  return true;
}

function finishWindowInspectDwell(reason = "foreground_window_inspect_complete") {
  foregroundWindowRuntime.windowInspectState = "idle";
  foregroundWindowRuntime.windowInspectReason =
    ROAM_POLICY_DECISION_REASONS.foregroundWindowSoftInspectOnly;
  foregroundWindowRuntime.windowInspectAnchorLane = "none";
  foregroundWindowRuntime.windowInspectAnchorPoint = null;
  roamState.inspectAnchor = null;
  roamState.mediaWatchFocusMismatchSinceMs = 0;
  scheduleRoamDecision(reason, null, true, "rest");
  enterAmbientRestState(reason);
}

function finishRoamLeg(reason = "roam_leg_complete", nowMs = Date.now()) {
  if (roamState.phase === "moving" && roamState.destination) {
    const startX = Number.isFinite(Number(roamState.legStartX)) ? Number(roamState.legStartX) : Number(roamState.x);
    const startY = Number.isFinite(Number(roamState.legStartY)) ? Number(roamState.legStartY) : Number(roamState.y);
    const dx = Number(roamState.destination.x) - startX;
    const dy = Number(roamState.destination.y) - startY;
    const distance = Math.hypot(dx, dy);
    if (distance >= ROAM_DIRECTION_REVERSAL_MIN_DISTANCE_PX) {
      roamState.lastLegVector = {
        x: dx,
        y: dy,
        distance,
      };
      roamState.lastLegCompletedAtMs = nowMs;
    }
  }
  const queuedDestination = roamState.queuedDestination ? { ...roamState.queuedDestination } : null;
  const [winX, winY] = win && !win.isDestroyed() ? win.getPosition() : [0, 0];
  scheduleRoamDecision(reason, null, true, "rest");
  if (queuedDestination) {
    roamState.queuedDestination = queuedDestination;
    roamState.clip = queuedDestination.preferRun ? "Run" : "Walk";
    roamState.nextDecisionAtMs = nowMs + ROAM_ZONE_ENTRY_DELAY_MS;
  }
  enterAmbientRestState(reason);
  roamState.x = winX;
  roamState.y = winY;
  roamState.legStartX = null;
  roamState.legStartY = null;
  roamState.lastStepMs = nowMs;
  resetMotionSampleFromWindow();
  emitMotionState({
    velocityOverride: {
      vx: 0,
      vy: 0,
    },
  });
}

function shouldRoamAutonomously() {
  if (!win || win.isDestroyed()) return false;
  if (dragging || flingState.active) return false;
  if (isConversationHoldActive()) return false;
  if (
    roamState.phase !== "inspect_dwell" &&
    latestStateSnapshot?.currentState === "WatchMode" &&
    latestStateSnapshot?.reason === "media_playing_video_watch_mode"
  ) {
    return false;
  }
  return isAmbientStateId(latestStateSnapshot?.currentState || "Idle");
}

function stepRoam() {
  if (isConversationHoldActive()) {
    cancelRoamMotion();
    if (latestStateSnapshot?.currentState === "Roam") {
      enterAmbientRestState("dialog_surface_open_hold", getPreferredRoamStateId(latestShellState));
    }
    return;
  }

  if (!shouldRoamAutonomously()) {
    cancelRoamMotion();
    return;
  }

  const nowMs = Date.now();
  if (
    isForegroundWindowAvoidanceSupported() &&
    isForegroundWindowAvoidanceDesktopMode() &&
    nowMs - lastForegroundWindowPollRequestAtMs >= FOREGROUND_WINDOW_POLL_MS
  ) {
    requestForegroundWindowPoll("roam_tick");
  }
  if (roamState.phase === "inspect_dwell") {
    if (isMediaWatchInspectAnchor(roamState.inspectAnchor)) {
      if (shouldHoldMediaWatchInspectByFocus(roamState.inspectAnchor)) {
        roamState.mediaWatchFocusMismatchSinceMs = 0;
      } else if (roamState.mediaWatchFocusMismatchSinceMs <= 0) {
        roamState.mediaWatchFocusMismatchSinceMs = nowMs;
      } else if (nowMs - roamState.mediaWatchFocusMismatchSinceMs >= MEDIA_WATCHMODE_FOCUS_LOSS_GRACE_MS) {
        finishWindowInspectDwell("media_watch_focus_released");
        return;
      }
    }
    if (nowMs >= roamState.nextDecisionAtMs) {
      if (extendMediaWatchInspectDwell(nowMs)) {
        return;
      }
      finishWindowInspectDwell("foreground_window_inspect_complete");
    }
    return;
  }
  if (roamState.phase !== "moving") {
    if (roamState.nextDecisionAtMs <= 0) {
      if (roamState.queuedDestination) {
        roamState.nextDecisionAtMs = nowMs + ROAM_ZONE_ENTRY_DELAY_MS;
      } else {
        scheduleInitialRoamDecision("roam_controller_start");
      }
      return;
    }
    if (nowMs >= roamState.nextDecisionAtMs) {
      if (
        !roamState.queuedDestination &&
        latestStateSnapshot?.currentState === "Idle" &&
        idleStateDwellUntilMs > nowMs
      ) {
        roamState.phase = "rest";
        roamState.nextDecisionAtMs = idleStateDwellUntilMs;
        return;
      }
      beginRoamLeg(nowMs);
    }
    return;
  }

  if (!roamState.destination) {
    finishRoamLeg("roam_missing_destination", nowMs);
    return;
  }
  if (
    roamState.foregroundRevisionAtLegStart > 0 &&
    foregroundWindowRuntime.foregroundWindowRevision > roamState.foregroundRevisionAtLegStart
  ) {
    finishRoamLeg("foreground_window_bounds_updated", nowMs);
    return;
  }

  const dtSec = Math.max(0.001, Math.min(0.05, (nowMs - roamState.lastStepMs) / 1000));
  roamState.lastStepMs = nowMs;
  if (!Number.isFinite(roamState.x) || !Number.isFinite(roamState.y)) {
    const [winX, winY] = win.getPosition();
    roamState.x = winX;
    roamState.y = winY;
  }

  const dx = roamState.destination.x - roamState.x;
  const dy = roamState.destination.y - roamState.y;
  const remainingDistance = Math.hypot(dx, dy);
  if (remainingDistance <= ROAM_ARRIVAL_THRESHOLD_PX) {
    applyWindowBounds(roamState.destination.x, roamState.destination.y);
    roamState.x = roamState.destination.x;
    roamState.y = roamState.destination.y;
    if (roamState.inspectAnchor && beginWindowInspectDwell(nowMs)) {
      return;
    }
    finishRoamLeg("roam_arrived", nowMs);
    return;
  }

  const roamBounds =
    roamState.roamBounds ||
    getRoamBounds(
      getWindowDisplay(win, getPetWindowSize()),
      latestShellState?.roaming?.mode || ROAMING_MODES.desktop,
      getRoamZoneLabel(latestShellState),
      latestShellState?.roaming?.zoneRect || null
    );
  const petBounds = roamState.petBounds || getRoamPetBounds();
  const stepDistance = Math.min(roamState.speedPxPerSec * dtSec, remainingDistance);
  const moveX = (dx / remainingDistance) * stepDistance;
  const moveY = (dy / remainingDistance) * stepDistance;
  const velocityScale = remainingDistance > 0 ? roamState.speedPxPerSec / remainingDistance : 0;
  const velocityOverride = {
    vx: dx * velocityScale,
    vy: dy * velocityScale,
  };
  // Keep subpixel roam position so slow walk speeds do not stall on integer window coordinates.
  const targetX = roamState.x + moveX;
  const targetY = roamState.y + moveY;
  const clamped = clampWindowPosition(targetX, targetY, roamBounds, petBounds);
  const collidedX = Math.abs(targetX - clamped.x) > 0.001;
  const collidedY = Math.abs(targetY - clamped.y) > 0.001;

  applyWindowBounds(clamped.x, clamped.y);
  roamState.x = clamped.x;
  roamState.y = clamped.y;
  emitMotionState({
    velocityOverride,
    collided: {
      x: collidedX,
      y: collidedY,
    },
    impact: {
      triggered: false,
      strength: 0,
    },
  });
  if (collidedX || collidedY) {
    finishRoamLeg("roam_bounds_clamped", nowMs);
    return;
  }
  if (remainingDistance - stepDistance <= ROAM_ARRIVAL_THRESHOLD_PX) {
    applyWindowBounds(roamState.destination.x, roamState.destination.y);
    roamState.x = roamState.destination.x;
    roamState.y = roamState.destination.y;
    if (roamState.inspectAnchor && beginWindowInspectDwell(nowMs)) {
      return;
    }
    finishRoamLeg("roam_arrived", nowMs);
  }
}

function startRoamController() {
  if (roamTimer) {
    clearInterval(roamTimer);
  }
  roamTimer = setInterval(stepRoam, ROAM_STEP_INTERVAL_MS);
}

function getDefaultPropWindowPosition(propId) {
  const spec = getPropWindowSpec(propId);
  if (!spec) return { x: 0, y: 0 };

  if (win && !win.isDestroyed()) {
    const petWindowSize = getPetWindowSize();
    const [petX, petY] = win.getPosition();
    const proposedX = petX - Math.round(spec.windowSize.width * 0.72);
    const proposedY = petY + petWindowSize.height - spec.windowSize.height - 28;
    const display = getWindowDisplay(win, petWindowSize);
    return clampWindowPosition(
      proposedX,
      proposedY,
      getClampArea(display),
      spec.visualBounds
    );
  }

  const display = screen.getPrimaryDisplay();
  const area = getClampArea(display);
  return clampWindowPosition(
    area.x + Math.round(area.width * 0.2),
    area.y + Math.round(area.height * 0.72),
    area,
    spec.visualBounds
  );
}

function syncPropWindowScale(reason = "settings_update") {
  for (const [propId, record] of propWindows.entries()) {
    if (!record || !record.window || record.window.isDestroyed()) continue;
    const previousWindowSize = record.spec?.windowSize || null;
    const nextSpec = getPropWindowSpec(propId);
    if (!nextSpec) continue;

    const center = getWindowCenterPoint(record.window, previousWindowSize);
    record.spec = nextSpec;
    record.window.setMinimumSize(nextSpec.windowSize.width, nextSpec.windowSize.height);
    record.window.setMaximumSize(nextSpec.windowSize.width, nextSpec.windowSize.height);
    applyPropWindowBounds(
      propId,
      Math.round(center.x - nextSpec.windowSize.width * 0.5),
      Math.round(center.y - nextSpec.windowSize.height * 0.5)
    );
    emitToWindow(record.window, "prop:model", buildPropWindowModel(propId));
  }

  logDiagnostics("prop-scale-updated", {
    reason,
    scale: getPetLayout()?.scale || 1,
    activeWindows: propWindows.size,
  });
}

function applyPropWindowBounds(propId, targetX, targetY) {
  const record = propWindows.get(propId);
  if (!record || !record.window || record.window.isDestroyed()) return null;
  const display = screen.getDisplayNearestPoint({
    x: Math.round(targetX + record.spec.windowSize.width * 0.5),
    y: Math.round(targetY + record.spec.windowSize.height * 0.5),
  });
  const clamped = clampWindowPosition(
    targetX,
    targetY,
    getClampArea(display),
    record.spec.visualBounds
  );
  applyFixedContentBounds(record.window, record.spec.windowSize, clamped.x, clamped.y);
  return clamped;
}

function positionPropWindowAtCursor(propId) {
  const record = propWindows.get(propId);
  if (!record) return null;
  const cursor = screen.getCursorScreenPoint();
  return applyPropWindowBounds(
    propId,
    cursor.x - Math.round(record.spec.windowSize.width * 0.5),
    cursor.y - Math.round(record.spec.windowSize.height * 0.5)
  );
}

function refreshPropWorldCapabilityState() {
  updateCapabilityState(
    CAPABILITY_IDS.propWorld,
    CAPABILITY_STATES.healthy,
    "separateWindowPropWorldReady",
    {
      mode: "separateWindowProps",
      activeQuickProps: [...(latestShellState?.inventory?.quickProps || [])],
      activeWindowCount: propWindows.size,
    }
  );
}

function createPropWindow(propId, initialPosition = null) {
  const existing = propWindows.get(propId);
  if (existing && existing.window && !existing.window.isDestroyed()) {
    if (initialPosition) {
      applyPropWindowBounds(propId, initialPosition.x, initialPosition.y);
    }
    return existing;
  }

  const spec = getPropWindowSpec(propId);
  if (!spec) return null;

  const propWindow = new BrowserWindow({
    width: spec.windowSize.width,
    height: spec.windowSize.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "prop-window-preload.js"),
    },
  });

  propWindow.setMinimumSize(spec.windowSize.width, spec.windowSize.height);
  propWindow.setMaximumSize(spec.windowSize.width, spec.windowSize.height);

  const record = {
    propId,
    spec,
    window: propWindow,
    dragging: false,
    dragOffset: { x: 0, y: 0 },
    placing: false,
    createdForPlacement: false,
  };
  propWindows.set(propId, record);

  propWindow.on("closed", () => {
    propWindows.delete(propId);
    if (appIsQuitting) return;
    refreshPropWorldCapabilityState();
  });

  propWindow.loadFile("prop-window.html");
  propWindow.webContents.once("did-finish-load", () => {
    emitToWindow(propWindow, "prop:model", buildPropWindowModel(propId));
    const position = initialPosition || getDefaultPropWindowPosition(propId);
    applyPropWindowBounds(propId, position.x, position.y);
    propWindow.show();
  });

  refreshPropWorldCapabilityState();
  return record;
}

function destroyPropWindow(propId) {
  const record = propWindows.get(propId);
  if (!record) return;
  propWindows.delete(propId);
  if (record.window && !record.window.isDestroyed()) {
    record.window.destroy();
  }
  refreshPropWorldCapabilityState();
}

function syncShellQuickPropWindows() {
  const activeQuickProps = new Set(latestShellState?.inventory?.quickProps || []);
  for (const propId of Object.keys(PROP_WINDOW_SPECS)) {
    if (activeQuickProps.has(propId)) {
      createPropWindow(propId);
      continue;
    }
    destroyPropWindow(propId);
  }
  refreshPropWorldCapabilityState();
}

function removeQuickPropFromDesktop(propId, reason = "shell_remove_quick_prop") {
  const snapshot = latestShellState || buildShellStateSnapshot();
  const nextQuickProps = (snapshot.inventory?.quickProps || []).filter((entry) => entry !== propId);
  if (nextQuickProps.length === (snapshot.inventory?.quickProps || []).length) {
    return {
      ok: true,
      shellState: snapshot,
    };
  }
  const nextSnapshot = applyRuntimeSettingsPatch(
    {
      inventory: {
        quickProps: nextQuickProps,
      },
    },
    reason
  );
  return {
    ok: true,
    shellState: latestShellState || nextSnapshot,
  };
}

function beginPropPlacement(propId) {
  const spec = getPropWindowSpec(propId);
  if (!spec) {
    return {
      ok: false,
      error: "unknown_prop_id",
    };
  }

  let snapshot = latestShellState || buildShellStateSnapshot();
  let createdForPlacement = false;
  if (!snapshot.inventory?.quickProps?.includes(propId)) {
    snapshot = applyRuntimeSettingsPatch(
      {
        inventory: {
          quickProps: toggleMembership(snapshot.inventory?.quickProps, propId),
        },
      },
      `shell_place_${propId}`
    );
    createdForPlacement = true;
  }

  const record = createPropWindow(propId);
  if (!record) {
    return {
      ok: false,
      error: "prop_window_unavailable",
    };
  }

  record.placing = true;
  record.createdForPlacement = createdForPlacement;
  if (!record.window.isDestroyed()) {
    record.window.setIgnoreMouseEvents(true);
  }
  positionPropWindowAtCursor(propId);
  return {
    ok: true,
    shellState: latestShellState || snapshot,
  };
}

function updatePropPlacement(propId) {
  const record = propWindows.get(propId);
  if (!record || !record.placing) {
    return {
      ok: false,
      error: "placement_not_active",
    };
  }
  positionPropWindowAtCursor(propId);
  return {
    ok: true,
  };
}

function endPropPlacement(propId, commit = true) {
  const record = propWindows.get(propId);
  if (!record) {
    return {
      ok: false,
      error: "prop_window_unavailable",
    };
  }

  const shouldRemove = !commit && record.createdForPlacement;
  record.placing = false;
  record.createdForPlacement = false;
  if (!record.window.isDestroyed()) {
    record.window.setIgnoreMouseEvents(false);
  }

  if (shouldRemove) {
    removeQuickPropFromDesktop(propId, `shell_cancel_place_${propId}`);
    destroyPropWindow(propId);
  }

  return {
    ok: true,
    shellState: latestShellState || buildShellStateSnapshot(),
  };
}

function beginPropWindowDrag(propId) {
  const record = propWindows.get(propId);
  if (!record || !record.window || record.window.isDestroyed()) {
    return {
      ok: false,
      error: "prop_window_unavailable",
    };
  }
  if (record.placing) {
    return {
      ok: false,
      error: "prop_window_placing",
    };
  }

  const cursor = screen.getCursorScreenPoint();
  const [x, y] = record.window.getPosition();
  record.dragging = true;
  record.dragOffset = {
    x: cursor.x - x,
    y: cursor.y - y,
  };
  return {
    ok: true,
  };
}

function dragPropWindow(propId) {
  const record = propWindows.get(propId);
  if (!record || !record.window || record.window.isDestroyed()) {
    return {
      ok: false,
      error: "prop_window_unavailable",
    };
  }
  if (!record.dragging) {
    return {
      ok: false,
      error: "prop_window_not_dragging",
    };
  }

  const cursor = screen.getCursorScreenPoint();
  const clamped = applyPropWindowBounds(
    propId,
    cursor.x - record.dragOffset.x,
    cursor.y - record.dragOffset.y
  );
  return {
    ok: true,
    position: clamped,
  };
}

function endPropWindowDrag(propId) {
  const record = propWindows.get(propId);
  if (!record) {
    return {
      ok: false,
      error: "prop_window_unavailable",
    };
  }
  record.dragging = false;
  return {
    ok: true,
  };
}

function createInventoryWindow() {
  if (inventoryWin && !inventoryWin.isDestroyed()) return inventoryWin;

  const position = getDefaultInventoryWindowPosition();

  inventoryWin = new BrowserWindow({
    x: position.x,
    y: position.y,
    width: INVENTORY_WINDOW_SIZE.width,
    height: INVENTORY_WINDOW_SIZE.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "inventory-preload.js"),
    },
  });
  inventoryWin.setMinimumSize(INVENTORY_WINDOW_MIN_SIZE.width, INVENTORY_WINDOW_MIN_SIZE.height);

  inventoryWin.on("closed", () => {
    inventoryWin = null;
    if (appIsQuitting) return;
    emitShellState(buildShellStateSnapshot());
  });

  inventoryWin.loadFile("inventory.html");
  inventoryWin.webContents.once("did-finish-load", () => {
    emitShellState(buildShellStateSnapshot());
    inventoryWin.show();
    inventoryWin.focus();
  });

  return inventoryWin;
}

function openInventoryWindow(targetTab = SHELL_WINDOW_TABS.inventory) {
  setInventoryWindowActiveTab(targetTab, false);
  const targetWindow = createInventoryWindow();
  if (!targetWindow) return null;
  if (!targetWindow.isVisible()) {
    targetWindow.show();
  }
  targetWindow.focus();
  emitShellState(buildShellStateSnapshot());
  return targetWindow;
}

function openStatusWindow() {
  return openInventoryWindow(SHELL_WINDOW_TABS.status);
}

function openSetupWindow() {
  return openInventoryWindow(SHELL_WINDOW_TABS.setup);
}

function openSettingsWindow() {
  return openInventoryWindow(SHELL_WINDOW_TABS.settings);
}

function closeZoneSelectorWindow() {
  if (!zoneSelectorWin || zoneSelectorWin.isDestroyed()) {
    zoneSelectorWin = null;
    return;
  }
  zoneSelectorWin.close();
}

function getZoneSelectorDisplay() {
  if (win && !win.isDestroyed()) {
    return getWindowDisplay(win, getPetWindowSize());
  }
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}

function buildZoneSelectorModel(display = getZoneSelectorDisplay()) {
  const area = getClampArea(display);
  const existingRect = normalizeRoamZoneRect(latestShellState?.roaming?.zoneRect);
  return {
    displayId: display.id,
    area: summarizeBounds(area),
    existingRect,
  };
}

function createZoneSelectorWindow() {
  if (zoneSelectorWin && !zoneSelectorWin.isDestroyed()) {
    zoneSelectorWin.destroy();
    zoneSelectorWin = null;
  }

  const display = getZoneSelectorDisplay();
  const area = getClampArea(display);
  zoneSelectorWin = new BrowserWindow({
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "zone-selector-preload.js"),
    },
  });

  zoneSelectorWin.on("closed", () => {
    zoneSelectorWin = null;
  });

  zoneSelectorWin.loadFile("zone-selector.html");
  zoneSelectorWin.webContents.once("did-finish-load", () => {
    emitToWindow(zoneSelectorWin, "zone-selector:model", buildZoneSelectorModel(display));
    zoneSelectorWin.show();
    zoneSelectorWin.focus();
  });

  return zoneSelectorWin;
}

function openZoneSelectorWindow() {
  const targetWindow = createZoneSelectorWindow();
  if (!targetWindow) return null;
  if (!targetWindow.isVisible()) {
    targetWindow.show();
  }
  targetWindow.focus();
  return targetWindow;
}

function commitRoamZoneSelection(rawRect) {
  const rect = normalizeRoamZoneRect(rawRect);
  if (!rect) {
    return {
      ok: false,
      error: "invalid_zone_rect",
    };
  }
  const snapshot = applyRuntimeSettingsPatch(
    {
      roaming: {
        mode: ROAMING_MODES.zone,
        zone: "custom",
        zoneRect: rect,
      },
    },
    "shell_commit_roam_zone"
  );
  queueRoamModeEntryIfOutside(snapshot, "shell_commit_roam_zone");
  syncShellRoamingState("shell_commit_roam_zone", true);
  closeZoneSelectorWindow();
  return {
    ok: true,
    shellState: latestShellState || snapshot,
  };
}

function getPreferredRoamStateId(snapshot = latestShellState) {
  return snapshot?.roaming?.mode === ROAMING_MODES.zone ? "WatchMode" : "Idle";
}

function syncShellRoamingState(reason = "shell_roam_sync", force = false) {
  if (!stateRuntime || !latestShellState) return null;
  const currentState = latestStateSnapshot?.currentState || "Idle";
  if (!isAmbientStateId(currentState)) {
    return latestStateSnapshot;
  }
  const targetStateId = getPreferredRoamStateId(latestShellState);
  if (force) {
    cancelRoamMotion();
    roamState.queuedDestination = null;
    if (
      latestShellState.roaming?.mode === ROAMING_MODES.zone &&
      !queueRoamModeEntryIfOutside(latestShellState, reason)
    ) {
      scheduleInitialRoamDecision(reason, true);
    } else if (latestShellState.roaming?.mode !== ROAMING_MODES.zone) {
      scheduleInitialRoamDecision(reason, true);
    }
    if (currentState === "Roam") {
      return enterAmbientRestState(reason, targetStateId);
    }
    if (currentState !== targetStateId) {
      return enterAmbientRestState(reason, targetStateId);
    }
    return latestStateSnapshot;
  }
  if (roamState.phase === "moving") {
    return latestStateSnapshot;
  }
  if (roamState.queuedDestination) {
    roamState.phase = "rest";
    roamState.nextDecisionAtMs = Math.max(
      Date.now() + ROAM_ZONE_ENTRY_DELAY_MS,
      roamState.nextDecisionAtMs || 0
    );
  } else {
    scheduleInitialRoamDecision(
      reason,
      force || currentState === "Roam" || roamState.nextDecisionAtMs <= 0
    );
  }
  if (currentState === "Roam") {
    return enterAmbientRestState(reason, targetStateId);
  }
  if (currentState !== targetStateId) {
    return enterAmbientRestState(reason, targetStateId);
  }
  return latestStateSnapshot;
}

function updateProactiveConversationStateFromResult(result, nowMs = Date.now()) {
  let promptOpenerHash = "none";
  if (result && typeof result === "object" && result._proactivePrompt) {
    promptOpenerHash =
      typeof result._proactivePrompt.openerHash === "string" &&
      result._proactivePrompt.openerHash.trim().length > 0
        ? result._proactivePrompt.openerHash.trim()
        : "none";
  }

  proactiveConversationState.lastCheckedAtMs = nowMs;
  const suggestion = Array.isArray(result?.suggestions)
    ? result.suggestions.find(
        (entry) => entry?.type === "PET_ANNOUNCEMENT" || entry?.type === "PET_ANNOUNCEMENT_SKIPPED"
      ) || null
    : null;

  if (!suggestion) {
    recordProactiveSuppression(proactiveConversationState, {
      reason: "suppressed_router_no_suggestion",
      nowMs,
      cooldownRemainingMs: 0,
    });
    refreshProactivePolicySnapshot(nowMs);
    return;
  }

  if (suggestion.type === "PET_ANNOUNCEMENT") {
    recordProactiveAnnouncement(proactiveConversationState, {
      nowMs,
      openerHash: promptOpenerHash,
    });
    refreshProactivePolicySnapshot(nowMs);
    return;
  }

  const skipReason =
    typeof suggestion.skipReason === "string" && suggestion.skipReason.trim().length > 0
      ? suggestion.skipReason.trim()
      : "unknown";
  const remainingMs = Number.isFinite(Number(suggestion.cooldownRemainingMs))
    ? Math.max(0, Math.round(Number(suggestion.cooldownRemainingMs)))
    : getProactiveCooldownRemainingMs(nowMs);
  recordProactiveSuppression(proactiveConversationState, {
    reason: skipReason,
    nowMs,
    cooldownRemainingMs: remainingMs,
  });
  refreshProactivePolicySnapshot(nowMs);
}

function recordProactiveEngagement(reason = "user_input", nowMs = Date.now()) {
  recordProactiveUserEngagement(proactiveConversationState, nowMs);
  proactiveConversationState.lastAttemptReason = reason;
  proactiveConversationState.lastSuppressedReason = "none";
  proactiveConversationState.lastSuppressedAtMs = 0;
  proactiveConversationState.nextCheckAtMs = Math.min(
    proactiveConversationState.nextCheckAtMs || nowMs,
    nowMs + 1200
  );
  refreshProactivePolicySnapshot(nowMs);
}

function setDialogSurfaceOpen(open, reason = "renderer") {
  const nowMs = Date.now();
  const nextOpen = Boolean(open);
  if (dialogPresence.surfaceOpen === nextOpen) {
    return latestShellState || buildShellStateSnapshot();
  }
  dialogPresence.surfaceOpen = nextOpen;
  dialogPresence.updatedAtMs = nowMs;

  if (nextOpen) {
    cancelRoamMotion();
    if (latestStateSnapshot?.currentState === "Roam") {
      enterAmbientRestState("dialog_surface_open_hold", getPreferredRoamStateId(latestShellState));
    }
  } else if (proactiveConversationState.lastSuppressedReason === "suppressed_dialog_open") {
    proactiveConversationState.nextCheckAtMs = Math.min(
      proactiveConversationState.nextCheckAtMs || nowMs,
      nowMs + 800
    );
  }

  refreshProactivePolicySnapshot(nowMs);

  if (DIAGNOSTICS_ENABLED) {
    logDiagnostics("dialog-surface-open", {
      open: nextOpen,
      reason,
    });
  }
  return emitShellState(buildShellStateSnapshot());
}

async function runProactiveConversationCheck(trigger = "interval") {
  const nowMs = Date.now();
  if (!contractRouter || nowMs < proactiveConversationState.nextCheckAtMs) return null;
  applyIgnoredBackoffIfNeeded(proactiveConversationState, nowMs);
  const proactivePrompt = buildProactiveConversationPrompt(nowMs);
  const suppression = evaluateProactiveSuppression({
    state: proactiveConversationState,
    nowMs,
    dialogOpen: isDialogSurfaceOpen(),
    inputActive: isDialogInputActive(),
    stateEligible: isAmbientStateId(latestStateSnapshot?.currentState || "Idle"),
    quietHoursActive: isProactiveQuietHoursActive(),
    candidateOpenerHash: proactivePrompt.openerHash,
  });
  const dynamicCooldownMs = getProactiveCooldownMsForTier(proactiveConversationState.backoffTier || 0);
  const context = {
    source: deriveContractSource(),
    statusText: buildStatusText(),
    announcementSuppressedReason: suppression.suppressed ? suppression.reason : "",
    announcementCooldownSkipReason: "suppressed_cooldown",
    announcementCooldownMsByReason: {
      [PROACTIVE_CONVERSATION_REASON]: dynamicCooldownMs,
    },
  };
  const result = await processPetContractEvent(
    "PROACTIVE_CHECK",
    {
      reason: PROACTIVE_CONVERSATION_REASON,
      text: proactivePrompt.text,
      priority: "low",
      channel: "dialog",
    },
    {
      correlationId: createContractCorrelationId(),
      trigger,
      ...context,
    }
  );
  if (result && typeof result === "object") {
    result._proactivePrompt = proactivePrompt;
  }
  updateProactiveConversationStateFromResult(result, nowMs);
  emitShellState(buildShellStateSnapshot());
  return result;
}

function startProactiveConversationController() {
  if (proactiveConversationTimer) {
    clearInterval(proactiveConversationTimer);
    proactiveConversationTimer = null;
  }
  const nowMs = Date.now();
  const nextState = createInitialProactivePolicyState(nowMs);
  Object.assign(proactiveConversationState, nextState);
  proactiveConversationState.nextCheckAtMs = nowMs + PROACTIVE_CONVERSATION_START_DELAY_MS;
  refreshProactivePolicySnapshot(nowMs);
  proactiveConversationTimer = setInterval(() => {
    void runProactiveConversationCheck("interval").catch((error) => {
      console.warn(`[pet-contract] proactive-check error: ${error?.message || String(error)}`);
    });
  }, PROACTIVE_CONVERSATION_CHECK_INTERVAL_MS);
}

function refreshShellTrayMenu() {
  const snapshot = buildShellStateSnapshot();
  if (!shellTray) {
    emitShellState(snapshot);
    return snapshot;
  }

  const menu = Menu.buildFromTemplate([
    {
      label: "Inventory...",
      click: () => {
        void runShellAction(SHELL_ACTIONS.openInventory);
      },
    },
    {
      label: "Status...",
      click: () => {
        void runShellAction(SHELL_ACTIONS.openStatus);
      },
    },
    {
      label: "Setup...",
      click: () => {
        void runShellAction(SHELL_ACTIONS.openSetup);
      },
    },
    {
      label: "Advanced Settings...",
      click: () => {
        void runShellAction(SHELL_ACTIONS.openSettings);
      },
    },
    {
      label: "Open Chat...",
      click: () => {
        void runShellAction(SHELL_ACTIONS.openChat);
      },
    },
    { type: "separator" },
    {
      label: "Roam",
      submenu: [
        {
          label: "Desktop",
          type: "radio",
          checked: snapshot.roaming.mode === ROAMING_MODES.desktop,
          click: () => {
            void runShellAction(SHELL_ACTIONS.roamDesktop);
          },
        },
        {
          label: `Zone (${getRoamZoneLabel(snapshot)})`,
          type: "radio",
          checked: snapshot.roaming.mode === ROAMING_MODES.zone,
          click: () => {
            void runShellAction(SHELL_ACTIONS.roamZone);
          },
        },
        {
          label: "Draw Zone...",
          click: () => {
            void runShellAction(SHELL_ACTIONS.selectRoamZone);
          },
        },
      ],
    },
    { type: "separator" },
    {
      label: "Diagnostics Overlay",
      type: "checkbox",
      checked: snapshot.ui.diagnosticsEnabled,
      click: () => {
        void runShellAction(SHELL_ACTIONS.toggleDiagnostics);
      },
    },
    {
      label: "Pin Latest Speech Bubble",
      type: "checkbox",
      checked: snapshot.dialog.alwaysShowBubble,
      click: () => {
        void runShellAction(SHELL_ACTIONS.toggleAlwaysShowBubble);
      },
    },
    { type: "separator" },
    {
      label: `Fallback Hotkeys ${snapshot.devFallback.hotkeys.join(", ")}`,
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);

  shellTray.setToolTip("Virtual Pet");
  shellTray.setContextMenu(menu);
  emitShellState(snapshot);
  return snapshot;
}

function initializeShellSurface() {
  try {
    shellTray = new Tray(createShellTrayIcon());
    shellTraySupported = true;
    shellTrayError = null;
    shellTray.on("click", () => {
      if (shellTray) {
        shellTray.popUpContextMenu();
      }
    });
    refreshShellTrayMenu();
    syncShellRoamingState("shell_startup", true);
    console.log("[pet-shell] tray surface ready");
  } catch (error) {
    shellTray = null;
    shellTraySupported = false;
    shellTrayError = error?.message || String(error);
    console.warn(`[pet-shell] tray surface unavailable: ${shellTrayError}`);
    emitShellState(buildShellStateSnapshot());
    syncShellRoamingState("shell_startup_no_tray", true);
  }
}

function collectPatchPaths(patch, prefix = "") {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return [];
  const paths = [];
  for (const [key, value] of Object.entries(patch)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      paths.push(...collectPatchPaths(value, nextPrefix));
      continue;
    }
    paths.push(nextPrefix);
  }
  return paths;
}

function applyRuntimeSettingsPatch(patch, reason = "shell_settings_patch") {
  persistRuntimeSettingsPatch({
    app,
    projectRoot: __dirname,
    patch,
  });
  const touchedPaths = collectPatchPaths(patch);
  initializeRuntimeSettings(reason);
  if (touchedPaths.some((pathKey) => pathKey.startsWith("openclaw."))) {
    initializeOpenClawBridgeRuntime();
    syncOpenClawBridgeCapabilityState("settings_patch");
    refreshIntegrationCapabilityStates();
  }
  const snapshot = refreshShellTrayMenu();
  return snapshot;
}

function syncOpenClawBridgeCapabilityState(trigger = "runtime_refresh") {
  if (!capabilityRegistry) return;
  const openclawEnabled = Boolean(runtimeSettings?.openclaw?.enabled);
  const transport =
    runtimeSettings?.openclaw?.transport === BRIDGE_TRANSPORTS.http
      ? BRIDGE_TRANSPORTS.http
      : runtimeSettings?.openclaw?.transport === BRIDGE_TRANSPORTS.ws
        ? BRIDGE_TRANSPORTS.ws
        : BRIDGE_TRANSPORTS.stub;

  if (!openclawEnabled) {
    updateCapabilityState(
      CAPABILITY_IDS.openclawBridge,
      CAPABILITY_STATES.disabled,
      "disabledByConfig",
      {
        trigger,
        mode: BRIDGE_MODES.offline,
        transport,
      }
    );
    return;
  }

  if (!openclawBridge || typeof openclawBridge.getStartupState !== "function") {
    updateCapabilityState(
      CAPABILITY_IDS.openclawBridge,
      CAPABILITY_STATES.failed,
      "bridgeRuntimeUnavailable",
      {
        trigger,
      }
    );
    return;
  }

  const startupState = openclawBridge.getStartupState();
  updateCapabilityState(
    CAPABILITY_IDS.openclawBridge,
    startupState?.state || CAPABILITY_STATES.failed,
    startupState?.reason || "bridgeRuntimeUnavailable",
    {
      trigger,
      ...(startupState?.details && typeof startupState.details === "object"
        ? startupState.details
        : {}),
    }
  );
}

async function runShellAction(actionId) {
  try {
    let snapshot = latestShellState || buildShellStateSnapshot();
    if (actionId === SHELL_ACTIONS.openInventory) {
      openInventoryWindow(resolveShellWindowTabForAction(actionId, inventoryWindowActiveTab));
      snapshot = emitShellState(buildShellStateSnapshot());
    } else if (actionId === SHELL_ACTIONS.openStatus) {
      openStatusWindow();
      snapshot = emitShellState(buildShellStateSnapshot());
    } else if (actionId === SHELL_ACTIONS.openSetup) {
      openSetupWindow();
      snapshot = emitShellState(buildShellStateSnapshot());
    } else if (actionId === SHELL_ACTIONS.openSettings) {
      openSettingsWindow();
      snapshot = emitShellState(buildShellStateSnapshot());
    } else if (actionId === SHELL_ACTIONS.openChat) {
      emitToRenderer("pet:dialog-open-request", {
        source: "shell",
        actionId,
        ts: Date.now(),
      });
      snapshot = emitShellState(buildShellStateSnapshot());
    } else if (actionId === SHELL_ACTIONS.roamDesktop) {
      snapshot = applyRuntimeSettingsPatch(
        {
          roaming: {
            mode: ROAMING_MODES.desktop,
          },
        },
        "shell_roam_desktop"
      );
      syncShellRoamingState("shell_roam_desktop", true);
    } else if (actionId === SHELL_ACTIONS.roamZone) {
      snapshot = applyRuntimeSettingsPatch(
        {
          roaming: {
            mode: ROAMING_MODES.zone,
            zone: snapshot?.roaming?.zoneRect ? "custom" : snapshot?.roaming?.zone || DEFAULT_ROAMING_ZONE,
          },
        },
        "shell_roam_zone"
      );
      if (!snapshot?.roaming?.zoneRect) {
        openZoneSelectorWindow();
      }
      syncShellRoamingState("shell_roam_zone", true);
    } else if (actionId === SHELL_ACTIONS.selectRoamZone) {
      snapshot = applyRuntimeSettingsPatch(
        {
          roaming: {
            mode: ROAMING_MODES.zone,
            zone: "custom",
          },
        },
        "shell_select_roam_zone"
      );
      openZoneSelectorWindow();
      syncShellRoamingState("shell_select_roam_zone", true);
    } else if (actionId === SHELL_ACTIONS.toggleDiagnostics) {
      snapshot = applyRuntimeSettingsPatch(
        {
          ui: {
            diagnosticsEnabled: !snapshot?.ui?.diagnosticsEnabled,
          },
        },
        "shell_toggle_diagnostics"
      );
    } else if (actionId === SHELL_ACTIONS.toggleHeadphones) {
      snapshot = applyRuntimeSettingsPatch(
        {
          wardrobe: {
            activeAccessories: toggleMembership(
              snapshot?.wardrobe?.activeAccessories,
              SHELL_ACCESSORY_IDS.headphones
            ),
          },
        },
        "shell_toggle_headphones"
      );
    } else if (actionId === SHELL_ACTIONS.togglePoolRing) {
      snapshot = applyRuntimeSettingsPatch(
        {
          inventory: {
            quickProps: toggleMembership(
              snapshot?.inventory?.quickProps,
              SHELL_QUICK_PROP_IDS.poolRing
            ),
          },
        },
        "shell_toggle_pool_ring"
      );
    } else if (actionId === SHELL_ACTIONS.toggleAlwaysShowBubble) {
      snapshot = applyRuntimeSettingsPatch(
        {
          dialog: {
            alwaysShowBubble: !snapshot?.dialog?.alwaysShowBubble,
          },
        },
        "shell_toggle_always_show_bubble"
      );
    } else {
      return {
        ok: false,
        error: "unknown_shell_action",
      };
    }

    return {
      ok: true,
      actionId,
      shellState: latestShellState || snapshot,
    };
  } catch (error) {
    return {
      ok: false,
      actionId,
      error: error?.message || String(error),
    };
  }
}

function getBridgeRequestTimeoutMs() {
  const configured = Number(runtimeSettings?.openclaw?.timeoutMs);
  if (!Number.isFinite(configured) || configured < 200) return 1200;
  return Math.round(configured);
}

function initializeOpenClawPetCommandLaneRuntime() {
  const openclaw = runtimeSettings?.openclaw && typeof runtimeSettings.openclaw === "object"
    ? runtimeSettings.openclaw
    : {};
  const keyId =
    typeof openclaw.petCommandKeyId === "string" && openclaw.petCommandKeyId.trim().length > 0
      ? openclaw.petCommandKeyId.trim()
      : DEFAULT_OPENCLAW_PET_COMMAND_KEY_ID;
  const secretRef =
    typeof openclaw.petCommandSharedSecretRef === "string" && openclaw.petCommandSharedSecretRef.trim().length > 0
      ? openclaw.petCommandSharedSecretRef.trim()
      : DEFAULT_OPENCLAW_PET_COMMAND_SECRET_REF;
  const secretValue =
    typeof openclaw.petCommandSharedSecret === "string" && openclaw.petCommandSharedSecret.trim().length > 0
      ? openclaw.petCommandSharedSecret.trim()
      : null;
  const secretSource = resolvePetCommandSecretSource(openclaw);

  openclawPetCommandLane = createOpenClawPetCommandLane({
    resolveSharedSecret: ({ keyId: candidateKeyId }) => {
      if (candidateKeyId && candidateKeyId !== keyId) {
        return {
          secret: null,
          source: "none",
          ref: secretRef,
        };
      }
      return {
        secret: secretValue,
        source: secretSource,
        ref: secretRef,
      };
    },
    executeAction: async ({ actionId, args, envelope, correlationId, keyId: resolvedKeyId }) => {
      if (actionId === "dialog.injectAnnouncement") {
        return recordCommandInjectedAnnouncement({
          correlationId,
          requestId: envelope?.requestId,
          text: args?.text,
          source: envelope?.source,
          keyId: resolvedKeyId,
        });
      }
      if (actionId === "shell.openStatus") {
        openStatusWindow();
        const shellState = emitShellState(buildShellStateSnapshot());
        return {
          ok: true,
          shellState,
        };
      }
      throw new Error(`unsupported_action:${actionId || "unknown"}`);
    },
    onAudit: appendOpenClawPetCommandAudit,
  });
}

function initializeOpenClawPluginSkillLaneRuntime() {
  openclawPluginSkillLane = createOpenClawPluginSkillLane({
    processCommandRequest: async (envelope, { correlationId }) =>
      executeOpenClawPetCommandRequest(envelope, correlationId),
    readStatus: async ({ scope }) => buildOpenClawPluginSkillStatusRead(scope),
    submitMemorySyncIntent: async (intent) => submitReflectionMemorySyncIntent(intent),
    onAudit: appendOpenClawPluginSkillAudit,
  });
}

function initializeOpenClawBridgeRuntime() {
  const settings = runtimeSettings?.openclaw || {};
  const configuredMode = typeof settings.mode === "string" ? settings.mode : BRIDGE_MODES.online;
  const configuredTransport =
    settings.transport === BRIDGE_TRANSPORTS.http
      ? BRIDGE_TRANSPORTS.http
      : settings.transport === BRIDGE_TRANSPORTS.ws
        ? BRIDGE_TRANSPORTS.ws
      : BRIDGE_TRANSPORTS.stub;
  const openclawEnabled = Boolean(settings.enabled);
  const bridgeMode =
    CAPABILITY_TEST_FLAGS.openclawFail || !openclawEnabled ? BRIDGE_MODES.offline : configuredMode;

  openclawBridge = createOpenClawBridge({
    mode: bridgeMode,
    transport: configuredTransport,
    baseUrl: typeof settings.baseUrl === "string" ? settings.baseUrl : "",
    retryCount: Number.isFinite(Number(settings.retryCount))
      ? Math.max(0, Math.round(Number(settings.retryCount)))
      : 0,
    authToken: typeof settings.authToken === "string" ? settings.authToken : null,
    allowNonLoopback: Boolean(settings.allowNonLoopback),
    requestTimeoutMs: getBridgeRequestTimeoutMs(),
    logger: (kind, payload) => {
      console.log(
        `[pet-openclaw] ${kind} correlationId=${payload?.correlationId || "n/a"} route=${
          payload?.route || "n/a"
        } mode=${payload?.mode || bridgeMode} transport=${
          payload?.transport || configuredTransport
        }`
      );
    },
  });
}

function emitIntegrationEvent(payload) {
  if (!payload || typeof payload !== "object") return;
  latestIntegrationEvent = payload;
  emitToRenderer("pet:integration", payload);
}

function setIntegrationProbeState(integrationId, update = {}) {
  if (integrationId !== "spotify" && integrationId !== "freshRss") return;
  const previous = integrationProbeStates[integrationId] || createInitialIntegrationProbeState();
  const next = {
    ...previous,
    ...update,
    state: typeof update.state === "string" ? update.state : previous.state,
    reason: typeof update.reason === "string" ? update.reason : previous.reason,
    fallbackMode:
      typeof update.fallbackMode === "string" ? update.fallbackMode : previous.fallbackMode,
    lastProbeAt: Number.isFinite(update.lastProbeAt)
      ? update.lastProbeAt
      : Number.isFinite(previous.lastProbeAt)
        ? previous.lastProbeAt
        : 0,
    lastSuccessAt: Number.isFinite(update.lastSuccessAt)
      ? update.lastSuccessAt
      : Number.isFinite(previous.lastSuccessAt)
        ? previous.lastSuccessAt
        : 0,
    lastFailureAt: Number.isFinite(update.lastFailureAt)
      ? update.lastFailureAt
      : Number.isFinite(previous.lastFailureAt)
        ? previous.lastFailureAt
        : 0,
    error:
      typeof update.error === "string" || update.error === null ? update.error : previous.error,
  };
  integrationProbeStates = {
    ...integrationProbeStates,
    [integrationId]: next,
  };
  refreshIntegrationCapabilityStates();
}

function getOpenClawAgentProbeOptions() {
  const settings = buildRuntimeSettingsSummary();
  return {
    agentId: settings.openclaw.agentId || DEFAULT_OPENCLAW_AGENT_ID,
    timeoutMs: settings.openclaw.agentTimeoutMs || DEFAULT_OPENCLAW_AGENT_TIMEOUT_MS,
  };
}

async function runAgentProbeWithJson(prompt, label) {
  const options = getOpenClawAgentProbeOptions();
  const envelope = await runOpenClawAgentPrompt({
    agentId: options.agentId,
    timeoutMs: options.timeoutMs,
    prompt,
    logger: (kind, payload) => {
      console.log(
        `[pet-openclaw-agent] ${label} ${kind} agent=${options.agentId} runId=${
          payload?.runId || "n/a"
        } status=${payload?.status || "n/a"}`
      );
    },
  });
  try {
    return {
      ok: true,
      text: envelope.payloadText,
      json: parseJsonPayload(envelope.payloadText),
      envelope,
    };
  } catch {
    return {
      ok: false,
      text: envelope.payloadText,
      failure: detectAgentFailure(envelope.payloadText),
      envelope,
    };
  }
}

function buildSpotifyProbeResponseText(nowPlaying, topArtistSummary, degradedParts = []) {
  const segments = [];
  if (nowPlaying) {
    const outputSuffix =
      nowPlaying.outputRoute && nowPlaying.outputRoute !== "unknown"
        ? ` on ${nowPlaying.outputRoute === "speaker" ? "Speakers" : "Headphones"}`
        : nowPlaying.outputDeviceName && nowPlaying.outputDeviceName !== "unknown_device"
          ? ` on ${nowPlaying.outputDeviceName}`
          : "";
    segments.push(
      `Spotify ${nowPlaying.isPlaying ? "is playing" : "last reported"} ${nowPlaying.trackName} by ${nowPlaying.artistName}${outputSuffix}.`
    );
  }
  if (topArtistSummary?.topArtist) {
    segments.push(`Top artist (${topArtistSummary.timeRange}): ${topArtistSummary.topArtist}.`);
  }
  if (degradedParts.length > 0) {
    segments.push(`Degraded: ${degradedParts.join("; ")}.`);
  }
  return segments.join(" ").trim() || "Spotify probe returned no usable data.";
}

function buildFreshRssResponseText(summary, items = [], degradedReason = null, degradedMessage = null) {
  const normalizedSummary =
    typeof summary === "string" && summary.trim().length > 0
      ? summary.trim()
      : `FreshRSS returned ${items.length} items.`;
  if (!degradedReason) return normalizedSummary;
  const detail =
    typeof degradedMessage === "string" && degradedMessage.trim().length > 0
      ? degradedMessage.trim()
      : degradedReason;
  if (normalizedSummary === detail) {
    return normalizedSummary;
  }
  return `${normalizedSummary} Degraded: ${detail}.`;
}

function deriveIntegrationState(capabilityId) {
  const settings = buildRuntimeSettingsSummary();
  if (capabilityId === CAPABILITY_IDS.spotifyIntegration) {
    return deriveIntegrationCapabilityState("spotify", settings.integrations.spotify, {
      openclawEnabled: settings.openclaw.enabled,
      probeState: integrationProbeStates.spotify,
    });
  }
  if (capabilityId === CAPABILITY_IDS.freshRssIntegration) {
    return deriveIntegrationCapabilityState("freshRss", settings.integrations.freshRss, {
      openclawEnabled: settings.openclaw.enabled,
      probeState: integrationProbeStates.freshRss,
    });
  }
  return null;
}

function refreshIntegrationCapabilityStates() {
  if (!capabilityRegistry) return;
  const spotifyState = deriveIntegrationState(CAPABILITY_IDS.spotifyIntegration);
  if (spotifyState) {
    updateCapabilityState(
      CAPABILITY_IDS.spotifyIntegration,
      spotifyState.state,
      spotifyState.reason,
      spotifyState.details
    );
  }
  const freshRssState = deriveIntegrationState(CAPABILITY_IDS.freshRssIntegration);
  if (freshRssState) {
    updateCapabilityState(
      CAPABILITY_IDS.freshRssIntegration,
      freshRssState.state,
      freshRssState.reason,
      freshRssState.details
    );
  }
}

function emitMemorySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  const mergedSnapshot = {
    ...snapshot,
  };
  if (latestOfflineRecallSnapshot && typeof latestOfflineRecallSnapshot === "object") {
    mergedSnapshot.lastOfflineRecall = latestOfflineRecallSnapshot;
  }
  if (latestPersonaSnapshot && typeof latestPersonaSnapshot === "object") {
    mergedSnapshot.lastPersonaSnapshot = latestPersonaSnapshot;
  }
  if (latestPersonaExportSnapshot && typeof latestPersonaExportSnapshot === "object") {
    mergedSnapshot.lastPersonaExport = latestPersonaExportSnapshot;
  }
  if (latestOfflinePersonaReplySnapshot && typeof latestOfflinePersonaReplySnapshot === "object") {
    mergedSnapshot.lastOfflinePersonaReply = latestOfflinePersonaReplySnapshot;
  }
  if (latestProactivePolicySnapshot && typeof latestProactivePolicySnapshot === "object") {
    mergedSnapshot.lastProactivePolicy = latestProactivePolicySnapshot;
  }
  if (latestReflectionRuntimeSnapshot && typeof latestReflectionRuntimeSnapshot === "object") {
    mergedSnapshot.lastReflectionRuntime = latestReflectionRuntimeSnapshot;
  }
  latestMemorySnapshot = mergedSnapshot;
  emitToRenderer("pet:memory", {
    kind: "memorySnapshot",
    snapshot: mergedSnapshot,
    ts: Date.now(),
  });
}

function normalizePersonaSnapshotSummary(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const fields = snapshot.fields && typeof snapshot.fields === "object" ? snapshot.fields : {};
  const fieldKeys = Object.keys(fields)
    .filter((entry) => typeof entry === "string" && entry.trim().length > 0)
    .sort()
    .slice(0, 12);
  return {
    builtAt: Number.isFinite(Number(snapshot.builtAt))
      ? Math.max(0, Math.round(Number(snapshot.builtAt)))
      : Date.now(),
    schemaVersion:
      typeof snapshot.schemaVersion === "string" && snapshot.schemaVersion.trim().length > 0
        ? snapshot.schemaVersion.trim()
        : "vp-persona-snapshot-v1",
    state:
      typeof snapshot.state === "string" && snapshot.state.trim().toLowerCase() === "ready"
        ? "ready"
        : "degraded",
    degradedReason:
      typeof snapshot.degradedReason === "string" && snapshot.degradedReason.trim().length > 0
        ? snapshot.degradedReason.trim()
        : "parse_incomplete",
    derivedFrom: Array.isArray(snapshot.derivedFrom)
      ? snapshot.derivedFrom
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter((entry) => entry.length > 0)
          .slice(0, 8)
      : [],
    fieldCount: fieldKeys.length,
    fieldKeys,
  };
}

function normalizeOfflinePersonaReplySnapshot(reply) {
  if (!reply || typeof reply !== "object") return null;
  const intent =
    typeof reply.intent === "string" && reply.intent.trim().length > 0
      ? reply.intent.trim()
      : null;
  if (!intent) return null;
  const styleProfile =
    reply.styleProfile && typeof reply.styleProfile === "object" ? reply.styleProfile : {};
  return {
    ts: Number.isFinite(Number(reply.ts)) ? Math.max(0, Math.round(Number(reply.ts))) : Date.now(),
    intent,
    personaState:
      typeof reply.personaState === "string" && reply.personaState.trim().length > 0
        ? reply.personaState.trim()
        : "degraded",
    personaReason:
      typeof reply.personaReason === "string" && reply.personaReason.trim().length > 0
        ? reply.personaReason.trim()
        : "parse_incomplete",
    personaMode:
      typeof reply.personaMode === "string" && reply.personaMode.trim().length > 0
        ? reply.personaMode.trim()
        : "neutral_fallback",
    selectionHash:
      typeof reply.selectionHash === "string" && reply.selectionHash.trim().length > 0
        ? reply.selectionHash.trim()
        : "none",
    styleProfile: {
      warmth:
        typeof styleProfile.warmth === "string" && styleProfile.warmth.trim().length > 0
          ? styleProfile.warmth.trim()
          : "medium",
      playfulness:
        typeof styleProfile.playfulness === "string" && styleProfile.playfulness.trim().length > 0
          ? styleProfile.playfulness.trim()
          : "low",
      curiosity:
        typeof styleProfile.curiosity === "string" && styleProfile.curiosity.trim().length > 0
          ? styleProfile.curiosity.trim()
          : "medium",
      openerStyle:
        typeof styleProfile.openerStyle === "string" && styleProfile.openerStyle.trim().length > 0
          ? styleProfile.openerStyle.trim()
          : "direct",
      closerStyle:
        typeof styleProfile.closerStyle === "string" && styleProfile.closerStyle.trim().length > 0
          ? styleProfile.closerStyle.trim()
          : "none",
      emojiPolicy:
        typeof styleProfile.emojiPolicy === "string" && styleProfile.emojiPolicy.trim().length > 0
          ? styleProfile.emojiPolicy.trim()
          : "none",
    },
  };
}

function normalizeProactivePolicySnapshot(policy) {
  if (!policy || typeof policy !== "object") return null;
  return {
    ts: Number.isFinite(Number(policy.ts)) ? Math.max(0, Math.round(Number(policy.ts))) : Date.now(),
    proactiveState:
      typeof policy.proactiveState === "string" && policy.proactiveState.trim().length > 0
        ? policy.proactiveState.trim()
        : "eligible",
    lastAttemptReason:
      typeof policy.lastAttemptReason === "string" && policy.lastAttemptReason.trim().length > 0
        ? policy.lastAttemptReason.trim()
        : "none",
    suppressionReason:
      typeof policy.suppressionReason === "string" && policy.suppressionReason.trim().length > 0
        ? policy.suppressionReason.trim()
        : "none",
    backoffTier: Number.isFinite(Number(policy.backoffTier))
      ? Math.max(0, Math.round(Number(policy.backoffTier)))
      : 0,
    cooldownMs: Number.isFinite(Number(policy.cooldownMs))
      ? Math.max(0, Math.round(Number(policy.cooldownMs)))
      : getProactiveCooldownMsForTier(0),
    cooldownRemainingMs: Number.isFinite(Number(policy.cooldownRemainingMs))
      ? Math.max(0, Math.round(Number(policy.cooldownRemainingMs)))
      : 0,
    nextEligibleAt: Number.isFinite(Number(policy.nextEligibleAt))
      ? Math.max(0, Math.round(Number(policy.nextEligibleAt)))
      : 0,
    repeatGuardWindowMs: Number.isFinite(Number(policy.repeatGuardWindowMs))
      ? Math.max(0, Math.round(Number(policy.repeatGuardWindowMs)))
      : 0,
    recentUserInputAtMs: Number.isFinite(Number(policy.recentUserInputAtMs))
      ? Math.max(0, Math.round(Number(policy.recentUserInputAtMs)))
      : 0,
    lastOpenerHash:
      typeof policy.lastOpenerHash === "string" && policy.lastOpenerHash.trim().length > 0
        ? policy.lastOpenerHash.trim()
        : "none",
    awaitingUserEngagement: Boolean(policy.awaitingUserEngagement),
  };
}

function refreshProactivePolicySnapshot(nowMs = Date.now()) {
  latestProactivePolicySnapshot = normalizeProactivePolicySnapshot(
    buildProactivePolicySnapshot(proactiveConversationState, nowMs)
  );
  if (latestMemorySnapshot && typeof latestMemorySnapshot === "object") {
    emitMemorySnapshot(latestMemorySnapshot);
  }
}

function normalizePersonaExportSummary(personaExport) {
  if (!personaExport || typeof personaExport !== "object") return null;
  const facts = Array.isArray(personaExport.facts)
    ? personaExport.facts
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => ({
          key: typeof entry.key === "string" ? entry.key.trim() : "",
          value: typeof entry.value === "string" ? entry.value.trim() : "",
          provenanceTag:
            typeof entry.provenanceTag === "string" && entry.provenanceTag.trim().length > 0
              ? entry.provenanceTag.trim()
              : "unknown",
        }))
        .filter((entry) => entry.key.length > 0 && entry.value.length > 0)
        .slice(0, 12)
    : [];
  const styleHints = Array.isArray(personaExport.styleHints)
    ? personaExport.styleHints
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
        .slice(0, 6)
    : [];
  const highlightCount = Array.isArray(personaExport.recentHighlights)
    ? Math.min(3, personaExport.recentHighlights.length)
    : 0;
  const mode =
    typeof personaExport.mode === "string" && personaExport.mode.trim().length > 0
      ? personaExport.mode.trim()
      : "online_dialog";
  const summary =
    typeof personaExport.summary === "string" && personaExport.summary.trim().length > 0
      ? personaExport.summary.trim()
      : "";
  const byteSize = Number.isFinite(Number(personaExport.byteSize))
    ? Math.max(0, Math.round(Number(personaExport.byteSize)))
    : Buffer.byteLength(
        JSON.stringify({
          summary,
          facts,
          styleHints,
          highlightCount,
        }),
        "utf8"
      );
  return {
    ts: Number.isFinite(Number(personaExport.ts))
      ? Math.max(0, Math.round(Number(personaExport.ts)))
      : Date.now(),
    mode,
    schemaVersion:
      typeof personaExport.schemaVersion === "string" && personaExport.schemaVersion.trim().length > 0
        ? personaExport.schemaVersion.trim()
        : "vp-persona-export-v1",
    snapshotVersion:
      typeof personaExport.snapshotVersion === "string" && personaExport.snapshotVersion.trim().length > 0
        ? personaExport.snapshotVersion.trim()
        : "vp-persona-snapshot-v1",
    state:
      typeof personaExport.state === "string" && personaExport.state.trim().toLowerCase() === "ready"
        ? "ready"
        : "degraded",
    degradedReason:
      typeof personaExport.degradedReason === "string" && personaExport.degradedReason.trim().length > 0
        ? personaExport.degradedReason.trim()
        : "parse_incomplete",
    summary,
    fieldCount: facts.length,
    facts,
    styleHints,
    highlightCount,
    byteSize,
  };
}

function buildCurrentPersonaRuntimeInputs() {
  const memorySnapshot =
    latestMemorySnapshot ||
    (memoryPipeline && typeof memoryPipeline.getSnapshot === "function"
      ? memoryPipeline.getSnapshot()
      : null);
  const runtimeObservations =
    memoryPipeline && typeof memoryPipeline.getRecentObservations === "function"
      ? memoryPipeline.getRecentObservations({ limit: 24 })
      : [];
  return {
    workspaceRoot:
      memorySnapshot?.localWorkspaceRoot || runtimeSettingsResolvedPaths?.localRoot || __dirname,
    runtimeObservations,
    memoryDir: memorySnapshot?.paths?.memoryDir || "",
    memoryAvailable: Boolean(memoryPipeline),
  };
}

function refreshPersonaSnapshotCache({ recordExportMode = null } = {}) {
  const nowTs = Date.now();
  const inputs = buildCurrentPersonaRuntimeInputs();
  const personaSnapshot = buildRuntimePersonaSnapshot({
    workspaceRoot: inputs.workspaceRoot,
    runtimeObservations: inputs.runtimeObservations,
    memoryDir: inputs.memoryDir,
    memoryAvailable: inputs.memoryAvailable,
    ts: nowTs,
  });
  latestPersonaSnapshotRuntime = personaSnapshot;
  latestPersonaSnapshot = normalizePersonaSnapshotSummary(personaSnapshot);

  let personaExport = null;
  if (recordExportMode) {
    personaExport = buildRuntimePersonaExport({
      snapshot: personaSnapshot,
      mode: recordExportMode,
      ts: nowTs,
    });
    latestPersonaExportSnapshot = normalizePersonaExportSummary(personaExport);
  }

  return {
    personaSnapshot,
    personaExport,
  };
}

function normalizeOfflineRecallSnapshot(recallResult) {
  if (!recallResult || typeof recallResult !== "object") return null;
  if (typeof recallResult.recallType !== "string" || recallResult.recallType.trim().length <= 0) {
    return null;
  }
  const evidenceTags = Array.isArray(recallResult.evidenceTags)
    ? recallResult.evidenceTags
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
        .slice(0, 6)
    : [];
  const evidenceRefs = Array.isArray(recallResult.evidenceRefs)
    ? recallResult.evidenceRefs
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => ({
          kind: typeof entry.kind === "string" ? entry.kind : "runtime",
          fileId: typeof entry.fileId === "string" ? entry.fileId : null,
          field: typeof entry.field === "string" ? entry.field : null,
          observationId: typeof entry.observationId === "string" ? entry.observationId : null,
          observationType: typeof entry.observationType === "string" ? entry.observationType : null,
          evidenceTag: typeof entry.evidenceTag === "string" ? entry.evidenceTag : null,
        }))
        .slice(0, 6)
    : [];
  return {
    ts: Number.isFinite(Number(recallResult.ts))
      ? Math.max(0, Math.round(Number(recallResult.ts)))
      : Date.now(),
    recallType: recallResult.recallType.trim(),
    degradedReason:
      typeof recallResult.degradedReason === "string" && recallResult.degradedReason.trim().length > 0
        ? recallResult.degradedReason.trim()
        : "none",
    evidenceTags,
    evidenceRefs,
  };
}

function recordOfflineRecallSnapshot(recallResult) {
  const normalized = normalizeOfflineRecallSnapshot(recallResult);
  if (!normalized) return;
  latestOfflineRecallSnapshot = normalized;
  if (latestMemorySnapshot && typeof latestMemorySnapshot === "object") {
    emitMemorySnapshot(latestMemorySnapshot);
  }
}

function recordOfflinePersonaReplySnapshot(reply) {
  const normalized = normalizeOfflinePersonaReplySnapshot(reply);
  if (!normalized) return;
  latestOfflinePersonaReplySnapshot = normalized;
  if (latestMemorySnapshot && typeof latestMemorySnapshot === "object") {
    emitMemorySnapshot(latestMemorySnapshot);
  }
}

function logMemoryEvent(kind, payload = {}) {
  const suffix =
    payload && typeof payload === "object" ? ` ${JSON.stringify(payload)}` : "";
  console.log(`[pet-memory] ${kind}${suffix}`);
  if (!DIAGNOSTICS_ENABLED) return;
  emitDiagnostics({
    kind: "memoryEvent",
    eventKind: kind,
    payload,
  });
}

async function initializeMemoryPipelineRuntime() {
  const settings = buildRuntimeSettingsSummary();
  if (!settings.memory.enabled) {
    memoryPipeline = null;
    latestMemorySnapshot = {
      requestedAdapterMode: settings.memory.adapterMode,
      activeAdapterMode: "disabled",
      fallbackReason: "memory_disabled",
      localWorkspaceRoot: settings.paths.localWorkspaceRoot,
      openClawWorkspaceRoot: settings.paths.openClawWorkspaceRoot,
      obsidianVaultPath: settings.paths.obsidianVaultRoot,
      openclawEnabled: settings.openclaw.enabled,
      writeLegacyJsonl: settings.memory.writeLegacyJsonl,
      paths: null,
    };
    emitMemorySnapshot(latestMemorySnapshot);
    refreshPersonaSnapshotCache();
    emitMemorySnapshot(latestMemorySnapshot);
    reflectionRuntimeState.runtimeState = "suppressed";
    reflectionRuntimeState.runtimeReason = "memory_disabled";
    reflectionRuntimeState.inFlight = null;
    reflectionRuntimeState.retryAtMs.heartbeat = 0;
    reflectionRuntimeState.retryAtMs.digest = 0;
    refreshReflectionRuntimeSnapshot();
    logMemoryEvent("runtimeDisabled", latestMemorySnapshot);
    return;
  }

  memoryPipeline = createMemoryPipeline({
    workspaceRoot: settings.paths.localWorkspaceRoot,
    paths: {
      localWorkspaceRoot: settings.paths.localWorkspaceRoot,
      openClawWorkspaceRoot: settings.paths.openClawWorkspaceRoot,
      obsidianVaultRoot: settings.paths.obsidianVaultRoot,
    },
    openclawEnabled: settings.openclaw.enabled,
    openclawWorkspaceBootstrapMode: OPENCLAW_WORKSPACE_BOOTSTRAP_MODES.warn_only,
    adapterMode: settings.memory.adapterMode,
    obsidianVaultPath: settings.paths.obsidianVaultRoot,
    mutationTransparencyPolicy: settings.memory.mutationTransparencyPolicy,
    writeLegacyJsonl: settings.memory.writeLegacyJsonl,
    logger: (kind, payload) => {
      logMemoryEvent(kind, payload);
      emitToRenderer("pet:memory", {
        kind,
        payload,
        ts: Date.now(),
      });
    },
  });

  try {
    const snapshot = await memoryPipeline.start();
    emitMemorySnapshot(snapshot);
    refreshPersonaSnapshotCache();
    emitMemorySnapshot(snapshot);
    await rehydrateReflectionRuntimeFromLogs("memory_runtime_start");
    logMemoryEvent("runtimeReady", snapshot);
  } catch (error) {
    console.warn(`[pet-memory] runtime initialization failed: ${error?.message || String(error)}`);
    const fallbackSettings = buildRuntimeSettingsSummary();
    latestMemorySnapshot = {
      requestedAdapterMode: fallbackSettings.memory.adapterMode,
      activeAdapterMode: MEMORY_ADAPTER_MODES.local,
      fallbackReason: "startup_failed",
      error: error?.message || String(error),
      localWorkspaceRoot: fallbackSettings.paths.localWorkspaceRoot,
      openClawWorkspaceRoot: fallbackSettings.paths.openClawWorkspaceRoot,
      obsidianVaultPath: fallbackSettings.paths.obsidianVaultRoot,
      openclawEnabled: fallbackSettings.openclaw.enabled,
      writeLegacyJsonl: fallbackSettings.memory.writeLegacyJsonl,
    };
    emitMemorySnapshot(latestMemorySnapshot);
    refreshPersonaSnapshotCache();
    emitMemorySnapshot(latestMemorySnapshot);
    reflectionRuntimeState.runtimeState = "degraded";
    reflectionRuntimeState.runtimeReason = "memory_startup_failed";
    reflectionRuntimeState.inFlight = null;
    reflectionRuntimeState.retryAtMs.heartbeat = 0;
    reflectionRuntimeState.retryAtMs.digest = 0;
    refreshReflectionRuntimeSnapshot();
  }
}

function emitContractTrace(trace) {
  if (!trace || typeof trace !== "object") return;
  latestContractTrace = trace;
  emitToRenderer("pet:contract-trace", trace);
}

function logContractTrace(trace) {
  if (!trace || typeof trace !== "object") return;
  const stage = trace.stage || "unknown";
  const payload = trace.payload || {};
  const correlationId = payload.correlationId || "n/a";
  const type = payload.type || "unknown";
  const source = trace.context?.source || "offline";
  console.log(
    `[pet-contract] stage=${stage} type=${type} correlationId=${correlationId} source=${source}`
  );

  if (!DIAGNOSTICS_ENABLED) return;
  emitDiagnostics({
    kind: "contractTrace",
    stage,
    type,
    correlationId,
    source,
    payload,
  });
}

function initializeContractRouter() {
  contractRouter = createPetContractRouter({
    onTrace: (trace) => {
      logContractTrace(trace);
      emitContractTrace(trace);
    },
    announcementCooldownMs: 10000,
  });
}

function initializeDialogRuntime() {
  try {
    dialogTemplateCatalog = loadDialogTemplateCatalog(DEFAULT_DIALOG_TEMPLATES_PATH);
  } catch (error) {
    dialogTemplateCatalog = createDefaultDialogTemplateCatalog();
    console.warn(`[pet-dialog] failed to load offline templates: ${error?.message || String(error)}`);
  }
}

function logStateRuntimeEvent(kind, payload) {
  const safePayload = payload && typeof payload === "object" ? payload : {};
  const stateLabel = safePayload.currentState || safePayload.stateId || "unknown";
  const phaseLabel = safePayload.phase ? ` phase=${safePayload.phase}` : "";
  console.log(`[pet-state] ${kind} state=${stateLabel}${phaseLabel}`);
  if (!DIAGNOSTICS_ENABLED) return;
  emitDiagnostics({
    kind: "stateRuntime",
    event: kind,
    ...safePayload,
  });
}

function initializeStateRuntime() {
  stateRuntime = createStateRuntime({
    catalogPath: STATE_CATALOG_PATH,
    availableClipIds: getAvailableSpriteStateIds(),
    onSnapshot: (snapshot) => {
      emitStateSnapshot(snapshot);
    },
    logger: (kind, payload) => {
      logStateRuntimeEvent(kind, payload);
    },
  });
  latestStateSnapshot = stateRuntime.start();
}

function createContractCorrelationId() {
  const randomPart = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0");
  return `evt-${Date.now().toString(36)}-${randomPart}`;
}

function createReflectionCorrelationId(cycleId) {
  const normalizedCycleId = normalizeCycleId(cycleId);
  const randomPart = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0");
  return `refl-${normalizedCycleId}-${Date.now().toString(36)}-${randomPart}`;
}

function createReflectionContextToken(cycleId) {
  const normalizedCycleId = normalizeCycleId(cycleId);
  const randomPart = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0");
  return `${normalizedCycleId}-${Date.now().toString(36)}-${randomPart}`;
}

function truncateReflectionSummaryText(value, maxLength = 180) {
  const normalized = asOptionalString(value, "") || "";
  if (!normalized) return "";
  const compact = normalized.replace(/\s+/g, " ");
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(1, maxLength - 3))}...`;
}

function buildReflectionRuntimeSnapshot() {
  const nowMs = Date.now();
  const heartbeatRun = reflectionRuntimeState.lastRuns?.heartbeat || null;
  const digestRun = reflectionRuntimeState.lastRuns?.digest || null;
  return {
    schemaVersion: REFLECTION_RUNTIME_SCHEMA,
    ts: nowMs,
    state: asOptionalString(reflectionRuntimeState.runtimeState, "idle") || "idle",
    reason: asOptionalString(reflectionRuntimeState.runtimeReason, "none") || "none",
    lastRun:
      reflectionRuntimeState.lastRun && typeof reflectionRuntimeState.lastRun === "object"
        ? { ...reflectionRuntimeState.lastRun }
        : null,
    lastHeartbeatRunAtMs: Number.isFinite(Number(heartbeatRun?.completedAtMs))
      ? Math.max(0, Math.round(Number(heartbeatRun.completedAtMs)))
      : 0,
    lastDigestRunAtMs: Number.isFinite(Number(digestRun?.completedAtMs))
      ? Math.max(0, Math.round(Number(digestRun.completedAtMs)))
      : 0,
    nextHeartbeatAtMs: Number.isFinite(Number(reflectionRuntimeState.nextRunAtMs?.heartbeat))
      ? Math.max(0, Math.round(Number(reflectionRuntimeState.nextRunAtMs.heartbeat)))
      : 0,
    nextDigestAtMs: Number.isFinite(Number(reflectionRuntimeState.nextRunAtMs?.digest))
      ? Math.max(0, Math.round(Number(reflectionRuntimeState.nextRunAtMs.digest))
      )
      : 0,
    retryHeartbeatAtMs: Number.isFinite(Number(reflectionRuntimeState.retryAtMs?.heartbeat))
      ? Math.max(0, Math.round(Number(reflectionRuntimeState.retryAtMs.heartbeat)))
      : 0,
    retryDigestAtMs: Number.isFinite(Number(reflectionRuntimeState.retryAtMs?.digest))
      ? Math.max(0, Math.round(Number(reflectionRuntimeState.retryAtMs.digest)))
      : 0,
    inFlight:
      reflectionRuntimeState.inFlight && typeof reflectionRuntimeState.inFlight === "object"
        ? { ...reflectionRuntimeState.inFlight }
        : null,
    rehydratedFromLogs: reflectionRuntimeState.rehydratedFromLogs === true,
    rehydratedEntryCount: Number.isFinite(Number(reflectionRuntimeState.rehydratedEntryCount))
      ? Math.max(0, Math.round(Number(reflectionRuntimeState.rehydratedEntryCount)))
      : 0,
  };
}

function refreshReflectionRuntimeSnapshot() {
  latestReflectionRuntimeSnapshot = buildReflectionRuntimeSnapshot();
  if (latestMemorySnapshot && typeof latestMemorySnapshot === "object") {
    emitMemorySnapshot(latestMemorySnapshot);
  }
  return latestReflectionRuntimeSnapshot;
}

function getReflectionLogDirectoryPath() {
  const snapshot =
    latestMemorySnapshot ||
    (memoryPipeline && typeof memoryPipeline.getSnapshot === "function"
      ? memoryPipeline.getSnapshot()
      : null);
  const paths = snapshot?.paths && typeof snapshot.paths === "object" ? snapshot.paths : {};
  const memoryDir = asOptionalString(paths.memoryDir, null);
  if (memoryDir) return memoryDir;
  const logsDir = asOptionalString(paths.logsDir, null);
  if (logsDir) return logsDir;
  return null;
}

function parseReflectionRunHistoryLine(line) {
  if (typeof line !== "string" || line.indexOf(`| type=${REFLECTION_LOG_OBSERVATION_TYPE}`) < 0) {
    return null;
  }
  const payloadMarker = "| payload=";
  const payloadIndex = line.indexOf(payloadMarker);
  if (payloadIndex < 0) return null;
  const payloadText = line.slice(payloadIndex + payloadMarker.length).trim();
  if (!payloadText) return null;
  let payload = null;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const cycleId = normalizeCycleId(payload.cycleId || payload.kind, REFLECTION_CYCLE_IDS.heartbeat);
  const completedAtMs = Number.isFinite(Number(payload.completedAtMs))
    ? Math.max(0, Math.round(Number(payload.completedAtMs)))
    : 0;
  if (completedAtMs <= 0) return null;
  return {
    cycleId,
    outcome:
      asOptionalString(payload.outcome, REFLECTION_OUTCOMES.suppressed) ||
      REFLECTION_OUTCOMES.suppressed,
    reason: asOptionalString(payload.reason, "none") || "none",
    completedAtMs,
    startedAtMs: Number.isFinite(Number(payload.startedAtMs))
      ? Math.max(0, Math.round(Number(payload.startedAtMs)))
      : completedAtMs,
    scheduledAtMs: Number.isFinite(Number(payload.scheduledAtMs))
      ? Math.max(0, Math.round(Number(payload.scheduledAtMs)))
      : 0,
    acceptedIntentCount: Number.isFinite(Number(payload.acceptedIntentCount))
      ? Math.max(0, Math.round(Number(payload.acceptedIntentCount)))
      : 0,
    deferredIntentCount: Number.isFinite(Number(payload.deferredIntentCount))
      ? Math.max(0, Math.round(Number(payload.deferredIntentCount)))
      : 0,
    rejectedIntentCount: Number.isFinite(Number(payload.rejectedIntentCount))
      ? Math.max(0, Math.round(Number(payload.rejectedIntentCount)))
      : 0,
    isRetry: payload.isRetry === true,
  };
}

async function loadReflectionRunHistoryFromLogs({ maxEntries = 64, maxFiles = 14 } = {}) {
  const logDir = getReflectionLogDirectoryPath();
  if (!logDir || !fs.existsSync(logDir)) return [];
  let entries = [];
  try {
    const files = (await fs.promises.readdir(logDir))
      .filter((entry) => typeof entry === "string" && entry.toLowerCase().endsWith(".md"))
      .sort((left, right) => right.localeCompare(left))
      .slice(0, Math.max(1, Math.round(Number(maxFiles) || 14)));

    for (const filename of files) {
      const absolutePath = path.join(logDir, filename);
      let text = "";
      try {
        text = await fs.promises.readFile(absolutePath, "utf8");
      } catch {
        continue;
      }
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        const parsed = parseReflectionRunHistoryLine(line);
        if (parsed) {
          entries.push(parsed);
        }
      }
    }
  } catch {
    return [];
  }

  entries = entries
    .sort((left, right) => left.completedAtMs - right.completedAtMs)
    .slice(-Math.max(1, Math.round(Number(maxEntries) || 64)));
  return entries;
}

async function rehydrateReflectionRuntimeFromLogs(trigger = "startup") {
  const history = await loadReflectionRunHistoryFromLogs();
  applyRunHistoryEntries(reflectionRuntimeState, history, Date.now());
  reflectionRuntimeState.runtimeReason =
    history.length > 0 ? `${trigger}_rehydrated` : `${trigger}_no_history`;
  refreshReflectionRuntimeSnapshot();
  return {
    ok: true,
    historyCount: history.length,
  };
}

function getReflectionRouteForCycle(cycleId) {
  const normalizedCycleId = normalizeCycleId(cycleId);
  return normalizedCycleId === REFLECTION_CYCLE_IDS.digest
    ? REFLECTION_ROUTES.digest
    : REFLECTION_ROUTES.heartbeat;
}

function getReflectionObservationTypeForCycle(cycleId) {
  const normalizedCycleId = normalizeCycleId(cycleId);
  return normalizedCycleId === REFLECTION_CYCLE_IDS.digest
    ? REFLECTION_DIGEST_OBSERVATION_TYPE
    : REFLECTION_HEARTBEAT_OBSERVATION_TYPE;
}

function buildReflectionRequestPrompt(cycleId) {
  const normalizedCycleId = normalizeCycleId(cycleId);
  if (normalizedCycleId === REFLECTION_CYCLE_IDS.digest) {
    return (
      "Generate bounded nightly memory summary intents from current derived context. " +
      "Use virtual_pet.memory.sync_intent only, keep summaries concise, and avoid direct identity mutation requests."
    );
  }
  return (
    "Generate bounded hourly reflection intents from current derived context. " +
    "Use virtual_pet.memory.sync_intent only, keep summaries concise, and avoid direct identity mutation requests."
  );
}

function buildReflectionRequestContext(cycleId) {
  const personaContext = refreshPersonaSnapshotCache({
    recordExportMode: "online_reflection",
  });
  const memorySnapshot =
    latestMemorySnapshot ||
    (memoryPipeline && typeof memoryPipeline.getSnapshot === "function"
      ? memoryPipeline.getSnapshot()
      : null) ||
    {};
  const stateSummary = summarizeDialogStateContext();
  const memorySummary = [
    `adapter=${asOptionalString(memorySnapshot?.activeAdapterMode, "unknown") || "unknown"}`,
    `fallback=${asOptionalString(memorySnapshot?.fallbackReason, "none") || "none"}`,
    `openclaw=${buildRuntimeSettingsSummary()?.openclaw?.enabled ? "enabled" : "disabled"}`,
  ].join(" ");

  if (latestMemorySnapshot && typeof latestMemorySnapshot === "object") {
    emitMemorySnapshot(latestMemorySnapshot);
  }

  return {
    currentState: deriveBridgeCurrentState(),
    stateContextSummary: truncateBridgeDialogText(`${stateSummary} | ${memorySummary}`, 320),
    activePropsSummary: truncateBridgeDialogText(buildActivePropsSummary(), 180),
    extensionContextSummary: truncateBridgeDialogText(buildExtensionContextSummary(), 180),
    recentDialogSummary: "",
    recentDialogTurns: [],
    personaExport: personaContext.personaExport,
    source: deriveContractSource(),
    reflectionCycle: normalizeCycleId(cycleId),
  };
}

function isReflectionRetryEligibleReason(reason) {
  const normalized = asOptionalString(reason, "unknown") || "unknown";
  return (
    normalized === "bridge_timeout" ||
    normalized === "bridge_unavailable" ||
    normalized === "bridge_auth_required" ||
    normalized === "bridge_non_loopback_disabled" ||
    normalized === "bridge_config_invalid"
  );
}

async function recordReflectionRunObservation(entry = {}) {
  if (!memoryPipeline || typeof memoryPipeline.recordObservation !== "function") {
    return {
      ok: false,
      error: "memory_pipeline_unavailable",
    };
  }
  const nowMs = Date.now();
  const cycleId = normalizeCycleId(entry.cycleId);
  const outcome = asOptionalString(entry.outcome, REFLECTION_OUTCOMES.suppressed) || REFLECTION_OUTCOMES.suppressed;
  const reason = asOptionalString(entry.reason, "none") || "none";
  const observation = {
    observationType: REFLECTION_LOG_OBSERVATION_TYPE,
    source: REFLECTION_ROUTER_SOURCE,
    correlationId: asOptionalString(entry.correlationId, "n/a") || "n/a",
    evidenceTag: `${cycleId}:${outcome}`.slice(0, 64),
    payload: {
      schemaVersion: REFLECTION_RUNTIME_SCHEMA,
      cycleId,
      outcome,
      reason,
      trigger: asOptionalString(entry.trigger, "schedule") || "schedule",
      route: asOptionalString(entry.route, getReflectionRouteForCycle(cycleId)) || getReflectionRouteForCycle(cycleId),
      startedAtMs: Number.isFinite(Number(entry.startedAtMs))
        ? Math.max(0, Math.round(Number(entry.startedAtMs)))
        : nowMs,
      completedAtMs: Number.isFinite(Number(entry.completedAtMs))
        ? Math.max(0, Math.round(Number(entry.completedAtMs)))
        : nowMs,
      scheduledAtMs: Number.isFinite(Number(entry.scheduledAtMs))
        ? Math.max(0, Math.round(Number(entry.scheduledAtMs)))
        : 0,
      acceptedIntentCount: Number.isFinite(Number(entry.acceptedIntentCount))
        ? Math.max(0, Math.round(Number(entry.acceptedIntentCount)))
        : 0,
      deferredIntentCount: Number.isFinite(Number(entry.deferredIntentCount))
        ? Math.max(0, Math.round(Number(entry.deferredIntentCount)))
        : 0,
      rejectedIntentCount: Number.isFinite(Number(entry.rejectedIntentCount))
        ? Math.max(0, Math.round(Number(entry.rejectedIntentCount)))
        : 0,
      proposedActionCount: Number.isFinite(Number(entry.proposedActionCount))
        ? Math.max(0, Math.round(Number(entry.proposedActionCount)))
        : 0,
      isRetry: entry.isRetry === true,
      summary: truncateReflectionSummaryText(entry.summary, 180),
      retryEligible: entry.retryEligible === true,
    },
  };
  return memoryPipeline.recordObservation(observation);
}

function isReflectionIntentConflict({ summary = "", context = {} } = {}) {
  const normalizedSummary = asOptionalString(summary, "")?.toLowerCase() || "";
  const targetSection = asOptionalString(context?.targetSection, "");
  if (targetSection) return true;
  if (context?.mutationRequested === true) return true;
  if (context?.requestType === "identity_mutation") return true;
  if (
    normalizedSummary.includes("immutable core") ||
    normalizedSummary.includes("identity.md") ||
    normalizedSummary.includes("soul.md")
  ) {
    return true;
  }
  return false;
}

function getExpectedReflectionIntentType(cycleId) {
  const normalizedCycleId = normalizeCycleId(cycleId, REFLECTION_CYCLE_IDS.heartbeat);
  return normalizedCycleId === REFLECTION_CYCLE_IDS.digest
    ? "memory_summary_request"
    : "memory_reflection_request";
}

function isReflectionIntentTypeAllowedForCycle(cycleId, intentType) {
  const expectedIntentType = getExpectedReflectionIntentType(cycleId);
  const normalizedIntentType =
    asOptionalString(intentType, expectedIntentType) || expectedIntentType;
  return normalizedIntentType === expectedIntentType;
}

async function submitReflectionMemorySyncIntent(intent = {}) {
  const context = intent?.context && typeof intent.context === "object" ? intent.context : {};
  const contextSource = asOptionalString(context.source, "") || "";
  const reflectionToken = asOptionalString(context.reflectionToken, null);
  if (
    contextSource !== REFLECTION_CONTEXT_SOURCE ||
    !reflectionToken ||
    !reflectionContextTokens.has(reflectionToken)
  ) {
    return {
      result: OPENCLAW_PLUGIN_SKILL_RESULT_STATES.deferred,
      reason: "memory_sync_reflection_only",
    };
  }

  if (!memoryPipeline || typeof memoryPipeline.recordObservation !== "function") {
    return {
      result: OPENCLAW_PLUGIN_SKILL_RESULT_STATES.deferred,
      reason: "memory_pipeline_unavailable",
    };
  }

  const cycleId = normalizeCycleId(context.reflectionCycleId, REFLECTION_CYCLE_IDS.heartbeat);
  const expectedIntentType = getExpectedReflectionIntentType(cycleId);
  const intentType =
    asOptionalString(intent.intentType, expectedIntentType) || expectedIntentType;
  if (!isReflectionIntentTypeAllowedForCycle(cycleId, intentType)) {
    return {
      result: OPENCLAW_PLUGIN_SKILL_RESULT_STATES.rejected,
      reason: "reflection_intent_type_mismatch",
      cycleId,
      intentType,
      expectedIntentType,
    };
  }
  const summary = asOptionalString(intent.summary, "") || "";
  if (isReflectionIntentConflict({ summary, context })) {
    return {
      result: OPENCLAW_PLUGIN_SKILL_RESULT_STATES.rejected,
      reason: "local_guard_conflict",
      cycleId,
      intentType,
    };
  }

  const observationType = getReflectionObservationTypeForCycle(cycleId);
  const observationOutcome = await memoryPipeline.recordObservation({
    observationType,
    source: REFLECTION_ROUTER_SOURCE,
    correlationId: asOptionalString(intent.correlationId, "n/a") || "n/a",
    evidenceTag: `${cycleId}:${intentType}`.slice(0, 64),
    payload: {
      schemaVersion: REFLECTION_INTENT_SCHEMA,
      cycleId,
      intentId: asOptionalString(intent.intentId, "intent-unknown") || "intent-unknown",
      intentType,
      summary: truncateReflectionSummaryText(summary, 240),
      trigger: asOptionalString(context.reflectionTrigger, "schedule") || "schedule",
    },
  });
  if (!observationOutcome?.ok) {
    return {
      result: OPENCLAW_PLUGIN_SKILL_RESULT_STATES.deferred,
      reason: asOptionalString(observationOutcome?.error, "memory_observation_failed") || "memory_observation_failed",
      cycleId,
      intentType,
    };
  }

  let promotionOutcome = null;
  if (
    intentType === "memory_summary_request" &&
    typeof memoryPipeline.evaluatePromotionCandidate === "function"
  ) {
    promotionOutcome = await memoryPipeline.evaluatePromotionCandidate({
      candidateType: "online_reflection_summary",
      focusObservationType: observationType,
    });
  }

  refreshPersonaSnapshotCache({
    recordExportMode: "online_reflection",
  });
  refreshReflectionRuntimeSnapshot();

  return {
    result: OPENCLAW_PLUGIN_SKILL_RESULT_STATES.accepted,
    reason: "reflection_intent_applied",
    cycleId,
    intentType,
    observationPath: observationOutcome?.targetPath || null,
    promotionDecisionId: promotionOutcome?.decision?.decisionId || null,
  };
}

function buildReflectionLaneCall(callPayload = {}, cycleId, trigger, reflectionToken) {
  const payload = callPayload && typeof callPayload === "object" ? callPayload : {};
  const innerPayload = payload.payload && typeof payload.payload === "object" ? payload.payload : {};
  const innerContext =
    innerPayload.context && typeof innerPayload.context === "object" ? innerPayload.context : {};
  return {
    contractVersion:
      asOptionalString(payload.contractVersion, OPENCLAW_PLUGIN_SKILL_CONTRACT_VERSION) ||
      OPENCLAW_PLUGIN_SKILL_CONTRACT_VERSION,
    call: asOptionalString(payload.call, OPENCLAW_PLUGIN_SKILL_CALL_IDS.memorySyncIntent),
    correlationId: asOptionalString(payload.correlationId, createContractCorrelationId()) || createContractCorrelationId(),
    payload: {
      ...innerPayload,
      context: {
        ...innerContext,
        source: REFLECTION_CONTEXT_SOURCE,
        reflectionToken,
        reflectionCycleId: normalizeCycleId(cycleId),
        reflectionTrigger: asOptionalString(trigger, "schedule") || "schedule",
      },
    },
  };
}

async function runReflectionCycle({
  cycleId,
  trigger = "schedule",
  scheduledAtMs = 0,
  isRetry = false,
} = {}) {
  const normalizedCycleId = normalizeCycleId(cycleId);
  const nowMs = Date.now();
  if (reflectionRuntimeState.inFlight) {
    const suppressedAtMs = Date.now();
    const suppressedEntry = {
      cycleId: normalizedCycleId,
      outcome: REFLECTION_OUTCOMES.suppressed,
      reason: "suppressed_in_flight",
      trigger,
      route: getReflectionRouteForCycle(normalizedCycleId),
      correlationId: createReflectionCorrelationId(normalizedCycleId),
      startedAtMs: suppressedAtMs,
      completedAtMs: suppressedAtMs,
      scheduledAtMs: Number.isFinite(Number(scheduledAtMs))
        ? Math.max(0, Math.round(Number(scheduledAtMs)))
        : 0,
      acceptedIntentCount: 0,
      deferredIntentCount: 0,
      rejectedIntentCount: 0,
      proposedActionCount: 0,
      isRetry: Boolean(isRetry),
      retryEligible: false,
      summary: "",
    };
    await recordReflectionRunObservation(suppressedEntry);
    return {
      ok: false,
      ...suppressedEntry,
    };
  }
  const correlationId = createReflectionCorrelationId(normalizedCycleId);
  const route = getReflectionRouteForCycle(normalizedCycleId);

  markRunStarted(reflectionRuntimeState, {
    cycleId: normalizedCycleId,
    nowMs,
    correlationId,
    isRetry: Boolean(isRetry),
  });
  refreshReflectionRuntimeSnapshot();

  let outcome = REFLECTION_OUTCOMES.suppressed;
  let reason = "unknown";
  let retryEligible = false;
  let acceptedIntentCount = 0;
  let deferredIntentCount = 0;
  let rejectedIntentCount = 0;
  let proposedActionCount = 0;
  let responseSummary = "";

  try {
    const settingsSummary = buildRuntimeSettingsSummary();
    if (!settingsSummary?.openclaw?.enabled) {
      outcome = REFLECTION_OUTCOMES.suppressed;
      reason = "openclaw_disabled";
    } else if (!memoryPipeline) {
      outcome = REFLECTION_OUTCOMES.suppressed;
      reason = "memory_pipeline_unavailable";
    } else if (!openclawBridge || typeof openclawBridge.sendDialog !== "function") {
      outcome = REFLECTION_OUTCOMES.failed;
      reason = "bridge_unavailable_runtime";
      retryEligible = true;
    } else {
      const bridgeResult = await requestWithTimeout(
        openclawBridge.sendDialog({
          correlationId,
          route,
          promptText: buildReflectionRequestPrompt(normalizedCycleId),
          context: buildReflectionRequestContext(normalizedCycleId),
        }),
        getBridgeRequestTimeoutMs()
      );
      const responseText = asOptionalString(bridgeResult?.response?.text, "");
      responseSummary = truncateReflectionSummaryText(responseText, 180);
      const proposedActions = Array.isArray(bridgeResult?.response?.proposedActions)
        ? bridgeResult.response.proposedActions
        : [];
      proposedActionCount = proposedActions.length;
      const laneCalls = extractVirtualPetLaneCallPayloads(proposedActions);
      const reflectionToken = createReflectionContextToken(normalizedCycleId);
      reflectionContextTokens.add(reflectionToken);
      let acceptedSummaryChars = 0;
      try {
        for (const callPayload of laneCalls) {
          if (acceptedIntentCount >= REFLECTION_MAX_INTENTS_PER_CYCLE) {
            rejectedIntentCount += 1;
            continue;
          }
          if (
            asOptionalString(callPayload?.call, "") !==
            OPENCLAW_PLUGIN_SKILL_CALL_IDS.memorySyncIntent
          ) {
            rejectedIntentCount += 1;
            continue;
          }
          const expectedIntentType = getExpectedReflectionIntentType(normalizedCycleId);
          const laneIntentType =
            asOptionalString(callPayload?.payload?.intentType, expectedIntentType) ||
            expectedIntentType;
          if (!isReflectionIntentTypeAllowedForCycle(normalizedCycleId, laneIntentType)) {
            rejectedIntentCount += 1;
            continue;
          }
          const summaryText = asOptionalString(callPayload?.payload?.summary, "") || "";
          if (acceptedSummaryChars + summaryText.length > REFLECTION_MAX_ACCEPTED_SUMMARY_CHARS) {
            rejectedIntentCount += 1;
            continue;
          }
          const laneOutcome = await executeOpenClawPluginSkillLaneCall(
            buildReflectionLaneCall(callPayload, normalizedCycleId, trigger, reflectionToken),
            correlationId
          );
          if (laneOutcome?.result === OPENCLAW_PLUGIN_SKILL_RESULT_STATES.accepted) {
            acceptedIntentCount += 1;
            acceptedSummaryChars += summaryText.length;
          } else if (laneOutcome?.result === OPENCLAW_PLUGIN_SKILL_RESULT_STATES.deferred) {
            deferredIntentCount += 1;
          } else {
            rejectedIntentCount += 1;
          }
        }
      } finally {
        reflectionContextTokens.delete(reflectionToken);
      }
      outcome = REFLECTION_OUTCOMES.success;
      reason = "request_success";
    }
  } catch (error) {
    outcome = REFLECTION_OUTCOMES.failed;
    reason = asOptionalString(error?.code, "bridge_unavailable") || "bridge_unavailable";
    retryEligible = isReflectionRetryEligibleReason(reason);
  }

  const completedAtMs = Date.now();
  markRunCompleted(reflectionRuntimeState, {
    cycleId: normalizedCycleId,
    outcome,
    reason,
    nowMs: completedAtMs,
    startedAtMs: nowMs,
    scheduledAtMs: Number.isFinite(Number(scheduledAtMs))
      ? Math.max(0, Math.round(Number(scheduledAtMs)))
      : 0,
    acceptedIntentCount,
    deferredIntentCount,
    rejectedIntentCount,
    isRetry: Boolean(isRetry),
    retryEligible,
  });
  refreshReflectionRuntimeSnapshot();

  const runEntry = {
    cycleId: normalizedCycleId,
    outcome,
    reason,
    trigger,
    route,
    correlationId,
    startedAtMs: nowMs,
    completedAtMs,
    scheduledAtMs: Number.isFinite(Number(scheduledAtMs))
      ? Math.max(0, Math.round(Number(scheduledAtMs)))
      : 0,
    acceptedIntentCount,
    deferredIntentCount,
    rejectedIntentCount,
    proposedActionCount,
    isRetry: Boolean(isRetry),
    retryEligible,
    summary: responseSummary,
  };
  await recordReflectionRunObservation(runEntry);
  refreshReflectionRuntimeSnapshot();
  return {
    ok: outcome === REFLECTION_OUTCOMES.success,
    ...runEntry,
  };
}

async function runReflectionSchedulerTick(trigger = "interval") {
  const nowMs = Date.now();
  const due = selectDueCycle(reflectionRuntimeState, nowMs);
  if (!due) return null;

  if (reflectionRuntimeState.inFlight) {
    const cycleId = normalizeCycleId(due.cycleId);
    markCycleSuppressedInFlight(reflectionRuntimeState, {
      cycleId,
      nowMs,
      reason: "suppressed_in_flight",
    });
    refreshReflectionRuntimeSnapshot();
    await recordReflectionRunObservation({
      cycleId,
      outcome: REFLECTION_OUTCOMES.suppressed,
      reason: "suppressed_in_flight",
      trigger,
      route: getReflectionRouteForCycle(cycleId),
      correlationId: createReflectionCorrelationId(cycleId),
      startedAtMs: nowMs,
      completedAtMs: nowMs,
      scheduledAtMs: due.dueAtMs,
      acceptedIntentCount: 0,
      deferredIntentCount: 0,
      rejectedIntentCount: 0,
      proposedActionCount: 0,
      isRetry: due.isRetry === true,
      retryEligible: false,
    });
    refreshReflectionRuntimeSnapshot();
    return {
      ok: false,
      cycleId,
      outcome: REFLECTION_OUTCOMES.suppressed,
      reason: "suppressed_in_flight",
      trigger,
    };
  }

  return runReflectionCycle({
    cycleId: due.cycleId,
    trigger,
    scheduledAtMs: due.dueAtMs,
    isRetry: due.isRetry === true,
  });
}

function startReflectionScheduler() {
  if (reflectionSchedulerTimer) {
    clearInterval(reflectionSchedulerTimer);
    reflectionSchedulerTimer = null;
  }
  refreshReflectionRuntimeSnapshot();
  void runReflectionSchedulerTick("startup").catch((error) => {
    console.warn(`[pet-reflection] startup tick failed: ${error?.message || String(error)}`);
  });
  reflectionSchedulerTimer = setInterval(() => {
    void runReflectionSchedulerTick("interval").catch((error) => {
      console.warn(`[pet-reflection] interval tick failed: ${error?.message || String(error)}`);
    });
  }, REFLECTION_SCHEDULER_TICK_MS);
}

function normalizeUserCommandForBridge(payload) {
  const rawPayload = payload && typeof payload === "object" ? payload : {};
  const explicitType =
    typeof rawPayload.type === "string" ? rawPayload.type.trim().toLowerCase() : "";
  const command = typeof rawPayload.command === "string" ? rawPayload.command.trim().toLowerCase() : "";
  const text = typeof rawPayload.text === "string" ? rawPayload.text.trim().toLowerCase() : "";
  const raw = (explicitType || command || text).replace(/[?!.,]+$/g, "");
  if (raw === "status" || raw === "introspect") return "status";
  if (raw === "what are you doing") return "what-are-you-doing";
  if (raw === "what are you reading") return "what-are-you-reading";
  if (raw === "announce-test" || raw === "announce") return "announce-test";
  if (raw === "bridge-test" || raw === "bridge") return "bridge-test";
  if (raw === "guardrail-test" || raw === "guardrail") return "guardrail-test";
  return raw || "unknown";
}

function extractUserInputText(payload) {
  const rawPayload = payload && typeof payload === "object" ? payload : {};
  if (typeof rawPayload.text === "string" && rawPayload.text.trim().length > 0) {
    return rawPayload.text.trim();
  }
  if (typeof rawPayload.command === "string" && rawPayload.command.trim().length > 0) {
    return rawPayload.command.trim();
  }
  if (typeof rawPayload.type === "string" && rawPayload.type.trim().length > 0) {
    return rawPayload.type.trim();
  }
  return "";
}

function normalizeDialogPromptForVariation(text) {
  if (typeof text !== "string") return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[?!.,]+$/g, "");
}

function buildOfflineDialogVariationKey(promptText) {
  const normalizedPrompt = normalizeDialogPromptForVariation(promptText);
  if (!normalizedPrompt) return "repeat:0|petTurns:0";
  let promptRepeatCount = 0;
  let petTurnCount = 0;
  for (const entry of dialogHistory) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.role === "pet") {
      petTurnCount += 1;
      continue;
    }
    if (entry.role !== "user") continue;
    const entryPrompt = normalizeDialogPromptForVariation(entry.text);
    if (entryPrompt === normalizedPrompt) {
      promptRepeatCount += 1;
    }
  }
  return `repeat:${promptRepeatCount}|petTurns:${petTurnCount}`;
}

function deriveContractSource() {
  if (!runtimeSettings?.openclaw?.enabled) {
    return "offline";
  }
  const bridgeState = capabilityRegistry?.getCapabilityState(CAPABILITY_IDS.openclawBridge);
  if (bridgeState?.state === CAPABILITY_STATES.healthy) {
    return "online";
  }
  return "offline";
}

function summarizeShellAccessories() {
  const accessories = latestShellState?.wardrobe?.activeAccessories || [];
  return accessories.length > 0 ? accessories.join(",") : "none";
}

function summarizeShellQuickProps() {
  const quickProps = latestShellState?.inventory?.quickProps || [];
  return quickProps.length > 0 ? quickProps.join(",") : "none";
}

function buildStatusText() {
  const runtime = latestCapabilitySnapshot?.runtimeState || "unknown";
  const summary = latestCapabilitySnapshot?.summary || {};
  const spotifyState =
    capabilityRegistry?.getCapabilityState(CAPABILITY_IDS.spotifyIntegration)?.state || "unknown";
  const freshRssState =
    capabilityRegistry?.getCapabilityState(CAPABILITY_IDS.freshRssIntegration)?.state || "unknown";
  const activeState = latestStateSnapshot?.currentState || "Idle";
  const activePhase = latestStateSnapshot?.phase ? `/${latestStateSnapshot.phase}` : "";
  const activeVisual = latestStateSnapshot?.visual?.clip || "IdleReady";
  const fallbackLabel = latestStateSnapshot?.visualFallbackUsed ? "yes" : "no";
  const motionState = dragging ? "dragging" : flingState.active ? "flinging" : "steady";
  const roamMode = latestShellState?.roaming?.mode || ROAMING_MODES.desktop;
  const roamZone = getRoamZoneLabel(latestShellState);
  const diagnosticsLabel = latestShellState?.ui?.diagnosticsEnabled ? "on" : "off";
  return (
    `Runtime ${runtime}. ` +
    `Capabilities healthy=${summary.healthyCount || 0}, ` +
    `degraded=${summary.degradedCount || 0}, failed=${summary.failedCount || 0}. ` +
    `Integrations spotify=${spotifyState}, freshrss=${freshRssState}. ` +
    `Shell roam=${roamMode}${roamMode === ROAMING_MODES.zone ? `:${roamZone}` : ""} diagnostics=${diagnosticsLabel} accessories=${summarizeShellAccessories()} props=${summarizeShellQuickProps()}. ` +
    `State ${activeState}${activePhase} visual=${activeVisual} fallback=${fallbackLabel} motion=${motionState}.`
  );
}

function deriveBridgeCurrentState() {
  return latestStateSnapshot?.currentState || "Idle";
}

function buildActivePropsSummary() {
  const summaries = [];
  const quickProps = latestShellState?.inventory?.quickProps || [];
  if (quickProps.length > 0) {
    summaries.push(`shell:${quickProps.join("+")}`);
  }
  if (!latestExtensionSnapshot || !Array.isArray(latestExtensionSnapshot.extensions)) {
    return summaries.length > 0 ? summaries.join(", ").slice(0, 180) : "none";
  }
  for (const extension of latestExtensionSnapshot.extensions) {
    if (!extension?.valid || !extension?.enabled || !Array.isArray(extension.props)) continue;
    const enabledProps = extension.props.filter((prop) => prop?.enabled).length;
    if (enabledProps <= 0) continue;
    summaries.push(`${extension.extensionId}:${enabledProps}`);
  }
  if (summaries.length <= 0) return "none";
  return summaries.join(", ").slice(0, 180);
}

function buildExtensionContextSummary() {
  const summary = latestExtensionSnapshot?.summary || {};
  return (
    `discovered=${summary.discoveredCount || 0}, ` +
    `valid=${summary.validCount || 0}, enabled=${summary.enabledCount || 0}`
  );
}

function normalizeDialogRoleForBridge(value) {
  if (value === "user") return "user";
  if (value === "pet") return "pet";
  return null;
}

function truncateBridgeDialogText(text, maxLength = BRIDGE_RECENT_DIALOG_TEXT_LIMIT) {
  if (typeof text !== "string") return "";
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 3))}...`;
}

function buildRecentDialogTurnsForBridge() {
  const turns = [];
  for (let index = dialogHistory.length - 1; index >= 0; index -= 1) {
    if (turns.length >= BRIDGE_RECENT_DIALOG_TURNS_LIMIT) break;
    const entry = dialogHistory[index];
    const role = normalizeDialogRoleForBridge(entry?.role);
    if (!role) continue;
    const text = truncateBridgeDialogText(entry?.text, BRIDGE_RECENT_DIALOG_TEXT_LIMIT);
    if (!text) continue;
    const source =
      typeof entry?.source === "string" && entry.source.trim().length > 0
        ? entry.source.trim().slice(0, 24)
        : role === "user"
          ? "local_ui"
          : "offline";
    turns.push({
      role,
      text,
      source,
    });
  }
  return turns.reverse();
}

function buildRecentDialogSummaryForBridge(turns) {
  if (!Array.isArray(turns) || turns.length <= 0) return "";
  const summary = turns.map((turn) => `${turn.role}: ${turn.text}`).join(" | ");
  if (summary.length <= BRIDGE_RECENT_DIALOG_SUMMARY_LIMIT) return summary;
  return `${summary.slice(0, Math.max(1, BRIDGE_RECENT_DIALOG_SUMMARY_LIMIT - 3))}...`;
}

function buildBridgeRequestContext(route = "dialog_user_command") {
  const recentDialogTurns = buildRecentDialogTurnsForBridge();
  const shouldAttachPersonaExport = route === "dialog_user_message";
  const personaContext = refreshPersonaSnapshotCache({
    recordExportMode: shouldAttachPersonaExport ? "online_dialog" : null,
  });
  if (latestMemorySnapshot && typeof latestMemorySnapshot === "object") {
    emitMemorySnapshot(latestMemorySnapshot);
  }
  return {
    currentState: deriveBridgeCurrentState(),
    stateContextSummary: latestStateSnapshot?.contextSummary || buildStatusText(),
    activePropsSummary: buildActivePropsSummary(),
    extensionContextSummary: buildExtensionContextSummary(),
    recentDialogSummary: buildRecentDialogSummaryForBridge(recentDialogTurns),
    recentDialogTurns,
    personaExport: shouldAttachPersonaExport ? personaContext.personaExport : null,
    source: deriveContractSource(),
  };
}

function summarizeDialogStateContext() {
  const summary = latestStateSnapshot?.contextSummary || buildStatusText();
  if (typeof summary !== "string" || summary.length <= 0) return "none";
  return summary.slice(0, 180);
}

function buildRecentMediaSummary() {
  if (latestLocalMediaSnapshot?.isPlaying) {
    const title =
      typeof latestLocalMediaSnapshot.title === "string" && latestLocalMediaSnapshot.title.trim().length > 0
        ? latestLocalMediaSnapshot.title.trim()
        : "unknown track";
    const artist =
      typeof latestLocalMediaSnapshot.artist === "string" && latestLocalMediaSnapshot.artist.trim().length > 0
        ? latestLocalMediaSnapshot.artist.trim()
        : "unknown artist";
    const sourceLabel =
      typeof latestLocalMediaSnapshot.sourceAppLabel === "string" &&
      latestLocalMediaSnapshot.sourceAppLabel.trim().length > 0
        ? latestLocalMediaSnapshot.sourceAppLabel.trim()
        : "Windows Media";
    const route =
      typeof latestLocalMediaSnapshot.outputRoute === "string" &&
      latestLocalMediaSnapshot.outputRoute.trim().length > 0
        ? latestLocalMediaSnapshot.outputRoute.trim()
        : "unknown";
    return `${title} by ${artist} via ${sourceLabel} (${route})`.slice(0, 180);
  }
  if (typeof latestIntegrationEvent?.text === "string" && latestIntegrationEvent.text.trim().length > 0) {
    return latestIntegrationEvent.text.trim().slice(0, 180);
  }
  return "no active media";
}

function buildRecentHobbySummary() {
  if (latestStateSnapshot?.currentState === "Reading") {
    const title =
      typeof latestStateSnapshot?.context?.title === "string" && latestStateSnapshot.context.title.trim().length > 0
        ? latestStateSnapshot.context.title.trim()
        : typeof latestStateSnapshot?.context?.titleLabel === "string" &&
            latestStateSnapshot.context.titleLabel.trim().length > 0
          ? latestStateSnapshot.context.titleLabel.trim()
          : "current reading item";
    const sourceLabel =
      typeof latestStateSnapshot?.context?.sourceLabel === "string" &&
      latestStateSnapshot.context.sourceLabel.trim().length > 0
        ? latestStateSnapshot.context.sourceLabel.trim()
        : typeof latestStateSnapshot?.context?.itemType === "string" &&
            latestStateSnapshot.context.itemType.trim().length > 0
          ? latestStateSnapshot.context.itemType.trim()
          : "reading";
    return `${title} from ${sourceLabel}`.slice(0, 180);
  }
  if (
    latestIntegrationEvent?.kind === "freshRssProbe" &&
    typeof latestIntegrationEvent.summary === "string" &&
    latestIntegrationEvent.summary.trim().length > 0
  ) {
    return latestIntegrationEvent.summary.trim().slice(0, 180);
  }
  if (
    latestIntegrationEvent?.kind === "freshRssProbe" &&
    typeof latestIntegrationEvent.text === "string" &&
    latestIntegrationEvent.text.trim().length > 0
  ) {
    return latestIntegrationEvent.text.trim().slice(0, 180);
  }
  return "no recent hobby updates";
}

function normalizeOfflineQuestionPrompt(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isOfflineQuestionNoMatchPrompt(promptText) {
  const normalized = normalizeOfflineQuestionPrompt(promptText);
  if (!normalized) return false;
  if (normalized.includes("?")) return true;
  return /^(who|what|when|where|why|how|do|does|did|is|are|am|can|could|would|should|will|have|has)\b/.test(
    normalized
  );
}

function buildOfflineQuestionNoMatchResponse(promptText, fallbackMode) {
  const normalized = normalizeOfflineQuestionPrompt(promptText);
  let seed = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    seed = (seed * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  const templates = [
    "I couldn't find that answer in offline memory yet. Ask about my name, nickname, birthday, or what happened recently between us.",
    "I don't have a local memory match for that yet. I can answer identity basics and recent highlights.",
    "That isn't in my offline recall yet. Try asking for my name, birthday, nickname, or recent highlights.",
  ];
  return {
    source: "offline",
    text: templates[seed % templates.length],
    fallbackMode: "offline_question_no_match",
    triggerReason: "question_no_match",
    templateKey: "no_match",
    currentState: latestStateSnapshot?.currentState || "Idle",
    phase: latestStateSnapshot?.phase || null,
    stateContextSummary: summarizeDialogStateContext(),
  };
}

function buildOfflineDialogFallback(promptText, fallbackMode) {
  const memorySnapshot =
    (memoryPipeline && typeof memoryPipeline.getSnapshot === "function"
      ? memoryPipeline.getSnapshot()
      : null) ||
    latestMemorySnapshot ||
    null;
  const runtimeObservations =
    memoryPipeline && typeof memoryPipeline.getRecentObservations === "function"
      ? memoryPipeline.getRecentObservations({ limit: 24 })
      : [];
  const recallResult = buildOfflineRecallResult({
    promptText,
    workspaceRoot:
      memorySnapshot?.localWorkspaceRoot || runtimeSettingsResolvedPaths?.localRoot || __dirname,
    runtimeObservations,
    memoryDir: memorySnapshot?.paths?.memoryDir || "",
    memoryAvailable: Boolean(memoryPipeline),
    ts: Date.now(),
  });
  if (recallResult) {
    recordOfflineRecallSnapshot(recallResult);
    return recallResult;
  }

  const triggerReason = classifyOfflineDialogTrigger(promptText);
  const preferReading =
    triggerReason === "reading" || latestStateSnapshot?.currentState === "Reading";
  const stateDescription = preferReading
    ? stateRuntime?.describeReading?.()
    : stateRuntime?.describeActivity?.();
  const fallbackText =
    stateDescription?.text ||
    (preferReading
      ? buildBridgeFallbackText("state_description", "what-are-you-reading")
      : buildBridgeFallbackText("state_description", "what-are-you-doing"));
  const personaSnapshot = getCurrentPersonaSnapshotForOffline();
  const personaFallback = buildPersonaAwareOfflineFallbackResponse({
    promptText,
    ts: Date.now(),
    personaSnapshot,
    variationKey: buildOfflineDialogVariationKey(promptText),
    currentState: latestStateSnapshot?.currentState || "Idle",
    phase: latestStateSnapshot?.phase || null,
    stateDescription: fallbackText,
    stateContextSummary: summarizeDialogStateContext(),
    recentMediaSummary: buildRecentMediaSummary(),
    recentHobbySummary: buildRecentHobbySummary(),
  });
  recordOfflinePersonaReplySnapshot(personaFallback);
  if (personaFallback && typeof personaFallback === "object") {
    return {
      ...personaFallback,
      fallbackMode:
        typeof personaFallback.fallbackMode === "string" && personaFallback.fallbackMode.length > 0
          ? personaFallback.fallbackMode
          : fallbackMode,
    };
  }
  return buildOfflineDialogResponse({
    templates: dialogTemplateCatalog,
    text: promptText,
    currentState: latestStateSnapshot?.currentState || "Idle",
    phase: latestStateSnapshot?.phase || null,
    triggerReason,
    source: "offline",
    fallbackMode,
    stateDescription: fallbackText,
    stateContextSummary: summarizeDialogStateContext(),
    recentMediaSummary: buildRecentMediaSummary(),
    recentHobbySummary: buildRecentHobbySummary(),
  });
}

function createDialogMessageId() {
  const randomPart = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0");
  return `dlg-${Date.now().toString(36)}-${randomPart}`;
}

function appendDialogHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  dialogHistory = [...dialogHistory, entry].slice(-DIALOG_HISTORY_LIMIT);
  return entry;
}

function emitDialogMessage(entry) {
  if (!entry || typeof entry !== "object") return;
  emitToRenderer("pet:dialog-message", entry);
}

function recordDialogUserMessage({ correlationId, text }) {
  const normalizedText = typeof text === "string" ? text.trim() : "";
  if (!normalizedText) return null;
  const entry = appendDialogHistoryEntry({
    messageId: createDialogMessageId(),
    correlationId,
    role: "user",
    kind: "userMessage",
    channel: "dialog",
    source: "local_ui",
    text: normalizedText,
    fallbackMode: "none",
    talkFeedbackMode: "none",
    stateContextSummary: summarizeDialogStateContext(),
    currentState: latestStateSnapshot?.currentState || "Idle",
    phase: latestStateSnapshot?.phase || null,
    ts: Date.now(),
  });
  emitDialogMessage(entry);
  return entry;
}

function recordDialogSuggestion(suggestion) {
  if (!suggestion || typeof suggestion !== "object") return null;
  if (suggestion.type !== "PET_RESPONSE" && suggestion.type !== "PET_ANNOUNCEMENT") return null;
  const text = typeof suggestion.text === "string" ? suggestion.text.trim() : "";
  if (!text) return null;

  const entry = appendDialogHistoryEntry({
    messageId: createDialogMessageId(),
    correlationId:
      typeof suggestion.correlationId === "string" && suggestion.correlationId.length > 0
        ? suggestion.correlationId
        : createContractCorrelationId(),
    role: "pet",
    kind: suggestion.type === "PET_ANNOUNCEMENT" ? "announcement" : "response",
    channel:
      typeof suggestion.channel === "string" && suggestion.channel.trim().length > 0
        ? suggestion.channel.trim()
        : "bubble",
    source:
      typeof suggestion.source === "string" && suggestion.source.trim().length > 0
        ? suggestion.source.trim()
        : "offline",
    text,
    fallbackMode:
      typeof suggestion.fallbackMode === "string" && suggestion.fallbackMode.trim().length > 0
        ? suggestion.fallbackMode.trim()
        : "none",
    recallType:
      typeof suggestion.recallType === "string" && suggestion.recallType.trim().length > 0
        ? suggestion.recallType.trim()
        : null,
    recallDegradedReason:
      typeof suggestion.recallDegradedReason === "string" &&
      suggestion.recallDegradedReason.trim().length > 0
        ? suggestion.recallDegradedReason.trim()
        : null,
    recallEvidenceTags: Array.isArray(suggestion.recallEvidenceTags)
      ? suggestion.recallEvidenceTags
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter((entry) => entry.length > 0)
          .slice(0, 6)
      : [],
    personaIntent:
      typeof suggestion.personaIntent === "string" && suggestion.personaIntent.trim().length > 0
        ? suggestion.personaIntent.trim()
        : null,
    personaState:
      typeof suggestion.personaState === "string" && suggestion.personaState.trim().length > 0
        ? suggestion.personaState.trim()
        : null,
    personaReason:
      typeof suggestion.personaReason === "string" && suggestion.personaReason.trim().length > 0
        ? suggestion.personaReason.trim()
        : null,
    personaMode:
      typeof suggestion.personaMode === "string" && suggestion.personaMode.trim().length > 0
        ? suggestion.personaMode.trim()
        : null,
    talkFeedbackMode: DIALOG_TALK_FEEDBACK_MODE,
    stateContextSummary: summarizeDialogStateContext(),
    currentState: latestStateSnapshot?.currentState || "Idle",
    phase: latestStateSnapshot?.phase || null,
    ts: Number.isFinite(suggestion.ts) ? suggestion.ts : Date.now(),
  });
  emitDialogMessage(entry);
  return entry;
}

function buildBridgeFallbackText(route, promptText) {
  if (route === "introspection_status") {
    return `${buildStatusText()} (offline fallback)`;
  }
  if (route === "state_description") {
    const readingMatch = typeof promptText === "string" && promptText.toLowerCase().includes("reading");
    const description = readingMatch
      ? stateRuntime?.describeReading()
      : stateRuntime?.describeActivity();
    return description?.text || "I am keeping to a safe local fallback.";
  }
  const normalizedPrompt =
    typeof promptText === "string" && promptText.trim().length > 0 ? promptText.trim() : "your request";
  return `Bridge unavailable. Local fallback response for "${normalizedPrompt}".`;
}

function blockBridgeActions(actions, correlationId) {
  if (!Array.isArray(actions) || actions.length <= 0) return [];
  const blockedActionTypes = new Set(["set_state", "render_control", "identity_mutation"]);
  const blocked = [];
  for (const action of actions) {
    const actionType =
      typeof action?.type === "string" ? action.type.trim().toLowerCase() : "unknown";
    if (!blockedActionTypes.has(actionType)) continue;
    blocked.push(actionType);
    console.warn(
      `[pet-openclaw] blocked-action correlationId=${correlationId} action=${actionType} reason=non_authority_guardrail`
    );
    if (DIAGNOSTICS_ENABLED) {
      emitDiagnostics({
        kind: "openclawBlockedAction",
        correlationId,
        actionType,
        reason: "non_authority_guardrail",
      });
    }
  }
  return blocked;
}

function extractPetCommandRequestPayloads(actions) {
  if (!Array.isArray(actions) || actions.length <= 0) return [];
  const requests = [];
  for (const action of actions) {
    if (!action || typeof action !== "object") continue;
    const actionType =
      typeof action.type === "string" ? action.type.trim().toLowerCase() : "";
    const route = typeof action.route === "string" ? action.route.trim().toLowerCase() : "";
    if (actionType !== "pet_command_request" && route !== "pet_command_request") continue;
    if (action.payload && typeof action.payload === "object") {
      requests.push(action.payload);
      continue;
    }
    requests.push(action);
  }
  return requests;
}

function extractVirtualPetLaneCallPayloads(actions) {
  if (!Array.isArray(actions) || actions.length <= 0) return [];
  const calls = [];
  for (const action of actions) {
    if (!action || typeof action !== "object") continue;
    const actionType =
      typeof action.type === "string" ? action.type.trim().toLowerCase() : "";
    const route = typeof action.route === "string" ? action.route.trim().toLowerCase() : "";
    if (actionType !== OPENCLAW_PLUGIN_SKILL_ACTION_ID && route !== OPENCLAW_PLUGIN_SKILL_ACTION_ID) continue;
    if (action.payload && typeof action.payload === "object") {
      calls.push(action.payload);
      continue;
    }
    calls.push(action);
  }
  return calls;
}

async function executeOpenClawPetCommandRequest(rawPayload, correlationId) {
  if (!openclawPetCommandLane || typeof openclawPetCommandLane.processEnvelope !== "function") {
    return {
      ok: false,
      accepted: false,
      reason: PET_COMMAND_REJECT_REASONS.authSecretMissing,
      correlationId,
    };
  }
  return openclawPetCommandLane.processEnvelope(rawPayload, {
    correlationId,
  });
}

async function executeOpenClawPluginSkillLaneCall(rawPayload, correlationId) {
  if (!openclawPluginSkillLane || typeof openclawPluginSkillLane.processCall !== "function") {
    return {
      ok: false,
      result: "rejected",
      reason: OPENCLAW_PLUGIN_SKILL_REJECT_REASONS.transportUnavailable,
      correlationId,
    };
  }
  return openclawPluginSkillLane.processCall(rawPayload, {
    correlationId,
  });
}

async function processBridgePetCommandRequests(actions, correlationId) {
  const requests = extractPetCommandRequestPayloads(actions);
  if (requests.length <= 0) return [];
  const outcomes = [];
  for (const requestPayload of requests) {
    const outcome = await executeOpenClawPetCommandRequest(requestPayload, correlationId);
    outcomes.push(outcome);
  }
  return outcomes;
}

async function processBridgeVirtualPetLaneCalls(actions, correlationId) {
  const calls = extractVirtualPetLaneCallPayloads(actions);
  if (calls.length <= 0) return [];
  const outcomes = [];
  for (const callPayload of calls) {
    const outcome = await executeOpenClawPluginSkillLaneCall(callPayload, correlationId);
    outcomes.push(outcome);
  }
  return outcomes;
}

function buildBridgeActionFeedbackSuffix(blockedActions, commandOutcomes, pluginLaneOutcomes) {
  const blocked =
    Array.isArray(blockedActions) && blockedActions.length > 0
      ? `Blocked actions: ${blockedActions.join(", ")}.`
      : "";
  if (!Array.isArray(commandOutcomes) || commandOutcomes.length <= 0) {
    return blocked;
  }
  const accepted = commandOutcomes
    .filter((entry) => entry?.accepted)
    .map((entry) => entry.actionId)
    .filter((value) => typeof value === "string" && value.length > 0);
  const rejected = commandOutcomes
    .filter((entry) => !entry?.accepted)
    .map((entry) => entry.reason)
    .filter((value) => typeof value === "string" && value.length > 0);
  const segments = [];
  if (blocked) segments.push(blocked);
  if (accepted.length > 0) {
    segments.push(`Command lane accepted: ${accepted.join(", ")}.`);
  }
  if (rejected.length > 0) {
    segments.push(`Command lane rejected: ${rejected.join(", ")}.`);
  }
  if (Array.isArray(pluginLaneOutcomes) && pluginLaneOutcomes.length > 0) {
    const pluginAccepted = pluginLaneOutcomes
      .filter((entry) => entry?.result === "accepted")
      .map((entry) => entry.call)
      .filter((value) => typeof value === "string" && value.length > 0);
    const pluginDeferred = pluginLaneOutcomes
      .filter((entry) => entry?.result === "deferred")
      .map((entry) => entry.reason)
      .filter((value) => typeof value === "string" && value.length > 0);
    const pluginRejected = pluginLaneOutcomes
      .filter((entry) => entry?.result === "rejected")
      .map((entry) => entry.reason)
      .filter((value) => typeof value === "string" && value.length > 0);
    if (pluginAccepted.length > 0) {
      segments.push(`Plugin lane accepted: ${pluginAccepted.join(", ")}.`);
    }
    if (pluginDeferred.length > 0) {
      segments.push(`Plugin lane deferred: ${pluginDeferred.join(", ")}.`);
    }
    if (pluginRejected.length > 0) {
      segments.push(`Plugin lane rejected: ${pluginRejected.join(", ")}.`);
    }
  }
  return segments.join(" ").trim();
}

async function requestBridgeDialog({ correlationId, route, promptText }) {
  const gate = evaluateOpenClawDialogGate({
    settings: runtimeSettings,
    bridge: openclawBridge,
  });
  if (!gate.allowed) {
    console.log(
      `[pet-openclaw] skipped correlationId=${correlationId} route=${route} reason=${gate.fallbackMode}`
    );
    return {
      source: "offline",
      text: buildBridgeFallbackText(route, promptText),
      fallbackMode: gate.fallbackMode,
    };
  }

  try {
    const outcome = await requestWithTimeout(
      openclawBridge.sendDialog({
        correlationId,
        route,
        promptText,
        context: buildBridgeRequestContext(route),
      }),
      getBridgeRequestTimeoutMs()
    );

    const proposedActions = Array.isArray(outcome?.response?.proposedActions)
      ? outcome.response.proposedActions
      : [];
    const blockedActions = blockBridgeActions(proposedActions, correlationId);
    const commandOutcomes = await processBridgePetCommandRequests(proposedActions, correlationId);
    const pluginLaneOutcomes = await processBridgeVirtualPetLaneCalls(proposedActions, correlationId);
    const actionFeedbackSuffix = buildBridgeActionFeedbackSuffix(
      blockedActions,
      commandOutcomes,
      pluginLaneOutcomes
    );
    updateCapabilityState(
      CAPABILITY_IDS.openclawBridge,
      CAPABILITY_STATES.healthy,
      "requestSuccess",
      {
        mode: openclawBridge.getMode(),
        route,
      }
    );
    refreshIntegrationCapabilityStates();

    return {
      source: outcome?.response?.source || "online",
      text: `${outcome?.response?.text || "OpenClaw response unavailable."}${
        actionFeedbackSuffix ? ` ${actionFeedbackSuffix}` : ""
      }`.trim(),
      fallbackMode: "none",
    };
  } catch (error) {
    const fallbackMode = error?.code || "bridge_unavailable";
    const reason = fallbackMode === "bridge_timeout" ? "requestTimeout" : "requestFailed";
    updateCapabilityState(
      CAPABILITY_IDS.openclawBridge,
      CAPABILITY_STATES.degraded,
      reason,
      {
        mode: openclawBridge.getMode(),
        route,
        fallbackMode,
      }
    );
    refreshIntegrationCapabilityStates();
    console.warn(
      `[pet-openclaw] fallback correlationId=${correlationId} route=${route} reason=${fallbackMode}`
    );
    return {
      source: "offline",
      text: buildBridgeFallbackText(route, promptText),
      fallbackMode,
    };
  }
}

async function buildUserInputContext(eventType, payload, correlationId) {
  const normalizedCommand = normalizeUserCommandForBridge(payload);
  const inputText = extractUserInputText(payload);
  const isGenericUserMessage =
    eventType === "USER_MESSAGE" &&
    normalizedCommand !== "status" &&
    normalizedCommand !== "bridge-test" &&
    normalizedCommand !== "guardrail-test";
  if (normalizedCommand === "announce-test" || normalizedCommand === "unknown") {
    return {};
  }
  if (normalizedCommand === "what-are-you-doing" || normalizedCommand === "what-are-you-reading") {
    const description =
      normalizedCommand === "what-are-you-reading"
        ? stateRuntime?.describeReading()
        : stateRuntime?.describeActivity();
    return {
      source: "offline",
      stateDescriptionText: description?.text || buildBridgeFallbackText("state_description", normalizedCommand),
      bridgeFallbackMode: description?.fallbackUsed ? "state_context_fallback" : "state_local",
    };
  }
  if (
    normalizedCommand !== "status" &&
    normalizedCommand !== "bridge-test" &&
    normalizedCommand !== "guardrail-test" &&
    !isGenericUserMessage
  ) {
    return {};
  }

  const route =
    normalizedCommand === "status"
      ? "introspection_status"
      : isGenericUserMessage
        ? "dialog_user_message"
        : "dialog_user_command";
  const promptText = inputText || normalizedCommand;
  const bridgeResult = await requestBridgeDialog({
    correlationId,
    route,
    promptText,
  });

  if (normalizedCommand === "status") {
    return {
      source: bridgeResult.source,
      statusText: bridgeResult.text,
      bridgeFallbackMode: bridgeResult.fallbackMode,
    };
  }

  if (isGenericUserMessage && bridgeResult.source !== "online") {
    const offlineResult = buildOfflineDialogFallback(promptText, bridgeResult.fallbackMode);
    const recallContext =
      offlineResult?.kind === "offlineRecallResult"
        ? {
            recallType: offlineResult.recallType || "unknown",
            degradedReason: offlineResult.degradedReason || "none",
            evidenceTags: Array.isArray(offlineResult.evidenceTags)
              ? offlineResult.evidenceTags.slice(0, 6)
              : [],
          }
        : null;
    const personaContext =
      offlineResult?.kind === "offlinePersonaReply"
        ? {
            intent:
              typeof offlineResult.intent === "string" && offlineResult.intent.trim().length > 0
                ? offlineResult.intent.trim()
                : "unknown",
            personaState:
              typeof offlineResult.personaState === "string" &&
              offlineResult.personaState.trim().length > 0
                ? offlineResult.personaState.trim()
                : "degraded",
            personaReason:
              typeof offlineResult.personaReason === "string" &&
              offlineResult.personaReason.trim().length > 0
                ? offlineResult.personaReason.trim()
                : "parse_incomplete",
            personaMode:
              typeof offlineResult.personaMode === "string" &&
              offlineResult.personaMode.trim().length > 0
                ? offlineResult.personaMode.trim()
                : "neutral_fallback",
          }
        : null;
    return {
      source: offlineResult.source,
      bridgeDialogText: offlineResult.text,
      bridgeFallbackMode: offlineResult.fallbackMode,
      bridgeDialogRecall: recallContext,
      bridgeDialogPersona: personaContext,
    };
  }

  return {
    source: bridgeResult.source,
    bridgeDialogText: bridgeResult.text,
    bridgeFallbackMode: bridgeResult.fallbackMode,
  };
}

function extractFirstResponseSuggestion(result) {
  if (!result || !Array.isArray(result.suggestions)) return null;
  return (
    result.suggestions.find((suggestion) => suggestion?.type === "PET_RESPONSE") || null
  );
}

function createMemoryObservationFromContractResult(eventType, payload, result, correlationId) {
  if (eventType === "USER_COMMAND" || eventType === "USER_MESSAGE") {
    const inputText = extractUserInputText(payload);
    const normalizedInput =
      typeof inputText === "string" && inputText.trim().length > 0
        ? inputText.trim().toLowerCase()
        : "unknown";
    const responseSuggestion = extractFirstResponseSuggestion(result);
    return {
      observationType: "question_response",
      source: eventType === "USER_MESSAGE" ? "contract_user_message" : "contract_user_command",
      correlationId,
      evidenceTag: normalizedInput.replace(/\s+/g, "-").slice(0, 80),
      payload: {
        inputType: eventType,
        command: eventType === "USER_COMMAND" ? normalizedInput : null,
        text: inputText || "",
        responseText: responseSuggestion?.text || "",
        responseSource: responseSuggestion?.source || "offline",
        suggestionTypes: Array.isArray(result?.suggestions)
          ? result.suggestions.map((entry) => entry?.type || "unknown")
          : [],
      },
    };
  }

  if (eventType === "EXT_PROP_INTERACTED") {
    const extensionId =
      typeof payload?.extensionId === "string" && payload.extensionId.trim().length > 0
        ? payload.extensionId.trim()
        : "unknown_extension";
    const propId =
      typeof payload?.propId === "string" && payload.propId.trim().length > 0
        ? payload.propId.trim()
        : "unknown_prop";
    return {
      observationType: "hobby_summary",
      source: "extension_prop_interaction",
      correlationId,
      evidenceTag: `${extensionId}:${propId}`,
      payload: {
        extensionId,
        propId,
        interactionType:
          typeof payload?.interactionType === "string" && payload.interactionType.trim().length > 0
            ? payload.interactionType.trim()
            : "click",
      },
    };
  }

  if (eventType === "MEDIA") {
    const title =
      typeof payload?.title === "string" && payload.title.trim().length > 0
        ? payload.title.trim()
        : "unknown_track";
    const artist =
      typeof payload?.artist === "string" && payload.artist.trim().length > 0
        ? payload.artist.trim()
        : "unknown_artist";
    const provider =
      typeof payload?.provider === "string" && payload.provider.trim().length > 0
        ? payload.provider.trim()
        : "media";
    return {
      observationType: provider === "spotify" ? "spotify_playback" : "media_playback",
      source: `${provider}_playback`,
      correlationId,
      evidenceTag: `${provider}:${title}`.toLowerCase().replace(/\s+/g, "-"),
      payload: {
        playing: Boolean(payload?.playing),
        confidence: Number.isFinite(Number(payload?.confidence))
          ? Number(payload.confidence)
          : 0,
        title,
        artist,
        album:
          typeof payload?.album === "string" && payload.album.trim().length > 0
            ? payload.album.trim()
            : "unknown_album",
        provider,
        suggestedState:
          typeof payload?.suggestedState === "string" && payload.suggestedState.trim().length > 0
            ? payload.suggestedState.trim()
            : "MusicChill",
        mediaSource:
          typeof payload?.source === "string" && payload.source.trim().length > 0
            ? payload.source.trim()
            : "media",
        outputRoute:
          typeof payload?.outputRoute === "string" && payload.outputRoute.trim().length > 0
            ? payload.outputRoute.trim()
            : "unknown",
        sourceAppLabel:
          typeof payload?.sourceAppLabel === "string" && payload.sourceAppLabel.trim().length > 0
            ? payload.sourceAppLabel.trim()
            : "Windows Media",
        fallbackMode:
          typeof payload?.fallbackMode === "string" && payload.fallbackMode.trim().length > 0
            ? payload.fallbackMode.trim()
            : "none",
        topArtistSummary:
          payload?.topArtistSummary && typeof payload.topArtistSummary === "object"
            ? payload.topArtistSummary
            : null,
      },
    };
  }

  if (eventType === "FRESHRSS_ITEMS") {
    const fallbackMode =
      typeof payload?.fallbackMode === "string" && payload.fallbackMode.trim().length > 0
        ? payload.fallbackMode.trim()
        : "none";
    if (fallbackMode !== "none") {
      return null;
    }
    const items = Array.isArray(payload?.items) ? payload.items.slice(0, 5) : [];
    return {
      observationType: "freshrss_summary",
      source: "openclaw_freshrss_probe",
      correlationId,
      evidenceTag:
        items.length > 0 && typeof items[0]?.source === "string" && items[0].source.trim().length > 0
          ? items[0].source.trim().toLowerCase().replace(/\s+/g, "-")
          : "freshrss",
      payload: {
        summary:
          typeof payload?.summary === "string" && payload.summary.trim().length > 0
            ? payload.summary.trim()
            : "FreshRSS summary unavailable.",
        items,
        fallbackMode,
      },
    };
  }

  return null;
}

function queueMemoryObservation(observation) {
  if (!memoryPipeline || !observation) return;
  void memoryPipeline
    .recordObservation(observation)
    .then((outcome) => {
      if (!outcome?.ok) return;
      refreshPersonaSnapshotCache();
      if (latestMemorySnapshot && typeof latestMemorySnapshot === "object") {
        emitMemorySnapshot(latestMemorySnapshot);
      }
      emitToRenderer("pet:memory", {
        kind: "observationWritten",
        observationType: outcome.observation?.observationType || "unknown",
        source: outcome.observation?.source || "local",
        targetPath: outcome.targetPath || null,
        adapterMode: outcome.adapterMode || latestMemorySnapshot?.activeAdapterMode || "local",
        ts: Date.now(),
      });
    })
    .catch((error) => {
      console.warn(`[pet-memory] observation write failed: ${error?.message || String(error)}`);
    });
}

function normalizeSuggestedStateId(value, fallback = "MusicChill") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function applyMediaSuggestedState(payload = {}) {
  if (!stateRuntime) return null;
  const suggestedStateId = normalizeSuggestedStateId(payload.suggestedState, "MusicChill");
  if (suggestedStateId === "WatchMode") {
    const mediaWatchSnapshot = routeMediaWatchModeToBottomEdge(payload, Date.now());
    if (mediaWatchSnapshot) {
      return mediaWatchSnapshot;
    }
    return latestStateSnapshot || stateRuntime.getSnapshot();
  }

  if (suggestedStateId === "MusicDance") {
    return stateRuntime.applyMusicState({
      ...payload,
      suggestedState: "MusicDance",
      durationMs: MUSIC_DANCE_DURATION_MS,
      onCompleteStateId: "Idle",
    });
  }

  return stateRuntime.applyMusicState({
    ...payload,
    suggestedState:
      suggestedStateId === "MusicDance" || suggestedStateId === "MusicChill"
        ? suggestedStateId
        : "MusicChill",
  });
}

function applyStateRuntimeForEvent(eventType, payload, result) {
  if (!stateRuntime) return null;
  if (eventType === "MEDIA") {
    const intent = Array.isArray(result?.intents)
      ? result.intents.find((entry) => entry?.type === "INTENT_STATE_MUSIC_MODE")
      : null;
    if (!intent) return null;
    return applyMediaSuggestedState({
      ...payload,
      suggestedState: normalizeSuggestedStateId(
        payload?.suggestedState,
        normalizeSuggestedStateId(intent?.payload?.suggestedState, "MusicChill")
      ),
    });
  }
  return null;
}

function handleContractSuggestions(result) {
  if (!result || !Array.isArray(result.suggestions)) return;
  for (const suggestion of result.suggestions) {
    emitToRenderer("pet:contract-suggestion", suggestion);
    recordDialogSuggestion(suggestion);
    if (DIAGNOSTICS_ENABLED) {
      emitDiagnostics({
        kind: "contractSuggestion",
        ...suggestion,
      });
    }
    if (suggestion.type === "PET_ANNOUNCEMENT") {
      console.log(
        `[pet-contract] announcement correlationId=${suggestion.correlationId} reason=${suggestion.reason}`
      );
    }
    if (suggestion.type === "PET_ANNOUNCEMENT_SKIPPED") {
      console.log(
        `[pet-contract] announcement-skipped correlationId=${suggestion.correlationId} reason=${suggestion.reason} skipReason=${suggestion.skipReason}`
      );
    }
    if (suggestion.type === "PET_RESPONSE") {
      const text =
        typeof suggestion.text === "string" && suggestion.text.length > 0
          ? suggestion.text.slice(0, 120)
          : "";
      console.log(
        `[pet-contract] response correlationId=${suggestion.correlationId} mode=${suggestion.mode || "text"} text="${text}"`
      );
    }
  }
}

async function processPetContractEvent(eventType, payload = {}, context = {}) {
  if (!contractRouter) {
    return {
      ok: false,
      error: "contract_router_unavailable",
    };
  }

  const correlationId =
    typeof context?.correlationId === "string" && context.correlationId.length > 0
      ? context.correlationId
      : createContractCorrelationId();
  if (eventType === "USER_COMMAND" || eventType === "USER_MESSAGE") {
    recordProactiveEngagement(eventType === "USER_MESSAGE" ? "user_message" : "user_command", Date.now());
  }
  const bridgeContext =
    eventType === "USER_COMMAND" || eventType === "USER_MESSAGE"
      ? await buildUserInputContext(eventType, payload, correlationId)
      : {};
  const result = contractRouter.processEvent(
    {
      type: eventType,
      payload,
      correlationId,
    },
    {
      source: deriveContractSource(),
      statusText: buildStatusText(),
      announcementCooldownMsByReason: {
        manual_test: 5000,
      },
      ...bridgeContext,
      ...context,
    }
  );
  applyStateRuntimeForEvent(eventType, payload, result);
  handleContractSuggestions(result);
  queueMemoryObservation(
    createMemoryObservationFromContractResult(eventType, payload, result, correlationId)
  );
  return result;
}

async function probeSpotifyIntegration(options = {}) {
  const settings = buildRuntimeSettingsSummary();
  const correlationId = createContractCorrelationId();
  const nowMs = Date.now();
  const routeContractEvent = options.routeContractEvent !== false;
  const queueObservation = options.queueObservation !== false;
  const preferredOutputContext = options.preferredOutputContext || getPreferredSpotifyOutputContext();

  if (!settings.openclaw.enabled || !settings.integrations.spotify.enabled) {
    const reason = !settings.integrations.spotify.enabled ? "disabledByConfig" : "openclawDisabledFallback";
    setIntegrationProbeState("spotify", {
      state: "degraded",
      reason,
      fallbackMode: reason,
      lastProbeAt: nowMs,
      lastFailureAt: nowMs,
      error: reason,
    });
    const integrationEvent = {
      kind: "spotifyProbe",
      correlationId,
      provider: "spotify",
      fallbackMode: reason,
      source: "offline",
      capabilityState: "degraded",
      text: "Spotify probe is unavailable because integration or OpenClaw is disabled.",
      ts: nowMs,
    };
    emitIntegrationEvent(integrationEvent);
    return {
      ok: false,
      error: reason,
      probe: integrationEvent,
    };
  }

  if (!settings.integrations.spotify.available) {
    setIntegrationProbeState("spotify", {
      state: "degraded",
      reason: "providerUnavailable",
      fallbackMode: "spotify_provider_unavailable",
      lastProbeAt: nowMs,
      lastFailureAt: nowMs,
      error: "provider unavailable by config",
    });
    const integrationEvent = {
      kind: "spotifyProbe",
      correlationId,
      provider: "spotify",
      fallbackMode: "spotify_provider_unavailable",
      source: "offline",
      capabilityState: "degraded",
      text: "Spotify probe is configured unavailable.",
      ts: nowMs,
    };
    emitIntegrationEvent(integrationEvent);
    return {
      ok: false,
      error: "providerUnavailable",
      probe: integrationEvent,
    };
  }

  const degradedParts = [];
  let nowPlaying = null;
  let topArtistSummary = null;

  try {
    const nowPlayingProbe = await runAgentProbeWithJson(
      buildSpotifyNowPlayingPrompt(),
      "spotify-now-playing"
    );
    if (nowPlayingProbe.ok) {
      nowPlaying = applyPreferredOutputContext(
        normalizeSpotifyNowPlayingPayload(nowPlayingProbe.json),
        preferredOutputContext
      );
    } else {
      degradedParts.push(`now_playing=${nowPlayingProbe.failure.reason}`);
    }
  } catch (error) {
    degradedParts.push(`now_playing=${detectAgentFailure("", error).reason}`);
  }

  try {
    const topArtistProbe = await runAgentProbeWithJson(
      buildSpotifyTopArtistPrompt(),
      "spotify-top-artist"
    );
    if (topArtistProbe.ok) {
      topArtistSummary = normalizeSpotifyTopArtistPayload(topArtistProbe.json);
    } else {
      degradedParts.push(`top_artist=${topArtistProbe.failure.reason}`);
    }
  } catch (error) {
    degradedParts.push(`top_artist=${detectAgentFailure("", error).reason}`);
  }

  const succeeded = Boolean(nowPlaying && topArtistSummary);
  const fallbackMode = succeeded ? "none" : degradedParts[0] || "spotify_probe_failed";
  const responseText = buildSpotifyProbeResponseText(nowPlaying, topArtistSummary, degradedParts);

  if (succeeded) {
    setIntegrationProbeState("spotify", {
      state: "healthy",
      reason: "probeHealthy",
      fallbackMode: "none",
      lastProbeAt: nowMs,
      lastSuccessAt: nowMs,
      error: null,
    });
  } else {
    setIntegrationProbeState("spotify", {
      state: "degraded",
      reason: fallbackMode,
      fallbackMode,
      lastProbeAt: nowMs,
      lastFailureAt: nowMs,
      error: responseText,
    });
  }

  const mediaSuggestion = nowPlaying
    ? deriveMediaPlaybackSuggestion({
        isPlaying: Boolean(nowPlaying.isPlaying),
        provider: "spotify",
        sourceAppLabel: latestLocalMediaSnapshot?.sourceAppLabel || "Spotify",
        title: nowPlaying.trackName || "",
        artist: nowPlaying.artistName || "",
        album: nowPlaying.albumName || "",
        outputRoute: nowPlaying.outputRoute || "unknown",
      })
    : null;

  const mediaEventPayload = nowPlaying
    ? {
        playing: Boolean(nowPlaying.isPlaying),
        confidence: succeeded ? 0.98 : 0.8,
        provider: "spotify",
        source: "spotify",
        title: nowPlaying.trackName,
        artist: nowPlaying.artistName,
        album: nowPlaying.albumName,
        suggestedState: mediaSuggestion?.suggestedState || "MusicChill",
        mediaKind: mediaSuggestion?.mediaKind || "music",
        mediaKindReason: mediaSuggestion?.reason || "spotify_music",
        activeProp:
          nowPlaying.outputRoute === "speaker"
            ? "speaker"
            : nowPlaying.outputRoute === "headphones"
              ? "headphones"
              : "musicNote",
        outputRoute: nowPlaying.outputRoute || "unknown",
        outputDeviceName: nowPlaying.outputDeviceName || "unknown_device",
        outputDeviceType: nowPlaying.outputDeviceType || "unknown",
        sourceAppLabel: latestLocalMediaSnapshot?.sourceAppLabel || "Spotify",
        entryDialogue: responseText,
        fallbackMode,
        topArtistSummary,
      }
    : null;

  let contractResult = null;
  if (mediaEventPayload && routeContractEvent) {
    contractResult = await processPetContractEvent(
      "MEDIA",
      mediaEventPayload,
      {
        correlationId,
        source: succeeded ? "online" : "offline",
        mediaResponseText: responseText,
        mediaSuggestedState: mediaEventPayload.suggestedState || "MusicChill",
        integrationFallbackMode: fallbackMode,
      }
    );
  } else if (mediaEventPayload && queueObservation) {
    queueMemoryObservation(
      createMemoryObservationFromContractResult("MEDIA", mediaEventPayload, null, correlationId)
    );
  }

  const integrationEvent = {
    kind: "spotifyProbe",
    correlationId,
    provider: "spotify",
    nowPlaying,
    topArtistSummary,
    fallbackMode,
    source: succeeded ? "online" : "offline",
    capabilityState: succeeded ? "healthy" : "degraded",
    outputRoute: nowPlaying?.outputRoute || "unknown",
    outputDeviceName: nowPlaying?.outputDeviceName || "unknown_device",
    degradedParts,
    trigger:
      typeof options.trigger === "string" && options.trigger.trim().length > 0
        ? options.trigger.trim()
        : routeContractEvent
          ? "interactive"
          : "background",
    text: responseText,
    ts: nowMs,
  };
  console.log(
    `[pet-integration] spotify probe correlationId=${correlationId} state=${integrationEvent.capabilityState} fallback=${fallbackMode}`
  );
  emitIntegrationEvent(integrationEvent);
  return {
    ok: succeeded,
    correlationId,
    probe: integrationEvent,
    contractResult,
  };
}

async function probeFreshRssIntegration(options = {}) {
  const settings = buildRuntimeSettingsSummary();
  const correlationId = createContractCorrelationId();
  const nowMs = Date.now();
  const routeContractEvent = options.routeContractEvent !== false;
  const queueObservation = options.queueObservation !== false;

  if (!settings.openclaw.enabled || !settings.integrations.freshRss.enabled) {
    const reason = !settings.integrations.freshRss.enabled ? "disabledByConfig" : "openclawDisabledFallback";
    setIntegrationProbeState("freshRss", {
      state: "degraded",
      reason,
      fallbackMode: reason,
      lastProbeAt: nowMs,
      lastFailureAt: nowMs,
      error: reason,
    });
    const integrationEvent = {
      kind: "freshRssProbe",
      correlationId,
      provider: "freshRss",
      fallbackMode: reason,
      source: "offline",
      capabilityState: "degraded",
      text: "FreshRSS probe is unavailable because integration or OpenClaw is disabled.",
      ts: nowMs,
    };
    emitIntegrationEvent(integrationEvent);
    return {
      ok: false,
      error: reason,
      probe: integrationEvent,
    };
  }

  if (!settings.integrations.freshRss.available) {
    setIntegrationProbeState("freshRss", {
      state: "degraded",
      reason: "providerUnavailable",
      fallbackMode: "freshrss_provider_unavailable",
      lastProbeAt: nowMs,
      lastFailureAt: nowMs,
      error: "provider unavailable by config",
    });
    const integrationEvent = {
      kind: "freshRssProbe",
      correlationId,
      provider: "freshRss",
      fallbackMode: "freshrss_provider_unavailable",
      source: "offline",
      capabilityState: "degraded",
      text: "FreshRSS probe is configured unavailable.",
      ts: nowMs,
    };
    emitIntegrationEvent(integrationEvent);
    return {
      ok: false,
      error: "providerUnavailable",
      probe: integrationEvent,
    };
  }

  let normalized = null;
  let failure = null;
  try {
    const probe = await runAgentProbeWithJson(buildFreshRssPrompt(), "freshrss-latest");
    if (probe.ok) {
      normalized = normalizeFreshRssPayload(probe.json);
      failure = detectFreshRssPayloadFailure(normalized);
    } else {
      failure = probe.failure;
    }
  } catch (error) {
    failure = detectAgentFailure("", error);
  }

  const succeeded = Boolean(
    normalized &&
      !failure &&
      (normalized.items.length > 0 || normalized.summary === "FreshRSS returned no recent items.")
  );
  const fallbackMode = succeeded ? "none" : failure?.reason || "freshrss_probe_failed";
  const responseText = buildFreshRssResponseText(
    normalized?.summary || "",
    normalized?.items || [],
    succeeded ? null : failure?.reason || "probe failed",
    succeeded ? null : failure?.message || null
  );

  if (succeeded) {
    setIntegrationProbeState("freshRss", {
      state: "healthy",
      reason: "probeHealthy",
      fallbackMode: "none",
      lastProbeAt: nowMs,
      lastSuccessAt: nowMs,
      error: null,
    });
  } else {
    setIntegrationProbeState("freshRss", {
      state: "degraded",
      reason: fallbackMode,
      fallbackMode,
      lastProbeAt: nowMs,
      lastFailureAt: nowMs,
      error: failure?.message || responseText,
    });
  }

  const freshRssEventPayload = normalized
    ? {
        summary: normalized.summary,
        items: normalized.items,
        fallbackMode,
      }
    : null;

  let contractResult = null;
  if (freshRssEventPayload && routeContractEvent) {
    contractResult = await processPetContractEvent(
      "FRESHRSS_ITEMS",
      freshRssEventPayload,
      {
        correlationId,
        source: succeeded ? "online" : "offline",
        freshRssResponseText: responseText,
      }
    );
  } else if (freshRssEventPayload && queueObservation) {
    queueMemoryObservation(
      createMemoryObservationFromContractResult(
        "FRESHRSS_ITEMS",
        freshRssEventPayload,
        null,
        correlationId
      )
    );
  }
  if (routeContractEvent && succeeded && normalized?.items?.length > 0 && stateRuntime) {
    stateRuntime.applyFreshRssReading({
      items: normalized.items,
    });
  }

  const integrationEvent = {
    kind: "freshRssProbe",
    correlationId,
    provider: "freshRss",
    summary: normalized?.summary || null,
    items: normalized?.items || [],
    fallbackMode,
    source: succeeded ? "online" : "offline",
    capabilityState: succeeded ? "healthy" : "degraded",
    trigger:
      typeof options.trigger === "string" && options.trigger.trim().length > 0
        ? options.trigger.trim()
        : routeContractEvent
          ? "interactive"
          : "background",
    text: responseText,
    ts: nowMs,
  };
  console.log(
    `[pet-integration] freshrss probe correlationId=${correlationId} state=${integrationEvent.capabilityState} fallback=${fallbackMode}`
  );
  emitIntegrationEvent(integrationEvent);
  return {
    ok: succeeded,
    correlationId,
    probe: integrationEvent,
    contractResult,
  };
}

async function runBackgroundSpotifyEnrichment(snapshot, trigger = "background-local-media") {
  const settings = buildRuntimeSettingsSummary();
  if (!settings.openclaw.enabled || !settings.integrations.spotify.enabled) return null;
  if (!settings.integrations.spotify.available) return null;
  if (!settings.integrations.spotify.backgroundEnrichmentEnabled) return null;
  if (!snapshot?.isPlaying || snapshot.provider !== "spotify") return null;
  if (spotifyBackgroundProbeInFlight) return null;
  const nowMs = Date.now();
  if (nowMs - lastSpotifyBackgroundProbeAt < getSpotifyBackgroundPollCadenceMs()) {
    return null;
  }

  spotifyBackgroundProbeInFlight = true;
  lastSpotifyBackgroundProbeAt = nowMs;
  try {
    return await probeSpotifyIntegration({
      routeContractEvent: false,
      queueObservation: true,
      preferredOutputContext: snapshot,
      trigger,
    });
  } finally {
    spotifyBackgroundProbeInFlight = false;
  }
}

async function pollLocalMediaState(options = {}) {
  const sensorSettings = getLocalMediaSensorSettings();
  const force = options.force === true;
  const trigger = typeof options.trigger === "string" ? options.trigger : "interval";
  const correlationId = createContractCorrelationId();
  const previousSnapshot = latestLocalMediaSnapshot || createInitialLocalMediaSnapshot();

  if (!sensorSettings.enabled) {
    const disabledSnapshot = createInitialLocalMediaSnapshot();
    disabledSnapshot.playbackStatus = "Disabled";
    disabledSnapshot.error = "disabled_by_config";
    latestLocalMediaSnapshot = disabledSnapshot;
    localMediaLastPlayingAtMs = 0;
    localMediaStoppedSinceMs = 0;
    localMediaPendingStopFromPlaying = false;
    lastLocalMediaContractSignature = null;
    lastLocalMediaEventKey = null;
    if (force) {
      emitIntegrationEvent(buildLocalMediaIntegrationEvent(disabledSnapshot, { correlationId }));
    }
    return {
      ok: false,
      error: "disabled_by_config",
      snapshot: disabledSnapshot,
    };
  }

  if (localMediaProbeInFlight) {
    return {
      ok: false,
      skipped: true,
      error: "probe_in_flight",
      snapshot: previousSnapshot,
    };
  }

  localMediaProbeInFlight = true;
  try {
    const snapshot = await probeWindowsMediaState({
      settings: sensorSettings,
    });
    const nowMs = Date.now();
    if (snapshot.ok && snapshot.isPlaying) {
      localMediaLastPlayingAtMs = nowMs;
      localMediaStoppedSinceMs = 0;
      localMediaPendingStopFromPlaying = false;
    } else if (snapshot.ok && !snapshot.isPlaying) {
      if (previousSnapshot.ok && previousSnapshot.isPlaying) {
        localMediaPendingStopFromPlaying = true;
      }
      if (localMediaStoppedSinceMs <= 0) {
        localMediaStoppedSinceMs = nowMs;
      }
    }
    const mediaStopStable =
      snapshot.ok &&
      !snapshot.isPlaying &&
      localMediaStoppedSinceMs > 0 &&
      nowMs - localMediaStoppedSinceMs >= LOCAL_MEDIA_STOP_DEBOUNCE_MS;
    latestLocalMediaSnapshot = snapshot;
    emitIntegrationEvent(buildLocalMediaIntegrationEvent(snapshot, { correlationId }));

    const nextEventKey = buildLocalMediaProbeKey(snapshot);
    const changed = force || nextEventKey !== lastLocalMediaEventKey;
    let effectiveChanged = changed;
    let contractResult = null;
    if (changed) {
      if (snapshot.ok && snapshot.isPlaying) {
        lastLocalMediaEventKey = nextEventKey;
        const payload = buildLocalMediaEventPayload(snapshot);
        const mediaSuggestion = deriveMediaPlaybackSuggestion(snapshot);
        payload.suggestedState = mediaSuggestion.suggestedState || "MusicChill";
        payload.mediaKind = mediaSuggestion.mediaKind || "music";
        payload.mediaKindReason = mediaSuggestion.reason || "default_music_fallback";
        const contractSignature = buildLocalMediaContractSignature(snapshot, mediaSuggestion);
        const allowDuplicateContract = force && trigger === "manual";
        const reapplyStateOnly = force && trigger === "idle-resume";
        if (
          !allowDuplicateContract &&
          contractSignature &&
          contractSignature === lastLocalMediaContractSignature
        ) {
          effectiveChanged = false;
          if (reapplyStateOnly) {
            applyMediaSuggestedState(payload);
          }
        } else {
          lastLocalMediaContractSignature = contractSignature;
          contractResult = await processPetContractEvent("MEDIA", payload, {
            correlationId,
            source: "local",
            mediaResponseText: buildLocalMediaResponseText(snapshot),
            mediaSuggestedState: payload.suggestedState,
            integrationFallbackMode: "none",
          });
        }
      } else if (!force && snapshot.ok && !snapshot.isPlaying && !mediaStopStable) {
        // Ignore short probe stop jitter so media announcements do not retrigger on resume.
        effectiveChanged = false;
      } else {
        lastLocalMediaEventKey = nextEventKey;
      }
    }

    const holdMediaWatchOnFocusedWindow =
      mediaStopStable && shouldHoldMediaWatchInspectByFocus(roamState.inspectAnchor);

    if (
      localMediaPendingStopFromPlaying &&
      mediaStopStable &&
      !holdMediaWatchOnFocusedWindow &&
      (
        isMusicStateId(latestStateSnapshot?.currentState) ||
        (
          latestStateSnapshot?.currentState === "WatchMode" &&
          latestStateSnapshot?.reason === "media_playing_video_watch_mode"
        )
      ) &&
      stateRuntime
    ) {
      stateRuntime.activateState("Idle", {
        source: "system",
        reason: "local_media_stopped",
        trigger: "local-media",
      });
      localMediaPendingStopFromPlaying = false;
    }

    if (snapshot.isPlaying) {
      void runBackgroundSpotifyEnrichment(snapshot, `local-media-${trigger}`);
    } else if (mediaStopStable && !holdMediaWatchOnFocusedWindow) {
      localMediaLastPlayingAtMs = 0;
      localMediaStoppedSinceMs = 0;
      localMediaPendingStopFromPlaying = false;
      lastLocalMediaContractSignature = null;
    }

    return {
      ok: snapshot.ok && (!effectiveChanged || !snapshot.isPlaying || Boolean(contractResult) || force),
      snapshot,
      contractResult,
      error: snapshot.error || null,
    };
  } finally {
    localMediaProbeInFlight = false;
  }
}

async function runBackgroundFreshRssProbe(trigger = "background-poll") {
  const settings = buildRuntimeSettingsSummary();
  if (!settings.openclaw.enabled || !settings.integrations.freshRss.enabled) return null;
  if (!settings.integrations.freshRss.available) return null;
  if (!settings.integrations.freshRss.backgroundEnrichmentEnabled) return null;
  if (freshRssBackgroundProbeInFlight) return null;
  freshRssBackgroundProbeInFlight = true;
  try {
    return await probeFreshRssIntegration({
      routeContractEvent: false,
      queueObservation: true,
      trigger,
    });
  } finally {
    freshRssBackgroundProbeInFlight = false;
  }
}

function startLocalMediaPoller() {
  if (localMediaPollTimer) {
    clearInterval(localMediaPollTimer);
    localMediaPollTimer = null;
  }
  const settings = getLocalMediaSensorSettings();
  if (!settings.enabled || process.platform !== "win32") return;
  void pollLocalMediaState({
    force: true,
    trigger: "startup",
  });
  localMediaPollTimer = setInterval(() => {
    void pollLocalMediaState({
      trigger: "interval",
    });
  }, settings.pollIntervalMs);
}

function startBackgroundFreshRssPoller() {
  if (freshRssPollTimer) {
    clearInterval(freshRssPollTimer);
    freshRssPollTimer = null;
  }
  const settings = buildRuntimeSettingsSummary();
  if (!settings.integrations.freshRss.backgroundEnrichmentEnabled) return;
  if (!settings.openclaw.enabled || !settings.integrations.freshRss.enabled) return;
  if (!settings.integrations.freshRss.available) return;
  freshRssPollTimer = setInterval(() => {
    void runBackgroundFreshRssProbe("background-interval");
  }, getFreshRssBackgroundPollCadenceMs());
}

async function recordTrackRating(payload = {}) {
  if (!memoryPipeline) {
    return {
      ok: false,
      error: "memory_pipeline_unavailable",
    };
  }
  const correlationId = createContractCorrelationId();
  const observation = createTrackRatingObservation(payload, correlationId);
  const outcome = await memoryPipeline.recordObservation(observation);
  const integrationEvent = {
    kind: "trackRatingRecorded",
    correlationId,
    provider: observation.payload.provider,
    trackTitle: observation.payload.trackTitle,
    artist: observation.payload.artist,
    rating: observation.payload.rating,
    targetPath: outcome?.targetPath || null,
    adapterMode: outcome?.adapterMode || latestMemorySnapshot?.activeAdapterMode || "local",
    ts: Date.now(),
  };
  emitIntegrationEvent(integrationEvent);
  emitToRenderer("pet:memory", integrationEvent);
  return outcome;
}

function pointInBounds(point, bounds) {
  return (
    point.x >= bounds.x &&
    point.x < bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y < bounds.y + bounds.height
  );
}

function getDisplayContainingPoint(point) {
  for (const display of screen.getAllDisplays()) {
    if (pointInBounds(point, display.bounds)) {
      return display;
    }
  }

  return null;
}

function resolveDragDisplay(cursor) {
  const containingDisplay = getDisplayContainingPoint(cursor);
  if (containingDisplay) {
    dragDisplayId = containingDisplay.id;
    return { display: containingDisplay, source: "containing" };
  }

  if (dragDisplayId !== null) {
    const previousDisplay = screen.getAllDisplays().find((display) => display.id === dragDisplayId);
    if (previousDisplay) {
      return { display: previousDisplay, source: "stickyPrevious" };
    }
  }

  const nearestDisplay = screen.getDisplayNearestPoint(cursor);
  dragDisplayId = nearestDisplay.id;
  return { display: nearestDisplay, source: "nearestFallback" };
}

function createWindow() {
  activePetVisualBounds = { ...getBasePetVisualBounds() };
  activePetBoundsUpdatedAtMs = 0;
  const petWindowSize = getPetWindowSize();

  win = new BrowserWindow({
    width: petWindowSize.width,
    height: petWindowSize.height,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.setMinimumSize(petWindowSize.width, petWindowSize.height);
  win.setMaximumSize(petWindowSize.width, petWindowSize.height);

  win.loadFile("index.html");
  win.webContents.once("did-finish-load", () => {
    updateCapabilityState(CAPABILITY_IDS.renderer, CAPABILITY_STATES.healthy, "didFinishLoad", {
      windowId: win?.id || null,
    });
    if (latestCapabilitySnapshot) {
      emitCapabilitySnapshot(latestCapabilitySnapshot);
    }
    if (latestExtensionSnapshot) {
      emitExtensionSnapshot(latestExtensionSnapshot);
    }
    if (latestContractTrace) {
      emitContractTrace(latestContractTrace);
    }
    if (latestMemorySnapshot) {
      emitMemorySnapshot(latestMemorySnapshot);
    }
    if (latestStateSnapshot) {
      emitStateSnapshot(latestStateSnapshot);
    }
    if (latestIntegrationEvent) {
      emitIntegrationEvent(latestIntegrationEvent);
    }
    emitShellState(latestShellState || buildShellStateSnapshot());
    resetMotionSampleFromWindow();
    emitMotionState({
      velocityOverride: { vx: 0, vy: 0 },
      collided: { x: false, y: false },
      impact: { triggered: false, strength: 0 },
    });
    emitCursorState();
  });

  logDiagnostics("window-created", {
    windowSize: petWindowSize,
    petVisualBounds: getBasePetVisualBounds(),
    activePetVisualBounds,
    petBoundsStaleMs: PET_BOUNDS_STALE_MS,
    clampAreaType: CLAMP_TO_WORK_AREA ? "workArea" : "bounds",
    flingPreset: ACTIVE_FLING_PRESET,
    flingConfig: FLING_CONFIG,
    displays: summarizeDisplays(),
  });
}

ipcMain.on("pet:setPosition", (_event, x, y) => {
  if (!win) return;
  const petWindowSize = getPetWindowSize();

  const targetPoint = {
    x: Math.round(x + petWindowSize.width / 2),
    y: Math.round(y + petWindowSize.height / 2),
  };
  const display = screen.getDisplayNearestPoint(targetPoint);
  const petBounds = getActivePetVisualBounds(Date.now());
  const clamped = clampWindowPosition(x, y, getClampArea(display), petBounds);
  applyWindowBounds(clamped.x, clamped.y);
  emitMotionState({
    collided: { x: false, y: false },
    impact: { triggered: false, strength: 0 },
  });
});

ipcMain.on("pet:beginDrag", () => {
  if (!win) return;

  cancelFling("grabbed");
  resetRoamDirectionMemory();
  clearDragSamples();
  manualCorrectionStartDisplayId = getCurrentPetDisplayId();
  requestForegroundWindowPoll("manual_drag_begin");
  manualWindowCorrectionStartContext = null;

  const cursor = screen.getCursorScreenPoint();
  const [winX, winY] = win.getPosition();
  const nowMs = Date.now();
  const windowBounds = win.getBounds();
  const displayDecision = resolveDragDisplay(cursor);
  const desktopRoamLayout = getDesktopRoamLayout();
  const foregroundContext = resolveForegroundWindowCandidate({
    samplingAreas: desktopRoamLayout?.areas || [],
    nowMs,
  });
  if (foregroundContext?.candidate) {
    const petWorldBounds = buildPetVisualWorldBoundsAt(winX, winY, nowMs);
    const petBounds = getRoamPetBounds(nowMs);
    const maskBounds = buildWindowAvoidMaskForCandidate(
      foregroundContext.candidate.bounds,
      desktopRoamLayout?.areas || [],
      petBounds
    );
    if (petWorldBounds && maskBounds) {
      manualWindowCorrectionStartContext = {
        windowId: foregroundContext.candidate.windowId,
        startedInsideMask: Boolean(intersectBoundsRect(petWorldBounds, maskBounds)),
        maskBounds: summarizeBounds(maskBounds),
        startedAtMs: nowMs,
      };
    }
  }

  dragOffset = {
    x: cursor.x - winX,
    y: cursor.y - winY,
  };
  dragTick = 0;
  dragging = true;
  dragClampLatch = createDragClampLatch();
  recordDragSample(winX, winY);
  if (DIAGNOSTICS_ENABLED) {
    const payload = {
      kind: "beginDrag",
      cursor,
      windowPosition: { x: winX, y: winY },
      windowBounds: summarizeBounds(windowBounds),
      clampAreaType: CLAMP_TO_WORK_AREA ? "workArea" : "bounds",
      clampArea: summarizeBounds(getClampArea(displayDecision.display)),
      dragOffset,
      displaySource: displayDecision.source,
      activeDisplay: summarizeDisplay(displayDecision.display),
      displays: summarizeDisplays(),
    };

    logDiagnostics("begin-drag", payload);
    emitDiagnostics(payload);
  }
  emitMotionState({
    velocityOverride: { vx: 0, vy: 0 },
    collided: { x: false, y: false },
    impact: { triggered: false, strength: 0 },
  });
});

ipcMain.on("pet:endDrag", () => {
  dragging = false;
  dragDisplayId = null;
  dragClampLatch = createDragClampLatch();
  if (DIAGNOSTICS_ENABLED) {
    const payload = { kind: "endDrag" };
    logDiagnostics("end-drag", payload);
    emitDiagnostics(payload);
  }

  maybeExitZoneRoamAfterManualMove("manual_drag_exit_zone");
  maybeStartFlingFromSamples();
  if (!flingState.active) {
    maybeRecordManualMonitorAvoidance("manual_drag_monitor_correction");
    maybeRecordManualWindowAvoidance("manual_drag_window_correction");
    emitMotionState({
      velocityOverride: { vx: 0, vy: 0 },
      collided: { x: false, y: false },
      impact: { triggered: false, strength: 0 },
    });
  }
  if (flingState.active) {
    manualWindowCorrectionStartContext = null;
  }
  clearDragSamples();
});

ipcMain.on("pet:drag", () => {
  if (!win || !dragging) return;

  dragTick += 1;

  const nowMs = Date.now();
  const cursor = screen.getCursorScreenPoint();
  const [winX, winY] = win.getPosition();
  const targetX = cursor.x - dragOffset.x;
  const targetY = cursor.y - dragOffset.y;
  const displayDecision = resolveDragDisplay(cursor);
  const clampArea = getClampArea(displayDecision.display);
  const petBounds = getActivePetVisualBounds(nowMs);
  const rawClamp = clampWindowPosition(targetX, targetY, clampArea, petBounds);
  const clamped = applyDragClampHysteresis({
    targetX,
    targetY,
    rawClampedX: rawClamp.x,
    rawClampedY: rawClamp.y,
    range: rawClamp.range,
    latch: dragClampLatch,
    hysteresisPx: DRAG_CLAMP_HYSTERESIS_PX,
  });
  dragClampLatch = clamped.latch;
  const roundedTarget = { x: Math.round(targetX), y: Math.round(targetY) };
  const clampedX = clamped.x !== roundedTarget.x;
  const clampedY = clamped.y !== roundedTarget.y;
  const boundsResult = applyWindowBounds(clamped.x, clamped.y);
  recordDragSample(boundsResult.contentAfter?.x ?? clamped.x, boundsResult.contentAfter?.y ?? clamped.y);

  if (DIAGNOSTICS_ENABLED) {
    const payload = {
      kind: "drag",
      tick: dragTick,
      cursor,
      windowPositionBefore: { x: winX, y: winY },
      target: roundedTarget,
      clamped: { x: clamped.x, y: clamped.y },
      rawClamped: { x: rawClamp.x, y: rawClamp.y },
      clampHit: { x: clampedX, y: clampedY },
      clampLatch: dragClampLatch,
      activePetBounds: petBounds,
      clampAreaType: CLAMP_TO_WORK_AREA ? "workArea" : "bounds",
      clampArea: summarizeBounds(clampArea),
      windowBoundsBefore: boundsResult.windowBefore,
      windowBoundsAfter: boundsResult.windowAfter,
      contentBoundsBefore: boundsResult.contentBefore,
      contentBoundsAfter: boundsResult.contentAfter,
      sizeCorrected: boundsResult.sizeCorrected,
      dragOffset,
      displaySource: displayDecision.source,
      activeDisplay: summarizeDisplay(displayDecision.display),
    };

    emitDiagnostics(payload);
    if (dragTick % DRAG_LOG_SAMPLE_EVERY === 0 || clampedX || clampedY) {
      logDiagnostics("drag", payload);
    }
    if (boundsResult.sizeCorrected) {
      logDiagnostics("size-corrected", payload);
    }
  }

  emitMotionState({
    collided: { x: clampedX, y: clampedY },
    impact: { triggered: false, strength: 0 },
  });
});

ipcMain.on("pet:setVisibleBounds", (_event, bounds) => {
  const normalized = normalizePetBounds(bounds, getPetWindowSize());
  if (!normalized) return;
  activePetVisualBounds = {
    x: normalized.x,
    y: normalized.y,
    width: normalized.width,
    height: normalized.height,
  };
  activePetBoundsUpdatedAtMs = Math.max(0, normalized.tMs);
});

ipcMain.on("pet:setIgnoreMouseEvents", (_event, payload) => {
  if (!win || win.isDestroyed()) return;

  const ignore = Boolean(payload?.ignore);
  const forward = Boolean(payload?.forward);

  if (ignore) {
    win.setIgnoreMouseEvents(true, forward ? { forward: true } : undefined);
    return;
  }

  win.setIgnoreMouseEvents(false);
});

ipcMain.on("pet:setDialogSurfaceOpen", (_event, payload) => {
  const open = Boolean(payload?.open);
  const reason =
    typeof payload?.reason === "string" && payload.reason.trim().length > 0
      ? payload.reason.trim()
      : "renderer_signal";
  setDialogSurfaceOpen(open, reason);
});

ipcMain.handle("pet:getPosition", () => {
  if (!win) return { x: 0, y: 0 };
  const [x, y] = win.getPosition();
  return { x, y };
});

ipcMain.handle("pet:getConfig", () => {
  const settingsSummary = buildRuntimeSettingsSummary();
  return {
    diagnosticsEnabled: DIAGNOSTICS_ENABLED,
    clampToWorkArea: CLAMP_TO_WORK_AREA,
    flingPreset: ACTIVE_FLING_PRESET,
    flingEnabled: FLING_CONFIG.enabled,
    availableFlingPresets: Object.keys(FLING_PRESETS),
    layout: getPetLayout(),
    capabilityRuntimeState: latestCapabilitySnapshot?.runtimeState || "unknown",
    capabilitySummary: latestCapabilitySnapshot?.summary || null,
    stateCurrentState: latestStateSnapshot?.currentState || "Idle",
    statePhase: latestStateSnapshot?.phase || null,
    stateVisualClip: latestStateSnapshot?.visual?.clip || "IdleReady",
    stateVisualFallbackUsed: Boolean(latestStateSnapshot?.visualFallbackUsed),
    contractTraceStage: latestContractTrace?.stage || null,
    memoryAdapterMode: latestMemorySnapshot?.activeAdapterMode || "unknown",
    memoryFallbackReason: latestMemorySnapshot?.fallbackReason || "none",
    localMediaPlaying: Boolean(latestLocalMediaSnapshot?.isPlaying),
    localMediaSource: latestLocalMediaSnapshot?.sourceAppLabel || "Windows Media",
    localMediaOutputRoute: latestLocalMediaSnapshot?.outputRoute || "unknown",
    openclawEnabled: settingsSummary.openclaw.enabled,
    openclawTransport: settingsSummary.openclaw.transport,
    openclawMode: settingsSummary.openclaw.mode,
    openclawBaseUrl: settingsSummary.openclaw.baseUrl,
    openclawLoopbackEndpoint: settingsSummary.openclaw.loopbackEndpoint,
    openclawAuthTokenConfigured: settingsSummary.openclaw.authTokenConfigured,
    settingsSummary,
    shellState: latestShellState || buildShellStateSnapshot(),
    settingsSourceMap: runtimeSettingsSourceMap,
    settingsValidationWarnings: runtimeSettingsValidationWarnings,
    settingsValidationErrors: runtimeSettingsValidationErrors,
    settingsFiles: runtimeSettingsFiles,
  };
});

ipcMain.handle("pet:getShellState", () => {
  return latestShellState || buildShellStateSnapshot();
});

ipcMain.handle("pet:getObservabilitySnapshot", () => {
  return buildCurrentObservabilitySnapshot();
});

ipcMain.handle("pet:getObservabilityDetail", (_event, payload) => {
  const subjectId =
    typeof payload?.subjectId === "string" && payload.subjectId.trim().length > 0
      ? payload.subjectId.trim()
      : DEFAULT_OBSERVABILITY_SUBJECT_ID;
  const snapshot = buildCurrentObservabilitySnapshot();
  return buildCurrentObservabilityDetail(subjectId, snapshot);
});

ipcMain.handle("pet:runObservabilityAction", (_event, payload) => {
  const actionId =
    typeof payload?.actionId === "string" && payload.actionId.trim().length > 0
      ? payload.actionId.trim()
      : "";
  const subjectId =
    typeof payload?.subjectId === "string" && payload.subjectId.trim().length > 0
      ? payload.subjectId.trim()
      : DEFAULT_OBSERVABILITY_SUBJECT_ID;
  return runObservabilityAction(actionId, subjectId);
});

ipcMain.handle("pet:getSetupBootstrapSnapshot", () => {
  return buildCurrentSetupBootstrapSnapshot();
});

ipcMain.handle("pet:previewSetupBootstrap", (_event, payload) => {
  return previewSetupBootstrap({
    input: payload?.input,
    settingsSummary: buildRuntimeSettingsSummary(),
    resolvedPaths: runtimeSettingsResolvedPaths,
    ts: Date.now(),
  });
});

ipcMain.handle("pet:applySetupBootstrap", async (_event, payload) => {
  const result = await applySetupBootstrap({
    input: payload?.input,
    settingsSummary: buildRuntimeSettingsSummary(),
    resolvedPaths: runtimeSettingsResolvedPaths,
    ts: Date.now(),
  });
  return result;
});

ipcMain.handle("pet:getShellSettingsSnapshot", () => {
  return buildCurrentShellSettingsSnapshot();
});

ipcMain.handle("pet:applyShellSettingsPatch", (_event, payload) => {
  const patch = payload?.patch && typeof payload.patch === "object" ? payload.patch : {};
  return applyShellSettingsEditorPatch(patch);
});

ipcMain.handle("pet:runShellAction", (_event, payload) => {
  const actionId =
    typeof payload?.actionId === "string" && payload.actionId.trim().length > 0
      ? payload.actionId.trim()
      : "";
  return runShellAction(actionId);
});

ipcMain.handle("inventory:setActiveTab", (_event, payload) => {
  const nextTab = normalizeShellWindowTab(payload?.tabId, inventoryWindowActiveTab);
  const snapshot = setInventoryWindowActiveTab(nextTab, true);
  return {
    ok: true,
    tabId: nextTab,
    shellState: snapshot,
  };
});

ipcMain.handle("inventory:beginPropPlacement", (_event, payload) => {
  const propId =
    typeof payload?.propId === "string" && payload.propId.trim().length > 0
      ? payload.propId.trim()
      : "";
  return beginPropPlacement(propId);
});

ipcMain.handle("inventory:updatePropPlacement", (_event, payload) => {
  const propId =
    typeof payload?.propId === "string" && payload.propId.trim().length > 0
      ? payload.propId.trim()
      : "";
  return updatePropPlacement(propId);
});

ipcMain.handle("inventory:endPropPlacement", (_event, payload) => {
  const propId =
    typeof payload?.propId === "string" && payload.propId.trim().length > 0
      ? payload.propId.trim()
      : "";
  return endPropPlacement(propId, payload?.commit !== false);
});

ipcMain.handle("zoneSelector:getModel", () => {
  return buildZoneSelectorModel();
});

ipcMain.handle("zoneSelector:commit", (_event, payload) => {
  return commitRoamZoneSelection(payload?.rect);
});

ipcMain.handle("zoneSelector:cancel", () => {
  closeZoneSelectorWindow();
  return {
    ok: true,
  };
});

ipcMain.handle("prop:getModel", (event) => {
  const record = findPropWindowRecordByWebContentsId(event.sender.id);
  if (!record) return null;
  return buildPropWindowModel(record.propId);
});

ipcMain.handle("prop:beginDrag", (event, payload) => {
  const requestedPropId =
    typeof payload?.propId === "string" && payload.propId.trim().length > 0
      ? payload.propId.trim()
      : "";
  const record = findPropWindowRecordByWebContentsId(event.sender.id);
  if (!record || record.propId !== requestedPropId) {
    return {
      ok: false,
      error: "prop_window_mismatch",
    };
  }
  return beginPropWindowDrag(requestedPropId);
});

ipcMain.handle("prop:drag", (event, payload) => {
  const requestedPropId =
    typeof payload?.propId === "string" && payload.propId.trim().length > 0
      ? payload.propId.trim()
      : "";
  const record = findPropWindowRecordByWebContentsId(event.sender.id);
  if (!record || record.propId !== requestedPropId) {
    return {
      ok: false,
      error: "prop_window_mismatch",
    };
  }
  return dragPropWindow(requestedPropId);
});

ipcMain.handle("prop:endDrag", (event, payload) => {
  const requestedPropId =
    typeof payload?.propId === "string" && payload.propId.trim().length > 0
      ? payload.propId.trim()
      : "";
  const record = findPropWindowRecordByWebContentsId(event.sender.id);
  if (!record || record.propId !== requestedPropId) {
    return {
      ok: false,
      error: "prop_window_mismatch",
    };
  }
  return endPropWindowDrag(requestedPropId);
});

ipcMain.handle("prop:returnToInventory", (event, payload) => {
  const requestedPropId =
    typeof payload?.propId === "string" && payload.propId.trim().length > 0
      ? payload.propId.trim()
      : "";
  const record = findPropWindowRecordByWebContentsId(event.sender.id);
  if (!record || record.propId !== requestedPropId) {
    return {
      ok: false,
      error: "prop_window_mismatch",
    };
  }
  return removeQuickPropFromDesktop(requestedPropId, `prop_return_${requestedPropId}`);
});

ipcMain.handle("pet:getCapabilitySnapshot", () => {
  if (!capabilityRegistry) return latestCapabilitySnapshot;
  return capabilityRegistry.getSnapshot();
});

ipcMain.handle("pet:getContractTrace", () => {
  return latestContractTrace;
});

ipcMain.handle("pet:getMemorySnapshot", () => {
  if (!memoryPipeline) return latestMemorySnapshot;
  return memoryPipeline.getSnapshot();
});

ipcMain.handle("pet:getStateSnapshot", () => {
  if (!stateRuntime) return latestStateSnapshot;
  return stateRuntime.getSnapshot();
});

ipcMain.handle("pet:triggerBehaviorState", (_event, payload) => {
  if (!stateRuntime) {
    return {
      ok: false,
      error: "state_runtime_unavailable",
    };
  }
  const stateId =
    typeof payload?.stateId === "string" && payload.stateId.trim().length > 0
      ? payload.stateId.trim()
      : "";
  if (!stateId) {
    return {
      ok: false,
      error: "invalid_state_id",
    };
  }
  const snapshot = stateRuntime.activateState(stateId, {
    source: "manual",
    reason:
      typeof payload?.reason === "string" && payload.reason.trim().length > 0
        ? payload.reason.trim()
        : "manual_trigger",
    trigger:
      typeof payload?.trigger === "string" && payload.trigger.trim().length > 0
        ? payload.trigger.trim()
        : "manual",
    durationMs: Number.isFinite(Number(payload?.durationMs))
      ? Math.max(100, Math.round(Number(payload.durationMs)))
      : null,
    onCompleteStateId:
      typeof payload?.onCompleteStateId === "string" && payload.onCompleteStateId.trim().length > 0
        ? payload.onCompleteStateId.trim()
        : null,
    context: payload?.context,
  });
  return {
    ok: true,
    snapshot,
  };
});

ipcMain.handle("pet:simulateStateFallback", () => {
  if (!stateRuntime) {
    return {
      ok: false,
      error: "state_runtime_unavailable",
    };
  }
  const snapshot = stateRuntime.simulateMissingVisualFallback();
  return {
    ok: true,
    snapshot,
  };
});

ipcMain.handle("pet:getDialogHistory", () => {
  return dialogHistory.map((entry) => ({ ...entry }));
});

ipcMain.handle("pet:sendUserMessage", async (_event, payload) => {
  const text =
    typeof payload?.text === "string" && payload.text.trim().length > 0
      ? payload.text.trim()
      : "";
  if (!text) {
    return {
      ok: false,
      error: "invalid_text",
    };
  }

  const correlationId = createContractCorrelationId();
  const historyEntry = recordDialogUserMessage({
    correlationId,
    text,
  });
  dialogUserMessageInFlightCount += 1;
  emitShellState(buildShellStateSnapshot());
  try {
    const contractResult = await processPetContractEvent(
      "USER_MESSAGE",
      {
        text,
        command: text,
        type: text,
      },
      {
        correlationId,
      }
    );

    return {
      ok: Boolean(contractResult?.ok),
      correlationId,
      historyEntry,
      contractResult,
    };
  } finally {
    dialogUserMessageInFlightCount = Math.max(0, dialogUserMessageInFlightCount - 1);
    emitShellState(buildShellStateSnapshot());
  }
});

ipcMain.handle("pet:runUserCommand", (_event, payload) => {
  const command =
    typeof payload?.command === "string" && payload.command.trim().length > 0
      ? payload.command.trim()
      : "";
  if (!command) {
    return {
      ok: false,
      error: "invalid_command",
    };
  }
  return processPetContractEvent("USER_COMMAND", {
    command,
    type: command,
    text: command,
  });
});

ipcMain.handle("pet:probeSpotifyIntegration", () => {
  return probeSpotifyIntegration();
});

ipcMain.handle("pet:probeFreshRssIntegration", () => {
  return probeFreshRssIntegration();
});

ipcMain.handle("pet:probeLocalMedia", () => {
  return pollLocalMediaState({
    force: true,
    trigger: "manual",
  });
});

ipcMain.handle("pet:simulateSpotifyPlayback", () => {
  return probeSpotifyIntegration();
});

ipcMain.handle("pet:recordTrackRating", (_event, payload) => {
  return recordTrackRating(payload);
});

ipcMain.handle("pet:recordMusicRating", async (_event, payload) => {
  if (!memoryPipeline) {
    return {
      ok: false,
      error: "memory_pipeline_unavailable",
    };
  }
  const rating = Number.isFinite(Number(payload?.rating))
    ? Math.max(1, Math.min(10, Math.round(Number(payload.rating))))
    : 7;
  const trackTitle =
    typeof payload?.trackTitle === "string" && payload.trackTitle.trim().length > 0
      ? payload.trackTitle.trim()
      : "unknown_track";
  const outcome = await memoryPipeline.recordObservation({
    observationType: "music_rating",
    source: "manual_music_rating",
    evidenceTag: trackTitle.toLowerCase(),
    correlationId: createContractCorrelationId(),
    payload: {
      trackTitle,
      rating,
    },
  });
  emitToRenderer("pet:memory", {
    kind: "musicRatingRecorded",
    rating,
    trackTitle,
    targetPath: outcome?.targetPath || null,
    adapterMode: outcome?.adapterMode || latestMemorySnapshot?.activeAdapterMode || "local",
    ts: Date.now(),
  });
  return outcome;
});

ipcMain.handle("pet:runMemoryPromotionCheck", async (_event, payload) => {
  if (!memoryPipeline) {
    return {
      ok: false,
      error: "memory_pipeline_unavailable",
    };
  }
  const result = await memoryPipeline.evaluatePromotionCandidate({
    candidateType:
      typeof payload?.candidateType === "string" && payload.candidateType.trim().length > 0
        ? payload.candidateType.trim()
        : "adaptive_music_preference",
    focusObservationType:
      typeof payload?.focusObservationType === "string" && payload.focusObservationType.trim().length > 0
        ? payload.focusObservationType.trim()
        : "",
    thresholds: payload?.thresholds,
  });
  emitToRenderer("pet:memory", {
    kind: "promotionDecision",
    outcome: result?.decision?.outcome || "unknown",
    reasons: result?.decision?.reasons || [],
    targetPath: result?.targetPath || null,
    adapterMode: result?.adapterMode || latestMemorySnapshot?.activeAdapterMode || "local",
    ts: Date.now(),
  });
  return result;
});

ipcMain.handle("pet:testProtectedIdentityWrite", async () => {
  if (!memoryPipeline) {
    return {
      ok: false,
      error: "memory_pipeline_unavailable",
    };
  }
  const result = await memoryPipeline.attemptIdentityMutation({
    section: "Immutable Core",
    evidence: ["manual_protected_write_test"],
    patch: {
      operation: "replace",
      key: "core_identity",
      value: "forbidden_mutation_attempt",
    },
  });
  emitToRenderer("pet:memory", {
    kind: "identityMutationTest",
    outcome: result?.auditEntry?.outcome || "unknown",
    reason: result?.auditEntry?.reason || "none",
    targetPath: result?.targetPath || null,
    adapterMode: result?.adapterMode || latestMemorySnapshot?.activeAdapterMode || "local",
    ts: Date.now(),
  });
  return result;
});

ipcMain.handle("pet:getExtensions", () => {
  if (!extensionPackRegistry) return latestExtensionSnapshot;
  return extensionPackRegistry.getSnapshot();
});

ipcMain.handle("pet:setExtensionEnabled", (_event, payload) => {
  if (!extensionPackRegistry) {
    return { ok: false, error: "extension_registry_unavailable" };
  }

  const extensionId =
    typeof payload?.extensionId === "string" ? payload.extensionId.trim() : "";
  if (!extensionId) {
    return { ok: false, error: "invalid_extension_id" };
  }

  const result = extensionPackRegistry.setEnabled(extensionId, Boolean(payload?.enabled));
  const snapshot = result.snapshot || extensionPackRegistry.getSnapshot();
  emitExtensionSnapshot(snapshot);
  logExtensionSummary("set-enabled", snapshot);
  refreshExtensionCapabilityStates();

  if (result.trustWarning) {
    console.warn(`[pet-extension] trust-warning ${extensionId}: ${result.trustWarning}`);
    if (DIAGNOSTICS_ENABLED) {
      emitDiagnostics({
        kind: "extensionTrustWarning",
        extensionId,
        message: result.trustWarning,
      });
    }
  }

  return result;
});

ipcMain.handle("pet:interactWithExtensionProp", (_event, payload) => {
  if (!extensionPackRegistry) {
    const unavailable = { ok: false, error: "extension_registry_unavailable" };
    console.warn("[pet-extension] interaction failed: extension_registry_unavailable");
    emitToRenderer("pet:extension-event", {
      kind: "extensionPropInteraction",
      ...unavailable,
      ts: Date.now(),
    });
    return unavailable;
  }

  const extensionId =
    typeof payload?.extensionId === "string" ? payload.extensionId.trim() : "";
  const propId = typeof payload?.propId === "string" ? payload.propId.trim() : "";
  const interactionType =
    typeof payload?.interactionType === "string" && payload.interactionType.trim().length > 0
      ? payload.interactionType.trim()
      : "click";
  if (!extensionId || !propId) {
    const invalidPayload = { ok: false, error: "invalid_interaction_payload" };
    console.warn("[pet-extension] interaction failed: invalid_interaction_payload");
    emitToRenderer("pet:extension-event", {
      kind: "extensionPropInteraction",
      ...invalidPayload,
      ts: Date.now(),
    });
    return invalidPayload;
  }

  const interaction = extensionPackRegistry.triggerPropInteraction(
    extensionId,
    propId,
    interactionType
  );
  if (!interaction.ok) {
    console.warn(
      `[pet-extension] interaction failed extension=${extensionId} prop=${propId} error=${interaction.error}`
    );
    emitToRenderer("pet:extension-event", {
      kind: "extensionPropInteraction",
      ...interaction,
      extensionId,
      propId,
      interactionType,
      ts: Date.now(),
    });
    if (DIAGNOSTICS_ENABLED) {
      emitDiagnostics({
        kind: "extensionPropInteraction",
        ...interaction,
        extensionId,
        propId,
        interactionType,
      });
    }
    return interaction;
  }

  const arbitration = {
    authority: "core",
    decision: "allow",
    reason: "extensionEnabledAndPropAvailable",
    ts: Date.now(),
  };
  const result = {
    ok: true,
    intent: interaction.intent,
    prop: interaction.prop,
    arbitration,
  };

  const eventPayload = {
    kind: "extensionPropInteraction",
    ...result,
  };
  console.log(
    `[pet-extension] interaction extension=${extensionId} prop=${propId} type=${interactionType} decision=${arbitration.decision}`
  );
  emitToRenderer("pet:extension-event", eventPayload);
  if (DIAGNOSTICS_ENABLED) {
    emitDiagnostics(eventPayload);
  }

  void processPetContractEvent("EXT_PROP_INTERACTED", {
    extensionId,
    propId,
    interactionType,
  }).catch((error) => {
    console.warn(
      `[pet-contract] extension-event processing failed: ${error?.message || String(error)}`
    );
  });

  return result;
});

ipcMain.handle("pet:getAnimationManifest", (_event, characterId) => {
  return readAnimationManifest(characterId);
});

app.whenReady().then(async () => {
  initializeRuntimeSettings("startup");
  initializeStateRuntime();
  initializeDialogRuntime();
  initializeContractRouter();
  await initializeMemoryPipelineRuntime();
  createWindow();
  initializeShellSurface();
  startRoamController();
  startProactiveConversationController();
  physicsTimer = setInterval(stepFling, FLING_CONFIG.stepMs);
  cursorTimer = setInterval(emitCursorState, CURSOR_EMIT_INTERVAL_MS);
  initializeExtensionPackRuntime();
  initializeOpenClawBridgeRuntime();
  startReflectionScheduler();
  initializeCapabilityRegistry();
  await startCapabilityRegistry();
  startLocalMediaPoller();
  startBackgroundFreshRssPoller();
  requestForegroundWindowPoll("startup", true);

  screen.on("display-added", (_event, display) => {
    if (!DIAGNOSTICS_ENABLED) return;
    logDiagnostics("display-added", summarizeDisplay(display));
  });

  screen.on("display-removed", (_event, display) => {
    if (!DIAGNOSTICS_ENABLED) return;
    logDiagnostics("display-removed", summarizeDisplay(display));
  });

  screen.on("display-metrics-changed", (_event, display, changedMetrics) => {
    if (!DIAGNOSTICS_ENABLED) return;
    logDiagnostics("display-metrics-changed", {
      changedMetrics,
      display: summarizeDisplay(display),
    });
  });
});

app.on("before-quit", () => {
  appIsQuitting = true;
  if (stateRuntime) {
    stateRuntime.stop();
  }
  if (capabilityRegistry) {
    capabilityRegistry.stopAll({
      reason: "appQuit",
    });
  }
  if (physicsTimer) {
    clearInterval(physicsTimer);
    physicsTimer = null;
  }
  if (cursorTimer) {
    clearInterval(cursorTimer);
    cursorTimer = null;
  }
  if (roamTimer) {
    clearInterval(roamTimer);
    roamTimer = null;
  }
  if (proactiveConversationTimer) {
    clearInterval(proactiveConversationTimer);
    proactiveConversationTimer = null;
  }
  if (localMediaPollTimer) {
    clearInterval(localMediaPollTimer);
    localMediaPollTimer = null;
  }
  if (freshRssPollTimer) {
    clearInterval(freshRssPollTimer);
    freshRssPollTimer = null;
  }
  if (reflectionSchedulerTimer) {
    clearInterval(reflectionSchedulerTimer);
    reflectionSchedulerTimer = null;
  }
  if (shellTray) {
    shellTray.destroy();
    shellTray = null;
  }
  if (inventoryWin && !inventoryWin.isDestroyed()) {
    inventoryWin.destroy();
    inventoryWin = null;
  }
  if (zoneSelectorWin && !zoneSelectorWin.isDestroyed()) {
    zoneSelectorWin.destroy();
    zoneSelectorWin = null;
  }
  for (const record of propWindows.values()) {
    if (record?.window && !record.window.isDestroyed()) {
      record.window.destroy();
    }
  }
  propWindows.clear();
  cancelFling("appQuit");
  closeDiagnosticsLog();
});
