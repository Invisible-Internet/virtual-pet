const SHELL_ACTIONS = Object.freeze({
  roamDesktop: "roam-desktop",
  roamZone: "roam-zone",
  selectRoamZone: "select-roam-zone",
  toggleHeadphones: "toggle-headphones",
  togglePoolRing: "toggle-pool-ring",
});

const DEFAULT_SHELL_STATE = Object.freeze({
  wardrobe: Object.freeze({
    activeAccessories: Object.freeze([]),
    hasHeadphones: false,
  }),
  inventory: Object.freeze({
    quickProps: Object.freeze([]),
    hasPoolRing: false,
  }),
  dialog: Object.freeze({
    alwaysShowBubble: true,
  }),
  roaming: Object.freeze({
    mode: "desktop",
    zone: "desk-center",
    zoneRect: null,
  }),
  tray: Object.freeze({
    available: false,
    supported: true,
    error: null,
  }),
  devFallback: Object.freeze({
    enabled: true,
    hotkeys: Object.freeze(["F6", "F7", "F8", "F9"]),
  }),
});

const closeButton = document.getElementById("close-window");
const roamBadge = document.getElementById("roam-badge");
const trayBadge = document.getElementById("tray-badge");
const statusLine = document.getElementById("status-line");
const roamDesktopButton = document.getElementById("roam-desktop");
const roamDesktopChip = document.getElementById("roam-desktop-chip");
const roamZoneButton = document.getElementById("roam-zone");
const roamZoneChip = document.getElementById("roam-zone-chip");
const drawRoamZoneButton = document.getElementById("draw-roam-zone");
const headphonesToggle = document.getElementById("toggle-headphones");
const headphonesChip = document.getElementById("headphones-chip");
const poolRingDragHandle = document.getElementById("drag-pool-ring");
const poolRingChip = document.getElementById("pool-ring-chip");
const poolRingRemoveButton = document.getElementById("remove-pool-ring");

let latestShellState = { ...DEFAULT_SHELL_STATE };
let statusTone = "muted";
let statusMessage = "";
let activePlacement = null;
let placementTimer = null;

