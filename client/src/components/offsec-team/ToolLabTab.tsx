import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, Activity, PlayCircle } from "lucide-react";
import { api } from "@/lib/api";

interface Tool {
  id: string;
  toolName: string | null;
  toolCategory: string | null;
  toolDescription: string | null;
  researchValue: string | null;
  testingStatus: string | null;
  executionCount: number | null;
  successRate: number | null;
}

export default function ToolLabTab() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ tools: Tool[] }>("/offsec-rd/tools");
      setTools(response.tools);
    } catch (error: any) {
      toast.error("Failed to load tools");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "validated":
        return "bg-green-100 text-green-800";
      case "testing":
        return "bg-blue-100 text-blue-800";
      case "deprecated":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getValueColor = (value: string | null) => {
    switch (value) {
      case "critical":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-muted-foreground">Loading tool library...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{tools.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Validated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {tools.filter(t => t.testingStatus === "validated").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Testing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {tools.filter(t => t.testingStatus === "testing").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Untested
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {tools.filter(t => t.testingStatus === "untested").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <Card key={tool.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="bg-orange-100 p-3 rounded-lg">
                    <Wrench className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      {tool.toolName || "Unknown Tool"}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground capitalize mt-1">
                      {tool.toolCategory || "Uncategorized"}
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Badge className={getStatusColor(tool.testingStatus)}>
                    {tool.testingStatus || "untested"}
                  </Badge>
                  <Badge className={getValueColor(tool.researchValue)}>
                    {tool.researchValue || "medium"} value
                  </Badge>
                </div>

                {tool.toolDescription && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {tool.toolDescription}
                  </p>
                )}

                <div className="pt-3 border-t border-border">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Executions</p>
                      <p className="font-semibold text-foreground">
                        {tool.executionCount || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Success Rate</p>
                      <p className="font-semibold text-foreground">
                        {tool.successRate ? `${Math.round(tool.successRate * 100)}%` : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                <Button size="sm" variant="outline" className="w-full">
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Test Tool
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tools.length === 0 && (
        <div className="text-center py-12">
          <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No tools in R&D library yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Register security tools from the Tools page to add them here
          </p>
        </div>
      )}
    </div>
  );
}
