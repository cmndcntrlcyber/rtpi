import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusDotVariants = cva("inline-block rounded-full shrink-0", {
  variants: {
    tone: {
      success: "bg-success",
      warning: "bg-warning",
      error: "bg-destructive",
      info: "bg-info",
      neutral: "bg-muted-foreground",
    },
    size: {
      sm: "h-1.5 w-1.5",
      md: "h-2 w-2",
      lg: "h-2.5 w-2.5",
    },
    pulse: {
      true: "animate-pulse motion-reduce:animate-none",
      false: "",
    },
  },
  defaultVariants: {
    tone: "neutral",
    size: "md",
    pulse: false,
  },
});

export interface StatusDotProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof statusDotVariants> {
  /** Required text alternative — color alone must never carry meaning. */
  label: string;
}

function StatusDot({
  tone,
  size,
  pulse,
  label,
  className,
  ...props
}: StatusDotProps) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(statusDotVariants({ tone, size, pulse }), className)}
      {...props}
    />
  );
}

export { StatusDot, statusDotVariants };
