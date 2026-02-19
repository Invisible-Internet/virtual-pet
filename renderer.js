const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const PET_VISUAL_BOUNDS = Object.freeze({
  x: 50,
  y: 50,
  width: 220,
  height: 220,
});

let lastDevicePixelRatio = window.devicePixelRatio || 1;
let latestDiagnostics = null;
let diagnosticsEnabled = false;

async function loadRuntimeConfig() {
  if (typeof window.petAPI.getConfig !== "function") return;

  try {
    const config = await window.petAPI.getConfig();
    diagnosticsEnabled = Boolean(config?.diagnosticsEnabled);
  } catch {
    diagnosticsEnabled = false;
  }
}

loadRuntimeConfig();

if (typeof window.petAPI.onDiagnostics === "function") {
  window.petAPI.onDiagnostics((payload) => {
    latestDiagnostics = payload;
  });
}

function formatPoint(point) {
  if (!point) return "(n/a)";
  return `(${point.x}, ${point.y})`;
}

function formatRect(rect) {
  if (!rect) return "(n/a)";
  return `x:${rect.x} y:${rect.y} w:${rect.width} h:${rect.height}`;
}

function drawDebugOverlay(w, h) {
  if (!diagnosticsEnabled) return;

  ctx.save();

  // Tint the entire transparent window so its full hit area is visible.
  ctx.fillStyle = "rgba(255, 100, 40, 0.08)";
  ctx.fillRect(0, 0, w, h);

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 130, 50, 0.95)";
  ctx.strokeRect(0.5, 0.5, Math.max(0, w - 1), Math.max(0, h - 1));

  // Show where the pet art is expected inside the transparent window.
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(80, 220, 255, 0.95)";
  ctx.strokeRect(
    PET_VISUAL_BOUNDS.x + 0.5,
    PET_VISUAL_BOUNDS.y + 0.5,
    PET_VISUAL_BOUNDS.width,
    PET_VISUAL_BOUNDS.height
  );
  ctx.setLineDash([]);

  const d = latestDiagnostics;
  if (d) {
    const lines = [
      `kind: ${d.kind}${d.tick ? ` #${d.tick}` : ""}`,
      `cursor: ${formatPoint(d.cursor)}`,
      `target: ${formatPoint(d.target)}`,
      `clamped: ${formatPoint(d.clamped)}`,
      `clamp hit: x=${d.clampHit?.x ? "yes" : "no"} y=${d.clampHit?.y ? "yes" : "no"}`,
      `display: ${d.activeDisplay?.id ?? "n/a"} (${d.displaySource ?? "n/a"})`,
      `display bounds: ${formatRect(d.activeDisplay?.bounds)}`,
      `display scale: ${d.activeDisplay?.scaleFactor ?? "n/a"}`,
      `clamp area: ${d.clampAreaType ?? "n/a"} ${formatRect(d.clampArea)}`,
      `window before: ${formatPoint(d.windowPositionBefore || d.windowPosition)}`,
      `bounds before: ${formatRect(d.windowBoundsBefore || d.windowBounds)}`,
      `bounds after: ${formatRect(d.windowBoundsAfter)}`,
      `content before: ${formatRect(d.contentBoundsBefore)}`,
      `content after: ${formatRect(d.contentBoundsAfter)}`,
      `size corrected: ${d.sizeCorrected ? "yes" : "no"}`,
      `drag offset: ${formatPoint(d.dragOffset)}`,
      `renderer dpr: ${(window.devicePixelRatio || 1).toFixed(2)}`,
      `viewport: ${w}x${h}`,
    ];

    ctx.font = "12px Consolas, monospace";
    ctx.textBaseline = "top";

    const panelWidth = Math.min(
      w - 8,
      Math.max(...lines.map((line) => ctx.measureText(line).width)) + 12
    );
    const panelHeight = lines.length * 15 + 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.fillRect(4, 4, Math.max(0, panelWidth), Math.max(0, panelHeight));

    ctx.fillStyle = "rgba(245, 245, 245, 0.98)";
    lines.forEach((line, i) => {
      ctx.fillText(line, 10, 8 + i * 15);
    });
  }

  ctx.restore();
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = Math.max(1, Math.floor(canvas.clientWidth));
  const cssHeight = Math.max(1, Math.floor(canvas.clientHeight));

  canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
  canvas.height = Math.max(1, Math.floor(cssHeight * dpr));

  // Draw in CSS px while retaining sharpness on high DPI displays.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lastDevicePixelRatio = dpr;
}
window.addEventListener("resize", resize);
resize();

function draw() {
  const currentDpr = window.devicePixelRatio || 1;
  if (currentDpr !== lastDevicePixelRatio) {
    resize();
  }

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  ctx.clearRect(0, 0, w, h);
  const cx = PET_VISUAL_BOUNDS.x + PET_VISUAL_BOUNDS.width / 2;
  const cy = PET_VISUAL_BOUNDS.y + PET_VISUAL_BOUNDS.height / 2;

  ctx.fillStyle = "rgba(20, 20, 30, 0.85)";
  ctx.beginPath();
  ctx.roundRect(cx - 110, cy - 110, 220, 220, 30);
  ctx.fill();

  ctx.fillStyle = "rgba(230, 240, 255, 0.95)";
  ctx.beginPath(); ctx.ellipse(cx - 45, cy - 20, 18, 18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 45, cy - 20, 18, 18, 0, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = "rgba(230, 240, 255, 0.9)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy + 40, 28, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  drawDebugOverlay(w, h);

  requestAnimationFrame(draw);
}
draw();

let dragging = false;

function endDrag(e) {
  if (!dragging) return;

  dragging = false;
  window.petAPI.endDrag();

  if (!e) return;

  try {
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  } catch {}
}

canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  window.petAPI.beginDrag();

  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {}

  e.preventDefault();
});

canvas.addEventListener("pointermove", () => {
  if (!dragging) return;
  window.petAPI.drag();
});

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
window.addEventListener("blur", () => endDrag());
