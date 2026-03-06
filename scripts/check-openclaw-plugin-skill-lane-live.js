"use strict";

const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  CALL_IDS,
  CONTRACT_VERSION,
  VIRTUAL_PET_LANE_ACTION,
} = require("../openclaw-plugin-skill-lane");

const PLUGIN_ID = "virtual-pet-lane";
const TOOL_NAME = "virtual_pet_lane";
const GATEWAY_METHOD_BUILD_CALL = "virtualpetlane.build_call";
const GATEWAY_METHOD_CONTRACT = "virtualpetlane.contract";
const SKILL_NAME = "virtual-pet-lane";
const OPENCLAW_PROFILE = toOptionalString(process.env.PET_OPENCLAW_LIVE_PROFILE, null);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function toOptionalString(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function shellQuote(value) {
  const text = typeof value === "string" ? value : String(value ?? "");
  return `'${text.replace(/'/g, `'\"'\"'`)}'`;
}

function openclawPrefix() {
  if (!OPENCLAW_PROFILE) return "openclaw";
  return `openclaw --profile ${shellQuote(OPENCLAW_PROFILE)}`;
}

function execFileAsync(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        const nextError = error;
        nextError.stdout = stdout;
        nextError.stderr = stderr;
        reject(nextError);
        return;
      }
      resolve({
        stdout,
        stderr,
      });
    });
  });
}

async function runWsl(command, timeoutMs = 120000) {
  return execFileAsync(
    "wsl",
    ["bash", "-lc", command],
    {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 16,
      windowsHide: true,
    }
  );
}

async function resolveWslHomePath() {
  const { stdout } = await runWsl("printf %s \"$HOME\"", 15000);
  const homePath = toOptionalString(stdout, null);
  assert(homePath, "failed to resolve WSL home directory");
  return homePath;
}

function parseJson(text, context) {
  const source = toOptionalString(text, "") || "";
  try {
    return JSON.parse(source);
  } catch (error) {
    const objectStart = source.indexOf("{");
    const objectEnd = source.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      const candidate = source.slice(objectStart, objectEnd + 1);
      try {
        return JSON.parse(candidate);
      } catch {}
    }
    throw new Error(`${context} did not return valid JSON: ${error.message}`);
  }
}

function findPluginRecord(payload, pluginId) {
  if (!payload || typeof payload !== "object") return null;
  const list = Array.isArray(payload.plugins) ? payload.plugins : [];
  return list.find((entry) => entry && entry.id === pluginId) || null;
}

function findSkillRecord(payload, skillName) {
  if (!payload || typeof payload !== "object") return null;
  const list = Array.isArray(payload.skills) ? payload.skills : [];
  return list.find((entry) => entry && entry.name === skillName) || null;
}

function findActionShape(value) {
  if (!value || typeof value !== "object") return null;
  if (
    value.type === VIRTUAL_PET_LANE_ACTION &&
    value.route === VIRTUAL_PET_LANE_ACTION &&
    value.payload &&
    typeof value.payload === "object"
  ) {
    return value;
  }
  for (const nextValue of Object.values(value)) {
    const found = findActionShape(nextValue);
    if (found) return found;
  }
  return null;
}

async function resolveWslPath(windowsPath) {
  const normalized = path.resolve(windowsPath).replace(/\\/g, "/");
  try {
    const { stdout } = await runWsl(`wslpath -a ${shellQuote(normalized)}`, 15000);
    const converted = toOptionalString(stdout, null);
    if (converted) return converted;
  } catch {}

  const driveMatch = normalized.match(/^([a-zA-Z]):\/(.*)$/);
  if (!driveMatch) {
    throw new Error(`unable to convert Windows path to WSL path: ${normalized}`);
  }
  return `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`;
}

async function wslDirectoryExists(wslPath) {
  try {
    await runWsl(`[ -d ${shellQuote(wslPath)} ]`, 15000);
    return true;
  } catch {
    return false;
  }
}

function listPluginFiles(rootDir, relativePath = "") {
  const absolutePath = path.join(rootDir, relativePath);
  const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const nextRelative = relativePath ? path.join(relativePath, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...listPluginFiles(rootDir, nextRelative));
      continue;
    }
    if (entry.isFile()) {
      files.push(nextRelative);
    }
  }
  return files;
}

