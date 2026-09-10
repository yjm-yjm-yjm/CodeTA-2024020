import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@/types";

const TONE: Record<ProjectStatus, "slate" | "blue" | "amber" | "green"> = {
  draft: "slate",
  submitted: "blue",
  reviewing: "amber",
  reviewed: "green",
};

const LABEL: Record<ProjectStatus, string> = {
  draft: "草稿",
  submitted: "已提交",
  reviewing: "评审中",
  reviewed: "已评审",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>;
}
