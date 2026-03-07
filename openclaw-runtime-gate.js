"use strict";

function isOpenClawEnabled(settings) {
  const openclaw = settings && typeof settings === "object" ? settings.openclaw : null;
  return Boolean(openclaw && openclaw.enabled);
}

function evaluateOpenClawDialogGate({ settings, bridge } = {}) {
  if (!isOpenClawEnabled(settings)) {
    return {
      allowed: false,
      fallbackMode: "bridge_disabled",
      reason: "openclaw_disabled",
    };
  }
  if (!bridge) {
    return {
      allowed: false,
      fallbackMode: "bridge_unavailable",
      reason: "bridge_runtime_unavailable",
    };
  }
  return {
    allowed: true,
    fallbackMode: "none",
    reason: "ready",
  };
}

module.exports = {
  evaluateOpenClawDialogGate,
  isOpenClawEnabled,
};
