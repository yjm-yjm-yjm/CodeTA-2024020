const fs = require("node:fs");
const path = require("node:path");
const { getRawModelConfig } = require("./model-store");
const {
  ensureAppDataLayout,
  getAppDataRoot,
  getPiAgentDir,
} = require("./paths");
const sessionIndex = require("./session-index");
const projectStore = require("./project-store");
const {
  buildGuardedToolDefinitions,
  describeProjectForPrompt,
} = require("./guarded-tools");
const { summarizeTitle, summarizeTitleWithAi, normalizeSessionTitle } = require("./title-summary");

/** @type {import('@earendil-works/pi-coding-agent').AgentSession | null} */
let session = null;
/** @type {(() => void) | null} */
let unsubscribe = null;
/** @type {((event: Record<string, unknown>) => void) | null} */
let emitToRenderer = null;
let streaming = false;
let queueLength = 0;
let currentAssistantId = null;
/** @type {string | null} */
let activeSessionId = null;

function setEmitter(fn) {
  emitToRenderer = fn;
}

function emit(event) {
  if (emitToRenderer) emitToRenderer(event);
}

function extractText(message) {
  if (!message) return "";
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((p) => p && (p.type === "text" || typeof p.text === "string"))
      .map((p) => p.text || "")
      .join("");
  }
  return "";
}

function messagesToUi(messages) {
  return (messages || [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m, i) => ({
      id: `${m.role}-${i}-${m.timestamp || i}`,
      role: m.role,
      text: extractText(m),
    }));
}

function syncPiModelsJson() {
  ensureAppDataLayout();
  const agentDir = getPiAgentDir();
  fs.mkdirSync(agentDir, { recursive: true });
  fs.mkdirSync(sessionIndex.getSessionsDir(), { recursive: true });

  const raw = getRawModelConfig();
  /** @type {Record<string, unknown>} */
  const providers = {};

  for (const p of raw.providers) {
    if (!p?.id || !p?.baseUrl) continue;
    providers[p.id] = {
      name: p.name || p.id,
      baseUrl: p.baseUrl,
      api: "openai-completions",
      apiKey: p.apiKey || undefined,
      authHeader: true,
      compat: {
        supportsDeveloperRole: false,
        supportsReasoningEffort: false,
      },
      models: (p.models || []).map((m) => ({
        id: m.id,
        name: m.name || m.id,
        reasoning: false,
        input: ["text"],
        contextWindow: 128000,
        maxTokens: 8192,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      })),
    };
  }

  const modelsPath = path.join(agentDir, "models.json");
  fs.writeFileSync(modelsPath, JSON.stringify({ providers }, null, 2), "utf8");
  return { agentDir, modelsPath, raw };
}

async function loadPi() {
  return import("@earendil-works/pi-coding-agent");
}

function getAgentCwd() {
  return projectStore.readProjectConfig().projectRoot || getAppDataRoot();
}

function getProjectSnapshot() {
  const cfg = projectStore.readProjectConfig();
  const allowedRoots = projectStore.getAllowedRoots();
  return {
    projectRoot: cfg.projectRoot,
    whitelist: cfg.whitelist,
    allowedRoots,
    toolsEnabled: Boolean(cfg.projectRoot),
    storePath: projectStore.getProjectStorePath(),
  };
}

function emitProjectChanged() {
  emit({ type: "project_changed", project: getProjectSnapshot() });
}

async function prepareModelRuntime() {
  const { agentDir, raw } = syncPiModelsJson();
  const { providerId, modelId } = raw.defaultModel;
  const provider = (raw.providers || []).find((p) => p.id === providerId);
  if (!provider) {
    throw new Error("默认模型供应商不存在，请先在设置中配置");
  }
  if (!provider.apiKey) {
    throw new Error(
      `供应商「${provider.name}」尚未配置 API Key，请先在设置中填写`
    );
  }

  const pi = await loadPi();
  const modelRuntime = await pi.ModelRuntime.create({
    authPath: path.join(agentDir, "auth.json"),
    modelsPath: path.join(agentDir, "models.json"),
  });

  for (const p of raw.providers) {
    if (p.apiKey) {
      try {
        await modelRuntime.setRuntimeApiKey(p.id, p.apiKey);
      } catch {
        /* models.json apiKey fallback */
      }
    }
  }

  let model = modelRuntime.getModel(providerId, modelId);
  if (!model) {
    const available = await modelRuntime.getAvailable();
    model = available.find(
      (m) => m.provider === providerId && m.id === modelId
    );
  }
  if (!model) {
    throw new Error(
      `找不到模型 ${providerId}/${modelId}。请确认已保存 API Key，并检查模型 id。`
    );
  }

  const agentCwd = getAgentCwd();
  const projectRoot = projectStore.readProjectConfig().projectRoot;
  const roots = projectStore.getAllowedRoots();

  const resourceLoader = new pi.DefaultResourceLoader({
    cwd: agentCwd,
    agentDir,
    systemPromptOverride: () =>
      [
        "你是 Mini WPS Comate 助手。回答简洁、准确，使用中文（除非用户要求其他语言）。",
        describeProjectForPrompt(projectRoot, roots),
      ].join("\n\n"),
    skillsOverride: () => ({ skills: [], diagnostics: [] }),
    agentsFilesOverride: () => ({ agentsFiles: [] }),
    promptsOverride: () => ({ prompts: [], diagnostics: [] }),
  });
  await resourceLoader.reload();

  return {
    pi,
    agentDir,
    raw,
    model,
    modelRuntime,
    resourceLoader,
    agentCwd,
    projectRoot,
    roots,
    modelLabel: `${providerId}/${modelId}`,
  };
}

