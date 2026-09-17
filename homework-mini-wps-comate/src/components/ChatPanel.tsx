import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ChatEvent, ModelRef, ProjectConfig, SessionInfo } from "../env";
import { useI18n } from "../i18n/I18nProvider";
import { MarkdownBody } from "./MarkdownBody";
import logoUrl from "../assets/logo.png";
import "./ChatPanel.css";

type UiMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  streaming?: boolean;
  toolName?: string;
  isError?: boolean;
  durationMs?: number;
};

type PendingItem = {
  id: string;
  text: string;
};

type ModelOption = {
  value: string;
  label: string;
  shortLabel: string;
  ref: ModelRef;
};

function shortPath(p: string | null | undefined) {
  if (!p) return "";
  const parts = p.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || p;
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ChatPanel() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pendingQueue, setPendingQueue] = useState<PendingItem[]>([]);
  const [modelLabel, setModelLabel] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [readyHint, setReadyHint] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [project, setProject] = useState<ProjectConfig | null>(null);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [modelValue, setModelValue] = useState("");
  const [modelBusy, setModelBusy] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const assistantBuf = useRef<Map<string, string>>(new Map());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tRef = useRef(t);
  const streamingRef = useRef(false);
  const pendingRef = useRef<PendingItem[]>([]);
  const sendingLock = useRef(false);
  const turnStartedAt = useRef<number | null>(null);
  tRef.current = t;

  const isEmpty = messages.length === 0;

  function applyActiveTitle(sessions: SessionInfo[]) {
    const active = sessions.find((s) => s.active);
    setSessionTitle(
      (active?.title || "").trim() || tRef.current("chatFallbackTitle")
    );
  }

  function updatePending(next: PendingItem[]) {
    pendingRef.current = next;
    setPendingQueue(next);
  }

  async function loadModels() {
    const config = await window.comate.getModelConfig();
    const opts: ModelOption[] = [];
    for (const p of config.providers) {
      if (!p.hasKey) continue;
      for (const m of p.models) {
        opts.push({
          value: `${p.id}::${m.id}`,
          label: `${p.name} / ${m.name}`,
          shortLabel: m.name || m.id,
          ref: { providerId: p.id, modelId: m.id },
        });
      }
    }
    setModelOptions(opts);
    const preferred = `${config.defaultModel.providerId}::${config.defaultModel.modelId}`;
    const found = opts.find((o) => o.value === preferred) || opts[0] || null;
    if (found) {
      setModelValue(found.value);
      setModelLabel(`${found.ref.providerId}/${found.ref.modelId}`);
      setReadyHint(
        `${tRef.current("readyPrefix")}${found.ref.providerId}/${found.ref.modelId}`
      );
    } else {
      setModelValue("");
      setModelLabel("");
      setReadyHint(tRef.current("configureModelFirst"));
    }
  }

  useEffect(() => {
    setReadyHint(t("preparingModel"));
    void loadModels();
    void window.comate.getProject().then((r) => {
      if (r.ok && r.project) setProject(r.project);
    });
    const off = window.comate.onChatEvent((event: ChatEvent) => {
      handleEvent(event);
    });
    // Fresh window → blank chat (not last active session).
    void window.comate.createSession().then((r) => {
      if (!r.ok) {
        setError(r.error || tRef.current("initChatFailed"));
        setReadyHint(tRef.current("notReady"));
        return;
      }
      void window.comate.listSessions().then((list) => {
        if (list.ok && list.sessions) applyActiveTitle(list.sessions);
      });
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (showScrollBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streaming, pendingQueue]);

  useEffect(() => {
    function updateScrollState() {
      const el = listRef.current;
      if (!el) return;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBottom(distance > 120);
    }
    const el = listRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState);
    return () => el.removeEventListener("scroll", updateScrollState);
  }, [isEmpty]);

  function handleEvent(event: ChatEvent) {
    if (event.type === "project_changed" && event.project) {
      setProject(event.project as ProjectConfig);
      return;
    }
    if (event.type === "sessions_changed" && Array.isArray(event.sessions)) {
      applyActiveTitle(event.sessions as SessionInfo[]);
      return;
    }
    if (event.type === "session_ready") {
      setModelLabel(String(event.model || ""));
      setReadyHint(`${tRef.current("readyPrefix")}${event.model}`);
      setError(null);
      return;
    }
    if (event.type === "history") {
      assistantBuf.current.clear();
      turnStartedAt.current = null;
      updatePending([]);
      streamingRef.current = false;
      setStreaming(false);
      const list = Array.isArray(event.messages)
        ? (event.messages as UiMessage[])
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({
              id: String(m.id),
              role: (m.role === "user" ? "user" : "assistant") as UiMessage["role"],
              text: String(m.text || ""),
              streaming: false,
            }))
        : [];
      setMessages(list);
      setError(null);
      return;
    }
    if (event.type === "tool_start") {
      const id = String(event.toolCallId || `tool-${Date.now()}`);
      const toolName = String(event.toolName || "tool");
      let argsText = "";
      try {
        argsText = JSON.stringify(event.args ?? {}, null, 0);
      } catch {
        argsText = "";
      }
      if (argsText.length > 280) argsText = `${argsText.slice(0, 280)}…`;
      setMessages((prev) => [
        ...prev,
        {
          id,
          role: "tool",
          toolName,
          text: `${tRef.current("toolCall")} ${toolName}${argsText ? `：${argsText}` : ""}`,
          streaming: true,
        },
      ]);
      return;
    }
    if (event.type === "tool_end") {
      const id = String(event.toolCallId || "");
      const toolName = String(event.toolName || "tool");
      const isError = Boolean(event.isError);
      const summary = String(event.summary || "");
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === id);
        const text = isError
          ? `${toolName} ${tRef.current("toolFail")}${summary ? `：${summary}` : ""}`
          : `${toolName} ${tRef.current("toolDone")}${summary ? `：${summary}` : ""}`;
        if (!exists) {
          return [
            ...prev,
            {
              id: id || `tool-end-${Date.now()}`,
              role: "tool",
              toolName,
              text,
              isError,
            },
          ];
        }
        return prev.map((m) =>
          m.id === id ? { ...m, text, streaming: false, isError } : m
        );
      });
      return;
    }
    if (event.type === "user_message") {
      turnStartedAt.current =
        typeof event.startedAt === "number" ? event.startedAt : Date.now();
      setMessages((prev) => [
        ...prev,
        { id: String(event.id), role: "user", text: String(event.text || "") },
      ]);
      return;
    }
    if (event.type === "assistant_start") {
      const id = String(event.id || `a-${Date.now()}`);
      assistantBuf.current.set(id, "");
      if (!turnStartedAt.current) turnStartedAt.current = Date.now();
      setMessages((prev) => [
        ...prev,
        { id, role: "assistant", text: "", streaming: true },
      ]);
      return;
    }
    if (event.type === "text_delta") {
      const id = String(event.id || "assistant-live");
      const prevText = assistantBuf.current.get(id) || "";
      const next = prevText + String(event.delta || "");
      assistantBuf.current.set(id, next);
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === id);
        if (!exists) {
          return [
            ...prev,
            { id, role: "assistant", text: next, streaming: true },
          ];
        }
        return prev.map((m) =>
          m.id === id ? { ...m, text: next, streaming: true } : m
        );
      });
      return;
    }
    if (event.type === "assistant_end") {
      const id = String(event.id || "");
      const text =
        String(event.text || "") || assistantBuf.current.get(id) || "";
      assistantBuf.current.set(id, text);
      const durationMs = turnStartedAt.current
        ? Date.now() - turnStartedAt.current
        : undefined;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, text, streaming: false, durationMs }
            : m
        )
      );
      return;
    }
    if (event.type === "stream_start") {
      streamingRef.current = true;
      setStreaming(true);
      return;
    }
    if (event.type === "stream_end" || event.type === "prompt_done") {
      streamingRef.current = false;
      setStreaming(false);
      sendingLock.current = false;
      void flushPendingQueue();
      return;
    }
    if (event.type === "error") {
      setError(String(event.message || tRef.current("unknownError")));
      streamingRef.current = false;
      setStreaming(false);
      sendingLock.current = false;
      void flushPendingQueue();
    }
  }

  async function ensureReady() {
    const result = await window.comate.chatEnsure();
    if (!result.ok) {
      setError(result.error || t("initChatFailed"));
      setReadyHint(t("notReady"));
      return false;
    }
    setModelLabel(result.model || modelLabel);
    setReadyHint(`${t("readyPrefix")}${result.model || modelLabel}`);
    setError(null);
    return true;
  }

  async function dispatchSend(text: string) {
    if (sendingLock.current || streamingRef.current) return false;
    sendingLock.current = true;
    const ok = await ensureReady();
    if (!ok) {
      sendingLock.current = false;
      return false;
    }
    turnStartedAt.current = Date.now();
    const result = await window.comate.chatSend(text);
    if (!result.ok) {
      sendingLock.current = false;
      setError(result.error || t("sendFailed"));
      return false;
    }
    // stream_start will keep lock until stream_end
    return true;
  }

  async function flushPendingQueue() {
    if (streamingRef.current || sendingLock.current) return;
    const next = pendingRef.current[0];
    if (!next) return;
    updatePending(pendingRef.current.slice(1));
    const ok = await dispatchSend(next.text);
    if (!ok) {
      // put back at front if send failed
      updatePending([next, ...pendingRef.current]);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setError(null);

    if (streamingRef.current) {
      updatePending([
        ...pendingRef.current,
        { id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text },
      ]);
      setInput("");
      return;
    }

    setInput("");
    const ok = await dispatchSend(text);
    if (!ok) setInput(text);
  }

  async function handleStop() {
    setError(null);
    const result = await window.comate.chatAbort();
    if (!result.ok) {
      setError(result.error || t("sendFailed"));
    }
    streamingRef.current = false;
    setStreaming(false);
    sendingLock.current = false;
  }

  function removePending(id: string) {
    updatePending(pendingRef.current.filter((p) => p.id !== id));
  }

  async function handleReset() {
    setMessages([]);
    assistantBuf.current.clear();
    updatePending([]);
    turnStartedAt.current = null;
    streamingRef.current = false;
    setStreaming(false);
    setError(null);
    const result = await window.comate.chatReset();
    if (!result.ok) {
      setError(result.error || t("resetFailed"));
      setReadyHint(t("notReady"));
    } else {
      setModelLabel(result.model || "");
      setReadyHint(`${t("readyPrefix")}${result.model}`);
    }
  }

  async function handlePickProject() {
    setError(null);
    const result = await window.comate.pickProjectRoot();
    if (result.cancelled) return;
    if (!result.ok) {
      setError(result.error || t("pickDirFailed"));
      return;
    }
    if (result.project) setProject(result.project);
  }

  async function handleModelChange(value: string) {
    const found = modelOptions.find((o) => o.value === value);
    if (!found) return;
    setModelBusy(true);
    setError(null);
    setModelValue(value);
    const result = await window.comate.saveModelConfig({
      defaultModel: found.ref,
    });
    setModelBusy(false);
    if (!result.ok) {
      setError(result.error || t("switchModelFailed"));
      await loadModels();
      return;
    }
    const label = `${found.ref.providerId}/${found.ref.modelId}`;
    setModelLabel(label);
    setReadyHint(`${t("switchedPrefix")}${label}${t("nextMsgHint")}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function scrollToBottom() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setShowScrollBottom(false);
  }

  const composer = (
    <div className={`composer ${isEmpty ? "composer-welcome" : ""}`}>
      {pendingQueue.length > 0 ? (
        <div className="composer-queue" aria-live="polite">
          {pendingQueue.map((item, index) => (
            <div key={item.id} className="composer-queue-item">
              <span className="composer-queue-badge">
                {t("queuedLabel")}
                {pendingQueue.length > 1 ? ` ${index + 1}` : ""}
              </span>
              <span className="composer-queue-text" title={item.text}>
                {item.text}
              </span>
              <button
                type="button"
                className="composer-queue-remove"
                title={t("removeQueued")}
                aria-label={t("removeQueued")}
                onClick={() => removePending(item.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <textarea
        ref={inputRef}
        value={input}
        rows={3}
        placeholder={isEmpty ? t("placeholderEmpty") : t("placeholderChat")}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="composer-footer">
        <div className="composer-left">
          <button
            type="button"
            className="plus-btn"
            title={t("pickProject")}
            onClick={() => void handlePickProject()}
          >
            <svg viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M7 1.5v11M1.5 7h11"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <select
            className="model-switch"
            title={t("switchModel")}
            aria-label={t("switchModel")}
            value={modelValue}
            disabled={modelBusy || modelOptions.length === 0}
            onChange={(e) => void handleModelChange(e.target.value)}
          >
            {modelOptions.length === 0 ? (
              <option value="">{t("needApiKey")}</option>
            ) : (
              modelOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            )}
          </select>
          {project?.projectRoot ? (
            <span className="project-chip" title={project.projectRoot}>
              {shortPath(project.projectRoot)}
            </span>
          ) : null}
          {streaming ? <span className="pill">{t("generating")}</span> : null}
        </div>
        {streaming ? (
          <button
            type="button"
            className="danger-btn stop-btn"
            onClick={() => void handleStop()}
          >
            {t("stop")}
          </button>
        ) : (
          <button
            type="button"
            className="primary-btn send-btn"
            onClick={() => void handleSend()}
          >
            {t("send")}
          </button>
        )}
      </div>
    </div>
  );

  if (isEmpty) {
    return (
      <div className="chat chat-welcome">
        <div className="welcome-center">
          <div className="welcome-brand">
            <img className="welcome-logo-img" src={logoUrl} alt="" />
            <h1>{t("welcomeTitle")}</h1>
          </div>
          {composer}
          {error ? (
            <p className="chat-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="chat">
      <div className="chat-toolbar">
        <div>
          <div className="chat-title">
            {sessionTitle || t("chatFallbackTitle")}
          </div>
          <div className="chat-sub">{readyHint}</div>
        </div>
        <div className="chat-actions">
          <button type="button" className="ghost-btn" onClick={handleReset}>
            {t("newBlankSession")}
          </button>
        </div>
      </div>

      <div className="chat-scroll-area">
        <div className="chat-list" ref={listRef}>
          {messages.map((m) => (
            <div
              key={m.id}
              className={`msg ${m.role}${m.isError ? " error" : ""}${
                m.streaming ? " streaming" : ""
              }`}
            >
              {m.role === "assistant" ? (
                <MarkdownBody text={m.text} streaming={m.streaming} />
              ) : (
                <div className="msg-text">
                  {m.text || (m.streaming ? "…" : "")}
                </div>
              )}
              {m.role === "assistant" && !m.streaming && m.durationMs != null ? (
                <div className="msg-meta">
                  {t("durationLabel")} {formatDuration(m.durationMs)}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {showScrollBottom ? (
          <div className="scroll-bottom-wrap">
            <button
              type="button"
              className="scroll-bottom-btn"
              aria-label="回到底部"
              title="回到底部"
              onClick={scrollToBottom}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 6v10m0 0-4-4m4 4 4-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="chat-error" role="alert">
          {error}
        </p>
      ) : null}

      {composer}
    </div>
  );
}
