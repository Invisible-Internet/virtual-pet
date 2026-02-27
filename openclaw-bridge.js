"use strict";

const BRIDGE_MODES = Object.freeze({
  online: "online",
  offline: "offline",
  timeout: "timeout",
});

const BRIDGE_TRANSPORTS = Object.freeze({
  stub: "stub",
  http: "http",
});

const VALID_BRIDGE_MODES = new Set(Object.values(BRIDGE_MODES));
const VALID_BRIDGE_TRANSPORTS = new Set(Object.values(BRIDGE_TRANSPORTS));
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const DEFAULT_SIMULATED_LATENCY_MS = 90;
const DEFAULT_TIMEOUT_LATENCY_MS = 2600;
const DEFAULT_TEXT_LIMIT = 240;
const DEFAULT_SUMMARY_LIMIT = 180;
const DEFAULT_HTTP_TIMEOUT_MS = 1200;

function asPositiveInteger(value, fallback, min = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < min) return fallback;
  return Math.max(min, Math.round(numeric));
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

function normalizeBridgeTransport(value, fallback = BRIDGE_TRANSPORTS.stub) {
  const normalized = normalizeText(value, 16).toLowerCase();
  if (VALID_BRIDGE_TRANSPORTS.has(normalized)) return normalized;
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

function isLoopbackUrl(value) {
  const normalized = normalizeText(value, 512);
  if (!normalized) return false;
  try {
    const url = new URL(normalized);
    return LOOPBACK_HOSTS.has((url.hostname || "").toLowerCase());
  } catch {
    return false;
  }
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
  const boundedTimeoutMs = asPositiveInteger(timeoutMs, DEFAULT_HTTP_TIMEOUT_MS, 200);
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
    transport = BRIDGE_TRANSPORTS.stub,
    baseUrl = "http://127.0.0.1:18789/bridge/dialog",
    retryCount = 0,
    authToken = null,
    allowNonLoopback = false,
    requestTimeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
    simulatedLatencyMs = DEFAULT_SIMULATED_LATENCY_MS,
    simulatedTimeoutLatencyMs = DEFAULT_TIMEOUT_LATENCY_MS,
    logger = null,
    fetchImpl = null,
  } = {}) {
    this._mode = normalizeBridgeMode(mode);
    this._transport = normalizeBridgeTransport(transport);
    this._baseUrl = normalizeText(baseUrl, 512);
    this._retryCount = asPositiveInteger(retryCount, 0, 0);
    this._authToken = normalizeText(authToken, 1024) || null;
    this._allowNonLoopback = Boolean(allowNonLoopback);
    this._requestTimeoutMs = asPositiveInteger(requestTimeoutMs, DEFAULT_HTTP_TIMEOUT_MS, 200);
    this._simulatedLatencyMs = asPositiveInteger(simulatedLatencyMs, DEFAULT_SIMULATED_LATENCY_MS);
    this._simulatedTimeoutLatencyMs = asPositiveInteger(
      simulatedTimeoutLatencyMs,
      DEFAULT_TIMEOUT_LATENCY_MS
    );
    this._logger = typeof logger === "function" ? logger : null;
    this._fetch =
      typeof fetchImpl === "function"
        ? fetchImpl
        : typeof globalThis.fetch === "function"
          ? (...args) => globalThis.fetch(...args)
          : null;
  }

  getMode() {
    return this._mode;
  }

  getTransport() {
    return this._transport;
  }

  getBaseUrl() {
    return this._baseUrl;
  }

  setMode(mode) {
    this._mode = normalizeBridgeMode(mode, this._mode);
    return this._mode;
  }

  getStartupState() {
    if (this._transport === BRIDGE_TRANSPORTS.http) {
      if (!this._baseUrl) {
        return {
          state: "degraded",
          reason: "httpConfigInvalid",
          details: {
            transport: this._transport,
            baseUrl: this._baseUrl,
          },
        };
      }
      let parsed = null;
      try {
        parsed = new URL(this._baseUrl);
      } catch {
        return {
          state: "degraded",
          reason: "httpConfigInvalid",
          details: {
            transport: this._transport,
            baseUrl: this._baseUrl,
          },
        };
      }

      const loopback = isLoopbackUrl(this._baseUrl);
      if (!loopback && !this._allowNonLoopback) {
        return {
          state: "degraded",
          reason: "nonLoopbackDisabled",
          details: {
            transport: this._transport,
            host: parsed.hostname,
          },
        };
      }
      if (!loopback && !this._authToken) {
        return {
          state: "degraded",
          reason: "authTokenRequiredForNonLoopback",
          details: {
            transport: this._transport,
            host: parsed.hostname,
          },
        };
      }
      return {
        state: "healthy",
        reason: "httpConfigured",
        details: {
          transport: this._transport,
          loopback,
          host: parsed.hostname,
        },
      };
    }

    if (this._mode === BRIDGE_MODES.offline) {
      return {
        state: "degraded",
        reason: "offlineFallback",
        details: {
          mode: this._mode,
          transport: this._transport,
        },
      };
    }
    if (this._mode === BRIDGE_MODES.timeout) {
      return {
        state: "healthy",
        reason: "simulatedTimeoutMode",
        details: {
          mode: this._mode,
          transport: this._transport,
        },
      };
    }
    return {
      state: "healthy",
      reason: "simulatedOnlineReady",
      details: {
        mode: this._mode,
        transport: this._transport,
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
    const endpointClass =
      this._transport === BRIDGE_TRANSPORTS.http
        ? isLoopbackUrl(this._baseUrl)
          ? "loopback"
          : "non-loopback"
        : "stub";

    this._log("request", {
      correlationId: request.correlationId,
      route: request.route,
      mode: this._mode,
      transport: this._transport,
      endpointClass,
      source: request.context.source,
    });

    if (this._transport === BRIDGE_TRANSPORTS.http) {
      return this._sendHttpDialog(request);
    }

    if (this._mode === BRIDGE_MODES.offline) {
      throw createBridgeError("bridge_unavailable", "OpenClaw bridge is offline.", {
        mode: this._mode,
        transport: this._transport,
      });
    }

    const latencyMs =
      this._mode === BRIDGE_MODES.timeout
        ? this._simulatedTimeoutLatencyMs
        : this._simulatedLatencyMs;
    await sleep(latencyMs);

    const response = this._buildStubResponse(request);
    this._log("response", {
      correlationId: request.correlationId,
      route: request.route,
      mode: this._mode,
      transport: this._transport,
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

  _buildStubResponse(request) {
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

  _normalizeHttpResponsePayload(payload, request) {
    const root = payload && typeof payload === "object" ? payload : {};
    const nested = root.response && typeof root.response === "object" ? root.response : root;

    const text =
      normalizeText(nested.text, DEFAULT_TEXT_LIMIT) ||
      normalizeText(root.text, DEFAULT_TEXT_LIMIT) ||
      `OpenClaw HTTP response unavailable for route=${request.route}.`;
    const source = normalizeText(nested.source || root.source || "online", 16) || "online";

    const proposedActions =
      Array.isArray(nested.proposedActions)
        ? nested.proposedActions
        : Array.isArray(root.proposedActions)
          ? root.proposedActions
          : [];

    return {
      source,
      text,
      proposedActions,
    };
  }

  async _sendHttpDialog(request) {
    if (!this._fetch) {
      throw createBridgeError("bridge_unavailable", "Fetch API unavailable for HTTP bridge transport.", {
        transport: this._transport,
      });
    }

    let parsedUrl = null;
    try {
      parsedUrl = new URL(this._baseUrl);
    } catch {
      throw createBridgeError("bridge_config_invalid", "Invalid OpenClaw HTTP baseUrl.", {
        transport: this._transport,
        baseUrl: this._baseUrl,
      });
    }

    const loopback = isLoopbackUrl(this._baseUrl);
    if (!loopback && !this._allowNonLoopback) {
      throw createBridgeError(
        "bridge_non_loopback_disabled",
        "Non-loopback OpenClaw endpoints are disabled by policy.",
        {
          host: parsedUrl.hostname,
          transport: this._transport,
        }
      );
    }
    if (!loopback && !this._authToken) {
      throw createBridgeError(
        "bridge_auth_required",
        "Auth token required for non-loopback OpenClaw endpoint.",
        {
          host: parsedUrl.hostname,
          transport: this._transport,
        }
      );
    }

    let lastError = null;
    for (let attempt = 0; attempt <= this._retryCount; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this._requestTimeoutMs);
      try {
        const headers = {
          "Content-Type": "application/json",
        };
        if (this._authToken) {
          headers.Authorization = `Bearer ${this._authToken}`;
        }

        const response = await this._fetch(this._baseUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        let payload = null;
        const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
        if (contentType.includes("application/json")) {
          payload = await response.json();
        } else {
          const text = await response.text();
          payload = { text };
        }

        if (!response.ok) {
          throw createBridgeError("bridge_unavailable", "OpenClaw HTTP endpoint returned non-2xx status.", {
            status: response.status,
            statusText: response.statusText,
            attempt,
            payload,
          });
        }

        const normalizedResponse = this._normalizeHttpResponsePayload(payload, request);
        this._log("response", {
          correlationId: request.correlationId,
          route: request.route,
          mode: this._mode,
          transport: this._transport,
          status: response.status,
          proposedActions: normalizedResponse.proposedActions.length,
        });

        return {
          request,
          response: normalizedResponse,
        };
      } catch (error) {
        lastError = error;
        const isAbort = error?.name === "AbortError";
        const retryable =
          isAbort ||
          error?.code === "ECONNREFUSED" ||
          error?.code === "ECONNRESET" ||
          error?.code === "ETIMEDOUT" ||
          error?.code === "bridge_unavailable";
        if (!retryable || attempt >= this._retryCount) {
          if (isAbort) {
            throw createBridgeError("bridge_timeout", "OpenClaw HTTP request timed out.", {
              timeoutMs: this._requestTimeoutMs,
              attempt,
              transport: this._transport,
            });
          }
          if (error && error.code) {
            throw error;
          }
          throw createBridgeError(
            "bridge_unavailable",
            `OpenClaw HTTP request failed: ${error?.message || String(error)}`,
            {
              attempt,
              transport: this._transport,
            }
          );
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw (
      lastError ||
      createBridgeError("bridge_unavailable", "OpenClaw HTTP request failed after retries.", {
        transport: this._transport,
      })
    );
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
  BRIDGE_TRANSPORTS,
  createOpenClawBridge,
  normalizeBridgeMode,
  normalizeBridgeTransport,
  isLoopbackUrl,
  requestWithTimeout,
};
