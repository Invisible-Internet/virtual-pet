"use strict";

const BRIDGE_MODES = Object.freeze({
  online: "online",
  offline: "offline",
  timeout: "timeout",
});

const VALID_BRIDGE_MODES = new Set(Object.values(BRIDGE_MODES));
const DEFAULT_SIMULATED_LATENCY_MS = 90;
const DEFAULT_TIMEOUT_LATENCY_MS = 2600;
const DEFAULT_TEXT_LIMIT = 240;
const DEFAULT_SUMMARY_LIMIT = 180;

function asPositiveInteger(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.round(numeric));
}

function normalizeText(value, maxLength = DEFAULT_TEXT_LIMIT) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(1, maxLength - 3))}...`;
}

function normalizeBridgeMode(value, fallback = BRIDGE_MODES.online) {
  const normalized = normalizeText(value, 32).toLowerCase();
  if (VALID_BRIDGE_MODES.has(normalized)) return normalized;
  return fallback;
}

function normalizeContext(context) {
  const raw = context && typeof context === "object" ? context : {};
  return {
    currentState: normalizeText(raw.currentState || "Idle", 48) || "Idle",
    stateContextSummary: normalizeText(raw.stateContextSummary, DEFAULT_SUMMARY_LIMIT),
    activePropsSummary: normalizeText(raw.activePropsSummary, DEFAULT_SUMMARY_LIMIT),
    extensionContextSummary: normalizeText(raw.extensionContextSummary, DEFAULT_SUMMARY_LIMIT),
    source: normalizeText(raw.source || "offline", 16) || "offline",
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createBridgeError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function requestWithTimeout(task, timeoutMs) {
  const boundedTimeoutMs = asPositiveInteger(timeoutMs, 1200);
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(
        createBridgeError("bridge_timeout", "OpenClaw request timed out.", {
          timeoutMs: boundedTimeoutMs,
        })
      );
    }, boundedTimeoutMs);

    Promise.resolve(task).then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

class OpenClawBridge {
  constructor({
    mode = BRIDGE_MODES.online,
    simulatedLatencyMs = DEFAULT_SIMULATED_LATENCY_MS,
    simulatedTimeoutLatencyMs = DEFAULT_TIMEOUT_LATENCY_MS,
    logger = null,
  } = {}) {
    this._mode = normalizeBridgeMode(mode);
    this._simulatedLatencyMs = asPositiveInteger(simulatedLatencyMs, DEFAULT_SIMULATED_LATENCY_MS);
    this._simulatedTimeoutLatencyMs = asPositiveInteger(
      simulatedTimeoutLatencyMs,
      DEFAULT_TIMEOUT_LATENCY_MS
    );
    this._logger = typeof logger === "function" ? logger : null;
  }

  getMode() {
    return this._mode;
  }

  setMode(mode) {
    this._mode = normalizeBridgeMode(mode, this._mode);
    return this._mode;
  }

  getStartupState() {
    if (this._mode === BRIDGE_MODES.offline) {
      return {
        state: "degraded",
        reason: "offlineFallback",
        details: {
          mode: this._mode,
        },
      };
    }
    if (this._mode === BRIDGE_MODES.timeout) {
      return {
        state: "healthy",
        reason: "simulatedTimeoutMode",
        details: {
          mode: this._mode,
        },
      };
    }
    return {
      state: "healthy",
      reason: "simulatedOnlineReady",
      details: {
        mode: this._mode,
      },
    };
  }

  async sendDialog({ route, correlationId, promptText, context }) {
    const request = this._buildRequestEnvelope({
      route,
      correlationId,
      promptText,
      context,
    });

    this._log("request", {
      correlationId: request.correlationId,
      route: request.route,
      mode: this._mode,
      source: request.context.source,
    });

    if (this._mode === BRIDGE_MODES.offline) {
      throw createBridgeError("bridge_unavailable", "OpenClaw bridge is offline.", {
        mode: this._mode,
      });
    }

    const latencyMs =
      this._mode === BRIDGE_MODES.timeout
        ? this._simulatedTimeoutLatencyMs
        : this._simulatedLatencyMs;
    await sleep(latencyMs);

    const response = this._buildResponse(request);
    this._log("response", {
      correlationId: request.correlationId,
      route: request.route,
      mode: this._mode,
      proposedActions: response.proposedActions.length,
    });

    return {
      request,
      response,
    };
  }

  _buildRequestEnvelope({ route, correlationId, promptText, context }) {
    const normalizedRoute = normalizeText(route, 48) || "dialog_user_command";
    const normalizedPrompt = normalizeText(promptText);
    const normalizedContext = normalizeContext(context);
    return {
      schemaVersion: "1.0",
      route: normalizedRoute,
      correlationId: normalizeText(correlationId, 64) || `bridge-${Date.now().toString(36)}`,
      ts: Date.now(),
      promptText: normalizedPrompt,
      context: normalizedContext,
    };
  }

  _buildResponse(request) {
    const prompt = request.promptText.toLowerCase();
    if (prompt.includes("guardrail-test")) {
      return {
        source: "online",
        text:
          "I propose entering Sleep and adjusting render cadence for this test request.",
        proposedActions: [
          {
            type: "set_state",
            targetState: "Sleep",
          },
          {
            type: "render_control",
            operation: "setCadence",
            value: "low",
          },
          {
            type: "identity_mutation",
            target: "Immutable Core",
          },
        ],
      };
    }

    if (request.route === "introspection_status") {
      const state = request.context.currentState || "Idle";
      return {
        source: "online",
        text: `OpenClaw bridge online. Current state=${state}.`,
        proposedActions: [],
      };
    }

    return {
      source: "online",
      text: `OpenClaw response: ${request.promptText || "Acknowledged."}`,
      proposedActions: [],
    };
  }

  _log(kind, payload) {
    if (!this._logger) return;
    this._logger(kind, payload);
  }
}

function createOpenClawBridge(options) {
  return new OpenClawBridge(options);
}

module.exports = {
  BRIDGE_MODES,
  createOpenClawBridge,
  normalizeBridgeMode,
  requestWithTimeout,
};
