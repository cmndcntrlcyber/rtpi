import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, RefreshCw, Target, CheckCircle2, Circle, AlertCircle, LayoutGrid, List } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Operation {
  id: string;
  name: string;
  status: string;
}

interface CoverageMapping {
  id: string;
  operationId: string;
  techniqueId: string;
  tacticId: string | null;
  status: string;
  coveragePercentage: number;
  notes: string | null;
  technique: {
    attackId: string;
    name: string;
    isSubtechnique: boolean;
  };
  tactic: {
    attackId: string;
    name: string;
  } | null;
}

interface CoverageStats {
  totalTechniques: number;
  mappedTechniques: number;
  plannedTechniques: number;
  inProgressTechniques: number;
  completedTechniques: number;
  coveragePercentage: number;
}

interface Tactic {
  id: string;
  attackId: string;
  name: string;
  shortName: string;
}

interface TechniqueForMatrix {
  id: string;
  attackId: string;
  name: string;
  tactics: string[];
}

export default function CoverageMatrix() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<CoverageMapping[]>([]);
  const [stats, setStats] = useState<CoverageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "heatmap">("list");
  const [tactics, setTactics] = useState<Tactic[]>([]);
  const [allTechniques, setAllTechniques] = useState<TechniqueForMatrix[]>([]);

  const fetchOperations = async () => {
    try {
      const response = await fetch("/api/v1/operations", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setOperations(data);
        if (data.length > 0 && !selectedOperationId) {
          setSelectedOperationId(data[0].id);
        }
      }
    } catch (error) {
      // Error already shown via toast
    }
  };

  const fetchCoverage = async (operationId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/attack/operations/${operationId}/coverage`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setCoverage(data);

        // Calculate statistics
        const totalTechniques = data.length;
        const planned = data.filter((m: CoverageMapping) => m.status === "planned").length;
        const inProgress = data.filter((m: CoverageMapping) => m.status === "in_progress").length;
        const completed = data.filter((m: CoverageMapping) => m.status === "completed").length;
        const avgCoverage = totalTechniques > 0
          ? Math.round(data.reduce((sum: number, m: CoverageMapping) => sum + m.coveragePercentage, 0) / totalTechniques)
          : 0;

        setStats({
          totalTechniques,
          mappedTechniques: totalTechniques,
          plannedTechniques: planned,
          inProgressTechniques: inProgress,
          completedTechniques: completed,
          coveragePercentage: avgCoverage,
        });
      } else {
        console.error("Failed to fetch coverage data");
      }
    } catch (error) {
      // Error already shown via toast
    } finally {
      setLoading(false);
    }
  };

  const fetchTactics = async () => {
    try {
      const response = await fetch("/api/v1/attack/tactics", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setTactics(data);
      }
    } catch (error) {
      // Error already shown via toast
    }
  };

  const fetchAllTechniques = async () => {
    try {
      const response = await fetch("/api/v1/attack/techniques?subtechniques=exclude", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setAllTechniques(data.map((t: any) => ({
          id: t.id,
          attackId: t.attackId,
          name: t.name,
          tactics: t.killChainPhases || [],
        })));
      }
    } catch (error) {
      // Error already shown via toast
    }
  };

  useEffect(() => {
    fetchOperations();
    fetchTactics();
    fetchAllTechniques();
  }, []);

  useEffect(() => {
    if (selectedOperationId) {
      fetchCoverage(selectedOperationId);
    }
  }, [selectedOperationId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "in_progress":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case "planned":
        return <Circle className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-600">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-yellow-600">In Progress</Badge>;
      case "planned":
        return <Badge variant="outline">Planned</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getCoverageColor = (mapping: CoverageMapping | undefined) => {
    if (!mapping) return "bg-secondary border-border";

    switch (mapping.status) {
      case "completed":
        return "bg-green-100 border-green-300 hover:bg-green-200";
      case "in_progress":
        return "bg-yellow-100 border-yellow-300 hover:bg-yellow-200";
      case "planned":
        return "bg-blue-100 border-blue-300 hover:bg-blue-200";
      default:
        return "bg-secondary border-border hover:bg-muted";
    }
  };

  const renderHeatmapView = () => {
    if (tactics.length === 0 || allTechniques.length === 0) {
      return (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <LayoutGrid className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading matrix data...</p>
        </div>
      );
    }

    // Group techniques by tactic
    const techniquesByTactic: Record<string, TechniqueForMatrix[]> = {};
    tactics.forEach((tactic) => {
      techniquesByTactic[tactic.attackId] = allTechniques.filter((t) =>
        t.tactics.includes(tactic.shortName.toLowerCase().replace(/\s+/g, "-"))
      );
    });

    return (
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Header row with tactics */}
            <div className="flex border-b border-border bg-secondary">
              <div className="w-48 p-3 font-semibold text-sm border-r border-border">
                Technique
              </div>
              {tactics.map((tactic) => (
                <div
                  key={tactic.id}
                  className="w-32 p-3 text-center border-r border-border last:border-r-0"
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="font-semibold text-xs truncate">
                          {tactic.shortName}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {tactic.attackId}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{tactic.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ))}
            </div>

            {/* Technique rows */}
            <div className="divide-y divide-gray-200">
              {allTechniques.slice(0, 50).map((technique) => {
                const techniqueCoverage = coverage.filter(
                  (c) => c.technique.attackId === technique.attackId
                );

                return (
                  <div key={technique.id} className="flex hover:bg-secondary">
                    <div className="w-48 p-2 border-r border-border flex items-center">
                      <div className="truncate">
                        <div className="font-mono text-xs text-muted-foreground">
                          {technique.attackId}
                        </div>
                        <div className="text-sm font-medium truncate" title={technique.name}>
                          {technique.name}
                        </div>
                      </div>
                    </div>

                    {tactics.map((tactic) => {
                      const tacticShortName = tactic.shortName.toLowerCase().replace(/\s+/g, "-");
                      const hasTactic = technique.tactics.includes(tacticShortName);
                      const mapping = techniqueCoverage.find(
                        (c) => c.tactic?.attackId === tactic.attackId
                      );

                      return (
                        <div
                          key={tactic.id}
                          className={`w-32 p-2 border-r border-border last:border-r-0 ${
                            hasTactic ? "" : "bg-secondary"
                          }`}
                        >
                          {hasTactic && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`h-12 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${getCoverageColor(
                                      mapping
                                    )}`}
                                  >
                                    {mapping ? (
                                      <div className="text-center">
                                        <div className="text-lg font-bold">
                                          {mapping.coveragePercentage}%
                                        </div>
                                        <div className="text-xs">
                                          {mapping.status === "completed" && "✓"}
                                          {mapping.status === "in_progress" && "⋯"}
                                          {mapping.status === "planned" && "○"}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-2xl text-muted-foreground">•</div>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-sm">
                                    <p className="font-semibold">{technique.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {technique.attackId} → {tactic.attackId}
                                    </p>
                                    {mapping ? (
                                      <>
                                        <p className="mt-1">
                                          Status: <span className="font-semibold">{mapping.status}</span>
                                        </p>
                                        <p>
                                          Coverage: <span className="font-semibold">{mapping.coveragePercentage}%</span>
                                        </p>
                                        {mapping.notes && (
                                          <p className="mt-1 text-xs italic">{mapping.notes}</p>
                                        )}
                                      </>
                                    ) : (
                                      <p className="mt-1 text-muted-foreground">Not mapped</p>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {allTechniques.length > 50 && (
          <div className="p-4 bg-secondary border-t border-border text-center text-sm text-muted-foreground">
            Showing first 50 techniques. Total: {allTechniques.length}
          </div>
        )}
      </div>
    );
  };

  if (operations.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-border">
        <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">No operations found</p>
        <p className="text-sm text-muted-foreground mt-2">
          Create an operation first to track ATT&CK technique coverage
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Operation Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold">Technique Coverage Matrix</h3>
            <p className="text-sm text-muted-foreground">
              Track ATT&CK technique coverage for operations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={viewMode === "list" ? "default" : "outline"}
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4 mr-2" />
              List
            </Button>
            <Button
              size="sm"
              variant={viewMode === "heatmap" ? "default" : "outline"}
              onClick={() => setViewMode("heatmap")}
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Heatmap
            </Button>
          </div>

          <Select value={selectedOperationId || ""} onValueChange={setSelectedOperationId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select operation" />
            </SelectTrigger>
            <SelectContent>
              {operations.map((op) => (
                <SelectItem key={op.id} value={op.id}>
                  {op.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="outline"
            onClick={() => selectedOperationId && fetchCoverage(selectedOperationId)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Mapped</CardDescription>
              <CardTitle className="text-3xl">{stats.mappedTechniques}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Techniques tracked</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Planned</CardDescription>
              <CardTitle className="text-3xl text-muted-foreground">{stats.plannedTechniques}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Not yet started</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{stats.inProgressTechniques}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Currently executing</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats.completedTechniques}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Successfully executed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Avg Coverage</CardDescription>
              <CardTitle className="text-3xl">{stats.coveragePercentage}%</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Overall progress</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Coverage View */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading coverage data...</p>
        </div>
      ) : viewMode === "heatmap" ? (
        renderHeatmapView()
      ) : coverage.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">No techniques mapped</p>
          <p className="text-sm text-muted-foreground mt-2">
            Start mapping ATT&CK techniques to this operation to track coverage
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border">
          <div className="divide-y divide-gray-200">
            {coverage.map((mapping) => (
              <div key={mapping.id} className="p-4 hover:bg-secondary transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(mapping.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="font-mono text-xs">
                          {mapping.technique.attackId}
                        </Badge>
                        {mapping.technique.isSubtechnique && (
                          <Badge variant="secondary" className="text-xs">
                            Sub-technique
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-medium text-foreground">{mapping.technique.name}</h4>
                      {mapping.tactic && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Tactic: {mapping.tactic.name} ({mapping.tactic.attackId})
                        </p>
                      )}
                      {mapping.notes && (
                        <p className="text-sm text-muted-foreground mt-2 bg-secondary p-2 rounded">
                          {mapping.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 ml-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">
                        {mapping.coveragePercentage}%
                      </p>
                      <p className="text-xs text-muted-foreground">Coverage</p>
                    </div>
                    {getStatusBadge(mapping.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
