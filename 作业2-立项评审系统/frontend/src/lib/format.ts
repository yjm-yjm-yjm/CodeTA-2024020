export function formatScore(n: number): string {
  return n.toFixed(1);
}

export function formatDate(s?: string): string {
  if (!s) return "-";
  const d = new Date(s);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
