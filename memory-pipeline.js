"use strict";

const fs = require("fs");
const path = require("path");

const MEMORY_ADAPTER_MODES = Object.freeze({
  local: "local",
  obsidian: "obsidian",
});

const MUTATION_TRANSPARENCY_POLICIES = Object.freeze({
  silent: "silent",
  logged: "logged",
  brief_notification: "brief_notification",
});

const OPENCLAW_WORKSPACE_BOOTSTRAP_MODES = Object.freeze({
  warn_only: "warn_only",
  create: "create",
});

const DEFAULT_OBSIDIAN_VAULT_PATH = "W:\\AI\\PrimeaVault";
const DEFAULT_PROMOTION_THRESHOLDS = Object.freeze({
  minimumInteractionCount: 3,
  minimumPersistenceHours: 6,
  minimumDistinctEvidencePoints: 2,
});
const MAX_OBSERVATION_HISTORY = 400;

const OPENCLAW_WORKSPACE_FILES = Object.freeze([
  "SOUL.md",
  "IDENTITY.md",
  "USER.md",
  "MEMORY.md",
]);
const OPENCLAW_WORKSPACE_FILE_TEMPLATES = Object.freeze({
  "SOUL.md": "# SOUL\n\n",
  "IDENTITY.md": "# IDENTITY\n\n## Immutable Core\n\n",
  "USER.md": "# USER\n\n",
  "MEMORY.md": "# MEMORY\n\n",
});

const PROTECTED_IDENTITY_SECTIONS = Object.freeze(
  new Set(["immutable_core", "immutable core", "core", "core_identity"])
);

function normalizeAdapterMode(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === MEMORY_ADAPTER_MODES.obsidian) {
    return MEMORY_ADAPTER_MODES.obsidian;
  }
  return MEMORY_ADAPTER_MODES.local;
}

function normalizeTransparencyPolicy(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === MUTATION_TRANSPARENCY_POLICIES.silent) {
    return MUTATION_TRANSPARENCY_POLICIES.silent;
  }
  if (normalized === MUTATION_TRANSPARENCY_POLICIES.brief_notification) {
    return MUTATION_TRANSPARENCY_POLICIES.brief_notification;
  }
  return MUTATION_TRANSPARENCY_POLICIES.logged;
}

function normalizeBootstrapMode(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === OPENCLAW_WORKSPACE_BOOTSTRAP_MODES.create) {
    return OPENCLAW_WORKSPACE_BOOTSTRAP_MODES.create;
  }
  return OPENCLAW_WORKSPACE_BOOTSTRAP_MODES.warn_only;
}

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function asSafeString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function toIsoTimestamp(tsMs) {
  const value = Number.isFinite(tsMs) ? tsMs : Date.now();
  return new Date(value).toISOString();
}

