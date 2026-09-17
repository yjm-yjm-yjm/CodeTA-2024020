const fs = require("node:fs");
const path = require("node:path");
const { buildKso1Headers } = require("./kso-sign");

function loadDotEnv() {
  const envPath = path.join(__dirname, "..", "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

const OAUTH_AUTH_URL = "https://openapi.wps.cn/oauth2/auth";
const OAUTH_TOKEN_URL = "https://openapi.wps.cn/oauth2/token";
const USER_INFO_URL = "https://openapi.wps.cn/v7/users/current";
const CALLBACK_PORT = 18365;

function getOAuthConfig() {
  const appId = process.env.WPS_APP_ID || "";
  const appSecret = process.env.WPS_APP_SECRET || "";
  const redirectUri =
    process.env.WPS_REDIRECT_URI || `http://127.0.0.1:${CALLBACK_PORT}/callback`;
  const scope = process.env.WPS_OAUTH_SCOPE || "kso.user_base.read";

  if (!appId || !appSecret || appSecret === "your_app_secret_here") {
    throw new Error(
      "缺少 WPS_APP_ID / WPS_APP_SECRET。请复制 .env.example 为 .env 并填入作业提供的应用凭证。"
    );
  }

  return { appId, appSecret, redirectUri, scope, callbackPort: CALLBACK_PORT };
}

function buildAuthorizeUrl(state, options = {}) {
  const { appId, redirectUri, scope } = getOAuthConfig();
  const url = new URL(OAUTH_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  // Force account picker / re-login so SSO cookies don't skip QR scan.
  // login: re-authenticate; consent: show authorize again if supported.
  const prompt = options.prompt || "login consent";
  url.searchParams.set("prompt", prompt);
  url.searchParams.set("max_age", "0");
  // Bust CDN / intermediate caches
  url.searchParams.set("_ts", String(Date.now()));
  return url.toString();
}

async function exchangeCodeForToken(code) {
  const { appId, appSecret, redirectUri } = getOAuthConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: appId,
    client_secret: appSecret,
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const msg =
      data.error_description ||
      data.error ||
      data.msg ||
      `换取 token 失败 (HTTP ${res.status})`;
    throw new Error(String(msg));
  }
  return data;
}

async function fetchCurrentUser(accessToken) {
  const { appId, appSecret } = getOAuthConfig();
  const uri = "/v7/users/current";
  const headers = {
    ...buildKso1Headers({
      accessKey: appId,
      secretKey: appSecret,
      method: "GET",
      uri,
      contentType: "application/json",
      body: "",
    }),
    Authorization: `Bearer ${accessToken}`,
  };

  const res = await fetch(USER_INFO_URL, { method: "GET", headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.code !== 0 || !data.data) {
    const msg = data.msg || data.message || `获取用户信息失败 (HTTP ${res.status})`;
    throw new Error(String(msg));
  }
  return data.data;
}

module.exports = {
  CALLBACK_PORT,
  getOAuthConfig,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchCurrentUser,
};
