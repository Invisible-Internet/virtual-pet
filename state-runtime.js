"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_STATE_CATALOG_PATH = path.join(__dirname, "config", "state-catalog.json");
const DEFAULT_SUPPORTED_OVERLAYS = Object.freeze([
  "headphones",
  "speaker",
  "musicNote",
  "book",
  "rssCard",
  "poolRing",
  "sleepZ",
]);
const DEFAULT_CONTEXT_SUMMARY_LIMIT = 180;

function summarizeError(error) {
  if (!error) return "unknown error";
  if (typeof error.message === "string" && error.message.trim().length > 0) {
    return error.message.trim();
  }
  return String(error);
}

function asFiniteNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asPositiveInteger(value, fallback, min = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.round(numeric));
}

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeOptionalText(value) {
  const trimmed = normalizeText(value, "");
  return trimmed.length > 0 ? trimmed : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sanitizeContextValue(value) {
  if (typeof value === "string") {
    return value.trim().slice(0, 120);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}

function sanitizeContext(rawContext = {}) {
  if (!rawContext || typeof rawContext !== "object") return {};
  const normalized = {};
  for (const [key, value] of Object.entries(rawContext)) {
    const safeKey = normalizeText(key, "");
    if (!safeKey) continue;
    const safeValue = sanitizeContextValue(value);
    if (safeValue == null || safeValue === "") continue;
    normalized[safeKey] = safeValue;
  }
  return normalized;
}

function sanitizeVisualOverrides(rawOverrides = {}) {
  if (!rawOverrides || typeof rawOverrides !== "object") return {};
  const normalized = {};
  const clip = normalizeOptionalText(rawOverrides.clip);
  const fallbackClip = normalizeOptionalText(rawOverrides.fallbackClip);
  const overlay = normalizeOptionalText(rawOverrides.overlay);
  const fallbackOverlay = normalizeOptionalText(rawOverrides.fallbackOverlay);
  const direction = normalizeOptionalText(rawOverrides.direction);
  const label = normalizeOptionalText(rawOverrides.label);
  if (clip) normalized.clip = clip;
  if (fallbackClip) normalized.fallbackClip = fallbackClip;
  if (overlay || Object.prototype.hasOwnProperty.call(rawOverrides, "overlay")) {
    normalized.overlay = overlay;
  }
  if (fallbackOverlay || Object.prototype.hasOwnProperty.call(rawOverrides, "fallbackOverlay")) {
    normalized.fallbackOverlay = fallbackOverlay;
  }
  if (direction) normalized.direction = direction;
  if (label) normalized.label = label;
  return normalized;
}

function resolveMusicOverlay(payload = {}) {
  const explicitProp = normalizeText(payload.activeProp, "").toLowerCase();
  if (explicitProp === "speaker" || explicitProp === "headphones") {
    return explicitProp;
  }
  const route = normalizeText(payload.outputRoute, "").toLowerCase();
  const deviceType = normalizeText(payload.outputDeviceType, "").toLowerCase();
  const deviceName = normalizeText(payload.outputDeviceName, "").toLowerCase();
  const combined = `${route} ${deviceType} ${deviceName}`.trim();
  if (
    combined.includes("headphone") ||
    combined.includes("headset") ||
    combined.includes("earbud") ||
    combined.includes("airpod")
  ) {
    return "headphones";
  }
  if (
    combined.includes("speaker") ||
    combined.includes("computer") ||
    combined.includes("stereo") ||
    combined.includes("receiver") ||
    combined.includes("tv")
  ) {
    return "speaker";
  }
  return "musicNote";
}

function interpolateTemplate(template, context = {}) {
  const missingKeys = [];
  const text = String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    const value = context[key];
    if (value == null || value === "") {
      missingKeys.push(key);
      return "";
    }
    return String(value);
  });
  return {
    text: text.replace(/\s+/g, " ").trim(),
    missingKeys,
  };
}

function normalizeDescription(rawDescription = {}) {
  const description =
    rawDescription && typeof rawDescription === "object" ? rawDescription : {};
  return {
    doingText: normalizeOptionalText(description.doingText),
    doingTemplate: normalizeOptionalText(description.doingTemplate),
    doingFallback:
      normalizeOptionalText(description.doingFallback) ||
      "I am staying busy in local mode.",
    readingText: normalizeOptionalText(description.readingText),
    readingTemplate: normalizeOptionalText(description.readingTemplate),
    readingFallback:
      normalizeOptionalText(description.readingFallback) ||
      "I do not have the reading details handy right now.",
  };
}

