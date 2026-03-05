"use strict";

const { execFile } = require("child_process");

const BRIDGE_MODES = Object.freeze({
  online: "online",
  offline: "offline",
  timeout: "timeout",
});

const BRIDGE_TRANSPORTS = Object.freeze({
  stub: "stub",
  http: "http",
  ws: "ws",
});

const VALID_BRIDGE_MODES = new Set(Object.values(BRIDGE_MODES));
const VALID_BRIDGE_TRANSPORTS = new Set(Object.values(BRIDGE_TRANSPORTS));
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const DEFAULT_SIMULATED_LATENCY_MS = 90;
const DEFAULT_TIMEOUT_LATENCY_MS = 2600;
const DEFAULT_TEXT_LIMIT = 240;
const DEFAULT_SUMMARY_LIMIT = 180;
const DEFAULT_DIALOG_CONTEXT_TEXT_LIMIT = 140;
const DEFAULT_DIALOG_CONTEXT_TURNS_LIMIT = 6;
const DEFAULT_HTTP_TIMEOUT_MS = 1200;
const DEFAULT_GATEWAY_SESSION_KEY = "main";
const GATEWAY_PROTOCOL_VERSION = 3;
const GATEWAY_ROLE_OPERATOR = "operator";
const GATEWAY_OPERATOR_SCOPES = Object.freeze([
  "operator.admin",
  "operator.approvals",
  "operator.pairing",
]);
const GATEWAY_CONNECT_AUTH_CODES = new Set([
  "AUTH_REQUIRED",
  "AUTH_UNAUTHORIZED",
  "AUTH_TOKEN_MISSING",
  "AUTH_TOKEN_MISMATCH",
  "AUTH_TOKEN_NOT_CONFIGURED",
  "AUTH_PASSWORD_MISSING",
  "AUTH_PASSWORD_MISMATCH",
  "AUTH_PASSWORD_NOT_CONFIGURED",
  "AUTH_DEVICE_TOKEN_MISMATCH",
  "PAIRING_REQUIRED",
  "CONTROL_UI_DEVICE_IDENTITY_REQUIRED",
  "DEVICE_IDENTITY_REQUIRED",
]);

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
  const rawTurns = Array.isArray(raw.recentDialogTurns) ? raw.recentDialogTurns : [];
  const recentDialogTurns = [];
  for (const turn of rawTurns) {
    if (recentDialogTurns.length >= DEFAULT_DIALOG_CONTEXT_TURNS_LIMIT) break;
    const role = normalizeText(turn?.role, 8).toLowerCase();
    if (role !== "user" && role !== "pet") continue;
    const text = normalizeText(turn?.text, DEFAULT_DIALOG_CONTEXT_TEXT_LIMIT);
    if (!text) continue;
    const source = normalizeText(turn?.source, 24) || (role === "user" ? "local_ui" : "offline");
    recentDialogTurns.push({
      role,
      text,
      source,
    });
  }
  return {
    currentState: normalizeText(raw.currentState || "Idle", 48) || "Idle",
    stateContextSummary: normalizeText(raw.stateContextSummary, DEFAULT_SUMMARY_LIMIT),
    activePropsSummary: normalizeText(raw.activePropsSummary, DEFAULT_SUMMARY_LIMIT),
    extensionContextSummary: normalizeText(raw.extensionContextSummary, DEFAULT_SUMMARY_LIMIT),
    recentDialogSummary: normalizeText(raw.recentDialogSummary, DEFAULT_SUMMARY_LIMIT),
    recentDialogTurns,
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

function isWebSocketOpen(socket, WebSocketImpl) {
  if (!socket) return false;
  const openState =
    typeof WebSocketImpl?.OPEN === "number" ? WebSocketImpl.OPEN : 1;
  return socket.readyState === openState;
}

function toWebSocketUrl(value) {
  const normalized = normalizeText(value, 512);
  if (!normalized) return null;

  let parsed = null;
  try {
    parsed = new URL(normalized);
  } catch {
    try {
      parsed = new URL(`ws://${normalized}`);
    } catch {
      return null;
    }
  }

  const protocol = (parsed.protocol || "").toLowerCase();
  if (protocol === "http:") {
    parsed.protocol = "ws:";
  } else if (protocol === "https:") {
    parsed.protocol = "wss:";
  } else if (protocol !== "ws:" && protocol !== "wss:") {
    return null;
  }

  if (parsed.pathname === "/bridge/dialog" || parsed.pathname === "") {
    parsed.pathname = "/";
  }
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function extractGatewayMessageText(message) {
  if (!message || typeof message !== "object") return "";

  if (typeof message.content === "string") {
    return normalizeText(message.content, DEFAULT_TEXT_LIMIT);
  }

  if (Array.isArray(message.content)) {
    const textParts = message.content
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        if (entry.type !== "text" || typeof entry.text !== "string") return null;
        return entry.text;
      })
      .filter((value) => typeof value === "string" && value.trim().length > 0);
    if (textParts.length > 0) {
      return normalizeText(textParts.join("\n"), DEFAULT_TEXT_LIMIT);
    }
  }

  if (typeof message.text === "string") {
    return normalizeText(message.text, DEFAULT_TEXT_LIMIT);
  }

  return "";
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shellQuote(value) {
  const text = typeof value === "string" ? value : String(value ?? "");
  return `'${text.replace(/'/g, `'\"'\"'`)}'`;
}

function execFileAsync(execFileImpl, file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFileImpl(file, args, options, (error, stdout, stderr) => {
      if (error) {
        const nextError = error;
        nextError.stdout = stdout;
        nextError.stderr = stderr;
        reject(nextError);
        return;
      }
      resolve({
        stdout,
        stderr,
      });
    });
  });
}

