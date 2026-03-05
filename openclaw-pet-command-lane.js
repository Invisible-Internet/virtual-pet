"use strict";

const crypto = require("crypto");

const COMMAND_AUTH_SCHEME = "vp-hmac-v1";
const DEFAULT_MAX_CLOCK_SKEW_MS = 30000;
const DEFAULT_MAX_REQUEST_LIFETIME_MS = 120000;
const DEFAULT_NONCE_REPLAY_WINDOW_MS = 600000;
const DEFAULT_SHARED_SECRET_REF = "PET_OPENCLAW_PET_COMMAND_SECRET";
const DEFAULT_KEY_ID = "local-default";

const REJECT_REASONS = Object.freeze({
  malformedRequest: "malformed_request",
  authSchemeUnsupported: "auth_scheme_unsupported",
  authSecretMissing: "auth_secret_missing",
  authInvalidSignature: "auth_invalid_signature",
  authReplayNonce: "auth_replay_nonce",
  authRequestTooOld: "auth_request_too_old",
  authRequestExpired: "auth_request_expired",
  blockedAction: "blocked_action",
  invalidArgs: "invalid_args",
  executionFailed: "execution_failed",
});

const BLOCKED_ACTION_IDS = new Set([
  "set_state",
  "render_control",
  "identity_mutation",
  "drag_control",
  "motion_control",
]);

const ALLOWLIST_ACTION_IDS = Object.freeze(["dialog.injectAnnouncement", "shell.openStatus"]);

function toOptionalString(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toFiniteInteger(value, fallback = null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.round(numeric);
}

function deepSort(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => deepSort(entry));
  const sorted = {};
  const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
  for (const key of keys) {
    sorted[key] = deepSort(value[key]);
  }
  return sorted;
}

function canonicalJson(value) {
  return JSON.stringify(deepSort(value));
}

function buildSigningInput(envelope) {
  const request = isPlainObject(envelope) ? envelope : {};
  const auth = isPlainObject(request.auth) ? request.auth : {};
  const source = isPlainObject(request.source) ? request.source : {};
  const args = isPlainObject(request.args) ? request.args : {};
  return [
    COMMAND_AUTH_SCHEME,
    toOptionalString(request.requestId, ""),
    toOptionalString(request.actionId, ""),
    String(toFiniteInteger(request.issuedAtMs, "")),
    String(toFiniteInteger(request.expiresAtMs, "")),
    toOptionalString(auth.nonce, ""),
    canonicalJson(source),
    canonicalJson(args),
  ].join("\n");
}

function signEnvelope({ secret, envelope }) {
  const normalizedSecret = toOptionalString(secret, null);
  if (!normalizedSecret) return null;
  const signingInput = buildSigningInput(envelope);
  return crypto.createHmac("sha256", normalizedSecret).update(signingInput, "utf8").digest("base64");
}

