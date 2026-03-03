const root = document.getElementById("zone-root");
const selectionBox = document.getElementById("selection-box");
const ghostBox = document.getElementById("ghost-box");
const hintLabel = document.getElementById("hint-label");
const cancelButton = document.getElementById("cancel-button");
const hud = document.querySelector(".hud");

let selectorModel = null;
let activePointerId = null;
let dragStart = null;
let activeRect = null;

function setHint(message, tone = "muted") {
  if (!hintLabel) return;
  hintLabel.textContent = typeof message === "string" ? message : "";
  hintLabel.dataset.tone = tone;
}

function normalizeRect(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

function applyBoxStyles(element, rect, hidden = false) {
  if (!element) return;
  if (!rect || hidden) {
    element.hidden = true;
    return;
  }
  element.hidden = false;
  element.style.left = `${rect.x}px`;
  element.style.top = `${rect.y}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
}

function renderBoxes() {
  applyBoxStyles(selectionBox, activeRect, !activeRect);
  const ghostRect =
    selectorModel?.existingRect &&
    Number.isFinite(Number(selectorModel.existingRect.x)) &&
    Number.isFinite(Number(selectorModel.existingRect.y))
      ? {
          x: selectorModel.existingRect.x - selectorModel.area.x,
          y: selectorModel.existingRect.y - selectorModel.area.y,
          width: selectorModel.existingRect.width,
          height: selectorModel.existingRect.height,
        }
      : null;
  applyBoxStyles(ghostBox, ghostRect, !ghostRect);
}

function applyModel(model) {
  selectorModel = model && typeof model === "object" ? model : null;
  renderBoxes();
}

async function commitSelection() {
  if (!activeRect || !selectorModel?.area) return;
  const absoluteRect = {
    x: selectorModel.area.x + activeRect.x,
    y: selectorModel.area.y + activeRect.y,
    width: activeRect.width,
    height: activeRect.height,
  };
  const result = await window.zoneSelectorAPI.commit(absoluteRect);
  if (!result?.ok) {
    setHint("Draw a larger zone before releasing.", "warning");
    return;
  }
  setHint("Zone saved.", "ok");
}

function beginSelection(event) {
  if (event.button !== 0 || !root) return;
  event.preventDefault();
  activePointerId = event.pointerId;
  dragStart = {
    x: event.clientX,
    y: event.clientY,
  };
  activeRect = {
    x: dragStart.x,
    y: dragStart.y,
    width: 0,
    height: 0,
  };
  if (typeof root.setPointerCapture === "function") {
    root.setPointerCapture(event.pointerId);
  }
  renderBoxes();
}

function updateSelection(event) {
  if (activePointerId === null || event.pointerId !== activePointerId || !dragStart) return;
  activeRect = normalizeRect(dragStart, {
    x: event.clientX,
    y: event.clientY,
  });
  renderBoxes();
}

async function finishSelection(event) {
  if (activePointerId === null || !root) return;
  if (event && event.pointerId !== activePointerId) return;
  const pointerId = activePointerId;
  activePointerId = null;
  dragStart = null;
  if (typeof root.hasPointerCapture === "function" && root.hasPointerCapture(pointerId)) {
    root.releasePointerCapture(pointerId);
  }
  if (!activeRect || activeRect.width < 120 || activeRect.height < 120) {
    setHint("Draw a larger zone to keep roaming active.", "warning");
    activeRect = null;
    renderBoxes();
    return;
  }
  await commitSelection();
}

async function initialize() {
  setHint("Drag a box over the desktop area to define the roam zone.", "muted");
  try {
    applyModel(await window.zoneSelectorAPI.getModel());
  } catch {
    applyModel(null);
  }
  if (typeof window.zoneSelectorAPI?.onModel === "function") {
    window.zoneSelectorAPI.onModel((payload) => {
      applyModel(payload);
    });
  }
}

if (root) {
  root.addEventListener("pointerdown", beginSelection);
  root.addEventListener("pointermove", updateSelection);
  root.addEventListener("pointerup", (event) => {
    void finishSelection(event);
  });
  root.addEventListener("pointercancel", (event) => {
    void finishSelection(event);
  });
  root.addEventListener("lostpointercapture", (event) => {
    void finishSelection(event);
  });
}

if (cancelButton) {
  cancelButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  cancelButton.addEventListener("click", () => {
    void window.zoneSelectorAPI.cancel();
  });
}

if (hud) {
  hud.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    void window.zoneSelectorAPI.cancel();
  }
});

void initialize();
