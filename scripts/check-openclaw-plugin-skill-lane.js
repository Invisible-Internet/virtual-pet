"use strict";

const fs = require("fs");
const path = require("path");
const {
  CALL_IDS,
  CONTRACT_VERSION,
  REJECT_REASONS,
  RESULT_STATES,
  STATUS_SCOPES,
  VIRTUAL_PET_LANE_ACTION,
  createOpenClawPluginSkillLane,
} = require("../openclaw-plugin-skill-lane");
const skillHelpers = require("../openclaw-plugin/virtual-pet/skills/virtual-pet-lane");

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

async function testCommandRequestPassThrough() {
  const lane = createOpenClawPluginSkillLane({
    processCommandRequest: async (envelope, { correlationId }) => ({
      accepted: true,
      reason: "accepted",
      requestId: envelope.requestId,
      actionId: envelope.actionId,
      correlationId,
      keyId: "local-default",
      ts: 1234,
    }),
  });
  const accepted = await lane.processCall({
    contractVersion: CONTRACT_VERSION,
    call: CALL_IDS.commandRequest,
    correlationId: "corr-command-accepted",
    payload: {
      envelope: {
        type: "pet_command_request",
        requestId: "req-command-accepted",
        actionId: "dialog.injectAnnouncement",
      },
    },
  });
  assertEqual(accepted.result, RESULT_STATES.accepted, "command.request should be accepted");
  assertEqual(accepted.reason, RESULT_STATES.accepted, "accepted command reason mismatch");
  assertEqual(accepted.correlationId, "corr-command-accepted", "command correlation id mismatch");
  assertEqual(
    accepted.data?.commandOutcome?.actionId,
    "dialog.injectAnnouncement",
    "command outcome action id mismatch"
  );

  const rejectedLane = createOpenClawPluginSkillLane({
    processCommandRequest: async () => ({
      accepted: false,
      reason: "auth_invalid_signature",
    }),
  });
  const rejected = await rejectedLane.processCall({
    contractVersion: CONTRACT_VERSION,
    call: CALL_IDS.commandRequest,
    correlationId: "corr-command-rejected",
    payload: {
      envelope: {
        type: "pet_command_request",
        requestId: "req-command-rejected",
        actionId: "dialog.injectAnnouncement",
      },
    },
  });
  assertEqual(rejected.result, RESULT_STATES.rejected, "rejected command should map to rejected result");
  assertEqual(rejected.reason, "auth_invalid_signature", "command reject reason passthrough mismatch");
}

async function testStatusReadContract() {
  const lane = createOpenClawPluginSkillLane({
    readStatus: async ({ scope }) => ({
      contractVersion: CONTRACT_VERSION,
      laneState: "ready",
      scope,
      commandPolicy: {
        allowlistActionIds: ["dialog.injectAnnouncement", "shell.openStatus"],
      },
      commandAuth: {
        configured: true,
      },
    }),
  });
  const status = await lane.processCall({
    contractVersion: CONTRACT_VERSION,
    call: CALL_IDS.statusRead,
    correlationId: "corr-status",
    payload: {
      scope: STATUS_SCOPES.bridgeSummary,
    },
  });
  assertEqual(status.result, RESULT_STATES.accepted, "status.read should be accepted");
  assertEqual(status.reason, RESULT_STATES.accepted, "status.read reason mismatch");
  assertEqual(status.data?.scope, STATUS_SCOPES.bridgeSummary, "status scope mismatch");
  assert(status.data?.status?.commandPolicy, "status payload should include command policy");

  const invalidScope = await lane.processCall({
    contractVersion: CONTRACT_VERSION,
    call: CALL_IDS.statusRead,
    correlationId: "corr-invalid-scope",
    payload: {
      scope: "not_a_scope",
    },
  });
  assertEqual(invalidScope.reason, REJECT_REASONS.invalidCallShape, "invalid scope reject reason mismatch");
}