function normalizeVisual(rawVisual = {}) {
  const visual = rawVisual && typeof rawVisual === "object" ? rawVisual : {};
  const clip = normalizeOptionalText(visual.clip) || "IdleReady";
  return {
    clip,
    fallbackClip: normalizeOptionalText(visual.fallbackClip) || clip || "IdleReady",
    overlay: normalizeOptionalText(visual.overlay),
    fallbackOverlay:
      Object.prototype.hasOwnProperty.call(visual, "fallbackOverlay")
        ? normalizeOptionalText(visual.fallbackOverlay)
        : null,
    direction: normalizeOptionalText(visual.direction),
    label: normalizeOptionalText(visual.label),
  };
}

function normalizePhase(rawPhase = {}, index) {
  const phase = rawPhase && typeof rawPhase === "object" ? rawPhase : {};
  const id = normalizeText(phase.id, "");
  if (!id) {
    throw new Error(`Phase #${index + 1} is missing "id".`);
  }
  return {
    id,
    durationMs: asPositiveInteger(phase.durationMs, 600, 100),
    visual: normalizeVisual(phase.visual),
    description: normalizeDescription(phase.description),
    context: sanitizeContext(phase.context),
  };
}

function normalizeStateDefinition(rawState = {}, index) {
  const state = rawState && typeof rawState === "object" ? rawState : {};
  const id = normalizeText(state.id, "");
  if (!id) {
    throw new Error(`State #${index + 1} is missing "id".`);
  }

  const kind = normalizeText(state.kind, "simple");
  if (kind !== "simple" && kind !== "phase") {
    throw new Error(`State "${id}" has unsupported kind "${kind}".`);
  }

  const phases =
    kind === "phase"
      ? (Array.isArray(state.phases) ? state.phases : []).map((entry, phaseIndex) =>
          normalizePhase(entry, phaseIndex)
        )
      : [];
  if (kind === "phase" && phases.length <= 0) {
    throw new Error(`Phase state "${id}" must define at least one phase.`);
  }

  return {
    id,
    kind,
    priority: asFiniteNumber(state.priority, 0),
    durationMs:
      kind === "simple" && Number.isFinite(Number(state.durationMs))
        ? asPositiveInteger(state.durationMs, null, 100)
        : null,
    visual: normalizeVisual(state.visual),
    description: normalizeDescription(state.description),
    context: sanitizeContext(state.context),
    phases,
    onCompleteStateId: normalizeOptionalText(state.onCompleteStateId),
  };
}

function normalizeStateCatalog(rawCatalog = {}) {
  const catalog = rawCatalog && typeof rawCatalog === "object" ? rawCatalog : {};
  const states = Array.isArray(catalog.states) ? catalog.states : [];
  if (states.length <= 0) {
    throw new Error("State catalog must define at least one state.");
  }

  const normalizedStates = states.map((entry, index) => normalizeStateDefinition(entry, index));
  const stateMap = new Map();
  for (const state of normalizedStates) {
    if (stateMap.has(state.id)) {
      throw new Error(`Duplicate state id "${state.id}" in state catalog.`);
    }
    stateMap.set(state.id, state);
  }

  const defaultStateId = normalizeOptionalText(catalog.defaultStateId) || normalizedStates[0].id;
  if (!stateMap.has(defaultStateId)) {
    throw new Error(`Default state "${defaultStateId}" is not defined in catalog.`);
  }

  const supportedOverlays = Array.isArray(catalog.supportedOverlays)
    ? catalog.supportedOverlays
        .map((entry) => normalizeOptionalText(entry))
        .filter(Boolean)
    : [];

  return {
    version: asPositiveInteger(catalog.version, 1),
    defaultStateId,
    states: normalizedStates,
    stateMap,
    supportedOverlays:
      supportedOverlays.length > 0 ? supportedOverlays : [...DEFAULT_SUPPORTED_OVERLAYS],
  };
}

