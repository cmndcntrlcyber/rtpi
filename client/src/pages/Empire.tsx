import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Crown, Power, PowerOff, RefreshCw, Loader2, Search, ExternalLink, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EmpireTab from "@/components/empire/EmpireTab";
import { api } from "@/lib/api";

// ============================================================================
// Types
// ============================================================================

interface C2Framework {
  id: string;
  name: string;
  description: string;
  source: string;
  containerStatus: "running" | "stopped" | "not_found";
  activated: boolean;
  healthy: boolean;
}

interface ResearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

// ============================================================================
// Component
// ============================================================================

export default function Empire() {
  const [frameworks, setFrameworks] = useState<C2Framework[]>([]);
  const [frameworksLoading, setFrameworksLoading] = useState(true);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  // Research state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFramework, setSearchFramework] = useState("");
  const [searching, setSearching] = useState(false);
  const [researchAnswer, setResearchAnswer] = useState<string | null>(null);
  const [researchResults, setResearchResults] = useState<ResearchResult[]>([]);

  useEffect(() => {
    fetchFrameworks();
  }, []);

  const fetchFrameworks = async () => {
    try {
      setFrameworksLoading(true);
      const res = await api.get<{ frameworks: C2Framework[] }>("/c2-warroom/frameworks");
      setFrameworks(res.frameworks || []);
    } catch {
      // Frameworks endpoint may fail if containers aren't running
      setFrameworks([]);
    } finally {
      setFrameworksLoading(false);
    }
  };

  const handleToggle = async (fw: C2Framework) => {
    const action = fw.activated ? "deactivate" : "activate";
    try {
      setToggling((prev) => new Set(prev).add(fw.id));
      await api.post(`/c2-warroom/${fw.id}/${action}`);
      toast.success(`${fw.name} ${action}d`);
      setTimeout(fetchFrameworks, 2000);
    } catch (error: any) {
      toast.error(`Failed to ${action} ${fw.name}`);
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(fw.id);
        return next;
      });
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      setResearchAnswer(null);
      setResearchResults([]);
      const res = await api.post<{
        answer: string | null;
        results: ResearchResult[];
      }>("/c2-warroom/research", {
        query: searchQuery,
        framework: searchFramework || undefined,
      });
      setResearchAnswer(res.answer || null);
      setResearchResults(res.results || []);
    } catch (error: any) {
      toast.error(error?.message || "Research failed");
    } finally {
      setSearching(false);
    }
  };

  const getStatusBadge = (fw: C2Framework) => {
    if (fw.containerStatus === "not_found") {
      return <Badge variant="outline" className="text-gray-500">Not Deployed</Badge>;
    }
    if (fw.containerStatus === "stopped") {
      return <Badge variant="outline" className="text-red-500">Stopped</Badge>;
    }
    if (fw.activated && fw.healthy) {
      return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    }
    if (fw.activated) {
      return <Badge className="bg-yellow-100 text-yellow-800">Activating</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">Dormant</Badge>;
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Crown className="h-8 w-8 text-purple-600" />
          <div>
            <h1 className="text-3xl font-bold">C2 Warroom</h1>
            <p className="text-muted-foreground mt-1">
              Multi-framework Command and Control orchestration
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="empire" className="space-y-6">
        <TabsList>
          <TabsTrigger value="empire">Empire</TabsTrigger>
          <TabsTrigger value="frameworks">Frameworks</TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
        </TabsList>

        {/* Empire Tab (existing) */}
        <TabsContent value="empire">
          <EmpireTab />
        </TabsContent>

        {/* Frameworks Tab */}
        <TabsContent value="frameworks">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">C2 Frameworks</h2>
            <Button variant="outline" size="sm" onClick={fetchFrameworks} disabled={frameworksLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${frameworksLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {frameworksLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-muted-foreground">Checking framework status...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {frameworks.map((fw) => (
                <Card key={fw.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                          <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{fw.name}</CardTitle>
                          {getStatusBadge(fw)}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mb-4">{fw.description}</CardDescription>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                      <a
                        href={fw.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Source
                      </a>
                    </div>

                    {fw.containerStatus !== "not_found" && (
                      <Button
                        className="w-full"
                        variant={fw.activated ? "destructive" : "default"}
                        onClick={() => handleToggle(fw)}
                        disabled={toggling.has(fw.id) || fw.containerStatus === "stopped"}
                      >
                        {toggling.has(fw.id) ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : fw.activated ? (
                          <PowerOff className="h-4 w-4 mr-2" />
                        ) : (
                          <Power className="h-4 w-4 mr-2" />
                        )}
                        {fw.activated ? "Deactivate" : "Activate"}
                      </Button>
                    )}

                    {fw.containerStatus === "not_found" && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Container not deployed. Run docker compose to build.
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Research Tab */}
        <TabsContent value="research">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">C2 Intelligence Research</h2>
              <p className="text-sm text-muted-foreground">
                Search for C2 techniques, evasion methods, and operational tradecraft via Tavily
              </p>
            </div>

            <div className="flex gap-3">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g., Sliver C2 evasion techniques, DNS tunneling C2..."
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                {searching ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Research
              </Button>
            </div>

            {/* AI Answer */}
            {researchAnswer && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Crown className="h-4 w-4 text-purple-500" />
                    AI Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{researchAnswer}</p>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {researchResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground">
                  Sources ({researchResults.length})
                </h3>
                {researchResults.map((result, i) => (
                  <Card key={i} className="hover:shadow transition-shadow">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sm text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {result.title}
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                            {result.content}
                          </p>
                        </div>
                        {result.score && (
                          <Badge variant="outline" className="ml-2 flex-shrink-0 text-xs">
                            {(result.score * 100).toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!searching && researchResults.length === 0 && !researchAnswer && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Enter a search query to research C2 techniques and tradecraft</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