async function testVersionAndCallValidation() {
  const lane = createOpenClawPluginSkillLane();
  const unsupportedVersion = await lane.processCall({
    contractVersion: "vp-plugin-lane-v0",
    call: CALL_IDS.statusRead,
    correlationId: "corr-version",
    payload: {
      scope: STATUS_SCOPES.bridgeSummary,
    },
  });
  assertEqual(
    unsupportedVersion.reason,
    REJECT_REASONS.contractVersionUnsupported,
    "unsupported version reject reason mismatch"
  );

  const unknownCall = await lane.processCall({
    contractVersion: CONTRACT_VERSION,
    call: "virtual_pet.unknown",
    correlationId: "corr-unknown-call",
    payload: {},
  });
  assertEqual(unknownCall.reason, REJECT_REASONS.unknownCall, "unknown call reject reason mismatch");

  const missingCorrelation = await lane.processCall({
    contractVersion: CONTRACT_VERSION,
    call: CALL_IDS.statusRead,
    payload: {
      scope: STATUS_SCOPES.bridgeSummary,
    },
  });
  assertEqual(
    missingCorrelation.reason,
    REJECT_REASONS.invalidCallShape,
    "missing correlation reject reason mismatch"
  );
}

async function testMemorySyncIntentContract() {
  const lane = createOpenClawPluginSkillLane();
  const deferred = await lane.processCall({
    contractVersion: CONTRACT_VERSION,
    call: CALL_IDS.memorySyncIntent,
    correlationId: "corr-memory",
    payload: {
      intentId: "intent-1",
      intentType: "memory_reflection_request",
      summary: "Please reflect this highlight in memory.",
      context: {
        correlationId: "corr-memory",
        source: "openclaw",
      },
    },
  });
  assertEqual(deferred.result, RESULT_STATES.deferred, "memory sync should be deferred when not enabled");
  assertEqual(deferred.reason, REJECT_REASONS.memorySyncNotEnabled, "memory sync defer reason mismatch");

  const malformed = await lane.processCall({
    contractVersion: CONTRACT_VERSION,
    call: CALL_IDS.memorySyncIntent,
    correlationId: "corr-memory-malformed",
    payload: {
      intentType: "memory_reflection_request",
      summary: "missing id",
    },
  });
  assertEqual(
    malformed.reason,
    REJECT_REASONS.invalidIntentPayload,
    "malformed memory payload reject reason mismatch"
  );
}

async function testIngressWrapperShape() {
  const lane = createOpenClawPluginSkillLane({
    readStatus: async () => ({
      contractVersion: CONTRACT_VERSION,
      laneState: "ready",
    }),
  });
  const wrapped = await lane.processCall({
    type: VIRTUAL_PET_LANE_ACTION,
    route: VIRTUAL_PET_LANE_ACTION,
    payload: {
      contractVersion: CONTRACT_VERSION,
      call: CALL_IDS.statusRead,
      correlationId: "corr-wrapped",
      payload: {
        scope: STATUS_SCOPES.commandPolicy,
      },
    },
  });
  assertEqual(wrapped.result, RESULT_STATES.accepted, "wrapped lane payload should be accepted");
}

