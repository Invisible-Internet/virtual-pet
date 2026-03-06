"use strict";

const crypto = require("crypto");

const PAIRING_STATES = Object.freeze({
  notStarted: "not_started",
  challengeReady: "challenge_ready",
  pendingApproval: "pending_approval",
  paired: "paired",
  challengeExpired: "challenge_expired",
  failed: "failed",
});

const PAIRING_METHODS = Object.freeze({
  qr: "qr",
  code: "code",
});

const PAIRING_CHECK_STATES = Object.freeze({
  pass: "pass",
  warn: "warn",
  fail: "fail",
});

const PAIRING_CHECK_IDS = Object.freeze({
  bridgeEnabled: "bridge_enabled",
  bridgeEndpointPolicy: "bridge_endpoint_policy",
  bridgeAuth: "bridge_auth",
  commandAuth: "command_auth",
  pluginLaneStatus: "plugin_lane_status",
});

const DEFAULT_PAIRING_CHALLENGE_TTL_MS = 5 * 60 * 1000;

function toOptionalString(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function toPositiveInteger(value, fallback, min = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < min) return fallback;
  return Math.max(min, Math.round(numeric));
}

function normalizeMethod(value, fallback = PAIRING_METHODS.qr) {
  const normalized = toOptionalString(value, fallback);
  if (normalized === PAIRING_METHODS.code) return PAIRING_METHODS.code;
  return PAIRING_METHODS.qr;
}

function getNowMs(now) {
  const candidate = Number(now());
  return Number.isFinite(candidate) ? Math.round(candidate) : Date.now();
}

function randomHex(randomBytes, byteLength = 4) {
  const bytes = randomBytes(byteLength);
  if (Buffer.isBuffer(bytes)) {
    return bytes.toString("hex");
  }
  return crypto.randomBytes(byteLength).toString("hex");
}

