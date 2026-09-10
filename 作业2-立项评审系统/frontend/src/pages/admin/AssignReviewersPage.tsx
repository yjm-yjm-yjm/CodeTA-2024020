import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { Project, User } from "@/types";

export default function AdminAssign() {
  const { id } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [reviewers, setReviewers] = useState<User[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await api<{ project: Project; reviewers: { reviewer_id: number }[] }>(
        `/admin/projects/${id}`
      );
      setProject(res.project);
      setSelected(res.reviewers.map((r) => r.reviewer_id));
      const users = await api<User[]>("/admin/users");
      setReviewers(users.filter((u) => u.role === "reviewer"));
    })();
  }, [id]);

  function toggle(rid: number) {
    setSelected((prev) =>
      prev.includes(rid) ? prev.filter((x) => x !== rid) : [...prev, rid]
    );
  }

  async function handleAssign() {
    setError("");
    try {
      await api(`/admin/projects/${id}/assign`, {
        method: "POST",
        body: JSON.stringify({ reviewer_ids: selected }),
      });
      nav("/admin/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "分配失败");
    }
  }

  if (!project) return <div className="p-8 text-center text-slate-400">加载中...</div>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">分配评委</h1>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{project.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p>申请人：{project.student?.email || "-"}</p>
          <p className="whitespace-pre-wrap">{project.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>选择评委</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reviewers.length === 0 ? (
            <p className="text-sm text-slate-400">暂无评委账号，请先在注册页注册评委账号</p>
          ) : (
            reviewers.map((r) => {
              const active = selected.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggle(r.id)}
                  className={`flex w-full items-center justify-between rounded-md border px-4 py-3 text-left ${
                    active ? "border-indigo-500 bg-indigo-50" : "border-slate-200"
                  }`}
                >
                  <span className="text-sm text-slate-700">{r.email}</span>
                  {active && <Badge tone="indigo">已选择</Badge>}
                </button>
              );
            })
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleAssign} disabled={selected.length === 0}>
              保存分配
            </Button>
            <Button variant="ghost" onClick={() => nav("/admin/projects")}>
              返回
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
