"use strict";

const { buildPairingQrDataUrl, buildPairingQrSvg } = require("../openclaw-pairing-qr");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const payloadA = "openclaw://pair?pairingId=pair_alpha&code=ABCD-EF12";
  const payloadB = "openclaw://pair?pairingId=pair_beta&code=9876-XYZ1";

  const svg = buildPairingQrSvg(payloadA);
  assert(typeof svg === "string" && svg.includes("<svg"), "QR SVG should be generated for valid payload");

  const dataUrlA = buildPairingQrDataUrl(payloadA);
  assert(
    typeof dataUrlA === "string" &&
      dataUrlA.startsWith("data:image/svg+xml;charset=utf-8,"),
    "QR data URL should be generated for valid payload"
  );
  const decodedA = decodeURIComponent(dataUrlA.replace("data:image/svg+xml;charset=utf-8,", ""));
  assert(decodedA.includes("<svg"), "QR data URL should contain SVG markup");

  const dataUrlB = buildPairingQrDataUrl(payloadB);
  assert(typeof dataUrlB === "string", "Second QR data URL should be generated");
  assert(dataUrlA !== dataUrlB, "Different payloads should produce different QR outputs");

  assert(buildPairingQrDataUrl(null) === null, "Null payload should not produce QR output");
  assert(buildPairingQrDataUrl("   ") === null, "Blank payload should not produce QR output");

  console.log("[openclaw-pairing-qr] checks passed");
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error.message || String(error));
    process.exit(1);
  }
}

module.exports = {
  run,
};

