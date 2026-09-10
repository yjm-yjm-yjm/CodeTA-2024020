import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md";
}

const VARIANTS: Record<string, string> = {
  default: "bg-indigo-600 text-white hover:bg-indigo-700",
  outline: "border border-slate-300 bg-white hover:bg-slate-50 text-slate-700",
  ghost: "hover:bg-slate-100 text-slate-600",
  destructive: "bg-red-600 text-white hover:bg-red-700",
};

const SIZES: Record<string, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export const Button: React.FC<ButtonProps> = ({
  variant = "default",
  size = "md",
  className = "",
  ...props
}) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    {...props}
  />
);
