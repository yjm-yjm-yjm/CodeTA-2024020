import { useEffect, useRef } from "react";
import type { ComateAuthState } from "../env";
import { useI18n } from "../i18n/I18nProvider";
import "./AccountMenu.css";

type Props = {
  auth: ComateAuthState;
  busy: boolean;
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onSwitchAccount: () => void;
  onLogout: () => void;
};

export function AccountMenu({
  auth,
  busy,
  open,
  onClose,
  onOpenSettings,
  onSwitchAccount,
  onLogout,
}: Props) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const user = auth.user;
  const initial = (user?.user_name || "?").slice(0, 1).toUpperCase();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const el = panelRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="account-menu" ref={panelRef} role="dialog" aria-label={t("accountMenu")}>
      <div className="account-menu-head">
        {user?.avatar ? (
          <img className="account-menu-avatar" src={user.avatar} alt="" />
        ) : (
          <div className="account-menu-avatar fallback" aria-hidden>
            {initial}
          </div>
        )}
        <div className="account-menu-meta">
          <div className="account-menu-name">{user?.user_name || t("loggedInUser")}</div>
          <div className="account-menu-id">ID: {user?.id || "—"}</div>
        </div>
      </div>

      <div className="account-menu-actions">
        <button
          type="button"
          className="account-menu-item"
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
        >
          <svg className="account-menu-ico" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.1 7.1 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 14.4 2h-4.8a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.21 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.33 14.5a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.69.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.25.42.49.42h4.8c.24 0 .44-.18.49-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.26.1.55 0 .69-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
            />
          </svg>
          {t("settings")}
        </button>
        <button
          type="button"
          className="account-menu-item"
          disabled={busy}
          onClick={() => {
            onClose();
            onSwitchAccount();
          }}
        >
          <svg
            className="account-menu-ico"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M7 8h11M18 8l-3-3M18 8l-3 3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M17 16H6M6 16l3-3M6 16l3 3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t("switchAccount")}
        </button>
        <button
          type="button"
          className="account-menu-item danger"
          disabled={busy}
          onClick={() => {
            onClose();
            onLogout();
          }}
        >
          <svg
            className="account-menu-ico"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14 16l4-4-4-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M18 12H10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t("logout")}
        </button>
      </div>
      <p className="account-menu-hint">{t("switchAccountHint")}</p>
    </div>
  );
}
