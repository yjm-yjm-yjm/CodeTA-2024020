import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { ProgressItem } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";

export default function AdminDashboard() {
  const [items, setItems] = useState<ProgressItem[]>([]);

  useEffect(() => {
    (async () => {
      setItems(await api<ProgressItem[]>("/admin/progress"));
    })();
  }, []);

  const total = items.length;
  const reviewed = items.filter(
    (i) => i.assigned > 0 && i.reviewed >= i.assigned
  ).length;
  const reviewing = items.filter(
    (i) => i.assigned > 0 && i.reviewed < i.assigned
  ).length;
  const pending = items.filter((i) => i.assigned === 0).length;

  const stats = [
    { label: "全部立项", value: total },
    { label: "待分配", value: pending },
    { label: "评审中", value: reviewing },
    { label: "已完成", value: reviewed },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">评审看板</h1>
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="text-center pt-6">
              <div className="text-3xl font-bold text-indigo-600">{s.value}</div>
              <div className="mt-1 text-sm text-slate-500">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>各立项评审进度</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="pb-2">项目</th>
                <th className="pb-2">状态</th>
                <th className="pb-2">分配/已评</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.project.id} className="border-b border-slate-50">
                  <td className="py-3 font-medium text-slate-800">{i.project.title}</td>
                  <td className="py-3">
                    <StatusBadge status={i.project.status} />
                  </td>
                  <td className="py-3 text-slate-600">
                    {i.reviewed} / {i.assigned}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
