import React from "react";

type Tone = "slate" | "green" | "blue" | "amber" | "red" | "indigo";

const TONES: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700",
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  indigo: "bg-indigo-100 text-indigo-700",
};

export const Badge: React.FC<{ tone?: Tone; children?: React.ReactNode }> = ({
  tone = "slate",
  children,
}) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
    {children}
  </span>
);