function signaturesMatch(expected, provided) {
  const left = Buffer.from(toOptionalString(expected, "") || "", "utf8");
  const right = Buffer.from(toOptionalString(provided, "") || "", "utf8");
  if (left.length <= 0 || right.length <= 0) return false;
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function normalizeEnvelopePayload(raw) {
  if (!isPlainObject(raw)) return null;
  const route = toOptionalString(raw.route, null);
  if ((route || "").toLowerCase() === "pet_command_request" && isPlainObject(raw.payload)) {
    return raw.payload;
  }
  if ((toOptionalString(raw.type, "") || "").toLowerCase() === "pet_command_request") {
    return raw;
  }
  return null;
}

function normalizeSecretResult(value) {
  if (!value) {
    return {
      secret: null,
      source: "none",
      ref: null,
    };
  }
  if (typeof value === "string") {
    return {
      secret: toOptionalString(value, null),
      source: "unknown",
      ref: null,
    };
  }
  const secret = toOptionalString(value.secret, null);
  return {
    secret,
    source: toOptionalString(value.source, secret ? "unknown" : "none") || "none",
    ref: toOptionalString(value.ref, null),
  };
}

function createOpenClawPetCommandLane({
  now = () => Date.now(),
  resolveSharedSecret = () => null,
  executeAction = async () => ({ ok: true }),
  onAudit = null,
  maxClockSkewMs = DEFAULT_MAX_CLOCK_SKEW_MS,
  maxRequestLifetimeMs = DEFAULT_MAX_REQUEST_LIFETIME_MS,
  nonceReplayWindowMs = DEFAULT_NONCE_REPLAY_WINDOW_MS,
} = {}) {
  const nonceCache = new Map();

  function emitAudit(entry) {
    if (typeof onAudit === "function") {
      onAudit(entry);
    }
  }

  function purgeExpiredNonces(nowMs) {
    for (const [cacheKey, issuedAt] of nonceCache.entries()) {
      if (nowMs - issuedAt >= nonceReplayWindowMs) {
        nonceCache.delete(cacheKey);
      }
    }
  }

  function buildRejectOutcome({
    envelope,
    correlationId,
    reason,
    detail = null,
    secretMeta = null,
    nowMs = Date.now(),
  }) {
    const actionId = toOptionalString(envelope?.actionId, null);
    const requestId = toOptionalString(envelope?.requestId, null);
    const keyId = toOptionalString(envelope?.auth?.keyId, null);
    const outcome = {
      ok: false,
      accepted: false,
      reason,
      requestId,
      actionId,
      correlationId: toOptionalString(correlationId, null),
      keyId,
      detail,
      ts: nowMs,
    };
    emitAudit({
      ...outcome,
      decision: "rejected",
      authSource: toOptionalString(secretMeta?.source, "none"),
      authRef: toOptionalString(secretMeta?.ref, null),
    });
    return outcome;
  }

  function validateArgs(actionId, args) {
    if (!isPlainObject(args)) {
      return {
        ok: false,
        reason: REJECT_REASONS.invalidArgs,
      };
    }
    if (actionId === "dialog.injectAnnouncement") {
      if (Object.keys(args).length !== 1 || !Object.prototype.hasOwnProperty.call(args, "text")) {
        return {
          ok: false,
          reason: REJECT_REASONS.invalidArgs,
        };
      }
      const text = toOptionalString(args.text, null);
      if (!text || text.length > 160) {
        return {
          ok: false,
          reason: REJECT_REASONS.invalidArgs,
        };
      }
      return {
        ok: true,
        args: {
          text,
        },
      };
    }
    if (actionId === "shell.openStatus") {
      if (Object.keys(args).length !== 0) {
        return {
          ok: false,
          reason: REJECT_REASONS.invalidArgs,
        };
      }
      return {
        ok: true,
        args: {},
      };
    }
    return {
      ok: false,
      reason: REJECT_REASONS.blockedAction,
    };
  }

  function validateEnvelopeShape(envelope, correlationId, nowMs) {
    if (!isPlainObject(envelope)) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.malformedRequest,
        detail: "payload_not_object",
        nowMs,
      });
    }
    if ((toOptionalString(envelope.type, "") || "").toLowerCase() !== "pet_command_request") {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.malformedRequest,
        detail: "type_mismatch",
        nowMs,
      });
    }
    if (!toOptionalString(envelope.requestId, null)) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.malformedRequest,
        detail: "request_id_missing",
        nowMs,
      });
    }
    if (!toOptionalString(envelope.actionId, null)) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.malformedRequest,
        detail: "action_id_missing",
        nowMs,
      });
    }
    if (!isPlainObject(envelope.source)) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.malformedRequest,
        detail: "source_invalid",
        nowMs,
      });
    }
    if (!isPlainObject(envelope.args)) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.malformedRequest,
        detail: "args_invalid",
        nowMs,
      });
    }
    if (!isPlainObject(envelope.auth)) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.malformedRequest,
        detail: "auth_invalid",
        nowMs,
      });
    }
    if (!toOptionalString(envelope.auth.keyId, null)) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.malformedRequest,
        detail: "key_id_missing",
        nowMs,
      });
    }
    if (!toOptionalString(envelope.auth.nonce, null)) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.malformedRequest,
        detail: "nonce_missing",
        nowMs,
      });
    }
    if (!toOptionalString(envelope.auth.signature, null)) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.malformedRequest,
        detail: "signature_missing",
        nowMs,
      });
    }
    const issuedAtMs = toFiniteInteger(envelope.issuedAtMs, null);
    const expiresAtMs = toFiniteInteger(envelope.expiresAtMs, null);
    if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs)) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.malformedRequest,
        detail: "timestamp_invalid",
        nowMs,
      });
    }
    if (expiresAtMs <= issuedAtMs || expiresAtMs - issuedAtMs > maxRequestLifetimeMs) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.malformedRequest,
        detail: "lifetime_invalid",
        nowMs,
      });
    }
    if (issuedAtMs > nowMs + maxClockSkewMs) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.malformedRequest,
        detail: "issued_at_in_future",
        nowMs,
      });
    }
    return null;
  }

  async function processEnvelope(payload, { correlationId = null } = {}) {
    const nowMs = toFiniteInteger(now(), Date.now());
    purgeExpiredNonces(nowMs);

    const envelope = normalizeEnvelopePayload(payload) || payload;
    const shapeFailure = validateEnvelopeShape(envelope, correlationId, nowMs);
    if (shapeFailure) return shapeFailure;

    const auth = envelope.auth;
    if ((toOptionalString(auth.scheme, "") || "").toLowerCase() !== COMMAND_AUTH_SCHEME) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.authSchemeUnsupported,
        nowMs,
      });
    }

    const issuedAtMs = toFiniteInteger(envelope.issuedAtMs, nowMs);
    const expiresAtMs = toFiniteInteger(envelope.expiresAtMs, nowMs);
    if (nowMs - issuedAtMs > maxRequestLifetimeMs + maxClockSkewMs) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.authRequestTooOld,
        nowMs,
      });
    }
    if (nowMs > expiresAtMs + maxClockSkewMs) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.authRequestExpired,
        nowMs,
      });
    }

    const keyId = toOptionalString(auth.keyId, DEFAULT_KEY_ID) || DEFAULT_KEY_ID;
    const secretMeta = normalizeSecretResult(resolveSharedSecret({ keyId }));
    if (!secretMeta.secret) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.authSecretMissing,
        secretMeta,
        nowMs,
      });
    }

    const expectedSignature = signEnvelope({
      secret: secretMeta.secret,
      envelope: {
        ...envelope,
        auth: {
          ...auth,
          keyId,
        },
      },
    });
    if (!signaturesMatch(expectedSignature, auth.signature)) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.authInvalidSignature,
        secretMeta,
        nowMs,
      });
    }

    const nonce = toOptionalString(auth.nonce, null);
    const nonceKey = `${keyId}\n${nonce}`;
    if (nonceCache.has(nonceKey)) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.authReplayNonce,
        secretMeta,
        nowMs,
      });
    }

    const actionId = toOptionalString(envelope.actionId, null);
    if (!actionId || BLOCKED_ACTION_IDS.has(actionId) || !ALLOWLIST_ACTION_IDS.includes(actionId)) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.blockedAction,
        secretMeta,
        nowMs,
      });
    }

    const argsValidation = validateArgs(actionId, envelope.args);
    if (!argsValidation.ok) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: argsValidation.reason || REJECT_REASONS.invalidArgs,
        secretMeta,
        nowMs,
      });
    }

    nonceCache.set(nonceKey, nowMs);

    try {
      const execution = await executeAction({
        actionId,
        args: argsValidation.args,
        envelope,
        correlationId: toOptionalString(correlationId, null),
        keyId,
      });
      const outcome = {
        ok: true,
        accepted: true,
        reason: "accepted",
        requestId: toOptionalString(envelope.requestId, null),
        actionId,
        correlationId: toOptionalString(correlationId, null),
        keyId,
        result: execution || null,
        ts: nowMs,
      };
      emitAudit({
        ...outcome,
        decision: "accepted",
        authSource: toOptionalString(secretMeta.source, "unknown"),
        authRef: toOptionalString(secretMeta.ref, null),
      });
      return outcome;
    } catch (error) {
      return buildRejectOutcome({
        envelope,
        correlationId,
        reason: REJECT_REASONS.executionFailed,
        detail: error?.message || String(error),
        secretMeta,
        nowMs,
      });
    }
  }

  function getReadiness({ keyId = DEFAULT_KEY_ID } = {}) {
    const secretMeta = normalizeSecretResult(resolveSharedSecret({ keyId }));
    const resolvedKeyId = toOptionalString(keyId, DEFAULT_KEY_ID) || DEFAULT_KEY_ID;
    return {
      scheme: COMMAND_AUTH_SCHEME,
      keyId: resolvedKeyId,
      sharedSecretConfigured: Boolean(secretMeta.secret),
      sharedSecretSource: toOptionalString(secretMeta.source, "none") || "none",
      sharedSecretRef: toOptionalString(secretMeta.ref, DEFAULT_SHARED_SECRET_REF) || DEFAULT_SHARED_SECRET_REF,
      nonceCacheSize: nonceCache.size,
      policy: {
        maxClockSkewMs,
        maxRequestLifetimeMs,
        nonceReplayWindowMs,
      },
    };
  }

  return {
    processEnvelope,
    getReadiness,
  };
}

module.exports = {
  ALLOWLIST_ACTION_IDS,
  COMMAND_AUTH_SCHEME,
  DEFAULT_KEY_ID,
  DEFAULT_MAX_CLOCK_SKEW_MS,
  DEFAULT_MAX_REQUEST_LIFETIME_MS,
  DEFAULT_NONCE_REPLAY_WINDOW_MS,
  DEFAULT_SHARED_SECRET_REF,
  REJECT_REASONS,
  buildSigningInput,
  canonicalJson,
  createOpenClawPetCommandLane,
  signEnvelope,
};
