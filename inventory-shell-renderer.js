const SHELL_ACTIONS = Object.freeze({
  openSetup: "open-setup",
  openSettings: "open-settings",
  roamDesktop: "roam-desktop",
  roamZone: "roam-zone",
  selectRoamZone: "select-roam-zone",
  toggleHeadphones: "toggle-headphones",
  togglePoolRing: "toggle-pool-ring",
});

const TAB_IDS = Object.freeze({
  inventory: "inventory",
  status: "status",
  setup: "setup",
  settings: "settings",
});
const OBSERVABILITY_SUBJECT_IDS = Object.freeze({
  bridge: "bridge",
  provider: "provider",
  memory: "memory",
  canonicalFiles: "canonicalFiles",
  paths: "paths",
  validation: "validation",
});
const OBSERVABILITY_ACTION_IDS = Object.freeze({
  refreshStatus: "refresh_status",
  openSetup: "open_setup",
  copyPath: "copy_path",
  copyDetails: "copy_details",
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
    hotkeys: Object.freeze(["F6", "F7", "F8", "F9", "F10", "F11"]),
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
const tabSetupButton = document.getElementById("tab-setup");
const tabSettingsButton = document.getElementById("tab-settings");
const inventoryPanel = document.getElementById("tab-panel-inventory");
const statusPanel = document.getElementById("tab-panel-status");
const setupPanel = document.getElementById("tab-panel-setup");
const settingsPanel = document.getElementById("tab-panel-settings");
const overviewContainer = document.getElementById("observability-overview");
const runtimeRowsContainer = document.getElementById("observability-runtime-rows");
const configRowsContainer = document.getElementById("observability-config-rows");
const observabilityDetailContainer = document.getElementById("observability-detail");
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
const setupTargets = document.getElementById("setup-targets");
const setupPresets = document.getElementById("setup-presets");
const setupPetName = document.getElementById("setup-pet-name");
const setupBirthday = document.getElementById("setup-birthday");
const setupCompanionName = document.getElementById("setup-companion-name");
const setupCompanionTimezone = document.getElementById("setup-companion-timezone");
const setupStarterNote = document.getElementById("setup-starter-note");
const setupCompanionCallName = document.getElementById("setup-companion-call-name");
const setupUserGender = document.getElementById("setup-user-gender");
const setupCreatureLabel = document.getElementById("setup-creature-label");
const setupPetGender = document.getElementById("setup-pet-gender");
const setupSignatureEmoji = document.getElementById("setup-signature-emoji");
const setupAvatarPath = document.getElementById("setup-avatar-path");
const setupAvatarBrowseButton = document.getElementById("setup-avatar-browse");
const setupAvatarFileInput = document.getElementById("setup-avatar-file");
const setupSeedHeartbeat = document.getElementById("setup-seed-heartbeat");
const setupReloadTargetsButton = document.getElementById("setup-reload-targets");
const setupPreviewButton = document.getElementById("setup-preview");
const setupApplyButton = document.getElementById("setup-apply");
const setupPreviewTabs = document.getElementById("setup-preview-tabs");
const setupPreviewCopy = document.getElementById("setup-preview-copy");
const setupPreviewMarkdown = document.getElementById("setup-preview-markdown");
const setupResult = document.getElementById("setup-result");
const shellSettingsEditor = document.getElementById("shell-settings-editor");
const hoverHintText = document.getElementById("hover-hint-text");

const SETUP_ERROR_MESSAGES = Object.freeze({
  pet_name_required: "Please type a Pet Name.",
  birthday_required: "Please type a Pet Birthday.",
  companion_name_required: "Please type Your Name.",
  companion_timezone_required: "Please type Your Timezone.",
});

const HOVER_HINTS_BY_ID = Object.freeze({
  "tab-inventory": "Open the Inventory tools tab.",
  "tab-status": "Open live status and health checks.",
  "tab-setup": "Open setup to fill in pet details.",
  "tab-settings": "Open advanced runtime settings controls.",
  "refresh-observability": "Refresh status now.",
  "close-window": "Close this shell window.",
  "roam-desktop": "Let the pet roam anywhere on your desktop.",
  "roam-zone": "Keep the pet inside a selected zone.",
  "draw-roam-zone": "Draw a custom roam zone on the desktop.",
  "toggle-headphones": "Put headphones on or take them off.",
  "drag-pool-ring": "Drag this to place the pool ring on your desktop.",
  "remove-pool-ring": "Return the pool ring to inventory.",
  "setup-pet-name": "Type your pet's name.",
  "setup-birthday": "Type your pet's birthday.",
  "setup-companion-name": "Type your real name.",
  "setup-user-gender": "Choose boy or girl to set your pronouns.",
  "setup-companion-timezone": "Type your timezone.",
  "setup-starter-note": "Add a short note about yourself.",
  "setup-companion-call-name": "How your pet should call you.",
  "setup-creature-label": "Type what kind of creature your pet is.",
  "setup-pet-gender": "Choose your pet's pronouns: boy, girl, or thing.",
  "setup-signature-emoji": "Pick a safe emoji from the list.",
  "setup-avatar-path": "Selected avatar file path.",
  "setup-avatar-browse": "Browse for a pet avatar image.",
  "setup-seed-heartbeat": "Create an empty HEARTBEAT file (advanced).",
  "setup-reload-targets": "Reload target folders before preview or save.",
  "setup-preview": "Build a preview. Nothing is saved yet.",
  "setup-apply": "Save setup files to your local pet folder.",
});
const CHARACTER_SCALE_FIELD_KEY = "ui.characterScalePercent";
const CHARACTER_SCALE_SLIDER_MIN = 0;
const CHARACTER_SCALE_SLIDER_MAX = 1;
const CHARACTER_SCALE_SLIDER_STEP = 0.01;
const CHARACTER_SCALE_PERCENT_MIN = 50;
const CHARACTER_SCALE_PERCENT_MAX = 200;
const CHARACTER_SCALE_PERCENT_DEFAULT = 100;

let latestShellState = { ...DEFAULT_SHELL_STATE };
let latestObservabilitySnapshot = null;
let latestObservabilityDetail = null;
let latestSetupSnapshot = null;
let latestSetupPreview = null;
let latestShellSettingsSnapshot = null;
let shellSettingsDraft = {};
let setupLoading = false;
let setupApplying = false;
let shellSettingsLoading = false;
let shellSettingsSaving = false;
let shellSettingsDirty = false;
let setupDirty = true;
let activeSetupPreviewFileId = "SOUL.md";
let activeObservabilitySubjectId = OBSERVABILITY_SUBJECT_IDS.bridge;
let observabilityLoading = false;
let statusTone = "muted";
let statusMessage = "";
let hoverHintMessage = "";
let activePlacement = null;
let placementTimer = null;

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function characterScaleNormalizedToPercent(rawValue) {
  const normalized = clampNumber(
    rawValue,
    CHARACTER_SCALE_SLIDER_MIN,
    CHARACTER_SCALE_SLIDER_MAX
  );
  const ratio = Math.pow(2, normalized * 2 - 1);
  const percent = Math.round(ratio * 100);
  return clampNumber(percent, CHARACTER_SCALE_PERCENT_MIN, CHARACTER_SCALE_PERCENT_MAX);
}

function characterScalePercentToNormalized(rawValue) {
  const percent = clampNumber(
    rawValue,
    CHARACTER_SCALE_PERCENT_MIN,
    CHARACTER_SCALE_PERCENT_MAX
  );
  const ratio = percent / CHARACTER_SCALE_PERCENT_DEFAULT;
  const normalized = (Math.log2(ratio) + 1) / 2;
  return clampNumber(normalized, CHARACTER_SCALE_SLIDER_MIN, CHARACTER_SCALE_SLIDER_MAX);
}

function formatCharacterScaleValue(rawPercent) {
  const percent = clampNumber(
    rawPercent,
    CHARACTER_SCALE_PERCENT_MIN,
    CHARACTER_SCALE_PERCENT_MAX
  );
  const slider = characterScalePercentToNormalized(percent);
  return `${slider.toFixed(2)} (${percent}%)`;
}

function buildCharacterScaleReadout(rawSliderValue) {
  const normalized = clampNumber(
    rawSliderValue,
    CHARACTER_SCALE_SLIDER_MIN,
    CHARACTER_SCALE_SLIDER_MAX
  );
  return `Current: ${normalized.toFixed(2)} (${characterScaleNormalizedToPercent(normalized)}%)`;
}

function refreshShellSettingsActionButtons() {
  if (!shellSettingsEditor) return;
  const reloadButton = shellSettingsEditor.querySelector(
    '[data-shell-settings-action="reload"]'
  );
  const resetButton = shellSettingsEditor.querySelector(
    '[data-shell-settings-action="reset"]'
  );
  const saveButton = shellSettingsEditor.querySelector(
    '[data-shell-settings-action="save"]'
  );
  if (reloadButton) {
    reloadButton.disabled = shellSettingsLoading || shellSettingsSaving;
  }
  if (resetButton) {
    resetButton.disabled =
      shellSettingsLoading || shellSettingsSaving || !shellSettingsDirty;
  }
  if (saveButton) {
    saveButton.disabled =
      shellSettingsLoading || shellSettingsSaving || !shellSettingsDirty;
  }
}

function updateCharacterScaleReadout(controlElement) {
  if (!controlElement) return;
  const key = controlElement.dataset?.shellSettingKey;
  if (key !== CHARACTER_SCALE_FIELD_KEY) return;
  const setupField = controlElement.closest(".setup-field");
  const readout = setupField?.querySelector?.(
    `[data-shell-setting-readout="${CHARACTER_SCALE_FIELD_KEY}"]`
  );
  if (!readout) return;
  readout.textContent = buildCharacterScaleReadout(controlElement.value);
}

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
      activeTab:
        inventoryUi.activeTab === TAB_IDS.status
          ? TAB_IDS.status
          : inventoryUi.activeTab === TAB_IDS.setup
            ? TAB_IDS.setup
            : inventoryUi.activeTab === TAB_IDS.settings
              ? TAB_IDS.settings
            : TAB_IDS.inventory,
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
  if (latestShellState.inventoryUi.activeTab === TAB_IDS.status) return TAB_IDS.status;
  if (latestShellState.inventoryUi.activeTab === TAB_IDS.setup) return TAB_IDS.setup;
  if (latestShellState.inventoryUi.activeTab === TAB_IDS.settings) return TAB_IDS.settings;
  return TAB_IDS.inventory;
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

function escapeCode(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function formatSettingsSource(value) {
  const normalized = formatText(value, "").toLowerCase();
  if (!normalized || normalized === "unknown") return "Not set in config or environment";
  if (normalized === "baseconfig") return "Base settings file";
  if (normalized === "localconfig") return "Local settings file";
  if (normalized === "runtimeconfig") return "Runtime settings";
  if (normalized === "env") return "Environment variable";
  return formatReason(value);
}

function formatOwnershipLabel(value) {
  const normalized = formatText(value, "").toLowerCase();
  if (normalized === "local_managed") return "Local file managed by Setup";
  if (normalized === "local_unmanaged") return "Local file managed outside Setup";
  if (normalized === "observed_only") return "Read-only observed workspace";
  if (normalized === "manual_runtime") return "Manual runtime/config fix";
  return formatReason(value);
}

function formatRepairabilityLabel(value) {
  const normalized = formatText(value, "").toLowerCase();
  if (normalized === "guided") return "Guided fix in app";
  if (normalized === "manual") return "Manual fix outside app";
  if (normalized === "observed_only") return "Observed only (read-only)";
  if (normalized === "refresh_only") return "Refresh only";
  return formatReason(value);
}

function formatStatusDetailValue(value) {
  const normalized = formatText(value, "").toLowerCase();
  if (!normalized || normalized === "unknown") return "Not available yet";
  if (normalized === "pet-local canonical source") return "Local pet files (managed here)";
  if (normalized === "observed openclaw workspace context") return "OpenClaw files (read-only view)";
  if (normalized === "present") return "Found and readable";
  if (normalized === "file_missing") return "Missing file";
  if (normalized === "file_unreadable") return "Found but unreadable";
  if (normalized === "root_missing") return "Folder is missing";
  if (normalized === "root_not_configured") return "Folder is not configured";
  if (normalized === "root_not_directory") return "Path is not a folder";
  if (normalized === "managed_block_present") return "Setup block found";
  if (normalized === "managed_block_missing") return "Setup block missing";
  if (normalized === "managed_block_unreadable") return "Could not read setup block";
  if (normalized === "not_checked") return "Not checked yet";
  return formatReason(value);
}

function normalizeShellSettingsSnapshot(payload = {}) {
  const rawFields = Array.isArray(payload?.fields) ? payload.fields : [];
  const fields = rawFields
    .map((field) => {
      if (!field || typeof field !== "object") return null;
      const key = formatText(field.key, "");
      const kind = formatText(field.kind, "");
      if (!key || (kind !== "boolean" && kind !== "integer")) return null;
      const validation =
        kind === "integer"
          ? {
              kind: "integer",
              min: Number.isFinite(Number(field?.validation?.min))
                ? Math.round(Number(field.validation.min))
                : 0,
              max: Number.isFinite(Number(field?.validation?.max))
                ? Math.round(Number(field.validation.max))
                : 100,
            }
          : { kind: "boolean" };
      const value =
        kind === "boolean"
          ? field.value === true
          : Number.isFinite(Number(field.value))
            ? Math.round(Number(field.value))
            : 0;
      const effectiveValue =
        kind === "boolean"
          ? field.effectiveValue === true
          : Number.isFinite(Number(field.effectiveValue))
            ? Math.round(Number(field.effectiveValue))
            : value;
      return {
        key,
        label: formatText(field.label, key),
        description: formatText(field.description, ""),
        kind,
        editable: field.editable !== false,
        value,
        effectiveValue,
        source: formatText(field.source, "base"),
        envOverridden: field.envOverridden === true,
        validation,
      };
    })
    .filter(Boolean);
  return {
    kind: "shellSettingsSnapshot",
    ts: Number.isFinite(Number(payload?.ts)) ? Number(payload.ts) : Date.now(),
    overridePath: formatText(payload?.overridePath, "Unavailable"),
    warnings: Array.isArray(payload?.warnings)
      ? payload.warnings.map((entry) => formatText(entry, "")).filter(Boolean)
      : [],
    fields,
  };
}

function coerceShellSettingsFieldValue(field, rawValue) {
  if (!field) return rawValue;
  if (field.kind === "boolean") {
    if (typeof rawValue === "boolean") return rawValue;
    const normalized = formatText(rawValue, "").toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
      return true;
    }
    if (
      normalized === "false" ||
      normalized === "0" ||
      normalized === "no" ||
      normalized === "off"
    ) {
      return false;
    }
    return field.value === true;
  }
  if (field.kind === "integer") {
    if (field.key === CHARACTER_SCALE_FIELD_KEY) {
      const numeric = Number(rawValue);
      if (!Number.isFinite(numeric)) return field.value;
      if (numeric < CHARACTER_SCALE_SLIDER_MIN || numeric > CHARACTER_SCALE_SLIDER_MAX) {
        return Math.round(
          clampNumber(
            numeric,
            CHARACTER_SCALE_PERCENT_MIN,
            CHARACTER_SCALE_PERCENT_MAX
          )
        );
      }
      return characterScaleNormalizedToPercent(numeric);
    }
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) return field.value;
    return Math.round(numeric);
  }
  return rawValue;
}

function syncShellSettingsDraftFromSnapshot() {
  shellSettingsDraft = {};
  const fields = latestShellSettingsSnapshot?.fields || [];
  for (const field of fields) {
    shellSettingsDraft[field.key] = field.value;
  }
  shellSettingsDirty = false;
}

function getShellSettingsFieldByKey(key) {
  const fields = latestShellSettingsSnapshot?.fields || [];
  return fields.find((field) => field.key === key) || null;
}

function renderShellSettingsEditor() {
  if (!shellSettingsEditor) return;
  if (!latestShellSettingsSnapshot) {
    shellSettingsEditor.innerHTML =
      '<h3>Loading Advanced Settings</h3><span class="setup-card-copy">Open Settings to load editable values.</span>';
    return;
  }
  const fields = latestShellSettingsSnapshot.fields || [];
  const fieldMarkup = fields
    .map((field) => {
      const draftValue = Object.prototype.hasOwnProperty.call(shellSettingsDraft, field.key)
        ? shellSettingsDraft[field.key]
        : field.value;
      const controlMarkup =
        field.kind === "boolean"
          ? `<select class="setup-select" data-shell-setting-key="${escapeHtml(field.key)}" ${
              field.editable ? "" : "disabled"
            }>
              <option value="true" ${draftValue === true ? "selected" : ""}>Enabled</option>
              <option value="false" ${draftValue === false ? "selected" : ""}>Disabled</option>
            </select>`
          : field.key === CHARACTER_SCALE_FIELD_KEY
            ? `<div class="setup-slider-wrap">
                <input class="setup-slider" type="range" step="${CHARACTER_SCALE_SLIDER_STEP}" data-shell-setting-key="${escapeHtml(
                  field.key
                )}" min="${CHARACTER_SCALE_SLIDER_MIN}" max="${CHARACTER_SCALE_SLIDER_MAX}" list="character-scale-ticks" value="${Math.round(
                  characterScalePercentToNormalized(draftValue) * 100
                ) / 100}" ${field.editable ? "" : "disabled"} />
                <datalist id="character-scale-ticks">
                  <option value="0" label="0"></option>
                  <option value="0.25" label="25"></option>
                  <option value="0.5" label="50"></option>
                  <option value="0.75" label="75"></option>
                  <option value="1" label="100"></option>
                </datalist>
                <div class="setup-slider-ticks" aria-hidden="true">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100</span>
                </div>
                <span class="setup-card-copy" data-shell-setting-readout="${escapeHtml(
                  field.key
                )}">${escapeHtml(buildCharacterScaleReadout(characterScalePercentToNormalized(draftValue)))}</span>
              </div>`
            : `<input class="setup-input" type="number" step="1" data-shell-setting-key="${escapeHtml(
                field.key
              )}" min="${escapeHtml(field.validation.min)}" max="${escapeHtml(
                field.validation.max
              )}" value="${escapeHtml(draftValue)}" ${field.editable ? "" : "disabled"} />`;
      const sourceLabel = formatSettingsSource(field.source);
      const effectiveValueLabel =
        field.kind === "boolean"
          ? field.effectiveValue === true
            ? "Enabled"
            : "Disabled"
          : field.key === CHARACTER_SCALE_FIELD_KEY
            ? formatCharacterScaleValue(field.effectiveValue)
            : `${field.effectiveValue}%`;
      const savedValueLabel =
        field.kind === "boolean"
          ? field.value === true
            ? "Enabled"
            : "Disabled"
          : field.key === CHARACTER_SCALE_FIELD_KEY
            ? formatCharacterScaleValue(field.value)
            : `${field.value}%`;
      const descriptionMarkup =
        field.key === CHARACTER_SCALE_FIELD_KEY || !field.description
          ? ""
          : `<span class="setup-card-copy">${escapeHtml(field.description)}</span>`;
      const valueRows =
        field.envOverridden
          ? `${buildDetailRow("Saved Value", savedValueLabel)}${buildDetailRow("Effective Value", effectiveValueLabel)}`
          : buildDetailRow("Value", effectiveValueLabel);
      return `<div class="setup-field">
        <span class="setup-label">${escapeHtml(field.label)}</span>
        ${controlMarkup}
        ${descriptionMarkup}
        <div class="settings-detail-list">
          ${valueRows}
          ${buildDetailRow("Source", sourceLabel)}
          ${buildDetailRow("Env Override", field.envOverridden ? "Active" : "None")}
        </div>
      </div>`;
    })
    .join("");

  const warnings = latestShellSettingsSnapshot.warnings || [];
  const warningMarkup =
    warnings.length > 0
      ? `<ul class="detail-list">${warnings
          .map((warning) => `<li>${escapeHtml(warning)}</li>`)
          .join("")}</ul>`
      : '<span class="setup-card-copy">No settings parse warnings.</span>';

  shellSettingsEditor.innerHTML = [
    "<h3>Advanced Settings</h3>",
    '<span class="setup-card-copy">Save writes only bounded keys to your runtime override file.</span>',
    `<div class="settings-detail-list">${buildDetailRow(
      "Override File",
      formatText(latestShellSettingsSnapshot.overridePath, "Unavailable")
    )}</div>`,
    `<div class="setup-form-grid">${fieldMarkup}</div>`,
    '<h4>Warnings</h4>',
    warningMarkup,
    `<div class="setup-actions">
      <button class="setup-action-button" type="button" data-shell-settings-action="reload" ${
        shellSettingsLoading || shellSettingsSaving ? "disabled" : ""
      }>Reload Settings</button>
      <button class="setup-action-button" type="button" data-shell-settings-action="reset" ${
        shellSettingsLoading || shellSettingsSaving || !shellSettingsDirty ? "disabled" : ""
      }>Reset Unsaved</button>
      <button class="setup-action-button" type="button" data-shell-settings-action="save" ${
        shellSettingsLoading || shellSettingsSaving || !shellSettingsDirty ? "disabled" : ""
      }>Save Settings</button>
    </div>`,
  ].join("");
  refreshShellSettingsActionButtons();
}

function formatProvenanceEntryValue(entry) {
  if (entry?.kind === "settings") return formatSettingsSource(entry?.value);
  return formatStatusDetailValue(entry?.value);
}

function getDefaultHoverHint() {
  const activeTab = getActiveTab();
  if (activeTab === TAB_IDS.status) {
    return "Press Refresh to reload health rows.";
  }
  if (activeTab === TAB_IDS.setup) {
    return "Fill details, press Preview, then press Save Setup.";
  }
  if (activeTab === TAB_IDS.settings) {
    return "Adjust advanced settings, then press Save Settings.";
  }
  return "Open a card to control roaming, accessories, or props.";
}

function renderHoverHint() {
  if (!hoverHintText) return;
  const hint = hoverHintMessage || getDefaultHoverHint();
  hoverHintText.textContent = `Hint: ${hint}`;
}

function setHoverHint(message) {
  const normalized = typeof message === "string" ? message.trim() : "";
  if (normalized === hoverHintMessage) return;
  hoverHintMessage = normalized;
  renderHoverHint();
}

function getSetupFieldHint(element) {
  const field = element?.closest?.(".setup-field");
  const label = field?.querySelector?.(".setup-label")?.textContent?.trim();
  if (!label) return "";
  return `${label}: enter a value for this field.`;
}

function resolveHoverHint(startElement) {
  let element = startElement instanceof Element ? startElement : null;
  while (element && element !== document.body) {
    const explicitHint = element.dataset?.hint;
    if (explicitHint && explicitHint.trim()) return explicitHint.trim();
    if (element.id && HOVER_HINTS_BY_ID[element.id]) return HOVER_HINTS_BY_ID[element.id];
    if (element.matches?.("input, select, textarea")) {
      const setupHint = getSetupFieldHint(element);
      if (setupHint) return setupHint;
    }
    const ariaLabel = element.getAttribute?.("aria-label");
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
    const title = element.getAttribute?.("title");
    if (title && title.trim()) return title.trim();
    if (element.matches?.("button")) {
      const buttonText = element.textContent?.trim();
      if (buttonText) return `${buttonText}: click to use this control.`;
    }
    element = element.parentElement;
  }
  return "";
}

function wireHoverHints() {
  document.addEventListener("pointermove", (event) => {
    setHoverHint(resolveHoverHint(event.target));
  });
  document.addEventListener("focusin", (event) => {
    setHoverHint(resolveHoverHint(event.target));
  });
  window.addEventListener("mouseout", (event) => {
    if (!event.relatedTarget) setHoverHint("");
  });
  window.addEventListener("blur", () => {
    setHoverHint("");
  });
}

function formatSetupError(errorCode) {
  return SETUP_ERROR_MESSAGES[errorCode] || formatReason(errorCode);
}

function isProblemState(state) {
  return state === "failed" || state === "degraded" || state === "unknown";
}

function parseCanonicalSubjectId(subjectId) {
  if (typeof subjectId !== "string" || !subjectId.startsWith("canonicalFiles/")) return null;
  const tokens = subjectId.split("/");
  const workspaceId = tokens[1] === "openClaw" ? "openClaw" : tokens[1] === "local" ? "local" : null;
  if (!workspaceId) return null;
  const fileId = tokens.length >= 3 ? tokens.slice(2).join("/") : null;
  return {
    workspaceId,
    fileId,
  };
}

function subjectExistsInSnapshot(snapshot, subjectId) {
  const rows = snapshot?.rows || {};
  if (subjectId === OBSERVABILITY_SUBJECT_IDS.bridge) return Boolean(rows.bridge);
  if (subjectId === OBSERVABILITY_SUBJECT_IDS.provider) return Boolean(rows.provider);
  if (subjectId === OBSERVABILITY_SUBJECT_IDS.memory) return Boolean(rows.memory);
  if (subjectId === OBSERVABILITY_SUBJECT_IDS.paths) return Boolean(rows.paths);
  if (subjectId === OBSERVABILITY_SUBJECT_IDS.validation) return Boolean(rows.validation);
  if (subjectId === OBSERVABILITY_SUBJECT_IDS.canonicalFiles) return Boolean(rows.canonicalFiles);
  const canonical = parseCanonicalSubjectId(subjectId);
  if (!canonical) return false;
  const workspace =
    canonical.workspaceId === "local"
      ? rows.canonicalFiles?.localWorkspace
      : rows.canonicalFiles?.openClawWorkspace;
  if (!workspace) return false;
  if (!canonical.fileId) return true;
  const files = Array.isArray(workspace.files) ? workspace.files : [];
  return files.some((entry) => entry?.fileId === canonical.fileId);
}

function pickFirstCanonicalProblemSubject(snapshot) {
  const rows = snapshot?.rows || {};
  const localWorkspace = rows.canonicalFiles?.localWorkspace || {};
  const localFiles = Array.isArray(localWorkspace.files) ? localWorkspace.files : [];
  const localIssue = localFiles.find((entry) => !entry.readable);
  if (localIssue?.fileId) return `canonicalFiles/local/${localIssue.fileId}`;

  const openClawWorkspace = rows.canonicalFiles?.openClawWorkspace || {};
  const openClawFiles = Array.isArray(openClawWorkspace.files) ? openClawWorkspace.files : [];
  const openClawIssue = openClawFiles.find((entry) => !entry.readable);
  if (openClawIssue?.fileId) return `canonicalFiles/openClaw/${openClawIssue.fileId}`;

  if (isProblemState(rows.canonicalFiles?.state)) return OBSERVABILITY_SUBJECT_IDS.canonicalFiles;
  return null;
}

function pickDefaultObservabilitySubject(snapshot) {
  const canonicalSubject = pickFirstCanonicalProblemSubject(snapshot);
  if (canonicalSubject) return canonicalSubject;
  const rows = snapshot?.rows || {};
  for (const rowId of [
    OBSERVABILITY_SUBJECT_IDS.bridge,
    OBSERVABILITY_SUBJECT_IDS.provider,
    OBSERVABILITY_SUBJECT_IDS.memory,
    OBSERVABILITY_SUBJECT_IDS.paths,
    OBSERVABILITY_SUBJECT_IDS.validation,
  ]) {
    if (isProblemState(rows?.[rowId]?.state)) return rowId;
  }
  return OBSERVABILITY_SUBJECT_IDS.bridge;
}

function isSubjectSelected(subjectId) {
  if (activeObservabilitySubjectId === subjectId) return true;
  if (
    subjectId === OBSERVABILITY_SUBJECT_IDS.canonicalFiles &&
    typeof activeObservabilitySubjectId === "string" &&
    activeObservabilitySubjectId.startsWith("canonicalFiles/")
  ) {
    return true;
  }
  return false;
}

function getSetupFormInput() {
  return {
    petName: setupPetName?.value || "",
    birthday: setupBirthday?.value || "",
    companionName: setupCompanionName?.value || "",
    companionTimezone: setupCompanionTimezone?.value || "",
    starterNote: setupStarterNote?.value || "",
    companionCallName: setupCompanionCallName?.value || "",
    userGender: setupUserGender?.value || "",
    creatureLabel: setupCreatureLabel?.value || "",
    petGender: setupPetGender?.value || "",
    signatureEmoji: setupSignatureEmoji?.value || "",
    avatarPath: setupAvatarPath?.value || "",
    seedHeartbeatFile: Boolean(setupSeedHeartbeat?.checked),
    personaPresetId:
      setupPresets?.querySelector(".setup-card-button.is-active")?.dataset.presetId ||
      latestSetupSnapshot?.formDefaults?.personaPresetId ||
      "gentle_companion",
  };
}

function markSetupDirty() {
  setupDirty = true;
  latestSetupPreview = null;
  if (setupApplyButton) setupApplyButton.disabled = true;
}

function setSetupResult(message, tone = "muted") {
  if (!setupResult) return;
  setupResult.textContent = message;
  setupResult.dataset.tone = tone;
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
    } else if (getActiveTab() === TAB_IDS.setup) {
      message = "Press Preview first, then press Save Setup.";
    } else if (getActiveTab() === TAB_IDS.settings) {
      message = "Adjust values, then press Save Settings.";
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
  const activeTab = getActiveTab();
  if (shellTitle) {
    shellTitle.textContent =
      activeTab === TAB_IDS.status
        ? "Status"
        : activeTab === TAB_IDS.setup
          ? "Setup"
          : activeTab === TAB_IDS.settings
            ? "Settings"
            : "Inventory";
  }
  if (shellSubtitle) {
    shellSubtitle.textContent =
      activeTab === TAB_IDS.status
        ? "Bridge, memory, canonical files, and runtime path visibility."
        : activeTab === TAB_IDS.setup
          ? "Fill in pet details, preview files, then save."
          : activeTab === TAB_IDS.settings
            ? "Bounded runtime controls with explicit save and provenance."
          : "Wardrobe, roaming, and trusted prop controls.";
  }
  if (refreshButton) refreshButton.hidden = activeTab !== TAB_IDS.status;
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
  if (tabSetupButton) {
    tabSetupButton.classList.toggle("is-active", activeTab === TAB_IDS.setup);
    tabSetupButton.setAttribute("aria-pressed", String(activeTab === TAB_IDS.setup));
  }
  if (tabSettingsButton) {
    tabSettingsButton.classList.toggle("is-active", activeTab === TAB_IDS.settings);
    tabSettingsButton.setAttribute("aria-pressed", String(activeTab === TAB_IDS.settings));
  }
  if (inventoryPanel) inventoryPanel.classList.toggle("is-active", activeTab === TAB_IDS.inventory);
  if (statusPanel) statusPanel.classList.toggle("is-active", activeTab === TAB_IDS.status);
  if (setupPanel) setupPanel.classList.toggle("is-active", activeTab === TAB_IDS.setup);
  if (settingsPanel) settingsPanel.classList.toggle("is-active", activeTab === TAB_IDS.settings);
}

function buildDetailRow(label, value) {
  return `<div class="settings-detail-row"><span class="settings-detail-label">${escapeHtml(label)}</span><span class="settings-detail-value">${escapeHtml(value)}</span></div>`;
}

function buildSettingsCard(label, row, details, { subjectId = "", selected = false, extraMarkup = "" } = {}) {
  const detailMarkup = details.map((entry) => buildDetailRow(entry.label, entry.value)).join("");
  const classes = ["settings-card"];
  if (subjectId) classes.push("is-selectable");
  if (selected) classes.push("is-selected");
  const selectionAttrs = subjectId
    ? ` data-subject-id="${escapeHtml(subjectId)}" tabindex="0" role="button"`
    : "";
  const actionsMarkup = subjectId
    ? `<div class="settings-card-actions"><button class="minor-button" type="button" data-subject-id="${escapeHtml(subjectId)}">Details</button></div>`
    : "";
  return `<article class="${classes.join(" ")}"${selectionAttrs}><div class="settings-card-header"><div><h3>${escapeHtml(label)}</h3><span class="settings-card-note">${escapeHtml(formatReason(row.reason))}</span></div><span class="state-pill" data-state="${escapeHtml(row.state)}">${escapeHtml(row.state)}</span></div><div class="settings-detail-list">${detailMarkup}</div>${extraMarkup}${actionsMarkup}</article>`;
}

function buildCanonicalSubjectButtons(localFiles, openClawFiles) {
  const buttons = [
    `<button class="preview-tab-button ${activeObservabilitySubjectId === "canonicalFiles/local" ? "is-active" : ""}" type="button" data-subject-id="canonicalFiles/local">Local Details</button>`,
    `<button class="preview-tab-button ${activeObservabilitySubjectId === "canonicalFiles/openClaw" ? "is-active" : ""}" type="button" data-subject-id="canonicalFiles/openClaw">OpenClaw Details</button>`,
  ];
  for (const file of localFiles) {
    const subjectId = `canonicalFiles/local/${file.fileId}`;
    buttons.push(
      `<button class="preview-tab-button ${activeObservabilitySubjectId === subjectId ? "is-active" : ""}" type="button" data-subject-id="${escapeHtml(subjectId)}">Local ${escapeHtml(file.fileId)}</button>`
    );
  }
  for (const file of openClawFiles) {
    const subjectId = `canonicalFiles/openClaw/${file.fileId}`;
    buttons.push(
      `<button class="preview-tab-button ${activeObservabilitySubjectId === subjectId ? "is-active" : ""}" type="button" data-subject-id="${escapeHtml(subjectId)}">OpenClaw ${escapeHtml(file.fileId)}</button>`
    );
  }
  return `<div class="status-chip-list">${buttons.join("")}</div>`;
}

function renderObservability() {
  if (!latestObservabilitySnapshot) {
    latestObservabilityDetail = null;
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
      buildSettingsCard(
        "OpenClaw Bridge",
        rows.bridge || {},
        [
          { label: "Transport", value: formatText(rows.bridge?.transport, "unknown") },
          { label: "Mode", value: formatText(rows.bridge?.mode, "unknown") },
          { label: "Endpoint", value: formatText(rows.bridge?.endpoint, "Stub / None") },
          { label: "Auth", value: rows.bridge?.authConfigured ? "Configured" : "Not configured" },
        ],
        {
          subjectId: OBSERVABILITY_SUBJECT_IDS.bridge,
          selected: isSubjectSelected(OBSERVABILITY_SUBJECT_IDS.bridge),
        }
      ),
      buildSettingsCard(
        "Provider / Model",
        rows.provider || {},
        [
          { label: "Provider", value: formatText(rows.provider?.providerLabel, "Unavailable") },
          { label: "Model", value: formatText(rows.provider?.modelLabel, "Unavailable") },
          { label: "Source", value: formatText(rows.provider?.source, "unknown") },
          { label: "Agent", value: formatText(rows.provider?.agentId, "Unavailable") },
        ],
        {
          subjectId: OBSERVABILITY_SUBJECT_IDS.provider,
          selected: isSubjectSelected(OBSERVABILITY_SUBJECT_IDS.provider),
        }
      ),
      buildSettingsCard(
        "Memory Runtime",
        rows.memory || {},
        [
          { label: "Requested", value: formatText(rows.memory?.requestedAdapterMode, "unknown") },
          { label: "Active", value: formatText(rows.memory?.activeAdapterMode, "unknown") },
          { label: "Fallback", value: formatText(rows.memory?.fallbackReason, "none") },
          { label: "Legacy JSONL", value: rows.memory?.writeLegacyJsonl ? "Enabled" : "Disabled" },
        ],
        {
          subjectId: OBSERVABILITY_SUBJECT_IDS.memory,
          selected: isSubjectSelected(OBSERVABILITY_SUBJECT_IDS.memory),
        }
      ),
    ].join("");
  }
  if (configRowsContainer) {
    const localFiles = rows.canonicalFiles?.localWorkspace?.files || [];
    const openClawFiles = rows.canonicalFiles?.openClawWorkspace?.files || [];
    configRowsContainer.innerHTML = [
      buildSettingsCard(
        "Canonical Files",
        rows.canonicalFiles || {},
        [
          { label: "Local Workspace", value: `${rows.canonicalFiles?.localWorkspace?.readableCount || 0}/${localFiles.length} readable` },
          { label: "OpenClaw Workspace", value: rows.canonicalFiles?.openClawWorkspace?.configured ? `${rows.canonicalFiles?.openClawWorkspace?.readableCount || 0}/${openClawFiles.length} readable` : "Not configured" },
          { label: "Local Root", value: formatText(rows.canonicalFiles?.localWorkspace?.root, "Unavailable") },
          { label: "OpenClaw Root", value: formatText(rows.canonicalFiles?.openClawWorkspace?.root, "Unavailable") },
        ],
        {
          subjectId: OBSERVABILITY_SUBJECT_IDS.canonicalFiles,
          selected: isSubjectSelected(OBSERVABILITY_SUBJECT_IDS.canonicalFiles),
          extraMarkup: buildCanonicalSubjectButtons(localFiles, openClawFiles),
        }
      ),
      buildSettingsCard(
        "Paths / Sources",
        rows.paths || {},
        [
          { label: "Local Root", value: formatText(rows.paths?.localWorkspaceRoot, "Unavailable") },
          { label: "OpenClaw Root", value: formatText(rows.paths?.openClawWorkspaceRoot, "Unavailable") },
          { label: "Obsidian Root", value: formatText(rows.paths?.obsidianVaultRoot, "Unavailable") },
          { label: "Active Layers", value: (rows.paths?.activeLayers || []).join(", ") || "base" },
        ],
        {
          subjectId: OBSERVABILITY_SUBJECT_IDS.paths,
          selected: isSubjectSelected(OBSERVABILITY_SUBJECT_IDS.paths),
        }
      ),
      buildSettingsCard(
        "Validation",
        rows.validation || {},
        [
          { label: "Warnings", value: String(rows.validation?.warningCount ?? 0) },
          { label: "Errors", value: String(rows.validation?.errorCount ?? 0) },
          { label: "First Warning", value: formatText(rows.validation?.warnings?.[0], "None") },
          { label: "First Error", value: formatText(rows.validation?.errors?.[0], "None") },
        ],
        {
          subjectId: OBSERVABILITY_SUBJECT_IDS.validation,
          selected: isSubjectSelected(OBSERVABILITY_SUBJECT_IDS.validation),
        }
      ),
    ].join("");
  }
}

