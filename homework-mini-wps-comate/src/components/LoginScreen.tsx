import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import "./LoginScreen.css";
import logoUrl from "../assets/logo.png";
import { useI18n } from "../i18n/I18nProvider";

type Props = {
  busy: boolean;
  error: string | null;
  onLogin: () => void;
};

export function LoginScreen({ busy, error, onLogin }: Props) {
  const { t } = useI18n();
  const pageRef = useRef<HTMLDivElement>(null);
  const [glow, setGlow] = useState({ x: 50, y: 50, on: false });

  const onMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const el = pageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setGlow({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      on: true,
    });
  }, []);

  return (
    <div
      className="login-page"
      ref={pageRef}
      onMouseMove={onMove}
      onMouseLeave={() => setGlow((g) => ({ ...g, on: false }))}
      style={
        {
          "--glow-x": `${glow.x}px`,
          "--glow-y": `${glow.y}px`,
        } as CSSProperties
      }
    >
      <div className="login-atmosphere" aria-hidden>
        <div className={`cursor-glow${glow.on ? " visible" : ""}`} />
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="orb orb-c" />
        <div className="grid-glow" />
        <div className="scanline" />
        <div className="particle p1" />
        <div className="particle p2" />
        <div className="particle p3" />
        <div className="particle p4" />
        <div className="particle p5" />
      </div>
      <main className="login-card">
        <div className="brand-block">
          <img className="login-logo" src={logoUrl} alt="" />
          <p className="brand">{t("brand")}</p>
        </div>
        <button
          type="button"
          className="login-btn"
          onClick={onLogin}
          disabled={busy}
        >
          {busy ? t("waitingAuth") : t("scanLogin")}
        </button>
        {error ? <p className="login-error" role="alert">{error}</p> : null}
      </main>
    </div>
  );
}