function normalizeStringArray(value) {
  const rawValues =
    Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const normalized = [];
  const seen = new Set();
  for (const entry of rawValues) {
    const trimmed = typeof entry === "string" ? entry.trim() : "";
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

function normalizeShellState(payload = {}) {
  const wardrobe = payload?.wardrobe && typeof payload.wardrobe === "object" ? payload.wardrobe : {};
  const inventory = payload?.inventory && typeof payload.inventory === "object" ? payload.inventory : {};
  const dialog = payload?.dialog && typeof payload.dialog === "object" ? payload.dialog : {};
  const roaming = payload?.roaming && typeof payload.roaming === "object" ? payload.roaming : {};
  const tray = payload?.tray && typeof payload.tray === "object" ? payload.tray : {};
  const devFallback =
    payload?.devFallback && typeof payload.devFallback === "object" ? payload.devFallback : {};
  const activeAccessories = normalizeStringArray(wardrobe.activeAccessories);
  const quickProps = normalizeStringArray(inventory.quickProps);
  return {
    wardrobe: {
      activeAccessories,
      hasHeadphones: activeAccessories.includes("headphones"),
    },
    inventory: {
      quickProps,
      hasPoolRing: quickProps.includes("poolRing"),
    },
    dialog: {
      alwaysShowBubble: dialog.alwaysShowBubble !== false,
    },
    roaming: {
      mode: roaming.mode === "zone" ? "zone" : "desktop",
      zone:
        typeof roaming.zone === "string" && roaming.zone.trim().length > 0
          ? roaming.zone.trim()
          : DEFAULT_SHELL_STATE.roaming.zone,
      zoneRect:
        Number.isFinite(Number(roaming.zoneRect?.x)) &&
        Number.isFinite(Number(roaming.zoneRect?.y)) &&
        Number.isFinite(Number(roaming.zoneRect?.width)) &&
        Number.isFinite(Number(roaming.zoneRect?.height))
          ? {
              x: Math.round(Number(roaming.zoneRect.x)),
              y: Math.round(Number(roaming.zoneRect.y)),
              width: Math.round(Number(roaming.zoneRect.width)),
              height: Math.round(Number(roaming.zoneRect.height)),
            }
          : null,
    },
    tray: {
      available: Boolean(tray.available),
      supported: tray.supported !== false,
      error: typeof tray.error === "string" && tray.error.trim().length > 0 ? tray.error.trim() : null,
    },
    devFallback: {
      enabled: devFallback.enabled !== false,
      hotkeys:
        normalizeStringArray(devFallback.hotkeys).length > 0
          ? normalizeStringArray(devFallback.hotkeys)
          : [...DEFAULT_SHELL_STATE.devFallback.hotkeys],
    },
  };
}

function getRoamZoneLabel() {
  return latestShellState.roaming.zoneRect ? "custom" : latestShellState.roaming.zone;
}

function setStatus(message, tone = "muted") {
  statusMessage = typeof message === "string" ? message : "";
  statusTone = tone;
  renderStatus();
}

function renderStatus() {
  if (!statusLine) return;
  let message = statusMessage;
  let tone = statusTone;
  if (!message) {
    if (latestShellState.roaming.mode === "zone" && !latestShellState.roaming.zoneRect) {
      message = "Draw a roam zone to keep the pet moving inside a marquee area.";
      tone = "warning";
    } else if (latestShellState.tray.available) {
      message = "Drag the pool ring icon out of this window to place it on the desktop.";
      tone = "muted";
    } else {
      message = `Tray unavailable. Fallback hotkeys: ${latestShellState.devFallback.hotkeys.join(", ")}.`;
      tone = "warning";
    }
  }
  statusLine.textContent = message;
  statusLine.dataset.tone = tone;
}

function render() {
  if (roamBadge) {
    roamBadge.textContent =
      latestShellState.roaming.mode === "zone"
        ? `Roam: Zone (${getRoamZoneLabel()})`
        : "Roam: Desktop";
  }
  if (trayBadge) {
    trayBadge.textContent = latestShellState.tray.available ? "Tray Ready" : "Fallback Mode";
    trayBadge.dataset.tone = latestShellState.tray.available ? "ok" : "warning";
  }
  if (roamDesktopButton) {
    roamDesktopButton.classList.toggle("is-active", latestShellState.roaming.mode === "desktop");
  }
  if (roamDesktopChip) {
    roamDesktopChip.textContent = latestShellState.roaming.mode === "desktop" ? "Active" : "Idle";
  }
  if (roamZoneButton) {
    roamZoneButton.classList.toggle("is-active", latestShellState.roaming.mode === "zone");
  }
  if (roamZoneChip) {
    roamZoneChip.textContent =
      latestShellState.roaming.mode === "zone"
        ? latestShellState.roaming.zoneRect
          ? "Custom"
          : "Pending"
        : "Zone";
  }
  if (headphonesToggle) {
    headphonesToggle.classList.toggle("is-active", latestShellState.wardrobe.hasHeadphones);
  }
  if (headphonesChip) {
    headphonesChip.textContent = latestShellState.wardrobe.hasHeadphones ? "Equipped" : "Stowed";
  }
  if (poolRingDragHandle) {
    poolRingDragHandle.classList.toggle("is-active", latestShellState.inventory.hasPoolRing);
    poolRingDragHandle.classList.toggle("is-dragging", Boolean(activePlacement));
  }
  if (poolRingChip) {
    poolRingChip.textContent = activePlacement
      ? "Placing"
      : latestShellState.inventory.hasPoolRing
        ? "On Desktop"
        : "Stowed";
  }
  if (poolRingRemoveButton) {
    poolRingRemoveButton.disabled = !latestShellState.inventory.hasPoolRing;
  }
  renderStatus();
}

async function runShellAction(actionId, successMessage, failureMessage) {
  try {
    const result = await window.inventoryAPI.runShellAction(actionId);
    if (!result?.ok) {
      setStatus(failureMessage || result?.error || "Shell action failed.", "warning");
      return;
    }
    if (result.shellState && typeof result.shellState === "object") {
      syncShellState(result.shellState);
    }
    setStatus(successMessage, "ok");
  } catch (error) {
    setStatus(failureMessage || error?.message || "Shell action failed.", "warning");
  }
}

function stopPlacementPump() {
  if (!placementTimer) return;
  window.clearInterval(placementTimer);
  placementTimer = null;
}

function startPlacementPump() {
  stopPlacementPump();
  placementTimer = window.setInterval(() => {
    if (!activePlacement) return;
    void window.inventoryAPI.updatePropPlacement(activePlacement.propId);
  }, 16);
}

async function finishPlacement(commit) {
  if (!activePlacement) return;
  const placement = activePlacement;
  activePlacement = null;
  stopPlacementPump();
  if (
    placement.element &&
    typeof placement.element.hasPointerCapture === "function" &&
    placement.element.hasPointerCapture(placement.pointerId)
  ) {
    placement.element.releasePointerCapture(placement.pointerId);
  }

  try {
    const result = await window.inventoryAPI.endPropPlacement(placement.propId, commit);
    if (!result?.ok) {
      setStatus(result?.error || "Pool ring placement failed.", "warning");
    } else if (commit) {
      setStatus("Pool ring placed. Drag the prop window later to reposition it.", "ok");
    } else {
      setStatus("Pool ring placement cancelled.", "muted");
    }
  } catch (error) {
    setStatus(error?.message || "Pool ring placement failed.", "warning");
  }
  render();
}

async function beginPoolRingPlacement(event) {
  if (event.button !== 0 || activePlacement) return;
  event.preventDefault();
  const element = event.currentTarget;
  if (!element) return;

  if (typeof element.setPointerCapture === "function") {
    element.setPointerCapture(event.pointerId);
  }

  try {
    const result = await window.inventoryAPI.beginPropPlacement("poolRing");
    if (!result?.ok) {
      if (
        typeof element.hasPointerCapture === "function" &&
        element.hasPointerCapture(event.pointerId)
      ) {
        element.releasePointerCapture(event.pointerId);
      }
      setStatus(result?.error || "Pool ring placement could not start.", "warning");
      return;
    }
    activePlacement = {
      propId: "poolRing",
      pointerId: event.pointerId,
      element,
    };
    startPlacementPump();
    setStatus("Move the cursor over the desktop, then release to drop the pool ring.", "live");
    render();
  } catch (error) {
    if (
      typeof element.hasPointerCapture === "function" &&
      element.hasPointerCapture(event.pointerId)
    ) {
      element.releasePointerCapture(event.pointerId);
    }
    setStatus(error?.message || "Pool ring placement could not start.", "warning");
  }
}

function onPoolRingPointerUp(event) {
  if (!activePlacement || activePlacement.pointerId !== event.pointerId) return;
  void finishPlacement(true);
}

function onPoolRingPointerCancel(event) {
  if (!activePlacement || activePlacement.pointerId !== event.pointerId) return;
  void finishPlacement(false);
}

function onPoolRingPointerCaptureLoss(event) {
  if (!activePlacement || activePlacement.pointerId !== event.pointerId) return;
  void finishPlacement(true);
}

function syncShellState(payload) {
  latestShellState = normalizeShellState(payload);
  render();
}

async function initialize() {
  if (typeof window.inventoryAPI?.getShellState === "function") {
    try {
      const snapshot = await window.inventoryAPI.getShellState();
      syncShellState(snapshot);
    } catch {
      render();
    }
  } else {
    render();
  }

  if (typeof window.inventoryAPI?.onShellState === "function") {
    window.inventoryAPI.onShellState((payload) => {
      syncShellState(payload);
    });
  }
}

if (closeButton) {
  closeButton.addEventListener("click", async () => {
    if (activePlacement) {
      await finishPlacement(false);
    }
    window.close();
  });
}

if (headphonesToggle) {
  headphonesToggle.addEventListener("click", () => {
    void runShellAction(
      SHELL_ACTIONS.toggleHeadphones,
      latestShellState.wardrobe.hasHeadphones
        ? "Headphones removed from the pet."
        : "Headphones equipped on the pet.",
      "Headphones toggle failed."
    );
  });
}

if (roamDesktopButton) {
  roamDesktopButton.addEventListener("click", () => {
    void runShellAction(
      SHELL_ACTIONS.roamDesktop,
      "Desktop roam enabled.",
      "Desktop roam toggle failed."
    );
  });
}

if (roamZoneButton) {
  roamZoneButton.addEventListener("click", () => {
    void runShellAction(
      SHELL_ACTIONS.roamZone,
      latestShellState.roaming.zoneRect
        ? "Zone roam enabled."
        : "Draw a box on the desktop to set the roam zone.",
      "Zone roam toggle failed."
    );
  });
}

if (drawRoamZoneButton) {
  drawRoamZoneButton.addEventListener("click", () => {
    void runShellAction(
      SHELL_ACTIONS.selectRoamZone,
      "Draw a box on the desktop to set the roam zone.",
      "Zone selection could not start."
    );
  });
}

if (poolRingDragHandle) {
  poolRingDragHandle.addEventListener("pointerdown", beginPoolRingPlacement);
  poolRingDragHandle.addEventListener("pointerup", onPoolRingPointerUp);
  poolRingDragHandle.addEventListener("pointercancel", onPoolRingPointerCancel);
  poolRingDragHandle.addEventListener("lostpointercapture", onPoolRingPointerCaptureLoss);
}

if (poolRingRemoveButton) {
  poolRingRemoveButton.addEventListener("click", () => {
    void runShellAction(
      SHELL_ACTIONS.togglePoolRing,
      "Pool ring removed from the desktop.",
      "Pool ring removal failed."
    );
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    if (activePlacement) {
      void finishPlacement(false);
      return;
    }
    window.close();
  }
});

window.addEventListener("beforeunload", () => {
  stopPlacementPump();
});

void initialize();