function renderObservabilityDetail() {
  if (!observabilityDetailContainer) return;
  if (!latestObservabilityDetail) {
    observabilityDetailContainer.innerHTML =
      '<h3>Waiting For Selection</h3><span class="setup-card-copy">Choose a row or file to see detailed why/provenance data.</span>';
    return;
  }
  const detail = latestObservabilityDetail;
  const provenance = Array.isArray(detail.provenance) ? detail.provenance : [];
  const steps = Array.isArray(detail.suggestedSteps) ? detail.suggestedSteps : [];
  const actions = Array.isArray(detail.actions) ? detail.actions : [];
  const provenanceMarkup = provenance
    .map(
      (entry) =>
        `<li><strong>${escapeHtml(entry.label || "Detail")}:</strong> ${escapeHtml(
          formatProvenanceEntryValue(entry)
        )}</li>`
    )
    .join("");
  const stepsMarkup = steps.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("");
  const actionsMarkup = actions
    .map(
      (action) =>
        `<button class="setup-action-button" type="button" data-observability-action="${escapeHtml(action.actionId)}" ${action.enabled === false ? "disabled" : ""}>${escapeHtml(action.label || action.actionId)}</button>`
    )
    .join("");
  observabilityDetailContainer.innerHTML = [
    `<div class="settings-card-header"><div><h3>${escapeHtml(detail.subject?.label || "Status Detail")}</h3><span class="settings-card-note">${escapeHtml(formatReason(detail.subject?.reason || "unknown"))}</span></div><span class="state-pill" data-state="${escapeHtml(detail.subject?.state || "unknown")}">${escapeHtml(detail.subject?.state || "unknown")}</span></div>`,
    `<p class="setup-card-copy">${escapeHtml(detail.summary?.headline || "No headline available.")}</p>`,
    `<p class="setup-card-copy">${escapeHtml(detail.summary?.impact || "No impact information available.")}</p>`,
    `<div class="settings-detail-list">${buildDetailRow("Who Owns This", formatOwnershipLabel(detail.summary?.ownership))}${buildDetailRow("How To Fix", formatRepairabilityLabel(detail.summary?.repairability))}</div>`,
    `<h4>Where This Info Came From</h4>`,
    provenanceMarkup ? `<ul class="detail-list">${provenanceMarkup}</ul>` : '<span class="setup-card-copy">No source details yet.</span>',
    `<h4>Suggested Steps</h4>`,
    stepsMarkup ? `<ul class="detail-list detail-list--steps">${stepsMarkup}</ul>` : '<span class="setup-card-copy">No suggested steps available.</span>',
    `<div class="setup-actions">${actionsMarkup}</div>`,
  ].join("");
}

