import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Shield, Clipboard } from "lucide-react";
import { toast } from "sonner";
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
  const [pasteInput, setPasteInput] = useState("");

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

  // Handle pasting CVSS vector strings
  const handlePasteVector = (vectorString: string) => {
    const trimmed = vectorString.trim();

    // Validate CVSS 3.x format
    if (!trimmed.startsWith("CVSS:3.")) {
      toast.error("Invalid CVSS vector. Must start with 'CVSS:3.0/' or 'CVSS:3.1/'");
      return;
    }

    try {
      const parsed = parseVectorCvss3(trimmed);

      // Validate that we got some metrics
      if (Object.keys(parsed).length === 0) {
        toast.error("Could not parse CVSS vector. Please check the format.");
        return;
      }

      // Merge with defaults to ensure all metrics have values
      setMetrics({ ...getDefaultMetrics(), ...parsed });
      setPasteInput(trimmed);
      toast.success("CVSS vector loaded successfully!");
    } catch (error) {
      toast.error("Error parsing CVSS vector. Please check the format.");
    }
  };

  // Handle paste event on the input field
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    handlePasteVector(pastedText);
  };

  // Handle manual input (when user types or pastes)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPasteInput(value);

    // Auto-parse if it looks like a complete vector
    if (value.startsWith("CVSS:3.") && value.includes("/")) {
      handlePasteVector(value);
    }
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
        {/* Paste CVSS Vector Input */}
        <div className="space-y-2">
          <Label htmlFor="cvss-paste" className="flex items-center gap-2 text-sm font-medium">
            <Clipboard className="h-4 w-4" />
            Paste CVSS Vector
          </Label>
          <Input
            id="cvss-paste"
            type="text"
            placeholder="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
            value={pasteInput}
            onChange={handleInputChange}
            onPaste={handlePaste}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Paste a CVSS 3.0 or 3.1 vector string to auto-populate all metrics
          </p>
        </div>

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
