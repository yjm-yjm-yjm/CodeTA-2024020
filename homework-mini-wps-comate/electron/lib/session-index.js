const fs = require("node:fs");
const path = require("node:path");
const { ensureAppDataLayout, getAppDataRoot } = require("./paths");

function getSessionsDir() {
  return path.join(getAppDataRoot(), "sessions");
}

function getSessionIndexPath() {
  return path.join(getSessionsDir(), "index.json");
}

function defaultIndex() {
  return { version: 1, activeId: null, sessions: [] };
}

function readIndex() {
  ensureAppDataLayout();
  const file = getSessionIndexPath();
  if (!fs.existsSync(file)) return defaultIndex();
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      version: 1,
      activeId: data.activeId || null,
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
    };
  } catch {
    return defaultIndex();
  }
}

function writeIndex(index) {
  ensureAppDataLayout();
  fs.mkdirSync(getSessionsDir(), { recursive: true });
  fs.writeFileSync(getSessionIndexPath(), JSON.stringify(index, null, 2), "utf8");
}

function upsertMeta(meta) {
  const index = readIndex();
  const i = index.sessions.findIndex((s) => s.id === meta.id);
  if (i >= 0) {
    index.sessions[i] = { ...index.sessions[i], ...meta };
  } else {
    index.sessions.push(meta);
  }
  writeIndex(index);
  return index;
}

function setActiveId(id) {
  const index = readIndex();
  index.activeId = id;
  writeIndex(index);
  return index;
}

function removeMeta(id) {
  const index = readIndex();
  index.sessions = index.sessions.filter((s) => s.id !== id);
  if (index.activeId === id) index.activeId = null;
  writeIndex(index);
  return index;
}

function renameMeta(id, title) {
  const index = readIndex();
  const item = index.sessions.find((s) => s.id === id);
  if (!item) throw new Error("会话不存在");
  item.title = String(title || "").trim() || "未命名会话";
  item.updatedAt = new Date().toISOString();
  writeIndex(index);
  return item;
}

function pinMeta(id, pinned) {
  const index = readIndex();
  const item = index.sessions.find((s) => s.id === id);
  if (!item) throw new Error("会话不存在");
  item.pinned = Boolean(pinned);
  item.updatedAt = new Date().toISOString();
  writeIndex(index);
  return item;
}

module.exports = {
  getSessionsDir,
  getSessionIndexPath,
  readIndex,
  writeIndex,
  upsertMeta,
  setActiveId,
  removeMeta,
  renameMeta,
  pinMeta,
};