async function loadObservabilityDetail(subjectId) {
  const nextSubjectId = typeof subjectId === "string" && subjectId.trim() ? subjectId.trim() : OBSERVABILITY_SUBJECT_IDS.bridge;
  activeObservabilitySubjectId = nextSubjectId;
  if (typeof window.inventoryAPI?.getObservabilityDetail !== "function") {
    latestObservabilityDetail = null;
    render();
    return;
  }
  try {
    latestObservabilityDetail = await window.inventoryAPI.getObservabilityDetail(nextSubjectId);
    activeObservabilitySubjectId = latestObservabilityDetail?.subject?.subjectId || nextSubjectId;
  } catch (error) {
    latestObservabilityDetail = null;
    setStatus(error?.message || "Status detail failed to load.", "warning");
  }
  render();
}

async function runObservabilityDetailAction(actionId) {
  if (!actionId || typeof window.inventoryAPI?.runObservabilityAction !== "function") return;
  try {
    const result = await window.inventoryAPI.runObservabilityAction(
      actionId,
      activeObservabilitySubjectId || OBSERVABILITY_SUBJECT_IDS.bridge
    );
    if (!result?.ok) {
      setStatus(result?.error || "Status action failed.", "warning");
      if (result?.snapshot) latestObservabilitySnapshot = result.snapshot;
      if (result?.detail) {
        latestObservabilityDetail = result.detail;
        activeObservabilitySubjectId = result.detail.subject?.subjectId || activeObservabilitySubjectId;
      }
      render();
      return;
    }
    if (result.shellState) syncShellState(result.shellState);
    if (result.snapshot) latestObservabilitySnapshot = result.snapshot;
    if (result.detail) {
      latestObservabilityDetail = result.detail;
      activeObservabilitySubjectId = result.detail.subject?.subjectId || activeObservabilitySubjectId;
    }
    if (result.actionId === OBSERVABILITY_ACTION_IDS.copyPath) {
      setStatus("Path copied to clipboard.", "ok");
    } else if (result.actionId === OBSERVABILITY_ACTION_IDS.copyDetails) {
      setStatus("Details copied to clipboard.", "ok");
    } else if (result.actionId === OBSERVABILITY_ACTION_IDS.openSetup) {
      setStatus("Setup opened from status details.", "ok");
    } else {
      setStatus("Status refreshed.", "ok");
    }
    render();
  } catch (error) {
    setStatus(error?.message || "Status action failed.", "warning");
    render();
  }
}

