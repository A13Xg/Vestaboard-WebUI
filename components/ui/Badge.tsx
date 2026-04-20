"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium leading-none",
  {
    variants: {
      variant: {
        default: "bg-neutral-800 text-neutral-400 border border-neutral-700",
        success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
        error: "bg-red-500/10 text-red-400 border border-red-500/20",
        warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
        info: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
        indigo: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", {
            "bg-neutral-400": variant === "default" || !variant,
            "bg-emerald-400": variant === "success",
            "bg-red-400": variant === "error",
            "bg-amber-400": variant === "warning",
            "bg-blue-400": variant === "info",
            "bg-indigo-400": variant === "indigo",
          })}
        />
      )}
      {children}
    </span>
  );
}
