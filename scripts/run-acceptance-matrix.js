"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");
const ARTIFACTS_DIR = path.join(PROJECT_ROOT, "docs", "plan", "artifacts");
const JSON_ARTIFACT_PATH = path.join(ARTIFACTS_DIR, "08-acceptance-smoke.json");
const MARKDOWN_ARTIFACT_PATH = path.join(ARTIFACTS_DIR, "08-acceptance-smoke.md");

const CASES = Object.freeze([
  {
    id: "D02-capability-registry",
    deliverable: "02-architecture-capability-registry",
    scenario: "Capability registry reports healthy, degraded, failed, and stopped states coherently.",
    script: "scripts/check-capability-registry.js",
  },
  {
    id: "D02b-extension-framework",
    deliverable: "02b-extension-framework-and-pack-sdk",
    scenario: "Extension discovery, invalid-manifest warning, trust warning, and prop intent flow remain intact.",
    script: "scripts/check-extension-pack-registry.js",
  },
  {
    id: "Movement-runtime-invariants",
    deliverable: "core-runtime-invariants",
    scenario: "Main-process drag authority, fixed-size bounds, secure preload, and shared layout contract stay intact.",
    script: "scripts/check-runtime-invariants.js",
  },
  {
    id: "D03-contract-router",
    deliverable: "03-pet-core-events-intents-suggestions",
    scenario: "Event -> intent -> suggestion routing remains deterministic across status, announcement, media, and extension flows.",
    script: "scripts/check-contract-router.js",
  },
  {
    id: "D04-openclaw-bridge",
    deliverable: "04-openclaw-bridge-spec",
    scenario: "Bridge online, timeout, offline, and guardrail cases stay deterministic.",
    script: "scripts/check-openclaw-bridge.js",
  },
  {
    id: "D05-memory-pipeline",
    deliverable: "05-memory-pipeline-and-obsidian-adapter",
    scenario: "Memory observation, promotion, mutation guardrails, and local fallback continue to work.",
    script: "scripts/check-memory-pipeline.js",
  },
  {
    id: "D05a-settings-runtime",
    deliverable: "05a-obsidian-workspace-bootstrap-and-connectivity",
    scenario: "Settings precedence, path validation warnings, and persistence patches remain deterministic.",
    script: "scripts/check-settings-runtime.js",
  },
  {
    id: "D06-integrations",
    deliverable: "06-integrations-freshrss-spotify",
    scenario: "Spotify/FreshRSS fallback logic, track-rating payloads, and ranking behavior remain deterministic.",
    script: "scripts/check-integration-runtime.js",
  },
  {
    id: "D06-local-media-sensor",
    deliverable: "06-integrations-freshrss-spotify",
    scenario: "Windows media source labeling and output-route classification remain stable.",
    script: "scripts/check-windows-media-sensor.js",
  },
  {
    id: "D07-state-runtime",
    deliverable: "07-state-system-extension-guide",
    scenario: "Reading, PoolPlay, music-mode priority, FreshRSS reading, and missing-asset fallback remain stable.",
    script: "scripts/check-state-runtime.js",
  },
  {
    id: "D07b-dialog-runtime",
    deliverable: "07b-dialog-surface-and-minimal-offline-loop",
    scenario: "Offline dialog templates remain deterministic for greeting, music, and reading prompts.",
    script: "scripts/check-dialog-runtime.js",
  },
  {
    id: "D11a-shell-observability",
    deliverable: "11a-openclaw-memory-observability-surface",
    scenario: "Shared shell tab routing and observability snapshot rows stay deterministic.",
    script: "scripts/check-shell-observability.js",
  },
  {
    id: "D11b-setup-bootstrap",
    deliverable: "11b-guided-pet-setup-and-markdown-bootstrap",
    scenario: "Setup local-write policy, observed OpenClaw target, managed Markdown preview, and block replacement stay deterministic.",
    script: "scripts/check-setup-bootstrap.js",
  },
  {
    id: "D11c-repair-actions",
    deliverable: "11c-repair-actions-and-provenance-visibility",
    scenario: "Status detail subjects keep guided-vs-observed-only repair actions and path/provenance visibility bounded.",
    script: "scripts/check-shell-repair-actions.js",
  },
  {
    id: "D11d-settings-editor",
    deliverable: "11d-settings-editor-and-service-controls",
    scenario: "Advanced settings snapshot and bounded patch validation persist only allowed keys.",
    script: "scripts/check-shell-settings-editor.js",
  },
  {
    id: "D12a-dialog-openclaw-parity",
    deliverable: "12a-real-openclaw-dialog-parity",
    scenario: "Dialog bridge context carries bounded recent turns and follow-up requests retain continuity context.",
    script: "scripts/check-dialog-openclaw-parity.js",
  },
  {
    id: "D12b-chat-shell-presence",
    deliverable: "12b-chat-shell-and-conversation-presence",
    scenario: "Tray open-chat routing, dialog presence hold wiring, and proactive suppression/cooldown contracts remain deterministic.",
    script: "scripts/check-chat-shell-presence.js",
  },
  {
    id: "D12c-guarded-pet-command-lane",
    deliverable: "12c-guarded-openclaw-pet-command-lane",
    scenario:
      "Signed pet command envelopes enforce auth/replay/expiry guards and execute only bounded allowlist actions.",
    script: "scripts/check-openclaw-pet-command-lane.js",
  },
  {
    id: "D12d-openclaw-plugin-skill-lane",
    deliverable: "12d-openclaw-plugin-and-skill-virtual-pet-lane",
    scenario:
      "Versioned plugin+skill lane routes command requests through guarded authority, returns bounded status reads, and defers memory intent deterministically.",
    script: "scripts/check-openclaw-plugin-skill-lane.js",
  },
  {
    id: "D12e-guided-openclaw-pairing",
    deliverable: "12e-guided-openclaw-connectivity-and-pairing",
    scenario:
      "Guided pairing state machine supports QR and copy-code paths with deterministic probe and bridge-detail actions.",
    script: "scripts/check-openclaw-pairing-guidance.js",
  },
  {
    id: "D13a-offline-identity-recall",
    deliverable: "13a-offline-identity-and-recent-recall",
    scenario:
      "Offline name/birthday recall and bounded recent highlights stay deterministic with evidence-tag metadata.",
    script: "scripts/check-offline-recall.js",
  },
  {
    id: "D13b-persona-snapshot-provenance",
    deliverable: "13b-persona-snapshot-synthesis-and-provenance",
    scenario:
      "Derived persona snapshot/export contracts stay bounded and deterministic with explicit degraded reasons and provenance tags.",
    script: "scripts/check-persona-snapshot.js",
  },
  {
    id: "D13c-persona-aware-offline-proactive",
    deliverable: "13c-persona-aware-offline-dialog-and-proactive-behavior",
    scenario:
      "Offline persona-style shaping and proactive suppression/backoff/repeat-guard behavior remain deterministic with explicit policy metadata.",
    script: "scripts/check-persona-offline-proactive.js",
  },
  {
    id: "D13d-online-reflection-runtime-sync",
    deliverable: "13d-online-reflection-and-runtime-sync",
    scenario:
      "Reflection cadence, reflection-only intent gating, guarded apply caps, and memory-runtime observability remain deterministic.",
    script: "scripts/check-online-reflection-runtime.js",
  },
  {
    id: "D14a-deliberate-roam-monitor-avoidance",
    deliverable: "14a-deliberate-roam-policy-and-monitor-avoidance",
    scenario:
      "Desktop roam pacing and bounded monitor-avoidance memory remain deterministic with explicit fallback and re-entry reasons.",
    script: "scripts/check-roam-policy.js",
  },
  {
    id: "D14ab-active-window-avoidance",
    deliverable: "14ab-active-window-avoidance",
    scenario:
      "Foreground-window inspect anchors, manual drag-off window cooldown memory, and strict avoid clipping fallback remain deterministic.",
    script: "scripts/check-roam-policy.js",
  },
  {
    id: "Layout-assets",
    deliverable: "core-renderer-assets",
    scenario: "Layout bounds and required sprite assets remain internally consistent.",
    script: "scripts/check-layout.js",
  },
  {
    id: "Sprite-assets",
    deliverable: "core-renderer-assets",
    scenario: "Character asset manifests still include all required directions and states.",
    script: "scripts/check-assets.js",
  },
]);

