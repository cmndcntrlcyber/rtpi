import * as React from "react";
import { AlertOctagon, AlertTriangle, AlertCircle, Info, Minus } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

const severityBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium border",
  {
    variants: {
      severity: {
        critical: "bg-severity-critical/10 text-severity-critical border-severity-critical/30",
        high: "bg-severity-high/10 text-severity-high border-severity-high/30",
        medium: "bg-severity-medium/10 text-severity-medium border-severity-medium/30",
        low: "bg-severity-low/10 text-severity-low border-severity-low/30",
        info: "bg-severity-info/10 text-severity-info border-severity-info/30",
      },
    },
    defaultVariants: {
      severity: "info",
    },
  },
);

const SEVERITY_ICONS: Record<Severity, typeof AlertOctagon> = {
  critical: AlertOctagon,
  high: AlertTriangle,
  medium: AlertCircle,
  low: Info,
  info: Minus,
};

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export interface SeverityBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof severityBadgeVariants> {
  /** Override the visible label (defaults to the capitalized severity). */
  label?: string;
  /** Hide the icon (label remains; useful in dense tables). */
  iconOnly?: boolean;
}

function SeverityBadge({
  severity = "info",
  label,
  iconOnly,
  className,
  ...props
}: SeverityBadgeProps) {
  const sev: Severity = severity ?? "info";
  const Icon = SEVERITY_ICONS[sev];
  const text = label ?? SEVERITY_LABELS[sev];

  return (
    <span
      className={cn(severityBadgeVariants({ severity: sev }), className)}
      {...props}
    >
      <Icon aria-hidden="true" className="h-3 w-3" strokeWidth={2.25} />
      {iconOnly ? <span className="sr-only">{text}</span> : text}
    </span>
  );
}

export { SeverityBadge, severityBadgeVariants };
