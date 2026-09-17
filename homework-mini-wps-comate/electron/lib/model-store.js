const fs = require("node:fs");
const crypto = require("node:crypto");
const {
  ensureAppDataLayout,
  getModelsStorePath,
  getSettingsStorePath,
} = require("./paths");

const BUILTIN_PROVIDERS = [
  {
    id: "deepseek",
    name: "DeepSeek",
    type: "openai-compatible",
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "",
    builtin: true,
    models: [
      { id: "deepseek-chat", name: "DeepSeek Chat" },
      { id: "deepseek-reasoner", name: "DeepSeek Reasoner" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    type: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    builtin: true,
    models: [
      { id: "gpt-4o-mini", name: "GPT-4o mini" },
      { id: "gpt-4o", name: "GPT-4o" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic（OpenAI 兼容代理）",
    type: "openai-compatible",
    baseUrl: "https://api.anthropic.com/v1",
    apiKey: "",
    builtin: true,
    models: [
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
    ],
  },
];

function defaultModelsDoc() {
  return {
    version: 1,
    providers: BUILTIN_PROVIDERS.map((p) => ({ ...p, models: [...p.models] })),
  };
}

function defaultSettingsDoc() {
  return {
    version: 1,
    defaultModel: {
      providerId: "deepseek",
      modelId: "deepseek-chat",
    },
    theme: "light",
    locale: "zh",
  };
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback();
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback();
  }
}

function writeJson(file, data) {
  ensureAppDataLayout();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function ensureModelConfig() {
  ensureAppDataLayout();
  const modelsPath = getModelsStorePath();
  const settingsPath = getSettingsStorePath();

  if (!fs.existsSync(modelsPath)) {
    writeJson(modelsPath, defaultModelsDoc());
  } else {
    const doc = readJson(modelsPath, defaultModelsDoc);
    const byId = new Map((doc.providers || []).map((p) => [p.id, p]));
    for (const builtin of BUILTIN_PROVIDERS) {
      if (!byId.has(builtin.id)) {
        doc.providers.push({ ...builtin, models: [...builtin.models] });
      }
    }
    writeJson(modelsPath, doc);
  }

  if (!fs.existsSync(settingsPath)) {
    writeJson(settingsPath, defaultSettingsDoc());
  } else {
    const settings = readJson(settingsPath, defaultSettingsDoc);
    if (!settings.theme) {
      settings.theme = "light";
      writeJson(settingsPath, settings);
    }
  }
}

function maskKey(apiKey) {
  if (!apiKey) return { hasKey: false, preview: "" };
  if (apiKey.length <= 8) return { hasKey: true, preview: "••••" };
  return {
    hasKey: true,
    preview: `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`,
  };
}

function toPublicModels(doc) {
  return {
    version: doc.version || 1,
    providers: (doc.providers || []).map((p) => {
      const masked = maskKey(p.apiKey || "");
      return {
        id: p.id,
        name: p.name,
        type: p.type || "openai-compatible",
        baseUrl: p.baseUrl || "",
        builtin: Boolean(p.builtin),
        models: Array.isArray(p.models) ? p.models : [],
        hasKey: masked.hasKey,
        apiKeyPreview: masked.preview,
      };
    }),
    modelsPath: getModelsStorePath(),
    settingsPath: getSettingsStorePath(),
  };
}

function getModelConfig() {
  ensureModelConfig();
  const models = readJson(getModelsStorePath(), defaultModelsDoc);
  const settings = readJson(getSettingsStorePath(), defaultSettingsDoc);
  return {
    ...toPublicModels(models),
    defaultModel: settings.defaultModel || defaultSettingsDoc().defaultModel,
    theme: settings.theme === "dark" ? "dark" : "light",
  };
}

/** Internal: includes API keys. Main-process only. */
function getRawModelConfig() {
  ensureModelConfig();
  const models = readJson(getModelsStorePath(), defaultModelsDoc);
  const settings = readJson(getSettingsStorePath(), defaultSettingsDoc);
  return {
    providers: models.providers || [],
    defaultModel: settings.defaultModel || defaultSettingsDoc().defaultModel,
  };
}

function isValidHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * @param {{
 *   providers?: Array<{
 *     id: string;
 *     name: string;
 *     type?: string;
 *     baseUrl: string;
 *     apiKey?: string | null;
 *     clearApiKey?: boolean;
 *     builtin?: boolean;
 *     models: Array<{ id: string; name: string }>;
 *   }>;
 *   defaultModel?: { providerId: string; modelId: string };
 * }} patch
 */
function saveModelConfig(patch) {
  ensureModelConfig();
  const modelsPath = getModelsStorePath();
  const settingsPath = getSettingsStorePath();
  const current = readJson(modelsPath, defaultModelsDoc);
  const settings = readJson(settingsPath, defaultSettingsDoc);

  if (Array.isArray(patch.providers)) {
    const existingById = new Map(
      (current.providers || []).map((p) => [p.id, p])
    );
    const nextProviders = [];

    for (const incoming of patch.providers) {
      if (!incoming?.id || !incoming?.name) {
        throw new Error("供应商缺少 id 或 name");
      }
      if (!incoming.baseUrl || !isValidHttpUrl(incoming.baseUrl)) {
        throw new Error(`供应商「${incoming.name}」的 Base URL 格式不合法`);
      }
      if (!Array.isArray(incoming.models) || incoming.models.length === 0) {
        throw new Error(`供应商「${incoming.name}」至少需要一个模型`);
      }
      for (const m of incoming.models) {
        if (!m?.id) throw new Error(`供应商「${incoming.name}」存在空模型 id`);
      }

      const prev = existingById.get(incoming.id);
      let apiKey = prev?.apiKey || "";
      if (incoming.clearApiKey) {
        apiKey = "";
      } else if (typeof incoming.apiKey === "string" && incoming.apiKey.length > 0) {
        // empty string from UI means "keep existing"
        apiKey = incoming.apiKey;
      }

      nextProviders.push({
        id: incoming.id,
        name: incoming.name,
        type: incoming.type || "openai-compatible",
        baseUrl: incoming.baseUrl.replace(/\/$/, ""),
        apiKey,
        builtin: Boolean(incoming.builtin ?? prev?.builtin),
        models: incoming.models.map((m) => ({
          id: String(m.id).trim(),
          name: String(m.name || m.id).trim(),
        })),
      });
    }

    current.providers = nextProviders;
    current.version = 1;
    writeJson(modelsPath, current);
  }

  if (patch.defaultModel?.providerId && patch.defaultModel?.modelId) {
    const provider = (current.providers || []).find(
      (p) => p.id === patch.defaultModel.providerId
    );
    if (!provider) {
      throw new Error("默认模型对应的供应商不存在");
    }
    const modelOk = (provider.models || []).some(
      (m) => m.id === patch.defaultModel.modelId
    );
    if (!modelOk) {
      throw new Error("默认模型不在所选供应商的模型列表中");
    }
    settings.defaultModel = {
      providerId: patch.defaultModel.providerId,
      modelId: patch.defaultModel.modelId,
    };
    settings.version = 1;
    writeJson(settingsPath, settings);
  }

  if (patch.theme === "light" || patch.theme === "dark") {
    settings.theme = patch.theme;
    settings.version = 1;
    writeJson(settingsPath, settings);
  }

  return getModelConfig();
}

function getTheme() {
  ensureModelConfig();
  const settings = readJson(getSettingsStorePath(), defaultSettingsDoc);
  return settings.theme === "dark" ? "dark" : "light";
}

function setTheme(theme) {
  ensureModelConfig();
  const settingsPath = getSettingsStorePath();
  const settings = readJson(settingsPath, defaultSettingsDoc);
  settings.theme = theme === "dark" ? "dark" : "light";
  settings.version = 1;
  writeJson(settingsPath, settings);
  return settings.theme;
}

function getLocale() {
  ensureModelConfig();
  const settings = readJson(getSettingsStorePath(), defaultSettingsDoc);
  return settings.locale === "en" ? "en" : "zh";
}

function setLocale(locale) {
  ensureModelConfig();
  const settingsPath = getSettingsStorePath();
  const settings = readJson(settingsPath, defaultSettingsDoc);
  settings.locale = locale === "en" ? "en" : "zh";
  settings.version = 1;
  writeJson(settingsPath, settings);
  return settings.locale;
}

function createCustomProviderId() {
  return `custom-${crypto.randomBytes(4).toString("hex")}`;
}

module.exports = {
  ensureModelConfig,
  getModelConfig,
  getRawModelConfig,
  saveModelConfig,
  createCustomProviderId,
  getModelsStorePath,
  getSettingsStorePath,
  getTheme,
  setTheme,
  getLocale,
  setLocale,
};
