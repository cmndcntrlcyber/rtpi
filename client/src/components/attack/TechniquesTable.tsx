import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Technique {
  id: string;
  attackId: string;
  name: string;
  description: string;
  isSubtechnique: boolean;
  platforms: string[] | null;
  deprecated: boolean;
  revoked: boolean;
  killChainPhases: string[] | null;
  dataSources: string[] | null;
}

export default function TechniquesTable() {
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [filteredTechniques, setFilteredTechniques] = useState<Technique[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "techniques" | "subtechniques">("techniques");
  const { toast } = useToast();

  const fetchTechniques = async () => {
    setLoading(true);
    try {
      const subtechniquesParam = filter === "techniques" ? "exclude" : filter === "subtechniques" ? "only" : "";
      const url = `/api/v1/attack/techniques${subtechniquesParam ? `?subtechniques=${subtechniquesParam}` : ""}`;

      const response = await fetch(url, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setTechniques(data);
        setFilteredTechniques(data);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch techniques",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to fetch techniques:", error);
      toast({
        title: "Error",
        description: "Failed to fetch techniques",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTechniques();
  }, [filter]);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredTechniques(techniques);
      return;
    }

    const filtered = techniques.filter(
      (t) =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.attackId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredTechniques(filtered);
  }, [searchTerm, techniques]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading techniques...</p>
      </div>
    );
  }

  if (techniques.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500 font-medium">No techniques loaded</p>
        <p className="text-sm text-gray-400 mt-2">
          Import STIX data from MITRE ATT&CK to populate techniques
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "techniques" ? "default" : "outline"}
            onClick={() => setFilter("techniques")}
          >
            Techniques Only
          </Button>
          <Button
            size="sm"
            variant={filter === "subtechniques" ? "default" : "outline"}
            onClick={() => setFilter("subtechniques")}
          >
            Sub-techniques Only
          </Button>
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
        </div>

        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by ID, name, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button size="sm" variant="outline" onClick={fetchTechniques}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredTechniques.length} of {techniques.length} techniques
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Platforms</TableHead>
                <TableHead>Tactics</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTechniques.map((technique) => (
                <TableRow key={technique.id}>
                  <TableCell className="font-mono font-medium">
                    {technique.attackId}
                    {technique.isSubtechnique && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Sub
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{technique.name}</p>
                      {technique.description && (
                        <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                          {technique.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {technique.platforms && technique.platforms.length > 0 ? (
                        technique.platforms.slice(0, 3).map((platform, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {platform}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                      {technique.platforms && technique.platforms.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{technique.platforms.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {technique.killChainPhases && technique.killChainPhases.length > 0 ? (
                        technique.killChainPhases.slice(0, 2).map((phase, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {phase.replace(/-/g, " ")}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                      {technique.killChainPhases && technique.killChainPhases.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{technique.killChainPhases.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {technique.deprecated && (
                      <Badge variant="destructive" className="text-xs">
                        Deprecated
                      </Badge>
                    )}
                    {technique.revoked && (
                      <Badge variant="destructive" className="text-xs">
                        Revoked
                      </Badge>
                    )}
                    {!technique.deprecated && !technique.revoked && (
                      <Badge variant="default" className="text-xs bg-green-600">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        window.open(
                          `https://attack.mitre.org/techniques/${technique.attackId}/`,
                          "_blank"
                        )
                      }
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
