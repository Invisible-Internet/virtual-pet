const SHELL_ACTIONS = Object.freeze({
  roamDesktop: "roam-desktop",
  roamZone: "roam-zone",
  selectRoamZone: "select-roam-zone",
  toggleHeadphones: "toggle-headphones",
  togglePoolRing: "toggle-pool-ring",
});

const TAB_IDS = Object.freeze({
  inventory: "inventory",
  status: "status",
});

const DEFAULT_SHELL_STATE = Object.freeze({
  wardrobe: Object.freeze({ activeAccessories: Object.freeze([]), hasHeadphones: false }),
  inventory: Object.freeze({ quickProps: Object.freeze([]), hasPoolRing: false }),
  dialog: Object.freeze({ alwaysShowBubble: true }),
  roaming: Object.freeze({ mode: "desktop", zone: "desk-center", zoneRect: null }),
  inventoryUi: Object.freeze({ open: false, activeTab: TAB_IDS.inventory }),
  tray: Object.freeze({ available: false, supported: true, error: null }),
  devFallback: Object.freeze({
    enabled: true,
    hotkeys: Object.freeze(["F6", "F7", "F8", "F9", "F10"]),
  }),
});

const closeButton = document.getElementById("close-window");
const refreshButton = document.getElementById("refresh-observability");
const shellTitle = document.getElementById("shell-title");
const shellSubtitle = document.getElementById("shell-subtitle");
const trayBadge = document.getElementById("tray-badge");
const roamBadge = document.getElementById("roam-badge");
const statusLine = document.getElementById("status-line");
const tabInventoryButton = document.getElementById("tab-inventory");
const tabStatusButton = document.getElementById("tab-status");
const inventoryPanel = document.getElementById("tab-panel-inventory");
const statusPanel = document.getElementById("tab-panel-status");
const overviewContainer = document.getElementById("observability-overview");
const runtimeRowsContainer = document.getElementById("observability-runtime-rows");
const configRowsContainer = document.getElementById("observability-config-rows");
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
let latestObservabilitySnapshot = null;
let observabilityLoading = false;
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
  const inventoryUi =
    payload?.inventoryUi && typeof payload.inventoryUi === "object" ? payload.inventoryUi : {};
  const tray = payload?.tray && typeof payload.tray === "object" ? payload.tray : {};
  const devFallback =
    payload?.devFallback && typeof payload.devFallback === "object" ? payload.devFallback : {};
  const activeAccessories = normalizeStringArray(wardrobe.activeAccessories);
  const quickProps = normalizeStringArray(inventory.quickProps);
  const zoneRect =
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
      : null;
  return {
    wardrobe: { activeAccessories, hasHeadphones: activeAccessories.includes("headphones") },
    inventory: { quickProps, hasPoolRing: quickProps.includes("poolRing") },
    dialog: { alwaysShowBubble: dialog.alwaysShowBubble !== false },
    roaming: {
      mode: roaming.mode === "zone" ? "zone" : "desktop",
      zone: typeof roaming.zone === "string" && roaming.zone.trim() ? roaming.zone.trim() : "desk-center",
      zoneRect,
    },
    inventoryUi: {
      open: Boolean(inventoryUi.open),
      activeTab: inventoryUi.activeTab === TAB_IDS.status ? TAB_IDS.status : TAB_IDS.inventory,
    },
    tray: {
      available: Boolean(tray.available),
      supported: tray.supported !== false,
      error: typeof tray.error === "string" && tray.error.trim() ? tray.error.trim() : null,
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

function getActiveTab() {
  return latestShellState.inventoryUi.activeTab === TAB_IDS.status ? TAB_IDS.status : TAB_IDS.inventory;
}

function getRoamZoneLabel() {
  return latestShellState.roaming.zoneRect ? "custom" : latestShellState.roaming.zone;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatText(value, fallback = "Unavailable") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function formatReason(value) {
  const text = formatText(value, "unknown").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
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
    if (getActiveTab() === TAB_IDS.status) {
      message = "Refresh re-reads bridge, memory, path, and canonical file health.";
    } else if (latestShellState.roaming.mode === "zone" && !latestShellState.roaming.zoneRect) {
      message = "Draw a roam zone to keep the pet moving inside a marquee area.";
      tone = "warning";
    } else if (latestShellState.tray.available) {
      message = "Drag the pool ring icon out of this window to place it on the desktop.";
    } else {
      message = `Tray unavailable. Fallback hotkeys: ${latestShellState.devFallback.hotkeys.join(", ")}.`;
      tone = "warning";
    }
  }
  statusLine.textContent = message;
  statusLine.dataset.tone = tone;
}

function renderHeader() {
  const statusTab = getActiveTab() === TAB_IDS.status;
  if (shellTitle) shellTitle.textContent = statusTab ? "Status" : "Inventory";
  if (shellSubtitle) {
    shellSubtitle.textContent = statusTab
      ? "Bridge, memory, canonical files, and runtime path visibility."
      : "Wardrobe, roaming, and trusted prop controls.";
  }
  if (refreshButton) refreshButton.hidden = !statusTab;
}

function renderTabs() {
  const activeTab = getActiveTab();
  if (tabInventoryButton) {
    tabInventoryButton.classList.toggle("is-active", activeTab === TAB_IDS.inventory);
    tabInventoryButton.setAttribute("aria-pressed", String(activeTab === TAB_IDS.inventory));
  }
  if (tabStatusButton) {
    tabStatusButton.classList.toggle("is-active", activeTab === TAB_IDS.status);
    tabStatusButton.setAttribute("aria-pressed", String(activeTab === TAB_IDS.status));
  }
  if (inventoryPanel) inventoryPanel.classList.toggle("is-active", activeTab === TAB_IDS.inventory);
  if (statusPanel) statusPanel.classList.toggle("is-active", activeTab === TAB_IDS.status);
}

function buildDetailRow(label, value) {
  return `<div class="settings-detail-row"><span class="settings-detail-label">${escapeHtml(label)}</span><span class="settings-detail-value">${escapeHtml(value)}</span></div>`;
}

function buildSettingsCard(label, row, details) {
  const detailMarkup = details.map((entry) => buildDetailRow(entry.label, entry.value)).join("");
  return `<article class="settings-card"><div class="settings-card-header"><div><h3>${escapeHtml(label)}</h3><span class="settings-card-note">${escapeHtml(formatReason(row.reason))}</span></div><span class="state-pill" data-state="${escapeHtml(row.state)}">${escapeHtml(row.state)}</span></div><div class="settings-detail-list">${detailMarkup}</div></article>`;
}

function renderObservability() {
  if (!latestObservabilitySnapshot) {
    if (overviewContainer) overviewContainer.innerHTML = "";
    const placeholder = '<article class="settings-card"><h3>Waiting For Refresh</h3><span class="settings-card-note">Open the Status tab and press Refresh to load the first observability snapshot.</span></article>';
    if (runtimeRowsContainer) runtimeRowsContainer.innerHTML = placeholder;
    if (configRowsContainer) configRowsContainer.innerHTML = placeholder;
    return;
  }
  const rows = latestObservabilitySnapshot.rows || {};
  if (overviewContainer) {
    overviewContainer.innerHTML = [
      { label: `Runtime ${formatText(latestObservabilitySnapshot.overview?.runtimeState, "unknown")}`, state: latestObservabilitySnapshot.overview?.runtimeState || "unknown" },
      { label: `Fallback ${formatText(latestObservabilitySnapshot.overview?.fallbackMode, "none")}`, state: latestObservabilitySnapshot.overview?.fallbackMode === "none" ? "healthy" : "degraded" },
      { label: latestObservabilitySnapshot.overview?.trayAvailable ? "Tray Ready" : "Fallback Mode", state: latestObservabilitySnapshot.overview?.trayAvailable ? "healthy" : "degraded" },
    ].map((entry) => `<span class="state-pill" data-state="${escapeHtml(entry.state)}">${escapeHtml(entry.label)}</span>`).join("");
  }
  if (runtimeRowsContainer) {
    runtimeRowsContainer.innerHTML = [
      buildSettingsCard("OpenClaw Bridge", rows.bridge || {}, [
        { label: "Transport", value: formatText(rows.bridge?.transport, "unknown") },
        { label: "Mode", value: formatText(rows.bridge?.mode, "unknown") },
        { label: "Endpoint", value: formatText(rows.bridge?.endpoint, "Stub / None") },
        { label: "Auth", value: rows.bridge?.authConfigured ? "Configured" : "Not configured" },
      ]),
      buildSettingsCard("Provider / Model", rows.provider || {}, [
        { label: "Provider", value: formatText(rows.provider?.providerLabel, "Unavailable") },
        { label: "Model", value: formatText(rows.provider?.modelLabel, "Unavailable") },
        { label: "Source", value: formatText(rows.provider?.source, "unknown") },
        { label: "Agent", value: formatText(rows.provider?.agentId, "Unavailable") },
      ]),
      buildSettingsCard("Memory Runtime", rows.memory || {}, [
        { label: "Requested", value: formatText(rows.memory?.requestedAdapterMode, "unknown") },
        { label: "Active", value: formatText(rows.memory?.activeAdapterMode, "unknown") },
        { label: "Fallback", value: formatText(rows.memory?.fallbackReason, "none") },
        { label: "Legacy JSONL", value: rows.memory?.writeLegacyJsonl ? "Enabled" : "Disabled" },
      ]),
    ].join("");
  }
  if (configRowsContainer) {
    const localFiles = rows.canonicalFiles?.localWorkspace?.files || [];
    const openClawFiles = rows.canonicalFiles?.openClawWorkspace?.files || [];
    configRowsContainer.innerHTML = [
      buildSettingsCard("Canonical Files", rows.canonicalFiles || {}, [
        { label: "Local Workspace", value: `${rows.canonicalFiles?.localWorkspace?.readableCount || 0}/${localFiles.length} readable` },
        { label: "OpenClaw Workspace", value: rows.canonicalFiles?.openClawWorkspace?.configured ? `${rows.canonicalFiles?.openClawWorkspace?.readableCount || 0}/${openClawFiles.length} readable` : "Not configured" },
        { label: "Local Root", value: formatText(rows.canonicalFiles?.localWorkspace?.root, "Unavailable") },
        { label: "OpenClaw Root", value: formatText(rows.canonicalFiles?.openClawWorkspace?.root, "Unavailable") },
      ]),
      buildSettingsCard("Paths / Sources", rows.paths || {}, [
        { label: "Local Root", value: formatText(rows.paths?.localWorkspaceRoot, "Unavailable") },
        { label: "OpenClaw Root", value: formatText(rows.paths?.openClawWorkspaceRoot, "Unavailable") },
        { label: "Obsidian Root", value: formatText(rows.paths?.obsidianVaultRoot, "Unavailable") },
        { label: "Active Layers", value: (rows.paths?.activeLayers || []).join(", ") || "base" },
      ]),
      buildSettingsCard("Validation", rows.validation || {}, [
        { label: "Warnings", value: String(rows.validation?.warningCount ?? 0) },
        { label: "Errors", value: String(rows.validation?.errorCount ?? 0) },
        { label: "First Warning", value: formatText(rows.validation?.warnings?.[0], "None") },
        { label: "First Error", value: formatText(rows.validation?.errors?.[0], "None") },
      ]),
    ].join("");
  }
}

function render() {
  renderHeader();
  renderTabs();
  if (roamBadge) roamBadge.textContent = latestShellState.roaming.mode === "zone" ? `Roam: Zone (${getRoamZoneLabel()})` : "Roam: Desktop";
  if (trayBadge) {
    trayBadge.textContent = latestShellState.tray.available ? "Tray Ready" : "Fallback Mode";
    trayBadge.dataset.tone = latestShellState.tray.available ? "ok" : "warning";
  }
  if (roamDesktopButton) roamDesktopButton.classList.toggle("is-active", latestShellState.roaming.mode === "desktop");
  if (roamDesktopChip) roamDesktopChip.textContent = latestShellState.roaming.mode === "desktop" ? "Active" : "Idle";
  if (roamZoneButton) roamZoneButton.classList.toggle("is-active", latestShellState.roaming.mode === "zone");
  if (roamZoneChip) roamZoneChip.textContent = latestShellState.roaming.mode === "zone" ? (latestShellState.roaming.zoneRect ? "Custom" : "Pending") : "Zone";
  if (headphonesToggle) headphonesToggle.classList.toggle("is-active", latestShellState.wardrobe.hasHeadphones);
  if (headphonesChip) headphonesChip.textContent = latestShellState.wardrobe.hasHeadphones ? "Equipped" : "Stowed";
  if (poolRingDragHandle) {
    poolRingDragHandle.classList.toggle("is-active", latestShellState.inventory.hasPoolRing);
    poolRingDragHandle.classList.toggle("is-dragging", Boolean(activePlacement));
  }
  if (poolRingChip) poolRingChip.textContent = activePlacement ? "Placing" : latestShellState.inventory.hasPoolRing ? "On Desktop" : "Stowed";
  if (poolRingRemoveButton) poolRingRemoveButton.disabled = !latestShellState.inventory.hasPoolRing;
  if (refreshButton) refreshButton.disabled = observabilityLoading;
  renderStatus();
  renderObservability();
}

async function refreshObservability(successMessage = "Status refreshed.") {
  if (typeof window.inventoryAPI?.getObservabilitySnapshot !== "function") return;
  observabilityLoading = true;
  render();
  try {
    latestObservabilitySnapshot = await window.inventoryAPI.getObservabilitySnapshot();
    setStatus(successMessage, "ok");
  } catch (error) {
    setStatus(error?.message || "Status refresh failed.", "warning");
  } finally {
    observabilityLoading = false;
    render();
  }
}

async function switchTab(tabId) {
  if (typeof window.inventoryAPI?.setActiveTab !== "function") return;
  try {
    const result = await window.inventoryAPI.setActiveTab(tabId);
    if (result?.shellState) syncShellState(result.shellState);
  } catch (error) {
    setStatus(error?.message || "Tab switch failed.", "warning");
  }
}

async function runShellAction(actionId, successMessage, failureMessage) {
  try {
    const result = await window.inventoryAPI.runShellAction(actionId);
    if (!result?.ok) {
      setStatus(failureMessage || result?.error || "Shell action failed.", "warning");
      return;
    }
    if (result.shellState) syncShellState(result.shellState);
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
  if (placement.element?.hasPointerCapture?.(placement.pointerId)) {
    placement.element.releasePointerCapture(placement.pointerId);
  }
  try {
    const result = await window.inventoryAPI.endPropPlacement(placement.propId, commit);
    setStatus(result?.ok ? (commit ? "Pool ring placed. Drag the prop window later to reposition it." : "Pool ring placement cancelled.") : result?.error || "Pool ring placement failed.", result?.ok ? (commit ? "ok" : "muted") : "warning");
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
  element.setPointerCapture?.(event.pointerId);
  try {
    const result = await window.inventoryAPI.beginPropPlacement("poolRing");
    if (!result?.ok) {
      if (element.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture(event.pointerId);
      setStatus(result?.error || "Pool ring placement could not start.", "warning");
      return;
    }
    activePlacement = { propId: "poolRing", pointerId: event.pointerId, element };
    startPlacementPump();
    setStatus("Move the cursor over the desktop, then release to drop the pool ring.", "live");
    render();
  } catch (error) {
    if (element.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture(event.pointerId);
    setStatus(error?.message || "Pool ring placement could not start.", "warning");
  }
}

function syncShellState(payload) {
  const previousTab = getActiveTab();
  latestShellState = normalizeShellState(payload);
  render();
  if (getActiveTab() === TAB_IDS.status && (previousTab !== TAB_IDS.status || !latestObservabilitySnapshot)) {
    void refreshObservability("Status loaded.");
  }
}

async function initialize() {
  try {
    if (typeof window.inventoryAPI?.getShellState === "function") {
      syncShellState(await window.inventoryAPI.getShellState());
    } else {
      render();
    }
  } catch {
    render();
  }
  window.inventoryAPI?.onShellState?.((payload) => {
    syncShellState(payload);
  });
}

closeButton?.addEventListener("click", async () => {
  if (activePlacement) await finishPlacement(false);
  window.close();
});
refreshButton?.addEventListener("click", () => {
  void refreshObservability("Status refreshed.");
});
tabInventoryButton?.addEventListener("click", () => {
  void switchTab(TAB_IDS.inventory);
});
tabStatusButton?.addEventListener("click", () => {
  void switchTab(TAB_IDS.status);
});
headphonesToggle?.addEventListener("click", () => {
  void runShellAction(SHELL_ACTIONS.toggleHeadphones, latestShellState.wardrobe.hasHeadphones ? "Headphones removed from the pet." : "Headphones equipped on the pet.", "Headphones toggle failed.");
});
roamDesktopButton?.addEventListener("click", () => {
  void runShellAction(SHELL_ACTIONS.roamDesktop, "Desktop roam enabled.", "Desktop roam toggle failed.");
});
roamZoneButton?.addEventListener("click", () => {
  void runShellAction(SHELL_ACTIONS.roamZone, latestShellState.roaming.zoneRect ? "Zone roam enabled." : "Draw a box on the desktop to set the roam zone.", "Zone roam toggle failed.");
});
drawRoamZoneButton?.addEventListener("click", () => {
  void runShellAction(SHELL_ACTIONS.selectRoamZone, "Draw a box on the desktop to set the roam zone.", "Zone selection could not start.");
});
poolRingDragHandle?.addEventListener("pointerdown", beginPoolRingPlacement);
poolRingDragHandle?.addEventListener("pointerup", (event) => {
  if (activePlacement?.pointerId === event.pointerId) void finishPlacement(true);
});
poolRingDragHandle?.addEventListener("pointercancel", (event) => {
  if (activePlacement?.pointerId === event.pointerId) void finishPlacement(false);
});
poolRingDragHandle?.addEventListener("lostpointercapture", (event) => {
  if (activePlacement?.pointerId === event.pointerId) void finishPlacement(true);
});
poolRingRemoveButton?.addEventListener("click", () => {
  void runShellAction(SHELL_ACTIONS.togglePoolRing, "Pool ring removed from the desktop.", "Pool ring removal failed.");
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  if (activePlacement) {
    void finishPlacement(false);
    return;
  }
  window.close();
});

window.addEventListener("beforeunload", () => {
  stopPlacementPump();
});

void initialize();
