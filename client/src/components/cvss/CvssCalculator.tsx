import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import {
  CVSS31_DEFINITION,
  getDefaultMetrics,
  stringifyVectorCvss31,
  calculateScoreCvss31,
} from "@/utils/cvss/cvss3";
import { getSeverityRating } from "@/utils/cvss/base";
import type { CvssMetricsValue } from "@/utils/cvss/base";

interface CvssCalculatorProps {
  value?: string;
  onChange?: (vector: string, score: number) => void;
}

export default function CvssCalculator({ value, onChange }: CvssCalculatorProps) {
  // Initialize metrics from prop value or defaults
  const [metrics, setMetrics] = useState<CvssMetricsValue>(() => {
    if (value && value.startsWith("CVSS:3.")) {
      return parseVectorCvss3(value);
    }
    return getDefaultMetrics();
  });

  // Sync metrics with external value prop changes using useEffect
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (value && value.startsWith("CVSS:3.")) {
      const parsed = parseVectorCvss3(value);
      // Only update if the parsed value is different
      if (JSON.stringify(parsed) !== JSON.stringify(metrics)) {
        setMetrics(parsed);
      }
    } else if (!value && JSON.stringify(metrics) !== JSON.stringify(getDefaultMetrics())) {
      // Reset to defaults if value is cleared
      setMetrics(getDefaultMetrics());
    }
  }, [value]); // Intentionally omitting metrics from dependencies to avoid loops
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  // Calculate derived values using useMemo to avoid unnecessary recalculations
  const vector = useMemo(() => stringifyVectorCvss31(metrics), [metrics]);
  const score = useMemo(() => calculateScoreCvss31(vector) || 0, [vector]);

  // Track previous values to prevent unnecessary onChange calls
  const prevVectorRef = useRef<string>("");
  const prevScoreRef = useRef<number>(0);

  // Notify parent of changes only when vector/score actually change
  useEffect(() => {
    if (onChange && (vector !== prevVectorRef.current || score !== prevScoreRef.current)) {
      prevVectorRef.current = vector;
      prevScoreRef.current = score;
      onChange(vector, score);
    }
  }, [vector, score, onChange]);

  const updateMetric = (metricId: string, value: string) => {
    setMetrics((prev) => ({
      ...prev,
      [metricId]: value,
    }));
  };

  const severity = getSeverityRating(score);
  const severityColors = {
    red: "bg-red-600 text-white",
    orange: "bg-orange-500 text-white",
    yellow: "bg-yellow-500 text-white",
    blue: "bg-blue-500 text-white",
    gray: "bg-secondary0 text-white",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          CVSS 3.1 Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Display */}
        <div className="bg-secondary p-4 rounded-lg border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">CVSS Score</span>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-foreground">{score.toFixed(1)}</span>
              <Badge
                className={`${
                  severityColors[severity.color as keyof typeof severityColors]
                } px-3 py-1`}
              >
                {severity.label.toUpperCase()}
              </Badge>
            </div>
          </div>
          <div className="text-xs text-muted-foreground font-mono break-all">
            {vector}
          </div>
        </div>

        {/* Metric Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(CVSS31_DEFINITION).map(([metricId, metric]) => (
            <div key={metricId} className="space-y-2">
              <Label htmlFor={`cvss-${metricId}`} className="text-sm font-medium">
                {metric.name}
              </Label>
              <Select
                value={metrics[metricId] || ""}
                onValueChange={(value) => updateMetric(metricId, value)}
              >
                <SelectTrigger id={`cvss-${metricId}`}>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {metric.choices.map((choice) => (
                    <SelectItem key={choice.id} value={choice.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{choice.id}</span>
                        <span className="text-muted-foreground">- {choice.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{metric.description}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function parseVectorCvss3(vector: string): CvssMetricsValue {
  const out: CvssMetricsValue = {};
  
  if (!vector) {
    return out;
  }

  // Remove CVSS:3.x/ prefix
  const vectorParts = vector.slice(9).split("/");
  
  for (const part of vectorParts) {
    const [key, value] = part.split(":");
    if (key && value) {
      out[key] = value;
    }
  }

  return out;
}
