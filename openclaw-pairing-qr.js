"use strict";

const qrcodeGenerator = require("qrcode-generator");

function toOptionalString(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function toPositiveInteger(value, fallback, min = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < min) return fallback;
  return Math.max(min, Math.round(numeric));
}

function buildPairingQrSvg(payload, options = {}) {
  const normalizedPayload = toOptionalString(payload, null);
  if (!normalizedPayload) return null;
  try {
    const typeNumber = toPositiveInteger(options.typeNumber, 0, 0);
    const cellSize = toPositiveInteger(options.cellSize, 8, 1);
    const margin = toPositiveInteger(options.margin, 2, 0);
    const errorCorrectionLevel =
      toOptionalString(options.errorCorrectionLevel, "M") || "M";
    const qr = qrcodeGenerator(typeNumber, errorCorrectionLevel);
    qr.addData(normalizedPayload, "Byte");
    qr.make();
    return qr.createSvgTag({
      cellSize,
      margin,
      scalable: true,
    });
  } catch {
    return null;
  }
}

function buildPairingQrDataUrl(payload, options = {}) {
  const svg = buildPairingQrSvg(payload, options);
  if (!svg) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

module.exports = {
  buildPairingQrDataUrl,
  buildPairingQrSvg,
};

