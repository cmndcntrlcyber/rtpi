import { useState } from "react";
import { toast } from "sonner";
import { Crown, Loader2, Search, ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import EmpireTab from "@/components/empire/EmpireTab";
import C2FrameworksPanel from "@/components/c2/C2FrameworksPanel";
import { api } from "@/lib/api";

// ============================================================================
// Types
// ============================================================================

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
  // Research state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFramework, setSearchFramework] = useState("");
  const [searching, setSearching] = useState(false);
  const [researchAnswer, setResearchAnswer] = useState<string | null>(null);
  const [researchResults, setResearchResults] = useState<ResearchResult[]>([]);

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

  return (
    <div className="p-8">
      <PageHeader
        icon={Crown}
        title="C2 Warroom"
        description="Multi-framework Command and Control orchestration"
      />

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

        {/* Frameworks Tab — shared with the Infrastructure page */}
        <TabsContent value="frameworks">
          <C2FrameworksPanel />
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
                  <Loader2 aria-hidden="true" className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search aria-hidden="true" className="h-4 w-4 mr-2" />
                )}
                Research
              </Button>
            </div>

            {/* AI Answer */}
            {researchAnswer && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Crown aria-hidden="true" className="h-4 w-4 text-info" />
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
                  <Card key={i} className="hover:shadow-sm transition-shadow">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sm text-info hover:underline flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                          >
                            {result.title}
                            <ExternalLink aria-hidden="true" className="h-3 w-3 flex-shrink-0" />
                          </a>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                            {result.content}
                          </p>
                        </div>
                        {result.score && (
                          <Badge variant="outline" className="ml-2 flex-shrink-0 text-xs tabular-nums">
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
              <EmptyState
                icon={Search}
                title="Search for C2 intelligence"
                description="Enter a search query to research C2 techniques and tradecraft."
                className="border-0 bg-transparent"
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