async function stagePluginIntoWsl(pluginRootWindows) {
  const wslHome = await resolveWslHomePath();
  const profileLabel = OPENCLAW_PROFILE || "default";
  const targetRoot = `${wslHome}/.openclaw/virtual-pet-plugin-src/${profileLabel}`;
  await runWsl(`rm -rf ${shellQuote(targetRoot)} && mkdir -p ${shellQuote(targetRoot)}`, 20000);
  const files = listPluginFiles(pluginRootWindows);
  for (const relativeFile of files) {
    const sourceAbsolute = path.join(pluginRootWindows, relativeFile);
    const targetRelative = relativeFile.replace(/\\/g, "/");
    const targetAbsolute = `${targetRoot}/${targetRelative}`;
    const targetDir = targetAbsolute.slice(0, Math.max(0, targetAbsolute.lastIndexOf("/")));
    if (targetDir) {
      await runWsl(`mkdir -p ${shellQuote(targetDir)}`, 15000);
    }
    const encoded = fs.readFileSync(sourceAbsolute).toString("base64");
    await runWsl(`printf %s ${shellQuote(encoded)} | base64 -d > ${shellQuote(targetAbsolute)}`, 30000);
  }
  return targetRoot;
}

async function checkOpenClawAvailability() {
  await runWsl("command -v openclaw >/dev/null", 15000);
}

async function installAndEnablePlugin(pluginRootWslPath) {
  const profileExtensionsPath = OPENCLAW_PROFILE
    ? `$HOME/.openclaw-${OPENCLAW_PROFILE}/extensions/${PLUGIN_ID}`
    : null;
  await runWsl(
    `rm -rf "$HOME/.openclaw/extensions/${PLUGIN_ID}"${
      profileExtensionsPath ? ` "${profileExtensionsPath}"` : ""
    }`,
    15000
  ).catch(() => {});
  try {
    await runWsl(`${openclawPrefix()} plugins install ${shellQuote(pluginRootWslPath)}`);
  } catch (error) {
    const combined = `${error?.stdout || ""}\n${error?.stderr || ""}`.toLowerCase();
    const alreadyInstalled =
      combined.includes("already installed") ||
      combined.includes("already exists") ||
      combined.includes("already linked");
    if (!alreadyInstalled) {
      throw error;
    }
  }
  await runWsl(`${openclawPrefix()} plugins enable ${PLUGIN_ID}`);
}

async function readPluginRecord() {
  const listRaw = await runWsl(`${openclawPrefix()} plugins list --json`);
  const listJson = parseJson(listRaw.stdout, "openclaw plugins list");
  const plugin = findPluginRecord(listJson, PLUGIN_ID);
  assert(
    plugin,
    `plugin ${PLUGIN_ID} missing from openclaw plugins list${
      OPENCLAW_PROFILE ? ` (profile=${OPENCLAW_PROFILE})` : ""
    }`
  );
  assert(plugin.enabled === true, `plugin ${PLUGIN_ID} should be enabled`);
  assert(
    Array.isArray(plugin.toolNames) && plugin.toolNames.includes(TOOL_NAME),
    `plugin ${PLUGIN_ID} should expose tool ${TOOL_NAME}`
  );
  assert(
    Array.isArray(plugin.gatewayMethods) &&
      plugin.gatewayMethods.includes(GATEWAY_METHOD_BUILD_CALL) &&
      plugin.gatewayMethods.includes(GATEWAY_METHOD_CONTRACT),
    `plugin ${PLUGIN_ID} should expose gateway methods ${GATEWAY_METHOD_BUILD_CALL} and ${GATEWAY_METHOD_CONTRACT}`
  );
  return plugin;
}

async function readPluginInfo() {
  const infoRaw = await runWsl(`${openclawPrefix()} plugins info --json ${PLUGIN_ID}`);
  const infoJson = parseJson(infoRaw.stdout, "openclaw plugins info");
  const plugin = infoJson?.plugin && typeof infoJson.plugin === "object" ? infoJson.plugin : infoJson;
  assert(plugin && plugin.id === PLUGIN_ID, "openclaw plugins info should return the installed plugin");
  return plugin;
}

