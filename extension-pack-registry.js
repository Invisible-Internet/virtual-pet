"use strict";

const fs = require("fs");
const path = require("path");

const MANIFEST_FILENAME = "extension.manifest.json";
const DEFAULT_EXTENSIONS_ROOT = path.join(__dirname, "extensions");
const EXTENSION_API_VERSION = "1.0";
const EXTENSION_ID_PATTERN = /^[a-z0-9._-]+$/i;

function asArrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function toBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function summarizeError(error) {
  if (!error) return "unknown error";
  if (typeof error.message === "string" && error.message.length > 0) {
    return error.message;
  }
  return String(error);
}

function validateManifest(rawManifest, sourceDir) {
  const errors = [];
  const manifest = rawManifest && typeof rawManifest === "object" ? rawManifest : null;
  if (!manifest) {
    return {
      valid: false,
      errors: ["manifest is not an object"],
      normalized: null,
    };
  }

  const extensionId =
    typeof manifest.extensionId === "string" ? manifest.extensionId.trim() : "";
  if (!extensionId) {
    errors.push("missing extensionId");
  } else if (!EXTENSION_ID_PATTERN.test(extensionId)) {
    errors.push("extensionId contains unsupported characters");
  }

  const name = typeof manifest.name === "string" ? manifest.name.trim() : "";
  if (!name) {
    errors.push("missing name");
  }

  const version = typeof manifest.version === "string" ? manifest.version.trim() : "";
  if (!version) {
    errors.push("missing version");
  }

  const permissions = asArrayOfStrings(manifest.permissions);
  const compatibility = {
    apiVersion:
      typeof manifest.apiVersion === "string" && manifest.apiVersion.trim().length > 0
        ? manifest.apiVersion.trim()
        : EXTENSION_API_VERSION,
    minAppVersion:
      typeof manifest.minAppVersion === "string" ? manifest.minAppVersion.trim() : "",
    maxAppVersion:
      typeof manifest.maxAppVersion === "string" ? manifest.maxAppVersion.trim() : "",
  };

  const props = Array.isArray(manifest.props) ? manifest.props : [];
  const normalizedProps = [];
  for (const rawProp of props) {
    if (!rawProp || typeof rawProp !== "object") continue;
    const propId = typeof rawProp.id === "string" ? rawProp.id.trim() : "";
    if (!propId || !EXTENSION_ID_PATTERN.test(propId)) {
      errors.push(`invalid prop id in ${sourceDir}`);
      continue;
    }

    normalizedProps.push({
      id: propId,
      label:
        typeof rawProp.label === "string" && rawProp.label.trim().length > 0
          ? rawProp.label.trim()
          : propId,
      enabled: toBoolean(rawProp.enabled, true),
    });
  }

  const valid = errors.length === 0;
  return {
    valid,
    errors,
    normalized: valid
      ? {
          manifestVersion: Number.isFinite(manifest.manifestVersion)
            ? Math.max(1, Math.round(manifest.manifestVersion))
            : 1,
          extensionId,
          name,
          version,
          apiVersion: compatibility.apiVersion,
          minAppVersion: compatibility.minAppVersion,
          maxAppVersion: compatibility.maxAppVersion,
          permissions,
          props: normalizedProps,
        }
      : null,
  };
}

class ExtensionPackRegistry {
  constructor({ rootDir = DEFAULT_EXTENSIONS_ROOT, logger } = {}) {
    this._rootDir = rootDir;
    this._logger = typeof logger === "function" ? logger : () => {};
    this._extensions = new Map();
    this._warnings = [];
    this._trustWarningShown = new Set();
  }

