import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { SessionInfo } from "../env";
import { useI18n } from "../i18n/I18nProvider";
import "./SessionList.css";

type Props = {
  disabled?: boolean;
};

export function SessionList({ disabled }: Props) {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SessionInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void refresh();
    const off = window.comate.onChatEvent((event) => {
      if (event.type === "sessions_changed" && Array.isArray(event.sessions)) {
        setSessions(event.sessions as SessionInfo[]);
      }
    });
    return off;
  }, []);

  useEffect(() => {
    function onDocClick() {
      setMenuId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  async function refresh() {
    const result = await window.comate.listSessions();
    if (result.ok) setSessions(result.sessions || []);
  }

  async function handleCreate() {
    setError(null);
    setMenuId(null);
    const result = await window.comate.createSession();
    if (!result.ok) setError(result.error || t("newSession"));
  }

  async function handleSwitch(id: string) {
    if (disabled) return;
    setError(null);
    setMenuId(null);
    setBusyId(id);
    const result = await window.comate.switchSession(id);
    setBusyId(null);
    if (!result.ok) setError(result.error || "switch failed");
  }

  function requestDelete(session: SessionInfo) {
    setMenuId(null);
    setPendingDelete(session);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    setBusyId(pendingDelete.id);
    const result = await window.comate.deleteSession(pendingDelete.id);
    setBusyId(null);
    setDeleting(false);
    setPendingDelete(null);
    if (!result.ok) setError(result.error || t("delete"));
  }

  async function handlePin(id: string, pinned: boolean) {
    setMenuId(null);
    const result = await window.comate.pinSession(id, pinned);
    if (!result.ok) setError(result.error || t("pin"));
  }

  function startRename(s: SessionInfo) {
    setMenuId(null);
    setEditingId(s.id);
    setEditTitle(s.title);
  }

  async function commitRename() {
    if (!editingId) return;
    const result = await window.comate.renameSession(editingId, editTitle);
    setEditingId(null);
    if (!result.ok) setError(result.error || t("rename"));
  }

  const pinned = sessions.filter((s) => s.pinned);
  const normal = sessions.filter((s) => !s.pinned);
  const deleteBody = pendingDelete
    ? t("deleteSessionNamed").replace(
        "{title}",
        pendingDelete.title || t("chatFallbackTitle")
      )
    : t("deleteSessionBody");

  return (
    <div className="session-list">
      <button
        type="button"
        className="ghost-btn block new-session-btn"
        onClick={() => void handleCreate()}
        disabled={disabled}
      >
        {t("newSession")}
      </button>

      <button
        type="button"
        className="history-toggle"
        onClick={() => setCollapsed((v) => !v)}
      >
        <span>{t("historySessions")}</span>
        <span className={`chevron ${collapsed ? "closed" : ""}`}>▾</span>
      </button>

      {error ? <p className="session-error">{error}</p> : null}

      {!collapsed ? (
        <div className="session-groups">
          {pinned.length > 0 ? (
            <div className="group">
              <div className="group-title">{t("pinned")}</div>
              {pinned.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  editing={editingId === s.id}
                  editTitle={editTitle}
                  busy={busyId === s.id}
                  menuOpen={menuId === s.id}
                  disabled={disabled}
                  onEditTitle={setEditTitle}
                  onSwitch={() => void handleSwitch(s.id)}
                  onToggleMenu={(e) => {
                    e.stopPropagation();
                    setMenuId((cur) => (cur === s.id ? null : s.id));
                  }}
                  onStartRename={() => startRename(s)}
                  onCommitRename={() => void commitRename()}
                  onCancelRename={() => setEditingId(null)}
                  onPin={() => void handlePin(s.id, false)}
                  onDelete={() => requestDelete(s)}
                />
              ))}
            </div>
          ) : null}

          <div className="group">
            {pinned.length > 0 ? (
              <div className="group-title">{t("sessions")}</div>
            ) : null}
            {normal.length === 0 && pinned.length === 0 ? (
              <p className="empty">{t("noSessions")}</p>
            ) : (
              normal.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  editing={editingId === s.id}
                  editTitle={editTitle}
                  busy={busyId === s.id}
                  menuOpen={menuId === s.id}
                  disabled={disabled}
                  onEditTitle={setEditTitle}
                  onSwitch={() => void handleSwitch(s.id)}
                  onToggleMenu={(e) => {
                    e.stopPropagation();
                    setMenuId((cur) => (cur === s.id ? null : s.id));
                  }}
                  onStartRename={() => startRename(s)}
                  onCommitRename={() => void commitRename()}
                  onCancelRename={() => setEditingId(null)}
                  onPin={() => void handlePin(s.id, true)}
                  onDelete={() => requestDelete(s)}
                />
              ))
            )}
          </div>
        </div>
      ) : null}

      {pendingDelete ? (
        <div
          className="session-confirm-backdrop"
          role="presentation"
          onClick={() => (!deleting ? setPendingDelete(null) : null)}
        >
          <div
            className="session-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="session-confirm-icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="28" height="28">
                <path
                  fill="currentColor"
                  d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9zm-1 12h12a1 1 0 0 0 1-1V8H5v12a1 1 0 0 0 1 1z"
                />
              </svg>
            </div>
            <h3 id="session-delete-title">{t("deleteSessionTitle")}</h3>
            <p>{deleteBody}</p>
            <div className="session-confirm-actions">
              <button
                type="button"
                className="ghost-btn"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className="danger-btn"
                disabled={deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? "…" : t("confirmDelete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type RowProps = {
  session: SessionInfo;
  editing: boolean;
  editTitle: string;
  busy: boolean;
  menuOpen: boolean;
  disabled?: boolean;
  onEditTitle: (v: string) => void;
  onSwitch: () => void;
  onToggleMenu: (e: MouseEvent) => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onPin: () => void;
  onDelete: () => void;
};

function SessionRow({
  session,
  editing,
  editTitle,
  busy,
  menuOpen,
  disabled,
  onEditTitle,
  onSwitch,
  onToggleMenu,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onPin,
  onDelete,
}: RowProps) {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={`session-row ${session.active ? "active" : ""} ${busy ? "busy" : ""} ${
        menuOpen ? "menu-open" : ""
      }`}
    >
      {editing ? (
        <input
          className="rename-input"
          value={editTitle}
          autoFocus
          onChange={(e) => onEditTitle(e.target.value)}
          onBlur={() => onCommitRename()}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitRename();
            if (e.key === "Escape") onCancelRename();
          }}
        />
      ) : (
        <>
          <button
            type="button"
            className="session-main"
            onClick={onSwitch}
            disabled={disabled}
            title={session.title}
          >
            {session.title || t("chatFallbackTitle")}
          </button>
          <button
            type="button"
            className="kebab"
            title="···"
            aria-label="menu"
            onClick={onToggleMenu}
          >
            ···
          </button>
          {menuOpen ? (
            <div
              className="session-menu"
              ref={menuRef}
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" onClick={onPin}>
                <span className="ico">📌</span>
                {session.pinned ? t("unpin") : t("pin")}
              </button>
              <button type="button" onClick={onStartRename}>
                <span className="ico">✎</span>
                {t("rename")}
              </button>
              <button type="button" className="danger" onClick={onDelete}>
                <span className="ico">🗑</span>
                {t("delete")}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
