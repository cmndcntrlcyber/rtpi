import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "rounded-md bg-muted",
        "bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:400%_100%]",
        "animate-shimmer motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
