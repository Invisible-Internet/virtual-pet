"use strict";

const {
  PAIRING_CHECK_IDS,
  PAIRING_CHECK_STATES,
  PAIRING_STATES,
  createOpenClawPairingGuidance,
} = require("../openclaw-pairing-guidance");
const {
  OBSERVABILITY_DETAIL_ACTION_IDS,
  buildObservabilityDetail,
} = require("../shell-observability");

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

function createProbe({ overallState, checks }) {
  return {
    kind: "openclawPairingSnapshot",
    ts: Date.now(),
    overallState,
    checks,
  };
}

function run() {
  let nowMs = 1700000000000;
  let randomSeed = 0;
  const guidance = createOpenClawPairingGuidance({
    now: () => nowMs,
    randomBytes: (size) => {
      const next = Buffer.alloc(size);
      for (let index = 0; index < size; index += 1) {
        next[index] = (randomSeed + index * 17) & 0xff;
      }
      randomSeed += 1;
      return next;
    },
    challengeTtlMs: 5000,
  });

  const initial = guidance.getSnapshot();
  assertEqual(initial.pairingState, PAIRING_STATES.notStarted, "initial pairing state should be not_started");
  assert(initial.methodAvailability?.qr === true, "QR pairing should be available");
  assert(initial.methodAvailability?.code === true, "Code pairing should be available");

  const qrStarted = guidance.startChallenge("qr");
  assertEqual(qrStarted.pairingState, PAIRING_STATES.challengeReady, "start challenge should set challenge_ready");
  assert(typeof qrStarted.challenge?.qrPayload === "string" && qrStarted.challenge.qrPayload.length > 0, "QR payload should be present");
  assert(typeof qrStarted.challenge?.code === "string" && qrStarted.challenge.code.length > 0, "pairing code should be present");

  const codeSnapshot = guidance.ensureChallenge("code");
  assertEqual(codeSnapshot.pairingState, PAIRING_STATES.challengeReady, "ensure code should keep challenge_ready");
  assert(codeSnapshot.challenge?.pairingId === qrStarted.challenge?.pairingId, "ensure code should reuse active challenge");

  const pendingProbe = createProbe({
    overallState: "degraded",
    checks: [
      {
        id: PAIRING_CHECK_IDS.bridgeAuth,
        state: PAIRING_CHECK_STATES.fail,
        reason: "bridge_auth_required",
        detail: "Pairing approval required.",
      },
    ],
  });
  const pendingSnapshot = guidance.markProbeOutcome(pendingProbe);
  assertEqual(pendingSnapshot.pairingState, PAIRING_STATES.pendingApproval, "auth-required probe should set pending_approval");

  nowMs += 6000;
  const expired = guidance.getSnapshot();
  assertEqual(expired.pairingState, PAIRING_STATES.challengeExpired, "expired challenge should set challenge_expired");

  const retried = guidance.retryChallenge();
  assertEqual(retried.pairingState, PAIRING_STATES.challengeReady, "retry should mint a new challenge");
  assert(retried.challenge?.pairingId !== qrStarted.challenge?.pairingId, "retry should generate a new pairing id");

  const readyProbe = createProbe({
    overallState: "ready",
    checks: [
      {
        id: PAIRING_CHECK_IDS.bridgeEnabled,
        state: PAIRING_CHECK_STATES.pass,
        reason: "openclaw_enabled",
        detail: "Enabled.",
      },
      {
        id: PAIRING_CHECK_IDS.bridgeAuth,
        state: PAIRING_CHECK_STATES.pass,
        reason: "bridge_auth_ok",
        detail: "Auth ready.",
      },
      {
        id: PAIRING_CHECK_IDS.commandAuth,
        state: PAIRING_CHECK_STATES.pass,
        reason: "command_auth_ready",
        detail: "Command auth ready.",
      },
      {
        id: PAIRING_CHECK_IDS.pluginLaneStatus,
        state: PAIRING_CHECK_STATES.pass,
        reason: "plugin_lane_ready",
        detail: "Plugin lane ready.",
      },
    ],
  });
  const paired = guidance.markProbeOutcome(readyProbe);
  assertEqual(paired.pairingState, PAIRING_STATES.paired, "ready probe should set paired");
  assert(!paired.challenge, "paired state should clear active challenge");

  const degradedDetail = buildObservabilityDetail({
    snapshot: {
      rows: {
        bridge: {
          state: "degraded",
          reason: "bridge_auth_required",
          transport: "ws",
          mode: "online",
          endpoint: "wss://example.openclaw.dev",
          authConfigured: true,
          petCommandAuthConfigured: true,
          petCommandAuthSource: "env",
          petCommandKeyId: "local-default",
          petCommandSharedSecretRef: "PET_OPENCLAW_PET_COMMAND_SECRET",
          petCommandNonceCacheSize: 1,
          pairing: retried,
        },
      },
    },
    subjectId: "bridge",
    settingsSourceMap: {},
  });

  assertEqual(degradedDetail.subject.subjectId, "bridge", "bridge detail should resolve");
  assert(Array.isArray(degradedDetail.actions), "bridge detail should include actions");
  assert(
    degradedDetail.actions.some((action) => action.actionId === OBSERVABILITY_DETAIL_ACTION_IDS.runPairingProbe),
    "bridge detail should expose run_pairing_probe"
  );
  assert(
    degradedDetail.actions.some((action) => action.actionId === OBSERVABILITY_DETAIL_ACTION_IDS.openSettings),
    "bridge detail should expose open_settings"
  );
  assert(
    degradedDetail.actions.some((action) => action.actionId === OBSERVABILITY_DETAIL_ACTION_IDS.startPairingQr),
    "bridge detail should expose start_pairing_qr"
  );
  assert(
    degradedDetail.actions.some((action) => action.actionId === OBSERVABILITY_DETAIL_ACTION_IDS.copyPairingCode),
    "bridge detail should expose copy_pairing_code"
  );

  const pairedDetail = buildObservabilityDetail({
    snapshot: {
      rows: {
        bridge: {
          state: "healthy",
          reason: "requestSuccess",
          transport: "ws",
          mode: "online",
          endpoint: "wss://example.openclaw.dev",
          authConfigured: true,
          petCommandAuthConfigured: true,
          petCommandAuthSource: "env",
          petCommandKeyId: "local-default",
          petCommandSharedSecretRef: "PET_OPENCLAW_PET_COMMAND_SECRET",
          petCommandNonceCacheSize: 2,
          pairing: paired,
        },
      },
    },
    subjectId: "bridge",
    settingsSourceMap: {},
  });

  assert(
    !pairedDetail.actions.some((action) => action.actionId === OBSERVABILITY_DETAIL_ACTION_IDS.startPairingQr),
    "paired detail should hide start_pairing_qr"
  );
  assert(
    !pairedDetail.actions.some((action) => action.actionId === OBSERVABILITY_DETAIL_ACTION_IDS.copyPairingCode),
    "paired detail should hide copy_pairing_code"
  );

  console.log("[openclaw-pairing-guidance] checks passed");
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error.message || String(error));
    process.exit(1);
  }
}

module.exports = {
  run,
};
