const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const dialogPanel = document.getElementById("dialog-panel");
const dialogHistoryEl = document.getElementById("dialog-history");
const dialogForm = document.getElementById("dialog-form");
const dialogInput = document.getElementById("dialog-input");
const dialogSubmitButton = document.getElementById("dialog-submit");
const dialogHint = document.getElementById("dialog-hint");
const dialogBubble = document.getElementById("dialog-bubble");
const dialogBubbleMeta = document.getElementById("dialog-bubble-meta");
const dialogBubbleText = document.getElementById("dialog-bubble-text");
const dialogCloseButton = document.getElementById("dialog-close");
const visibleBoundsMath = window.PetVisibleBoundsMath || null;
const spriteRuntimeApi = window.PetSpriteRuntime || null;

const RENDER_MODES = Object.freeze({
  procedural: "procedural",
  sprite: "sprite",
});
const SPRITE_CHARACTER_ID = "girl";
const OVERLAY_SPRITES = Object.freeze({
  book: Object.freeze({
    src: "assets/overlays/book-sheet.svg",
    frameWidth: 96,
    frameHeight: 96,
    frameCount: 4,
    fps: 4,
    drawWidth: 70,
    drawHeight: 70,
    anchorX: 0.63,
    anchorY: 0.65,
  }),
  rssCard: Object.freeze({
    src: "assets/overlays/rss-card-sheet.svg",
    frameWidth: 96,
    frameHeight: 96,
    frameCount: 4,
    fps: 4,
    drawWidth: 74,
    drawHeight: 74,
    anchorX: 0.63,
    anchorY: 0.64,
  }),
  headphones: Object.freeze({
    src: "assets/overlays/headphones-sheet.svg",
    frameWidth: 96,
    frameHeight: 96,
    frameCount: 4,
    fps: 6,
    drawWidth: 78,
    drawHeight: 78,
    anchorX: 0.5,
    anchorY: 0.33,
  }),
  speaker: Object.freeze({
    src: "assets/overlays/speaker-sheet.svg",
    frameWidth: 96,
    frameHeight: 96,
    frameCount: 4,
    fps: 6,
    drawWidth: 72,
    drawHeight: 72,
    anchorX: 0.2,
    anchorY: 0.44,
  }),
  musicNote: Object.freeze({
    src: "assets/overlays/music-note-sheet.svg",
    frameWidth: 96,
    frameHeight: 96,
    frameCount: 4,
    fps: 6,
    drawWidth: 54,
    drawHeight: 54,
    anchorX: 0.66,
    anchorY: 0.2,
  }),
  poolRing: Object.freeze({
    src: "assets/overlays/pool-ring-sheet.svg",
    frameWidth: 96,
    frameHeight: 96,
    frameCount: 4,
    fps: 5,
    drawWidth: 112,
    drawHeight: 72,
    anchorX: 0.5,
    anchorY: 0.7,
  }),
  fallbackWarning: Object.freeze({
    src: "assets/overlays/fallback-warning-sheet.svg",
    frameWidth: 96,
    frameHeight: 96,
    frameCount: 4,
    fps: 5,
    drawWidth: 54,
    drawHeight: 54,
    anchorX: 0.5,
    anchorY: 0.22,
  }),
});
const SPRITE_DRAG_ROTATION_MAX_RAD = Math.PI * (34 / 180);
const SPRITE_DRAG_ROTATION_VX_FOR_MAX = 420;
const SPRITE_DRAG_ROTATION_MIN_VX = 2;
const SPRITE_DRAG_PIVOT_TOP_RATIO = 0.05;
const SPRITE_DRAG_ROTATION_STIFFNESS_DRAG = 150;
const SPRITE_DRAG_ROTATION_DAMPING_DRAG = 18;
const SPRITE_DRAG_STOP_SPEED = 65;
const SPRITE_DRAG_ROTATION_STIFFNESS_SNAP = 360;
const SPRITE_DRAG_ROTATION_DAMPING_SNAP = 10;
const SPRITE_DRAG_ROTATION_STIFFNESS_RELEASE = 170;
const SPRITE_DRAG_ROTATION_DAMPING_RELEASE = 16;
const SPRITE_DRAG_ROTATION_SNAP_KICK = 14;

const MAX_FX_PARTICLES = 32;
const IMPACT_STATE_MIN_MS = 100;
const IMPACT_STATE_MAX_MS = 180;
const GAZE_MAX_X = 12;
const GAZE_MAX_Y = 8;
const GAZE_NEAR_RADIUS = 260;
const GAZE_GLOBAL_RADIUS = 760;
const GAZE_GLOBAL_RELEASE_DELAY_MS = 600;
const GAZE_RESPONSE_EXPONENT = 0.45;
const GAZE_FOLLOW_SPEED = 24;
const GAZE_DART_MIN_MS = 820;
const GAZE_DART_MAX_MS = 1900;
const GAZE_DART_AMPLITUDE = 0.62;
const BLINK_MIN_INTERVAL_MS = 3200;
const BLINK_MAX_INTERVAL_MS = 7600;
const BLINK_DURATION_MS = 170;
const TAIL_SEGMENT_COUNT = 20;
const TAIL_COLOR_CODE_SEGMENTS = false;
const TAIL_LAG_EXPONENT = 2.6;
const TAIL_ROPE_ITERATIONS = 6;
const TAIL_ROPE_DAMPING = 0.994;
const TAIL_WEIGHT_FACTOR = 1.38;
const TAIL_DISTAL_MOTION_START = 0.5;
const TAIL_DISTAL_MOTION_BOOST = 0.18;
const TAIL_DISTAL_INERTIA_BOOST = 0.08;
const RIG_ROTATION_SIDE_MAX_RAD = Math.PI * (34 / 180);
const RIG_ROTATION_DOWN_THRESHOLD = 180;
const RIG_ROTATION_DOWN_SPEED = 1250;
const RIG_ROTATION_FLY_MAX_RAD = Math.PI * (20 / 180);
const RIG_ROTATION_INPUT_FILTER_DRAG = 8.5;
const RIG_ROTATION_INPUT_FILTER_FLY = 4.8;
const RIG_ROTATION_INPUT_FILTER_IDLE = 2.4;
const RIG_ROTATION_TARGET_FILTER_DRAG = 5.2;
const RIG_ROTATION_TARGET_FILTER_FLY = 3.1;
const RIG_ROTATION_TARGET_FILTER_IDLE = 1.7;
const RIG_ROTATION_DRAG_DEADBAND_RAD = Math.PI * (0.85 / 180);
const RIG_ROTATION_DRAG_RESPONSE = 5.3;
const RIG_ROTATION_FLY_RESPONSE = 2.8;
const RIG_ROTATION_RELEASE_RESPONSE = 0.9;
const RIG_ROTATION_FLING_HOLD_MS = 700;
const RIG_ROTATION_FLING_RELEASE_BLEND_MS = 1100;
const VISIBLE_BOUNDS_EMIT_INTERVAL_MS = 33;
const VISIBLE_BOUNDS_DELTA_THRESHOLD_PX = 2;
const DIALOG_HISTORY_LIMIT = 24;
const DIALOG_HISTORY_VISIBLE_COUNT = 8;
const DIALOG_BUBBLE_VISIBLE_MS = 9000;
const DIALOG_TALK_FEEDBACK_MS = 2600;
const SHELL_ACTIONS = Object.freeze({
  openInventory: "open-inventory",
  openStatus: "open-status",
  openSetup: "open-setup",
  openSettings: "open-settings",
  roamDesktop: "roam-desktop",
  roamZone: "roam-zone",
  toggleDiagnostics: "toggle-diagnostics",
  toggleHeadphones: "toggle-headphones",
  togglePoolRing: "toggle-pool-ring",
  toggleAlwaysShowBubble: "toggle-always-show-bubble",
});
const DEFAULT_SHELL_STATE = Object.freeze({
  roaming: Object.freeze({
    mode: "desktop",
    zone: "desk-center",
    zoneRect: null,
  }),
  ui: Object.freeze({
    diagnosticsEnabled: false,
  }),
  wardrobe: Object.freeze({
    activeAccessories: Object.freeze([]),
    hasHeadphones: false,
  }),
  inventory: Object.freeze({
    quickProps: Object.freeze([]),
    hasPoolRing: false,
  }),
  dialog: Object.freeze({
    alwaysShowBubble: true,
  }),
  inventoryUi: Object.freeze({
    open: false,
    activeTab: "inventory",
  }),
  tray: Object.freeze({
    available: false,
    supported: true,
    error: null,
  }),
  devFallback: Object.freeze({
    enabled: true,
    hotkeys: Object.freeze(["F6", "F7", "F8", "F9", "F10", "F11"]),
  }),
  layout: null,
});
const TAIL_STYLES = Object.freeze({
  ribbon: "ribbon",
  segmented: "segmented",
  spike: "spike",
});
const ACTIVE_TAIL_STYLE = TAIL_STYLES.ribbon;

const RIG_LAYERS = [
  {
    id: "tail",
    spriteId: null,
    style: {
      stroke: "rgba(244, 238, 214, 0.98)",
      tip: "rgba(255, 236, 170, 0.98)",
      shadow: "rgba(188, 164, 120, 0.45)",
    },
    draw: drawTailLayer,
  },
  {
    id: "body",
    spriteId: null,
    style: {
      fill: "rgba(34, 98, 197, 0.9)",
      rim: "rgba(191, 226, 255, 0.95)",
      highlight: "rgba(255, 255, 255, 0.22)",
    },
    draw: drawBodyLayer,
  },
  {
    id: "eyes",
    spriteId: null,
    style: {
      sclera: "rgba(247, 251, 255, 0.98)",
      iris: "rgba(72, 137, 255, 0.95)",
      pupil: "rgba(12, 18, 28, 0.98)",
      outline: "rgba(19, 44, 80, 0.65)",
      lid: "rgba(34, 98, 197, 0.95)",
    },
    draw: drawEyesLayer,
  },
  {
    id: "mouth",
    spriteId: null,
    style: {
      stroke: "rgba(255, 214, 104, 0.95)",
    },
    draw: drawMouthLayer,
  },
  {
    id: "fx",
    spriteId: null,
    style: {},
    draw: drawFxLayer,
  },
];

const DEFAULT_MOTION = Object.freeze({
  tMs: 0,
  dragging: false,
  flinging: false,
  position: { x: 0, y: 0 },
  velocity: { vx: 0, vy: 0, speed: 0 },
  collided: { x: false, y: false },
  impact: { triggered: false, strength: 0 },
  preset: "default",
});

const lag = {
  eyes: { x: 0, y: 0, vx: 0, vy: 0 },
  mouth: { x: 0, y: 0, vx: 0, vy: 0 },
  tail: { x: 0, y: 0, vx: 0, vy: 0 },
};

const movementKeys = {
  up: false,
  down: false,
  left: false,
  right: false,
  run: false,
};

let lastDevicePixelRatio = window.devicePixelRatio || 1;
let latestDiagnostics = null;
let latestCapabilitySnapshot = null;
let latestExtensionSnapshot = null;
let latestContractTrace = null;
let latestContractSuggestion = null;
let latestMemorySnapshot = null;
let latestMemoryEvent = null;
let latestIntegrationEvent = null;
let latestStateSnapshot = null;
let latestShellState = { ...DEFAULT_SHELL_STATE };
let diagnosticsEnabled = false;
let latestMotion = { ...DEFAULT_MOTION };
let currentRenderState = "idle";
let impactStateUntilMs = 0;
let impactImpulse = { x: 0, y: 0, strength: 0, tMs: 0 };
let lastImpactSpawnMs = 0;
let lastFrameMs = performance.now();
let fxParticles = [];
let pointerInCanvas = false;
let pointerClient = { x: 0, y: 0 };
let gazeOffset = { x: 0, y: 0 };
let gazeTarget = { x: 0, y: 0 };
let nextGazeDartMs = 0;
let blinkAmount = 0;
let blinkActive = false;
let blinkStartMs = 0;
let blinkEndMs = 0;
let nextBlinkMs = 0;
let latestRigState = null;
let latestCursorScreen = null;
let gazeSource = "idle";
let mousePassthrough = null;
let globalGazeReleaseUntilMs = 0;
let petLayout = createRuntimeLayoutFallback();
let lastRenderScale = 1;
let rigRotation = 0;
let rigRotationTargetFiltered = 0;
let rigFilteredVelocity = { vx: 0, vy: 0 };
let rigInversionSign = 1;
let rigFlingHoldAngle = 0;
let rigFlingHoldUntilMs = 0;
let lastRotationState = "idle";
let lastVisibleBoundsSent = null;
let lastVisibleBoundsSentMs = 0;
let latestVisibleBounds = null;
let latestSpriteFrame = null;
let latestSpriteHitRect = null;
let spriteRuntime = null;
let spriteManifest = null;
let overlaySpriteEntries = new Map();
let dialogHistory = [];
let dialogSurfaceOpen = false;
let dialogSubmitPending = false;
let activeBubbleMessage = null;
let talkFeedbackUntilMs = 0;
let spriteJumpQueued = false;
let spriteDragRotation = 0;
let spriteDragRotationVel = 0;
let spriteWasDragDriving = false;
let activeRenderMode = RENDER_MODES.sprite;
let interactivityRafPending = false;
let pendingInteractivityClient = null;
let lastSyncedCursorPx = null;
let lastSyncedDragging = false;
const tempRigPoint = { x: 0, y: 0 };
const tailRope = {
  points: [],
  prevPoints: [],
  segmentLength: 0,
  segmentCount: 0,
};

function createRuntimeLayoutFallback() {
  const cssWidth = Math.max(1, Math.floor(canvas?.clientWidth || window.innerWidth || 320));
  const cssHeight = Math.max(1, Math.floor(canvas?.clientHeight || window.innerHeight || 320));
  return {
    scale: 1,
    base: {
      windowSize: {
        width: cssWidth,
        height: cssHeight,
      },
      visualBounds: {
        x: 0,
        y: 0,
        width: cssWidth,
        height: cssHeight,
      },
    },
  };
}

function isEditableTarget(target) {
  if (!target || typeof target !== "object") return false;
  const tagName = typeof target.tagName === "string" ? target.tagName.toLowerCase() : "";
  return tagName === "input" || tagName === "textarea" || Boolean(target.isContentEditable);
}