function toDateKey(tsMs) {
  const value = Number.isFinite(tsMs) ? tsMs : Date.now();
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortRandomId() {
  return Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0");
}

function toOneLineJson(value, fallback = "{}") {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function ensureFileWithInitialContent(filePath, initialContent = "") {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
  } catch {
    await ensureDir(path.dirname(filePath));
    await fs.promises.writeFile(filePath, initialContent, "utf8");
  }
}

async function appendLine(filePath, line) {
  await ensureDir(path.dirname(filePath));
  await fs.promises.appendFile(filePath, `${line}\n`, "utf8");
}

async function appendBlock(filePath, blockText) {
  await ensureDir(path.dirname(filePath));
  await fs.promises.appendFile(filePath, blockText, "utf8");
}

function normalizeObservation(input = {}) {
  const payload = asObject(input.payload);
  const tsMs = Number.isFinite(input.tsMs) ? Math.max(0, Math.round(input.tsMs)) : Date.now();
  return {
    observationId: `obs-${tsMs.toString(36)}-${shortRandomId()}`,
    ts: toIsoTimestamp(tsMs),
    tsMs,
    observationType: asSafeString(input.observationType, "unknown"),
    source: asSafeString(input.source, "local"),
    correlationId: asSafeString(input.correlationId, "n/a"),
    evidenceTag: asSafeString(input.evidenceTag, "none"),
    payload,
  };
}

function normalizeIdentitySection(sectionName) {
  const raw = asSafeString(sectionName, "");
  if (!raw) return "";
  return raw.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function isProtectedIdentitySection(sectionName) {
  const normalized = normalizeIdentitySection(sectionName);
  return PROTECTED_IDENTITY_SECTIONS.has(normalized);
}

async function detectMissingWorkspaceFiles(workspaceRoot) {
  const missing = [];
  for (const filename of OPENCLAW_WORKSPACE_FILES) {
    const targetPath = path.join(workspaceRoot, filename);
    if (!fs.existsSync(targetPath)) {
      missing.push(targetPath);
    }
  }
  return missing;
}

async function ensureOpenClawWorkspaceFiles(workspaceRoot) {
  const created = [];
  const existing = [];
  for (const filename of OPENCLAW_WORKSPACE_FILES) {
    const targetPath = path.join(workspaceRoot, filename);
    if (fs.existsSync(targetPath)) {
      existing.push(targetPath);
      continue;
    }
    const initialContent =
      OPENCLAW_WORKSPACE_FILE_TEMPLATES[filename] || `# ${filename.replace(/\.md$/i, "")}\n\n`;
    await ensureFileWithInitialContent(targetPath, initialContent);
    created.push(targetPath);
  }
  return {
    created,
    existing,
  };
}

async function migrateLegacyJsonlToMarkdown({
  legacyFilePath,
  markdownFilePath,
  entryTitlePrefix,
  logger,
}) {
  if (!legacyFilePath || !markdownFilePath) {
    return {
      migratedCount: 0,
      skipped: true,
      reason: "invalid_paths",
      parseErrorCount: 0,
    };
  }
  if (!fs.existsSync(legacyFilePath)) {
    return {
      migratedCount: 0,
      skipped: true,
      reason: "legacy_file_missing",
      parseErrorCount: 0,
    };
  }

  const currentMarkdown = fs.existsSync(markdownFilePath)
    ? await fs.promises.readFile(markdownFilePath, "utf8")
    : "";
  if (currentMarkdown.includes("```json")) {
    return {
      migratedCount: 0,
      skipped: true,
      reason: "markdown_has_entries",
      parseErrorCount: 0,
    };
  }

  const legacyRaw = await fs.promises.readFile(legacyFilePath, "utf8");
  const lines = legacyRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length <= 0) {
    return {
      migratedCount: 0,
      skipped: true,
      reason: "legacy_file_empty",
      parseErrorCount: 0,
    };
  }

  let migratedCount = 0;
  let parseErrorCount = 0;
  for (const [index, line] of lines.entries()) {
    try {
      const payload = JSON.parse(line);
      const ts = asSafeString(payload?.ts, toIsoTimestamp(Date.now()));
      const outcome = asSafeString(payload?.outcome, "unknown");
      const title = `${ts} | migrated_legacy_${entryTitlePrefix} | outcome=${outcome} | index=${index + 1}`;
      await appendMarkdownJsonEntry(markdownFilePath, title, payload);
      migratedCount += 1;
    } catch {
      parseErrorCount += 1;
    }
  }

  if (typeof logger === "function") {
    logger("legacyJsonlMigrated", {
      legacyFilePath,
      markdownFilePath,
      migratedCount,
      parseErrorCount,
    });
  }

  return {
    migratedCount,
    skipped: false,
    reason: "migrated",
    parseErrorCount,
  };
}

async function appendMarkdownJsonEntry(filePath, title, payload, headingPrefix = "##") {
  await ensureFileWithInitialContent(filePath, "");
  const lines = [
    `${headingPrefix} ${title}`,
    "```json",
    JSON.stringify(payload),
    "```",
    "",
  ];
  await appendBlock(filePath, `${lines.join("\n")}\n`);
}

function createLocalAdapter({
  workspaceRoot,
  writeLegacyJsonl,
  workspaceFilePolicy = "skip",
  logger,
}) {
  const memoryRoot = path.join(workspaceRoot, "memory");
  const localPaths = {
    workspaceRoot,
    soulFile: path.join(workspaceRoot, "SOUL.md"),
    identityFile: path.join(workspaceRoot, "IDENTITY.md"),
    userFile: path.join(workspaceRoot, "USER.md"),
    memoryFile: path.join(workspaceRoot, "MEMORY.md"),
    memoryDir: memoryRoot,
    promotionDecisionsFile: path.join(memoryRoot, "promotion-decisions.md"),
    identityMutationsFile: path.join(memoryRoot, "identity-mutations.md"),
    legacyPromotionDecisionsLog: path.join(memoryRoot, "promotion-decisions.jsonl"),
    legacyIdentityMutationsLog: path.join(memoryRoot, "identity-mutations.jsonl"),
  };

  return {
    mode: MEMORY_ADAPTER_MODES.local,
    rootPath: workspaceRoot,
    paths: localPaths,
    async ensureLayout() {
      await ensureDir(localPaths.memoryDir);
      await ensureFileWithInitialContent(localPaths.promotionDecisionsFile, "# Promotion Decisions\n\n");
      await ensureFileWithInitialContent(localPaths.identityMutationsFile, "# Identity Mutations\n\n");

      await migrateLegacyJsonlToMarkdown({
        legacyFilePath: localPaths.legacyPromotionDecisionsLog,
        markdownFilePath: localPaths.promotionDecisionsFile,
        entryTitlePrefix: "promotion_decision",
        logger,
      });
      await migrateLegacyJsonlToMarkdown({
        legacyFilePath: localPaths.legacyIdentityMutationsLog,
        markdownFilePath: localPaths.identityMutationsFile,
        entryTitlePrefix: "identity_mutation",
        logger,
      });

      if (workspaceFilePolicy === "create") {
        await ensureOpenClawWorkspaceFiles(workspaceRoot);
        return { missingWorkspaceFiles: [] };
      }

      if (workspaceFilePolicy === "warn") {
        const missingWorkspaceFiles = await detectMissingWorkspaceFiles(workspaceRoot);
        if (missingWorkspaceFiles.length > 0) {
          logger("workspaceFilesMissing", {
            workspaceRoot,
            count: missingWorkspaceFiles.length,
            missingWorkspaceFiles,
          });
        }
        return { missingWorkspaceFiles };
      }

      return { missingWorkspaceFiles: [] };
    },
    getObservationLogPath(tsMs) {
      return path.join(localPaths.memoryDir, `${toDateKey(tsMs)}.md`);
    },
    getPromotionDecisionsPath() {
      return localPaths.promotionDecisionsFile;
    },
    getIdentityMutationsPath() {
      return localPaths.identityMutationsFile;
    },
    async appendObservation(observation) {
      const targetFile = this.getObservationLogPath(observation.tsMs);
      await ensureFileWithInitialContent(targetFile, `# Memory Log ${toDateKey(observation.tsMs)}\n\n`);
      const line =
        `- ${observation.ts} | type=${observation.observationType}` +
        ` | source=${observation.source}` +
        ` | evidence=${observation.evidenceTag}` +
        ` | correlationId=${observation.correlationId}` +
        ` | payload=${toOneLineJson(observation.payload)}`;
      await appendLine(targetFile, line);
      return targetFile;
    },
    async appendPromotionDecision(decision) {
      const title = `${decision.ts} | outcome=${decision.outcome} | candidate=${decision.candidateType}`;
      await appendMarkdownJsonEntry(localPaths.promotionDecisionsFile, title, decision);
      if (writeLegacyJsonl) {
        await appendLine(localPaths.legacyPromotionDecisionsLog, toOneLineJson(decision));
      }
      return localPaths.promotionDecisionsFile;
    },
    async appendIdentityMutationAudit(entry) {
      const title = `${entry.ts} | outcome=${entry.outcome} | section=${entry.section}`;
      await appendMarkdownJsonEntry(localPaths.identityMutationsFile, title, entry);
      if (writeLegacyJsonl) {
        await appendLine(localPaths.legacyIdentityMutationsLog, toOneLineJson(entry));
      }
      return localPaths.identityMutationsFile;
    },
  };
}

function createObsidianAdapter(vaultRoot) {
  const obsidianPaths = {
    logsDir: path.join(vaultRoot, "01_Logs"),
    userDir: path.join(vaultRoot, "02_User"),
    primeaDir: path.join(vaultRoot, "03_Primea"),
    analysisDir: path.join(vaultRoot, "04_Analysis"),
    systemDir: path.join(vaultRoot, "99_System"),
    userMusicFile: path.join(vaultRoot, "02_User", "music.md"),
    primeaIdentityFile: path.join(vaultRoot, "03_Primea", "music_identity.md"),
    mutationAuditFile: path.join(vaultRoot, "04_Analysis", "identity-mutations.md"),
    promotionDecisionsFile: path.join(vaultRoot, "04_Analysis", "promotion-decisions.md"),
  };

  return {
    mode: MEMORY_ADAPTER_MODES.obsidian,
    rootPath: vaultRoot,
    paths: obsidianPaths,
    async ensureLayout() {
      await ensureDir(obsidianPaths.logsDir);
      await ensureDir(obsidianPaths.userDir);
      await ensureDir(obsidianPaths.primeaDir);
      await ensureDir(obsidianPaths.analysisDir);
      await ensureDir(obsidianPaths.systemDir);
      await ensureFileWithInitialContent(obsidianPaths.userMusicFile, "# User Music\n\n");
      await ensureFileWithInitialContent(obsidianPaths.primeaIdentityFile, "# Primea Music Identity\n\n");
      await ensureFileWithInitialContent(
        obsidianPaths.mutationAuditFile,
        "# Identity Mutations\n\n"
      );
      await ensureFileWithInitialContent(
        obsidianPaths.promotionDecisionsFile,
        "# Promotion Decisions\n\n"
      );
      return { missingWorkspaceFiles: [] };
    },
    getObservationLogPath(tsMs) {
      return path.join(obsidianPaths.logsDir, `${toDateKey(tsMs)}.md`);
    },
    getPromotionDecisionsPath() {
      return obsidianPaths.promotionDecisionsFile;
    },
    getIdentityMutationsPath() {
      return obsidianPaths.mutationAuditFile;
    },
    async appendObservation(observation) {
      const targetFile = this.getObservationLogPath(observation.tsMs);
      await ensureFileWithInitialContent(targetFile, `# Tier-1 Observations ${toDateKey(observation.tsMs)}\n\n`);
      const line =
        `- ${observation.ts} | type=${observation.observationType}` +
        ` | source=${observation.source}` +
        ` | evidence=${observation.evidenceTag}` +
        ` | correlationId=${observation.correlationId}` +
        ` | payload=${toOneLineJson(observation.payload)}`;
      await appendLine(targetFile, line);
      return targetFile;
    },
    async appendPromotionDecision(decision) {
      const title = `${decision.ts} | outcome=${decision.outcome} | candidate=${decision.candidateType}`;
      await appendMarkdownJsonEntry(obsidianPaths.promotionDecisionsFile, title, decision);
      return obsidianPaths.promotionDecisionsFile;
    },
    async appendIdentityMutationAudit(entry) {
      const title = `${entry.ts} | outcome=${entry.outcome} | section=${entry.section}`;
      await appendMarkdownJsonEntry(obsidianPaths.mutationAuditFile, title, entry);
      return obsidianPaths.mutationAuditFile;
    },
  };
}

class MemoryPipelineRuntime {
  constructor({
    workspaceRoot,
    paths,
    openclawEnabled = false,
    openclawWorkspaceBootstrapMode = OPENCLAW_WORKSPACE_BOOTSTRAP_MODES.warn_only,
    adapterMode = MEMORY_ADAPTER_MODES.local,
    obsidianVaultPath = DEFAULT_OBSIDIAN_VAULT_PATH,
    mutationTransparencyPolicy = MUTATION_TRANSPARENCY_POLICIES.logged,
    writeLegacyJsonl = true,
    logger,
  } = {}) {
    const normalizedPaths = asObject(paths);
    this._localWorkspaceRoot = asSafeString(normalizedPaths.localWorkspaceRoot, workspaceRoot || process.cwd());
    this._openClawWorkspaceRoot = asSafeString(normalizedPaths.openClawWorkspaceRoot, "");
    this._obsidianVaultPath = asSafeString(
      normalizedPaths.obsidianVaultRoot,
      asSafeString(obsidianVaultPath, DEFAULT_OBSIDIAN_VAULT_PATH)
    );

    this._openclawEnabled = Boolean(openclawEnabled);
    this._openclawWorkspaceBootstrapMode = normalizeBootstrapMode(openclawWorkspaceBootstrapMode);
    this._requestedAdapterMode = normalizeAdapterMode(adapterMode);
    this._mutationTransparencyPolicy = normalizeTransparencyPolicy(
      mutationTransparencyPolicy
    );
    this._writeLegacyJsonl = Boolean(writeLegacyJsonl);
    this._logger = typeof logger === "function" ? logger : () => {};

    this._adapter = null;
    this._activeAdapterMode = MEMORY_ADAPTER_MODES.local;
    this._fallbackReason = "none";
    this._writeQueue = Promise.resolve();
    this._observationHistory = [];
    this._activeWorkspaceRoot = this._localWorkspaceRoot;
    this._missingWorkspaceFiles = [];
  }

  async _resolveLocalWorkspaceTarget() {
    if (!this._openclawEnabled || !this._openClawWorkspaceRoot) {
      return {
        workspaceRoot: this._localWorkspaceRoot,
        fallbackReason: "none",
        workspaceFilePolicy: "skip",
      };
    }

    try {
      const stats = await fs.promises.stat(this._openClawWorkspaceRoot);
      if (!stats.isDirectory()) {
        return {
          workspaceRoot: this._localWorkspaceRoot,
          fallbackReason: "openclaw_workspace_not_directory",
          workspaceFilePolicy: "skip",
        };
      }
      return {
        workspaceRoot: this._openClawWorkspaceRoot,
        fallbackReason: "none",
        workspaceFilePolicy:
          this._openclawWorkspaceBootstrapMode === OPENCLAW_WORKSPACE_BOOTSTRAP_MODES.create
            ? "create"
            : "warn",
      };
    } catch {
      return {
        workspaceRoot: this._localWorkspaceRoot,
        fallbackReason: "openclaw_workspace_missing",
        workspaceFilePolicy: "skip",
      };
    }
  }

  async start() {
    const localTarget = await this._resolveLocalWorkspaceTarget();
    const localAdapter = createLocalAdapter({
      workspaceRoot: localTarget.workspaceRoot,
      writeLegacyJsonl: this._writeLegacyJsonl,
      workspaceFilePolicy: localTarget.workspaceFilePolicy,
      logger: this._logger,
    });

    let adapter = localAdapter;
    let activeAdapterMode = MEMORY_ADAPTER_MODES.local;
    let fallbackReason = localTarget.fallbackReason || "none";

    if (this._requestedAdapterMode === MEMORY_ADAPTER_MODES.obsidian) {
      try {
        const stats = await fs.promises.stat(this._obsidianVaultPath);
        if (stats.isDirectory()) {
          adapter = createObsidianAdapter(this._obsidianVaultPath);
          activeAdapterMode = MEMORY_ADAPTER_MODES.obsidian;
        } else {
          fallbackReason = "obsidian_vault_not_directory";
        }
      } catch {
        fallbackReason = "obsidian_vault_missing";
      }
    }

    try {
      const layoutResult = await adapter.ensureLayout();
      this._missingWorkspaceFiles = Array.isArray(layoutResult?.missingWorkspaceFiles)
        ? layoutResult.missingWorkspaceFiles
        : [];
    } catch (error) {
      if (activeAdapterMode === MEMORY_ADAPTER_MODES.obsidian) {
        this._logger("adapterFallback", {
          requestedAdapterMode: this._requestedAdapterMode,
          activeAdapterMode: MEMORY_ADAPTER_MODES.local,
          fallbackReason: "obsidian_layout_failed",
          error: error?.message || String(error),
        });
        adapter = localAdapter;
        activeAdapterMode = MEMORY_ADAPTER_MODES.local;
        fallbackReason = "obsidian_layout_failed";
        const fallbackLayoutResult = await adapter.ensureLayout();
        this._missingWorkspaceFiles = Array.isArray(fallbackLayoutResult?.missingWorkspaceFiles)
          ? fallbackLayoutResult.missingWorkspaceFiles
          : [];
      } else {
        throw error;
      }
    }

    this._adapter = adapter;
    this._activeAdapterMode = activeAdapterMode;
    this._activeWorkspaceRoot = adapter.rootPath || localTarget.workspaceRoot;
    this._fallbackReason =
      activeAdapterMode === this._requestedAdapterMode ? fallbackReason || "none" : fallbackReason;

    if (this._openclawEnabled && this._openClawWorkspaceRoot && this._missingWorkspaceFiles.length > 0) {
      this._logger("workspaceBootstrapRequired", {
        workspaceRoot: this._activeWorkspaceRoot,
        missingWorkspaceFiles: this._missingWorkspaceFiles,
        bootstrapMode: this._openclawWorkspaceBootstrapMode,
      });
    }

    this._logger("runtimeReady", this.getSnapshot());
    return this.getSnapshot();
  }

  getSnapshot() {
    return {
      requestedAdapterMode: this._requestedAdapterMode,
      activeAdapterMode: this._activeAdapterMode,
      fallbackReason: this._fallbackReason,
      localWorkspaceRoot: this._localWorkspaceRoot,
      openClawWorkspaceRoot: this._openClawWorkspaceRoot || null,
      activeWorkspaceRoot: this._activeWorkspaceRoot,
      obsidianVaultPath: this._obsidianVaultPath,
      openclawEnabled: this._openclawEnabled,
      openclawWorkspaceBootstrapMode: this._openclawWorkspaceBootstrapMode,
      mutationTransparencyPolicy: this._mutationTransparencyPolicy,
      writeLegacyJsonl: this._writeLegacyJsonl,
      missingWorkspaceFiles: this._missingWorkspaceFiles,
      paths: this._adapter?.paths || null,
    };
  }

  async bootstrapOpenClawWorkspaceFiles() {
    if (!this._openclawEnabled) {
      return {
        ok: false,
        error: "openclaw_disabled",
      };
    }
    if (!this._openClawWorkspaceRoot) {
      return {
        ok: false,
        error: "openclaw_workspace_not_configured",
      };
    }

    let stats = null;
    try {
      stats = await fs.promises.stat(this._openClawWorkspaceRoot);
    } catch {
      return {
        ok: false,
        error: "openclaw_workspace_missing",
        targetRoot: this._openClawWorkspaceRoot,
      };
    }
    if (!stats.isDirectory()) {
      return {
        ok: false,
        error: "openclaw_workspace_not_directory",
        targetRoot: this._openClawWorkspaceRoot,
      };
    }

    const outcome = await ensureOpenClawWorkspaceFiles(this._openClawWorkspaceRoot);
    this._missingWorkspaceFiles = await detectMissingWorkspaceFiles(this._openClawWorkspaceRoot);
    this._logger("workspaceBootstrapCompleted", {
      targetRoot: this._openClawWorkspaceRoot,
      createdFiles: outcome.created,
      existingFiles: outcome.existing,
      missingWorkspaceFiles: this._missingWorkspaceFiles,
    });
    return {
      ok: true,
      targetRoot: this._openClawWorkspaceRoot,
      createdFiles: outcome.created,
      existingFiles: outcome.existing,
      missingWorkspaceFiles: this._missingWorkspaceFiles,
    };
  }

  _enqueueWrite(task) {
    const run = async () => task();
    const queued = this._writeQueue.then(run, run);
    this._writeQueue = queued.catch(() => {});
    return queued;
  }

  async recordObservation(input) {
    if (!this._adapter) {
      return {
        ok: false,
        error: "memory_pipeline_not_started",
      };
    }
    const observation = normalizeObservation(input);
    this._observationHistory.push(observation);
    if (this._observationHistory.length > MAX_OBSERVATION_HISTORY) {
      this._observationHistory = this._observationHistory.slice(-MAX_OBSERVATION_HISTORY);
    }

    const targetPath = await this._enqueueWrite(() => this._adapter.appendObservation(observation));
    this._logger("observationWritten", {
      observationId: observation.observationId,
      observationType: observation.observationType,
      source: observation.source,
      targetPath,
    });
    return {
      ok: true,
      observation,
      targetPath,
      adapterMode: this._activeAdapterMode,
    };
  }

  async evaluatePromotionCandidate(input = {}) {
    if (!this._adapter) {
      return {
        ok: false,
        error: "memory_pipeline_not_started",
      };
    }

    const candidateType = asSafeString(input.candidateType, "adaptive_preference");
    const focusObservationType = asSafeString(input.focusObservationType, "");
    const thresholdsInput = asObject(input.thresholds);
    const thresholds = {
      minimumInteractionCount: Number.isFinite(thresholdsInput.minimumInteractionCount)
        ? Math.max(1, Math.round(thresholdsInput.minimumInteractionCount))
        : DEFAULT_PROMOTION_THRESHOLDS.minimumInteractionCount,
      minimumPersistenceHours: Number.isFinite(thresholdsInput.minimumPersistenceHours)
        ? Math.max(0, Number(thresholdsInput.minimumPersistenceHours))
        : DEFAULT_PROMOTION_THRESHOLDS.minimumPersistenceHours,
      minimumDistinctEvidencePoints: Number.isFinite(thresholdsInput.minimumDistinctEvidencePoints)
        ? Math.max(1, Math.round(thresholdsInput.minimumDistinctEvidencePoints))
        : DEFAULT_PROMOTION_THRESHOLDS.minimumDistinctEvidencePoints,
    };

    const relevant = this._observationHistory.filter((entry) => {
      if (!focusObservationType) return true;
      return entry.observationType === focusObservationType;
    });
    const interactionCount = relevant.length;
    const earliestTsMs = relevant.length > 0 ? relevant[0].tsMs : 0;
    const latestTsMs = relevant.length > 0 ? relevant[relevant.length - 1].tsMs : 0;
    const persistenceHours =
      interactionCount > 1 ? (latestTsMs - earliestTsMs) / (1000 * 60 * 60) : 0;
    const distinctEvidencePoints = new Set(
      relevant.map((entry) => asSafeString(entry.evidenceTag, "none"))
    ).size;

    const reasons = [];
    if (interactionCount < thresholds.minimumInteractionCount) {
      reasons.push("interaction_count_below_threshold");
    }
    if (persistenceHours < thresholds.minimumPersistenceHours) {
      reasons.push("persistence_window_below_threshold");
    }
    if (distinctEvidencePoints < thresholds.minimumDistinctEvidencePoints) {
      reasons.push("distinct_evidence_below_threshold");
    }

    const tsMs = Date.now();
    const decision = {
      decisionId: `prom-${tsMs.toString(36)}-${shortRandomId()}`,
      ts: toIsoTimestamp(tsMs),
      candidateType,
      focusObservationType: focusObservationType || "all",
      outcome: reasons.length > 0 ? "rejected" : "accepted",
      reasons,
      thresholds,
      metrics: {
        interactionCount,
        persistenceHours: Number(persistenceHours.toFixed(2)),
        distinctEvidencePoints,
      },
      sourceEvidenceIds: relevant.slice(-6).map((entry) => entry.observationId),
    };

    const targetPath = await this._enqueueWrite(() =>
      this._adapter.appendPromotionDecision(decision)
    );
    this._logger("promotionDecision", {
      decisionId: decision.decisionId,
      outcome: decision.outcome,
      reasons: decision.reasons,
      targetPath,
    });
    return {
      ok: true,
      decision,
      targetPath,
      adapterMode: this._activeAdapterMode,
    };
  }

  async attemptIdentityMutation(input = {}) {
    if (!this._adapter) {
      return {
        ok: false,
        error: "memory_pipeline_not_started",
      };
    }

    const section = asSafeString(input.section, "unknown");
    const tsMs = Date.now();
    const evidence = Array.isArray(input.evidence) ? input.evidence.slice(0, 12) : [];
    const blocked = isProtectedIdentitySection(section);
    const auditEntry = {
      mutationId: `mut-${tsMs.toString(36)}-${shortRandomId()}`,
      ts: toIsoTimestamp(tsMs),
      section,
      outcome: blocked ? "blocked" : "allowed",
      reason: blocked ? "immutable_core_protected" : "allowed_target",
      transparencyPolicy: this._mutationTransparencyPolicy,
      evidence,
      requestedPatch: asObject(input.patch),
    };
    const targetPath = await this._enqueueWrite(() =>
      this._adapter.appendIdentityMutationAudit(auditEntry)
    );

    this._logger("identityMutationDecision", {
      mutationId: auditEntry.mutationId,
      section: auditEntry.section,
      outcome: auditEntry.outcome,
      reason: auditEntry.reason,
      targetPath,
    });
    return {
      ok: !blocked,
      blocked,
      error: blocked ? "protected_identity_section" : null,
      auditEntry,
      targetPath,
      adapterMode: this._activeAdapterMode,
    };
  }
}

function createMemoryPipeline(options) {
  return new MemoryPipelineRuntime(options);
}

module.exports = {
  MEMORY_ADAPTER_MODES,
  MUTATION_TRANSPARENCY_POLICIES,
  OPENCLAW_WORKSPACE_BOOTSTRAP_MODES,
  OPENCLAW_WORKSPACE_FILES,
  OPENCLAW_WORKSPACE_FILE_TEMPLATES,
  DEFAULT_OBSIDIAN_VAULT_PATH,
  DEFAULT_PROMOTION_THRESHOLDS,
  createMemoryPipeline,
};
