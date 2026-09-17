/**
 * Sidebar session titles: heuristic + optional LLM rewrite (≤14 chars).
 */

const { getRawModelConfig } = require("./model-store");

function charLen(s) {
  return [...String(s || "")].length;
}

function clipChars(s, maxLen) {
  const chars = [...String(s || "")];
  if (chars.length <= maxLen) return chars.join("");
  return chars
    .slice(0, maxLen)
    .join("")
    .replace(/[，,、\s.…·\-—_]+$/u, "");
}

function summarizeTitle(raw, maxLen = 14) {
  let t = String(raw || "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!t) return "新会话";

  t = t
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/https?:\/\/\s+/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const stripOnce = [
    /^(你好|您好|嗨|哈喽|hello|hi)[！!，,。.\s]*/i,
    /^(请问|想问一下|问一下|麻烦问一下)[，,：:\s]*/,
    /^(请|麻烦|劳驾)?(帮我|帮忙|帮下|帮忙一下)[，,：:\s]*/,
    /^(我想|我需要|我想要|希望你|请你)[，,：:\s]*/,
    /^(帮我|帮忙)(写|改|看|查|解释|总结|分析|生成|创建|修改|优化)/,
    /^(介绍一下|请介绍|简单介绍|详细介绍)/,
  ];
  for (const re of stripOnce) {
    t = t.replace(re, "").trim();
  }

  const first = t.split(/[。？！?!；;\n]/)[0] || t;
  t = first.trim().replace(/^[,，、:：\-\s]+/, "");

  t = t
    .replace(/一下/g, "")
    .replace(/这个|那个/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (!t) return "新会话";
  return clipChars(t, maxLen) || "新会话";
}

function sanitizeAiTitle(raw, maxLen = 14) {
  let t = String(raw || "")
    .replace(/^["'「『【\[]+|["'」』】\]]+$/g, "")
    .replace(/\s+/g, "")
    .replace(/[.…]+$/g, "")
    .trim();
  if (!t) return "";
  if (/^(新会话|未命名|untitled|new\s*chat)$/i.test(t)) return "";
  return clipChars(t, maxLen);
}

/**
 * Ask the configured model for a ≤14-char title; fall back to heuristic.
 * @param {string} raw
 * @param {number} [maxLen]
 */
async function summarizeTitleWithAi(raw, maxLen = 14) {
  const fallback = summarizeTitle(raw, maxLen);
  const text = String(raw || "").trim();
  if (!text) return fallback;

  try {
    const cfg = getRawModelConfig();
    const providerId = cfg.defaultModel?.providerId;
    const modelId = cfg.defaultModel?.modelId;
    const provider = (cfg.providers || []).find((p) => p.id === providerId);
    if (!provider?.apiKey || !provider?.baseUrl || !modelId) return fallback;

    const base = String(provider.baseUrl).replace(/\/$/, "");
    const url = `${base}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        temperature: 0.2,
        max_tokens: 48,
        messages: [
          {
            role: "system",
            content:
              "你是会话标题助手。把用户的第一条问题概括成中文标题，严格不超过14个汉字（英文按字母计）。只输出标题本身，不要引号、不要句号、不要省略号、不要解释。示例：用户问「介绍一下我国各省份的名字与简称，并且介绍一下省会城市」→ 输出「省份名称与省会城市介绍」。",
          },
          { role: "user", content: text.slice(0, 800) },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return fallback;
    const data = await res.json();
    const content =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      "";
    const cleaned = sanitizeAiTitle(content, maxLen);
    return cleaned || fallback;
  } catch {
    return fallback;
  }
}

function normalizeSessionTitle(title, firstMessage) {
  const raw = String(title || "").trim();
  const placeholders = new Set(["", "新会话", "未命名会话", "恢复的会话"]);
  if (placeholders.has(raw)) {
    return summarizeTitle(firstMessage || raw, 14);
  }
  if (charLen(raw) > 14 || /[.…]$/.test(raw)) {
    if (firstMessage && String(firstMessage).trim()) {
      return summarizeTitle(firstMessage, 14);
    }
    return summarizeTitle(raw, 14);
  }
  return raw;
}

module.exports = {
  summarizeTitle,
  summarizeTitleWithAi,
  normalizeSessionTitle,
  charLen,
  clipChars,
};
