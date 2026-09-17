const crypto = require("node:crypto");

/**
 * KSO-1 signature headers for openapi.wps.cn
 * @see https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description
 */
function buildKso1Headers({
  accessKey,
  secretKey,
  method,
  uri,
  contentType = "application/json",
  body = "",
}) {
  const ksoDate = new Date().toUTCString();
  const bodyStr = body == null ? "" : String(body);
  const bodyHash =
    bodyStr.length > 0
      ? crypto.createHash("sha256").update(bodyStr, "utf8").digest("hex")
      : "";

  const signingPayload =
    "KSO-1" + method.toUpperCase() + uri + contentType + ksoDate + bodyHash;

  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(signingPayload, "utf8")
    .digest("hex");

  return {
    "Content-Type": contentType,
    "X-Kso-Date": ksoDate,
    "X-Kso-Authorization": `KSO-1 ${accessKey}:${signature}`,
  };
}

module.exports = { buildKso1Headers };