function buildSetupTargetCard(label, target, description) {
  const accessLabel = target?.observedOnly
    ? target?.readable
      ? "Readable (observed only)"
      : "Observed, not currently readable"
    : target?.writable
      ? "Readable + writable"
      : "Not writable";
  return `<article class="setup-card"><div class="settings-card-header"><div><h3>${escapeHtml(label)}</h3><span class="settings-card-note">${escapeHtml(description)}</span></div><span class="state-pill" data-state="${escapeHtml(target?.state || "unknown")}">${escapeHtml(target?.state || "unknown")}</span></div><div class="settings-detail-list">${buildDetailRow("Root", formatText(target?.root, "Unavailable"))}${buildDetailRow("Access", accessLabel)}${buildDetailRow("Reason", formatReason(target?.reason))}</div></article>`;
}

function renderSetupTargets() {
  if (!setupTargets) return;
  if (!latestSetupSnapshot) {
    setupTargets.innerHTML =
      '<article class="setup-card"><h3>Waiting For Targets</h3><span class="setup-card-copy">Press Reload Targets if your folders are not showing.</span></article>';
    return;
  }
  const applyModeLabel = latestSetupSnapshot.applyMode === "local_only" ? "Local Saves Only" : "Blocked";
  setupTargets.innerHTML = [
    buildSetupTargetCard("Local Workspace", latestSetupSnapshot.targets.local, "Main folder for your pet files."),
    buildSetupTargetCard("OpenClaw Workspace", latestSetupSnapshot.targets.openClaw, "Read-only view for OpenClaw context."),
    `<article class="setup-card"><div class="settings-card-header"><div><h3>Write Policy</h3><span class="settings-card-note">Save Setup is always explicit and local-only.</span></div><span class="state-pill" data-state="${escapeHtml(latestSetupSnapshot.applyMode === "blocked" ? "failed" : "healthy")}">${escapeHtml(applyModeLabel)}</span></div><div class="settings-detail-list">${buildDetailRow("Presets", String(latestSetupSnapshot.presets?.length || 0))}${buildDetailRow("Heartbeat File", "Optional, empty file")}${buildDetailRow("OpenClaw", latestSetupSnapshot.targets.openClaw?.configured ? "Read-only" : "Not configured")}</div></article>`,
  ].join("");
}