function runCase(checkCase) {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const stdoutLines = [];
  const stderrLines = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args) => {
    stdoutLines.push(args.map(String).join(" "));
  };
  console.error = (...args) => {
    stderrLines.push(args.map(String).join(" "));
  };

  let status = "passed";
  let exitCode = 0;
  try {
    const modulePath = path.join(PROJECT_ROOT, checkCase.script);
    const imported = require(modulePath);
    if (!imported || typeof imported.run !== "function") {
      throw new Error(`script does not export run(): ${checkCase.script}`);
    }
    const outcome = imported.run();
    if (outcome && typeof outcome.then === "function") {
      return Promise.resolve(outcome)
        .then(() => finalizeRunCase({
          checkCase,
          startedAt,
          startedMs,
          status,
          exitCode,
          stdoutLines,
          stderrLines,
          originalLog,
          originalError,
        }))
        .catch((error) =>
          finalizeRunCase({
            checkCase,
            startedAt,
            startedMs,
            status: "failed",
            exitCode: 1,
            stdoutLines,
            stderrLines: [...stderrLines, error.message || String(error)],
            originalLog,
            originalError,
          })
        );
    }
  } catch (error) {
    status = "failed";
    exitCode = 1;
    stderrLines.push(error.message || String(error));
  }

  return finalizeRunCase({
    checkCase,
    startedAt,
    startedMs,
    status,
    exitCode,
    stdoutLines,
    stderrLines,
    originalLog,
    originalError,
  });
}

