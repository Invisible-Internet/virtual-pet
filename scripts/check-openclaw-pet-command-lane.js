"use strict";

const fs = require("fs");
const path = require("path");
const {
  DEFAULT_KEY_ID,
  REJECT_REASONS,
  createOpenClawPetCommandLane,
  signEnvelope,
} = require("../openclaw-pet-command-lane");

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

function assertContains(text, expected, message) {
  if (!text.includes(expected)) {
    throw new Error(`${message} (missing "${expected}")`);
  }
}

function readProjectFile(relativePath) {
  const absolutePath = path.join(__dirname, "..", relativePath);
  return fs.readFileSync(absolutePath, "utf8");
}

function buildSignedEnvelope({
  requestId,
  actionId,
  args,
  nonce,
  nowMs,
  issuedAtMs = nowMs - 1000,
  expiresAtMs = nowMs + 60000,
  keyId = DEFAULT_KEY_ID,
  secret = "local-secret",
}) {
  const envelope = {
    type: "pet_command_request",
    requestId,
    actionId,
    args,
    issuedAtMs,
    expiresAtMs,
    source: {
      skillId: "virtual-pet-bridge",
      agentId: "main",
      sessionId: "session-1",
    },
    auth: {
      scheme: "vp-hmac-v1",
      keyId,
      nonce,
      signature: "",
    },
  };
  envelope.auth.signature = signEnvelope({
    secret,
    envelope,
  });
  return envelope;
}

async function testAcceptedAndReplay() {
  const executed = [];
  let nowMs = 3000000;
  const lane = createOpenClawPetCommandLane({
    now: () => nowMs,
    resolveSharedSecret: () => ({
      secret: "local-secret",
      source: "env",
      ref: "PET_OPENCLAW_PET_COMMAND_SECRET",
    }),
    executeAction: async ({ actionId, args }) => {
      executed.push({ actionId, args });
      return {
        ok: true,
      };
    },
  });

  const envelope = buildSignedEnvelope({
    requestId: "req-accepted-1",
    actionId: "dialog.injectAnnouncement",
    args: { text: "Take a stretch break." },
    nonce: "nonce-accepted-1",
    nowMs,
  });
  const accepted = await lane.processEnvelope(envelope, {
    correlationId: "corr-accepted",
  });
  assert(accepted.ok && accepted.accepted, "valid envelope should be accepted");
  assertEqual(executed.length, 1, "accepted request should execute once");
  assertEqual(executed[0].actionId, "dialog.injectAnnouncement", "accepted action id mismatch");

  const replay = await lane.processEnvelope(envelope, {
    correlationId: "corr-replay",
  });
  assert(!replay.ok && !replay.accepted, "replayed envelope should be rejected");
  assertEqual(replay.reason, REJECT_REASONS.authReplayNonce, "replay reject reason mismatch");
}

async function testAuthRejections() {
  let nowMs = 4000000;
  const lane = createOpenClawPetCommandLane({
    now: () => nowMs,
    resolveSharedSecret: () => ({
      secret: "local-secret",
      source: "env",
      ref: "PET_OPENCLAW_PET_COMMAND_SECRET",
    }),
  });

  const invalidSignature = buildSignedEnvelope({
    requestId: "req-bad-signature",
    actionId: "shell.openStatus",
    args: {},
    nonce: "nonce-invalid-signature",
    nowMs,
  });
  invalidSignature.auth.signature = "not-a-valid-signature";
  const invalidSignatureResult = await lane.processEnvelope(invalidSignature, {
    correlationId: "corr-bad-signature",
  });
  assertEqual(
    invalidSignatureResult.reason,
    REJECT_REASONS.authInvalidSignature,
    "invalid signature reject reason mismatch"
  );

  const expired = buildSignedEnvelope({
    requestId: "req-expired",
    actionId: "shell.openStatus",
    args: {},
    nonce: "nonce-expired",
    nowMs,
    issuedAtMs: nowMs - 80000,
    expiresAtMs: nowMs - 40000,
  });
  const expiredResult = await lane.processEnvelope(expired, {
    correlationId: "corr-expired",
  });
  assertEqual(expiredResult.reason, REJECT_REASONS.authRequestExpired, "expired reject reason mismatch");

  const tooOldIssuedAt = nowMs - 151000;
  const tooOld = buildSignedEnvelope({
    requestId: "req-too-old",
    actionId: "shell.openStatus",
    args: {},
    nonce: "nonce-too-old",
    nowMs,
    issuedAtMs: tooOldIssuedAt,
    expiresAtMs: tooOldIssuedAt + 120000,
  });
  const tooOldResult = await lane.processEnvelope(tooOld, {
    correlationId: "corr-too-old",
  });
  assertEqual(tooOldResult.reason, REJECT_REASONS.authRequestTooOld, "too-old reject reason mismatch");

  const unsupportedScheme = buildSignedEnvelope({
    requestId: "req-unsupported-scheme",
    actionId: "shell.openStatus",
    args: {},
    nonce: "nonce-unsupported-scheme",
    nowMs,
  });
  unsupportedScheme.auth.scheme = "vp-rsa-v1";
  const unsupportedResult = await lane.processEnvelope(unsupportedScheme, {
    correlationId: "corr-unsupported-scheme",
  });
  assertEqual(
    unsupportedResult.reason,
    REJECT_REASONS.authSchemeUnsupported,
    "unsupported scheme reject reason mismatch"
  );
}

