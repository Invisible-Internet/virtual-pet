"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  MEMORY_ADAPTER_MODES,
  OPENCLAW_WORKSPACE_FILES,
  createMemoryPipeline,
} = require("../memory-pipeline");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function testLocalPipeline(rootDir) {
  const workspaceRoot = path.join(rootDir, "local-workspace");
  await fs.promises.mkdir(workspaceRoot, { recursive: true });
  const events = [];

  const pipeline = createMemoryPipeline({
    workspaceRoot,
    adapterMode: MEMORY_ADAPTER_MODES.local,
    openclawEnabled: false,
    writeLegacyJsonl: true,
    logger: (kind, payload) => {
      events.push({ kind, payload });
    },
  });
  const snapshot = await pipeline.start();
  assert(snapshot.activeAdapterMode === MEMORY_ADAPTER_MODES.local, "local mode should stay local");
  for (const fileName of OPENCLAW_WORKSPACE_FILES) {
    assert(
      fs.existsSync(path.join(workspaceRoot, fileName)) === false,
      `openclaw file should not be created when integration disabled (${fileName})`
    );
  }

  const observationResult = await pipeline.recordObservation({
    observationType: "question_response",
    source: "check-script",
    evidenceTag: "status",
    correlationId: "corr-memory-local",
    payload: {
      command: "status",
    },
  });
  assert(observationResult.ok, "local observation write should succeed");
  assert(
    typeof observationResult.targetPath === "string" &&
      fs.existsSync(observationResult.targetPath),
    "local observation path should exist"
  );

  const promotionResult = await pipeline.evaluatePromotionCandidate({
    candidateType: "adaptive_test",
    focusObservationType: "question_response",
    thresholds: {
      minimumInteractionCount: 1,
      minimumPersistenceHours: 0,
      minimumDistinctEvidencePoints: 1,
    },
  });
  assert(promotionResult.ok, "promotion check should succeed");
  assert(
    promotionResult.decision?.outcome === "accepted",
    "promotion check should be accepted with relaxed thresholds"
  );
  assert(
    typeof promotionResult.targetPath === "string" &&
      fs.existsSync(promotionResult.targetPath),
    "promotion decision target path should exist"
  );
  assert(
    promotionResult.targetPath.endsWith(".md"),
    "promotion decision target should use markdown canonical file"
  );
  assert(
    fs.existsSync(path.join(workspaceRoot, "memory", "promotion-decisions.jsonl")),
    "legacy promotion JSONL should still be written in compatibility mode"
  );

  const mutationResult = await pipeline.attemptIdentityMutation({
    section: "Immutable Core",
    evidence: ["check-script"],
    patch: {
      operation: "replace",
      key: "core_identity",
      value: "forbidden",
    },
  });
  assert(mutationResult.ok === false, "immutable core mutation should be blocked");
  assert(mutationResult.blocked === true, "immutable core mutation should return blocked=true");
  assert(
    typeof mutationResult.targetPath === "string" &&
      fs.existsSync(mutationResult.targetPath),
    "mutation audit log path should exist"
  );
  assert(
    mutationResult.targetPath.endsWith(".md"),
    "identity mutation target should use markdown canonical file"
  );
  assert(
    fs.existsSync(path.join(workspaceRoot, "memory", "identity-mutations.jsonl")),
    "legacy mutation JSONL should still be written in compatibility mode"
  );

  assert(
    events.some((entry) => entry.kind === "runtimeReady"),
    "runtimeReady event should be emitted"
  );
}

async function testObsidianFallback(rootDir) {
  const workspaceRoot = path.join(rootDir, "fallback-workspace");
  const missingVaultPath = path.join(rootDir, "missing-vault");
  await fs.promises.mkdir(workspaceRoot, { recursive: true });

  const pipeline = createMemoryPipeline({
    workspaceRoot,
    adapterMode: MEMORY_ADAPTER_MODES.obsidian,
    obsidianVaultPath: missingVaultPath,
  });
  const snapshot = await pipeline.start();
  assert(
    snapshot.activeAdapterMode === MEMORY_ADAPTER_MODES.local,
    "missing obsidian vault should fall back to local mode"
  );
  assert(
    snapshot.fallbackReason === "obsidian_vault_missing",
    "missing obsidian vault fallback reason mismatch"
  );
}

async function testOpenClawWorkspaceWarnAndBootstrap(rootDir) {
  const localWorkspaceRoot = path.join(rootDir, "local-fallback");
  const openClawWorkspaceRoot = path.join(rootDir, "openclaw-workspace");
  await fs.promises.mkdir(localWorkspaceRoot, { recursive: true });
  await fs.promises.mkdir(openClawWorkspaceRoot, { recursive: true });

  const events = [];
  const pipeline = createMemoryPipeline({
    workspaceRoot: localWorkspaceRoot,
    paths: {
      localWorkspaceRoot,
      openClawWorkspaceRoot,
    },
    adapterMode: MEMORY_ADAPTER_MODES.local,
    openclawEnabled: true,
    logger: (kind, payload) => {
      events.push({ kind, payload });
    },
  });

  const snapshot = await pipeline.start();
  assert(
    snapshot.activeWorkspaceRoot === openClawWorkspaceRoot,
    "openclaw workspace should become active root when configured and available"
  );
  assert(
    Array.isArray(snapshot.missingWorkspaceFiles) && snapshot.missingWorkspaceFiles.length === OPENCLAW_WORKSPACE_FILES.length,
    "warn-only mode should report missing OpenClaw workspace files"
  );
  for (const fileName of OPENCLAW_WORKSPACE_FILES) {
    assert(
      fs.existsSync(path.join(openClawWorkspaceRoot, fileName)) === false,
      `warn-only mode should not auto-create ${fileName}`
    );
  }

  const bootstrap = await pipeline.bootstrapOpenClawWorkspaceFiles();
  assert(bootstrap.ok, "explicit bootstrap should succeed");
  assert(
    Array.isArray(bootstrap.createdFiles) && bootstrap.createdFiles.length === OPENCLAW_WORKSPACE_FILES.length,
    "bootstrap should create all missing OpenClaw workspace files"
  );
  for (const fileName of OPENCLAW_WORKSPACE_FILES) {
    assert(
      fs.existsSync(path.join(openClawWorkspaceRoot, fileName)),
      `bootstrap should create ${fileName}`
    );
  }

  assert(
    events.some((entry) => entry.kind === "workspaceBootstrapRequired"),
    "workspaceBootstrapRequired should be logged in warn-only mode"
  );
}

async function run() {
  const tempRoot = path.join(
    os.tmpdir(),
    "virtual-pet-memory-pipeline-check",
    `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0")}`
  );
  await fs.promises.mkdir(tempRoot, { recursive: true });
  await testLocalPipeline(tempRoot);
  await testObsidianFallback(tempRoot);
  await testOpenClawWorkspaceWarnAndBootstrap(tempRoot);
  console.log("[memory-pipeline] checks passed");
}

run().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
