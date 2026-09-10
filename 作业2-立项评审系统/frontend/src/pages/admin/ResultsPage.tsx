import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatScore } from "@/lib/format";
import type { ResultItem } from "@/types";

export default function AdminResults() {
  const [items, setItems] = useState<ResultItem[]>([]);

  useEffect(() => {
    (async () => {
      setItems(await api<ResultItem[]>("/admin/results"));
    })();
  }, []);

  const sorted = [...items].sort((a, b) => b.avg_score - a.avg_score);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">评审结果</h1>
      <Card>
        <CardHeader>
          <CardTitle>排名（按平均分降序）</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="pb-2">排名</th>
                <th className="pb-2">项目</th>
                <th className="pb-2">申请人</th>
                <th className="pb-2">评委数</th>
                <th className="pb-2">平均分</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, idx) => (
                <tr key={item.project.id} className="border-b border-slate-50">
                  <td className="py-3">
                    {idx < 3 ? (
                      <Badge tone={idx === 0 ? "red" : idx === 1 ? "amber" : "blue"}>
                        {idx + 1}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">{idx + 1}</span>
                    )}
                  </td>
                  <td className="py-3 font-medium text-slate-800">{item.project.title}</td>
                  <td className="py-3 text-slate-600">{item.project.student?.email || "-"}</td>
                  <td className="py-3 text-slate-600">{item.count}</td>
                  <td className="py-3 font-semibold text-indigo-600">
                    {item.count > 0 ? formatScore(item.avg_score) : "-"}
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
