import React from "react";

export const Label: React.FC<{ htmlFor?: string; children?: React.ReactNode }> = ({
  htmlFor,
  children,
}) => (
  <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">
    {children}
  </label>
);