function buildPairingCode(randomBytes) {
  const raw = randomHex(randomBytes, 4).toUpperCase();
  if (raw.length < 8) {
    return `${raw.padEnd(8, "0").slice(0, 4)}-${raw.padEnd(8, "0").slice(4, 8)}`;
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

function isChallengeExpired(challenge, nowMs) {
  if (!challenge || typeof challenge !== "object") return true;
  const expiresAtMs = Number(challenge.expiresAtMs);
  if (!Number.isFinite(expiresAtMs)) return true;
  return nowMs >= Math.round(expiresAtMs);
}

function sanitizeProbe(probe, nowMs) {
  if (!probe || typeof probe !== "object") return null;
  const checks = Array.isArray(probe.checks) ? probe.checks : [];
  return {
    kind: "openclawPairingProbe",
    ts: nowMs,
    overallState: toOptionalString(probe.overallState, "degraded") || "degraded",
    checks: checks
      .map((check) => {
        if (!check || typeof check !== "object") return null;
        return {
          id: toOptionalString(check.id, "unknown") || "unknown",
          state: toOptionalString(check.state, PAIRING_CHECK_STATES.fail) || PAIRING_CHECK_STATES.fail,
          reason: toOptionalString(check.reason, "unknown") || "unknown",
          detail: toOptionalString(check.detail, "No detail available.") || "No detail available.",
        };
      })
      .filter(Boolean),
  };
}

function getPrimaryProbeReason(probe) {
  const checks = Array.isArray(probe?.checks) ? probe.checks : [];
  const failed = checks.find((check) => check?.state === PAIRING_CHECK_STATES.fail);
  if (failed && typeof failed.reason === "string" && failed.reason.trim().length > 0) {
    return failed.reason.trim();
  }
  return typeof probe?.overallState === "string" && probe.overallState.trim().length > 0
    ? probe.overallState.trim()
    : "unknown";
}

function createPairingChallenge({ nowMs, randomBytes, challengeTtlMs }) {
  const pairingId = `pair_${nowMs.toString(36)}_${randomHex(randomBytes, 3)}`;
  const code = buildPairingCode(randomBytes);
  const expiresAtMs = nowMs + challengeTtlMs;
  const qrPayload = `openclaw://pair?pairingId=${encodeURIComponent(pairingId)}&code=${encodeURIComponent(code)}`;
  return {
    pairingId,
    code,
    qrPayload,
    expiresAtMs,
  };
}

function createOpenClawPairingGuidance({
  now = () => Date.now(),
  randomBytes = (size) => crypto.randomBytes(size),
  challengeTtlMs = DEFAULT_PAIRING_CHALLENGE_TTL_MS,
} = {}) {
  const normalizedChallengeTtlMs = toPositiveInteger(
    challengeTtlMs,
    DEFAULT_PAIRING_CHALLENGE_TTL_MS,
    1000
  );
  let pairingState = PAIRING_STATES.notStarted;
  let lastMethod = PAIRING_METHODS.qr;
  let challenge = null;
  let lastProbe = null;

  function maybeExpireChallenge(nowMs) {
    if (!challenge) return;
    if (isChallengeExpired(challenge, nowMs)) {
      challenge = null;
      if (pairingState !== PAIRING_STATES.paired) {
        pairingState = PAIRING_STATES.challengeExpired;
      }
    }
  }

  function buildSnapshot() {
    const nowMs = getNowMs(now);
    maybeExpireChallenge(nowMs);
    return {
      kind: "openclawPairingChallenge",
      ts: nowMs,
      pairingState,
      methodAvailability: {
        qr: true,
        code: true,
      },
      challenge: challenge
        ? {
            pairingId: challenge.pairingId,
            expiresAtMs: challenge.expiresAtMs,
            qrPayload: challenge.qrPayload,
            code: challenge.code,
          }
        : null,
      lastMethod,
      lastProbe: lastProbe ? { ...lastProbe } : null,
    };
  }

  function startChallenge(method = PAIRING_METHODS.qr) {
    const nowMs = getNowMs(now);
    const normalizedMethod = normalizeMethod(method, PAIRING_METHODS.qr);
    challenge = createPairingChallenge({
      nowMs,
      randomBytes,
      challengeTtlMs: normalizedChallengeTtlMs,
    });
    pairingState = PAIRING_STATES.challengeReady;
    lastMethod = normalizedMethod;
    return buildSnapshot();
  }

  function ensureChallenge(method = PAIRING_METHODS.code) {
    const nowMs = getNowMs(now);
    maybeExpireChallenge(nowMs);
    const normalizedMethod = normalizeMethod(method, lastMethod || PAIRING_METHODS.qr);
    if (!challenge) {
      challenge = createPairingChallenge({
        nowMs,
        randomBytes,
        challengeTtlMs: normalizedChallengeTtlMs,
      });
      pairingState = PAIRING_STATES.challengeReady;
    }
    lastMethod = normalizedMethod;
    return buildSnapshot();
  }

  function retryChallenge() {
    return startChallenge(lastMethod || PAIRING_METHODS.qr);
  }

  function markProbeOutcome(probe) {
    const nowMs = getNowMs(now);
    maybeExpireChallenge(nowMs);
    const sanitizedProbe = sanitizeProbe(probe, nowMs);
    lastProbe = sanitizedProbe;

    const overallState = sanitizedProbe?.overallState || "degraded";
    const primaryReason = getPrimaryProbeReason(sanitizedProbe);

    if (overallState === "ready") {
      pairingState = PAIRING_STATES.paired;
      challenge = null;
      return buildSnapshot();
    }

    if (overallState === "disabled") {
      pairingState = PAIRING_STATES.notStarted;
      challenge = null;
      return buildSnapshot();
    }

    if (primaryReason === "bridge_auth_required" || primaryReason === "pairing_required") {
      if (challenge && !isChallengeExpired(challenge, nowMs)) {
        pairingState = PAIRING_STATES.pendingApproval;
      } else if (challenge && isChallengeExpired(challenge, nowMs)) {
        challenge = null;
        pairingState = PAIRING_STATES.challengeExpired;
      } else {
        pairingState = PAIRING_STATES.failed;
      }
      return buildSnapshot();
    }

    if (challenge && isChallengeExpired(challenge, nowMs)) {
      challenge = null;
      pairingState = PAIRING_STATES.challengeExpired;
      return buildSnapshot();
    }

    pairingState = PAIRING_STATES.failed;
    return buildSnapshot();
  }

  return {
    ensureChallenge,
    getSnapshot: buildSnapshot,
    markProbeOutcome,
    retryChallenge,
    startChallenge,
  };
}

module.exports = {
  DEFAULT_PAIRING_CHALLENGE_TTL_MS,
  PAIRING_CHECK_IDS,
  PAIRING_CHECK_STATES,
  PAIRING_METHODS,
  PAIRING_STATES,
  createOpenClawPairingGuidance,
  getPrimaryProbeReason,
  isChallengeExpired,
};