function applySetupDefaultsIfEmpty() {
  const defaults = latestSetupSnapshot?.formDefaults || {};
  if (setupPetName && !setupPetName.value) setupPetName.value = defaults.petName || "";
  if (setupBirthday && !setupBirthday.value) setupBirthday.value = defaults.birthday || "";
  if (setupCompanionName && !setupCompanionName.value) setupCompanionName.value = defaults.companionName || "";
  if (setupCompanionCallName && !setupCompanionCallName.value) {
    setupCompanionCallName.value = defaults.companionCallName || "";
  }
  if (setupUserGender && !setupUserGender.value) setupUserGender.value = defaults.userGender || "";
  if (setupCompanionTimezone && !setupCompanionTimezone.value) {
    setupCompanionTimezone.value = defaults.companionTimezone || "";
  }
  if (setupStarterNote && !setupStarterNote.value) setupStarterNote.value = defaults.starterNote || "";
  if (setupCreatureLabel && !setupCreatureLabel.value) {
    setupCreatureLabel.value = defaults.creatureLabel || "";
  }
  if (setupPetGender && !setupPetGender.value) setupPetGender.value = defaults.petGender || "";
  if (setupSignatureEmoji && !setupSignatureEmoji.value) {
    setupSignatureEmoji.value = defaults.signatureEmoji || "";
  }
  if (setupAvatarPath && !setupAvatarPath.value) setupAvatarPath.value = defaults.avatarPath || "";
  if (setupSeedHeartbeat && !setupSeedHeartbeat.checked && defaults.seedHeartbeatFile) {
    setupSeedHeartbeat.checked = true;
  }
}

