import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  normalizeLocale,
  t as translate,
  type Locale,
} from "./messages";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: Parameters<typeof translate>[1]) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await window.comate.getLocale();
        if (!cancelled) setLocaleState(normalizeLocale(result.locale));
      } catch {
        /* keep zh */
      }
    })();
    const off = window.comate.onLocaleChanged((next) => {
      setLocaleState(normalizeLocale(next));
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    setLocaleState(next);
    try {
      const result = await window.comate.setLocale(next);
      if (result && result.ok === false) {
        throw new Error(result.error || "locale:set failed");
      }
    } catch (e) {
      try {
        const saved = await window.comate.getLocale();
        setLocaleState(normalizeLocale(saved.locale));
      } catch {
        setLocaleState("zh");
      }
      throw e;
    }
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => translate(locale, key),
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
