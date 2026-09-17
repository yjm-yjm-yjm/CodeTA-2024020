const { app, BrowserWindow, ipcMain, dialog, Menu, session } = require("electron");
const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs");
const { ensureAppDataLayout, getAppDataRoot } = require("./lib/paths");
const {
  readAuth,
  writeAuth,
  clearAuth,
  toPublicAuth,
} = require("./lib/auth-store");
const {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchCurrentUser,
  CALLBACK_PORT,
} = require("./lib/wps-oauth");
const { createCallbackServer } = require("./lib/oauth-callback-server");
const {
  ensureModelConfig,
  getModelConfig,
  saveModelConfig,
  createCustomProviderId,
  getTheme,
  setTheme,
  getLocale,
  setLocale,
} = require("./lib/model-store");
const { getAuthStorePath } = require("./lib/paths");
const agentService = require("./lib/agent-service");

const OAUTH_PARTITION = "persist:wps-oauth-login";

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let authWindow = null;
/** @type {{ close: () => Promise<void> } | null} */
let activeCallback = null;
let loginInFlight = false;
let authFlowSettled = false;

function getOAuthSession() {
  return session.fromPartition(OAUTH_PARTITION);
}

async function clearOAuthBrowserState() {
  const ses = getOAuthSession();
  try {
    await ses.clearStorageData();
  } catch {
    /* ignore */
  }
  try {
    await ses.clearCache();
  } catch {
    /* ignore */
  }
}

function closeAuthWindow() {
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.removeAllListeners("closed");
    authWindow.close();
  }
  authWindow = null;
}

async function openAuthorizeWindow(authUrl) {
  closeAuthWindow();
  // Wipe partition cookies so SSO cannot skip QR scan
  await clearOAuthBrowserState();

  const mainBounds =
    mainWindow && !mainWindow.isDestroyed()
      ? mainWindow.getBounds()
      : { width: 1280, height: 800, x: undefined, y: undefined };

  authWindow = new BrowserWindow({
    width: mainBounds.width,
    height: mainBounds.height,
    x: mainBounds.x,
    y: mainBounds.y,
    minWidth: 960,
    minHeight: 640,
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    modal: false,
    title: "WPS 扫码登录",
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    show: false,
    webPreferences: {
      partition: OAUTH_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  authWindow.once("ready-to-show", () => {
    if (authWindow && !authWindow.isDestroyed()) {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized()) {
        authWindow.maximize();
      }
      authWindow.show();
      authWindow.focus();
    }
  });

  authWindow.loadURL(authUrl);
  authWindow.on("closed", () => {
    authWindow = null;
    if (!authFlowSettled && loginInFlight) {
      loginInFlight = false;
      void stopCallbackServer();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          "auth:error",
          "授权失败，请重新登录"
        );
        mainWindow.focus();
      }
    }
  });
}

function createWindow() {
  // Hide default File/Edit/View/Window/Help menu (Electron scaffold leftovers).
  Menu.setApplicationMenu(null);

  const iconPath = path.join(__dirname, "..", "build-resources", "logo.ico");
  const iconPngFallback = path.join(
    __dirname,
    "..",
    "build-resources",
    "logo.png"
  );
  const resolvedIcon = fs.existsSync(iconPath) ? iconPath : iconPngFallback;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: "Mini WPS Comate",
    backgroundColor: "#f5f6f8",
    icon: resolvedIcon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function broadcastAuth() {
  const payload = toPublicAuth(readAuth());
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("auth:changed", payload);
  }
}

async function stopCallbackServer() {
  if (activeCallback) {
    const cur = activeCallback;
    activeCallback = null;
    try {
      await cur.close();
    } catch {
      /* ignore */
    }
  }
}

