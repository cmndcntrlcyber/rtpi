import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Play, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface BenchmarkResult {
  model: string;
  provider: "ollama" | "openai" | "anthropic";
  task: string;
  avgLatency: number;
  tokensPerSecond: number;
  totalTokens: number;
  quality: number;
  costPerMillion?: number;
}

const BENCHMARK_TASKS = [
  { value: "extract_cve_data", label: "CVE Data Extraction" },
  { value: "generate_poc", label: "POC Generation" },
  { value: "generate_remediation", label: "Remediation Generation" },
  { value: "analyze_code", label: "Code Analysis" },
];

const MODELS_TO_TEST = [
  { provider: "ollama", model: "llama3:8b" },
  { provider: "ollama", model: "qwen2.5-coder:7b" },
  { provider: "openai", model: "gpt-3.5-turbo" },
  { provider: "openai", model: "gpt-4-turbo-preview" },
  { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
];

export function PerformanceBenchmarks() {
  const [selectedTask, setSelectedTask] = useState("extract_cve_data");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BenchmarkResult[]>([]);

  const runBenchmark = async () => {
    try {
      setRunning(true);
      setProgress(0);
      setResults([]);

      const totalModels = MODELS_TO_TEST.length;
      const newResults: BenchmarkResult[] = [];

      for (let i = 0; i < MODELS_TO_TEST.length; i++) {
        const { provider, model } = MODELS_TO_TEST[i];

        try {
          const response = await fetch("/api/v1/ollama/benchmark", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider,
              model,
              task: selectedTask,
            }),
          });

          if (!response.ok) {
            console.warn(`Benchmark failed for ${provider}:${model}`);
            continue;
          }

          const result = await response.json();
          newResults.push({
            model,
            provider: provider as any,
            task: selectedTask,
            avgLatency: result.avgLatency || 0,
            tokensPerSecond: result.tokensPerSecond || 0,
            totalTokens: result.totalTokens || 0,
            quality: result.quality || 0,
            costPerMillion: result.costPerMillion,
          });

          setResults([...newResults]);
        } catch (error) {
          console.error(`Error benchmarking ${provider}:${model}:`, error);
        }

        setProgress(((i + 1) / totalModels) * 100);
      }

      toast.success(`Benchmark Complete: Tested ${newResults.length} models`);
    } catch (error: any) {
      toast.error(`Benchmark Failed: ${error.message}`);
    } finally {
      setRunning(false);
      setProgress(0);
    }
  };

  const getLatencyBadge = (latency: number) => {
    if (latency < 1000) {
      return (
        <Badge variant="default" className="bg-green-500">
          <TrendingUp className="h-3 w-3 mr-1" />
          Fast
        </Badge>
      );
    } else if (latency < 3000) {
      return (
        <Badge variant="default" className="bg-yellow-500">
          <Minus className="h-3 w-3 mr-1" />
          Medium
        </Badge>
      );
    } else {
      return (
        <Badge variant="default" className="bg-red-500">
          <TrendingDown className="h-3 w-3 mr-1" />
          Slow
        </Badge>
      );
    }
  };

  const getQualityBadge = (quality: number) => {
    if (quality >= 0.9) {
      return <Badge variant="default">Excellent</Badge>;
    } else if (quality >= 0.7) {
      return <Badge variant="secondary">Good</Badge>;
    } else if (quality >= 0.5) {
      return <Badge variant="outline">Fair</Badge>;
    } else {
      return <Badge variant="destructive">Poor</Badge>;
    }
  };

  const formatLatency = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatCost = (cost?: number) => {
    if (!cost) return "Free";
    return `$${cost.toFixed(2)}/M`;
  };

  const sortedResults = [...results].sort((a, b) => {
    // Sort by quality first, then by latency
    if (Math.abs(a.quality - b.quality) > 0.1) {
      return b.quality - a.quality;
    }
    return a.avgLatency - b.avgLatency;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-4">
        <div className="flex-1 space-y-2">
          <Label htmlFor="task">Benchmark Task</Label>
          <Select value={selectedTask} onValueChange={setSelectedTask} disabled={running}>
            <SelectTrigger id="task">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BENCHMARK_TASKS.map((task) => (
                <SelectItem key={task.value} value={task.value}>
                  {task.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={runBenchmark} disabled={running}>
          {running ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Benchmark
            </>
          )}
        </Button>
      </div>

      {running && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Testing models...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Results</h3>
            <Badge variant="outline">{results.length} models tested</Badge>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Speed</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedResults.map((result, idx) => (
                  <TableRow key={`${result.provider}-${result.model}`}>
                    <TableCell className="font-medium">{result.model}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {result.provider}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatLatency(result.avgLatency)}</TableCell>
                    <TableCell>
                      {result.tokensPerSecond > 0
                        ? `${result.tokensPerSecond.toFixed(1)} tok/s`
                        : "N/A"}
                    </TableCell>
                    <TableCell>{getQualityBadge(result.quality)}</TableCell>
                    <TableCell>{result.totalTokens}</TableCell>
                    <TableCell>{formatCost(result.costPerMillion)}</TableCell>
                    <TableCell>{getLatencyBadge(result.avgLatency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground mb-1">Fastest Model</div>
              <div className="text-lg font-bold">
                {sortedResults.reduce((prev, curr) =>
                  curr.avgLatency < prev.avgLatency ? curr : prev
                ).model}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatLatency(
                  sortedResults.reduce((prev, curr) =>
                    curr.avgLatency < prev.avgLatency ? curr : prev
                  ).avgLatency
                )}
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground mb-1">Highest Quality</div>
              <div className="text-lg font-bold">
                {sortedResults.reduce((prev, curr) =>
                  curr.quality > prev.quality ? curr : prev
                ).model}
              </div>
              <div className="text-sm text-muted-foreground">
                {(sortedResults.reduce((prev, curr) =>
                  curr.quality > prev.quality ? curr : prev
                ).quality * 100).toFixed(0)}% quality
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground mb-1">Best Value</div>
              <div className="text-lg font-bold">
                {sortedResults.filter((r) => !r.costPerMillion)[0]?.model || "N/A"}
              </div>
              <div className="text-sm text-muted-foreground">
                Free (Local)
              </div>
            </div>
          </div>
        </div>
      )}

      {!running && results.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No benchmark results yet</p>
          <p className="text-sm">Select a task and click "Run Benchmark" to get started</p>
        </div>
      )}
    </div>
  );
}
