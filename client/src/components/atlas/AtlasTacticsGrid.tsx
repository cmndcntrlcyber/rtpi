import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, ExternalLink, RefreshCw } from "lucide-react";

interface AtlasTactic {
  id: string;
  atlasId: string;
  name: string;
  description: string;
  shortName: string;
  sortOrder: number;
}

export default function AtlasTacticsGrid() {
  const [tactics, setTactics] = useState<AtlasTactic[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTactics = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/atlas/tactics", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setTactics(data);
      }
    } catch (error) {
      console.error("Failed to fetch ATLAS tactics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTactics();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading ATLAS tactics...</p>
      </div>
    );
  }

  if (tactics.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-border">
        <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">No ATLAS tactics loaded</p>
        <p className="text-sm text-muted-foreground mt-2">
          Import ATLAS STIX data to populate tactics
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">ATLAS Tactics</h3>
          <p className="text-sm text-muted-foreground">
            Showing {tactics.length} AI/ML attack tactics
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchTactics}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tactics.map((tactic) => (
          <Card key={tactic.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <Badge variant="outline" className="font-mono">
                    {tactic.atlasId}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() =>
                    window.open(
                      `https://atlas.mitre.org/tactics/${tactic.atlasId}`,
                      "_blank"
                    )
                  }
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
              <CardTitle className="text-lg">{tactic.name}</CardTitle>
              {tactic.shortName && (
                <CardDescription className="text-xs">
                  {tactic.shortName}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-4">
                {tactic.description || "No description available"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
