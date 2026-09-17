const path = require("node:path");
const fs = require("node:fs");

/**
 * True if target is the root itself or a path under root.
 */
function isPathInside(target, root) {
  const absTarget = path.resolve(target);
  const absRoot = path.resolve(root);
  if (absTarget === absRoot) return true;
  const rel = path.relative(absRoot, absTarget);
  return Boolean(rel) && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function isAllowedPath(target, roots) {
  if (!Array.isArray(roots) || roots.length === 0) return false;
  return roots.some((root) => isPathInside(target, root));
}

function assertAllowedPath(target, roots, label = "路径") {
  if (!roots || roots.length === 0) {
    throw new Error("未选择本地项目，无法访问文件系统");
  }
  const abs = path.resolve(target);
  if (!isAllowedPath(abs, roots)) {
    throw new Error(`${label}不在白名单内，已拦截：${abs}`);
  }
  return abs;
}

function resolveExistingReal(absPath) {
  try {
    return fs.realpathSync(absPath);
  } catch {
    // Parent may exist when creating a new file
    try {
      return path.join(
        fs.realpathSync(path.dirname(absPath)),
        path.basename(absPath)
      );
    } catch {
      return absPath;
    }
  }
}

function assertAllowedResolved(target, roots, label) {
  const abs = path.resolve(target);
  // Check both lexical and realpath (symlink escape)
  assertAllowedPath(abs, roots, label);
  try {
    const real = resolveExistingReal(abs);
    assertAllowedPath(real, roots, label);
    return real;
  } catch (e) {
    if (e && String(e.message || "").includes("白名单")) throw e;
    return abs;
  }
}

module.exports = {
  isPathInside,
  isAllowedPath,
  assertAllowedPath,
  assertAllowedResolved,
};