async function testActionValidationAndIngressWrapper() {
  let nowMs = 5000000;
  const lane = createOpenClawPetCommandLane({
    now: () => nowMs,
    resolveSharedSecret: () => ({
      secret: "local-secret",
      source: "env",
      ref: "PET_OPENCLAW_PET_COMMAND_SECRET",
    }),
    executeAction: async () => ({
      ok: true,
    }),
  });

  const blocked = buildSignedEnvelope({
    requestId: "req-blocked",
    actionId: "set_state",
    args: {},
    nonce: "nonce-blocked",
    nowMs,
  });
  const blockedResult = await lane.processEnvelope(blocked, {
    correlationId: "corr-blocked",
  });
  assertEqual(blockedResult.reason, REJECT_REASONS.blockedAction, "blocked action reject reason mismatch");

  const invalidArgs = buildSignedEnvelope({
    requestId: "req-invalid-args",
    actionId: "dialog.injectAnnouncement",
    args: { text: "   " },
    nonce: "nonce-invalid-args",
    nowMs,
  });
  const invalidArgsResult = await lane.processEnvelope(invalidArgs, {
    correlationId: "corr-invalid-args",
  });
  assertEqual(invalidArgsResult.reason, REJECT_REASONS.invalidArgs, "invalid args reject reason mismatch");

  const wrapped = buildSignedEnvelope({
    requestId: "req-wrapper",
    actionId: "shell.openStatus",
    args: {},
    nonce: "nonce-wrapper",
    nowMs,
  });
  const wrappedResult = await lane.processEnvelope(
    {
      route: "pet_command_request",
      payload: wrapped,
    },
    {
      correlationId: "corr-wrapper",
    }
  );
  assert(wrappedResult.ok && wrappedResult.accepted, "wrapped ingress payload should be accepted");

  const readiness = lane.getReadiness({
    keyId: DEFAULT_KEY_ID,
  });
  assert(readiness.sharedSecretConfigured, "lane readiness should report configured secret");
  assertEqual(readiness.sharedSecretSource, "env", "lane readiness source mismatch");
  assert(
    Number.isFinite(Number(readiness.nonceCacheSize)) && readiness.nonceCacheSize >= 1,
    "lane readiness should include nonce cache size"
  );
}

function testMainIntegrationWiring() {
  const mainSource = readProjectFile("main.js");
  const settingsSource = readProjectFile("settings-runtime.js");
  const observabilitySource = readProjectFile("shell-observability.js");
  assertContains(
    mainSource,
    "processBridgePetCommandRequests",
    "main should process bridge pet command request payloads"
  );
  assertContains(
    mainSource,
    'actionId === "dialog.injectAnnouncement"',
    "main should execute dialog.injectAnnouncement through command lane"
  );
  assertContains(
    mainSource,
    'actionId === "shell.openStatus"',
    "main should execute shell.openStatus through command lane"
  );
  assertContains(
    settingsSource,
    "petCommandSharedSecretRef",
    "settings runtime should expose pet command shared secret ref"
  );
  assertContains(
    observabilitySource,
    "petCommandAuthConfigured",
    "shell observability should expose command auth readiness fields"
  );
}

async function run() {
  await testAcceptedAndReplay();
  await testAuthRejections();
  await testActionValidationAndIngressWrapper();
  testMainIntegrationWiring();
  console.log("[openclaw-pet-command-lane] checks passed");
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