function loadStateCatalog(catalogPath = DEFAULT_STATE_CATALOG_PATH) {
  let rawCatalog = null;
  try {
    rawCatalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to load state catalog "${catalogPath}": ${summarizeError(error)}`);
  }
  return normalizeStateCatalog(rawCatalog);
}

function summarizeContext(context = {}, limit = DEFAULT_CONTEXT_SUMMARY_LIMIT) {
  const parts = [];
  for (const [key, value] of Object.entries(context)) {
    if (value == null || value === "") continue;
    parts.push(`${key}=${value}`);
  }
  if (parts.length <= 0) return "none";
  return parts.join(", ").slice(0, clamp(limit, 32, 400));
}

class StateRuntime {
  constructor({
    catalogPath = DEFAULT_STATE_CATALOG_PATH,
    availableClipIds = [],
    supportedOverlays = DEFAULT_SUPPORTED_OVERLAYS,
    now = Date.now,
    scheduleTimeout = setTimeout,
    clearScheduledTimeout = clearTimeout,
    onSnapshot,
    logger,
  } = {}) {
    this._catalogPath = catalogPath;
    this._catalog = loadStateCatalog(catalogPath);
    this._availableClipIds =
      Array.isArray(availableClipIds) && availableClipIds.length > 0
        ? new Set(
            availableClipIds
              .map((entry) => normalizeOptionalText(entry))
              .filter(Boolean)
          )
        : null;
    this._supportedOverlays = new Set([
      ...this._catalog.supportedOverlays,
      ...(Array.isArray(supportedOverlays) ? supportedOverlays : []),
    ]);
    this._now = typeof now === "function" ? now : Date.now;
    this._scheduleTimeout =
      typeof scheduleTimeout === "function" ? scheduleTimeout : setTimeout;
    this._clearScheduledTimeout =
      typeof clearScheduledTimeout === "function" ? clearScheduledTimeout : clearTimeout;
    this._onSnapshot = typeof onSnapshot === "function" ? onSnapshot : null;
    this._logger = typeof logger === "function" ? logger : null;
    this._currentSnapshot = null;
    this._transitionTimer = null;
  }

  start() {
    if (this._currentSnapshot) {
      return this.getSnapshot();
    }
    const snapshot = this.activateState(this._catalog.defaultStateId, {
      source: "system",
      reason: "startup",
    });
    this._log("runtimeReady", {
      currentState: snapshot.currentState,
      catalogVersion: this._catalog.version,
      catalogPath: this._catalogPath,
    });
    return snapshot;
  }

  stop() {
    this._clearTransitionTimer();
  }

  getSnapshot() {
    return cloneJson(this._currentSnapshot);
  }

  getCatalogSummary() {
    return {
      version: this._catalog.version,
      defaultStateId: this._catalog.defaultStateId,
      stateIds: this._catalog.states.map((state) => state.id),
      supportedOverlays: [...this._supportedOverlays],
    };
  }

  activateState(stateId, options = {}) {
    const nowMs = asFiniteNumber(options.nowMs, this._now());
    const state =
      this._catalog.stateMap.get(normalizeText(stateId, "")) ||
      this._catalog.stateMap.get(this._catalog.defaultStateId);
    if (!state) {
      throw new Error(`Unable to resolve requested state "${stateId}".`);
    }

    const phase =
      state.kind === "phase"
        ? state.phases[0]
        : null;
    return this._applyResolvedState(state, phase, {
      nowMs,
      source: normalizeText(options.source, "manual"),
      reason: normalizeText(options.reason, "manual_trigger"),
      trigger: normalizeText(options.trigger, "manual"),
      durationMsOverride: Number.isFinite(Number(options.durationMs))
        ? asPositiveInteger(options.durationMs, null, 100)
        : null,
      onCompleteStateIdOverride: normalizeOptionalText(options.onCompleteStateId),
      context: sanitizeContext(options.context),
      replaceContext: Boolean(options.replaceContext),
      visualOverrides: sanitizeVisualOverrides(options.visualOverrides),
      visualTestMode: normalizeText(options.visualTestMode, "none"),
    });
  }

  simulateMissingVisualFallback() {
    return this.activateState("Reading", {
      source: "manual",
      reason: "manual_missing_resource_test",
      trigger: "manual-fallback",
      durationMs: 9000,
      onCompleteStateId: "Idle",
      replaceContext: true,
      visualTestMode: "missing_resources",
      context: {
        itemType: "book",
      },
    });
  }

  applyMusicState(payload = {}) {
    const requestedState = normalizeText(payload.suggestedState, "MusicChill");
    const resolvedStateId = this._catalog.stateMap.has(requestedState)
      ? requestedState
      : "MusicChill";
    const resolvedState = this._catalog.stateMap.get(resolvedStateId);
    if (
      resolvedState &&
      this._currentSnapshot &&
      this._currentSnapshot.currentState !== resolvedStateId &&
      this._currentSnapshot.priority > resolvedState.priority
    ) {
      this._log("stateIgnored", {
        requestedState: resolvedStateId,
        currentState: this._currentSnapshot.currentState,
        reason: "priority_guard",
      });
      return this.getSnapshot();
    }
    const title = normalizeOptionalText(payload.title);
    const artist = normalizeOptionalText(payload.artist);
    const album = normalizeOptionalText(payload.album);
    const sourceAppLabel = normalizeOptionalText(payload.sourceAppLabel);
    const titleLabel = title ? (artist ? `${title} by ${artist}` : title) : null;
    const durationMs = Number.isFinite(Number(payload.durationMs))
      ? asPositiveInteger(payload.durationMs, null, 100)
      : null;
    const onCompleteStateId = normalizeOptionalText(payload.onCompleteStateId);
    return this.activateState(resolvedStateId, {
      source: normalizeText(payload.provider, "media"),
      reason: "media_playing_music_mode",
      trigger: "media",
      ...(Number.isFinite(durationMs) ? { durationMs } : {}),
      ...(onCompleteStateId ? { onCompleteStateId } : {}),
      context: {
        ...(titleLabel ? { titleLabel } : {}),
        ...(title ? { title } : {}),
        ...(artist ? { artist } : {}),
        ...(album ? { album } : {}),
        ...(sourceAppLabel ? { sourceAppLabel } : {}),
        activeProp: resolveMusicOverlay(payload),
        outputRoute: normalizeText(payload.outputRoute, "unknown"),
        outputDeviceName: normalizeText(payload.outputDeviceName, "unknown_device"),
        outputDeviceType: normalizeText(payload.outputDeviceType, "unknown"),
      },
      visualOverrides: {
        overlay: resolveMusicOverlay(payload),
      },
    });
  }

  applyFreshRssReading(payload = {}) {
    const firstItem = Array.isArray(payload.items) && payload.items.length > 0 ? payload.items[0] : null;
    return this.activateState("Reading", {
      source: "freshrss",
      reason: "freshrss_latest_item",
      trigger: "freshrss",
      durationMs: 12000,
      onCompleteStateId: "Idle",
      context: {
        itemType: "rss article",
        title: normalizeText(firstItem?.title, "FreshRSS item"),
        sourceLabel: normalizeText(firstItem?.source, "FreshRSS"),
        url: normalizeText(firstItem?.url, "unavailable"),
      },
      visualOverrides: {
        overlay: "rssCard",
        label: "rss-card",
      },
    });
  }

  tick(nowMs = this._now()) {
    if (!this._currentSnapshot) {
      return this.start();
    }

    let snapshot = this._currentSnapshot;
    let changed = false;
    while (
      snapshot?.nextTransitionAtMs &&
      snapshot.nextTransitionAtMs > 0 &&
      asFiniteNumber(nowMs, 0) >= snapshot.nextTransitionAtMs
    ) {
      const currentState = this._catalog.stateMap.get(snapshot.currentState);
      if (!currentState) break;

      if (currentState.kind === "phase") {
        const currentPhaseIndex = currentState.phases.findIndex(
          (phase) => phase.id === snapshot.phase
        );
        const nextPhase =
          currentPhaseIndex >= 0 ? currentState.phases[currentPhaseIndex + 1] : null;
        if (nextPhase) {
          snapshot = this._applyResolvedState(currentState, nextPhase, {
            nowMs,
            source: snapshot.source,
            reason: "phase_advanced",
            trigger: snapshot.trigger,
            durationMsOverride: snapshot.durationMsOverride,
            onCompleteStateIdOverride: snapshot.onCompleteStateIdOverride,
            context: snapshot.context || {},
            visualOverrides: snapshot.visualOverrides || {},
            visualTestMode: snapshot.visualTestMode || "none",
          });
        } else {
          const nextStateId =
            snapshot.onCompleteStateIdOverride ||
            currentState.onCompleteStateId ||
            this._catalog.defaultStateId;
          snapshot = this.activateState(nextStateId, {
            nowMs,
            source: "system",
            reason: "phase_complete",
            trigger: currentState.id,
          });
        }
        changed = true;
        continue;
      }

      const activeDurationMs = Number.isFinite(snapshot.durationMsOverride)
        ? snapshot.durationMsOverride
        : currentState.durationMs;
      if (activeDurationMs && snapshot.enteredAtMs + activeDurationMs <= nowMs) {
        const nextStateId =
          snapshot.onCompleteStateIdOverride ||
          currentState.onCompleteStateId ||
          this._catalog.defaultStateId;
        snapshot = this.activateState(nextStateId, {
          nowMs,
          source: "system",
          reason: "duration_complete",
          trigger: currentState.id,
        });
        changed = true;
        continue;
      }
      break;
    }

    if (!changed) {
      this._scheduleNextTransition();
    }
    return this.getSnapshot();
  }

  describeActivity() {
    return this._buildDescription("doing");
  }

  describeReading() {
    return this._buildDescription("reading");
  }

  getContextSummary(limit = DEFAULT_CONTEXT_SUMMARY_LIMIT) {
    if (!this._currentSnapshot) return "none";
    return summarizeContext(this._currentSnapshot.context, limit);
  }

  _buildDescription(mode) {
    if (!this._currentSnapshot) {
      this.start();
    }

    const snapshot = this._currentSnapshot;
    const state = this._catalog.stateMap.get(snapshot.currentState);
    if (!state) {
      return {
        text: "I am in a safe local fallback mode.",
        contextAvailable: false,
        fallbackUsed: true,
      };
    }

    const currentPhase =
      state.kind === "phase"
        ? state.phases.find((phase) => phase.id === snapshot.phase) || null
        : null;
    const scopedDescription =
      currentPhase?.description && (
        currentPhase.description[`${mode}Text`] ||
        currentPhase.description[`${mode}Template`]
      )
        ? currentPhase.description
        : state.description;

    const textKey = `${mode}Text`;
    const templateKey = `${mode}Template`;
    const fallbackKey = `${mode}Fallback`;
    const directText = scopedDescription[textKey];
    if (directText) {
      return {
        text: directText,
        contextAvailable: true,
        fallbackUsed: false,
      };
    }

    if (scopedDescription[templateKey]) {
      const interpolated = interpolateTemplate(scopedDescription[templateKey], snapshot.context || {});
      if (interpolated.text.length > 0 && interpolated.missingKeys.length <= 0) {
        return {
          text: interpolated.text,
          contextAvailable: true,
          fallbackUsed: false,
        };
      }
    }

    return {
      text: scopedDescription[fallbackKey],
      contextAvailable: false,
      fallbackUsed: true,
    };
  }

  _applyResolvedState(state, phase, meta) {
    const enteredAtMs = asFiniteNumber(meta.nowMs, this._now());
    const baseContext = meta.replaceContext
      ? {}
      : {
          ...sanitizeContext(state.context),
        };
    const context = {
      ...baseContext,
      ...sanitizeContext(phase?.context),
      ...sanitizeContext(meta.context),
    };
    const baseVisual = {
      ...(phase?.visual || state.visual),
      ...(meta.visualOverrides || {}),
    };
    const visual = this._resolveVisualBinding(baseVisual, meta.visualTestMode);
    const nextTransitionAtMs = this._resolveNextTransitionAtMs(state, phase, enteredAtMs, meta);
    const snapshot = {
      ts: enteredAtMs,
      catalogVersion: this._catalog.version,
      currentState: state.id,
      priority: state.priority,
      phase: phase?.id || null,
      phaseIndex: phase ? state.phases.findIndex((entry) => entry.id === phase.id) : -1,
      phaseCount: phase ? state.phases.length : 0,
      source: meta.source,
      reason: meta.reason,
      trigger: meta.trigger,
      enteredAtMs,
      nextTransitionAtMs,
      durationMsOverride: Number.isFinite(meta.durationMsOverride) ? meta.durationMsOverride : null,
      onCompleteStateIdOverride: normalizeOptionalText(meta.onCompleteStateIdOverride),
      visualOverrides: cloneJson(meta.visualOverrides || {}),
      visualTestMode: meta.visualTestMode,
      visual,
      visualFallbackUsed: visual.fallbackUsed,
      fallbackReasons: [...visual.fallbackReasons],
      context,
      contextSummary: summarizeContext(context),
      description: {
        doing: this._buildPreviewDescription(state, phase, context, "doing"),
        reading: this._buildPreviewDescription(state, phase, context, "reading"),
      },
    };

    this._currentSnapshot = snapshot;
    this._scheduleNextTransition();
    this._emitSnapshot(snapshot);
    if (snapshot.visualFallbackUsed) {
      this._log("visualFallback", {
        stateId: snapshot.currentState,
        phase: snapshot.phase,
        fallbackReasons: snapshot.fallbackReasons,
      });
    }
    return this.getSnapshot();
  }

  _buildPreviewDescription(state, phase, context, mode) {
    const stateDescription = this._buildDescriptionFor(state, phase, context, mode);
    return stateDescription.text;
  }

  _buildDescriptionFor(state, phase, context, mode) {
    const scopedDescription =
      phase?.description && (
        phase.description[`${mode}Text`] ||
        phase.description[`${mode}Template`]
      )
        ? phase.description
        : state.description;
    const directText = scopedDescription[`${mode}Text`];
    if (directText) {
      return {
        text: directText,
        contextAvailable: true,
        fallbackUsed: false,
      };
    }
    if (scopedDescription[`${mode}Template`]) {
      const interpolated = interpolateTemplate(scopedDescription[`${mode}Template`], context);
      if (interpolated.text.length > 0 && interpolated.missingKeys.length <= 0) {
        return {
          text: interpolated.text,
          contextAvailable: true,
          fallbackUsed: false,
        };
      }
    }
    return {
      text: scopedDescription[`${mode}Fallback`],
      contextAvailable: false,
      fallbackUsed: true,
    };
  }

  _resolveNextTransitionAtMs(state, phase, enteredAtMs, meta = {}) {
    if (phase && phase.durationMs) {
      return enteredAtMs + phase.durationMs;
    }
    const durationMs = Number.isFinite(meta.durationMsOverride) ? meta.durationMsOverride : state.durationMs;
    if (durationMs) {
      return enteredAtMs + durationMs;
    }
    return null;
  }

  _resolveVisualBinding(visual, visualTestMode = "none") {
    const requestedClip =
      visualTestMode === "missing_resources"
        ? "MissingClip"
        : normalizeText(visual?.clip, "IdleReady");
    const requestedOverlay =
      visualTestMode === "missing_resources"
        ? "missing_overlay"
        : normalizeOptionalText(visual?.overlay);
    const fallbackClip = normalizeText(visual?.fallbackClip, "IdleReady");
    const fallbackOverlay = normalizeOptionalText(visual?.fallbackOverlay);
    const fallbackReasons = [];

    let clip = requestedClip;
    if (this._availableClipIds && !this._availableClipIds.has(requestedClip)) {
      clip = this._availableClipIds.has(fallbackClip) ? fallbackClip : this._catalog.defaultStateId === "Idle" ? "IdleReady" : fallbackClip;
      fallbackReasons.push(`clip:${requestedClip}`);
    }

    let overlay = requestedOverlay;
    if (requestedOverlay && !this._supportedOverlays.has(requestedOverlay)) {
      overlay =
        fallbackOverlay && this._supportedOverlays.has(fallbackOverlay)
          ? fallbackOverlay
          : null;
      fallbackReasons.push(`overlay:${requestedOverlay}`);
    }

    return {
      clip,
      requestedClip,
      overlay,
      requestedOverlay,
      direction: normalizeOptionalText(visual?.direction),
      label: normalizeOptionalText(visual?.label),
      fallbackUsed: fallbackReasons.length > 0,
      fallbackReasons,
    };
  }

  _scheduleNextTransition() {
    this._clearTransitionTimer();
    const nextTransitionAtMs = this._currentSnapshot?.nextTransitionAtMs;
    if (!Number.isFinite(nextTransitionAtMs) || nextTransitionAtMs <= 0) return;
    const delayMs = Math.max(1, Math.round(nextTransitionAtMs - this._now()));
    this._transitionTimer = this._scheduleTimeout(() => {
      this._transitionTimer = null;
      this.tick(this._now());
    }, delayMs);
  }

  _clearTransitionTimer() {
    if (!this._transitionTimer) return;
    this._clearScheduledTimeout(this._transitionTimer);
    this._transitionTimer = null;
  }

  _emitSnapshot(snapshot) {
    this._log("stateChanged", {
      currentState: snapshot.currentState,
      phase: snapshot.phase,
      reason: snapshot.reason,
      visualClip: snapshot.visual?.clip || "IdleReady",
      visualFallbackUsed: snapshot.visualFallbackUsed,
    });
    if (this._onSnapshot) {
      this._onSnapshot(this.getSnapshot());
    }
  }

  _log(kind, payload) {
    if (!this._logger) return;
    this._logger(kind, payload);
  }
}

function createStateRuntime(options) {
  return new StateRuntime(options);
}

module.exports = {
  DEFAULT_CONTEXT_SUMMARY_LIMIT,
  DEFAULT_STATE_CATALOG_PATH,
  DEFAULT_SUPPORTED_OVERLAYS,
  createStateRuntime,
  loadStateCatalog,
};
