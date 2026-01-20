import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlaskConical, Activity, PlayCircle, XCircle } from "lucide-react";
import { api } from "@/lib/api";

interface Experiment {
  id: string;
  name: string;
  projectName: string | null;
  status: string;
  hypothesis: string | null;
  methodology: string | null;
  createdAt: string;
}

export default function ExperimentsTab() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExperiments();
  }, []);

  const fetchExperiments = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ experiments: Experiment[] }>("/offsec-rd/experiments");
      setExperiments(response.experiments);
    } catch (error: any) {
      toast.error("Failed to load experiments");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "running":
        return "bg-blue-100 text-blue-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-muted-foreground">Loading experiments...</p>
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
              Total Experiments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{experiments.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Running
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {experiments.filter(e => e.status === "running").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {experiments.filter(e => e.status === "completed").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {experiments.filter(e => e.status === "failed").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Experiments List */}
      <div className="space-y-4">
        {experiments.map((experiment) => (
          <Card key={experiment.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="bg-teal-100 p-3 rounded-lg">
                    <FlaskConical className="h-6 w-6 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-foreground">{experiment.name}</h3>
                      <Badge className={getStatusColor(experiment.status)}>
                        {experiment.status}
                      </Badge>
                    </div>
                    {experiment.projectName && (
                      <p className="text-sm text-muted-foreground mb-2">
                        Project: {experiment.projectName}
                      </p>
                    )}
                    {experiment.hypothesis && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Hypothesis:</span> {experiment.hypothesis}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {experiment.status === "planned" && (
                    <Button size="sm" variant="outline">
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Execute
                    </Button>
                  )}
                  {experiment.status === "running" && (
                    <Button size="sm" variant="outline">
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {experiments.length === 0 && (
        <div className="text-center py-12">
          <FlaskConical className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No experiments yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Create a research project first, then add experiments to it
          </p>
        </div>
      )}
    </div>
  );
}
