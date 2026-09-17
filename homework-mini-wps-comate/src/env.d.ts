/// <reference types="vite/client" />

export type ComateUser = {
  id: string;
  user_name: string;
  avatar?: string;
  company_id?: string;
};

export type ComateAuthState = {
  loggedIn: boolean;
  user?: ComateUser | null;
  accessTokenPreview?: string | null;
  accessTokenExpiresAt?: number | null;
  savedAt?: string | null;
  authStorePath?: string | null;
};

export type ComateLoginResult = {
  ok: boolean;
  error?: string;
  authorizeUrl?: string;
  callbackPort?: number;
};

export type ModelRef = {
  providerId: string;
  modelId: string;
};

export type ProviderModel = {
  id: string;
  name: string;
};

export type PublicProvider = {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  builtin: boolean;
  models: ProviderModel[];
  hasKey: boolean;
  apiKeyPreview: string;
};

export type ModelConfig = {
  version: number;
  providers: PublicProvider[];
  defaultModel: ModelRef;
  modelsPath: string;
  settingsPath: string;
  theme?: ThemeMode;
};

export type ThemeMode = "light" | "dark";

export type Locale = "zh" | "en";

export type ProviderSaveInput = {
  id: string;
  name: string;
  type?: string;
  baseUrl: string;
  apiKey?: string | null;
  clearApiKey?: boolean;
  builtin?: boolean;
  models: ProviderModel[];
};

export type ModelConfigSaveResult = {
  ok: boolean;
  error?: string;
  config?: ModelConfig;
};

export type ChatEvent = {
  type: string;
  [key: string]: unknown;
};

export type ChatEnsureResult = {
  ok: boolean;
  error?: string;
  model?: string;
  sessionId?: string;
  already?: boolean;
};

export type ChatSendResult = {
  ok: boolean;
  error?: string;
  queued?: boolean;
  userId?: string;
};

export type SessionInfo = {
  id: string;
  title: string;
  pinned: boolean;
  filePath?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  active?: boolean;
};

export type SessionOpResult = {
  ok: boolean;
  error?: string;
  sessionId?: string;
  already?: boolean;
  session?: SessionInfo;
  sessions?: SessionInfo[];
};

export type ProjectConfig = {
  projectRoot: string | null;
  whitelist: string[];
  allowedRoots: string[];
  toolsEnabled: boolean;
  storePath?: string;
};

export type ProjectOpResult = {
  ok: boolean;
  error?: string;
  cancelled?: boolean;
  project?: ProjectConfig;
  sessionId?: string;
  model?: string;
};

export type ComateAPI = {
  getAuth: () => Promise<ComateAuthState>;
  login: () => Promise<ComateLoginResult>;
  logout: () => Promise<{ ok: boolean }>;
  getPaths: () => Promise<{
    appDataRoot: string;
    authStorePath: string;
    modelsPath: string;
    settingsPath: string;
  }>;
  getModelConfig: () => Promise<ModelConfig>;
  saveModelConfig: (patch: {
    providers?: ProviderSaveInput[];
    defaultModel?: ModelRef;
    theme?: ThemeMode;
  }) => Promise<ModelConfigSaveResult>;
  newCustomProviderId: () => Promise<string>;
  getTheme: () => Promise<{ ok: boolean; theme: ThemeMode }>;
  setTheme: (theme: ThemeMode) => Promise<{
    ok: boolean;
    theme?: ThemeMode;
    error?: string;
  }>;
  getLocale: () => Promise<{ ok: boolean; locale: Locale }>;
  setLocale: (locale: Locale) => Promise<{
    ok: boolean;
    locale?: Locale;
    error?: string;
  }>;
  chatStatus: () => Promise<{
    ready: boolean;
    streaming: boolean;
    queueLength: number;
    sessionId: string | null;
  }>;
  chatEnsure: () => Promise<ChatEnsureResult>;
  chatSend: (text: string) => Promise<ChatSendResult>;
  chatAbort: () => Promise<{ ok: boolean; error?: string; already?: boolean }>;
  chatReset: () => Promise<ChatEnsureResult>;
  listSessions: () => Promise<SessionOpResult>;
  createSession: () => Promise<SessionOpResult>;
  switchSession: (id: string) => Promise<SessionOpResult>;
  deleteSession: (id: string) => Promise<SessionOpResult>;
  renameSession: (id: string, title: string) => Promise<SessionOpResult>;
  pinSession: (id: string, pinned: boolean) => Promise<SessionOpResult>;
  getProject: () => Promise<ProjectOpResult>;
  pickProjectRoot: () => Promise<ProjectOpResult>;
  clearProject: () => Promise<ProjectOpResult>;
  addProjectWhitelist: () => Promise<ProjectOpResult>;
  removeProjectWhitelist: (dirPath: string) => Promise<ProjectOpResult>;
  onAuthChanged: (callback: (state: ComateAuthState) => void) => () => void;
  onAuthError: (callback: (message: string) => void) => () => void;
  onThemeChanged: (callback: (theme: ThemeMode) => void) => () => void;
  onLocaleChanged: (callback: (locale: Locale) => void) => () => void;
  onChatEvent: (callback: (event: ChatEvent) => void) => () => void;
};

declare global {
  interface Window {
    comate: ComateAPI;
  }
}

export {};