function renderSetupPresets() {
  if (!setupPresets) return;
  if (!latestSetupSnapshot?.presets?.length) {
    setupPresets.innerHTML = "";
    return;
  }
  const selectedPresetId = getSetupFormInput().personaPresetId;
  setupPresets.innerHTML = latestSetupSnapshot.presets
    .map(
      (preset) =>
        `<button class="setup-card-button ${selectedPresetId === preset.id ? "is-active" : ""}" type="button" data-preset-id="${escapeHtml(preset.id)}" data-hint="${escapeHtml(`Choose ${preset.label}. ${preset.quickPicker || preset.summary}`)}"><strong>${escapeHtml(preset.label)}</strong><span class="setup-card-button-copy">${escapeHtml(preset.summary)}</span><span class="setup-card-button-copy">${escapeHtml(preset.quickPicker || "")}</span></button>`
    )
    .join("");
  for (const button of setupPresets.querySelectorAll("[data-preset-id]")) {
    button.addEventListener("click", () => {
      for (const other of setupPresets.querySelectorAll("[data-preset-id]")) {
        other.classList.toggle("is-active", other === button);
      }
      markSetupDirty();
      renderSetupPreview();
    });
  }
}

function renderSetupPreview() {
  if (setupPreviewButton) setupPreviewButton.disabled = setupLoading || setupApplying;
  if (setupReloadTargetsButton) setupReloadTargetsButton.disabled = setupLoading || setupApplying;
  if (setupApplyButton) {
    setupApplyButton.disabled = setupLoading || setupApplying || !latestSetupPreview || setupDirty;
  }
  if (!setupPreviewTabs || !setupPreviewCopy || !setupPreviewMarkdown) return;
  if (!latestSetupPreview) {
    setupPreviewTabs.innerHTML = "";
    setupPreviewCopy.textContent =
      "Pick a personality, then press Preview to see your pet files.";
    setupPreviewMarkdown.textContent = "";
    return;
  }
  const files = Array.isArray(latestSetupPreview.files) ? latestSetupPreview.files : [];
  if (!files.find((file) => file.fileId === activeSetupPreviewFileId) && files.length > 0) {
    activeSetupPreviewFileId = files[0].fileId;
  }
  setupPreviewTabs.innerHTML = files
    .map(
      (file) =>
        `<button class="preview-tab-button ${file.fileId === activeSetupPreviewFileId ? "is-active" : ""}" type="button" data-file-id="${escapeHtml(file.fileId)}" data-hint="${escapeHtml(`Show preview for ${file.fileId}.`)}">${escapeHtml(file.fileId)}</button>`
    )
    .join("");
  for (const button of setupPreviewTabs.querySelectorAll("[data-file-id]")) {
    button.addEventListener("click", () => {
      activeSetupPreviewFileId = button.dataset.fileId || activeSetupPreviewFileId;
      renderSetupPreview();
    });
  }
  const selectedFile = files.find((file) => file.fileId === activeSetupPreviewFileId) || files[0];
  const writeTargets = (latestSetupPreview.writePlan || []).map((plan) => `${plan.targetId}: ${plan.root}`);
  setupPreviewCopy.textContent =
    latestSetupPreview.applyMode === "local_only"
      ? `Preview only. Save Setup writes to: ${writeTargets.join(" | ") || "Unavailable"}. OpenClaw stays read-only.`
      : "Preview is blocked until your local folder and required fields are valid.";
  setupPreviewMarkdown.textContent = selectedFile?.previewMarkdown || "";
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
  renderObservabilityDetail();
  renderSetupTargets();
  renderSetupPresets();
  renderShellSettingsEditor();
  renderSetupPreview();
  renderHoverHint();
}