function testPluginScaffoldFiles() {
  const pluginRoot = path.join(__dirname, "..", "openclaw-plugin", "virtual-pet");
  const manifestPath = path.join(pluginRoot, "openclaw.plugin.json");
  const packagePath = path.join(pluginRoot, "package.json");
  const indexPath = path.join(pluginRoot, "index.js");
  const readmePath = path.join(__dirname, "..", "openclaw-plugin", "virtual-pet", "README.md");
  const skillPath = path.join(pluginRoot, "skills", "virtual-pet-lane", "SKILL.md");
  const skillIndexPath = path.join(pluginRoot, "skills", "virtual-pet-lane", "index.js");
  const skillPackagePath = path.join(pluginRoot, "skills", "virtual-pet-lane", "package.json");
  const inputSchemaPath = path.join(
    pluginRoot,
    "schemas",
    "virtual-pet-lane.input.schema.json"
  );
  const outputSchemaPath = path.join(
    pluginRoot,
    "schemas",
    "virtual-pet-lane.output.schema.json"
  );

  assert(fs.existsSync(manifestPath), "plugin manifest should exist");
  assert(fs.existsSync(packagePath), "plugin package.json should exist");
  assert(fs.existsSync(indexPath), "plugin entry should exist");
  assert(fs.existsSync(readmePath), "plugin README should exist");
  assert(fs.existsSync(skillPath), "plugin skill SKILL.md should exist");
  assert(fs.existsSync(skillIndexPath), "plugin skill lane helper should exist");
  assert(fs.existsSync(skillPackagePath), "plugin skill package.json should exist");
  assert(fs.existsSync(inputSchemaPath), "plugin tool input schema should exist");
  assert(fs.existsSync(outputSchemaPath), "plugin tool output schema should exist");

  const manifestRaw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const packageRaw = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const pluginIndexSource = fs.readFileSync(indexPath, "utf8");
  const skillSource = fs.readFileSync(skillPath, "utf8");
  const inputSchema = JSON.parse(fs.readFileSync(inputSchemaPath, "utf8"));
  const outputSchema = JSON.parse(fs.readFileSync(outputSchemaPath, "utf8"));

  assertEqual(manifestRaw.id, "virtual-pet-lane", "plugin manifest id mismatch");
  assert(
    Array.isArray(manifestRaw.skills) && manifestRaw.skills.includes("./skills"),
    "plugin manifest should publish ./skills"
  );
  assert(
    Array.isArray(manifestRaw.tools) && manifestRaw.tools.length > 0,
    "plugin manifest should publish tool metadata"
  );
  const laneTool = manifestRaw.tools.find((entry) => entry?.id === "virtual_pet_lane");
  assert(laneTool, "plugin manifest should include virtual_pet_lane tool");
  assertEqual(
    laneTool.inputSchema,
    "./schemas/virtual-pet-lane.input.schema.json",
    "plugin tool input schema path mismatch"
  );
  assertEqual(
    laneTool.outputSchema,
    "./schemas/virtual-pet-lane.output.schema.json",
    "plugin tool output schema path mismatch"
  );
  assert(Array.isArray(packageRaw?.openclaw?.extensions), "plugin package should define openclaw.extensions");
  assertEqual(packageRaw.openclaw.extensions[0], "./index.js", "plugin extension entry mismatch");
  assertContains(pluginIndexSource, "registerTool", "plugin entry should register tool");
  assertContains(pluginIndexSource, "virtual_pet_lane", "plugin entry should register virtual_pet_lane");
  assertContains(pluginIndexSource, "registerGatewayMethod", "plugin entry should register gateway methods");
  assertContains(pluginIndexSource, "virtualpetlane.build_call", "plugin entry should expose build_call method");
  assertContains(skillSource, "virtual_pet_lane", "skill should reference virtual_pet_lane tool");
  assertContains(
    JSON.stringify(inputSchema),
    CALL_IDS.statusRead,
    "input schema should include status.read call id"
  );
  assertContains(
    JSON.stringify(outputSchema),
    VIRTUAL_PET_LANE_ACTION,
    "output schema should encode action route"
  );

  const statusAction = skillHelpers.buildStatusReadCall({
    correlationId: "corr-skill-status",
    scope: STATUS_SCOPES.bridgeSummary,
  });
  assertEqual(statusAction.type, VIRTUAL_PET_LANE_ACTION, "skill helper type mismatch");
  assertEqual(statusAction.route, VIRTUAL_PET_LANE_ACTION, "skill helper route mismatch");
  assertEqual(statusAction.payload.contractVersion, CONTRACT_VERSION, "skill helper contract mismatch");
  assertEqual(statusAction.payload.call, CALL_IDS.statusRead, "skill helper call mismatch");
}

function testMainRuntimeWiring() {
  const mainSource = readProjectFile("main.js");
  assertContains(mainSource, "createOpenClawPluginSkillLane", "main should initialize plugin skill lane runtime");
  assertContains(mainSource, "processBridgeVirtualPetLaneCalls", "main should process plugin lane calls");
  assertContains(mainSource, "OPENCLAW_PLUGIN_SKILL_ACTION_ID", "main should route plugin lane action id");
  assertContains(mainSource, "buildOpenClawPluginSkillStatusRead", "main should expose status read helper");
}

async function run() {
  await testCommandRequestPassThrough();
  await testStatusReadContract();
  await testVersionAndCallValidation();
  await testMemorySyncIntentContract();
  await testIngressWrapperShape();
  testPluginScaffoldFiles();
  testMainRuntimeWiring();
  console.log("[openclaw-plugin-skill-lane] checks passed");
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
