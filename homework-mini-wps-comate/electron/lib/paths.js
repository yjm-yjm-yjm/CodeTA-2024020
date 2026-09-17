const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const APP_DATA_DIR_NAME = ".mini-wps-comate";

function getAppDataRoot() {
  return path.join(os.homedir(), APP_DATA_DIR_NAME);
}

function ensureAppDataLayout() {
  const root = getAppDataRoot();
  const dirs = ["config", "sessions", "skills", "logs"];
  for (const name of dirs) {
    fs.mkdirSync(path.join(root, name), { recursive: true });
  }
  return root;
}

function getAuthStorePath() {
  return path.join(getAppDataRoot(), "config", "auth.json");
}

function getModelsStorePath() {
  return path.join(getAppDataRoot(), "config", "models.json");
}

function getSettingsStorePath() {
  return path.join(getAppDataRoot(), "config", "settings.json");
}

function getPiAgentDir() {
  return path.join(getAppDataRoot(), "pi-agent");
}

module.exports = {
  APP_DATA_DIR_NAME,
  getAppDataRoot,
  ensureAppDataLayout,
  getAuthStorePath,
  getModelsStorePath,
  getSettingsStorePath,
  getPiAgentDir,
};
