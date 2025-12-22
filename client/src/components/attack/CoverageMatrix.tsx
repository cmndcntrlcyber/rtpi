import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, RefreshCw, Target, CheckCircle2, Circle, AlertCircle } from "lucide-react";

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

export default function CoverageMatrix() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<CoverageMapping[]>([]);
  const [stats, setStats] = useState<CoverageStats | null>(null);
  const [loading, setLoading] = useState(false);

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
      console.error("Failed to fetch operations:", error);
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
      console.error("Failed to fetch coverage:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperations();
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
        return <Circle className="h-4 w-4 text-gray-400" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
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

  if (operations.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 font-medium">No operations found</p>
        <p className="text-sm text-gray-400 mt-2">
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
              <CardTitle className="text-3xl text-gray-600">{stats.plannedTechniques}</CardTitle>
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

      {/* Coverage List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading coverage data...</p>
        </div>
      ) : coverage.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No techniques mapped</p>
          <p className="text-sm text-gray-400 mt-2">
            Start mapping ATT&CK techniques to this operation to track coverage
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="divide-y divide-gray-200">
            {coverage.map((mapping) => (
              <div key={mapping.id} className="p-4 hover:bg-gray-50 transition-colors">
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
                      <h4 className="font-medium text-gray-900">{mapping.technique.name}</h4>
                      {mapping.tactic && (
                        <p className="text-sm text-gray-500 mt-1">
                          Tactic: {mapping.tactic.name} ({mapping.tactic.attackId})
                        </p>
                      )}
                      {mapping.notes && (
                        <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                          {mapping.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 ml-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        {mapping.coveragePercentage}%
                      </p>
                      <p className="text-xs text-gray-500">Coverage</p>
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
