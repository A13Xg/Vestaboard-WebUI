"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: "sm" | "md" | "lg" | "full";
}

export function Skeleton({ className, rounded = "md", ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-neutral-800",
        {
          "rounded-sm": rounded === "sm",
          "rounded-md": rounded === "md",
          "rounded-lg": rounded === "lg",
          "rounded-full": rounded === "full",
        },
        className
      )}
      {...props}
    />
  );
}
