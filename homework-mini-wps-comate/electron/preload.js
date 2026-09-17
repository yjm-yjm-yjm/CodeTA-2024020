const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("comate", {
  getAuth: () => ipcRenderer.invoke("auth:get"),
  login: () => ipcRenderer.invoke("auth:login"),
  logout: () => ipcRenderer.invoke("auth:logout"),
  getPaths: () => ipcRenderer.invoke("app:getPaths"),
  getModelConfig: () => ipcRenderer.invoke("models:get"),
  saveModelConfig: (patch) => ipcRenderer.invoke("models:save", patch),
  newCustomProviderId: () => ipcRenderer.invoke("models:newCustomId"),
  getTheme: () => ipcRenderer.invoke("theme:get"),
  setTheme: (theme) => ipcRenderer.invoke("theme:set", theme),
  getLocale: () => ipcRenderer.invoke("locale:get"),
  setLocale: (locale) => ipcRenderer.invoke("locale:set", locale),
  chatStatus: () => ipcRenderer.invoke("chat:status"),
  chatEnsure: () => ipcRenderer.invoke("chat:ensure"),
  chatSend: (text) => ipcRenderer.invoke("chat:send", text),
  chatAbort: () => ipcRenderer.invoke("chat:abort"),
  chatReset: () => ipcRenderer.invoke("chat:reset"),
  listSessions: () => ipcRenderer.invoke("sessions:list"),
  createSession: () => ipcRenderer.invoke("sessions:create"),
  switchSession: (id) => ipcRenderer.invoke("sessions:switch", id),
  deleteSession: (id) => ipcRenderer.invoke("sessions:delete", id),
  renameSession: (id, title) =>
    ipcRenderer.invoke("sessions:rename", { id, title }),
  pinSession: (id, pinned) =>
    ipcRenderer.invoke("sessions:pin", { id, pinned }),
  getProject: () => ipcRenderer.invoke("project:get"),
  pickProjectRoot: () => ipcRenderer.invoke("project:pickRoot"),
  clearProject: () => ipcRenderer.invoke("project:clear"),
  addProjectWhitelist: () => ipcRenderer.invoke("project:addWhitelist"),
  removeProjectWhitelist: (dirPath) =>
    ipcRenderer.invoke("project:removeWhitelist", dirPath),
  onAuthChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("auth:changed", listener);
    return () => ipcRenderer.removeListener("auth:changed", listener);
  },
  onAuthError: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on("auth:error", listener);
    return () => ipcRenderer.removeListener("auth:error", listener);
  },
  onThemeChanged: (callback) => {
    const listener = (_event, theme) => callback(theme);
    ipcRenderer.on("theme:changed", listener);
    return () => ipcRenderer.removeListener("theme:changed", listener);
  },
  onLocaleChanged: (callback) => {
    const listener = (_event, locale) => callback(locale);
    ipcRenderer.on("locale:changed", listener);
    return () => ipcRenderer.removeListener("locale:changed", listener);
  },
  onChatEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("chat:event", listener);
    return () => ipcRenderer.removeListener("chat:event", listener);
  },
});