async function readSkillRecord() {
  const skillsRaw = await runWsl(`${openclawPrefix()} skills list --json`);
  const skillsJson = parseJson(skillsRaw.stdout, "openclaw skills list");
  const skill = findSkillRecord(skillsJson, SKILL_NAME);
  assert(
    skill,
    `skill ${SKILL_NAME} missing from openclaw skills list${
      OPENCLAW_PROFILE ? ` (profile=${OPENCLAW_PROFILE})` : ""
    }`
  );
  return skill;
}

async function tryGatewayRoundTrip() {
  try {
    await runWsl(`${openclawPrefix()} gateway health --json`, 10000);
  } catch {
    console.log(
      `[openclaw-plugin-skill-lane-live] gateway round-trip skipped (${
        OPENCLAW_PROFILE ? `profile=${OPENCLAW_PROFILE}` : "default profile"
      })`
    );
    return;
  }

  const params = {
    contractVersion: CONTRACT_VERSION,
    call: CALL_IDS.statusRead,
    correlationId: `live-status-${Date.now()}`,
    payload: {
      scope: "bridge_summary",
    },
  };
  let callRaw;
  try {
    callRaw = await runWsl(
      `${openclawPrefix()} gateway call ${GATEWAY_METHOD_BUILD_CALL} --json --params ${shellQuote(
        JSON.stringify(params)
      )}`,
      20000
    );
  } catch (error) {
    const combined = `${error?.stdout || ""}\n${error?.stderr || ""}`.toLowerCase();
    if (combined.includes("unknown method")) {
      console.log(
        `[openclaw-plugin-skill-lane-live] gateway round-trip skipped (${GATEWAY_METHOD_BUILD_CALL} not loaded yet; restart gateway to enable plugin RPC methods)`
      );
      return;
    }
    throw error;
  }
  const callJson = parseJson(callRaw.stdout, "openclaw gateway call virtualpetlane.build_call");
  const action = findActionShape(callJson);
  assert(action, "gateway build_call should return a virtual_pet_lane_call action payload");
  assert(action.payload?.contractVersion === CONTRACT_VERSION, "gateway action contractVersion mismatch");
  assert(action.payload?.call === CALL_IDS.statusRead, "gateway action call mismatch");
}

async function run() {
  const pluginRoot = path.join(__dirname, "..", "openclaw-plugin", "virtual-pet");
  const manifestPath = path.join(pluginRoot, "openclaw.plugin.json");
  const packagePath = path.join(pluginRoot, "package.json");
  const skillPath = path.join(pluginRoot, "skills", "virtual-pet-lane", "SKILL.md");
  assert(fs.existsSync(manifestPath), "plugin manifest missing");
  assert(fs.existsSync(packagePath), "plugin package.json missing");
  assert(fs.existsSync(skillPath), "plugin skill file missing");

  await checkOpenClawAvailability();
  console.log(
    `[openclaw-plugin-skill-lane-live] profile=${OPENCLAW_PROFILE || "default"}`
  );
  const resolvedWslPath = await resolveWslPath(pluginRoot);
  const pluginRootWslPath = (await wslDirectoryExists(resolvedWslPath))
    ? resolvedWslPath
    : await stagePluginIntoWsl(pluginRoot);
  if (pluginRootWslPath !== resolvedWslPath) {
    console.log(`[openclaw-plugin-skill-lane-live] staged plugin into ${pluginRootWslPath}`);
  }
  await installAndEnablePlugin(pluginRootWslPath);
  await readPluginRecord();
  await readPluginInfo();
  await readSkillRecord();
  await tryGatewayRoundTrip();
  console.log("[openclaw-plugin-skill-lane-live] checks passed");
}

if (require.main === module) {
  run().catch((error) => {
    const details = `${error?.message || String(error)}${
      error?.stderr ? `\n${String(error.stderr).trim()}` : ""
    }`;
    console.error(details);
    process.exit(1);
  });
}

module.exports = {
  run,
};
