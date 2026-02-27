"use strict";

const fs = require("fs");
const path = require("path");
const { loadRuntimeSettings } = require("../settings-runtime");
const {
  OPENCLAW_WORKSPACE_FILES,
  OPENCLAW_WORKSPACE_FILE_TEMPLATES,
} = require("../memory-pipeline");

const OBSIDIAN_REQUIRED_DIRS = Object.freeze([
  "01_Logs",
  "02_User",
  "03_Primea",
  "04_Analysis",
  "99_System",
]);

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function isDirectory(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function ensureFile(targetPath, initialContent) {
  if (fs.existsSync(targetPath)) return false;
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, initialContent, "utf8");
  return true;
}

function checkOpenClawWorkspace({ settings, resolvedPaths, bootstrapOpenClaw }) {
  if (!settings.openclaw.enabled) {
    return {
      status: "disabled",
      targetRoot: resolvedPaths.openClawRoot,
      missingFiles: [],
      createdFiles: [],
    };
  }
  if (!resolvedPaths.openClawRoot) {
    return {
      status: "missing_config",
      targetRoot: null,
      missingFiles: [],
      createdFiles: [],
      warning: "paths.openClawWorkspaceRoot is not configured.",
    };
  }

  const targetRoot = resolvedPaths.openClawRoot;
  if (!fs.existsSync(targetRoot)) {
    return {
      status: "missing_path",
      targetRoot,
      missingFiles: OPENCLAW_WORKSPACE_FILES.map((name) => path.join(targetRoot, name)),
      createdFiles: [],
      warning: "OpenClaw workspace root does not exist.",
    };
  }
  if (!isDirectory(targetRoot)) {
    return {
      status: "not_directory",
      targetRoot,
      missingFiles: [],
      createdFiles: [],
      warning: "OpenClaw workspace root is not a directory.",
    };
  }

  const missingFiles = [];
  const createdFiles = [];
  for (const fileName of OPENCLAW_WORKSPACE_FILES) {
    const filePath = path.join(targetRoot, fileName);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(filePath);
      if (bootstrapOpenClaw) {
        const initialContent =
          OPENCLAW_WORKSPACE_FILE_TEMPLATES[fileName] ||
          `# ${fileName.replace(/\.md$/i, "")}\n\n`;
        if (ensureFile(filePath, initialContent)) {
          createdFiles.push(filePath);
        }
      }
    }
  }

  const postBootstrapMissing = OPENCLAW_WORKSPACE_FILES
    .map((fileName) => path.join(targetRoot, fileName))
    .filter((filePath) => !fs.existsSync(filePath));

  return {
    status: postBootstrapMissing.length > 0 ? "missing_files" : "ready",
    targetRoot,
    missingFiles: postBootstrapMissing.length > 0 ? postBootstrapMissing : missingFiles,
    createdFiles,
  };
}

function checkObsidianVault({ settings, resolvedPaths, bootstrapObsidian }) {
  const obsidianRequested = settings.memory.adapterMode === "obsidian";
  if (!obsidianRequested && !bootstrapObsidian) {
    return {
      status: "not_requested",
      targetRoot: resolvedPaths.obsidianRoot,
      missingDirs: [],
      createdDirs: [],
    };
  }

  if (!resolvedPaths.obsidianRoot) {
    return {
      status: "missing_config",
      targetRoot: null,
      missingDirs: OBSIDIAN_REQUIRED_DIRS.slice(),
      createdDirs: [],
      warning: "paths.obsidianVaultRoot is not configured.",
    };
  }

  const targetRoot = resolvedPaths.obsidianRoot;
  if (!fs.existsSync(targetRoot)) {
    if (!bootstrapObsidian) {
      return {
        status: "missing_path",
        targetRoot,
        missingDirs: OBSIDIAN_REQUIRED_DIRS.slice(),
        createdDirs: [],
      };
    }
    ensureDir(targetRoot);
  } else if (!isDirectory(targetRoot)) {
    return {
      status: "not_directory",
      targetRoot,
      missingDirs: [],
      createdDirs: [],
      warning: "Obsidian vault root is not a directory.",
    };
  }

  const missingDirs = [];
  const createdDirs = [];
  for (const relDir of OBSIDIAN_REQUIRED_DIRS) {
    const fullPath = path.join(targetRoot, relDir);
    if (!isDirectory(fullPath)) {
      missingDirs.push(fullPath);
      if (bootstrapObsidian) {
        ensureDir(fullPath);
        createdDirs.push(fullPath);
      }
    }
  }
  const postBootstrapMissing = OBSIDIAN_REQUIRED_DIRS
    .map((relDir) => path.join(targetRoot, relDir))
    .filter((fullPath) => !isDirectory(fullPath));

  return {
    status: postBootstrapMissing.length > 0 ? "missing_dirs" : "ready",
    targetRoot,
    missingDirs: postBootstrapMissing.length > 0 ? postBootstrapMissing : missingDirs,
    createdDirs,
  };
}

function checkLocalWorkspace(resolvedPaths) {
  const localRoot = resolvedPaths.localRoot;
  if (!localRoot) {
    return {
      status: "missing_config",
      targetRoot: null,
    };
  }
  if (!fs.existsSync(localRoot)) {
    return {
      status: "missing_path",
      targetRoot: localRoot,
    };
  }
  if (!isDirectory(localRoot)) {
    return {
      status: "not_directory",
      targetRoot: localRoot,
    };
  }
  return {
    status: "ready",
    targetRoot: localRoot,
  };
}

function summarizeOutcome(outcome) {
  const strict = hasFlag("--strict");
  const hasBlockingIssue =
    outcome.localWorkspace.status !== "ready" ||
    (outcome.openclaw.status !== "disabled" &&
      outcome.openclaw.status !== "ready" &&
      outcome.openclaw.status !== "missing_config") ||
    (outcome.obsidian.status !== "not_requested" &&
      outcome.obsidian.status !== "ready" &&
      outcome.obsidian.status !== "missing_config");
  if (strict && hasBlockingIssue) {
    process.exitCode = 1;
  }
}

function run() {
  const projectRoot = path.resolve(__dirname, "..");
  const settingsSnapshot = loadRuntimeSettings({
    projectRoot,
    env: process.env,
  });
  const settings = settingsSnapshot.settings;
  const resolvedPaths = settingsSnapshot.resolvedPaths;
  const bootstrapOpenClaw = hasFlag("--bootstrap-openclaw");
  const bootstrapObsidian = hasFlag("--bootstrap-obsidian");

  const outcome = {
    ts: new Date().toISOString(),
    bootstrap: {
      openclaw: bootstrapOpenClaw,
      obsidian: bootstrapObsidian,
    },
    settingsWarnings: settingsSnapshot.validationWarnings,
    settingsErrors: settingsSnapshot.validationErrors,
    localWorkspace: checkLocalWorkspace(resolvedPaths),
    openclaw: checkOpenClawWorkspace({
      settings,
      resolvedPaths,
      bootstrapOpenClaw,
    }),
    obsidian: checkObsidianVault({
      settings,
      resolvedPaths,
      bootstrapObsidian,
    }),
  };

  summarizeOutcome(outcome);
  console.log(JSON.stringify(outcome, null, 2));
}

run();
