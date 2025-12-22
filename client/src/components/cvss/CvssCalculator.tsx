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
  const initialMetrics = useMemo(() => {
    if (value && value.startsWith("CVSS:3.")) {
      return parseVectorCvss3(value);
    }
    return getDefaultMetrics();
  }, [value]);

  const [metrics, setMetrics] = useState<CvssMetricsValue>(initialMetrics);

  // Track previous value to avoid unnecessary updates
  const prevValueRef = useRef<string | undefined>(value);

  // Sync metrics with external value prop changes
  // This is a legitimate use of setState in useEffect for prop synchronization
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    // Only update if value actually changed to prevent cascading renders
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      if (value && value.startsWith("CVSS:3.")) {
        const parsed = parseVectorCvss3(value);
        setMetrics(parsed);
      } else if (!value) {
        // Reset to defaults if value is cleared
        setMetrics(getDefaultMetrics());
      }
    }
  }, [value]);

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
    gray: "bg-gray-500 text-white",
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
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">CVSS Score</span>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-gray-900">{score.toFixed(1)}</span>
              <Badge
                className={`${
                  severityColors[severity.color as keyof typeof severityColors]
                } px-3 py-1`}
              >
                {severity.label.toUpperCase()}
              </Badge>
            </div>
          </div>
          <div className="text-xs text-gray-600 font-mono break-all">
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
                        <span className="text-gray-600">- {choice.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">{metric.description}</p>
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
