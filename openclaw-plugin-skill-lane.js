"use strict";

const CONTRACT_VERSION = "vp-plugin-lane-v1";
const VIRTUAL_PET_LANE_ACTION = "virtual_pet_lane_call";

const CALL_IDS = Object.freeze({
  commandRequest: "virtual_pet.command.request",
  statusRead: "virtual_pet.status.read",
  memorySyncIntent: "virtual_pet.memory.sync_intent",
});

const STATUS_SCOPES = Object.freeze({
  bridgeSummary: "bridge_summary",
  commandAuth: "command_auth",
  commandPolicy: "command_policy",
});

const REJECT_REASONS = Object.freeze({
  contractVersionUnsupported: "contract_version_unsupported",
  unknownCall: "unknown_call",
  invalidCallShape: "invalid_call_shape",
  invalidIntentPayload: "invalid_intent_payload",
  memorySyncNotEnabled: "memory_sync_not_enabled",
  transportUnavailable: "transport_unavailable",
});

const RESULT_STATES = Object.freeze({
  accepted: "accepted",
  rejected: "rejected",
  deferred: "deferred",
});

const MEMORY_INTENT_TYPES = new Set(["memory_reflection_request", "memory_summary_request"]);
const STATUS_SCOPE_SET = new Set(Object.values(STATUS_SCOPES));

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toOptionalString(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeLaneCallPayload(rawPayload) {
  if (!isPlainObject(rawPayload)) return null;
  const actionType = toOptionalString(rawPayload.type, "") || "";
  const route = toOptionalString(rawPayload.route, "") || "";
  const normalizedActionType = actionType.toLowerCase();
  const normalizedRoute = route.toLowerCase();
  if (
    (normalizedActionType === VIRTUAL_PET_LANE_ACTION || normalizedRoute === VIRTUAL_PET_LANE_ACTION) &&
    isPlainObject(rawPayload.payload)
  ) {
    return rawPayload.payload;
  }
  if (toOptionalString(rawPayload.call, null) && isPlainObject(rawPayload.payload)) {
    return rawPayload;
  }
  return null;
}

function sanitizeCommandOutcome(commandOutcome) {
  if (!commandOutcome || typeof commandOutcome !== "object") return null;
  return {
    accepted: Boolean(commandOutcome.accepted),
    reason: toOptionalString(commandOutcome.reason, "unknown") || "unknown",
    requestId: toOptionalString(commandOutcome.requestId, null),
    actionId: toOptionalString(commandOutcome.actionId, null),
    keyId: toOptionalString(commandOutcome.keyId, null),
    correlationId: toOptionalString(commandOutcome.correlationId, null),
    ts: Number.isFinite(Number(commandOutcome.ts)) ? Math.round(Number(commandOutcome.ts)) : null,
  };
}

function buildOutcome({
  ok,
  result,
  reason,
  contractVersion = CONTRACT_VERSION,
  call = null,
  correlationId = null,
  data = null,
  detail = null,
  ts = Date.now(),
}) {
  return {
    ok: Boolean(ok),
    result: result === RESULT_STATES.deferred ? RESULT_STATES.deferred : ok ? RESULT_STATES.accepted : RESULT_STATES.rejected,
    reason: toOptionalString(reason, "unknown") || "unknown",
    contractVersion: toOptionalString(contractVersion, CONTRACT_VERSION) || CONTRACT_VERSION,
    call: toOptionalString(call, null),
    correlationId: toOptionalString(correlationId, null),
    detail: toOptionalString(detail, null),
    data: data && typeof data === "object" ? data : null,
    ts: Number.isFinite(Number(ts)) ? Math.round(Number(ts)) : Date.now(),
  };
}

function validateMemorySyncPayload(payload) {
  if (!isPlainObject(payload)) {
    return {
      ok: false,
      detail: "payload_not_object",
    };
  }
  const intentId = toOptionalString(payload.intentId, null);
  if (!intentId) {
    return {
      ok: false,
      detail: "intent_id_missing",
    };
  }
  const intentType = toOptionalString(payload.intentType, null);
  if (!intentType || !MEMORY_INTENT_TYPES.has(intentType)) {
    return {
      ok: false,
      detail: "intent_type_invalid",
    };
  }
  const summary = toOptionalString(payload.summary, null);
  if (!summary || summary.length > 240) {
    return {
      ok: false,
      detail: "summary_invalid",
    };
  }
  const context = isPlainObject(payload.context) ? payload.context : {};
  return {
    ok: true,
    value: {
      intentId,
      intentType,
      summary,
      context: {
        correlationId: toOptionalString(context.correlationId, null),
        source: toOptionalString(context.source, "openclaw") || "openclaw",
      },
    },
  };
}

function createOpenClawPluginSkillLane({
  now = () => Date.now(),
  processCommandRequest = null,
  readStatus = null,
  submitMemorySyncIntent = null,
  onAudit = null,
} = {}) {
  function emitAudit(entry) {
    if (typeof onAudit === "function") {
      onAudit(entry);
    }
  }

  async function processCall(rawPayload, { correlationId = null } = {}) {
    const nowMs = Number.isFinite(Number(now())) ? Math.round(Number(now())) : Date.now();
    const normalizedPayload = normalizeLaneCallPayload(rawPayload) || rawPayload;
    if (!isPlainObject(normalizedPayload)) {
      const outcome = buildOutcome({
        ok: false,
        reason: REJECT_REASONS.invalidCallShape,
        detail: "payload_not_object",
        correlationId,
        ts: nowMs,
      });
      emitAudit(outcome);
      return outcome;
    }

    const contractVersion = toOptionalString(normalizedPayload.contractVersion, null);
    if (contractVersion !== CONTRACT_VERSION) {
      const outcome = buildOutcome({
        ok: false,
        reason: REJECT_REASONS.contractVersionUnsupported,
        contractVersion: contractVersion || CONTRACT_VERSION,
        detail: "unsupported_contract_version",
        correlationId,
        ts: nowMs,
      });
      emitAudit(outcome);
      return outcome;
    }

    const call = toOptionalString(normalizedPayload.call, null);
    if (!call) {
      const outcome = buildOutcome({
        ok: false,
        reason: REJECT_REASONS.invalidCallShape,
        contractVersion,
        detail: "call_missing",
        correlationId,
        ts: nowMs,
      });
      emitAudit(outcome);
      return outcome;
    }

    const callCorrelationId =
      toOptionalString(normalizedPayload.correlationId, null) || toOptionalString(correlationId, null);
    if (!callCorrelationId) {
      const outcome = buildOutcome({
        ok: false,
        reason: REJECT_REASONS.invalidCallShape,
        contractVersion,
        call,
        detail: "correlation_id_missing",
        ts: nowMs,
      });
      emitAudit(outcome);
      return outcome;
    }

    const payload = normalizedPayload.payload;
    if (!isPlainObject(payload)) {
      const outcome = buildOutcome({
        ok: false,
        reason: REJECT_REASONS.invalidCallShape,
        contractVersion,
        call,
        correlationId: callCorrelationId,
        detail: "payload_missing",
        ts: nowMs,
      });
      emitAudit(outcome);
      return outcome;
    }

    if (call === CALL_IDS.commandRequest) {
      if (!isPlainObject(payload.envelope)) {
        const outcome = buildOutcome({
          ok: false,
          reason: REJECT_REASONS.invalidCallShape,
          contractVersion,
          call,
          correlationId: callCorrelationId,
          detail: "envelope_missing",
          ts: nowMs,
        });
        emitAudit(outcome);
        return outcome;
      }
      if (typeof processCommandRequest !== "function") {
        const outcome = buildOutcome({
          ok: false,
          reason: REJECT_REASONS.transportUnavailable,
          contractVersion,
          call,
          correlationId: callCorrelationId,
          detail: "command_lane_unavailable",
          ts: nowMs,
        });
        emitAudit(outcome);
        return outcome;
      }

      const commandOutcome = await processCommandRequest(payload.envelope, {
        correlationId: callCorrelationId,
      });
      const accepted = Boolean(commandOutcome?.accepted);
      const outcome = buildOutcome({
        ok: accepted,
        reason: accepted ? RESULT_STATES.accepted : toOptionalString(commandOutcome?.reason, "unknown"),
        contractVersion,
        call,
        correlationId: callCorrelationId,
        data: {
          commandOutcome: sanitizeCommandOutcome(commandOutcome),
        },
        ts: nowMs,
      });
      emitAudit(outcome);
      return outcome;
    }

    if (call === CALL_IDS.statusRead) {
      const scope = toOptionalString(payload.scope, null);
      if (!scope || !STATUS_SCOPE_SET.has(scope)) {
        const outcome = buildOutcome({
          ok: false,
          reason: REJECT_REASONS.invalidCallShape,
          contractVersion,
          call,
          correlationId: callCorrelationId,
          detail: "scope_invalid",
          ts: nowMs,
        });
        emitAudit(outcome);
        return outcome;
      }
      if (typeof readStatus !== "function") {
        const outcome = buildOutcome({
          ok: false,
          reason: REJECT_REASONS.transportUnavailable,
          contractVersion,
          call,
          correlationId: callCorrelationId,
          detail: "status_reader_unavailable",
          ts: nowMs,
        });
        emitAudit(outcome);
        return outcome;
      }
      try {
        const status = await readStatus({
          scope,
          correlationId: callCorrelationId,
        });
        const outcome = buildOutcome({
          ok: true,
          reason: RESULT_STATES.accepted,
          contractVersion,
          call,
          correlationId: callCorrelationId,
          data: {
            scope,
            status: status && typeof status === "object" ? status : {},
          },
          ts: nowMs,
        });
        emitAudit(outcome);
        return outcome;
      } catch (error) {
        const reason = Object.values(REJECT_REASONS).includes(error?.code)
          ? error.code
          : REJECT_REASONS.transportUnavailable;
        const outcome = buildOutcome({
          ok: false,
          reason,
          contractVersion,
          call,
          correlationId: callCorrelationId,
          detail: toOptionalString(error?.message, "status_reader_failed"),
          ts: nowMs,
        });
        emitAudit(outcome);
        return outcome;
      }
    }

    if (call === CALL_IDS.memorySyncIntent) {
      const validation = validateMemorySyncPayload(payload);
      if (!validation.ok) {
        const outcome = buildOutcome({
          ok: false,
          reason: REJECT_REASONS.invalidIntentPayload,
          contractVersion,
          call,
          correlationId: callCorrelationId,
          detail: validation.detail,
          ts: nowMs,
        });
        emitAudit(outcome);
        return outcome;
      }
      if (typeof submitMemorySyncIntent !== "function") {
        const outcome = buildOutcome({
          ok: true,
          result: RESULT_STATES.deferred,
          reason: REJECT_REASONS.memorySyncNotEnabled,
          contractVersion,
          call,
          correlationId: callCorrelationId,
          data: {
            intent: validation.value,
          },
          ts: nowMs,
        });
        emitAudit(outcome);
        return outcome;
      }
      try {
        const syncOutcome = await submitMemorySyncIntent({
          ...validation.value,
          correlationId: callCorrelationId,
        });
        const syncResult =
          syncOutcome?.result === RESULT_STATES.deferred
            ? RESULT_STATES.deferred
            : syncOutcome?.result === RESULT_STATES.rejected
              ? RESULT_STATES.rejected
              : RESULT_STATES.accepted;
        const outcome = buildOutcome({
          ok: syncResult !== RESULT_STATES.rejected,
          result: syncResult,
          reason:
            toOptionalString(syncOutcome?.reason, null) ||
            (syncResult === RESULT_STATES.deferred ? REJECT_REASONS.memorySyncNotEnabled : RESULT_STATES.accepted),
          contractVersion,
          call,
          correlationId: callCorrelationId,
          data: {
            intent: validation.value,
            response: syncOutcome && typeof syncOutcome === "object" ? syncOutcome : null,
          },
          ts: nowMs,
        });
        emitAudit(outcome);
        return outcome;
      } catch (error) {
        const outcome = buildOutcome({
          ok: false,
          reason: REJECT_REASONS.transportUnavailable,
          contractVersion,
          call,
          correlationId: callCorrelationId,
          detail: toOptionalString(error?.message, "memory_sync_failed"),
          ts: nowMs,
        });
        emitAudit(outcome);
        return outcome;
      }
    }

    const outcome = buildOutcome({
      ok: false,
      reason: REJECT_REASONS.unknownCall,
      contractVersion,
      call,
      correlationId: callCorrelationId,
      detail: "call_unknown",
      ts: nowMs,
    });
    emitAudit(outcome);
    return outcome;
  }

  return {
    processCall,
  };
}

module.exports = {
  CALL_IDS,
  CONTRACT_VERSION,
  REJECT_REASONS,
  RESULT_STATES,
  STATUS_SCOPES,
  VIRTUAL_PET_LANE_ACTION,
  createOpenClawPluginSkillLane,
  normalizeLaneCallPayload,
};
