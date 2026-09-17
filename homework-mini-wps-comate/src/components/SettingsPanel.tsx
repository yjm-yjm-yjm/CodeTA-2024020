import { useEffect, useMemo, useState } from "react";
import type {
  Locale,
  ModelConfig,
  ModelRef,
  ProjectConfig,
  ProviderSaveInput,
  PublicProvider,
  ThemeMode,
} from "../env";
import { useI18n } from "../i18n/I18nProvider";
import "./SettingsPanel.css";

type DraftProvider = PublicProvider & {
  apiKeyInput: string;
  clearApiKey: boolean;
};

type Props = {
  onClose: () => void;
};

type TabId = "general" | "models" | "project";

function toDraft(providers: PublicProvider[]): DraftProvider[] {
  return providers.map((p) => ({
    ...p,
    apiKeyInput: "",
    clearApiKey: false,
  }));
}

export function SettingsPanel({ onClose }: Props) {
  const { t, locale, setLocale } = useI18n();
  const [tab, setTab] = useState<TabId>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [providers, setProviders] = useState<DraftProvider[]>([]);
  const [defaultModel, setDefaultModel] = useState<ModelRef>({
    providerId: "deepseek",
    modelId: "deepseek-chat",
  });
  const [paths, setPaths] = useState({ modelsPath: "", settingsPath: "" });
  const [selectedProviderId, setSelectedProviderId] = useState<string>("deepseek");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [project, setProject] = useState<ProjectConfig | null>(null);
  const [projectBusy, setProjectBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [config, themeResult, projectResult] = await Promise.all([
          window.comate.getModelConfig(),
          window.comate.getTheme(),
          window.comate.getProject(),
        ]);
        if (cancelled) return;
        applyConfig(config);
        setTheme(themeResult.theme === "dark" ? "dark" : "light");
        if (projectResult.project) setProject(projectResult.project);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const off = window.comate.onChatEvent((event) => {
      if (event.type === "project_changed" && event.project) {
        setProject(event.project as ProjectConfig);
      }
    });

    return () => {
      cancelled = true;
      off();
    };
  }, []);

  async function handleThemeChange(next: ThemeMode) {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    const result = await window.comate.setTheme(next);
    if (!result.ok) {
      setError(result.error || t("themeSaveFailed"));
    } else {
      setOkMsg(next === "light" ? t("themeLightOk") : t("themeDarkOk"));
    }
  }

  async function handleLocaleChange(next: Locale) {
    try {
      await setLocale(next);
      setError(null);
      setOkMsg(next === "en" ? "Switched to English" : "已切换为中文");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const needsRestart =
        /No handler registered|locale:set/i.test(msg);
      setError(
        needsRestart
          ? "语言接口未加载：请完全退出应用后重新运行 npm run dev（仅刷新窗口无效）"
          : msg || t("localeSaveFailed")
      );
    }
  }

  function applyConfig(config: ModelConfig) {
    setProviders(toDraft(config.providers));
    setDefaultModel(config.defaultModel);
    setPaths({
      modelsPath: config.modelsPath,
      settingsPath: config.settingsPath,
    });
    setSelectedProviderId(
      config.providers.some((p) => p.id === config.defaultModel.providerId)
        ? config.defaultModel.providerId
        : config.providers[0]?.id || "deepseek"
    );
  }

  const selected = useMemo(
    () => providers.find((p) => p.id === selectedProviderId) || providers[0],
    [providers, selectedProviderId]
  );

  const defaultOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string; ref: ModelRef }> = [];
    for (const p of providers) {
      for (const m of p.models) {
        opts.push({
          value: `${p.id}::${m.id}`,
          label: `${p.name} / ${m.name}`,
          ref: { providerId: p.id, modelId: m.id },
        });
      }
    }
    return opts;
  }, [providers]);

  function updateSelected(patch: Partial<DraftProvider>) {
    if (!selected) return;
    setProviders((prev) =>
      prev.map((p) => (p.id === selected.id ? { ...p, ...patch } : p))
    );
  }

  function updateModelAt(index: number, field: "id" | "name", value: string) {
    if (!selected) return;
    const models = selected.models.map((m, i) =>
      i === index ? { ...m, [field]: value } : m
    );
    updateSelected({ models });
  }

  function addModelRow() {
    if (!selected) return;
    updateSelected({
      models: [...selected.models, { id: "", name: "" }],
    });
  }

  function removeModelRow(index: number) {
    if (!selected || selected.models.length <= 1) return;
    updateSelected({
      models: selected.models.filter((_, i) => i !== index),
    });
  }

  async function addCustomProvider() {
    const id = await window.comate.newCustomProviderId();
    const next: DraftProvider = {
      id,
      name: "自定义 OpenAI 兼容",
      type: "openai-compatible",
      baseUrl: "https://api.example.com/v1",
      builtin: false,
      models: [{ id: "my-model", name: "My Model" }],
      hasKey: false,
      apiKeyPreview: "",
      apiKeyInput: "",
      clearApiKey: false,
    };
    setProviders((prev) => [...prev, next]);
    setSelectedProviderId(id);
  }

  function removeSelectedProvider() {
    if (!selected || selected.builtin) return;
    const next = providers.filter((p) => p.id !== selected.id);
    setProviders(next);
    setSelectedProviderId(next[0]?.id || "deepseek");
    if (defaultModel.providerId === selected.id && next[0]?.models?.[0]) {
      setDefaultModel({
        providerId: next[0].id,
        modelId: next[0].models[0].id,
      });
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const payload: ProviderSaveInput[] = providers.map((p) => ({
        id: p.id,
        name: p.name.trim(),
        type: p.type,
        baseUrl: p.baseUrl.trim(),
        builtin: p.builtin,
        models: p.models.map((m) => ({
          id: m.id.trim(),
          name: (m.name || m.id).trim(),
        })),
        clearApiKey: p.clearApiKey,
        apiKey: p.clearApiKey ? null : p.apiKeyInput.trim() || null,
      }));

      const result = await window.comate.saveModelConfig({
        providers: payload,
        defaultModel,
      });
      if (!result.ok || !result.config) {
        setError(result.error || "保存失败");
        return;
      }
      applyConfig(result.config);
      setOkMsg("已保存到本地配置目录");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function runProject(
    action: () => Promise<{ ok: boolean; error?: string; cancelled?: boolean; project?: ProjectConfig }>
  ) {
    setProjectBusy(true);
    setError(null);
    const result = await action();
    setProjectBusy(false);
    if (result.cancelled) return;
    if (!result.ok) {
      setError(result.error || "操作失败");
      return;
    }
    if (result.project) setProject(result.project);
    setOkMsg(t("projectUpdated"));
  }

  if (loading) {
    return (
      <div className="settings">
        <p className="muted">{t("loadingSettings")}</p>
      </div>
    );
  }

  return (
    <div className="settings">
      <header className="settings-header">
        <div>
          <h1>{t("settings")}</h1>
          <p className="muted">{t("settingsSub")}</p>
        </div>
        <div className="header-actions">
          {tab === "models" ? (
            <button
              type="button"
              className="primary-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t("saving") : t("saveConfig")}
            </button>
          ) : null}
          <button type="button" className="ghost-btn" onClick={onClose}>
            {t("close")}
          </button>
        </div>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav">
          {(
            [
              ["general", t("general")],
              ["models", t("models")],
              ["project", t("localProject")],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "nav-item active" : "nav-item"}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="settings-scroll">
          {error ? (
            <p className="banner error" role="alert">
              {error}
            </p>
          ) : null}
          {okMsg ? <p className="banner ok">{okMsg}</p> : null}

          {tab === "general" ? (
            <>
              <section className="theme-section">
                <h2>{t("appearance")}</h2>
                <p className="muted">{t("themeHint")}</p>
                <div className="theme-options">
                  <label
                    className={`theme-card ${theme === "light" ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="theme"
                      checked={theme === "light"}
                      onChange={() => void handleThemeChange("light")}
                    />
                    <span className="theme-name">{t("lightMode")}</span>
                    <span className="theme-desc">{t("lightDesc")}</span>
                  </label>
                  <label
                    className={`theme-card ${theme === "dark" ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="theme"
                      checked={theme === "dark"}
                      onChange={() => void handleThemeChange("dark")}
                    />
                    <span className="theme-name">{t("darkMode")}</span>
                    <span className="theme-desc">{t("darkDesc")}</span>
                  </label>
                </div>
              </section>
              <section className="theme-section">
                <h2>{t("language")}</h2>
                <p className="muted">{t("languageHint")}</p>
                <div className="theme-options">
                  <label
                    className={`theme-card ${locale === "zh" ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="locale"
                      checked={locale === "zh"}
                      onChange={() => void handleLocaleChange("zh")}
                    />
                    <span className="theme-name">{t("langZh")}</span>
                    <span className="theme-desc">默认</span>
                  </label>
                  <label
                    className={`theme-card ${locale === "en" ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="locale"
                      checked={locale === "en"}
                      onChange={() => void handleLocaleChange("en")}
                    />
                    <span className="theme-name">{t("langEn")}</span>
                    <span className="theme-desc">UI language</span>
                  </label>
                </div>
              </section>
            </>
          ) : null}

          {tab === "project" ? (
            <section className="project-section">
              <h2>{t("localProject")}</h2>
              <p className="muted">{t("projectHint")}</p>
              <div className="project-path-box">
                {project?.projectRoot || t("noProject")}
              </div>
              <div className="project-actions-row">
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={projectBusy}
                  onClick={() =>
                    void runProject(() => window.comate.pickProjectRoot())
                  }
                >
                  {t("selectDir")}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={projectBusy || !project?.projectRoot}
                  onClick={() => void runProject(() => window.comate.clearProject())}
                >
                  {t("clear")}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={projectBusy || !project?.projectRoot}
                  onClick={() =>
                    void runProject(() => window.comate.addProjectWhitelist())
                  }
                >
                  {t("addWhitelist")}
                </button>
              </div>
              {(project?.whitelist || []).length > 0 ? (
                <div className="whitelist-box">
                  <div className="list-title">{t("extraWhitelist")}</div>
                  {project?.whitelist.map((p) => (
                    <div key={p} className="whitelist-item">
                      <span title={p}>{p}</span>
                      <button
                        type="button"
                        className="ghost-btn danger"
                        disabled={projectBusy}
                        onClick={() =>
                          void runProject(() =>
                            window.comate.removeProjectWhitelist(p)
                          )
                        }
                      >
                        {t("remove")}
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {tab === "models" ? (
            <>
              <section className="settings-grid">
                <aside className="provider-list">
                  <div className="list-title">供应商</div>
                  <ul>
                    {providers.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className={
                            p.id === selected?.id
                              ? "provider-item active"
                              : "provider-item"
                          }
                          onClick={() => setSelectedProviderId(p.id)}
                        >
                          <span>{p.name}</span>
                          <span className="tag">
                            {p.hasKey ? "已配置 Key" : "未配置 Key"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="ghost-btn block"
                    onClick={addCustomProvider}
                  >
                    + 添加自定义供应商
                  </button>
                </aside>

                {selected ? (
                  <div className="provider-editor">
                    <div className="field">
                      <label htmlFor="pname">显示名称</label>
                      <input
                        id="pname"
                        value={selected.name}
                        onChange={(e) => updateSelected({ name: e.target.value })}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="baseUrl">Base URL</label>
                      <input
                        id="baseUrl"
                        value={selected.baseUrl}
                        onChange={(e) =>
                          updateSelected({ baseUrl: e.target.value })
                        }
                        placeholder="https://api.deepseek.com/v1"
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="apiKey">API Key</label>
                      <input
                        id="apiKey"
                        type="password"
                        value={selected.apiKeyInput}
                        onChange={(e) =>
                          updateSelected({
                            apiKeyInput: e.target.value,
                            clearApiKey: false,
                          })
                        }
                        placeholder={
                          selected.hasKey
                            ? `已保存：${selected.apiKeyPreview}（留空则保持不变）`
                            : "粘贴 API Key"
                        }
                      />
                      {selected.hasKey ? (
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={selected.clearApiKey}
                            onChange={(e) =>
                              updateSelected({
                                clearApiKey: e.target.checked,
                                apiKeyInput: e.target.checked
                                  ? ""
                                  : selected.apiKeyInput,
                              })
                            }
                          />
                          清除已保存的 Key
                        </label>
                      ) : null}
                    </div>

                    <div className="field">
                      <div className="field-row">
                        <label>可用模型</label>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={addModelRow}
                        >
                          + 模型
                        </button>
                      </div>
                      <div className="model-rows">
                        {selected.models.map((m, index) => (
                          <div
                            className="model-row"
                            key={`${selected.id}-${index}`}
                          >
                            <input
                              value={m.id}
                              placeholder="model id"
                              onChange={(e) =>
                                updateModelAt(index, "id", e.target.value)
                              }
                            />
                            <input
                              value={m.name}
                              placeholder="显示名"
                              onChange={(e) =>
                                updateModelAt(index, "name", e.target.value)
                              }
                            />
                            <button
                              type="button"
                              className="ghost-btn danger"
                              disabled={selected.models.length <= 1}
                              onClick={() => removeModelRow(index)}
                            >
                              删
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {!selected.builtin ? (
                      <button
                        type="button"
                        className="ghost-btn danger"
                        onClick={removeSelectedProvider}
                      >
                        删除该自定义供应商
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <section className="default-model">
                <h2>默认模型（新会话使用）</h2>
                <select
                  value={`${defaultModel.providerId}::${defaultModel.modelId}`}
                  onChange={(e) => {
                    const found = defaultOptions.find(
                      (o) => o.value === e.target.value
                    );
                    if (found) setDefaultModel(found.ref);
                  }}
                >
                  {defaultOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </section>

              <section className="paths">
                <h2>落盘路径（验收）</h2>
                <dl>
                  <div>
                    <dt>models.json</dt>
                    <dd>
                      <code>{paths.modelsPath || "—"}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>settings.json</dt>
                    <dd>
                      <code>{paths.settingsPath || "—"}</code>
                    </dd>
                  </div>
                </dl>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
