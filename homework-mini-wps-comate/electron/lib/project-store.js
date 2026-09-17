const fs = require("node:fs");
const {
  ensureAppDataLayout,
  getAppDataRoot,
} = require("./paths");
const path = require("node:path");

function getProjectStorePath() {
  return path.join(getAppDataRoot(), "config", "project.json");
}

function defaultDoc() {
  return {
    version: 1,
    projectRoot: null,
    whitelist: [],
  };
}

function readProjectConfig() {
  ensureAppDataLayout();
  const file = getProjectStorePath();
  if (!fs.existsSync(file)) return defaultDoc();
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      version: 1,
      projectRoot:
        typeof data.projectRoot === "string" && data.projectRoot
          ? data.projectRoot
          : null,
      whitelist: Array.isArray(data.whitelist)
        ? data.whitelist.filter((p) => typeof p === "string" && p)
        : [],
    };
  } catch {
    return defaultDoc();
  }
}

function writeProjectConfig(doc) {
  ensureAppDataLayout();
  fs.writeFileSync(getProjectStorePath(), JSON.stringify(doc, null, 2), "utf8");
  return doc;
}

function getAllowedRoots() {
  const doc = readProjectConfig();
  const roots = [];
  if (doc.projectRoot) roots.push(doc.projectRoot);
  for (const p of doc.whitelist) {
    if (p && !roots.includes(p)) roots.push(p);
  }
  return roots;
}

function setProjectRoot(projectRoot) {
  const doc = readProjectConfig();
  doc.projectRoot = projectRoot ? String(projectRoot) : null;
  // Keep whitelist entries that aren't the same as root
  doc.whitelist = doc.whitelist.filter((p) => p !== doc.projectRoot);
  return writeProjectConfig(doc);
}

function clearProject() {
  return writeProjectConfig(defaultDoc());
}

function addWhitelistPath(dirPath) {
  const doc = readProjectConfig();
  const p = String(dirPath || "").trim();
  if (!p) throw new Error("路径无效");
  if (doc.projectRoot === p) return doc;
  if (!doc.whitelist.includes(p)) doc.whitelist.push(p);
  return writeProjectConfig(doc);
}

function removeWhitelistPath(dirPath) {
  const doc = readProjectConfig();
  doc.whitelist = doc.whitelist.filter((p) => p !== dirPath);
  return writeProjectConfig(doc);
}

module.exports = {
  getProjectStorePath,
  readProjectConfig,
  getAllowedRoots,
  setProjectRoot,
  clearProject,
  addWhitelistPath,
  removeWhitelistPath,
};