function finalizeRunCase({
  checkCase,
  startedAt,
  startedMs,
  status,
  exitCode,
  stdoutLines,
  stderrLines,
  originalLog,
  originalError,
}) {
  console.log = originalLog;
  console.error = originalError;
  return {
    id: checkCase.id,
    deliverable: checkCase.deliverable,
    scenario: checkCase.scenario,
    command: `node ${checkCase.script.replace(/\\/g, "/")}`,
    status,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedMs,
    exitCode,
    stdout: stdoutLines.join("\n").trim(),
    stderr: stderrLines.join("\n").trim(),
  };
}

function buildMarkdownReport(report) {
  const lines = [
    "# D08 Acceptance Smoke Report",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Runner: ${report.runner}`,
    `- Summary: ${report.summary.passed}/${report.summary.total} automated checks passed`,
    "",
    "| ID | Deliverable | Status | Command | Evidence |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const result of report.results) {
    const evidence = result.stdout || result.stderr || "(no output)";
    lines.push(
      `| ${result.id} | ${result.deliverable} | ${result.status} | \`${result.command}\` | \`${evidence.replace(/\|/g, "\\|")}\` |`
    );
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function ensureArtifactsDir() {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

function writeArtifacts(report) {
  ensureArtifactsDir();
  fs.writeFileSync(JSON_ARTIFACT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(MARKDOWN_ARTIFACT_PATH, buildMarkdownReport(report), "utf8");
}

async function run() {
  const results = [];
  for (const checkCase of CASES) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await runCase(checkCase));
  }
  const passed = results.filter((result) => result.status === "passed").length;
  const report = {
    generatedAt: new Date().toISOString(),
    runner: "Codex automated smoke",
    summary: {
      total: results.length,
      passed,
      failed: results.length - passed,
    },
    results,
  };

  writeArtifacts(report);

  for (const result of results) {
    const evidence = result.stdout || result.stderr || "(no output)";
    console.log(`${result.status.toUpperCase()} ${result.id}: ${evidence}`);
  }
  console.log(
    `[acceptance-matrix] ${report.summary.passed}/${report.summary.total} automated checks passed`
  );

  if (report.summary.failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