function bindSession(nextSession, modelLabel) {
  disposeSession(false);
  session = nextSession;
  activeSessionId = session.sessionId;
  unsubscribe = session.subscribe((event) => handlePiEvent(event));

  const existing = sessionIndex
    .readIndex()
    .sessions.find((s) => s.id === session.sessionId);

  sessionIndex.upsertMeta({
    id: session.sessionId,
    filePath: session.sessionFile || "",
    title: existing?.title || "新会话",
    pinned: Boolean(existing?.pinned),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  sessionIndex.setActiveId(session.sessionId);

  emit({
    type: "session_ready",
    model: modelLabel,
    sessionId: session.sessionId,
    project: getProjectSnapshot(),
  });
  emit({
    type: "history",
    sessionId: session.sessionId,
    messages: messagesToUi(session.messages),
  });
  emitSessionsChanged();
  emitProjectChanged();
}

function emitSessionsChanged() {
  emit({ type: "sessions_changed", sessions: listSessions() });
}

function activeHasUserMessage() {
  if (!session?.messages) return false;
  return session.messages.some((m) => m && m.role === "user");
}

function unlinkSessionFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

/** Remove an empty unused session (no user messages) from disk + index. */
function abandonEmptyActiveSession() {
  if (!session || streaming) return false;
  if (activeHasUserMessage()) return false;
  const id = session.sessionId;
  const file = session.sessionFile || "";
  disposeSession(false);
  unlinkSessionFile(file);
  sessionIndex.removeMeta(id);
  return true;
}

/** True if a session jsonl already contains at least one user turn. */
function sessionFileHasUserMessage(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        const msg = row?.message || row;
        if (msg?.role === "user") return true;
        if (row?.type === "message" && row?.role === "user") return true;
      } catch {
        /* skip bad line */
      }
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * On cold start there is no in-memory session; drop a leftover empty active
 * "新会话" so reopen does not stack blank chats.
 */
function abandonEmptyActiveFromDisk() {
  if (session || streaming) return false;
  const index = sessionIndex.readIndex();
  const active = index.sessions.find((s) => s.id === index.activeId);
  if (!active) return false;
  if (sessionFileHasUserMessage(active.filePath)) return false;
  unlinkSessionFile(active.filePath);
  sessionIndex.removeMeta(active.id);
  return true;
}

/** Drop index rows whose files are missing (orphans). */
function pruneMissingSessionFiles() {
  const index = sessionIndex.readIndex();
  let changed = false;
  for (const s of [...index.sessions]) {
    if (session?.sessionId === s.id) continue;
    if (s.filePath && fs.existsSync(s.filePath)) continue;
    sessionIndex.removeMeta(s.id);
    changed = true;
  }
  return changed;
}

async function openWithManager(sessionManager, modelLabel) {
  const prepared = await prepareModelRuntime();
  /** @type {Record<string, unknown>} */
  const opts = {
    cwd: prepared.agentCwd,
    agentDir: prepared.agentDir,
    model: prepared.model,
    modelRuntime: prepared.modelRuntime,
    sessionManager,
    settingsManager: prepared.pi.SettingsManager.inMemory({}),
    resourceLoader: prepared.resourceLoader,
  };

  if (prepared.projectRoot && prepared.roots.length > 0) {
    opts.tools = ["read", "ls", "edit", "write"];
    opts.customTools = buildGuardedToolDefinitions(
      prepared.pi,
      prepared.agentCwd,
      prepared.roots
    );
  } else {
    opts.noTools = "all";
  }

  const created = await prepared.pi.createAgentSession(opts);
  bindSession(created.session, modelLabel || prepared.modelLabel);
  return {
    ok: true,
    model: prepared.modelLabel,
    sessionId: created.session.sessionId,
    project: getProjectSnapshot(),
  };
}

async function rebuildActiveSessionForProject() {
  emitProjectChanged();
  if (!session) {
    return { ok: true, project: getProjectSnapshot() };
  }
  if (streaming) {
    return { ok: false, error: "当前正在生成，请稍后再切换本地项目" };
  }

  const file = session.sessionFile;
  const prepared = await prepareModelRuntime();
  let sessionManager;
  if (file && fs.existsSync(file)) {
    sessionManager = prepared.pi.SessionManager.open(file);
  } else {
    sessionManager = prepared.pi.SessionManager.create(
      getAppDataRoot(),
      sessionIndex.getSessionsDir()
    );
  }
  return openWithManager(sessionManager, prepared.modelLabel);
}

async function setProjectRootPath(projectRoot) {
  if (!projectRoot) return { ok: false, error: "未选择目录" };
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    return { ok: false, error: "目录不存在" };
  }
  projectStore.setProjectRoot(projectRoot);
  return rebuildActiveSessionForProject();
}

async function clearProjectRoot() {
  projectStore.clearProject();
  return rebuildActiveSessionForProject();
}

async function addProjectWhitelist(dirPath) {
  try {
    if (!dirPath || !fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      return { ok: false, error: "目录不存在" };
    }
    projectStore.addWhitelistPath(dirPath);
    return rebuildActiveSessionForProject();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function removeProjectWhitelist(dirPath) {
  try {
    projectStore.removeWhitelistPath(dirPath);
    return rebuildActiveSessionForProject();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function ensureSession() {
  if (session) {
    const raw = getRawModelConfig();
    return {
      ok: true,
      model: `${raw.defaultModel.providerId}/${raw.defaultModel.modelId}`,
      sessionId: session.sessionId,
      already: true,
    };
  }

  // App cold start: always open a blank chat, do not resume last active.
  return createSession();
}

async function createSession() {
  if (streaming) {
    return { ok: false, error: "当前正在生成，请稍后再新建会话" };
  }

  // Reuse current blank session instead of stacking empties
  if (session && !activeHasUserMessage()) {
    sessionIndex.upsertMeta({
      id: session.sessionId,
      title: "新会话",
      filePath: session.sessionFile || "",
      updatedAt: new Date().toISOString(),
    });
    emitSessionsChanged();
    return {
      ok: true,
      already: true,
      sessionId: session.sessionId,
      model: undefined,
      project: getProjectSnapshot(),
    };
  }

  abandonEmptyActiveSession();
  abandonEmptyActiveFromDisk();
  pruneMissingSessionFiles();

  const prepared = await prepareModelRuntime();
  const sessionManager = prepared.pi.SessionManager.create(
    getAppDataRoot(),
    sessionIndex.getSessionsDir()
  );
  const result = await openWithManager(sessionManager, prepared.modelLabel);
  sessionIndex.upsertMeta({
    id: result.sessionId,
    title: "新会话",
    pinned: false,
    filePath: session?.sessionFile || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  emitSessionsChanged();
  return result;
}

async function switchSession(id) {
  if (!id) return { ok: false, error: "缺少会话 id" };
  if (streaming) {
    return { ok: false, error: "当前正在生成，请稍后再切换会话" };
  }
  if (session?.sessionId === id) {
    return { ok: true, sessionId: id, already: true };
  }

  abandonEmptyActiveSession();
  pruneMissingSessionFiles();

  const index = sessionIndex.readIndex();
  const meta = index.sessions.find((s) => s.id === id);
  if (!meta?.filePath || !fs.existsSync(meta.filePath)) {
    if (meta) sessionIndex.removeMeta(id);
    emitSessionsChanged();
    return { ok: false, error: "该会话已失效，已自动清理" };
  }

  const prepared = await prepareModelRuntime();
  const sessionManager = prepared.pi.SessionManager.open(meta.filePath);
  return openWithManager(sessionManager, prepared.modelLabel);
}

async function deleteSession(id) {
  if (!id) return { ok: false, error: "缺少会话 id" };
  if (streaming && activeSessionId === id) {
    return { ok: false, error: "当前会话正在生成，无法删除" };
  }

  const index = sessionIndex.readIndex();
  const meta = index.sessions.find((s) => s.id === id);
  const wasActive = activeSessionId === id;

  if (wasActive) {
    disposeSession(false);
  }

  if (meta?.filePath && fs.existsSync(meta.filePath)) {
    try {
      fs.unlinkSync(meta.filePath);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
  sessionIndex.removeMeta(id);
  emitSessionsChanged();

  if (wasActive) {
    emit({ type: "history", sessionId: null, messages: [] });
    // Auto-create or switch to another
    const next = listSessions();
    if (next.length > 0) {
      return switchSession(next[0].id);
    }
    return createSession();
  }

  return { ok: true };
}

function renameSession(id, title) {
  try {
    const item = sessionIndex.renameMeta(id, title);
    emitSessionsChanged();
    return { ok: true, session: item };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function pinSession(id, pinned) {
  try {
    const item = sessionIndex.pinMeta(id, pinned);
    emitSessionsChanged();
    return { ok: true, session: item };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function listSessions() {
  const index = sessionIndex.readIndex();
  const byId = new Map(index.sessions.map((s) => [s.id, s]));

  const items = [];
  for (const s of index.sessions) {
    const nextTitle = normalizeSessionTitle(s.title, s.title);
    if (nextTitle !== s.title) {
      sessionIndex.upsertMeta({
        id: s.id,
        title: nextTitle,
        updatedAt: s.updatedAt || new Date().toISOString(),
      });
    }
    items.push({
      id: s.id,
      title: nextTitle || "未命名会话",
      pinned: Boolean(s.pinned),
      filePath: s.filePath || "",
      createdAt: s.createdAt || null,
      updatedAt: s.updatedAt || null,
      active: s.id === (session?.sessionId || index.activeId),
    });
  }

  // Also discover orphan pi session files
  try {
    const dir = sessionIndex.getSessionsDir();
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith(".jsonl")) continue;
        const full = path.join(dir, name);
        const m = name.match(/_([0-9a-f-]{20,})\.jsonl$/i);
        const id = m ? m[1] : name.replace(/\.jsonl$/, "");
        if (byId.has(id)) continue;
        const stat = fs.statSync(full);
        const meta = {
          id,
          filePath: full,
          title: "恢复的会话",
          pinned: false,
          createdAt: stat.birthtime.toISOString(),
          updatedAt: stat.mtime.toISOString(),
        };
        sessionIndex.upsertMeta(meta);
        items.push({
          ...meta,
          active: id === (session?.sessionId || index.activeId),
        });
      }
    }
  } catch {
    /* ignore */
  }

  items.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  });
  return items;
}

async function refreshSessionsFromDisk() {
  try {
    const pi = await loadPi();
    const listed = await pi.SessionManager.list(
      getAppDataRoot(),
      sessionIndex.getSessionsDir()
    );
    for (const info of listed) {
      const existing = sessionIndex
        .readIndex()
        .sessions.find((s) => s.id === info.id);
      const nextTitle = normalizeSessionTitle(
        existing?.title,
        info.firstMessage || existing?.title
      );
      sessionIndex.upsertMeta({
        id: info.id,
        filePath: info.path,
        title: nextTitle,
        pinned: existing?.pinned || false,
        createdAt: existing?.createdAt || info.created || new Date().toISOString(),
        updatedAt: info.modified || new Date().toISOString(),
      });
    }
  } catch {
    /* ignore */
  }
  const sessions = listSessions();
  emitSessionsChanged();
  return sessions;
}

function handlePiEvent(event) {
  if (event.type === "agent_start") {
    streaming = true;
    emit({ type: "stream_start", queueLength });
    return;
  }

  if (event.type === "agent_end") {
    streaming = false;
    currentAssistantId = null;
    emit({ type: "stream_end", queueLength });
    return;
  }

  if (event.type === "message_start" && event.message?.role === "assistant") {
    currentAssistantId = event.message.id || `a-${Date.now()}`;
    emit({ type: "assistant_start", id: currentAssistantId });
    return;
  }

  if (
    event.type === "message_update" &&
    event.assistantMessageEvent?.type === "text_delta"
  ) {
    emit({
      type: "text_delta",
      id: currentAssistantId || "assistant-live",
      delta: event.assistantMessageEvent.delta || "",
    });
    return;
  }

  if (event.type === "message_end" && event.message?.role === "assistant") {
    emit({
      type: "assistant_end",
      id: currentAssistantId || event.message.id,
      text: extractText(event.message),
    });
    if (session?.sessionId) {
      sessionIndex.upsertMeta({
        id: session.sessionId,
        updatedAt: new Date().toISOString(),
        filePath: session.sessionFile || "",
      });
      emitSessionsChanged();
    }
    return;
  }

  if (event.type === "queue_update") {
    queueLength = Array.isArray(event.queue) ? event.queue.length : queueLength;
    emit({ type: "queue_update", queueLength });
    return;
  }

  if (event.type === "tool_execution_start") {
    emit({
      type: "tool_start",
      toolCallId: event.toolCallId || `tool-${Date.now()}`,
      toolName: event.toolName || "tool",
      args: event.args || {},
    });
    return;
  }

  if (event.type === "tool_execution_end") {
    let summary = "";
    try {
      if (typeof event.result === "string") summary = event.result;
      else if (event.result != null) summary = JSON.stringify(event.result);
    } catch {
      summary = "";
    }
    if (summary.length > 600) summary = `${summary.slice(0, 600)}…`;
    emit({
      type: "tool_end",
      toolCallId: event.toolCallId || "",
      toolName: event.toolName || "tool",
      isError: Boolean(event.isError),
      summary,
    });
  }
}

async function abortGeneration() {
  if (!session) {
    streaming = false;
    queueLength = 0;
    return { ok: true, already: true };
  }
  try {
    await session.abort();
  } catch (e) {
    // Still force UI out of generating state
    streaming = false;
    queueLength = 0;
    emit({ type: "stream_end", queueLength: 0, aborted: true });
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
  streaming = false;
  queueLength = 0;
  emit({ type: "stream_end", queueLength: 0, aborted: true });
  return { ok: true };
}

async function sendMessage(text) {
  const content = String(text || "").trim();
  if (!content) return { ok: false, error: "消息不能为空" };
  if (streaming) {
    return { ok: false, error: "当前正在生成，请等待结束后再发送" };
  }

  try {
    await ensureSession();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (!session) return { ok: false, error: "会话未就绪" };

  // Auto title from first user message (heuristic first, then AI refine)
  const meta = sessionIndex
    .readIndex()
    .sessions.find((s) => s.id === session.sessionId);
  if (meta && (!meta.title || meta.title === "新会话")) {
    const sessionId = session.sessionId;
    const quick = summarizeTitle(content, 14);
    sessionIndex.upsertMeta({
      id: sessionId,
      title: quick,
      updatedAt: new Date().toISOString(),
    });
    emitSessionsChanged();
    void summarizeTitleWithAi(content, 14).then((aiTitle) => {
      if (!aiTitle) return;
      const still = sessionIndex
        .readIndex()
        .sessions.find((s) => s.id === sessionId);
      if (!still) return;
      // Only overwrite auto titles, not manual renames
      if (still.title !== quick && still.title !== "新会话") return;
      if (still.title === aiTitle) return;
      sessionIndex.upsertMeta({
        id: sessionId,
        title: aiTitle,
        updatedAt: new Date().toISOString(),
      });
      emitSessionsChanged();
    });
  }

  const userId = `u-${Date.now()}`;
  emit({ type: "user_message", id: userId, text: content, startedAt: Date.now() });

  const run = session.prompt(content, {
    expandPromptTemplates: false,
    preflightResult: (accepted) => {
      if (!accepted) {
        emit({ type: "error", message: "消息未被接受（可能被拦截）" });
      }
    },
  });

  run
    .then(() => {
      emit({ type: "prompt_done", queueLength: 0 });
    })
    .catch((err) => {
      streaming = false;
      emit({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
      emit({ type: "stream_end", queueLength: 0 });
    });

  return { ok: true, queued: false, userId };
}

async function resetSession() {
  // Batch 3 compatibility: clear current chat by creating a new session
  return createSession();
}

function disposeSession(emitEmpty = true) {
  if (unsubscribe) {
    try {
      unsubscribe();
    } catch {
      /* ignore */
    }
    unsubscribe = null;
  }
  if (session) {
    try {
      session.dispose();
    } catch {
      /* ignore */
    }
    session = null;
  }
  streaming = false;
  queueLength = 0;
  currentAssistantId = null;
  activeSessionId = null;
  if (emitEmpty) {
    /* keep UI unless caller replaces */
  }
}

function getStatus() {
  return {
    ready: Boolean(session),
    streaming,
    queueLength,
    sessionId: session?.sessionId || null,
    project: getProjectSnapshot(),
  };
}

module.exports = {
  setEmitter,
  ensureSession,
  createSession,
  switchSession,
  deleteSession,
  renameSession,
  pinSession,
  listSessions,
  refreshSessionsFromDisk,
  sendMessage,
  abortGeneration,
  resetSession,
  disposeSession,
  getStatus,
  syncPiModelsJson,
  getProjectSnapshot,
  setProjectRootPath,
  clearProjectRoot,
  addProjectWhitelist,
  removeProjectWhitelist,
  rebuildActiveSessionForProject,
};
