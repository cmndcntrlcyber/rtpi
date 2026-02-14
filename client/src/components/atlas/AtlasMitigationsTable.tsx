import { useState, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";

interface AtlasMitigation {
  id: string;
  atlasId: string;
  name: string;
  description: string | null;
  deprecated: boolean;
  revoked: boolean;
}

export default function AtlasMitigationsTable() {
  const [mitigations, setMitigations] = useState<AtlasMitigation[]>([]);
  const [filteredMitigations, setFilteredMitigations] = useState<AtlasMitigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchMitigations = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/atlas/mitigations", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setMitigations(data);
        setFilteredMitigations(data);
      }
    } catch (error) {
      console.error("Failed to fetch ATLAS mitigations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMitigations();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredMitigations(mitigations);
      return;
    }
    const filtered = mitigations.filter(
      (m) =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.atlasId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredMitigations(filtered);
  }, [searchTerm, mitigations]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading ATLAS mitigations...</p>
      </div>
    );
  }

  if (mitigations.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-border">
        <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">No ATLAS mitigations loaded</p>
        <p className="text-sm text-muted-foreground mt-2">
          Import ATLAS STIX data to populate mitigations
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, name, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button size="sm" variant="outline" onClick={fetchMitigations}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredMitigations.length} of {mitigations.length} mitigations
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMitigations.map((mitigation) => (
                <TableRow key={mitigation.id}>
                  <TableCell className="font-mono font-medium">{mitigation.atlasId}</TableCell>
                  <TableCell>
                    <div className="font-medium">{mitigation.name}</div>
                  </TableCell>
                  <TableCell>
                    {mitigation.description ? (
                      <p className="text-sm text-muted-foreground line-clamp-3">{mitigation.description}</p>
                    ) : (
                      <span className="text-sm text-muted-foreground">No description</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {mitigation.deprecated ? (
                      <Badge variant="destructive" className="text-xs">Deprecated</Badge>
                    ) : mitigation.revoked ? (
                      <Badge variant="destructive" className="text-xs">Revoked</Badge>
                    ) : (
                      <Badge variant="default" className="text-xs bg-green-600">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(`https://atlas.mitre.org/mitigations/${mitigation.atlasId}`, "_blank")}
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
