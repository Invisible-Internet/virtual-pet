"use strict";

const CAPABILITY_STATES = Object.freeze({
  disabled: "disabled",
  starting: "starting",
  healthy: "healthy",
  degraded: "degraded",
  failed: "failed",
  stopping: "stopping",
  stopped: "stopped",
});

const VALID_STATES = new Set(Object.values(CAPABILITY_STATES));

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim().length > 0);
}

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function normalizeState(candidate, fallback = CAPABILITY_STATES.healthy) {
  if (typeof candidate !== "string") return fallback;
  return VALID_STATES.has(candidate) ? candidate : fallback;
}

function normalizeCapabilityDefinition(definition) {
  if (!definition || typeof definition !== "object") {
    throw new Error("Capability definition must be an object.");
  }
  if (typeof definition.capabilityId !== "string" || definition.capabilityId.trim().length === 0) {
    throw new Error("Capability definition requires a non-empty capabilityId.");
  }

  const capabilityId = definition.capabilityId.trim();
  return {
    capabilityId,
    contractVersion:
      typeof definition.contractVersion === "string" && definition.contractVersion.trim().length > 0
        ? definition.contractVersion.trim()
        : "1.0",
    required: Boolean(definition.required),
    defaultEnabled: definition.defaultEnabled !== false,
    dependsOn: normalizeStringArray(definition.dependsOn),
    optionalDependsOn: normalizeStringArray(definition.optionalDependsOn),
    telemetryTags: normalizeStringArray(definition.telemetryTags),
    start: typeof definition.start === "function" ? definition.start : null,
    stop: typeof definition.stop === "function" ? definition.stop : null,
    health: typeof definition.health === "function" ? definition.health : null,
    onConfigChanged:
      typeof definition.onConfigChanged === "function" ? definition.onConfigChanged : null,
    degradedPolicy: asObject(definition.degradedPolicy),
  };
}

function countByState(snapshots) {
  let healthyCount = 0;
  let degradedCount = 0;
  let failedCount = 0;
  let disabledCount = 0;
  let startingCount = 0;
  let stoppingCount = 0;
  let stoppedCount = 0;

  for (const snapshot of snapshots) {
    switch (snapshot.state) {
      case CAPABILITY_STATES.healthy:
        healthyCount += 1;
        break;
      case CAPABILITY_STATES.degraded:
        degradedCount += 1;
        break;
      case CAPABILITY_STATES.failed:
        failedCount += 1;
        break;
      case CAPABILITY_STATES.disabled:
        disabledCount += 1;
        break;
      case CAPABILITY_STATES.starting:
        startingCount += 1;
        break;
      case CAPABILITY_STATES.stopping:
        stoppingCount += 1;
        break;
      case CAPABILITY_STATES.stopped:
        stoppedCount += 1;
        break;
      default:
        break;
    }
  }

  return {
    healthyCount,
    degradedCount,
    failedCount,
    disabledCount,
    startingCount,
    stoppingCount,
    stoppedCount,
  };
}

class CapabilityRegistry {
  constructor({ onTransition } = {}) {
    this._onTransition = typeof onTransition === "function" ? onTransition : null;
    this._definitions = new Map();
    this._states = new Map();
    this._bootOrder = [];
  }

  register(definition) {
    const normalized = normalizeCapabilityDefinition(definition);
    if (this._definitions.has(normalized.capabilityId)) {
      throw new Error(`Capability "${normalized.capabilityId}" is already registered.`);
    }

    this._definitions.set(normalized.capabilityId, normalized);
    this._bootOrder.push(normalized.capabilityId);
    this._setState(normalized.capabilityId, {
      state: CAPABILITY_STATES.disabled,
      reason: "registered",
      details: {},
    });
    return normalized;
  }

  getDefinitions() {
    return this._bootOrder.map((capabilityId) => this._definitions.get(capabilityId));
  }

  getCapability(capabilityId) {
    return this._definitions.get(capabilityId) || null;
  }

  getCapabilityState(capabilityId) {
    const snapshot = this._states.get(capabilityId);
    return snapshot ? { ...snapshot, details: asObject(snapshot.details) } : null;
  }

  updateCapabilityState(capabilityId, update) {
    if (!this._definitions.has(capabilityId)) return null;
    return this._setState(capabilityId, update);
  }