  discover() {
    this._extensions.clear();
    this._warnings = [];

    if (!fs.existsSync(this._rootDir)) {
      this._warnings.push(`extensions root not found: ${this._rootDir}`);
      return this.getSnapshot();
    }

    const directoryEntries = fs.readdirSync(this._rootDir, { withFileTypes: true });
    for (const dirent of directoryEntries) {
      if (!dirent.isDirectory()) continue;

      const extensionDir = path.join(this._rootDir, dirent.name);
      const manifestPath = path.join(extensionDir, MANIFEST_FILENAME);
      if (!fs.existsSync(manifestPath)) continue;

      let rawManifest = null;
      try {
        rawManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      } catch (error) {
        this._warnings.push(`${dirent.name}: failed to parse manifest (${summarizeError(error)})`);
        this._extensions.set(dirent.name, {
          extensionId: dirent.name,
          sourceDir: dirent.name,
          manifestPath,
          valid: false,
          enabled: false,
          trustWarningShown: false,
          permissions: [],
          props: [],
          errors: [`failed to parse manifest: ${summarizeError(error)}`],
        });
        continue;
      }

      const validation = validateManifest(rawManifest, dirent.name);
      const extensionId = validation.normalized?.extensionId || dirent.name;
      const valid = validation.valid;
      const enabled = valid;

      const record = {
        extensionId,
        sourceDir: dirent.name,
        manifestPath,
        valid,
        enabled,
        trustWarningShown: false,
        permissions: validation.normalized?.permissions || [],
        props: validation.normalized?.props || [],
        manifest: validation.normalized,
        errors: validation.errors,
      };

      this._extensions.set(extensionId, record);
      if (!valid) {
        this._warnings.push(`${extensionId}: ${validation.errors.join("; ")}`);
      }
    }

    const snapshot = this.getSnapshot();
    this._logger("discover-summary", {
      rootDir: this._rootDir,
      discovered: snapshot.summary.discoveredCount,
      valid: snapshot.summary.validCount,
      invalid: snapshot.summary.invalidCount,
      enabled: snapshot.summary.enabledCount,
    });
    return snapshot;
  }

  getSnapshot() {
    const list = [...this._extensions.values()].map((record) => ({
      extensionId: record.extensionId,
      sourceDir: record.sourceDir,
      manifestPath: record.manifestPath,
      valid: record.valid,
      enabled: record.enabled,
      trustWarningShown: record.trustWarningShown,
      permissions: [...record.permissions],
      props: record.props.map((prop) => ({ ...prop })),
      errors: [...record.errors],
    }));

    const discoveredCount = list.length;
    const validCount = list.filter((entry) => entry.valid).length;
    const invalidCount = list.filter((entry) => !entry.valid).length;
    const enabledCount = list.filter((entry) => entry.enabled).length;

    return {
      ts: Date.now(),
      rootDir: this._rootDir,
      apiVersion: EXTENSION_API_VERSION,
      extensions: list,
      warnings: [...this._warnings],
      summary: {
        discoveredCount,
        validCount,
        invalidCount,
        enabledCount,
      },
    };
  }

  setEnabled(extensionId, enabled) {
    const record = this._extensions.get(extensionId);
    if (!record) {
      return {
        ok: false,
        error: "extension_not_found",
      };
    }
    if (!record.valid) {
      return {
        ok: false,
        error: "extension_invalid",
        errors: [...record.errors],
      };
    }

    const nextEnabled = Boolean(enabled);
    let trustWarning = null;
    if (nextEnabled && !this._trustWarningShown.has(extensionId)) {
      this._trustWarningShown.add(extensionId);
      record.trustWarningShown = true;
      trustWarning =
        "Author-trusted extension enabled. Review permissions and disable if behavior is unexpected.";
      this._logger("trust-warning", {
        extensionId,
        permissions: record.permissions,
      });
    }

    record.enabled = nextEnabled;
    return {
      ok: true,
      extensionId,
      enabled: record.enabled,
      trustWarning,
      snapshot: this.getSnapshot(),
    };
  }

  triggerPropInteraction(extensionId, propId, interactionType = "click") {
    const record = this._extensions.get(extensionId);
    if (!record) {
      return { ok: false, error: "extension_not_found" };
    }
    if (!record.valid) {
      return { ok: false, error: "extension_invalid", errors: [...record.errors] };
    }
    if (!record.enabled) {
      return { ok: false, error: "extension_disabled" };
    }

    const prop = record.props.find((entry) => entry.id === propId);
    if (!prop) {
      return { ok: false, error: "prop_not_found" };
    }
    if (!prop.enabled) {
      return { ok: false, error: "prop_disabled" };
    }

    const intent = {
      kind: "INTENT_PROP_INTERACTION",
      extensionId,
      propId,
      interactionType,
      ts: Date.now(),
    };

    return {
      ok: true,
      intent,
      prop: { ...prop },
    };
  }
}

function createExtensionPackRegistry(options) {
  return new ExtensionPackRegistry(options);
}

module.exports = {
  MANIFEST_FILENAME,
  DEFAULT_EXTENSIONS_ROOT,
  EXTENSION_API_VERSION,
  createExtensionPackRegistry,
};