function parseJsonFromText(rawText) {
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {}

  const objectStart = text.indexOf("{");
  const objectEnd = text.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    try {
      return JSON.parse(text.slice(objectStart, objectEnd + 1));
    } catch {}
  }
  return null;
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
    sessionKey = DEFAULT_GATEWAY_SESSION_KEY,
    requestTimeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
    simulatedLatencyMs = DEFAULT_SIMULATED_LATENCY_MS,
    simulatedTimeoutLatencyMs = DEFAULT_TIMEOUT_LATENCY_MS,
    logger = null,
    fetchImpl = null,
    webSocketImpl = null,
    execFileImpl = null,
  } = {}) {
    this._mode = normalizeBridgeMode(mode);
    this._transport = normalizeBridgeTransport(transport);
    this._baseUrl = normalizeText(baseUrl, 512);
    this._retryCount = asPositiveInteger(retryCount, 0, 0);
    this._authToken = normalizeText(authToken, 1024) || null;
    this._allowNonLoopback = Boolean(allowNonLoopback);
    this._sessionKey = normalizeText(sessionKey, 96) || DEFAULT_GATEWAY_SESSION_KEY;
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
    this._WebSocket =
      typeof webSocketImpl === "function"
        ? webSocketImpl
        : typeof globalThis.WebSocket === "function"
          ? globalThis.WebSocket
          : null;
    this._execFile = typeof execFileImpl === "function" ? execFileImpl : execFile;
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

    if (this._transport === BRIDGE_TRANSPORTS.ws) {
      if (!this._WebSocket) {
        if (this._execFile) {
          return {
            state: "healthy",
            reason: "wsCliRelayConfigured",
            details: {
              transport: this._transport,
              relay: "gateway_cli",
            },
          };
        }
        return {
          state: "degraded",
          reason: "wsRuntimeUnavailable",
          details: {
            transport: this._transport,
          },
        };
      }

      let parsed = null;
      let endpoint = null;
      try {
        endpoint = this._resolveWebSocketEndpoint();
        parsed = new URL(endpoint.url);
      } catch {
        return {
          state: "degraded",
          reason: "wsConfigInvalid",
          details: {
            transport: this._transport,
            baseUrl: this._baseUrl,
          },
        };
      }

      if (!endpoint.loopback && !this._allowNonLoopback) {
        return {
          state: "degraded",
          reason: "nonLoopbackDisabled",
          details: {
            transport: this._transport,
            host: parsed.hostname,
          },
        };
      }
      if (!endpoint.loopback && !this._authToken) {
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
        reason: "wsConfigured",
        details: {
          transport: this._transport,
          endpoint: endpoint.url,
          loopback: endpoint.loopback,
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
        : this._transport === BRIDGE_TRANSPORTS.ws
          ? isLoopbackUrl(toWebSocketUrl(this._baseUrl) || "")
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

    if (this._mode === BRIDGE_MODES.offline) {
      throw createBridgeError("bridge_unavailable", "OpenClaw bridge is offline.", {
        mode: this._mode,
        transport: this._transport,
      });
    }

    if (this._transport === BRIDGE_TRANSPORTS.http) {
      return this._sendHttpDialog(request);
    }
    if (this._transport === BRIDGE_TRANSPORTS.ws) {
      return this._sendWebSocketDialog(request);
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

    const hasFollowupLanguage = /\b(that|this|it|follow up|expand|next step|continue)\b/.test(prompt);
    if (request.route === "dialog_user_message" && hasFollowupLanguage) {
      const recentSummary = request.context.recentDialogSummary;
      if (recentSummary) {
        return {
          source: "online",
          text: `Following up from context: ${recentSummary}.`,
          proposedActions: [],
        };
      }
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

  _resolveWebSocketEndpoint() {
    const endpointUrl = toWebSocketUrl(this._baseUrl);
    if (!endpointUrl) {
      throw createBridgeError("bridge_config_invalid", "Invalid OpenClaw WebSocket baseUrl.", {
        transport: this._transport,
        baseUrl: this._baseUrl,
      });
    }
    const parsed = new URL(endpointUrl);
    return {
      url: parsed.toString(),
      host: parsed.hostname,
      loopback: LOOPBACK_HOSTS.has((parsed.hostname || "").toLowerCase()),
    };
  }

  _buildGatewayConnectPayload(correlationId) {
    const authPayload = this._authToken ? { token: this._authToken } : undefined;
    return {
      minProtocol: GATEWAY_PROTOCOL_VERSION,
      maxProtocol: GATEWAY_PROTOCOL_VERSION,
      client: {
        id: "virtual-pet-bridge",
        version: "0.0.1",
        platform: process.platform || "node",
        mode: "cli",
        instanceId: correlationId,
      },
      role: GATEWAY_ROLE_OPERATOR,
      scopes: [...GATEWAY_OPERATOR_SCOPES],
      caps: [],
      auth: authPayload,
      userAgent: "virtual-pet-bridge",
      locale: "en-US",
    };
  }

  _buildGatewayDialogMessage(request) {
    const prompt = normalizeText(request?.promptText, DEFAULT_TEXT_LIMIT) || "Hello.";
    if (request?.route !== "dialog_user_message") return prompt;
    const summary = normalizeText(request?.context?.recentDialogSummary, DEFAULT_SUMMARY_LIMIT);
    if (!summary) return prompt;
    return `${prompt}\n\nRecent context: ${summary}`;
  }

  _summarizeGatewayStatusPayload(payload, fallbackState = "Idle") {
    const value = payload && typeof payload === "object" ? payload : {};
    const state = normalizeText(value.state, 64) || fallbackState;
    const health = normalizeText(value.health, 32) || "unknown";
    const provider = normalizeText(value.provider, 64);
    const model = normalizeText(value.model, 64);
    const providerPart = provider ? ` provider=${provider}` : "";
    const modelPart = model ? ` model=${model}` : "";
    return `OpenClaw gateway status: state=${state} health=${health}${providerPart}${modelPart}.`;
  }

  _shouldFallbackToGatewayCli(error) {
    if (!this._execFile) return false;
    const message = normalizeText(error?.message, 320).toLowerCase();
    if (message.includes("websocket api unavailable")) return true;

    const gatewayCode = normalizeText(error?.details?.gatewayCode, 64).toUpperCase();
    if (
      gatewayCode === "INVALID_REQUEST" ||
      gatewayCode === "NOT_PAIRED" ||
      gatewayCode === "DEVICE_IDENTITY_REQUIRED" ||
      gatewayCode === "CONTROL_UI_DEVICE_IDENTITY_REQUIRED"
    ) {
      return true;
    }
    if (message.includes("origin not allowed")) return true;
    if (message.includes("device identity required")) return true;
    if (message.includes("not paired")) return true;
    return false;
  }

  async _runGatewayCliCall(method, params = {}, { expectFinal = false } = {}) {
    if (!this._execFile) {
      throw createBridgeError("bridge_unavailable", "WSL/OpenClaw CLI unavailable for gateway fallback.", {
        transport: this._transport,
      });
    }

    const safeMethod = normalizeText(method, 96);
    const safeParams = params && typeof params === "object" ? params : {};
    const timeoutMs = asPositiveInteger(this._requestTimeoutMs, DEFAULT_HTTP_TIMEOUT_MS, 200);
    const commandParts = [
      "openclaw gateway call",
      shellQuote(safeMethod),
      "--json",
      expectFinal ? "--expect-final" : "",
      `--timeout ${Math.max(1000, timeoutMs)}`,
      `--params ${shellQuote(JSON.stringify(safeParams))}`,
    ].filter((part) => typeof part === "string" && part.length > 0);
    const command = commandParts.join(" ");

    try {
      const result = await execFileAsync(this._execFile, "wsl", ["bash", "-lc", command], {
        timeout: Math.max(timeoutMs + 3000, 5000),
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
      const payload = parseJsonFromText(result.stdout);
      if (!payload || typeof payload !== "object") {
        throw createBridgeError("bridge_unavailable", "OpenClaw gateway CLI returned invalid JSON.", {
          transport: this._transport,
          method: safeMethod,
          stdout: normalizeText(result.stdout, 200),
          stderr: normalizeText(result.stderr, 200),
        });
      }
      return payload;
    } catch (error) {
      if (error?.code && String(error.code) === "bridge_unavailable") {
        throw error;
      }
      const stderr = normalizeText(error?.stderr, 320).toLowerCase();
      const stdout = normalizeText(error?.stdout, 320).toLowerCase();
      const combined = `${stderr}\n${stdout}`;
      if (
        combined.includes("auth") ||
        combined.includes("not paired") ||
        combined.includes("device identity required")
      ) {
        throw createBridgeError("bridge_auth_required", "OpenClaw gateway CLI authentication required.", {
          transport: this._transport,
          method: safeMethod,
          stderr: normalizeText(error?.stderr, 200),
        });
      }
      throw createBridgeError(
        "bridge_unavailable",
        `OpenClaw gateway CLI call failed: ${error?.message || String(error)}`,
        {
          transport: this._transport,
          method: safeMethod,
          stderr: normalizeText(error?.stderr, 200),
        }
      );
    }
  }

  _extractLatestAssistantText(messages, minTimestamp = 0) {
    const list = Array.isArray(messages) ? messages : [];
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const message = list[index];
      if (!message || typeof message !== "object") continue;
      const role = normalizeText(message.role, 24).toLowerCase();
      if (role !== "assistant") continue;
      const timestamp = Number(message.timestamp);
      if (Number.isFinite(timestamp) && timestamp < minTimestamp) continue;
      const text = extractGatewayMessageText(message);
      if (!text) continue;
      return {
        text,
        timestamp: Number.isFinite(timestamp) ? timestamp : null,
      };
    }
    return null;
  }

  async _sendWebSocketDialogViaCli(request) {
    const requestStartedAt = Date.now();
    if (request.route === "introspection_status") {
      const statusPayload = await this._runGatewayCliCall("status", {}, { expectFinal: false });
      const statusText = this._summarizeGatewayStatusPayload(
        statusPayload,
        request.context.currentState || "Idle"
      );
      const response = {
        source: "online",
        text: statusText,
        proposedActions: [],
      };
      this._log("response", {
        correlationId: request.correlationId,
        route: request.route,
        mode: this._mode,
        transport: this._transport,
        endpoint: this._baseUrl,
        proposedActions: response.proposedActions.length,
        relay: "gateway_cli",
      });
      return {
        request,
        response,
      };
    }

    const messageText = this._buildGatewayDialogMessage(request);
    await this._runGatewayCliCall(
      "chat.send",
      {
        sessionKey: this._sessionKey,
        message: messageText,
        deliver: false,
        idempotencyKey: request.correlationId,
      },
      { expectFinal: false }
    );

    const deadline = requestStartedAt + this._requestTimeoutMs;
    while (Date.now() < deadline) {
      const historyPayload = await this._runGatewayCliCall(
        "chat.history",
        {
          sessionKey: this._sessionKey,
          limit: 8,
        },
        { expectFinal: false }
      );
      const latest = this._extractLatestAssistantText(
        historyPayload?.messages,
        requestStartedAt
      );
      if (latest?.text) {
        const response = {
          source: "online",
          text: latest.text,
          proposedActions: [],
        };
        this._log("response", {
          correlationId: request.correlationId,
          route: request.route,
          mode: this._mode,
          transport: this._transport,
          endpoint: this._baseUrl,
          proposedActions: response.proposedActions.length,
          relay: "gateway_cli",
        });
        return {
          request,
          response,
        };
      }
      await sleep(300);
    }

    throw createBridgeError(
      "bridge_timeout",
      "OpenClaw chat response not observed in history before timeout.",
      {
        transport: this._transport,
        sessionKey: this._sessionKey,
        timeoutMs: this._requestTimeoutMs,
      }
    );
  }

  async _sendWebSocketDialog(request) {
    try {
      return await this._sendWebSocketDialogDirect(request);
    } catch (error) {
      if (!this._shouldFallbackToGatewayCli(error)) {
        throw error;
      }
      this._log("fallback", {
        correlationId: request.correlationId,
        route: request.route,
        mode: this._mode,
        transport: this._transport,
        reason: "gateway_cli_relay",
        fallbackCode: error?.details?.gatewayCode || error?.code || "bridge_unavailable",
      });
      return this._sendWebSocketDialogViaCli(request);
    }
  }

  async _sendWebSocketDialogDirect(request) {
    if (!this._WebSocket) {
      throw createBridgeError("bridge_unavailable", "WebSocket API unavailable for OpenClaw bridge transport.", {
        transport: this._transport,
      });
    }

    const endpoint = this._resolveWebSocketEndpoint();
    if (!endpoint.loopback && !this._allowNonLoopback) {
      throw createBridgeError(
        "bridge_non_loopback_disabled",
        "Non-loopback OpenClaw endpoints are disabled by policy.",
        {
          host: endpoint.host,
          transport: this._transport,
        }
      );
    }
    if (!endpoint.loopback && !this._authToken) {
      throw createBridgeError(
        "bridge_auth_required",
        "Auth token required for non-loopback OpenClaw endpoint.",
        {
          host: endpoint.host,
          transport: this._transport,
        }
      );
    }

    return new Promise((resolve, reject) => {
      const socket = new this._WebSocket(endpoint.url);
      const pending = new Map();
      const requestStartedAt = Date.now();
      let finished = false;
      let requestIdSeq = 0;
      let expectedRunId = null;
      let latestStreamText = "";
      let connectStarted = false;
      let connected = false;

      const timeoutTimer = setTimeout(() => {
        fail(
          createBridgeError("bridge_timeout", "OpenClaw WebSocket request timed out.", {
            timeoutMs: this._requestTimeoutMs,
            transport: this._transport,
            endpoint: endpoint.url,
          })
        );
      }, this._requestTimeoutMs);

      const cleanup = () => {
        clearTimeout(timeoutTimer);
        for (const [, entry] of pending) {
          entry.reject(
            createBridgeError("bridge_unavailable", "OpenClaw gateway request was interrupted.", {
              transport: this._transport,
              endpoint: endpoint.url,
            })
          );
        }
        pending.clear();
        try {
          socket.close();
        } catch {}
      };

      const fail = (error) => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(error);
      };

      const succeed = (response) => {
        if (finished) return;
        finished = true;
        cleanup();
        this._log("response", {
          correlationId: request.correlationId,
          route: request.route,
          mode: this._mode,
          transport: this._transport,
          endpoint: endpoint.url,
          proposedActions: response.proposedActions.length,
        });
        resolve({
          request,
          response,
        });
      };

      const sendRequest = (method, params) =>
        new Promise((resolveRequest, rejectRequest) => {
          if (!isWebSocketOpen(socket, this._WebSocket)) {
            rejectRequest(
              createBridgeError("bridge_unavailable", "OpenClaw gateway socket is not connected.", {
                transport: this._transport,
                endpoint: endpoint.url,
              })
            );
            return;
          }

          requestIdSeq += 1;
          const id = `${request.correlationId}-${requestIdSeq.toString(36)}`;
          pending.set(id, {
            method,
            resolve: resolveRequest,
            reject: rejectRequest,
          });
          try {
            socket.send(
              JSON.stringify({
                type: "req",
                id,
                method,
                params,
              })
            );
          } catch (error) {
            pending.delete(id);
            rejectRequest(
              createBridgeError("bridge_unavailable", "OpenClaw gateway request send failed.", {
                transport: this._transport,
                endpoint: endpoint.url,
                method,
                reason: error?.message || String(error),
              })
            );
          }
        });

      const startConnectFlow = () => {
        if (connectStarted || finished) return;
        connectStarted = true;
        const connectPayload = this._buildGatewayConnectPayload(request.correlationId);
        requestWithTimeout(sendRequest("connect", connectPayload), this._requestTimeoutMs)
          .then(() => {
            if (finished) return;
            connected = true;

            if (request.route === "introspection_status") {
              return requestWithTimeout(sendRequest("status", {}), this._requestTimeoutMs).then(
                (statusPayload) => {
                  const statusText = this._summarizeGatewayStatusPayload(
                    statusPayload,
                    request.context.currentState || "Idle"
                  );
                  succeed({
                    source: "online",
                    text: statusText,
                    proposedActions: [],
                  });
                }
              );
            }

            const messageText = this._buildGatewayDialogMessage(request);
            const sendParams = {
              sessionKey: this._sessionKey,
              message: messageText,
              deliver: false,
              idempotencyKey: request.correlationId,
            };
            return requestWithTimeout(sendRequest("chat.send", sendParams), this._requestTimeoutMs).then(
              (chatSendPayload) => {
                expectedRunId =
                  normalizeText(chatSendPayload?.runId, 96) || request.correlationId;
              }
            );
          })
          .catch((error) => {
            if (finished) return;
            const code = normalizeText(
              error?.details?.gatewayCode || error?.code,
              64
            ).toUpperCase();
            if (error?.code === "bridge_auth_required" || GATEWAY_CONNECT_AUTH_CODES.has(code)) {
              fail(
                createBridgeError("bridge_auth_required", "OpenClaw gateway authentication required.", {
                  transport: this._transport,
                  endpoint: endpoint.url,
                  gatewayCode: code,
                })
              );
              return;
            }
            fail(
              error?.code
                ? error
                : createBridgeError("bridge_unavailable", "OpenClaw gateway connect failed.", {
                    transport: this._transport,
                    endpoint: endpoint.url,
                    reason: error?.message || String(error),
                  })
            );
          });
      };

      const handleGatewayResponse = (frame) => {
        const id = normalizeText(frame?.id, 128);
        if (!id) return;
        const entry = pending.get(id);
        if (!entry) return;
        pending.delete(id);
        if (frame.ok) {
          entry.resolve(frame.payload || {});
          return;
        }
        const gatewayCode = normalizeText(frame?.error?.code, 64).toUpperCase();
        if (entry.method === "connect" && GATEWAY_CONNECT_AUTH_CODES.has(gatewayCode)) {
          entry.reject(
            createBridgeError("bridge_auth_required", "OpenClaw gateway authentication required.", {
              transport: this._transport,
              endpoint: endpoint.url,
              gatewayCode,
            })
          );
          return;
        }
        entry.reject(
          createBridgeError("bridge_unavailable", `OpenClaw gateway ${entry.method} failed.`, {
            transport: this._transport,
            endpoint: endpoint.url,
            gatewayCode,
            details: frame?.error?.details || null,
          })
        );
      };

      const handleChatEvent = (payload) => {
        const eventPayload = payload && typeof payload === "object" ? payload : {};
        const sessionKey = normalizeText(eventPayload.sessionKey, 96) || "";
        if (sessionKey && sessionKey !== this._sessionKey) {
          return;
        }
        const runId = normalizeText(eventPayload.runId, 96);
        if (expectedRunId && runId && runId !== expectedRunId) {
          return;
        }
        const state = normalizeText(eventPayload.state, 24).toLowerCase();
        if (!state) return;

        if (state === "delta") {
          const deltaText = extractGatewayMessageText(eventPayload.message);
          if (deltaText) latestStreamText = deltaText;
          return;
        }

        if (state === "error") {
          fail(
            createBridgeError(
              "bridge_unavailable",
              normalizeText(eventPayload.errorMessage, DEFAULT_TEXT_LIMIT) ||
                "OpenClaw gateway chat request failed.",
              {
                transport: this._transport,
                endpoint: endpoint.url,
                state,
              }
            )
          );
          return;
        }

        if (state !== "final" && state !== "aborted") return;
        const finalText =
          extractGatewayMessageText(eventPayload.message) ||
          latestStreamText ||
          "OpenClaw response unavailable.";
        succeed({
          source: "online",
          text: finalText,
          proposedActions: [],
        });
      };

      socket.addEventListener("open", () => {
        if (finished) return;
        startConnectFlow();
      });

      socket.addEventListener("message", (event) => {
        if (finished) return;
        let frame = null;
        try {
          frame = JSON.parse(String(event?.data || ""));
        } catch {
          return;
        }
        if (!frame || typeof frame !== "object") return;
        if (frame.type === "res") {
          handleGatewayResponse(frame);
          return;
        }
        if (frame.type !== "event") return;
        if (frame.event === "connect.challenge") {
          startConnectFlow();
          return;
        }
        if (!connected) return;
        if (frame.event === "chat") {
          handleChatEvent(frame.payload);
        }
      });

      socket.addEventListener("close", (event) => {
        if (finished) return;
        fail(
          createBridgeError(
            "bridge_unavailable",
            `OpenClaw gateway socket closed (${event?.code || 0}) before completion.`,
            {
              transport: this._transport,
              endpoint: endpoint.url,
              code: event?.code,
              reason: normalizeText(event?.reason, 160) || null,
              elapsedMs: Date.now() - requestStartedAt,
            }
          )
        );
      });

      socket.addEventListener("error", () => {
        // Socket error details are surfaced on close event in a transport-safe way.
      });
    });
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
