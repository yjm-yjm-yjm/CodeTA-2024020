const fs = require("node:fs");
const { ensureAppDataLayout, getAuthStorePath } = require("./paths");

function readAuth() {
  ensureAppDataLayout();
  const file = getAuthStorePath();
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeAuth(session) {
  ensureAppDataLayout();
  const file = getAuthStorePath();
  fs.writeFileSync(file, JSON.stringify(session, null, 2), "utf8");
}

function clearAuth() {
  ensureAppDataLayout();
  const file = getAuthStorePath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function toPublicAuth(session) {
  if (!session) return { loggedIn: false };
  return {
    loggedIn: true,
    user: session.user || null,
    accessTokenPreview: session.access_token
      ? `${session.access_token.slice(0, 12)}…${session.access_token.slice(-8)}`
      : null,
    accessTokenExpiresAt: session.access_token_expires_at || null,
    savedAt: session.saved_at || null,
    authStorePath: getAuthStorePath(),
  };
}

module.exports = {
  readAuth,
  writeAuth,
  clearAuth,
  toPublicAuth,
};
