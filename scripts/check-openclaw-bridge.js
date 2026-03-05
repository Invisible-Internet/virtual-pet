"use strict";

const {
  BRIDGE_MODES,
  BRIDGE_TRANSPORTS,
  createOpenClawBridge,
  requestWithTimeout,
} = require("../openclaw-bridge");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} (expected "${expected}", got "${actual}")`);
  }
}

async function testOnlineResponse() {
  const bridge = createOpenClawBridge({
    mode: BRIDGE_MODES.online,
    transport: BRIDGE_TRANSPORTS.stub,
  });
  const outcome = await requestWithTimeout(
    bridge.sendDialog({
      route: "introspection_status",
      correlationId: "corr-online",
      promptText: "status",
      context: {
        currentState: "Idle",
        source: "online",
      },
    }),
    1200
  );
  assertEqual(outcome.response.source, "online", "online response source mismatch");
  assert(
    typeof outcome.response.text === "string" && outcome.response.text.length > 0,
    "online response should include text"
  );
}

async function testTimeoutFallback() {
  const bridge = createOpenClawBridge({
    mode: BRIDGE_MODES.timeout,
    transport: BRIDGE_TRANSPORTS.stub,
    simulatedTimeoutLatencyMs: 2000,
  });

  let timedOut = false;
  try {
    await requestWithTimeout(
      bridge.sendDialog({
        route: "dialog_user_command",
        correlationId: "corr-timeout",
        promptText: "bridge-test",
        context: {
          currentState: "Idle",
          source: "online",
        },
      }),
      300
    );
  } catch (error) {
    timedOut = error?.code === "bridge_timeout";
  }
  assert(timedOut, "timeout mode should raise bridge_timeout");
}

async function testOfflineFailure() {
  const bridge = createOpenClawBridge({
    mode: BRIDGE_MODES.offline,
    transport: BRIDGE_TRANSPORTS.stub,
  });

  let unavailable = false;
  try {
    await requestWithTimeout(
      bridge.sendDialog({
        route: "dialog_user_command",
        correlationId: "corr-offline",
        promptText: "bridge-test",
        context: {
          currentState: "Idle",
          source: "offline",
        },
      }),
      600
    );
  } catch (error) {
    unavailable = error?.code === "bridge_unavailable";
  }
  assert(unavailable, "offline mode should raise bridge_unavailable");
}

async function testGuardrailProposalPayload() {
  const bridge = createOpenClawBridge({
    mode: BRIDGE_MODES.online,
    transport: BRIDGE_TRANSPORTS.stub,
  });

  const outcome = await requestWithTimeout(
    bridge.sendDialog({
      route: "dialog_user_command",
      correlationId: "corr-guardrail",
      promptText: "guardrail-test",
      context: {
        currentState: "Idle",
        source: "online",
      },
    }),
    1200
  );
  const actionTypes = (outcome.response.proposedActions || []).map((action) => action.type);
  assert(actionTypes.includes("set_state"), "guardrail payload should include set_state");
  assert(actionTypes.includes("render_control"), "guardrail payload should include render_control");
  assert(actionTypes.includes("identity_mutation"), "guardrail payload should include identity_mutation");
}

function createJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "error",
    headers: {
      get: (name) => {
        if (String(name).toLowerCase() === "content-type") {
          return "application/json";
        }
        return null;
      },
    },
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

class FakeGatewayWebSocket {
  constructor(_url) {
    this.readyState = 0;
    this._listeners = new Map();
    setTimeout(() => {
      this.readyState = FakeGatewayWebSocket.OPEN;
      this._emit("open", {});
    }, 0);
  }

  addEventListener(type, handler) {
    const handlers = this._listeners.get(type) || [];
    handlers.push(handler);
    this._listeners.set(type, handlers);
  }

  send(rawFrame) {
    const frame = JSON.parse(rawFrame);
    if (frame.type !== "req") return;
    if (frame.method === "connect") {
      this._emit("message", {
        data: JSON.stringify({
          type: "res",
          id: frame.id,
          ok: true,
          payload: {
            snapshot: {
              status: "ok",
            },
          },
        }),
      });
      return;
    }

    if (frame.method === "chat.send") {
      const runId = frame.params?.idempotencyKey || "run-ws-check";
      const sessionKey = frame.params?.sessionKey || "main";
      this._emit("message", {
        data: JSON.stringify({
          type: "res",
          id: frame.id,
          ok: true,
          payload: { runId },
        }),
      });
      this._emit("message", {
        data: JSON.stringify({
          type: "event",
          event: "chat",
          payload: {
            sessionKey,
            runId,
            state: "delta",
            message: {
              role: "assistant",
              content: [{ type: "text", text: "hello from websocket bridge" }],
            },
          },
        }),
      });
      this._emit("message", {
        data: JSON.stringify({
          type: "event",
          event: "chat",
          payload: {
            sessionKey,
            runId,
            state: "final",
            message: {
              role: "assistant",
              content: [{ type: "text", text: "hello from websocket bridge" }],
            },
          },
        }),
      });
      return;
    }
  }

  close(code = 1000, reason = "") {
    this.readyState = FakeGatewayWebSocket.CLOSED;
    this._emit("close", { code, reason });
  }

  _emit(type, payload) {
    const handlers = this._listeners.get(type) || [];
    for (const handler of handlers) {
      handler(payload);
    }
  }
}

FakeGatewayWebSocket.OPEN = 1;
FakeGatewayWebSocket.CLOSED = 3;

async function testHttpLoopbackWithoutToken() {
  let calls = 0;
  const bridge = createOpenClawBridge({
    mode: BRIDGE_MODES.online,
    transport: BRIDGE_TRANSPORTS.http,
    baseUrl: "http://127.0.0.1:18789/bridge/dialog",
    retryCount: 0,
    allowNonLoopback: false,
    fetchImpl: async (_url, options) => {
      calls += 1;
      assert(options?.headers?.Authorization === undefined, "loopback request should not require auth token");
      return createJsonResponse({
        response: {
          source: "online",
          text: "ok-loopback",
          proposedActions: [],
        },
      });
    },
  });

  const outcome = await requestWithTimeout(
    bridge.sendDialog({
      route: "dialog_user_command",
      correlationId: "corr-http-loopback",
      promptText: "bridge-test",
      context: {
        currentState: "Idle",
        source: "online",
      },
    }),
    1200
  );
  assert(calls === 1, "loopback HTTP request should execute once");
  assertEqual(outcome.response.text, "ok-loopback", "loopback HTTP response text mismatch");
}

async function testHttpNonLoopbackRequiresToken() {
  const bridge = createOpenClawBridge({
    mode: BRIDGE_MODES.online,
    transport: BRIDGE_TRANSPORTS.http,
    baseUrl: "https://remote.example.com/bridge/dialog",
    allowNonLoopback: true,
    authToken: null,
    fetchImpl: async () => createJsonResponse({}),
  });

  let denied = false;
  try {
    await requestWithTimeout(
      bridge.sendDialog({
        route: "dialog_user_command",
        correlationId: "corr-http-nonloopback-no-token",
        promptText: "bridge-test",
        context: {
          currentState: "Idle",
          source: "online",
        },
      }),
      1200
    );
  } catch (error) {
    denied = error?.code === "bridge_auth_required";
  }
  assert(denied, "non-loopback HTTP should reject when token is missing");
}

async function testHttpNonLoopbackDisabledPolicy() {
  const bridge = createOpenClawBridge({
    mode: BRIDGE_MODES.online,
    transport: BRIDGE_TRANSPORTS.http,
    baseUrl: "https://remote.example.com/bridge/dialog",
    allowNonLoopback: false,
    authToken: "abc123",
    fetchImpl: async () => createJsonResponse({}),
  });

  let denied = false;
  try {
    await requestWithTimeout(
      bridge.sendDialog({
        route: "dialog_user_command",
        correlationId: "corr-http-nonloopback-disabled",
        promptText: "bridge-test",
        context: {
          currentState: "Idle",
          source: "online",
        },
      }),
      1200
    );
  } catch (error) {
    denied = error?.code === "bridge_non_loopback_disabled";
  }
  assert(denied, "non-loopback HTTP should reject when allowNonLoopback=false");
}

async function testHttpNonLoopbackWithToken() {
  let authHeader = null;
  const bridge = createOpenClawBridge({
    mode: BRIDGE_MODES.online,
    transport: BRIDGE_TRANSPORTS.http,
    baseUrl: "https://remote.example.com/bridge/dialog",
    allowNonLoopback: true,
    authToken: "secret-token",
    fetchImpl: async (_url, options) => {
      authHeader = options?.headers?.Authorization || null;
      return createJsonResponse({
        source: "online",
        text: "ok-non-loopback",
        proposedActions: [],
      });
    },
  });

  const outcome = await requestWithTimeout(
    bridge.sendDialog({
      route: "dialog_user_command",
      correlationId: "corr-http-nonloopback-token",
      promptText: "bridge-test",
      context: {
        currentState: "Idle",
        source: "online",
      },
    }),
    1200
  );
  assertEqual(authHeader, "Bearer secret-token", "non-loopback HTTP should include bearer auth");
  assertEqual(outcome.response.text, "ok-non-loopback", "non-loopback HTTP response text mismatch");
}

async function testWebSocketLoopbackDialog() {
  const bridge = createOpenClawBridge({
    mode: BRIDGE_MODES.online,
    transport: BRIDGE_TRANSPORTS.ws,
    baseUrl: "ws://127.0.0.1:18789",
    webSocketImpl: FakeGatewayWebSocket,
    requestTimeoutMs: 1200,
  });

  const outcome = await requestWithTimeout(
    bridge.sendDialog({
      route: "dialog_user_message",
      correlationId: "corr-ws-loopback",
      promptText: "hello",
      context: {
        currentState: "Idle",
        source: "online",
      },
    }),
    1200
  );
  assertEqual(
    outcome.response.text,
    "hello from websocket bridge",
    "loopback WebSocket response text mismatch"
  );
}

async function run() {
  await testOnlineResponse();
  await testTimeoutFallback();
  await testOfflineFailure();
  await testGuardrailProposalPayload();
  await testHttpLoopbackWithoutToken();
  await testHttpNonLoopbackRequiresToken();
  await testHttpNonLoopbackDisabledPolicy();
  await testHttpNonLoopbackWithToken();
  await testWebSocketLoopbackDialog();
  console.log("[openclaw-bridge] checks passed");
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error.message || String(error));
    process.exit(1);
  });
}

module.exports = {
  run,
};
