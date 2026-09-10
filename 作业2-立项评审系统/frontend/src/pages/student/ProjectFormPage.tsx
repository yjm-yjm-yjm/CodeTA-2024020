import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Project, ProjectInput } from "@/types";

export default function ProjectFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState<ProjectInput>({
    title: "",
    description: "",
    tech_stack: "",
    team_size: 1,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEdit) {
      (async () => {
        const all = await api<Project[]>("/student/projects");
        const p = all.find((x) => String(x.id) === id);
        if (p) {
          setForm({
            title: p.title,
            description: p.description,
            tech_stack: p.tech_stack,
            team_size: p.team_size,
          });
        }
      })();
    }
  }, [isEdit, id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isEdit) {
        await api(`/student/projects/${id}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      } else {
        await api("/student/projects", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }
      nav("/student/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitDraft() {
    if (!isEdit) return;
    setError("");
    try {
      await api(`/student/projects/${id}/submit`, { method: "POST" });
      nav("/student/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">
        {isEdit ? "编辑立项申请" : "新建立项申请"}
      </h1>
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 pt-5">
            <div>
              <Label>项目标题</Label>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="例如：基于大模型的教学辅助工具"
              />
            </div>
            <div>
              <Label>项目描述</Label>
              <Textarea
                required
                rows={5}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="介绍项目背景、目标用户、核心功能与预期成果"
              />
            </div>
            <div>
              <Label>技术栈</Label>
              <Input
                value={form.tech_stack}
                onChange={(e) => setForm({ ...form, tech_stack: e.target.value })}
                placeholder="例如：React + Go + MySQL"
              />
            </div>
            <div>
              <Label>团队规模</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={form.team_size}
                onChange={(e) =>
                  setForm({ ...form, team_size: Number(e.target.value) || 1 })
                }
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "保存中..." : "保存"}
              </Button>
              {isEdit && (
                <Button type="button" variant="destructive" onClick={handleSubmitDraft}>
                  提交评审
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => nav("/student/projects")}
              >
                取消
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
