import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Project } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";

export default function ReviewerList() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    (async () => {
      setProjects(await api<Project[]>("/reviewer/assigned"));
    })();
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">我的评审任务</h1>
      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-slate-400">
            暂未分配评审任务
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>{p.title}</CardTitle>
                <StatusBadge status={p.status} />
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-slate-500">
                  申请人：{p.student?.email || "-"} · 团队规模：{p.team_size} 人
                </p>
                <p className="line-clamp-2 text-sm text-slate-600">{p.description}</p>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-400">技术栈：{p.tech_stack || "-"}</span>
                  <Link to={`/reviewer/projects/${p.id}/review`}>
                    <Button size="sm">评审</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
