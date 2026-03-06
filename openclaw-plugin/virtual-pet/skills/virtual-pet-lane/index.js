"use strict";

const CONTRACT_VERSION = "vp-plugin-lane-v1";
const VIRTUAL_PET_LANE_ACTION = "virtual_pet_lane_call";

const CALL_IDS = Object.freeze({
  commandRequest: "virtual_pet.command.request",
  statusRead: "virtual_pet.status.read",
  memorySyncIntent: "virtual_pet.memory.sync_intent",
});

function toOptionalString(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createLaneCall({ call, correlationId, payload }) {
  const normalizedCall = toOptionalString(call, null);
  const normalizedCorrelationId = toOptionalString(correlationId, null);
  if (!normalizedCall) {
    throw new Error("call is required");
  }
  if (!normalizedCorrelationId) {
    throw new Error("correlationId is required");
  }
  if (!isPlainObject(payload)) {
    throw new Error("payload must be an object");
  }
  return {
    type: VIRTUAL_PET_LANE_ACTION,
    route: VIRTUAL_PET_LANE_ACTION,
    payload: {
      contractVersion: CONTRACT_VERSION,
      call: normalizedCall,
      correlationId: normalizedCorrelationId,
      payload,
    },
  };
}

function buildCommandRequestCall({ correlationId, envelope }) {
  if (!isPlainObject(envelope)) {
    throw new Error("envelope must be an object");
  }
  return createLaneCall({
    call: CALL_IDS.commandRequest,
    correlationId,
    payload: {
      envelope,
    },
  });
}

function buildStatusReadCall({ correlationId, scope }) {
  const normalizedScope = toOptionalString(scope, null);
  if (!normalizedScope) {
    throw new Error("scope is required");
  }
  return createLaneCall({
    call: CALL_IDS.statusRead,
    correlationId,
    payload: {
      scope: normalizedScope,
    },
  });
}

function buildMemorySyncIntentCall({ correlationId, intentId, intentType, summary, context = {} }) {
  const normalizedIntentId = toOptionalString(intentId, null);
  const normalizedIntentType = toOptionalString(intentType, null);
  const normalizedSummary = toOptionalString(summary, null);
  if (!normalizedIntentId || !normalizedIntentType || !normalizedSummary) {
    throw new Error("intentId, intentType, and summary are required");
  }
  if (!isPlainObject(context)) {
    throw new Error("context must be an object");
  }
  return createLaneCall({
    call: CALL_IDS.memorySyncIntent,
    correlationId,
    payload: {
      intentId: normalizedIntentId,
      intentType: normalizedIntentType,
      summary: normalizedSummary,
      context: {
        correlationId: toOptionalString(context.correlationId, null),
        source: toOptionalString(context.source, "openclaw") || "openclaw",
      },
    },
  });
}

module.exports = {
  CALL_IDS,
  CONTRACT_VERSION,
  VIRTUAL_PET_LANE_ACTION,
  buildCommandRequestCall,
  buildMemorySyncIntentCall,
  buildStatusReadCall,
  createLaneCall,
};