async function refreshObservability(successMessage = "Status refreshed.") {
  if (typeof window.inventoryAPI?.getObservabilitySnapshot !== "function") return;
  observabilityLoading = true;
  render();
  try {
    latestObservabilitySnapshot = await window.inventoryAPI.getObservabilitySnapshot();
    const preferredSubject =
      activeObservabilitySubjectId && subjectExistsInSnapshot(latestObservabilitySnapshot, activeObservabilitySubjectId)
        ? activeObservabilitySubjectId
        : pickDefaultObservabilitySubject(latestObservabilitySnapshot);
    await loadObservabilityDetail(preferredSubject);
    setStatus(successMessage, "ok");
  } catch (error) {
    setStatus(error?.message || "Status refresh failed.", "warning");
  } finally {
    observabilityLoading = false;
    render();
  }
}

async function refreshSetupSnapshot(successMessage = "Setup targets loaded.") {
  if (typeof window.inventoryAPI?.getSetupBootstrapSnapshot !== "function") return;
  setupLoading = true;
  render();
  try {
    latestSetupSnapshot = await window.inventoryAPI.getSetupBootstrapSnapshot();
    applySetupDefaultsIfEmpty();
    setSetupResult(successMessage, "ok");
  } catch (error) {
    setSetupResult(error?.message || "Setup targets failed to load.", "warning");
  } finally {
    setupLoading = false;
    render();
  }
}

async function refreshShellSettingsSnapshot(successMessage = "Advanced settings loaded.") {
  if (typeof window.inventoryAPI?.getShellSettingsSnapshot !== "function") return;
  shellSettingsLoading = true;
  render();
  try {
    const snapshot = await window.inventoryAPI.getShellSettingsSnapshot();
    latestShellSettingsSnapshot = normalizeShellSettingsSnapshot(snapshot);
    syncShellSettingsDraftFromSnapshot();
    setStatus(successMessage, "ok");
  } catch (error) {
    setStatus(error?.message || "Advanced settings failed to load.", "warning");
  } finally {
    shellSettingsLoading = false;
    render();
  }
}

function buildShellSettingsPatchFromDraft() {
  const patch = {};
  const fields = latestShellSettingsSnapshot?.fields || [];
  for (const field of fields) {
    const hasDraftValue = Object.prototype.hasOwnProperty.call(shellSettingsDraft, field.key);
    const draftValue = hasDraftValue ? shellSettingsDraft[field.key] : field.value;
    const normalizedDraftValue = coerceShellSettingsFieldValue(field, draftValue);
    if (normalizedDraftValue !== field.value) {
      patch[field.key] = normalizedDraftValue;
    }
  }
  return patch;
}

async function applyShellSettings() {
  if (typeof window.inventoryAPI?.applyShellSettingsPatch !== "function") return;
  if (!latestShellSettingsSnapshot) return;
  shellSettingsSaving = true;
  render();
  try {
    const patch = buildShellSettingsPatchFromDraft();
    if (Object.keys(patch).length <= 0) {
      setStatus("No advanced setting changes to save.", "muted");
      shellSettingsDirty = false;
      return;
    }

    const result = await window.inventoryAPI.applyShellSettingsPatch(patch);
    if (result?.shellState) {
      syncShellState(result.shellState);
    }
    if (result?.observability) {
      latestObservabilitySnapshot = result.observability;
      const preferredSubject =
        activeObservabilitySubjectId &&
        subjectExistsInSnapshot(latestObservabilitySnapshot, activeObservabilitySubjectId)
          ? activeObservabilitySubjectId
          : pickDefaultObservabilitySubject(latestObservabilitySnapshot);
      void loadObservabilityDetail(preferredSubject);
    }
    if (result?.settingsSnapshot) {
      latestShellSettingsSnapshot = normalizeShellSettingsSnapshot(result.settingsSnapshot);
      syncShellSettingsDraftFromSnapshot();
    } else {
      await refreshShellSettingsSnapshot("Advanced settings refreshed.");
    }
    const rejected = Array.isArray(result?.rejected) ? result.rejected : [];
    const envOverrides = Array.isArray(result?.envOverrides) ? result.envOverrides : [];
    if (rejected.length > 0) {
      const rejectedMessage = rejected
        .map((entry) => `${entry.key}: ${formatReason(entry.reason || "rejected")}`)
        .join(" | ");
      setStatus(`Some settings were rejected: ${rejectedMessage}`, "warning");
    } else if (envOverrides.length > 0) {
      setStatus(
        `Settings saved. Environment overrides still control: ${envOverrides.join(", ")}.`,
        "warning"
      );
    } else {
      setStatus("Advanced settings saved.", "ok");
    }
    shellSettingsDirty = false;
  } catch (error) {
    setStatus(error?.message || "Advanced settings save failed.", "warning");
  } finally {
    shellSettingsSaving = false;
    render();
  }
}