function normalizeStringArray(value) {
  const rawValues =
    Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const normalized = [];
  const seen = new Set();
  for (const entry of rawValues) {
    const trimmed = typeof entry === "string" ? entry.trim() : "";
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

function normalizeShellState(payload = {}) {
  const roaming = payload?.roaming && typeof payload.roaming === "object" ? payload.roaming : {};
  const ui = payload?.ui && typeof payload.ui === "object" ? payload.ui : {};
  const wardrobe = payload?.wardrobe && typeof payload.wardrobe === "object" ? payload.wardrobe : {};
  const inventory = payload?.inventory && typeof payload.inventory === "object" ? payload.inventory : {};
  const dialog = payload?.dialog && typeof payload.dialog === "object" ? payload.dialog : {};
  const inventoryUi =
    payload?.inventoryUi && typeof payload.inventoryUi === "object" ? payload.inventoryUi : {};
  const tray = payload?.tray && typeof payload.tray === "object" ? payload.tray : {};
  const devFallback =
    payload?.devFallback && typeof payload.devFallback === "object" ? payload.devFallback : {};
  const normalizedLayout =
    payload?.layout && typeof payload.layout === "object" ? normalizeLayout(payload.layout) : null;
  const activeAccessories = normalizeStringArray(wardrobe.activeAccessories);
  const quickProps = normalizeStringArray(inventory.quickProps);
  return {
    roaming: {
      mode: roaming.mode === "zone" ? "zone" : "desktop",
      zone:
        typeof roaming.zone === "string" && roaming.zone.trim().length > 0
          ? roaming.zone.trim()
          : DEFAULT_SHELL_STATE.roaming.zone,
      zoneRect:
        Number.isFinite(Number(roaming.zoneRect?.x)) &&
        Number.isFinite(Number(roaming.zoneRect?.y)) &&
        Number.isFinite(Number(roaming.zoneRect?.width)) &&
        Number.isFinite(Number(roaming.zoneRect?.height))
          ? {
              x: Math.round(Number(roaming.zoneRect.x)),
              y: Math.round(Number(roaming.zoneRect.y)),
              width: Math.round(Number(roaming.zoneRect.width)),
              height: Math.round(Number(roaming.zoneRect.height)),
            }
          : null,
    },
    ui: {
      diagnosticsEnabled: Boolean(ui.diagnosticsEnabled),
    },
    wardrobe: {
      activeAccessories,
      hasHeadphones: activeAccessories.includes("headphones"),
    },
    inventory: {
      quickProps,
      hasPoolRing: quickProps.includes("poolRing"),
    },
    dialog: {
      alwaysShowBubble: dialog.alwaysShowBubble !== false,
    },
    inventoryUi: {
      open: Boolean(inventoryUi.open),
      activeTab:
        inventoryUi.activeTab === "status"
          ? "status"
          : inventoryUi.activeTab === "setup"
            ? "setup"
            : inventoryUi.activeTab === "settings"
              ? "settings"
              : "inventory",
    },
    tray: {
      available: Boolean(tray.available),
      supported: tray.supported !== false,
      error: typeof tray.error === "string" && tray.error.trim().length > 0 ? tray.error.trim() : null,
    },
    devFallback: {
      enabled: devFallback.enabled !== false,
      hotkeys:
        normalizeStringArray(devFallback.hotkeys).length > 0
          ? normalizeStringArray(devFallback.hotkeys)
          : [...DEFAULT_SHELL_STATE.devFallback.hotkeys],
    },
    layout: normalizedLayout,
  };
}

function syncShellState(payload) {
  latestShellState = normalizeShellState(payload);
  if (latestShellState.layout) {
    petLayout = latestShellState.layout;
    resize();
  }
  diagnosticsEnabled = Boolean(latestShellState.ui.diagnosticsEnabled);
  renderDialogBubble();
}

function shouldAlwaysShowBubble() {
  return latestShellState?.dialog?.alwaysShowBubble !== false;
}

function normalizeDialogEntry(payload = {}) {
  const text =
    typeof payload?.text === "string" && payload.text.trim().length > 0
      ? payload.text.trim()
      : "";
  return {
    messageId:
      typeof payload?.messageId === "string" && payload.messageId.trim().length > 0
        ? payload.messageId.trim()
        : `dialog-${Date.now().toString(36)}`,
    correlationId:
      typeof payload?.correlationId === "string" && payload.correlationId.trim().length > 0
        ? payload.correlationId.trim()
        : "",
    role: payload?.role === "user" ? "user" : "pet",
    kind:
      typeof payload?.kind === "string" && payload.kind.trim().length > 0
        ? payload.kind.trim()
        : "response",
    channel:
      typeof payload?.channel === "string" && payload.channel.trim().length > 0
        ? payload.channel.trim()
        : "dialog",
    source:
      typeof payload?.source === "string" && payload.source.trim().length > 0
        ? payload.source.trim()
        : "offline",
    text,
    fallbackMode:
      typeof payload?.fallbackMode === "string" && payload.fallbackMode.trim().length > 0
        ? payload.fallbackMode.trim()
        : "none",
    talkFeedbackMode:
      typeof payload?.talkFeedbackMode === "string" && payload.talkFeedbackMode.trim().length > 0
        ? payload.talkFeedbackMode.trim()
        : "none",
    stateContextSummary:
      typeof payload?.stateContextSummary === "string" && payload.stateContextSummary.trim().length > 0
        ? payload.stateContextSummary.trim()
        : "",
    currentState:
      typeof payload?.currentState === "string" && payload.currentState.trim().length > 0
        ? payload.currentState.trim()
        : "Idle",
    phase:
      typeof payload?.phase === "string" && payload.phase.trim().length > 0
        ? payload.phase.trim()
        : null,
    ts: Number.isFinite(payload?.ts) ? payload.ts : Date.now(),
  };
}

function getDialogStateLabel(entry) {
  if (!entry?.currentState) return "Idle";
  return entry.phase ? `${entry.currentState}/${entry.phase}` : entry.currentState;
}

function appendDialogPill(parent, text, className = "") {
  if (!parent || !text) return;
  const pill = document.createElement("span");
  pill.className = className ? `dialog-history__pill ${className}` : "dialog-history__pill";
  pill.textContent = text;
  parent.appendChild(pill);
}

function renderDialogHistory() {
  if (!dialogHistoryEl) return;
  dialogHistoryEl.textContent = "";

  const visibleEntries = dialogHistory.slice(-DIALOG_HISTORY_VISIBLE_COUNT);
  if (visibleEntries.length <= 0) {
    const empty = document.createElement("div");
    empty.className = "dialog-history__empty";
    empty.textContent = "No dialog yet. Press Enter or / to ask a question.";
    dialogHistoryEl.appendChild(empty);
    return;
  }

  for (const entry of visibleEntries) {
    const item = document.createElement("div");
    item.className =
      entry.role === "user"
        ? "dialog-history__item dialog-history__item--user"
        : "dialog-history__item dialog-history__item--pet";

    const meta = document.createElement("div");
    meta.className = "dialog-history__meta";
    appendDialogPill(meta, entry.role === "user" ? "you" : entry.kind === "announcement" ? "announce" : "pet");
    if (entry.role !== "user") {
      appendDialogPill(meta, entry.source || "offline");
      appendDialogPill(meta, getDialogStateLabel(entry));
      if (entry.fallbackMode && entry.fallbackMode !== "none") {
        appendDialogPill(meta, entry.fallbackMode, "dialog-history__pill--warning");
      }
    }
    item.appendChild(meta);

    const text = document.createElement("div");
    text.className = "dialog-history__text";
    text.textContent = entry.text;
    item.appendChild(text);

    dialogHistoryEl.appendChild(item);
  }

  dialogHistoryEl.scrollTop = dialogHistoryEl.scrollHeight;
}

function renderDialogBubble(nowMs = Date.now()) {
  if (!dialogBubble || !dialogBubbleMeta || !dialogBubbleText) return;
  const bubbleIsFresh =
    activeBubbleMessage &&
    nowMs - activeBubbleMessage.ts < DIALOG_BUBBLE_VISIBLE_MS;
  const active =
    (shouldAlwaysShowBubble() || dialogSurfaceOpen || bubbleIsFresh) &&
    activeBubbleMessage &&
    typeof activeBubbleMessage.text === "string" &&
    activeBubbleMessage.text.length > 0;

  dialogBubble.classList.toggle("is-visible", Boolean(active));
  dialogBubble.classList.toggle("is-speaking", Boolean(active && nowMs < talkFeedbackUntilMs));
  if (!active) return;

  dialogBubbleMeta.textContent = "";
  const kindTag = document.createElement("span");
  kindTag.className = "dialog-bubble__tag";
  kindTag.textContent = activeBubbleMessage.kind === "announcement" ? "announcement" : "reply";
  dialogBubbleMeta.appendChild(kindTag);

  const sourceTag = document.createElement("span");
  sourceTag.className = "dialog-bubble__tag";
  sourceTag.textContent = activeBubbleMessage.source || "offline";
  dialogBubbleMeta.appendChild(sourceTag);

  const stateTag = document.createElement("span");
  stateTag.className = "dialog-bubble__tag";
  stateTag.textContent = getDialogStateLabel(activeBubbleMessage);
  dialogBubbleMeta.appendChild(stateTag);

  if (activeBubbleMessage.fallbackMode && activeBubbleMessage.fallbackMode !== "none") {
    const fallbackTag = document.createElement("span");
    fallbackTag.className = "dialog-bubble__tag dialog-bubble__tag--warning";
    fallbackTag.textContent = activeBubbleMessage.fallbackMode;
    dialogBubbleMeta.appendChild(fallbackTag);
  }

  dialogBubbleText.textContent = activeBubbleMessage.text;
}

function syncDialogSurfaceState() {
  if (dialogPanel) {
    dialogPanel.classList.toggle("is-open", dialogSurfaceOpen);
  }
  if (dialogHint) {
    dialogHint.classList.toggle("is-hidden", dialogSurfaceOpen);
  }
}

function setDialogPending(pending) {
  dialogSubmitPending = Boolean(pending);
  if (dialogInput) {
    dialogInput.disabled = dialogSubmitPending;
  }
  if (dialogSubmitButton) {
    dialogSubmitButton.disabled = dialogSubmitPending;
  }
}

function openDialogSurface(options = {}) {
  dialogSurfaceOpen = true;
  syncDialogSurfaceState();
  setMousePassthrough(false);
  if (dialogInput) {
    if (
      typeof options.prefill === "string" &&
      options.prefill.length > 0 &&
      dialogInput.value.trim().length <= 0
    ) {
      dialogInput.value = options.prefill;
    }
    requestAnimationFrame(() => {
      dialogInput.focus();
      dialogInput.select();
    });
  }
}

function closeDialogSurface() {
  dialogSurfaceOpen = false;
  syncDialogSurfaceState();
  if (dialogInput) {
    dialogInput.blur();
  }
  syncMouseInteractivityFromGlobalCursor();
}

function handleDialogMessage(payload) {
  const entry = normalizeDialogEntry(payload);
  const existingIndex = dialogHistory.findIndex((item) => item.messageId === entry.messageId);
  if (existingIndex >= 0) {
    dialogHistory[existingIndex] = entry;
  } else {
    dialogHistory = [...dialogHistory, entry].slice(-DIALOG_HISTORY_LIMIT);
  }
  renderDialogHistory();

  if (entry.role === "pet") {
    activeBubbleMessage = entry;
    talkFeedbackUntilMs =
      entry.talkFeedbackMode !== "none" ? Date.now() + DIALOG_TALK_FEEDBACK_MS : 0;
    renderDialogBubble();
  }
}

async function loadDialogHistorySnapshot() {
  if (typeof window.petAPI.getDialogHistory !== "function") {
    renderDialogHistory();
    renderDialogBubble();
    return;
  }

  try {
    const history = await window.petAPI.getDialogHistory();
    dialogHistory = Array.isArray(history) ? history.map((entry) => normalizeDialogEntry(entry)) : [];
    activeBubbleMessage =
      dialogHistory.length > 0
        ? [...dialogHistory].reverse().find((entry) => entry.role === "pet") || null
        : null;
  } catch {
    dialogHistory = [];
    activeBubbleMessage = null;
  }

  renderDialogHistory();
  renderDialogBubble();
}

async function submitDialogMessage() {
  if (dialogSubmitPending) return;
  if (!dialogInput) return;
  if (typeof window.petAPI.sendUserMessage !== "function") return;

  const text = dialogInput.value.trim();
  if (!text) return;

  setDialogPending(true);
  try {
    const result = await window.petAPI.sendUserMessage(text);
    if (!result?.ok) {
      console.warn("[dialog] send failed:", result?.error || "unknown");
      return;
    }
    dialogInput.value = "";
    dialogInput.focus();
  } catch (error) {
    console.warn("[dialog] send failed:", error);
  } finally {
    setDialogPending(false);
  }
}

function isTalkFeedbackActive(nowMs = Date.now()) {
  return Boolean(activeBubbleMessage) && nowMs < talkFeedbackUntilMs;
}

function getTalkFeedbackStrength(nowMs = performance.now()) {
  if (!isTalkFeedbackActive()) return 0;
  return 0.4 + 0.6 * ((Math.sin(nowMs * 0.02) + 1) * 0.5);
}

async function loadRuntimeConfig() {
  if (typeof window.petAPI.getConfig !== "function") return;

  try {
    const config = await window.petAPI.getConfig();
    if (config?.shellState) {
      syncShellState(config.shellState);
    } else {
      diagnosticsEnabled = Boolean(config?.diagnosticsEnabled);
    }
    if (config?.capabilitySummary || config?.capabilityRuntimeState) {
      latestCapabilitySnapshot = {
        runtimeState: config.capabilityRuntimeState || "unknown",
        summary: config.capabilitySummary || {},
      };
    }
    if (config?.layout) {
      petLayout = normalizeLayout(config.layout);
    }
  } catch {
    diagnosticsEnabled = false;
    petLayout = createRuntimeLayoutFallback();
  }
}

function asPositiveNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeLayout(layout) {
  const fallbackLayout = petLayout;
  const defaultBaseWindow = fallbackLayout.base.windowSize;
  const defaultBaseVisual = fallbackLayout.base.visualBounds;

  const scale = asPositiveNumber(layout?.scale, fallbackLayout.scale);
  const baseWindowSize = {
    width: asPositiveNumber(layout?.base?.windowSize?.width, defaultBaseWindow.width),
    height: asPositiveNumber(layout?.base?.windowSize?.height, defaultBaseWindow.height),
  };
  const baseVisualBounds = {
    x: Number.isFinite(layout?.base?.visualBounds?.x)
      ? layout.base.visualBounds.x
      : defaultBaseVisual.x,
    y: Number.isFinite(layout?.base?.visualBounds?.y)
      ? layout.base.visualBounds.y
      : defaultBaseVisual.y,
    width: asPositiveNumber(layout?.base?.visualBounds?.width, defaultBaseVisual.width),
    height: asPositiveNumber(layout?.base?.visualBounds?.height, defaultBaseVisual.height),
  };

  return {
    scale,
    base: {
      windowSize: baseWindowSize,
      visualBounds: baseVisualBounds,
    },
  };
}

function getLayoutScale() {
  return asPositiveNumber(petLayout.scale, 1);
}

function getDesignWindowSize() {
  return petLayout.base.windowSize;
}

function getDesignVisualBounds() {
  return petLayout.base.visualBounds;
}

function toDesignPoint(x, y) {
  const scale = getLayoutScale();
  return {
    x: x / scale,
    y: y / scale,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function gazeIntensity(distance, radius) {
  const normalized = clamp01(distance / Math.max(1, radius));
  return clamp01(Math.pow(normalized, GAZE_RESPONSE_EXPONENT));
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pointOnQuadratic(t, p0, p1, p2) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  return {
    x: uu * p0.x + 2 * u * t * p1.x + tt * p2.x,
    y: uu * p0.y + 2 * u * t * p1.y + tt * p2.y,
  };
}

function tangentOnQuadratic(t, p0, p1, p2) {
  return {
    x: 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  };
}

function getCursorInWindowSpacePx() {
  if (!latestCursorScreen) return null;

  const windowX = latestMotion.position?.x ?? 0;
  const windowY = latestMotion.position?.y ?? 0;
  return {
    x: latestCursorScreen.x - windowX,
    y: latestCursorScreen.y - windowY,
  };
}

function getCursorInWindowSpace() {
  const cursorPx = getCursorInWindowSpacePx();
  if (!cursorPx) return null;
  return toDesignPoint(cursorPx.x, cursorPx.y);
}

function pointInCanvas(x, y) {
  const windowSize = getDesignWindowSize();
  return x >= 0 && y >= 0 && x <= windowSize.width && y <= windowSize.height;
}

function pointInCircle(px, py, cx, cy, radius) {
  return Math.hypot(px - cx, py - cy) <= radius;
}

function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0001) return Math.hypot(px - x1, py - y1);

  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  const cx = x1 + dx * t;
  const cy = y1 + dy * t;
  return Math.hypot(px - cx, py - cy);
}

function pointNearQuadraticStroke(px, py, p0, p1, p2, halfWidth) {
  let minDistance = Number.POSITIVE_INFINITY;
  let prev = p0;

  for (let i = 1; i <= 16; i += 1) {
    const t = i / 16;
    const next = pointOnQuadratic(t, p0, p1, p2);
    minDistance = Math.min(
      minDistance,
      distancePointToSegment(px, py, prev.x, prev.y, next.x, next.y)
    );
    prev = next;
  }

  return minDistance <= halfWidth;
}

function pointNearPolyline(px, py, points, halfWidth) {
  if (!Array.isArray(points) || points.length < 2) return false;

  let minDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    minDistance = Math.min(minDistance, distancePointToSegment(px, py, a.x, a.y, b.x, b.y));
  }

  return minDistance <= halfWidth;
}

function rotatePointAround(px, py, cx, cy, angleRad, out = null) {
  const target = out || { x: 0, y: 0 };
  if (!Number.isFinite(angleRad) || Math.abs(angleRad) < 0.00001) {
    target.x = px;
    target.y = py;
    return target;
  }

  const s = Math.sin(angleRad);
  const c = Math.cos(angleRad);
  const dx = px - cx;
  const dy = py - cy;
  target.x = cx + dx * c - dy * s;
  target.y = cy + dx * s + dy * c;
  return target;
}

function toRigLocalPoint(px, py) {
  const global = latestRigState?.global;
  if (!global || !Number.isFinite(global.rotation) || Math.abs(global.rotation) < 0.00001) {
    return { x: px, y: py };
  }

  return rotatePointAround(px, py, global.anchorX, global.anchorY, -global.rotation, tempRigPoint);
}

function normalizeAngleRad(angle) {
  if (!Number.isFinite(angle)) return 0;
  let normalized = angle;
  while (normalized <= -Math.PI) normalized += Math.PI * 2;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  return normalized;
}

function shortestAngleDeltaRad(from, to) {
  return normalizeAngleRad(to - from);
}

function computeVisibleBoundsForFrame(layerTransforms, windowWidth, windowHeight) {
  const fallbackBounds = getDesignVisualBounds();
  if (!visibleBoundsMath || typeof visibleBoundsMath.computeVisiblePetBounds !== "function") {
    return {
      x: fallbackBounds.x,
      y: fallbackBounds.y,
      width: fallbackBounds.width,
      height: fallbackBounds.height,
    };
  }

  return visibleBoundsMath.computeVisiblePetBounds(
    layerTransforms,
    windowWidth,
    windowHeight,
    fallbackBounds
  );
}

function maybeEmitVisibleBounds(visibleBounds, nowMs) {
  if (typeof window.petAPI.setVisibleBounds !== "function") return;
  if (nowMs - lastVisibleBoundsSentMs < VISIBLE_BOUNDS_EMIT_INTERVAL_MS) return;
  const stableBounds = visibleBounds || getDesignVisualBounds();

  const scale = getLayoutScale();
  const nextBounds = {
    x: Math.round(stableBounds.x * scale),
    y: Math.round(stableBounds.y * scale),
    width: Math.max(1, Math.round(stableBounds.width * scale)),
    height: Math.max(1, Math.round(stableBounds.height * scale)),
    tMs: Date.now(),
  };

  const unchanged =
    lastVisibleBoundsSent &&
    Math.abs(lastVisibleBoundsSent.x - nextBounds.x) < VISIBLE_BOUNDS_DELTA_THRESHOLD_PX &&
    Math.abs(lastVisibleBoundsSent.y - nextBounds.y) < VISIBLE_BOUNDS_DELTA_THRESHOLD_PX &&
    Math.abs(lastVisibleBoundsSent.width - nextBounds.width) < VISIBLE_BOUNDS_DELTA_THRESHOLD_PX &&
    Math.abs(lastVisibleBoundsSent.height - nextBounds.height) < VISIBLE_BOUNDS_DELTA_THRESHOLD_PX;

  if (unchanged) return;
  lastVisibleBoundsSent = {
    x: nextBounds.x,
    y: nextBounds.y,
    width: nextBounds.width,
    height: nextBounds.height,
  };
  lastVisibleBoundsSentMs = nowMs;
  window.petAPI.setVisibleBounds(nextBounds);
}

function pointInRect(px, py, rect) {
  if (!rect) return false;
  return px >= rect.x && py >= rect.y && px <= rect.x + rect.width && py <= rect.y + rect.height;
}

function getSpriteInputState() {
  let moveX = (movementKeys.right ? 1 : 0) - (movementKeys.left ? 1 : 0);
  let moveY = (movementKeys.down ? 1 : 0) - (movementKeys.up ? 1 : 0);
  const jumpPressed = spriteJumpQueued;
  const behaviorVisual = getBehaviorVisualBinding();
  const preferBehaviorVisual = Boolean(
    latestStateSnapshot &&
      (
        latestStateSnapshot.currentState !== "Idle" ||
        latestStateSnapshot.phase ||
        behaviorVisual?.overlay ||
        behaviorVisual?.clip !== "IdleReady"
      )
  );
  const motionVX = latestMotion.velocity?.vx || 0;
  const motionVY = latestMotion.velocity?.vy || 0;
  const motionSpeed = latestMotion.velocity?.speed || 0;
  const behaviorLocomotionClip =
    behaviorVisual?.clip === "Walk" || behaviorVisual?.clip === "Run"
      ? behaviorVisual.clip
      : "";
  if (
    moveX === 0 &&
    moveY === 0 &&
    preferBehaviorVisual &&
    behaviorLocomotionClip &&
    motionSpeed > 1
  ) {
    moveX = motionVX / motionSpeed;
    moveY = motionVY / motionSpeed;
  }
  spriteJumpQueued = false;
  return {
    moveX,
    moveY,
    running: movementKeys.run || behaviorLocomotionClip === "Run",
    jumpPressed,
    dragging: Boolean(latestMotion.dragging),
    flinging: Boolean(latestMotion.flinging),
    dragVX: latestMotion.velocity?.vx || 0,
    dragVY: latestMotion.velocity?.vy || 0,
    motionVX,
    motionVY,
    motionSpeed,
    preferredState: preferBehaviorVisual ? behaviorVisual?.clip || "" : "",
    preferredDirection:
      preferBehaviorVisual && !behaviorLocomotionClip ? behaviorVisual?.direction || "" : "",
    preservePreferredPhase: preferBehaviorVisual && Boolean(latestStateSnapshot?.phase),
  };
}

function onMovementKeyDown(event) {
  if (!event || typeof event.key !== "string") return;
  const key = event.key.toLowerCase();
  const editableTarget = isEditableTarget(event.target);

  if (editableTarget) {
    if (key === "escape") {
      closeDialogSurface();
      event.preventDefault();
    }
    return;
  }

  if ((key === "enter" || key === "/") && !event.repeat) {
    openDialogSurface({
      prefill: key === "/" ? "/" : "",
    });
    event.preventDefault();
    return;
  }

  if (key === "escape" && dialogSurfaceOpen) {
    closeDialogSurface();
    event.preventDefault();
    return;
  }

  if (!event.repeat && latestShellState?.devFallback?.enabled) {
    if (key === "f6") {
      void runShellAction(SHELL_ACTIONS.openInventory);
      event.preventDefault();
      return;
    }
    if (key === "f7") {
      void runShellAction(
        latestShellState?.roaming?.mode === "zone"
          ? SHELL_ACTIONS.roamDesktop
          : SHELL_ACTIONS.roamZone
      );
      event.preventDefault();
      return;
    }
    if (key === "f8") {
      void runShellAction(SHELL_ACTIONS.toggleDiagnostics);
      event.preventDefault();
      return;
    }
    if (key === "f9") {
      void runShellAction(SHELL_ACTIONS.toggleAlwaysShowBubble);
      event.preventDefault();
      return;
    }
    if (key === "f10") {
      void runShellAction(SHELL_ACTIONS.openStatus);
      event.preventDefault();
      return;
    }
    if (key === "f11") {
      void runShellAction(SHELL_ACTIONS.openSetup);
      event.preventDefault();
      return;
    }
  }

  if (key === "w" || key === "arrowup") movementKeys.up = true;
  else if (key === "s" || key === "arrowdown") movementKeys.down = true;
  else if (key === "a" || key === "arrowleft") movementKeys.left = true;
  else if (key === "d" || key === "arrowright") movementKeys.right = true;
  else if (key === "shift") movementKeys.run = true;
  else if (key === "p") {
    if (event.repeat) return;
    triggerFirstExtensionPropInteraction("hotkey");
    return;
  }
  else if (key === "o") {
    if (event.repeat) return;
    toggleFirstExtensionEnabled();
    return;
  }
  else if (key === "i") {
    if (event.repeat) return;
    runPetUserCommand("status");
    return;
  }
  else if (key === "u") {
    if (event.repeat) return;
    runPetUserCommand("announce-test");
    return;
  }
  else if (key === "y") {
    if (event.repeat) return;
    runPetUserCommand("bridge-test");
    return;
  }
  else if (key === "g") {
    if (event.repeat) return;
    runPetUserCommand("guardrail-test");
    return;
  }
  else if (key === "j") {
    if (event.repeat) return;
    runSpotifyProbe();
    return;
  }
  else if (key === "k") {
    if (event.repeat) return;
    runLocalMediaProbe();
    return;
  }
  else if (key === "l") {
    if (event.repeat) return;
    runFreshRssProbe();
    return;
  }
  else if (key === "m") {
    if (event.repeat) return;
    recordManualMusicRating();
    return;
  }
  else if (key === "1") {
    if (event.repeat) return;
    triggerBehaviorState("Reading", {
      reason: "manual_reading_hotkey",
      trigger: "hotkey-1",
      durationMs: 9000,
      onCompleteStateId: "Idle",
      context: {
        itemType: "book",
        title: "The Pragmatic Programmer",
        sourceLabel: "local library",
      },
    });
    return;
  }
  else if (key === "2") {
    if (event.repeat) return;
    triggerBehaviorState("PoolPlay", {
      reason: "manual_poolplay_hotkey",
      trigger: "hotkey-2",
    });
    return;
  }
  else if (key === "3") {
    if (event.repeat) return;
    simulateStateFallback();
    return;
  }
  else if (key === "4") {
    if (event.repeat) return;
    runStateDescriptionQuestion();
    return;
  }
  else if (key === "r") {
    if (event.repeat) return;
    recordManualTrackRating();
    return;
  }
  else if (key === "h") {
    if (event.repeat) return;
    runMemoryPromotionCheck();
    return;
  }
  else if (key === "n") {
    if (event.repeat) return;
    runProtectedIdentityWriteTest();
    return;
  }
  else if (key === " " || key === "spacebar") {
    if (!event.repeat) spriteJumpQueued = true;
  } else {
    return;
  }
  event.preventDefault();
}

function onMovementKeyUp(event) {
  if (!event || typeof event.key !== "string") return;
  const key = event.key.toLowerCase();
  if (key === "w" || key === "arrowup") movementKeys.up = false;
  else if (key === "s" || key === "arrowdown") movementKeys.down = false;
  else if (key === "a" || key === "arrowleft") movementKeys.left = false;
  else if (key === "d" || key === "arrowright") movementKeys.right = false;
  else if (key === "shift") movementKeys.run = false;
  else return;
  event.preventDefault();
}

function clearMovementKeys() {
  movementKeys.up = false;
  movementKeys.down = false;
  movementKeys.left = false;
  movementKeys.right = false;
  movementKeys.run = false;
  spriteJumpQueued = false;
}

async function loadSpriteRuntime(characterId) {
  if (
    !spriteRuntimeApi ||
    typeof spriteRuntimeApi.createSpriteRuntime !== "function" ||
    typeof window.petAPI.getAnimationManifest !== "function"
  ) {
    activeRenderMode = RENDER_MODES.procedural;
    return;
  }

  try {
    const payload = await window.petAPI.getAnimationManifest(characterId);
    spriteRuntime = spriteRuntimeApi.createSpriteRuntime(payload);
    spriteManifest = spriteRuntime.getManifest();
    activeRenderMode = RENDER_MODES.sprite;
    spriteDragRotation = 0;
    spriteDragRotationVel = 0;
    spriteWasDragDriving = false;
    fxParticles = [];
  } catch (error) {
    console.warn("[sprite] failed to load sprite runtime:", error);
    spriteRuntime = null;
    spriteManifest = null;
    spriteDragRotation = 0;
    spriteDragRotationVel = 0;
    spriteWasDragDriving = false;
    activeRenderMode = RENDER_MODES.procedural;
  }
}

function primeOverlaySpriteSheet(overlayId, metadata) {
  if (!metadata || overlaySpriteEntries.has(overlayId)) return;
  const image = new Image();
  const entry = {
    ...metadata,
    image,
    loaded: false,
    failed: false,
  };
  image.onload = () => {
    entry.loaded = true;
  };
  image.onerror = () => {
    entry.failed = true;
  };
  image.src = encodeURI(metadata.src);
  overlaySpriteEntries.set(overlayId, entry);
}

function loadOverlaySpriteSheets() {
  overlaySpriteEntries = new Map();
  for (const [overlayId, metadata] of Object.entries(OVERLAY_SPRITES)) {
    primeOverlaySpriteSheet(overlayId, metadata);
  }
}

function getOverlaySpriteEntry(overlayId) {
  if (!overlayId || !OVERLAY_SPRITES[overlayId]) return null;
  if (!overlaySpriteEntries.has(overlayId)) {
    primeOverlaySpriteSheet(overlayId, OVERLAY_SPRITES[overlayId]);
  }
  return overlaySpriteEntries.get(overlayId) || null;
}

async function triggerFirstExtensionPropInteraction(source = "manual") {
  if (typeof window.petAPI.getExtensions !== "function") return;
  if (typeof window.petAPI.interactWithExtensionProp !== "function") return;

  try {
    const snapshot = latestExtensionSnapshot || (await window.petAPI.getExtensions());
    if (!snapshot || !Array.isArray(snapshot.extensions)) return;

    const extension = snapshot.extensions.find(
      (entry) => entry.valid && Array.isArray(entry.props) && entry.props.length > 0
    );
    if (!extension) return;

    const prop = extension.props.find((entry) => entry.enabled) || extension.props[0];
    if (!prop) return;

    const result = await window.petAPI.interactWithExtensionProp(
      extension.extensionId,
      prop.id,
      source
    );
    if (!result?.ok) {
      console.warn("[extension] prop interaction failed:", result?.error || "unknown");
    }
  } catch (error) {
    console.warn("[extension] prop interaction failed:", error);
  }
}

async function toggleFirstExtensionEnabled() {
  if (typeof window.petAPI.getExtensions !== "function") return;
  if (typeof window.petAPI.setExtensionEnabled !== "function") return;

  try {
    const snapshot = latestExtensionSnapshot || (await window.petAPI.getExtensions());
    if (!snapshot || !Array.isArray(snapshot.extensions)) return;

    const extension = snapshot.extensions.find((entry) => entry.valid);
    if (!extension) return;

    const result = await window.petAPI.setExtensionEnabled(
      extension.extensionId,
      !extension.enabled
    );
    if (result?.snapshot && typeof result.snapshot === "object") {
      latestExtensionSnapshot = result.snapshot;
    }
  } catch (error) {
    console.warn("[extension] toggle failed:", error);
  }
}

async function runPetUserCommand(command) {
  if (typeof window.petAPI.runUserCommand !== "function") return;
  try {
    const result = await window.petAPI.runUserCommand(command);
    if (!result?.ok) {
      console.warn("[contract] user command failed:", result?.error || "unknown");
      return;
    }
    const suggestionTypes = Array.isArray(result.suggestions)
      ? result.suggestions.map((entry) => entry?.type || "unknown").join(",")
      : "none";
    console.info(
      `[contract] command=${command} correlationId=${result.correlationId || "n/a"} suggestions=${suggestionTypes}`
    );
  } catch (error) {
    console.warn("[contract] user command failed:", error);
  }
}

async function runShellAction(actionId) {
  if (typeof window.petAPI.runShellAction !== "function") return;
  try {
    const result = await window.petAPI.runShellAction(actionId);
    if (!result?.ok) {
      console.warn("[shell] action failed:", result?.error || "unknown");
      return;
    }
    if (result.shellState && typeof result.shellState === "object") {
      syncShellState(result.shellState);
    }
    console.info(`[shell] action=${actionId}`);
  } catch (error) {
    console.warn("[shell] action failed:", error);
  }
}

async function triggerBehaviorState(stateId, options = {}) {
  if (typeof window.petAPI.triggerBehaviorState !== "function") return;
  try {
    const result = await window.petAPI.triggerBehaviorState(stateId, options);
    if (!result?.ok) {
      console.warn("[state] trigger failed:", result?.error || "unknown");
      return;
    }
    if (result.snapshot && typeof result.snapshot === "object") {
      latestStateSnapshot = result.snapshot;
    }
    console.info(
      `[state] current=${result.snapshot?.currentState || stateId} phase=${result.snapshot?.phase || "none"} fallback=${result.snapshot?.visualFallbackUsed ? "yes" : "no"}`
    );
  } catch (error) {
    console.warn("[state] trigger failed:", error);
  }
}

async function simulateStateFallback() {
  if (typeof window.petAPI.simulateStateFallback !== "function") return;
  try {
    const result = await window.petAPI.simulateStateFallback();
    if (!result?.ok) {
      console.warn("[state] fallback simulation failed:", result?.error || "unknown");
      return;
    }
    if (result.snapshot && typeof result.snapshot === "object") {
      latestStateSnapshot = result.snapshot;
    }
    console.info(
      `[state] fallback simulation current=${result.snapshot?.currentState || "unknown"} fallback=${result.snapshot?.visualFallbackUsed ? "yes" : "no"}`
    );
  } catch (error) {
    console.warn("[state] fallback simulation failed:", error);
  }
}

function runStateDescriptionQuestion() {
  const question =
    latestStateSnapshot?.currentState === "Reading"
      ? "what are you reading?"
      : "what are you doing?";
  void runPetUserCommand(question);
}

async function recordManualMusicRating() {
  if (typeof window.petAPI.recordMusicRating !== "function") return;
  try {
    const result = await window.petAPI.recordMusicRating(8, "manual-track");
    if (!result?.ok) {
      console.warn("[memory] music rating record failed:", result?.error || "unknown");
      return;
    }
    console.info(
      `[memory] music rating recorded adapter=${result.adapterMode || "unknown"} target=${result.targetPath || "n/a"}`
    );
  } catch (error) {
    console.warn("[memory] music rating record failed:", error);
  }
}

async function runSpotifyProbe() {
  if (typeof window.petAPI.probeSpotifyIntegration !== "function") return;
  try {
    const result = await window.petAPI.probeSpotifyIntegration();
    if (!result?.probe) {
      console.warn("[integration] spotify probe failed:", result?.error || "unknown");
      return;
    }
    console.info(
      `[integration] spotify probe state=${result.probe?.capabilityState || "unknown"} fallback=${result.probe?.fallbackMode || "none"}`
    );
  } catch (error) {
    console.warn("[integration] spotify probe failed:", error);
  }
}

async function runLocalMediaProbe() {
  if (typeof window.petAPI.probeLocalMedia !== "function") return;
  try {
    const result = await window.petAPI.probeLocalMedia();
    const snapshot = result?.snapshot || null;
    if (!snapshot) {
      console.warn("[local-media] probe failed:", result?.error || "unknown");
      return;
    }
    console.info(
      `[local-media] playing=${snapshot.isPlaying ? "yes" : "no"} app=${snapshot.sourceAppLabel || "Windows Media"} route=${snapshot.outputRoute || "unknown"}`
    );
  } catch (error) {
    console.warn("[local-media] probe failed:", error);
  }
}

async function runFreshRssProbe() {
  if (typeof window.petAPI.probeFreshRssIntegration !== "function") return;
  try {
    const result = await window.petAPI.probeFreshRssIntegration();
    if (!result?.probe) {
      console.warn("[integration] freshrss probe failed:", result?.error || "unknown");
      return;
    }
    console.info(
      `[integration] freshrss probe state=${result.probe?.capabilityState || "unknown"} fallback=${result.probe?.fallbackMode || "none"}`
    );
  } catch (error) {
    console.warn("[integration] freshrss probe failed:", error);
  }
}

async function recordManualTrackRating() {
  if (typeof window.petAPI.recordTrackRating !== "function") return;
  try {
    const result = await window.petAPI.recordTrackRating({
      provider: "spotify",
      rating: 9,
      trackTitle: "Night Drive",
      artist: "Primea FM",
      album: "Sample Rotation",
    });
    if (!result?.ok) {
      console.warn("[integration] track rating record failed:", result?.error || "unknown");
      return;
    }
    console.info(
      `[integration] track rating recorded adapter=${result.adapterMode || "unknown"} target=${result.targetPath || "n/a"}`
    );
  } catch (error) {
    console.warn("[integration] track rating record failed:", error);
  }
}

async function runMemoryPromotionCheck() {
  if (typeof window.petAPI.runMemoryPromotionCheck !== "function") return;
  try {
    const result = await window.petAPI.runMemoryPromotionCheck({
      candidateType: "adaptive_music_preference",
      focusObservationType: "music_rating",
    });
    if (!result?.ok) {
      console.warn("[memory] promotion check failed:", result?.error || "unknown");
      return;
    }
    const decision = result.decision || {};
    console.info(
      `[memory] promotion decision outcome=${decision.outcome || "unknown"} reasons=${(decision.reasons || []).join(",") || "none"}`
    );
  } catch (error) {
    console.warn("[memory] promotion check failed:", error);
  }
}

async function runProtectedIdentityWriteTest() {
  if (typeof window.petAPI.testProtectedIdentityWrite !== "function") return;
  try {
    const result = await window.petAPI.testProtectedIdentityWrite();
    const outcome = result?.auditEntry?.outcome || "unknown";
    const reason = result?.auditEntry?.reason || "none";
    console.info(`[memory] identity mutation test outcome=${outcome} reason=${reason}`);
  } catch (error) {
    console.warn("[memory] identity mutation test failed:", error);
  }
}

function updateSpriteDragRotation(dtSec) {
  const vx = latestMotion.velocity?.vx ?? 0;
  const dragging = Boolean(latestMotion.dragging);
  const drivingDrag =
    dragging &&
    Math.abs(vx) >= SPRITE_DRAG_STOP_SPEED &&
    Math.abs(vx) >= SPRITE_DRAG_ROTATION_MIN_VX;
  const target =
    drivingDrag
      ? clamp(vx / SPRITE_DRAG_ROTATION_VX_FOR_MAX, -1, 1) * SPRITE_DRAG_ROTATION_MAX_RAD
      : 0;
  const safeDt = Math.min(0.04, Math.max(0.001, dtSec));

  if (!drivingDrag && spriteWasDragDriving) {
    const snapKick =
      -Math.sign(spriteDragRotation || vx || 1) *
      Math.min(9, Math.abs(spriteDragRotation) * SPRITE_DRAG_ROTATION_SNAP_KICK);
    spriteDragRotationVel += snapKick;
  }
  spriteWasDragDriving = drivingDrag;

  let stiffness = SPRITE_DRAG_ROTATION_STIFFNESS_RELEASE;
  let damping = SPRITE_DRAG_ROTATION_DAMPING_RELEASE;
  if (drivingDrag) {
    stiffness = SPRITE_DRAG_ROTATION_STIFFNESS_DRAG;
    damping = SPRITE_DRAG_ROTATION_DAMPING_DRAG;
  } else if (dragging) {
    stiffness = SPRITE_DRAG_ROTATION_STIFFNESS_SNAP;
    damping = SPRITE_DRAG_ROTATION_DAMPING_SNAP;
  }

  const acceleration =
    (target - spriteDragRotation) * stiffness - spriteDragRotationVel * damping;
  spriteDragRotationVel += acceleration * safeDt;
  spriteDragRotation += spriteDragRotationVel * safeDt;
  spriteDragRotation = clamp(
    spriteDragRotation,
    -SPRITE_DRAG_ROTATION_MAX_RAD * 1.35,
    SPRITE_DRAG_ROTATION_MAX_RAD * 1.35
  );

  if (
    !dragging &&
    Math.abs(spriteDragRotation) < 0.0008 &&
    Math.abs(spriteDragRotationVel) < 0.02
  ) {
    spriteDragRotation = 0;
    spriteDragRotationVel = 0;
    spriteWasDragDriving = false;
  }
}

function getSpriteLayerTransforms() {
  const visualBounds = getDesignVisualBounds();
  const cell = spriteManifest?.cell || { width: 256, height: 256 };
  const targetHeightPx = Math.max(1, spriteManifest?.display?.targetHeightPx || 220);
  const scale = targetHeightPx / Math.max(1, cell.height);
  const drawWidth = cell.width * scale;
  const drawHeight = cell.height * scale;
  const drawX = visualBounds.x + (visualBounds.width - drawWidth) * 0.5;
  const drawY = visualBounds.y + (visualBounds.height - drawHeight) * 0.5;
  const anchorX = drawX + drawWidth * 0.5;
  const anchorY = drawY + drawHeight * SPRITE_DRAG_PIVOT_TOP_RATIO;

  return {
    global: {
      rotation: spriteDragRotation,
      anchorX,
      anchorY,
    },
    spriteDrawRect: {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight,
    },
    fx: {},
  };
}

function computeSpriteFrameTransform(frame, layerTransforms) {
  const globalTransform = layerTransforms?.global;
  if (!frame || !globalTransform) return null;
  const cell = frame.cell || { width: 256, height: 256 };
  const targetHeightPx = Math.max(1, frame.targetHeightPx || 220);
  const scale = targetHeightPx / Math.max(1, cell.height);

  const drawRect =
    layerTransforms?.spriteDrawRect ||
    (() => {
      const pivot = frame.pivotPx || { x: cell.width / 2, y: cell.height };
      return {
        x: globalTransform.anchorX - pivot.x * scale,
        y: globalTransform.anchorY - pivot.y * scale,
        width: cell.width * scale,
        height: cell.height * scale,
      };
    })();

  const hitboxSource = frame.hitboxPx || { x: 0, y: 0, width: cell.width, height: cell.height };
  const hitRect = {
    x: drawRect.x + hitboxSource.x * scale,
    y: drawRect.y + hitboxSource.y * scale,
    width: Math.max(1, hitboxSource.width * scale),
    height: Math.max(1, hitboxSource.height * scale),
  };

  return {
    drawRect,
    hitRect,
  };
}

function computeRotatedAabb(rect, anchorX, anchorY, angleRad) {
  const corners = [
    rotatePointAround(rect.x, rect.y, anchorX, anchorY, angleRad),
    rotatePointAround(rect.x + rect.width, rect.y, anchorX, anchorY, angleRad),
    rotatePointAround(rect.x + rect.width, rect.y + rect.height, anchorX, anchorY, angleRad),
    rotatePointAround(rect.x, rect.y + rect.height, anchorX, anchorY, angleRad),
  ];

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const corner of corners) {
    minX = Math.min(minX, corner.x);
    maxX = Math.max(maxX, corner.x);
    minY = Math.min(minY, corner.y);
    maxY = Math.max(maxY, corner.y);
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function computeSpriteVisibleBounds(frameTransform, globalTransform, windowWidth, windowHeight) {
  if (!frameTransform || !globalTransform) return null;
  const rotated = computeRotatedAabb(
    frameTransform.hitRect,
    globalTransform.anchorX,
    globalTransform.anchorY,
    globalTransform.rotation || 0
  );
  return {
    x: clamp(rotated.x, -windowWidth, windowWidth * 2),
    y: clamp(rotated.y, -windowHeight, windowHeight * 2),
    width: clamp(rotated.width, 1, windowWidth * 3),
    height: clamp(rotated.height, 1, windowHeight * 3),
  };
}

function updateSpriteFrame(nowMs, dtSec, layerTransforms) {
  if (!spriteRuntime || activeRenderMode !== RENDER_MODES.sprite) {
    latestSpriteFrame = null;
    latestSpriteHitRect = null;
    return null;
  }

  const input = getSpriteInputState();
  const nextFrame = spriteRuntime.update(dtSec * 1000, input);
  latestSpriteFrame = nextFrame;

  const frameTransform = computeSpriteFrameTransform(nextFrame, layerTransforms);
  latestSpriteHitRect = frameTransform?.hitRect || null;

  return {
    frame: nextFrame,
    transform: frameTransform,
    global: layerTransforms?.global,
  };
}

function drawSpriteFrame(context, spriteFrame) {
  if (!spriteFrame?.frame || !spriteFrame?.transform) return false;
  const frame = spriteFrame.frame;
  if (!frame.imageLoaded || !frame.image || frame.imageFailed) return false;

  const src = frame.srcRect;
  const dest = spriteFrame.transform.drawRect;
  context.drawImage(
    frame.image,
    src.x,
    src.y,
    src.width,
    src.height,
    dest.x,
    dest.y,
    dest.width,
    dest.height
  );
  return true;
}

function isPointOnVisiblePet(px, py) {
  if (activeRenderMode === RENDER_MODES.sprite && latestSpriteHitRect && latestRigState?.global) {
    const localPoint = toRigLocalPoint(px, py);
    return pointInRect(localPoint.x, localPoint.y, latestSpriteHitRect);
  }

  if (!latestRigState?.body || !latestRigState?.tail) return false;
  const localPoint = toRigLocalPoint(px, py);
  const testX = localPoint.x;
  const testY = localPoint.y;

  const body = latestRigState.body;
  if (pointInCircle(testX, testY, body.x, body.y, body.radius + 1)) {
    return true;
  }

  const tail = latestRigState.tail;
  const halfWidth =
    Number.isFinite(tail.hitHalfWidth)
      ? tail.hitHalfWidth
      : ACTIVE_TAIL_STYLE === TAIL_STYLES.spike
        ? 14
        : ACTIVE_TAIL_STYLE === TAIL_STYLES.ribbon
          ? 6
          : 12;
  const tipRadius =
    Number.isFinite(tail.tipHitRadius)
      ? tail.tipHitRadius
      : ACTIVE_TAIL_STYLE === TAIL_STYLES.spike
        ? 10
        : ACTIVE_TAIL_STYLE === TAIL_STYLES.ribbon
          ? 8
          : 12;

  if (Array.isArray(tail.points) && tail.points.length > 1) {
    if (pointNearPolyline(testX, testY, tail.points, halfWidth)) {
      return true;
    }
    const tipPoint = tail.points[tail.points.length - 1];
    return pointInCircle(testX, testY, tipPoint.x, tipPoint.y, tipRadius);
  }

  const p0 = { x: tail.rootX, y: tail.rootY };
  const p1 = { x: tail.ctrlX, y: tail.ctrlY };
  const p2 = { x: tail.tipX, y: tail.tipY };

  if (ACTIVE_TAIL_STYLE === TAIL_STYLES.segmented) {
    const segmentRadii = [12, 10, 8, 6];
    const segmentT = [0.18, 0.4, 0.66, 0.92];
    for (let i = 0; i < segmentT.length; i += 1) {
      const point = pointOnQuadratic(segmentT[i], p0, p1, p2);
      if (pointInCircle(testX, testY, point.x, point.y, segmentRadii[i] + 2)) {
        return true;
      }
    }
  }

  if (pointNearQuadraticStroke(testX, testY, p0, p1, p2, halfWidth)) {
    return true;
  }

  return pointInCircle(testX, testY, tail.tipX, tail.tipY, tipRadius);
}

function setMousePassthrough(ignore) {
  if (typeof window.petAPI.setIgnoreMouseEvents !== "function") return;
  if (mousePassthrough === ignore) return;
  mousePassthrough = ignore;
  window.petAPI.setIgnoreMouseEvents(ignore, true);
}

function updateMouseInteractivity(clientX, clientY) {
  const designPoint = toDesignPoint(clientX, clientY);
  const inside = pointInCanvas(designPoint.x, designPoint.y);
  pointerInCanvas = inside;

  if (inside) {
    pointerClient = { x: clientX, y: clientY };
  }

  if (dragging) {
    setMousePassthrough(false);
    return;
  }

  if (dialogSurfaceOpen) {
    setMousePassthrough(false);
    return;
  }

  if (!inside) {
    setMousePassthrough(true);
    return;
  }

  const hitVisiblePet = isPointOnVisiblePet(designPoint.x, designPoint.y);
  setMousePassthrough(!hitVisiblePet);
}

function requestMouseInteractivityUpdate(clientX, clientY) {
  pendingInteractivityClient = { x: clientX, y: clientY };
  if (interactivityRafPending) return;
  interactivityRafPending = true;
  requestAnimationFrame(() => {
    interactivityRafPending = false;
    if (!pendingInteractivityClient) return;
    const next = pendingInteractivityClient;
    pendingInteractivityClient = null;
    updateMouseInteractivity(next.x, next.y);
  });
}

function formatPoint(point) {
  if (!point) return "(n/a)";
  return `(${point.x}, ${point.y})`;
}

function formatRect(rect) {
  if (!rect) return "(n/a)";
  return `x:${rect.x} y:${rect.y} w:${rect.width} h:${rect.height}`;
}

function getCapabilityStateLabel(capabilityId) {
  const capabilities = Array.isArray(latestCapabilitySnapshot?.capabilities)
    ? latestCapabilitySnapshot.capabilities
    : [];
  const match = capabilities.find((entry) => entry?.capabilityId === capabilityId);
  return match?.state || "n/a";
}

function getBehaviorStateLabel() {
  if (!latestStateSnapshot?.currentState) return "Idle";
  return latestStateSnapshot.phase
    ? `${latestStateSnapshot.currentState}/${latestStateSnapshot.phase}`
    : latestStateSnapshot.currentState;
}

function getIntegrationEventLabel() {
  if (!latestIntegrationEvent) return "n/a";
  if (latestIntegrationEvent.kind === "localMedia") {
    return `localMedia:${latestIntegrationEvent.sourceAppLabel || "Windows Media"}:${latestIntegrationEvent.outputRoute || "unknown"}`;
  }
  return `${latestIntegrationEvent.kind || "?"}${latestIntegrationEvent.fallbackMode ? `:${latestIntegrationEvent.fallbackMode}` : ""}`;
}

function getBehaviorVisualBinding() {
  return latestStateSnapshot?.visual && typeof latestStateSnapshot.visual === "object"
    ? latestStateSnapshot.visual
    : null;
}

function deriveRenderState(nowMs) {
  if (nowMs < impactStateUntilMs) return "impact";
  if (latestMotion.dragging) return "dragging";
  if (latestMotion.flinging) return "flying";
  return "idle";
}

function computeRigRotationTarget(state, vx, vy) {
  if (state === "dragging") {
    if (Math.abs(vx) > 65) {
      rigInversionSign = vx >= 0 ? 1 : -1;
    }
    const sideTilt = clamp(vx / 1050, -1, 1) * RIG_ROTATION_SIDE_MAX_RAD;
    const downAmount = clamp01((vy - RIG_ROTATION_DOWN_THRESHOLD) / RIG_ROTATION_DOWN_SPEED);
    const inversionTarget = rigInversionSign >= 0 ? Math.PI : -Math.PI;
    return sideTilt * (1 - downAmount) + inversionTarget * downAmount;
  }

  if (state === "flying" || state === "impact") {
    return clamp(vx / 1200, -1, 1) * RIG_ROTATION_FLY_MAX_RAD;
  }

  return 0;
}

function scheduleNextBlink(nowMs) {
  nextBlinkMs = nowMs + randomRange(BLINK_MIN_INTERVAL_MS, BLINK_MAX_INTERVAL_MS);
}

function updateBlink(nowMs) {
  if (nextBlinkMs === 0) {
    scheduleNextBlink(nowMs);
  }

  if (!blinkActive && nowMs >= nextBlinkMs) {
    blinkActive = true;
    blinkStartMs = nowMs;
    blinkEndMs = nowMs + BLINK_DURATION_MS;
  }

  if (!blinkActive) {
    blinkAmount = 0;
    return;
  }

  const progress = clamp01((nowMs - blinkStartMs) / Math.max(1, blinkEndMs - blinkStartMs));
  const upDown = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
  blinkAmount = 1 - (1 - upDown) * (1 - upDown);

  if (progress >= 1) {
    blinkActive = false;
    blinkAmount = 0;
    scheduleNextBlink(nowMs);
  }
}

function getMouseDrivenGaze(faceX, faceY) {
  const cursor = getCursorInWindowSpace();
  if (!cursor) return null;
  if (!pointInCanvas(cursor.x, cursor.y)) return null;
  if (!isPointOnVisiblePet(cursor.x, cursor.y)) return null;

  const dx = cursor.x - faceX;
  const dy = cursor.y - faceY;
  const dist = Math.hypot(dx, dy);
  if (dist > GAZE_NEAR_RADIUS) return null;
  const distSafe = Math.max(0.001, dist);
  const nx = dx / distSafe;
  const ny = dy / distSafe;
  const intensity = gazeIntensity(dist, GAZE_NEAR_RADIUS);
  return {
    x: clamp(nx * intensity * GAZE_MAX_X, -GAZE_MAX_X, GAZE_MAX_X),
    y: clamp(ny * intensity * GAZE_MAX_Y, -GAZE_MAX_Y, GAZE_MAX_Y),
  };
}

function getGlobalCursorDrivenGaze(faceX, faceY) {
  const cursor = getCursorInWindowSpace();
  if (!cursor) return null;
  const dx = cursor.x - faceX;
  const dy = cursor.y - faceY;
  const dist = Math.hypot(dx, dy);
  if (dist > GAZE_GLOBAL_RADIUS) return null;
  const distSafe = Math.max(0.001, dist);
  const nx = dx / distSafe;
  const ny = dy / distSafe;
  const intensity = gazeIntensity(dist, GAZE_GLOBAL_RADIUS);
  return {
    x: clamp(nx * intensity * GAZE_MAX_X, -GAZE_MAX_X, GAZE_MAX_X),
    y: clamp(ny * intensity * GAZE_MAX_Y, -GAZE_MAX_Y, GAZE_MAX_Y),
  };
}

function updateGaze(nowMs, dtSec, faceX, faceY) {
  const previousSource = gazeSource;
  const mouseGaze = getMouseDrivenGaze(faceX, faceY);
  const globalGaze = getGlobalCursorDrivenGaze(faceX, faceY);

  if (mouseGaze) {
    gazeSource = "local";
    gazeTarget.x = mouseGaze.x;
    gazeTarget.y = mouseGaze.y;
    globalGazeReleaseUntilMs = 0;
  } else if (globalGaze) {
    gazeSource = "global";
    gazeTarget.x = globalGaze.x;
    gazeTarget.y = globalGaze.y;
    globalGazeReleaseUntilMs = nowMs + GAZE_GLOBAL_RELEASE_DELAY_MS;
  } else if (nowMs < globalGazeReleaseUntilMs) {
    gazeSource = "global-hold";
  } else {
    if (
      previousSource === "local" ||
      previousSource === "global" ||
      previousSource === "global-hold"
    ) {
      nextGazeDartMs = 0;
    }

    if (nowMs >= nextGazeDartMs) {
      gazeSource = "dart";
      const dartX = GAZE_MAX_X * GAZE_DART_AMPLITUDE;
      const dartY = GAZE_MAX_Y * GAZE_DART_AMPLITUDE;
      const dartTargets = [
        { x: -dartX, y: 0 },
        { x: dartX, y: 0 },
        { x: 0, y: -dartY },
        { x: 0, y: dartY },
        { x: -dartX * 0.45, y: -dartY * 0.4 },
        { x: dartX * 0.45, y: -dartY * 0.4 },
        { x: 0, y: 0 },
      ];
      const next = pickRandom(dartTargets);
      gazeTarget.x = next.x;
      gazeTarget.y = next.y;
      nextGazeDartMs = nowMs + randomRange(GAZE_DART_MIN_MS, GAZE_DART_MAX_MS);
    } else {
      gazeSource = "hold";
    }
  }

  const follow = 1 - Math.exp(-GAZE_FOLLOW_SPEED * dtSec);
  gazeOffset.x += (gazeTarget.x - gazeOffset.x) * follow;
  gazeOffset.y += (gazeTarget.y - gazeOffset.y) * follow;
}

function syncMouseInteractivityFromGlobalCursor() {
  if (dialogSurfaceOpen) {
    setMousePassthrough(false);
    return;
  }

  const cursor = getCursorInWindowSpacePx();
  if (!cursor) {
    if (!dragging) setMousePassthrough(true);
    pointerInCanvas = false;
    lastSyncedCursorPx = null;
    lastSyncedDragging = dragging;
    return;
  }

  const unchangedCursor =
    lastSyncedCursorPx &&
    Math.abs(lastSyncedCursorPx.x - cursor.x) < 0.5 &&
    Math.abs(lastSyncedCursorPx.y - cursor.y) < 0.5;
  if (unchangedCursor && lastSyncedDragging === dragging) {
    return;
  }

  lastSyncedCursorPx = { x: cursor.x, y: cursor.y };
  lastSyncedDragging = dragging;
  updateMouseInteractivity(cursor.x, cursor.y);
}

function getRigAnchor() {
  const visualBounds = getDesignVisualBounds();
  return {
    x: visualBounds.x + visualBounds.width / 2,
    y: visualBounds.y + visualBounds.height / 2,
  };
}

function integrateSpring(node, targetX, targetY, stiffness, damping, dtSec, maxDist) {
  const ax = (targetX - node.x) * stiffness - node.vx * damping;
  const ay = (targetY - node.y) * stiffness - node.vy * damping;

  node.vx += ax * dtSec;
  node.vy += ay * dtSec;
  node.x += node.vx * dtSec;
  node.y += node.vy * dtSec;

  const dist = Math.hypot(node.x, node.y);
  if (dist > maxDist && dist > 0) {
    const scale = maxDist / dist;
    node.x *= scale;
    node.y *= scale;
    node.vx *= 0.85;
    node.vy *= 0.85;
  }
}

function reinitializeTailRope(rootX, rootY, segmentLength, segmentCount) {
  tailRope.points = [];
  tailRope.prevPoints = [];

  for (let i = 0; i <= segmentCount; i += 1) {
    const x = rootX;
    const y = rootY + i * segmentLength;
    tailRope.points.push({ x, y });
    tailRope.prevPoints.push({ x, y });
  }

  tailRope.segmentLength = segmentLength;
  tailRope.segmentCount = segmentCount;
}

function updateTailRope({
  rootX,
  rootY,
  segmentLength,
  segmentCount,
  dtSec,
  driveX,
  driveY,
  gravity,
  visualBounds,
}) {
  const needsReset =
    tailRope.points.length !== segmentCount + 1 ||
    Math.abs(tailRope.segmentLength - segmentLength) > 0.75 ||
    tailRope.segmentCount !== segmentCount;

  if (needsReset) {
    reinitializeTailRope(rootX, rootY, segmentLength, segmentCount);
  }

  if (tailRope.points.length === 0) {
    reinitializeTailRope(rootX, rootY, segmentLength, segmentCount);
  }

  const rootDistance = Math.hypot(tailRope.points[0].x - rootX, tailRope.points[0].y - rootY);
  if (rootDistance > segmentLength * 4) {
    reinitializeTailRope(rootX, rootY, segmentLength, segmentCount);
  }

  const points = tailRope.points;
  const prevPoints = tailRope.prevPoints;
  const dtSq = dtSec * dtSec;
  const segmentWeight = TAIL_WEIGHT_FACTOR;
  const driveScale = 1 / (1 + (segmentWeight - 1) * 1.35);
  const inertiaScale = 1 / (1 + (segmentWeight - 1) * 0.45);

  for (let i = 1; i <= segmentCount; i += 1) {
    const p = points[i];
    const prev = prevPoints[i];
    const vx = (p.x - prev.x) * TAIL_ROPE_DAMPING;
    const vy = (p.y - prev.y) * TAIL_ROPE_DAMPING;
    prev.x = p.x;
    prev.y = p.y;

    const influence = i / segmentCount;
    const distalT = clamp01((influence - TAIL_DISTAL_MOTION_START) / (1 - TAIL_DISTAL_MOTION_START));
    const distalBoost = 1 + TAIL_DISTAL_MOTION_BOOST * distalT * distalT;
    const driveInfluence = Math.pow(influence, 1.16) * distalBoost;
    const segmentInertiaScale = inertiaScale * (1 + TAIL_DISTAL_INERTIA_BOOST * distalT);

    p.x += vx * segmentInertiaScale + driveX * driveInfluence * driveScale;
    p.y +=
      vy * segmentInertiaScale +
      driveY * driveInfluence * driveScale +
      gravity * segmentWeight * dtSq;
  }

  points[0].x = rootX;
  points[0].y = rootY;
  prevPoints[0].x = rootX;
  prevPoints[0].y = rootY;

  for (let iteration = 0; iteration < TAIL_ROPE_ITERATIONS; iteration += 1) {
    points[0].x = rootX;
    points[0].y = rootY;

    for (let i = 0; i < segmentCount; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(0.0001, Math.hypot(dx, dy));
      const diff = (dist - segmentLength) / dist;

      if (i === 0) {
        b.x -= dx * diff;
        b.y -= dy * diff;
      } else {
        a.x += dx * diff * 0.5;
        a.y += dy * diff * 0.5;
        b.x -= dx * diff * 0.5;
        b.y -= dy * diff * 0.5;
      }
    }

    const minX = visualBounds.x + 4;
    const maxX = visualBounds.x + visualBounds.width - 4;
    const minY = visualBounds.y + 4;
    const maxY = visualBounds.y + visualBounds.height - 4;

    for (let i = 1; i <= segmentCount; i += 1) {
      points[i].x = clamp(points[i].x, minX, maxX);
      points[i].y = clamp(points[i].y, minY, maxY);
    }
  }

  return points;
}

function spawnImpactFx(motion) {
  const nowMs = performance.now();
  if (nowMs - lastImpactSpawnMs < 45) return;
  lastImpactSpawnMs = nowMs;

  const strength = clamp01(motion.impact?.strength ?? 0.25);
  const anchor = getRigAnchor();
  const visualBounds = getDesignVisualBounds();

  let originX = anchor.x;
  let originY = anchor.y;

  if (motion.collided?.x) {
    const hitRightWall = (motion.velocity?.vx ?? 0) < 0;
    originX = hitRightWall
      ? visualBounds.x + visualBounds.width - 10
      : visualBounds.x + 10;
    originY = anchor.y + randomRange(-34, 34);
  } else if (motion.collided?.y) {
    const hitBottomWall = (motion.velocity?.vy ?? 0) < 0;
    originY = hitBottomWall
      ? visualBounds.y + visualBounds.height - 10
      : visualBounds.y + 10;
    originX = anchor.x + randomRange(-42, 42);
  }

  const puffCount = 4 + Math.round(strength * 4);
  for (let i = 0; i < puffCount; i += 1) {
    fxParticles.push({
      type: "puff",
      x: originX,
      y: originY,
      vx: randomRange(-95, 95) * (0.6 + strength * 0.8),
      vy: randomRange(-85, 30) * (0.6 + strength * 0.8),
      ageMs: 0,
      maxAgeMs: 250 + randomRange(0, 260),
      size: 7 + randomRange(0, 6) + strength * 6,
      rotation: randomRange(0, Math.PI * 2),
      spin: randomRange(-3.5, 3.5),
    });
  }

  if (strength >= 0.55) {
    const starCount = clamp(2 + Math.round((strength - 0.55) * 6), 2, 4);
    for (let i = 0; i < starCount; i += 1) {
      fxParticles.push({
        type: "star",
        x: originX + randomRange(-12, 12),
        y: originY + randomRange(-10, 10),
        vx: randomRange(-65, 65) * (0.55 + strength * 0.55),
        vy: randomRange(-95, -30) * (0.55 + strength * 0.55),
        ageMs: 0,
        maxAgeMs: 320 + randomRange(0, 260),
        size: 4 + randomRange(0, 4) + strength * 3,
        rotation: randomRange(0, Math.PI * 2),
        spin: randomRange(-7, 7),
      });
    }
  }

  if (fxParticles.length > MAX_FX_PARTICLES) {
    fxParticles = fxParticles.slice(-MAX_FX_PARTICLES);
  }
}

function spawnIntegrationFx(payload) {
  const anchor = getRigAnchor();
  const starCount = payload?.kind === "trackRatingRecorded" ? 4 : 6;
  for (let i = 0; i < starCount; i += 1) {
    fxParticles.push({
      type: "star",
      x: anchor.x + randomRange(-18, 18),
      y: anchor.y - 26 + randomRange(-10, 10),
      vx: randomRange(-55, 55),
      vy: randomRange(-135, -40),
      ageMs: 0,
      maxAgeMs: 340 + randomRange(0, 220),
      size: 4 + randomRange(0, 4),
      rotation: randomRange(0, Math.PI * 2),
      spin: randomRange(-6, 6),
    });
  }
  if (fxParticles.length > MAX_FX_PARTICLES) {
    fxParticles = fxParticles.slice(-MAX_FX_PARTICLES);
  }
}

function updateFx(dtSec) {
  const dtMs = dtSec * 1000;

  for (const particle of fxParticles) {
    particle.ageMs += dtMs;
    particle.x += particle.vx * dtSec;
    particle.y += particle.vy * dtSec;
    particle.rotation += particle.spin * dtSec;

    if (particle.type === "puff") {
      particle.vx *= 0.9;
      particle.vy = particle.vy * 0.9 - 22 * dtSec;
    } else {
      particle.vx *= 0.95;
      particle.vy = particle.vy * 0.95 - 12 * dtSec;
    }
  }

  fxParticles = fxParticles.filter((particle) => particle.ageMs < particle.maxAgeMs);
}

function getLayerTransforms(nowMs, dtSec) {
  const visualBounds = getDesignVisualBounds();
  const visualWidth = visualBounds.width;
  const visualHeight = visualBounds.height;
  const rigScale = clamp(Math.min(visualWidth / 220, visualHeight / 220), 0.6, 2.4);
  const vx = latestMotion.velocity?.vx ?? 0;
  const vy = latestMotion.velocity?.vy ?? 0;
  const speed = latestMotion.velocity?.speed ?? 0;

  if (currentRenderState !== lastRotationState) {
    if (currentRenderState === "flying") {
      rigFlingHoldAngle = rigRotation;
      rigFlingHoldUntilMs = nowMs + RIG_ROTATION_FLING_HOLD_MS;
    }
    if (currentRenderState === "dragging") {
      rigFlingHoldUntilMs = 0;
    }
    lastRotationState = currentRenderState;
  }

  const motionFilterResponse =
    currentRenderState === "dragging"
      ? RIG_ROTATION_INPUT_FILTER_DRAG
      : currentRenderState === "flying" || currentRenderState === "impact"
        ? RIG_ROTATION_INPUT_FILTER_FLY
        : RIG_ROTATION_INPUT_FILTER_IDLE;
  const motionBlend = 1 - Math.exp(-motionFilterResponse * dtSec);
  rigFilteredVelocity.vx += (vx - rigFilteredVelocity.vx) * motionBlend;
  rigFilteredVelocity.vy += (vy - rigFilteredVelocity.vy) * motionBlend;

  let rigRotationTarget = computeRigRotationTarget(
    currentRenderState,
    rigFilteredVelocity.vx,
    rigFilteredVelocity.vy
  );
  if (
    (currentRenderState === "flying" || currentRenderState === "impact") &&
    rigFlingHoldUntilMs > 0
  ) {
    if (nowMs < rigFlingHoldUntilMs) {
      rigRotationTarget = rigFlingHoldAngle;
    } else {
      const releaseT = clamp01(
        (nowMs - rigFlingHoldUntilMs) / Math.max(1, RIG_ROTATION_FLING_RELEASE_BLEND_MS)
      );
      rigRotationTarget = normalizeAngleRad(
        rigFlingHoldAngle +
          shortestAngleDeltaRad(rigFlingHoldAngle, rigRotationTarget) * releaseT
      );
    }
  }

  const targetFilterResponse =
    currentRenderState === "dragging"
      ? RIG_ROTATION_TARGET_FILTER_DRAG
      : currentRenderState === "flying" || currentRenderState === "impact"
        ? RIG_ROTATION_TARGET_FILTER_FLY
        : RIG_ROTATION_TARGET_FILTER_IDLE;
  const targetFilterBlend = 1 - Math.exp(-targetFilterResponse * dtSec);
  const targetFilterDelta = shortestAngleDeltaRad(rigRotationTargetFiltered, rigRotationTarget);
  const filteredDelta =
    currentRenderState === "dragging" && Math.abs(targetFilterDelta) < RIG_ROTATION_DRAG_DEADBAND_RAD
      ? 0
      : targetFilterDelta;
  rigRotationTargetFiltered = normalizeAngleRad(
    rigRotationTargetFiltered + filteredDelta * targetFilterBlend
  );

  const rigRotationResponse =
    currentRenderState === "dragging"
      ? RIG_ROTATION_DRAG_RESPONSE
      : currentRenderState === "flying" || currentRenderState === "impact"
        ? RIG_ROTATION_FLY_RESPONSE
        : RIG_ROTATION_RELEASE_RESPONSE;
  const rotationBlend = 1 - Math.exp(-rigRotationResponse * dtSec);
  const rotationDelta = shortestAngleDeltaRad(rigRotation, rigRotationTargetFiltered);
  rigRotation = normalizeAngleRad(rigRotation + rotationDelta * rotationBlend);
  if (currentRenderState === "idle" && Math.abs(rigRotation) < 0.0006) {
    rigRotation = 0;
    rigRotationTargetFiltered = 0;
  }

  const stateScale = {
    idle: 0.1,
    dragging: 1.4,
    flying: 1.25,
    impact: 1.35,
  }[currentRenderState] || 0.2;

  const breathing = Math.sin(nowMs * 0.0026) * (1.2 * rigScale + 0.6);
  const tailSwayBase =
    ((currentRenderState === "idle" ? 1.9 : 0.75) + Math.min(2.5, speed * 0.0007)) * rigScale;
  const tailSwayX = Math.sin(nowMs * 0.0018 + speed * 0.00045) * tailSwayBase;
  const tailSwayY = Math.cos(nowMs * 0.00125 + 1.5) * tailSwayBase * 0.16;

  integrateSpring(
    lag.eyes,
    -vx * 0.0072 * stateScale,
    -vy * 0.0072 * stateScale,
    118,
    22,
    dtSec,
    16 * rigScale
  );

  integrateSpring(
    lag.mouth,
    -vx * 0.0105 * stateScale,
    -vy * 0.0105 * stateScale,
    102,
    19,
    dtSec,
    22 * rigScale
  );

  integrateSpring(
    lag.tail,
    -vx * 0.024 * stateScale + tailSwayX,
    -vy * 0.014 * stateScale + tailSwayY,
    70,
    10,
    dtSec,
    82 * rigScale
  );

  let bodyJoltX = 0;
  let bodyJoltY = 0;
  const impactAgeSec = (nowMs - impactImpulse.tMs) / 1000;
  if (impactAgeSec >= 0 && impactAgeSec < 0.26) {
    const decay = Math.exp(-8 * impactAgeSec) * impactImpulse.strength;
    const wobble = Math.sin(impactAgeSec * 48);
    bodyJoltX = impactImpulse.x * decay * wobble;
    bodyJoltY = impactImpulse.y * decay * wobble;
  }

  const topMargin = Math.max(6, visualHeight * 0.035);
  const bottomMargin = Math.max(8, visualHeight * 0.045);
  const tailLengthTarget = Math.max(30, visualHeight * 0.34);
  const maxBodyRadiusByHeight = (visualHeight - topMargin - bottomMargin - tailLengthTarget) / 2;
  const maxBodyRadiusByWidth = visualWidth * 0.42;
  const bodyRadius = clamp(Math.min(maxBodyRadiusByHeight, maxBodyRadiusByWidth), 28, 160);

  const bodyX = visualBounds.x + visualWidth / 2 + bodyJoltX * rigScale;
  const bodyY = visualBounds.y + topMargin + bodyRadius + breathing + bodyJoltY * rigScale;
  const tailRootX = bodyX;
  const tailRootY = bodyY + bodyRadius * 0.95;
  const tailBaseLength = Math.max(24, visualBounds.y + visualHeight - bottomMargin - tailRootY);
  const ropeSegmentLength = Math.max(6, tailBaseLength / TAIL_SEGMENT_COUNT);
  const ropeDriveX =
    clamp(-vx * 0.0012 * stateScale, -8 * rigScale, 8 * rigScale) + lag.tail.x * 0.06;
  const ropeDriveYLinear = clamp(-vy * 0.00045 * stateScale, -3.2 * rigScale, 3.2 * rigScale);
  const ropeDriveYUpwardClamp = Math.min(ropeDriveYLinear, 0.45 * rigScale);
  const ropeDriveY = ropeDriveYUpwardClamp + lag.tail.y * 0.02;
  const ropePoints = updateTailRope({
    rootX: tailRootX,
    rootY: tailRootY,
    segmentLength: ropeSegmentLength,
    segmentCount: TAIL_SEGMENT_COUNT,
    dtSec,
    driveX: ropeDriveX,
    driveY: ropeDriveY,
    gravity: 520 * rigScale,
    visualBounds,
  });
  const tailTipPoint = ropePoints[ropePoints.length - 1];
  const ctrlPoint = ropePoints[Math.max(1, Math.floor(ropePoints.length * 0.58))];
  const tailTipX = tailTipPoint.x;
  const tailTipY = tailTipPoint.y;
  const tailCtrlX = ctrlPoint.x;
  const tailCtrlY = ctrlPoint.y;
  const stringShadowWidth = Math.max(3, 8 * rigScale);
  const stringMainWidth = Math.max(1.5, 3 * rigScale);
  const tipHitRadius = Math.max(6, 8 * rigScale);
  const tailHitHalfWidth = Math.max(4, 6 * rigScale);
  const segmentLagStrength =
    clamp((speed / 650) * (currentRenderState === "idle" ? 0.45 : 1.5), 0.35, 2.8) * rigScale;
  const segmentLagX = clamp(-vx * 0.013, -82, 82) * rigScale;
  const segmentLagY = clamp(-vy * 0.009, -58, 58) * rigScale;
  const segmentPhase = nowMs * 0.008;

  updateBlink(nowMs);
  updateGaze(nowMs, dtSec, bodyX, bodyY);

  return {
    global: {
      rotation: rigRotation,
      anchorX: bodyX,
      anchorY: bodyY,
    },
    body: {
      x: bodyX,
      y: bodyY,
      rotation: lag.tail.x * 0.0018,
      radius: bodyRadius,
    },
    tail: {
      rootX: tailRootX,
      rootY: tailRootY,
      tipX: tailTipX,
      tipY: tailTipY,
      ctrlX: tailCtrlX,
      ctrlY: tailCtrlY,
      shadowWidth: stringShadowWidth,
      mainWidth: stringMainWidth,
      hitHalfWidth: tailHitHalfWidth,
      tipHitRadius,
      points: ropePoints,
      segmentLagStrength,
      segmentLagX,
      segmentLagY,
      segmentPhase,
    },
    eyes: {
      x: bodyX + lag.eyes.x,
      y: bodyY + lag.eyes.y,
      squint: currentRenderState === "impact" ? 0.45 : currentRenderState === "flying" ? 0.2 : 0,
      pupilX: gazeOffset.x,
      pupilY: gazeOffset.y,
      blink: blinkAmount,
      bodyRadius,
    },
    mouth: {
      x: bodyX + lag.mouth.x,
      y: bodyY + lag.mouth.y,
      open: currentRenderState === "flying" && speed > 900,
      tense: currentRenderState === "impact",
      talkPulse: getTalkFeedbackStrength(nowMs),
      bodyRadius,
    },
    fx: {},
  };
}

function drawTailLayer(context, transform, layer) {
  if (ACTIVE_TAIL_STYLE === TAIL_STYLES.segmented) {
    drawSegmentedTail(context, transform, layer);
    return;
  }

  if (ACTIVE_TAIL_STYLE === TAIL_STYLES.spike) {
    drawSpikeTail(context, transform, layer);
    return;
  }

  drawRibbonTail(context, transform, layer);
}

function drawRibbonTail(context, transform, layer) {
  const p0 = { x: transform.rootX, y: transform.rootY };
  const p1 = { x: transform.ctrlX, y: transform.ctrlY };
  const p2 = { x: transform.tipX, y: transform.tipY };

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  const shadowWidth = Number.isFinite(transform.shadowWidth) ? transform.shadowWidth : 8;
  const mainWidth = Number.isFinite(transform.mainWidth) ? transform.mainWidth : 3;
  const rootDotX = Math.max(2, mainWidth + 1);
  const rootDotY = Math.max(2, mainWidth * 0.9);
  const tipScale = Number.isFinite(transform.tipHitRadius) ? transform.tipHitRadius / 8 : 1;
  const segmentLagStrength = Number.isFinite(transform.segmentLagStrength)
    ? transform.segmentLagStrength
    : 1;
  const segmentLagX = Number.isFinite(transform.segmentLagX) ? transform.segmentLagX : 0;
  const segmentLagY = Number.isFinite(transform.segmentLagY) ? transform.segmentLagY : 0;
  const segmentPhase = Number.isFinite(transform.segmentPhase) ? transform.segmentPhase : 0;
  const ropePoints =
    Array.isArray(transform.points) && transform.points.length > 1 ? transform.points : null;
  const stringPoints = ropePoints ? ropePoints : [{ x: transform.rootX, y: transform.rootY }];

  if (!ropePoints) {
    for (let i = 1; i < TAIL_SEGMENT_COUNT; i += 1) {
      const t = i / TAIL_SEGMENT_COUNT;
      const lagFactor = Math.pow(t, TAIL_LAG_EXPONENT);
      const basePoint = pointOnQuadratic(t, p0, p1, p2);
      const tangent = tangentOnQuadratic(t, p0, p1, p2);
      const tangentLen = Math.max(0.001, Math.hypot(tangent.x, tangent.y));
      const nxSeg = -tangent.y / tangentLen;
      const nySeg = tangent.x / tangentLen;
      const lagX = segmentLagX * lagFactor * segmentLagStrength;
      const lagY = segmentLagY * lagFactor * segmentLagStrength;
      const microWiggle =
        Math.sin(segmentPhase + i * 0.65) * (0.035 + t * 0.08) * Math.min(1, segmentLagStrength);

      stringPoints.push({
        x: basePoint.x + lagX + nxSeg * microWiggle,
        y: basePoint.y + lagY + nySeg * microWiggle,
      });
    }

    stringPoints.push({ x: transform.tipX, y: transform.tipY });
  }
  context.strokeStyle = layer.style.shadow;
  context.lineWidth = shadowWidth;
  context.beginPath();
  context.moveTo(stringPoints[0].x, stringPoints[0].y);
  for (let i = 1; i < stringPoints.length - 1; i += 1) {
    const midX = (stringPoints[i].x + stringPoints[i + 1].x) * 0.5;
    const midY = (stringPoints[i].y + stringPoints[i + 1].y) * 0.5;
    context.quadraticCurveTo(stringPoints[i].x, stringPoints[i].y, midX, midY);
  }
  context.lineTo(stringPoints[stringPoints.length - 1].x, stringPoints[stringPoints.length - 1].y);
  context.stroke();

  context.strokeStyle = layer.style.stroke;
  context.lineWidth = mainWidth;
  context.beginPath();
  context.moveTo(stringPoints[0].x, stringPoints[0].y);
  for (let i = 1; i < stringPoints.length - 1; i += 1) {
    const midX = (stringPoints[i].x + stringPoints[i + 1].x) * 0.5;
    const midY = (stringPoints[i].y + stringPoints[i + 1].y) * 0.5;
    context.quadraticCurveTo(stringPoints[i].x, stringPoints[i].y, midX, midY);
  }
  context.lineTo(stringPoints[stringPoints.length - 1].x, stringPoints[stringPoints.length - 1].y);
  context.stroke();

  // Small knots along the string make length/readability clearer and map to future sprite pieces.
  for (let i = 1; i < TAIL_SEGMENT_COUNT; i += 1) {
    const point = stringPoints[i];
    const radius = (i % 3 === 0 ? 2.3 : 1.7) * Math.max(0.65, tipScale);
    if (TAIL_COLOR_CODE_SEGMENTS) {
      const t = i / TAIL_SEGMENT_COUNT;
      const hue = Math.round(210 - t * 170);
      context.fillStyle = `hsla(${hue}, 95%, 64%, 0.95)`;
    } else {
      context.fillStyle = layer.style.stroke;
    }
    context.beginPath();
    context.ellipse(point.x, point.y, radius, radius, 0, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = layer.style.tip;
  context.beginPath();
  context.ellipse(transform.rootX, transform.rootY, rootDotX, rootDotY, 0, 0, Math.PI * 2);
  context.fill();

  // End knot only (no detached decorative tail piece).
  const knotRadius = Math.max(2.4, 2.9 * tipScale);
  context.fillStyle = layer.style.tip;
  context.beginPath();
  context.ellipse(transform.tipX, transform.tipY, knotRadius, knotRadius, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSegmentedTail(context, transform, layer) {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = layer.style.shadow;
  context.lineWidth = 22;
  context.beginPath();
  context.moveTo(transform.rootX, transform.rootY);
  context.quadraticCurveTo(transform.ctrlX, transform.ctrlY, transform.tipX, transform.tipY);
  context.stroke();

  const p0 = { x: transform.rootX, y: transform.rootY };
  const p1 = { x: transform.ctrlX, y: transform.ctrlY };
  const p2 = { x: transform.tipX, y: transform.tipY };
  const segmentRadii = [12, 10, 8, 6];
  const segmentT = [0.18, 0.4, 0.66, 0.92];

  for (let i = 0; i < segmentT.length; i += 1) {
    const point = pointOnQuadratic(segmentT[i], p0, p1, p2);
    context.fillStyle = i === segmentT.length - 1 ? layer.style.tip : layer.style.stroke;
    context.beginPath();
    context.ellipse(point.x, point.y, segmentRadii[i], segmentRadii[i], 0, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawSpikeTail(context, transform, layer) {
  const dx = transform.tipX - transform.rootX;
  const dy = transform.tipY - transform.rootY;
  const length = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / length;
  const ny = dx / length;

  context.save();
  context.fillStyle = layer.style.stroke;
  context.beginPath();
  context.moveTo(transform.rootX + nx * 12, transform.rootY + ny * 12);
  context.quadraticCurveTo(transform.ctrlX + nx * 9, transform.ctrlY + ny * 9, transform.tipX, transform.tipY);
  context.quadraticCurveTo(transform.ctrlX - nx * 9, transform.ctrlY - ny * 9, transform.rootX - nx * 12, transform.rootY - ny * 12);
  context.closePath();
  context.fill();

  context.fillStyle = layer.style.tip;
  context.beginPath();
  context.ellipse(transform.tipX, transform.tipY, 8, 8, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBodyLayer(context, transform, layer) {
  context.save();
  context.translate(transform.x, transform.y);
  context.rotate(transform.rotation || 0);
  const radius = Number.isFinite(transform.radius) ? transform.radius : 100;
  const unit = radius / 100;

  context.fillStyle = layer.style.fill;
  context.beginPath();
  context.ellipse(0, 0, radius, radius, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = layer.style.rim;
  context.lineWidth = Math.max(2, 5 * unit);
  context.beginPath();
  context.ellipse(0, 0, radius - 2 * unit, radius - 2 * unit, 0, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = layer.style.highlight;
  context.beginPath();
  context.ellipse(-28 * unit, -60 * unit, 26 * unit, 17 * unit, -0.3, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawEyesLayer(context, transform, layer) {
  context.save();
  const unit = clamp((transform.bodyRadius || 100) / 100, 0.55, 2.4);
  const eyeOffsetX = 45 * unit;
  const eyeOffsetY = -20 * unit;
  const eyeHeight = Math.max(
    2 * unit,
    18 * unit * (1 - (transform.blink || 0) * 0.92) - transform.squint * 10 * unit
  );
  const eyeRadiusX = 22 * unit;
  const pupilRadius = 7 * unit;
  const irisRadius = 10 * unit;
  const pupilOffsetY = transform.pupilY;
  const openness = clamp01((eyeHeight - 2 * unit) / (16 * unit));

  context.fillStyle = layer.style.sclera;
  context.beginPath();
  context.ellipse(transform.x - eyeOffsetX, transform.y + eyeOffsetY, eyeRadiusX, eyeHeight, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = layer.style.outline;
  context.lineWidth = Math.max(1.1, 2 * unit);
  context.stroke();

  context.beginPath();
  context.ellipse(transform.x + eyeOffsetX, transform.y + eyeOffsetY, eyeRadiusX, eyeHeight, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  if (openness < 0.25) {
    context.strokeStyle = layer.style.lid;
    context.lineWidth = Math.max(1.5, 3 * unit);
    context.beginPath();
    context.moveTo(transform.x - 57 * unit, transform.y + eyeOffsetY);
    context.lineTo(transform.x - 33 * unit, transform.y + eyeOffsetY);
    context.stroke();
    context.beginPath();
    context.moveTo(transform.x + 33 * unit, transform.y + eyeOffsetY);
    context.lineTo(transform.x + 57 * unit, transform.y + eyeOffsetY);
    context.stroke();
    context.restore();
    return;
  }

  const maxPupilOffsetX = eyeRadiusX - pupilRadius - 4 * unit;
  const maxPupilOffsetY = eyeHeight - pupilRadius - 0.5 * unit;
  const pupilOffsetX = clamp(transform.pupilX, -maxPupilOffsetX, maxPupilOffsetX);
  const clampedPupilOffsetY = clamp(pupilOffsetY, -maxPupilOffsetY, maxPupilOffsetY);
  const irisR = irisRadius * (0.5 + openness * 0.5);
  const pupilR = pupilRadius * (0.45 + openness * 0.55);

  context.fillStyle = layer.style.iris;
  context.beginPath();
  context.ellipse(
    transform.x - eyeOffsetX + pupilOffsetX * 0.85,
    transform.y + eyeOffsetY + clampedPupilOffsetY * 0.85,
    irisR,
    irisR,
    0,
    0,
    Math.PI * 2
  );
  context.fill();
  context.beginPath();
  context.ellipse(
    transform.x + eyeOffsetX + pupilOffsetX * 0.85,
    transform.y + eyeOffsetY + clampedPupilOffsetY * 0.85,
    irisR,
    irisR,
    0,
    0,
    Math.PI * 2
  );
  context.fill();

  context.fillStyle = layer.style.pupil;
  context.beginPath();
  context.ellipse(
    transform.x - eyeOffsetX + pupilOffsetX,
    transform.y + eyeOffsetY + clampedPupilOffsetY,
    pupilR,
    pupilR,
    0,
    0,
    Math.PI * 2
  );
  context.fill();
  context.beginPath();
  context.ellipse(
    transform.x + eyeOffsetX + pupilOffsetX,
    transform.y + eyeOffsetY + clampedPupilOffsetY,
    pupilR,
    pupilR,
    0,
    0,
    Math.PI * 2
  );
  context.fill();

  if (openness > 0.45) {
    context.fillStyle = "rgba(255, 255, 255, 0.8)";
    const glintR = Math.max(1.2, 2 * unit);
    context.beginPath();
    context.ellipse(
      transform.x - eyeOffsetX + pupilOffsetX - 2 * unit,
      transform.y + eyeOffsetY + clampedPupilOffsetY - 2 * unit,
      glintR,
      glintR,
      0,
      0,
      Math.PI * 2
    );
    context.fill();
    context.beginPath();
    context.ellipse(
      transform.x + eyeOffsetX + pupilOffsetX - 2 * unit,
      transform.y + eyeOffsetY + clampedPupilOffsetY - 2 * unit,
      glintR,
      glintR,
      0,
      0,
      Math.PI * 2
    );
    context.fill();
  }
  context.restore();
}

function drawMouthLayer(context, transform, layer) {
  context.save();
  const unit = clamp((transform.bodyRadius || 100) / 100, 0.55, 2.4);
  const talkPulse = clamp01(transform.talkPulse || 0);
  context.strokeStyle = layer.style.stroke;
  context.lineWidth = Math.max(2, 6 * unit);
  context.lineCap = "round";

  if (transform.open || talkPulse > 0.14) {
    context.beginPath();
    context.ellipse(
      transform.x,
      transform.y + 42 * unit,
      (16 + talkPulse * 4) * unit,
      (12 + talkPulse * 8) * unit,
      0,
      0,
      Math.PI * 2
    );
    context.stroke();
  } else if (transform.tense) {
    context.beginPath();
    context.moveTo(transform.x - 22 * unit, transform.y + 41 * unit);
    context.lineTo(transform.x - 10 * unit, transform.y + 35 * unit);
    context.lineTo(transform.x + 2 * unit, transform.y + 41 * unit);
    context.lineTo(transform.x + 14 * unit, transform.y + 35 * unit);
    context.lineTo(transform.x + 24 * unit, transform.y + 41 * unit);
    context.stroke();
  } else {
    context.beginPath();
    context.arc(transform.x, transform.y + 40 * unit, 28 * unit, 0.1 * Math.PI, 0.9 * Math.PI);
    context.stroke();
  }

  context.restore();
}

function drawFxLayer(context) {
  for (const particle of fxParticles) {
    const life = clamp01(particle.ageMs / particle.maxAgeMs);
    const alpha = 1 - life;

    context.save();
    context.translate(particle.x, particle.y);
    context.rotate(particle.rotation);

    if (particle.type === "puff") {
      const radius = particle.size * (1 + life * 1.9);
      context.fillStyle = `rgba(235, 244, 255, ${0.55 * alpha})`;
      context.beginPath();
      context.ellipse(0, 0, radius, radius * 0.8, 0, 0, Math.PI * 2);
      context.fill();
    } else {
      const size = particle.size * (1 + life * 0.5);
      context.strokeStyle = `rgba(255, 239, 171, ${0.9 * alpha})`;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-size, 0);
      context.lineTo(size, 0);
      context.moveTo(0, -size);
      context.lineTo(0, size);
      context.stroke();
    }

    context.restore();
  }
}

function drawDebugOverlay(w, h) {
  if (!diagnosticsEnabled) return;
  const visualBounds = getDesignVisualBounds();
  const visibleHitBounds = latestVisibleBounds;
  const displayedRotation = activeRenderMode === RENDER_MODES.sprite ? spriteDragRotation : rigRotation;

  ctx.save();
  ctx.fillStyle = "rgba(255, 100, 40, 0.08)";
  ctx.fillRect(0, 0, w, h);

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 130, 50, 0.95)";
  ctx.strokeRect(0.5, 0.5, Math.max(0, w - 1), Math.max(0, h - 1));

  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(80, 220, 255, 0.95)";
  ctx.strokeRect(
    visualBounds.x + 0.5,
    visualBounds.y + 0.5,
    visualBounds.width,
    visualBounds.height
  );
  ctx.setLineDash([]);

  if (visibleHitBounds) {
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "rgba(120, 255, 145, 0.95)";
    ctx.strokeRect(
      visibleHitBounds.x + 0.5,
      visibleHitBounds.y + 0.5,
      visibleHitBounds.width,
      visibleHitBounds.height
    );
    ctx.setLineDash([]);
  }

  const d = latestDiagnostics;
  const spriteCacheStats = spriteRuntime?.getCacheStats ? spriteRuntime.getCacheStats() : null;
  const lines = [
    `render mode: ${activeRenderMode}`,
    `state: ${currentRenderState}`,
    `behavior: ${getBehaviorStateLabel()}`,
    `behavior visual: ${
      latestStateSnapshot?.visual
        ? `${latestStateSnapshot.visual.clip}${latestStateSnapshot.visual.overlay ? ` + ${latestStateSnapshot.visual.overlay}` : ""}`
        : "n/a"
    }`,
    `behavior fallback: ${
      latestStateSnapshot
        ? `${latestStateSnapshot.visualFallbackUsed ? "yes" : "no"}${latestStateSnapshot.fallbackReasons?.length ? ` (${latestStateSnapshot.fallbackReasons.join(",")})` : ""}`
        : "n/a"
    }`,
    `capabilities: ${
      latestCapabilitySnapshot
        ? `${latestCapabilitySnapshot.runtimeState} h=${latestCapabilitySnapshot.summary?.healthyCount || 0} d=${latestCapabilitySnapshot.summary?.degradedCount || 0} f=${latestCapabilitySnapshot.summary?.failedCount || 0}`
        : "n/a"
    }`,
    `extensions: ${
      latestExtensionSnapshot?.summary
        ? `found=${latestExtensionSnapshot.summary.discoveredCount || 0} valid=${latestExtensionSnapshot.summary.validCount || 0} enabled=${latestExtensionSnapshot.summary.enabledCount || 0}`
        : "n/a"
    }`,
    `contract: ${
      latestContractTrace
        ? `${latestContractTrace.stage || "?"}/${latestContractTrace.payload?.type || "?"} corr=${latestContractTrace.payload?.correlationId || "n/a"}`
        : "n/a"
    }`,
    `contract suggestion: ${
      latestContractSuggestion
        ? `${latestContractSuggestion.type || "?"} corr=${latestContractSuggestion.correlationId || "n/a"}`
        : "n/a"
    }`,
    `dialog: ${dialogSurfaceOpen ? "open" : "closed"} history=${dialogHistory.length} bubble=${
      activeBubbleMessage?.kind || "none"
    }`,
    `shell: roam=${latestShellState?.roaming?.mode || "desktop"}${
      latestShellState?.roaming?.mode === "zone" ? `:${latestShellState?.roaming?.zone || "desk-center"}` : ""
    } diag=${latestShellState?.ui?.diagnosticsEnabled ? "on" : "off"} acc=${
      latestShellState?.wardrobe?.activeAccessories?.join("+") || "none"
    } prop=${latestShellState?.inventory?.quickProps?.join("+") || "none"} tray=${
      latestShellState?.tray?.available ? "ready" : latestShellState?.devFallback?.enabled ? "fallback" : "missing"
    }`,
    `talk: ${isTalkFeedbackActive() ? "active" : "idle"} source=${activeBubbleMessage?.source || "n/a"} fallback=${activeBubbleMessage?.fallbackMode || "none"}`,
    `memory: ${
      latestMemorySnapshot
        ? `${latestMemorySnapshot.activeAdapterMode || "unknown"} fallback=${latestMemorySnapshot.fallbackReason || "none"}`
        : "n/a"
    }`,
    `memory event: ${
      latestMemoryEvent
        ? `${latestMemoryEvent.kind || "?"}${latestMemoryEvent.outcome ? `:${latestMemoryEvent.outcome}` : ""}`
        : "n/a"
    }`,
    `integrations: spotify=${getCapabilityStateLabel("spotifyIntegration")} freshrss=${getCapabilityStateLabel("freshRssIntegration")}`,
    `integration event: ${getIntegrationEventLabel()}`,
    `motion preset: ${latestMotion.preset || "n/a"}`,
    `sprite: ${
      latestSpriteFrame
        ? `${latestSpriteFrame.state}/${latestSpriteFrame.direction} frame ${latestSpriteFrame.frameIndex + 1}/${latestSpriteFrame.frameCount}`
        : "n/a"
    }`,
    `sprite fps: ${
      latestSpriteFrame
        ? `${latestSpriteFrame.fps.toFixed(1)}${Number.isFinite(latestSpriteFrame.baseFps) ? ` (base ${latestSpriteFrame.baseFps})` : ""}`
        : "n/a"
    }`,
    `sheet: ${latestSpriteFrame?.imageLoaded ? "ready" : latestSpriteFrame?.imageFailed ? "error" : "loading"}`,
    `sprite cache: ${
      spriteCacheStats ? `${spriteCacheStats.loaded}/${spriteCacheStats.total} loaded` : "n/a"
    }`,
    `tail style: ${ACTIVE_TAIL_STYLE}`,
    `gaze: ${gazeOffset.x.toFixed(1)}, ${gazeOffset.y.toFixed(1)} (${gazeSource})`,
    `blink: ${blinkAmount.toFixed(2)}`,
    `motion speed: ${(latestMotion.velocity?.speed || 0).toFixed(1)}`,
    `impact: ${latestMotion.impact?.triggered ? "yes" : "no"} ${(
      latestMotion.impact?.strength || 0
    ).toFixed(2)}`,
    `fx count: ${fxParticles.length}`,
    `rig rot: ${(displayedRotation * (180 / Math.PI)).toFixed(1)}deg`,
    `visible hitbox: ${
      visibleHitBounds
        ? `${visibleHitBounds.x.toFixed(0)},${visibleHitBounds.y.toFixed(0)} ${visibleHitBounds.width.toFixed(0)}x${visibleHitBounds.height.toFixed(0)}`
        : "n/a"
    }`,
    `viewport: ${w}x${h}`,
  ];

  if (d) {
    lines.push(`diag kind: ${d.kind}${d.tick ? ` #${d.tick}` : ""}`);
    lines.push(`clamped: ${formatPoint(d.clamped)}`);
    lines.push(`clamp hit: x=${d.clampHit?.x ? "yes" : "no"} y=${d.clampHit?.y ? "yes" : "no"}`);
    lines.push(`display: ${d.activeDisplay?.id ?? "n/a"}`);
    lines.push(`clamp area: ${d.clampAreaType ?? "n/a"} ${formatRect(d.clampArea)}`);
  }

  ctx.font = "12px Consolas, monospace";
  ctx.textBaseline = "top";

  const panelWidth = Math.min(w - 8, Math.max(...lines.map((line) => ctx.measureText(line).width)) + 12);
  const panelHeight = lines.length * 15 + 10;

  ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
  ctx.fillRect(4, 4, Math.max(0, panelWidth), Math.max(0, panelHeight));

  ctx.fillStyle = "rgba(245, 245, 245, 0.98)";
  lines.forEach((line, i) => {
    ctx.fillText(line, 10, 8 + i * 15);
  });

  ctx.restore();
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const scale = getLayoutScale();
  const cssWidth = Math.max(1, Math.floor(canvas.clientWidth));
  const cssHeight = Math.max(1, Math.floor(canvas.clientHeight));

  canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
  canvas.height = Math.max(1, Math.floor(cssHeight * dpr));

  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  lastDevicePixelRatio = dpr;
  lastRenderScale = scale;
}

function draw() {
  const nowMs = performance.now();
  const dtSec = Math.min(0.05, Math.max(0.001, (nowMs - lastFrameMs) / 1000));
  lastFrameMs = nowMs;

  const currentDpr = window.devicePixelRatio || 1;
  const currentScale = getLayoutScale();
  if (currentDpr !== lastDevicePixelRatio || currentScale !== lastRenderScale) {
    resize();
  }

  currentRenderState = deriveRenderState(nowMs);

  const windowSize = getDesignWindowSize();
  const w = windowSize.width;
  const h = windowSize.height;

  syncMouseInteractivityFromGlobalCursor();

  let layerTransforms;
  let spriteFrame = null;
  if (activeRenderMode === RENDER_MODES.sprite && spriteRuntime) {
    updateSpriteDragRotation(dtSec);
    layerTransforms = getSpriteLayerTransforms();
    latestRigState = layerTransforms;
    spriteFrame = updateSpriteFrame(nowMs, dtSec, layerTransforms);
    latestVisibleBounds =
      computeSpriteVisibleBounds(spriteFrame?.transform, spriteFrame?.global, w, h) ||
      getDesignVisualBounds();
  } else {
    spriteDragRotation = 0;
    spriteDragRotationVel = 0;
    spriteWasDragDriving = false;
    updateFx(dtSec);
    layerTransforms = getLayerTransforms(nowMs, dtSec);
    latestRigState = layerTransforms;
    latestVisibleBounds = computeVisibleBoundsForFrame(layerTransforms, w, h) || getDesignVisualBounds();
  }

  maybeEmitVisibleBounds(latestVisibleBounds, nowMs);

  ctx.clearRect(0, 0, w, h);

  const globalTransform = layerTransforms.global || {};
  const rotation = Number.isFinite(globalTransform.rotation) ? globalTransform.rotation : 0;
  const anchorX = Number.isFinite(globalTransform.anchorX) ? globalTransform.anchorX : w * 0.5;
  const anchorY = Number.isFinite(globalTransform.anchorY) ? globalTransform.anchorY : h * 0.5;

  ctx.save();
  if (Math.abs(rotation) > 0.00001) {
    ctx.translate(anchorX, anchorY);
    ctx.rotate(rotation);
    ctx.translate(-anchorX, -anchorY);
  }

  let drewSprite = false;
  if (activeRenderMode === RENDER_MODES.sprite && spriteFrame) {
    drewSprite = drawSpriteFrame(ctx, spriteFrame);
  }

  if (activeRenderMode !== RENDER_MODES.sprite && !drewSprite) {
    for (const layer of RIG_LAYERS) {
      const transform = layerTransforms[layer.id] || {};
      layer.draw(ctx, transform, layer);
    }
  }
  drawBehaviorOverlay(ctx, latestStateSnapshot, nowMs);
  drawShellWardrobeOverlay(ctx);
  drawTalkFeedback(ctx, nowMs);
  ctx.restore();

  drawBehaviorStateBadge(ctx);
  drawDebugOverlay(w, h);
  renderDialogBubble();
  requestAnimationFrame(draw);
}

function drawRoundedRectPath(context, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) * 0.5));
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function drawProceduralBehaviorOverlay(context, overlay, bounds, centerX, centerY) {
  if (overlay === "book") {
    const bookWidth = 42;
    const bookHeight = 30;
    const x = centerX + bounds.width * 0.08;
    const y = centerY + bounds.height * 0.1;
    drawRoundedRectPath(context, x, y, bookWidth, bookHeight, 6);
    context.fillStyle = "rgba(243, 210, 126, 0.95)";
    context.fill();
    context.strokeStyle = "rgba(121, 82, 28, 0.9)";
    context.lineWidth = 2;
    context.stroke();
    context.beginPath();
    context.moveTo(x + bookWidth * 0.5, y + 4);
    context.lineTo(x + bookWidth * 0.5, y + bookHeight - 4);
    context.strokeStyle = "rgba(121, 82, 28, 0.55)";
    context.stroke();
  } else if (overlay === "headphones") {
    const headY = centerY - bounds.height * 0.22;
    context.strokeStyle = "rgba(40, 44, 58, 0.96)";
    context.lineWidth = 4;
    context.beginPath();
    context.arc(centerX, headY + 2, 28, Math.PI * 1.1, Math.PI * 1.9);
    context.stroke();
    context.fillStyle = "rgba(62, 70, 92, 0.96)";
    drawRoundedRectPath(context, centerX - 30, headY + 6, 10, 24, 5);
    context.fill();
    drawRoundedRectPath(context, centerX + 20, headY + 6, 10, 24, 5);
    context.fill();
  } else if (overlay === "speaker") {
    context.fillStyle = "rgba(58, 68, 89, 0.96)";
    context.fillRect(centerX - 58, centerY - 10, 18, 24);
    context.beginPath();
    context.moveTo(centerX - 40, centerY - 4);
    context.lineTo(centerX - 22, centerY - 16);
    context.lineTo(centerX - 22, centerY + 20);
    context.lineTo(centerX - 40, centerY + 8);
    context.closePath();
    context.fillStyle = "rgba(88, 103, 129, 0.96)";
    context.fill();
    context.strokeStyle = "rgba(120, 213, 255, 0.96)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(centerX - 10, centerY + 2, 14, -Math.PI * 0.35, Math.PI * 0.35);
    context.stroke();
  } else if (overlay === "musicNote") {
    context.strokeStyle = "rgba(31, 49, 69, 0.96)";
    context.fillStyle = "rgba(174, 231, 255, 0.96)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(centerX + 26, centerY - 44, 8, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(centerX + 31, centerY - 48);
    context.lineTo(centerX + 31, centerY - 72);
    context.lineTo(centerX + 46, centerY - 76);
    context.stroke();
  } else if (overlay === "rssCard") {
    drawRoundedRectPath(context, centerX + 10, centerY - 2, 46, 34, 8);
    context.fillStyle = "rgba(255, 244, 219, 0.96)";
    context.fill();
    context.strokeStyle = "rgba(187, 108, 40, 0.92)";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "rgba(244, 141, 52, 0.95)";
    context.beginPath();
    context.arc(centerX + 24, centerY + 10, 3, 0, Math.PI * 2);
    context.fill();
  } else if (overlay === "poolRing") {
    context.strokeStyle = "rgba(87, 225, 255, 0.96)";
    context.lineWidth = 8;
    context.beginPath();
    context.ellipse(centerX, centerY + bounds.height * 0.14, 52, 18, 0, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = "rgba(255, 255, 255, 0.65)";
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(centerX, centerY + bounds.height * 0.14, 40, 10, 0, 0, Math.PI * 2);
    context.stroke();
  } else if (overlay === "sleepZ") {
    context.fillStyle = "rgba(244, 248, 255, 0.95)";
    context.font = "bold 16px Georgia";
    context.fillText("Z", centerX + 18, centerY - bounds.height * 0.34);
    context.font = "bold 12px Georgia";
    context.fillText("z", centerX + 34, centerY - bounds.height * 0.42);
  } else if (overlay === "fallbackWarning") {
    context.fillStyle = "rgba(143, 67, 31, 0.95)";
    context.beginPath();
    context.moveTo(centerX, centerY - 58);
    context.lineTo(centerX + 18, centerY - 24);
    context.lineTo(centerX - 18, centerY - 24);
    context.closePath();
    context.fill();
  }
}

function drawBehaviorOverlay(context, snapshot, nowMs) {
  const bounds = getDesignVisualBounds();
  const centerX = bounds.x + bounds.width * 0.5;
  const centerY = bounds.y + bounds.height * 0.5;
  const overlay = snapshot?.visual?.overlay;
  const fallbackOverlayId =
    snapshot?.visualFallbackUsed && !overlay ? "fallbackWarning" : null;

  context.save();
  const overlayIds = [overlay, fallbackOverlayId].filter(Boolean);
  for (const overlayId of overlayIds) {
    const entry = getOverlaySpriteEntry(overlayId);
    if (entry?.loaded && !entry.failed) {
      const frameIndex = Math.floor((nowMs / 1000) * entry.fps) % Math.max(1, entry.frameCount);
      const drawWidth = entry.drawWidth;
      const drawHeight = entry.drawHeight;
      const drawX = bounds.x + bounds.width * entry.anchorX - drawWidth * 0.5;
      const drawY = bounds.y + bounds.height * entry.anchorY - drawHeight * 0.5;
      context.drawImage(
        entry.image,
        frameIndex * entry.frameWidth,
        0,
        entry.frameWidth,
        entry.frameHeight,
        drawX,
        drawY,
        drawWidth,
        drawHeight
      );
      continue;
    }
    drawProceduralBehaviorOverlay(context, overlayId, bounds, centerX, centerY);
  }
  context.restore();
}

function drawShellWardrobeOverlay(context) {
  if (!latestShellState?.wardrobe?.hasHeadphones) return;
  if (latestStateSnapshot?.visual?.overlay === "headphones") return;

  const bounds = getDesignVisualBounds();
  const centerX = bounds.x + bounds.width * 0.5;
  const centerY = bounds.y + bounds.height * 0.5;
  context.save();
  context.globalAlpha = 0.96;
  drawProceduralBehaviorOverlay(context, "headphones", bounds, centerX, centerY);
  context.restore();
}

function drawBehaviorStateBadge(context) {
  const snapshot = latestStateSnapshot;
  if (!snapshot) return;
  const shouldShow =
    snapshot.currentState !== "Idle" ||
    snapshot.visualFallbackUsed ||
    Boolean(snapshot.visual?.overlay);
  if (!shouldShow) return;

  const bounds = latestVisibleBounds || getDesignVisualBounds();
  const primaryText = getBehaviorStateLabel();
  const secondaryText = snapshot.visualFallbackUsed
    ? "fallback"
    : snapshot.visual?.overlay || snapshot.visual?.clip || "state";

  context.save();
  context.font = "bold 12px Georgia";
  const primaryWidth = context.measureText(primaryText).width;
  context.font = "11px Georgia";
  const secondaryWidth = context.measureText(secondaryText).width;
  const width = Math.max(primaryWidth, secondaryWidth) + 16;
  const height = 34;
  const x = Math.max(6, bounds.x + bounds.width * 0.5 - width * 0.5);
  const y = Math.max(6, bounds.y - height - 8);
  drawRoundedRectPath(context, x, y, width, height, 10);
  context.fillStyle = snapshot.visualFallbackUsed
    ? "rgba(140, 56, 24, 0.9)"
    : "rgba(16, 24, 36, 0.78)";
  context.fill();
  context.fillStyle = "rgba(249, 251, 255, 0.98)";
  context.font = "bold 12px Georgia";
  context.fillText(primaryText, x + 8, y + 6);
  context.font = "11px Georgia";
  context.fillStyle = snapshot.visualFallbackUsed
    ? "rgba(255, 220, 176, 0.98)"
    : "rgba(196, 219, 255, 0.98)";
  context.fillText(secondaryText, x + 8, y + 19);
  context.restore();
}

function drawTalkFeedback(context, nowMs) {
  if (!isTalkFeedbackActive()) return;

  const bounds = getDesignVisualBounds();
  const strength = getTalkFeedbackStrength(nowMs);
  const baseX = bounds.x + bounds.width * 0.58;
  const baseY = bounds.y + bounds.height * 0.62;
  const wave = Math.sin(nowMs * 0.014);
  const rise = 3 + strength * 6;

  context.save();
  context.globalAlpha = 0.42 + strength * 0.38;
  for (let index = 0; index < 3; index += 1) {
    const dotStrength = clamp01(strength - index * 0.18);
    const dotRadius = 2.2 + dotStrength * 2.8;
    context.beginPath();
    context.fillStyle = `rgba(183, 236, 255, ${0.38 + dotStrength * 0.42})`;
    context.ellipse(
      baseX + index * 10,
      baseY - index * rise + wave * (2 + index),
      dotRadius,
      dotRadius,
      0,
      0,
      Math.PI * 2
    );
    context.fill();
  }
  context.restore();
}

async function init() {
  await loadRuntimeConfig();
  if (typeof window.petAPI.getCapabilitySnapshot === "function") {
    try {
      latestCapabilitySnapshot = await window.petAPI.getCapabilitySnapshot();
    } catch {}
  }
  if (typeof window.petAPI.getContractTrace === "function") {
    try {
      latestContractTrace = await window.petAPI.getContractTrace();
    } catch {}
  }
  if (typeof window.petAPI.getExtensions === "function") {
    try {
      latestExtensionSnapshot = await window.petAPI.getExtensions();
    } catch {}
  }
  if (typeof window.petAPI.getMemorySnapshot === "function") {
    try {
      latestMemorySnapshot = await window.petAPI.getMemorySnapshot();
    } catch {}
  }
  if (typeof window.petAPI.getStateSnapshot === "function") {
    try {
      latestStateSnapshot = await window.petAPI.getStateSnapshot();
    } catch {}
  }
  if (typeof window.petAPI.getShellState === "function") {
    try {
      syncShellState(await window.petAPI.getShellState());
    } catch {}
  }
  await loadDialogHistorySnapshot();
  loadOverlaySpriteSheets();
  await loadSpriteRuntime(SPRITE_CHARACTER_ID);

  if (typeof window.petAPI.onMotion === "function") {
    window.petAPI.onMotion((payload) => {
      latestMotion = {
        ...DEFAULT_MOTION,
        ...payload,
        position: { ...DEFAULT_MOTION.position, ...(payload?.position || {}) },
        velocity: { ...DEFAULT_MOTION.velocity, ...(payload?.velocity || {}) },
        collided: { ...DEFAULT_MOTION.collided, ...(payload?.collided || {}) },
        impact: { ...DEFAULT_MOTION.impact, ...(payload?.impact || {}) },
      };

      if (latestMotion.impact.triggered) {
        const strength = clamp01(latestMotion.impact.strength || 0);
        const durationMs = IMPACT_STATE_MIN_MS + (IMPACT_STATE_MAX_MS - IMPACT_STATE_MIN_MS) * strength;
        impactStateUntilMs = Math.max(impactStateUntilMs, performance.now() + durationMs);
        impactImpulse = {
          x: clamp(-(latestMotion.velocity.vx || 0) * 0.0028, -18, 18),
          y: clamp(-(latestMotion.velocity.vy || 0) * 0.0028, -18, 18),
          strength,
          tMs: performance.now(),
        };
        if (activeRenderMode !== RENDER_MODES.sprite) {
          spawnImpactFx(latestMotion);
        }
      }
    });
  }

  if (typeof window.petAPI.onDiagnostics === "function") {
    window.petAPI.onDiagnostics((payload) => {
      latestDiagnostics = payload;
    });
  }

  if (typeof window.petAPI.onCursor === "function") {
    window.petAPI.onCursor((payload) => {
      if (payload?.cursor && Number.isFinite(payload.cursor.x) && Number.isFinite(payload.cursor.y)) {
        latestCursorScreen = { x: payload.cursor.x, y: payload.cursor.y };
      }
    });
  }

  if (typeof window.petAPI.onCapabilities === "function") {
    window.petAPI.onCapabilities((payload) => {
      if (payload && typeof payload === "object") {
        latestCapabilitySnapshot = payload;
      }
    });
  }

  if (typeof window.petAPI.onExtensions === "function") {
    window.petAPI.onExtensions((payload) => {
      if (payload && typeof payload === "object") {
        latestExtensionSnapshot = payload;
      }
    });
  }

  if (typeof window.petAPI.onExtensionEvent === "function") {
    window.petAPI.onExtensionEvent((payload) => {
      if (!payload || typeof payload !== "object") return;
      latestDiagnostics = payload;
    });
  }

  if (typeof window.petAPI.onContractTrace === "function") {
    window.petAPI.onContractTrace((payload) => {
      if (!payload || typeof payload !== "object") return;
      latestContractTrace = payload;
    });
  }

  if (typeof window.petAPI.onContractSuggestion === "function") {
    window.petAPI.onContractSuggestion((payload) => {
      if (!payload || typeof payload !== "object") return;
      latestContractSuggestion = payload;
      latestDiagnostics = payload;
    });
  }

  if (typeof window.petAPI.onMemory === "function") {
    window.petAPI.onMemory((payload) => {
      if (!payload || typeof payload !== "object") return;
      latestMemoryEvent = payload;
      if (payload.snapshot && typeof payload.snapshot === "object") {
        latestMemorySnapshot = payload.snapshot;
      }
      latestDiagnostics = payload;
    });
  }

  if (typeof window.petAPI.onState === "function") {
    window.petAPI.onState((payload) => {
      if (!payload || typeof payload !== "object") return;
      latestStateSnapshot = payload;
      latestDiagnostics = payload;
    });
  }

  if (typeof window.petAPI.onShellState === "function") {
    window.petAPI.onShellState((payload) => {
      if (!payload || typeof payload !== "object") return;
      syncShellState(payload);
      latestDiagnostics = payload;
    });
  }

  if (typeof window.petAPI.onIntegration === "function") {
    window.petAPI.onIntegration((payload) => {
      if (!payload || typeof payload !== "object") return;
      latestIntegrationEvent = payload;
      latestDiagnostics = payload;
      spawnIntegrationFx(payload);
    });
  }

  if (typeof window.petAPI.onDialogMessage === "function") {
    window.petAPI.onDialogMessage((payload) => {
      if (!payload || typeof payload !== "object") return;
      handleDialogMessage(payload);
    });
  }

  if (dialogForm) {
    dialogForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitDialogMessage();
    });
  }

  if (dialogCloseButton) {
    dialogCloseButton.addEventListener("click", () => {
      closeDialogSurface();
    });
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onMovementKeyDown);
  window.addEventListener("keyup", onMovementKeyUp);
  window.addEventListener("blur", clearMovementKeys);
  syncDialogSurfaceState();
  setDialogPending(false);
  setMousePassthrough(true);
  resize();
  draw();
}

let dragging = false;

function endDrag(e) {
  if (!dragging) return;

  dragging = false;
  window.petAPI.endDrag();

  if (e && Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) {
    updateMouseInteractivity(e.clientX, e.clientY);
  } else {
    updateMouseInteractivity(pointerClient.x, pointerClient.y);
  }

  if (!e) return;

  try {
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  } catch {}
}

canvas.addEventListener("pointerdown", (e) => {
  updateMouseInteractivity(e.clientX, e.clientY);
  setMousePassthrough(false);
  dragging = true;
  window.petAPI.beginDrag();

  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {}

  e.preventDefault();
});

canvas.addEventListener("pointermove", (e) => {
  requestMouseInteractivityUpdate(e.clientX, e.clientY);
  if (!dragging) return;
  window.petAPI.drag();
});

canvas.addEventListener("pointerenter", (e) => {
  requestMouseInteractivityUpdate(e.clientX, e.clientY);
});

canvas.addEventListener("pointerleave", () => {
  pointerInCanvas = false;
  if (!dragging) setMousePassthrough(true);
});

window.addEventListener("mousemove", (e) => {
  requestMouseInteractivityUpdate(e.clientX, e.clientY);
});

window.addEventListener("mouseleave", () => {
  pointerInCanvas = false;
  if (!dragging) setMousePassthrough(true);
});

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
window.addEventListener("blur", () => {
  pointerInCanvas = false;
  setMousePassthrough(true);
  endDrag();
});

init();
