import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatScore } from "@/lib/format";
import type { Conclusion, ReviewResult } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";

const CONCLUSION_TONE: Record<Conclusion, "green" | "red" | "amber"> = {
  pass: "green",
  fail: "red",
  revise: "amber",
};

const CONCLUSION_LABEL: Record<Conclusion, string> = {
  pass: "通过",
  fail: "不通过",
  revise: "需修改",
};

export default function StudentResult() {
  const { id } = useParams();
  const [result, setResult] = useState<ReviewResult | null>(null);

  useEffect(() => {
    (async () => {
      setResult(await api<ReviewResult>(`/student/projects/${id}/result`));
    })();
  }, [id]);

  if (!result) return <div className="p-8 text-center text-slate-400">加载中...</div>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">评审结果</h1>
        <Link to="/student/projects">
          <Button variant="outline" size="sm">
            返回列表
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>综合评分</CardTitle>
          <StatusBadge status={result.status} />
        </CardHeader>
        <CardContent className="text-center">
          <div className="text-5xl font-bold text-indigo-600">
            {result.reviews.length > 0 ? formatScore(result.avg_score) : "-"}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            共 {result.reviews.length} 位评委评审
          </p>
          <p className="mt-1 text-xs text-slate-400">
            评分 = 创新×40% + 技术×30% + 产品价值×30%
          </p>
        </CardContent>
      </Card>

      {result.reviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            尚未收到评审意见
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {result.reviews.map((r, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">评委 {i + 1}</span>
                    <Badge tone={CONCLUSION_TONE[r.conclusion]}>{CONCLUSION_LABEL[r.conclusion]}</Badge>
                  </div>
                  <span className="text-sm font-semibold text-indigo-600">
                    总分 {formatScore(r.score)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-slate-500">创新 {r.innovation}/10</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-slate-500">技术 {r.technology}/10</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-slate-500">价值 {r.value}/10</div>
                  </div>
                </div>
                <p className="text-sm text-slate-600">{r.comment}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
