import { useState } from "react";
import "./AppShell.css";
import type { ComateAuthState } from "../env";
import { useI18n } from "../i18n/I18nProvider";
import { SettingsPanel } from "./SettingsPanel";
import { ChatPanel } from "./ChatPanel";
import { SessionList } from "./SessionList";
import { AccountMenu } from "./AccountMenu";
import logoUrl from "../assets/logo.png";

type Props = {
  auth: ComateAuthState;
  busy: boolean;
  onLogout: () => void;
  onSwitchAccount: () => void;
};

export function AppShell({ auth, busy, onLogout, onSwitchAccount }: Props) {
  const { t } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const user = auth.user;
  const initial = (user?.user_name || "?").slice(0, 1).toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand-row">
            <img className="brand-logo" src={logoUrl} alt="" />
            <div className="logo">{t("brand")}</div>
          </div>
          <SessionList disabled={settingsOpen} />
        </div>

        <div className="user-dock">
          <AccountMenu
            auth={auth}
            busy={busy}
            open={accountOpen}
            onClose={() => setAccountOpen(false)}
            onOpenSettings={() => setSettingsOpen(true)}
            onSwitchAccount={onSwitchAccount}
            onLogout={onLogout}
          />
          <div className="user-row">
            <button
              type="button"
              className={`avatar-btn${accountOpen ? " open" : ""}`}
              title={t("accountMenu")}
              aria-label={t("accountMenu")}
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((v) => !v)}
            >
              {user?.avatar ? (
                <img className="avatar" src={user.avatar} alt="" />
              ) : (
                <div className="avatar fallback" aria-hidden>
                  {initial}
                </div>
              )}
            </button>
            <div className="user-meta">
              <button
                type="button"
                className="name-btn"
                title={t("accountMenu")}
                onClick={() => setAccountOpen((v) => !v)}
              >
                {user?.user_name || t("loggedInUser")}
              </button>
              <div className="uid">ID: {user?.id || "—"}</div>
            </div>
            <div className="icon-actions">
              <button
                type="button"
                className="icon-btn"
                title={t("settings")}
                aria-label={t("settings")}
                onClick={() => setSettingsOpen(true)}
              >
                <svg
                  className="icon-svg"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.1 7.1 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 14.4 2h-4.8a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.21 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.33 14.5a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.69.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.25.42.49.42h4.8c.24 0 .44-.18.49-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.26.1.55 0 .69-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="icon-btn danger"
                title={t("logout")}
                aria-label={t("logout")}
                onClick={onLogout}
                disabled={busy}
              >
                <svg
                  className="icon-svg"
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
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="main home-main">
        <ChatPanel />
      </main>

      {settingsOpen ? (
        <div
          className="settings-backdrop"
          role="presentation"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("settings")}
            onClick={(e) => e.stopPropagation()}
          >
            <SettingsPanel onClose={() => setSettingsOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
