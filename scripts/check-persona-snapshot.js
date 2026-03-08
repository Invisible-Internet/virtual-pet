"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  MAX_EXPORT_BYTES,
  PERSONA_EXPORT_SCHEMA_VERSION,
  PERSONA_SNAPSHOT_SCHEMA_VERSION,
  buildPersonaExport,
  buildPersonaSnapshot,
} = require("../persona-snapshot");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} (expected "${expected}", got "${actual}")`);
  }
}

function writeFile(root, fileId, content) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, fileId), content, "utf8");
}

function createCanonicalWorkspace(root) {
  writeFile(
    root,
    "SOUL.md",
    "# SOUL\n\n## Core Truths\nStay kind and curious.\n"
  );
  writeFile(
    root,
    "STYLE.md",
    "# Voice & Style Guide\n\n**Tone:**\n- gentle\n- curious\n- practical\n"
  );
  writeFile(
    root,
    "IDENTITY.md",
    "# IDENTITY\n\n- Name: Nori\n- Persona Profile: bookish_helper\n- Pronouns: she/her\n- Birthday: 2025-05-01\n- Creature: Soft desk familiar\n- Vibe: warm, calm\n- Favorite color: teal\n- Favorite movie: Kiki's Delivery Service\n- Favorite song: Ocean Eyes\n- Favorite book: The Hobbit\n- Hobby: origami\n\n## Extra Offline Facts\n- Q: favorite snack | A: strawberries\n- Q: dream trip | A: Kyoto in spring\n"
  );
  writeFile(
    root,
    "USER.md",
    "# USER\n\n- Name: Mic\n- What to call you: Mic\n- Timezone: America/Phoenix\n"
  );
  writeFile(
    root,
    "MEMORY.md",
    "# MEMORY\n\n## Durable Facts\n- My name is `Nori`.\n"
  );
}

function runReadySnapshotTest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "virtual-pet-persona-ready-"));
  createCanonicalWorkspace(tempRoot);

  const snapshot = buildPersonaSnapshot({
    workspaceRoot: tempRoot,
    runtimeObservations: [
      {
        observationId: "obs-1",
        ts: "2026-03-07T10:00:00.000Z",
        tsMs: Date.parse("2026-03-07T10:00:00.000Z"),
        observationType: "question_response",
        source: "contract_user_message",
        correlationId: "corr-1",
        evidenceTag: "obs:question_response:status-check",
        payload: {
          text: "What happened?",
          responseText: "We reviewed status together.",
        },
      },
      {
        observationId: "obs-2",
        ts: "2026-03-07T10:05:00.000Z",
        tsMs: Date.parse("2026-03-07T10:05:00.000Z"),
        observationType: "spotify_playback",
        source: "spotify_playback",
        correlationId: "corr-2",
        evidenceTag: "spotify:night-drive",
        payload: {
          title: "Night Drive",
          artist: "Primea FM",
        },
      },
    ],
    memoryDir: "",
    memoryAvailable: true,
    ts: 1700000000000,
  });

  assertEqual(
    snapshot.schemaVersion,
    PERSONA_SNAPSHOT_SCHEMA_VERSION,
    "snapshot schema version mismatch"
  );
  assertEqual(snapshot.state, "ready", "snapshot should be ready with canonical inputs");
  assertEqual(snapshot.degradedReason, "none", "snapshot degraded reason should be none");
  assert(snapshot.fields.pet_name?.value === "Nori", "snapshot should include pet_name");
  assert(
    snapshot.fields.persona_profile_id?.value === "bookish_helper",
    "snapshot should include explicit persona profile id"
  );
  assert(
    snapshot.fields.pet_favorite_color?.value === "teal" && snapshot.fields.pet_hobby?.value === "origami",
    "snapshot should include favorite/hobby fields"
  );
  assert(
    Array.isArray(snapshot.fields.extra_offline_facts?.value) &&
      snapshot.fields.extra_offline_facts.value.some((entry) => entry.includes("favorite snack")),
    "snapshot should include extra offline fact pairs"
  );
  assert(
    Array.isArray(snapshot.fields.tone_keywords?.value) &&
      snapshot.fields.tone_keywords.value.includes("gentle"),
    "snapshot should include tone keywords"
  );
  assert(
    Array.isArray(snapshot.derivedFrom) && snapshot.derivedFrom.includes("STYLE.md"),
    "snapshot should include STYLE.md in derivedFrom"
  );

  const personaExport = buildPersonaExport({
    snapshot,
    mode: "online_dialog",
    ts: 1700000000500,
  });
  assertEqual(
    personaExport.schemaVersion,
    PERSONA_EXPORT_SCHEMA_VERSION,
    "persona export schema version mismatch"
  );
  assertEqual(personaExport.mode, "online_dialog", "persona export mode mismatch");
  assertEqual(personaExport.state, "ready", "persona export state mismatch");
  assert(
    Array.isArray(personaExport.facts) && personaExport.facts.length > 0,
    "persona export should include facts"
  );
  assert(
    Array.isArray(personaExport.facts) && personaExport.facts.length <= 12,
    "persona export facts should be bounded"
  );
  assert(
    Array.isArray(personaExport.styleHints) && personaExport.styleHints.length <= 6,
    "persona export style hints should be bounded"
  );
  assert(
    Array.isArray(personaExport.recentHighlights) && personaExport.recentHighlights.length <= 3,
    "persona export highlights should be bounded"
  );
  assert(
    Number.isFinite(Number(personaExport.byteSize)) && personaExport.byteSize <= MAX_EXPORT_BYTES,
    "persona export payload should stay bounded by bytes"
  );
  assert(
    personaExport.facts.every((entry) => typeof entry.provenanceTag === "string" && entry.provenanceTag.length > 0),
    "persona export facts should include provenance tags"
  );
  assert(
    personaExport.facts[0]?.key === "pet_name" &&
      personaExport.facts[1]?.key === "persona_profile_id",
    "persona export should prioritize key identity facts first"
  );

  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function runMissingCanonicalDegradedTest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "virtual-pet-persona-missing-"));
  createCanonicalWorkspace(tempRoot);
  fs.rmSync(path.join(tempRoot, "STYLE.md"), { force: true });

  const snapshot = buildPersonaSnapshot({
    workspaceRoot: tempRoot,
    runtimeObservations: [],
    memoryDir: "",
    memoryAvailable: true,
    ts: 1700000001000,
  });
  assertEqual(snapshot.state, "degraded", "snapshot should degrade when canonical file is missing");
  assertEqual(
    snapshot.degradedReason,
    "canonical_missing",
    "snapshot should report canonical_missing when required files are missing"
  );

  const personaExport = buildPersonaExport({
    snapshot,
    mode: "online_dialog",
    ts: 1700000001200,
  });
  assertEqual(personaExport.state, "degraded", "persona export should remain degraded");
  assertEqual(
    personaExport.degradedReason,
    "canonical_missing",
    "persona export degraded reason should match snapshot"
  );

  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function run() {
  runReadySnapshotTest();
  runMissingCanonicalDegradedTest();
  console.log("[persona-snapshot] checks passed");
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
