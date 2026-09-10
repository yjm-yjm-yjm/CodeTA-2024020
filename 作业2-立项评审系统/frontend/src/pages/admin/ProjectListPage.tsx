import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Project } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";

export default function AdminProjects() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    (async () => {
      setProjects(await api<Project[]>("/admin/projects"));
    })();
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">立项管理</h1>
      <div className="grid gap-4">
        {projects.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>{p.title}</CardTitle>
              <StatusBadge status={p.status} />
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                申请人：{p.student?.email || "-"} · 团队规模：{p.team_size}
              </p>
              <Link to={`/admin/projects/${p.id}/assign`}>
                <Button size="sm" variant="outline">
                  分配评委
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
