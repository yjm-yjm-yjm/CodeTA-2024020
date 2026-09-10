import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Project } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";

export default function StudentList() {
  const [projects, setProjects] = useState<Project[]>([]);

  const load = useCallback(async () => {
    setProjects(await api<Project[]>("/student/projects"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">我的立项</h1>
        <Link to="/student/projects/new">
          <Button>新建立项</Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-slate-400">
            还没有立项申请，点击右上角新建
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="truncate font-semibold text-slate-800">{p.title}</h3>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-500">
                    技术栈：{p.tech_stack || "-"} · 团队规模：{p.team_size || 1} 人
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {p.status === "draft" && (
                    <Link to={`/student/projects/${p.id}/edit`}>
                      <Button variant="outline" size="sm">
                        编辑
                      </Button>
                    </Link>
                  )}
                  <Link to={`/student/projects/${p.id}/result`}>
                    <Button variant="ghost" size="sm">
                      评审结果
                    </Button>
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