async function previewSetup() {
  if (typeof window.inventoryAPI?.previewSetupBootstrap !== "function") return;
  setupLoading = true;
  render();
  try {
    const preview = await window.inventoryAPI.previewSetupBootstrap(getSetupFormInput());
    latestSetupPreview = preview;
    setupDirty = false;
    activeSetupPreviewFileId = preview?.files?.[0]?.fileId || activeSetupPreviewFileId;
    if (preview?.ok) {
      setSetupResult(
        "Preview ready. Save Setup writes to your local pet folder only. OpenClaw stays read-only.",
        "ok"
      );
      setStatus("Preview ready.", "ok");
    } else {
      const errorText =
        Array.isArray(preview?.errors) && preview.errors.length > 0
          ? preview.errors.map((entry) => formatSetupError(entry)).join(" ")
          : "Setup preview is blocked.";
      setSetupResult(errorText, "warning");
      setStatus(errorText, "warning");
    }
  } catch (error) {
    latestSetupPreview = null;
    setupDirty = true;
    setSetupResult(error?.message || "Setup preview failed.", "warning");
    setStatus(error?.message || "Setup preview failed.", "warning");
  } finally {
    setupLoading = false;
    render();
  }
}

async function applySetup() {
  if (!latestSetupPreview || setupDirty || typeof window.inventoryAPI?.applySetupBootstrap !== "function") {
    return;
  }
  setupApplying = true;
  render();
  try {
    const result = await window.inventoryAPI.applySetupBootstrap(getSetupFormInput());
    if (!result?.ok) {
      const errorText = formatSetupError(result?.error || "setup_apply_failed");
      setSetupResult(errorText, "warning");
      setStatus(errorText, "warning");
      return;
    }
    const targetSummary = (result.targetResults || [])
      .map((target) => `${target.targetId}: ${target.root}`)
      .join(" | ");
    latestSetupPreview = null;
    setupDirty = true;
    const successMessage = `Setup saved. Local files written: ${targetSummary || "none"}. OpenClaw stayed read-only.`;
    setSetupResult(successMessage, "ok");
    setStatus("Setup saved. Open Status and press Refresh to check file health.", "ok");
    await refreshSetupSnapshot("Setup targets refreshed after save.");
    setSetupResult(successMessage, "ok");
  } catch (error) {
    setSetupResult(error?.message || "Setup apply failed.", "warning");
    setStatus(error?.message || "Setup apply failed.", "warning");
  } finally {
    setupApplying = false;
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
  if (getActiveTab() === TAB_IDS.setup && (previousTab !== TAB_IDS.setup || !latestSetupSnapshot)) {
    void refreshSetupSnapshot("Setup targets loaded.");
  }
  if (
    getActiveTab() === TAB_IDS.settings &&
    (previousTab !== TAB_IDS.settings || !latestShellSettingsSnapshot)
  ) {
    void refreshShellSettingsSnapshot("Advanced settings loaded.");
  }
}

async function initialize() {
  wireHoverHints();
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
tabSetupButton?.addEventListener("click", () => {
  void switchTab(TAB_IDS.setup);
});
tabSettingsButton?.addEventListener("click", () => {
  void switchTab(TAB_IDS.settings);
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
runtimeRowsContainer?.addEventListener("click", (event) => {
  const button = event.target?.closest?.("[data-subject-id]");
  if (!button) return;
  const subjectId = button.dataset?.subjectId;
  if (!subjectId) return;
  event.preventDefault();
  void loadObservabilityDetail(subjectId);
});
runtimeRowsContainer?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const button = event.target?.closest?.("[data-subject-id]");
  if (!button) return;
  const subjectId = button.dataset?.subjectId;
  if (!subjectId) return;
  event.preventDefault();
  void loadObservabilityDetail(subjectId);
});
configRowsContainer?.addEventListener("click", (event) => {
  const button = event.target?.closest?.("[data-subject-id]");
  if (!button) return;
  const subjectId = button.dataset?.subjectId;
  if (!subjectId) return;
  event.preventDefault();
  void loadObservabilityDetail(subjectId);
});
configRowsContainer?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const button = event.target?.closest?.("[data-subject-id]");
  if (!button) return;
  const subjectId = button.dataset?.subjectId;
  if (!subjectId) return;
  event.preventDefault();
  void loadObservabilityDetail(subjectId);
});
observabilityDetailContainer?.addEventListener("click", (event) => {
  const button = event.target?.closest?.("[data-observability-action]");
  if (!button) return;
  const actionId = button.dataset?.observabilityAction;
  if (!actionId) return;
  event.preventDefault();
  void runObservabilityDetailAction(actionId);
});

for (const field of [
  setupPetName,
  setupBirthday,
  setupCompanionName,
  setupCompanionCallName,
  setupUserGender,
  setupCompanionTimezone,
  setupStarterNote,
  setupCreatureLabel,
  setupPetGender,
  setupSignatureEmoji,
  setupAvatarPath,
  setupSeedHeartbeat,
]) {
  field?.addEventListener("input", () => {
    markSetupDirty();
    renderSetupPreview();
  });
  field?.addEventListener("change", () => {
    markSetupDirty();
    renderSetupPreview();
  });
}

setupAvatarBrowseButton?.addEventListener("click", () => {
  setupAvatarFileInput?.click();
});

setupAvatarFileInput?.addEventListener("change", () => {
  const selectedFile = setupAvatarFileInput.files?.[0] || null;
  const selectedPath =
    (selectedFile && typeof selectedFile.path === "string" && selectedFile.path.trim()) ||
    (typeof setupAvatarFileInput.value === "string" ? setupAvatarFileInput.value.trim() : "");
  if (setupAvatarPath) {
    setupAvatarPath.value = selectedPath;
  }
  markSetupDirty();
  renderSetupPreview();
});

setupReloadTargetsButton?.addEventListener("click", () => {
  void refreshSetupSnapshot("Setup targets refreshed.");
});
setupPreviewButton?.addEventListener("click", () => {
  void previewSetup();
});
setupApplyButton?.addEventListener("click", () => {
  void applySetup();
});

shellSettingsEditor?.addEventListener("input", (event) => {
  const input = event.target?.closest?.("[data-shell-setting-key]");
  if (!input) return;
  const key = input.dataset?.shellSettingKey;
  if (!key) return;
  const field = getShellSettingsFieldByKey(key);
  if (!field) return;
  shellSettingsDraft[key] = coerceShellSettingsFieldValue(field, input.value);
  shellSettingsDirty = true;
  updateCharacterScaleReadout(input);
  refreshShellSettingsActionButtons();
});

shellSettingsEditor?.addEventListener("change", (event) => {
  const input = event.target?.closest?.("[data-shell-setting-key]");
  if (!input) return;
  const key = input.dataset?.shellSettingKey;
  if (!key) return;
  const field = getShellSettingsFieldByKey(key);
  if (!field) return;
  shellSettingsDraft[key] = coerceShellSettingsFieldValue(field, input.value);
  shellSettingsDirty = true;
  updateCharacterScaleReadout(input);
  refreshShellSettingsActionButtons();
});

shellSettingsEditor?.addEventListener("click", (event) => {
  const button = event.target?.closest?.("[data-shell-settings-action]");
  if (!button) return;
  const action = button.dataset?.shellSettingsAction;
  if (action === "reload") {
    void refreshShellSettingsSnapshot("Advanced settings loaded.");
    return;
  }
  if (action === "reset") {
    syncShellSettingsDraftFromSnapshot();
    renderShellSettingsEditor();
    setStatus("Advanced settings changes reset.", "muted");
    return;
  }
  if (action === "save") {
    void applyShellSettings();
  }
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
