import { useEffect, useState } from "react";
import type { ComateAuthState, ThemeMode } from "./env";
import { LoginScreen } from "./components/LoginScreen";
import { AppShell } from "./components/AppShell";

function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function App() {
  const [auth, setAuth] = useState<ComateAuthState | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    applyTheme("light");
    let cancelled = false;
    (async () => {
      try {
        const [state, themeResult] = await Promise.all([
          window.comate.getAuth(),
          window.comate.getTheme(),
        ]);
        if (cancelled) return;
        setAuth(state);
        applyTheme(themeResult.theme === "dark" ? "dark" : "light");
      } catch (e) {
        if (!cancelled) {
          setBootError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    const offChanged = window.comate.onAuthChanged((state) => {
      setAuth(state);
      setAuthError(null);
      setBusy(false);
    });
    const offError = window.comate.onAuthError((message) => {
      setAuthError(message);
      setBusy(false);
    });
    const offTheme = window.comate.onThemeChanged((next) => {
      applyTheme(next === "dark" ? "dark" : "light");
    });

    return () => {
      cancelled = true;
      offChanged();
      offError();
      offTheme();
    };
  }, []);

  async function handleLogin() {
    setAuthError(null);
    setBusy(true);
    const result = await window.comate.login();
    if (!result.ok) {
      setAuthError(result.error || "启动登录失败");
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    await window.comate.logout();
    setBusy(false);
  }

  async function handleSwitchAccount() {
    setAuthError(null);
    setBusy(true);
    await window.comate.logout();
    const result = await window.comate.login();
    if (!result.ok) {
      setAuthError(result.error || "启动登录失败");
      setBusy(false);
    }
  }

  if (bootError) {
    return (
      <div className="boot-error">
        <h1>启动失败</h1>
        <p>{bootError}</p>
      </div>
    );
  }

  if (!auth) {
    return (
      <div className="boot-loading">
        <p>正在初始化…</p>
      </div>
    );
  }

  if (!auth.loggedIn) {
    return (
      <LoginScreen
        busy={busy}
        error={authError}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <AppShell
      auth={auth}
      busy={busy}
      onLogout={handleLogout}
      onSwitchAccount={() => void handleSwitchAccount()}
    />
  );
}
