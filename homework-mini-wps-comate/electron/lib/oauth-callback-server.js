const http = require("node:http");
const { CALLBACK_PORT } = require("./wps-oauth");

/**
 * Fixed-port OAuth callback server.
 * Port MUST stay 18365 (registered on WPS open platform).
 */
function createCallbackServer({ expectedState, onSuccess, onError }) {
  let settled = false;

  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || "/", `http://127.0.0.1:${CALLBACK_PORT}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not Found");
        return;
      }

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const err = url.searchParams.get("error");
      const errDesc = url.searchParams.get("error_description");

      if (err) {
        finishHtml(res, false, `授权失败：${errDesc || err}`);
        if (!settled) {
          settled = true;
          onError(new Error(errDesc || err));
        }
        return;
      }

      if (!code) {
        finishHtml(res, false, "回调缺少 code 参数");
        if (!settled) {
          settled = true;
          onError(new Error("回调缺少 code 参数"));
        }
        return;
      }

      if (state !== expectedState) {
        finishHtml(res, false, "state 校验失败，请重试登录");
        if (!settled) {
          settled = true;
          onError(new Error("OAuth state 不匹配"));
        }
        return;
      }

      finishHtml(res, true, "登录成功，请返回 Mini WPS Comate 客户端。");
      if (!settled) {
        settled = true;
        onSuccess(code);
      }
    } catch (e) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal Error");
      if (!settled) {
        settled = true;
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", (err) => {
      if (err && err.code === "EADDRINUSE") {
        reject(
          new Error(
            `回调端口 ${CALLBACK_PORT} 已被占用。开放平台仅登记 http://127.0.0.1:${CALLBACK_PORT}/callback，不能换端口。请关闭占用该端口的程序后重试。`
          )
        );
        return;
      }
      reject(err);
    });

    server.listen(CALLBACK_PORT, "127.0.0.1", () => {
      resolve({
        server,
        close: () =>
          new Promise((resClose) => {
            server.close(() => resClose());
          }),
      });
    });
  });
}

function finishHtml(res, ok, message) {
  const title = ok ? "授权成功" : "授权失败";
  const color = ok ? "#0f7b4a" : "#b42318";
  res.writeHead(ok ? 200 : 400, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8" /><title>${title}</title>
<style>
  body{font-family:Segoe UI,Microsoft YaHei,sans-serif;background:#f4f6f8;color:#1a1d21;
    display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#fff;border:1px solid #e5e8eb;border-radius:12px;padding:28px 32px;
    max-width:420px;box-shadow:0 8px 24px rgba(16,24,40,.06)}
  h1{font-size:18px;margin:0 0 8px;color:${color}}
  p{margin:0;line-height:1.6;color:#4b5563}
</style></head>
<body><div class="card"><h1>${title}</h1><p>${escapeHtml(message)}</p></div></body>
</html>`);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

module.exports = { createCallbackServer };
