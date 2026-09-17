import { useEffect, useState } from "react";
import type { ProjectConfig } from "../env";
import "./ProjectBar.css";

export function ProjectBar() {
  const [project, setProject] = useState<ProjectConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refresh();
    const off = window.comate.onChatEvent((event) => {
      if (event.type === "project_changed" && event.project) {
        setProject(event.project as ProjectConfig);
      }
      if (event.type === "session_ready" && event.project) {
        setProject(event.project as ProjectConfig);
      }
    });
    return off;
  }, []);

  async function refresh() {
    const result = await window.comate.getProject();
    if (result.ok && result.project) setProject(result.project);
  }

  async function run(action: () => Promise<{ ok: boolean; error?: string; cancelled?: boolean }>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.cancelled) return;
    if (!result.ok) setError(result.error || "操作失败");
  }

  const root = project?.projectRoot;
  const whitelist = project?.whitelist || [];

  return (
    <div className="project-bar">
      <div className="project-main">
        <div className="project-label">本地项目</div>
        <div className="project-path" title={root || undefined}>
          {root || "未选择（工具未启用，仅对话）"}
        </div>
      </div>
      <div className="project-actions">
        <button
          type="button"
          className="ghost-btn"
          disabled={busy}
          onClick={() => void run(() => window.comate.pickProjectRoot())}
        >
          选择目录
        </button>
        {root ? (
          <button
            type="button"
            className="ghost-btn"
            disabled={busy}
            onClick={() => void run(() => window.comate.clearProject())}
          >
            清除
          </button>
        ) : null}
        <button
          type="button"
          className="ghost-btn"
          disabled={busy || !root}
          onClick={() => void run(() => window.comate.addProjectWhitelist())}
        >
          加白名单
        </button>
      </div>

      {whitelist.length > 0 ? (
        <div className="whitelist">
          <div className="whitelist-title">额外白名单</div>
          {whitelist.map((p) => (
            <div key={p} className="whitelist-row">
              <span title={p}>{p}</span>
              <button
                type="button"
                className="mini"
                disabled={busy}
                onClick={() =>
                  void run(() => window.comate.removeProjectWhitelist(p))
                }
              >
                移除
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="project-error">{error}</p> : null}
      {root ? (
        <p className="project-hint">
          Agent 可在项目根与白名单内使用 read / ls / edit / write；白名单外路径会被拦截。未启用
          bash。
        </p>
      ) : (
        <p className="project-hint">选择本地目录后即可让 Agent 列目录、读写小文件。</p>
      )}
    </div>
  );
}
