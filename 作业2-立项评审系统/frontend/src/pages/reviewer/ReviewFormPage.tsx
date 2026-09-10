import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Conclusion, Project } from "@/types";

export default function ReviewForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [scores, setScores] = useState({ innovation: 5, technology: 5, value: 5 });
  const [conclusion, setConclusion] = useState<Conclusion>("pass");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setProject(await api<Project>(`/reviewer/projects/${id}`));
    })();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api(`/reviewer/reviews/${id}`, {
        method: "POST",
        body: JSON.stringify({ ...scores, conclusion, comment }),
      });
      nav("/reviewer/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setLoading(false);
    }
  }

  if (!project) return <div className="p-8 text-center text-slate-400">加载中...</div>;

  const total =
    scores.innovation * 0.4 + scores.technology * 0.3 + scores.value * 0.3;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">评审申请</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{project.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p>申请人：{project.student?.email || "-"}</p>
          <p>技术栈：{project.tech_stack || "-"}</p>
          <p>团队规模：{project.team_size} 人</p>
          <p className="whitespace-pre-wrap">{project.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>填写评分</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  ["innovation", "创新（0-10）"],
                  ["technology", "技术（0-10）"],
                  ["value", "价值（0-10）"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={scores[key]}
                    onChange={(e) =>
                      setScores({ ...scores, [key]: Number(e.target.value) })
                    }
                  />
                </div>
              ))}
            </div>
            <div className="text-sm text-slate-600">
              综合评分（实时预览）：<span className="font-semibold text-indigo-600">{total.toFixed(1)}</span>
            </div>

            <div>
              <Label>评审结论</Label>
              <div className="flex gap-2">
                {(
                  [
                    ["pass", "通过"],
                    ["revise", "需修改"],
                    ["fail", "不通过"],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setConclusion(val)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                      conclusion === val
                        ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                        : "border-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>评审意见</Label>
              <Textarea
                required
                rows={5}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="请给出具体、有建设性的评审意见"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "提交中..." : "提交评审"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => nav("/reviewer/projects")}>
                取消
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
