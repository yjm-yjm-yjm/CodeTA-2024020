import React from "react";

export const Card: React.FC<{ className?: string; children?: React.ReactNode }> = ({
  className = "",
  children,
}) => (
  <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
    {children}
  </div>
);

export const CardHeader: React.FC<{ className?: string; children?: React.ReactNode }> = ({
  className = "",
  children,
}) => <div className={`border-b border-slate-100 px-5 py-4 ${className}`}>{children}</div>;

export const CardTitle: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <h3 className="text-base font-semibold text-slate-800">{children}</h3>
);

export const CardContent: React.FC<{ className?: string; children?: React.ReactNode }> = ({
  className = "",
  children,
}) => <div className={`p-5 ${className}`}>{children}</div>;
