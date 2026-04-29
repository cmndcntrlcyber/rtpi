import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radar, Rss, ShieldAlert, FileSearch, Search } from "lucide-react";

export default function CTI() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-purple-100 p-3 rounded-lg">
          <Radar className="h-8 w-8 text-purple-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cyber Threat Intelligence</h1>
          <p className="text-muted-foreground">
            Vectorized CTI feeds, indicators, reports, and semantic search
          </p>
        </div>
      </div>

      <Tabs defaultValue="feeds" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="feeds" className="flex items-center gap-2">
            <Rss className="h-4 w-4" />
            <span>Feeds</span>
          </TabsTrigger>
          <TabsTrigger value="indicators" className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span>Indicators</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileSearch className="h-4 w-4" />
            <span>Reports</span>
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span>Search</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feeds" className="mt-0">
          <EmptyState
            icon={<Rss className="h-10 w-10 text-muted-foreground" />}
            title="No feeds configured yet"
            description="CTI feed sources (TAXII, RSS, JSON) will appear here. Wired by v2.9.1 Phase 7."
          />
        </TabsContent>

        <TabsContent value="indicators" className="mt-0">
          <EmptyState
            icon={<ShieldAlert className="h-10 w-10 text-muted-foreground" />}
            title="No indicators ingested yet"
            description="Threat indicators from configured feeds will appear here. Wired by v2.9.1 Phase 7."
          />
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <EmptyState
            icon={<FileSearch className="h-10 w-10 text-muted-foreground" />}
            title="No CTI reports yet"
            description="CTI digests and analyst reports will appear here. Wired by v2.9.1 Phase 7."
          />
        </TabsContent>

        <TabsContent value="search" className="mt-0">
          <EmptyState
            icon={<Search className="h-10 w-10 text-muted-foreground" />}
            title="Semantic search not active"
            description="Vector search across CTI items will appear here. Wired by v2.9.1 Phase 7 (HNSW + pgvector)."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-12 flex flex-col items-center justify-center text-center">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
    </div>
  );
}
