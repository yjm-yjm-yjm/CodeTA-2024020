const fs = require("node:fs");
const path = require("node:path");
const { assertAllowedResolved } = require("./path-guard");

const MAX_WRITE_BYTES = 512 * 1024; // 小文件上限

/**
 * Build pi custom tool definitions scoped to allowed roots.
 * @param {typeof import('@earendil-works/pi-coding-agent')} pi
 * @param {string} cwd
 * @param {string[]} roots
 */
function buildGuardedToolDefinitions(pi, cwd, roots) {
  const readOps = {
    readFile: async (absolutePath) => {
      const p = assertAllowedResolved(absolutePath, roots, "读取路径");
      return fs.promises.readFile(p);
    },
    access: async (absolutePath) => {
      const p = assertAllowedResolved(absolutePath, roots, "访问路径");
      await fs.promises.access(p, fs.constants.R_OK);
    },
  };

  const writeOps = {
    writeFile: async (absolutePath, content) => {
      const p = assertAllowedResolved(absolutePath, roots, "写入路径");
      const size = Buffer.byteLength(String(content ?? ""), "utf8");
      if (size > MAX_WRITE_BYTES) {
        throw new Error(
          `文件过大（${size} 字节），已限制为 ${MAX_WRITE_BYTES} 字节以内`
        );
      }
      await fs.promises.writeFile(p, String(content ?? ""), "utf8");
    },
    mkdir: async (dir) => {
      const p = assertAllowedResolved(dir, roots, "目录路径");
      await fs.promises.mkdir(p, { recursive: true });
    },
  };

  const editOps = {
    readFile: readOps.readFile,
    writeFile: writeOps.writeFile,
    access: async (absolutePath) => {
      const p = assertAllowedResolved(absolutePath, roots, "编辑路径");
      await fs.promises.access(p, fs.constants.R_OK | fs.constants.W_OK);
    },
  };

  const lsOps = {
    exists: async (absolutePath) => {
      try {
        assertAllowedResolved(absolutePath, roots, "列表路径");
        await fs.promises.access(absolutePath);
        return true;
      } catch (e) {
        if (String(e.message || "").includes("白名单")) throw e;
        return false;
      }
    },
    stat: async (absolutePath) => {
      const p = assertAllowedResolved(absolutePath, roots, "列表路径");
      return fs.promises.stat(p);
    },
    readdir: async (absolutePath) => {
      const p = assertAllowedResolved(absolutePath, roots, "列表路径");
      return fs.promises.readdir(p);
    },
  };

  return [
    pi.createReadToolDefinition(cwd, { operations: readOps }),
    pi.createLsToolDefinition(cwd, { operations: lsOps }),
    pi.createEditToolDefinition(cwd, { operations: editOps }),
    pi.createWriteToolDefinition(cwd, { operations: writeOps }),
  ];
}

function describeProjectForPrompt(projectRoot, roots) {
  if (!projectRoot) {
    return "当前未选择本地项目：不要尝试读写文件；请提示用户先选择本地项目目录。";
  }
  const extra = roots.filter((r) => path.resolve(r) !== path.resolve(projectRoot));
  return [
    `当前本地项目目录（工作区 cwd）：${projectRoot}`,
    `允许访问的白名单根目录：${roots.join("；")}`,
    extra.length
      ? `额外白名单：${extra.join("；")}`
      : "白名单目前仅包含项目根目录。",
    "只能使用 read / ls / edit / write 操作白名单内的路径；禁止访问白名单外路径。",
    "改文件时优先用 edit；新建或整文件覆盖用 write；单文件不超过约 512KB。",
  ].join("\n");
}

module.exports = {
  MAX_WRITE_BYTES,
  buildGuardedToolDefinitions,
  describeProjectForPrompt,
};
