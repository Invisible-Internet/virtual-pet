const propRoot = document.getElementById("prop-root");
const propVisual = document.getElementById("prop-visual");
const returnButton = document.getElementById("return-button");

let propModel = null;
let activePointerId = null;
let dragQueued = false;

function applyModel(model) {
  propModel = model && typeof model === "object" ? model : null;
  const propId = propModel?.propId || "poolRing";
  document.title = propModel?.label ? `${propModel.label} Prop` : "Virtual Pet Prop";
  const visualBounds = propModel?.visualBounds || null;
  if (visualBounds) {
    document.documentElement.style.setProperty("--prop-visual-left", `${visualBounds.x}px`);
    document.documentElement.style.setProperty("--prop-visual-top", `${visualBounds.y}px`);
    document.documentElement.style.setProperty("--prop-visual-width", `${visualBounds.width}px`);
    document.documentElement.style.setProperty("--prop-visual-height", `${visualBounds.height}px`);
  }
  if (propRoot) {
    propRoot.dataset.propId = propId;
  }
  if (propVisual) {
    propVisual.dataset.propId = propId;
  }
}

async function returnToInventory() {
  if (!propModel || !window.propWindowAPI?.returnToInventory) return;
  try {
    await window.propWindowAPI.returnToInventory(propModel.propId);
  } catch {
    // Ignore if the prop window is already closing.
  }
}

async function loadModel() {
  if (typeof window.propWindowAPI?.getModel !== "function") return;
  try {
    applyModel(await window.propWindowAPI.getModel());
  } catch {
    applyModel(null);
  }
}

function queueDragStep() {
  if (!propModel || activePointerId === null || dragQueued) return;
  dragQueued = true;
  window.requestAnimationFrame(async () => {
    dragQueued = false;
    if (!propModel || activePointerId === null) return;
    try {
      await window.propWindowAPI.drag(propModel.propId);
    } catch {
      // Ignore transient drag failures; the next pointer event can retry.
    }
  });
}

async function beginDrag(event) {
  if (event.button !== 0 || !propRoot || !propModel) return;
  event.preventDefault();
  activePointerId = event.pointerId;
  propRoot.classList.add("is-dragging");
  if (typeof propRoot.setPointerCapture === "function") {
    propRoot.setPointerCapture(event.pointerId);
  }
  try {
    const result = await window.propWindowAPI.beginDrag(propModel.propId);
    if (!result?.ok) {
      activePointerId = null;
      propRoot.classList.remove("is-dragging");
      if (
        typeof propRoot.hasPointerCapture === "function" &&
        propRoot.hasPointerCapture(event.pointerId)
      ) {
        propRoot.releasePointerCapture(event.pointerId);
      }
    }
  } catch {
    activePointerId = null;
    propRoot.classList.remove("is-dragging");
  }
}

function updateDrag(event) {
  if (activePointerId === null || event.pointerId !== activePointerId) return;
  queueDragStep();
}

async function finishDrag(event) {
  if (activePointerId === null || !propRoot) return;
  if (event && event.pointerId !== activePointerId) return;
  const pointerId = activePointerId;
  activePointerId = null;
  propRoot.classList.remove("is-dragging");
  if (
    typeof propRoot.hasPointerCapture === "function" &&
    propRoot.hasPointerCapture(pointerId)
  ) {
    propRoot.releasePointerCapture(pointerId);
  }
  if (!propModel) return;
  try {
    await window.propWindowAPI.endDrag(propModel.propId);
  } catch {
    // Ignore drag-end failures while the window is tearing down.
  }
}

if (propRoot) {
  propRoot.addEventListener("pointerdown", (event) => {
    void beginDrag(event);
  });
  propRoot.addEventListener("pointermove", updateDrag);
  propRoot.addEventListener("pointerup", (event) => {
    void finishDrag(event);
  });
  propRoot.addEventListener("pointercancel", (event) => {
    void finishDrag(event);
  });
  propRoot.addEventListener("lostpointercapture", (event) => {
    void finishDrag(event);
  });
}

if (typeof window.propWindowAPI?.onModel === "function") {
  window.propWindowAPI.onModel((payload) => {
    applyModel(payload);
  });
}

if (returnButton) {
  returnButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  returnButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void returnToInventory();
  });
}

void loadModel();