async function startLoginFlow() {
  if (loginInFlight) {
    return { ok: false, error: "登录流程进行中，请完成扫码或稍后再试" };
  }
  loginInFlight = true;
  authFlowSettled = false;

  try {
    await stopCallbackServer();
    closeAuthWindow();
    const state = crypto.randomUUID();

    const callback = await createCallbackServer({
      expectedState: state,
      onSuccess: async (code) => {
        try {
          const token = await exchangeCodeForToken(code);
          const user = await fetchCurrentUser(token.access_token);
          const now = Date.now();
          const sessionData = {
            access_token: token.access_token,
            refresh_token: token.refresh_token || null,
            token_type: token.token_type || "bearer",
            expires_in: token.expires_in || 7200,
            access_token_expires_at: now + (token.expires_in || 7200) * 1000,
            refresh_expires_in: token.refresh_expires_in || null,
            user: {
              id: user.id,
              user_name: user.user_name,
              avatar: user.avatar,
              company_id: user.company_id,
            },
            saved_at: new Date().toISOString(),
          };
          writeAuth(sessionData);
          broadcastAuth();
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("auth:error", message);
          }
        } finally {
          authFlowSettled = true;
          closeAuthWindow();
          await stopCallbackServer();
          loginInFlight = false;
        }
      },
      onError: async (err) => {
        const message = err instanceof Error ? err.message : String(err);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("auth:error", message);
        }
        authFlowSettled = true;
        closeAuthWindow();
        await stopCallbackServer();
        loginInFlight = false;
      },
    });

    activeCallback = callback;
    const authUrl = buildAuthorizeUrl(state);
    await openAuthorizeWindow(authUrl);
    return {
      ok: true,
      authorizeUrl: authUrl,
      callbackPort: CALLBACK_PORT,
    };
  } catch (e) {
    loginInFlight = false;
    authFlowSettled = true;
    closeAuthWindow();
    await stopCallbackServer();
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function registerIpc() {
  ipcMain.handle("auth:get", async () => toPublicAuth(readAuth()));

  ipcMain.handle("auth:login", async () => startLoginFlow());

  ipcMain.handle("auth:logout", async () => {
    await stopCallbackServer();
    loginInFlight = false;
    authFlowSettled = true;
    closeAuthWindow();
    clearAuth();
    await clearOAuthBrowserState();
    broadcastAuth();
    return { ok: true };
  });

  ipcMain.handle("app:getPaths", async () => ({
    appDataRoot: getAppDataRoot(),
    authStorePath: getAuthStorePath(),
    modelsPath: require("./lib/model-store").getModelsStorePath(),
    settingsPath: require("./lib/model-store").getSettingsStorePath(),
    sessionsDir: require("./lib/session-index").getSessionsDir(),
    sessionIndexPath: require("./lib/session-index").getSessionIndexPath(),
    projectStorePath: require("./lib/project-store").getProjectStorePath(),
  }));

  ipcMain.handle("models:get", async () => getModelConfig());

  ipcMain.handle("models:save", async (_event, patch) => {
    try {
      const config = saveModelConfig(patch || {});
      // Model/key changes require a fresh agent session.
      agentService.disposeSession();
      return { ok: true, config };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

  ipcMain.handle("models:newCustomId", async () => createCustomProviderId());

  ipcMain.handle("theme:get", async () => ({ ok: true, theme: getTheme() }));

  ipcMain.handle("theme:set", async (_event, theme) => {
    try {
      const next = setTheme(theme);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("theme:changed", next);
      }
      return { ok: true, theme: next };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle("locale:get", async () => ({
    ok: true,
    locale: getLocale(),
  }));

  ipcMain.handle("locale:set", async (_event, locale) => {
    try {
      const next = setLocale(locale);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("locale:changed", next);
      }
      return { ok: true, locale: next };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle("chat:status", async () => agentService.getStatus());

  ipcMain.handle("chat:ensure", async () => {
    try {
      return await agentService.ensureSession();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle("chat:send", async (_event, text) =>
    agentService.sendMessage(text)
  );

  ipcMain.handle("chat:abort", async () => {
    try {
      return await agentService.abortGeneration();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle("chat:reset", async () => agentService.resetSession());

  ipcMain.handle("sessions:list", async () => {
    await agentService.refreshSessionsFromDisk();
    return { ok: true, sessions: agentService.listSessions() };
  });

  ipcMain.handle("sessions:create", async () => agentService.createSession());

  ipcMain.handle("sessions:switch", async (_event, id) =>
    agentService.switchSession(id)
  );

  ipcMain.handle("sessions:delete", async (_event, id) =>
    agentService.deleteSession(id)
  );

  ipcMain.handle("sessions:rename", async (_event, payload) =>
    agentService.renameSession(payload?.id, payload?.title)
  );

  ipcMain.handle("sessions:pin", async (_event, payload) =>
    agentService.pinSession(payload?.id, payload?.pinned)
  );

  ipcMain.handle("project:get", async () => ({
    ok: true,
    project: agentService.getProjectSnapshot(),
  }));

  ipcMain.handle("project:pickRoot", async () => {
    const result = await dialog.showOpenDialog(mainWindow || undefined, {
      title: "选择本地项目目录",
      properties: ["openDirectory"],
    });
    if (result.canceled || !result.filePaths?.[0]) {
      return { ok: false, cancelled: true };
    }
    return agentService.setProjectRootPath(result.filePaths[0]);
  });

  ipcMain.handle("project:clear", async () => agentService.clearProjectRoot());

  ipcMain.handle("project:addWhitelist", async () => {
    const result = await dialog.showOpenDialog(mainWindow || undefined, {
      title: "添加白名单目录",
      properties: ["openDirectory"],
    });
    if (result.canceled || !result.filePaths?.[0]) {
      return { ok: false, cancelled: true };
    }
    return agentService.addProjectWhitelist(result.filePaths[0]);
  });

  ipcMain.handle("project:removeWhitelist", async (_event, dirPath) =>
    agentService.removeProjectWhitelist(dirPath)
  );
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ensureAppDataLayout();
  ensureModelConfig();
  registerIpc();
  createWindow();

  agentService.setEmitter((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("chat:event", event);
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopCallbackServer();
  agentService.disposeSession();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopCallbackServer();
  agentService.disposeSession();
});