  async startAll(context = {}) {
    for (const capabilityId of this._bootOrder) {
      // eslint-disable-next-line no-await-in-loop
      await this.startCapability(capabilityId, context);
    }
    return this.getSnapshot();
  }

  async startCapability(capabilityId, context = {}) {
    const definition = this._definitions.get(capabilityId);
    if (!definition) return null;

    if (!definition.defaultEnabled) {
      return this._setState(capabilityId, {
        state: CAPABILITY_STATES.disabled,
        reason: "defaultDisabled",
        details: {},
      });
    }

    this._setState(capabilityId, {
      state: CAPABILITY_STATES.starting,
      reason: "startup",
      details: {},
    });

    try {
      const result =
        definition.start &&
        (await definition.start({
          capabilityId,
          registry: this,
          definition,
          context,
        }));
      return this._applyStartResult(capabilityId, result);
    } catch (error) {
      return this._setState(capabilityId, {
        state: CAPABILITY_STATES.failed,
        reason: "startupError",
        details: {
          message: error?.message || String(error),
        },
      });
    }
  }

  async stopAll(context = {}) {
    const reverseOrder = [...this._bootOrder].reverse();
    for (const capabilityId of reverseOrder) {
      // eslint-disable-next-line no-await-in-loop
      await this.stopCapability(capabilityId, context);
    }
    return this.getSnapshot();
  }

  async stopCapability(capabilityId, context = {}) {
    const definition = this._definitions.get(capabilityId);
    if (!definition) return null;

    this._setState(capabilityId, {
      state: CAPABILITY_STATES.stopping,
      reason: "shutdown",
      details: {},
    });

    try {
      if (definition.stop) {
        await definition.stop({
          capabilityId,
          registry: this,
          definition,
          context,
        });
      }
    } catch (error) {
      this._setState(capabilityId, {
        state: CAPABILITY_STATES.failed,
        reason: "shutdownError",
        details: {
          message: error?.message || String(error),
        },
      });
    }

    return this._setState(capabilityId, {
      state: CAPABILITY_STATES.stopped,
      reason: "stopped",
      details: {},
    });
  }

  getSnapshot() {
    const capabilities = this._bootOrder
      .map((capabilityId) => this._states.get(capabilityId))
      .filter(Boolean)
      .map((snapshot) => ({ ...snapshot, details: asObject(snapshot.details) }));
    const summary = countByState(capabilities);
    const runtimeState =
      summary.failedCount > 0
        ? CAPABILITY_STATES.failed
        : summary.degradedCount > 0
          ? CAPABILITY_STATES.degraded
          : CAPABILITY_STATES.healthy;

    return {
      ts: Date.now(),
      runtimeState,
      capabilities,
      summary,
    };
  }

  _applyStartResult(capabilityId, result) {
    const normalizedResult = asObject(result);
    return this._setState(capabilityId, {
      state: normalizeState(normalizedResult.state, CAPABILITY_STATES.healthy),
      reason:
        typeof normalizedResult.reason === "string" && normalizedResult.reason.length > 0
          ? normalizedResult.reason
          : "ok",
      details: asObject(normalizedResult.details),
    });
  }

  _setState(capabilityId, update) {
    const definition = this._definitions.get(capabilityId);
    if (!definition) return null;

    const previous = this._states.get(capabilityId) || null;
    const next = {
      capabilityId,
      contractVersion: definition.contractVersion,
      required: definition.required,
      enabled: definition.defaultEnabled,
      dependsOn: [...definition.dependsOn],
      optionalDependsOn: [...definition.optionalDependsOn],
      telemetryTags: [...definition.telemetryTags],
      state: normalizeState(update?.state, CAPABILITY_STATES.healthy),
      reason:
        typeof update?.reason === "string" && update.reason.length > 0 ? update.reason : "unspecified",
      details: asObject(update?.details),
      ts: Date.now(),
    };

    this._states.set(capabilityId, next);
    if (this._onTransition) {
      this._onTransition({
        capabilityId,
        previous,
        next,
        snapshot: this.getSnapshot(),
      });
    }
    return next;
  }
}

function createCapabilityRegistry(options) {
  return new CapabilityRegistry(options);
}

module.exports = {
  CAPABILITY_STATES,
  createCapabilityRegistry,
};
