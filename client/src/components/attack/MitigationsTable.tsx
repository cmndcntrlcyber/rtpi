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
import { Search, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";

interface Mitigation {
  id: string;
  attackId: string;
  name: string;
  description: string;
  deprecated: boolean;
  revoked: boolean;
}

export default function MitigationsTable() {
  const [mitigations, setMitigations] = useState<Mitigation[]>([]);
  const [filteredMitigations, setFilteredMitigations] = useState<Mitigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchMitigations = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/attack/mitigations", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setMitigations(data);
        setFilteredMitigations(data);
      } else {
        console.error("Failed to fetch mitigations");
      }
    } catch (error) {
      console.error("Failed to fetch mitigations:", error);
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
        m.attackId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredMitigations(filtered);
  }, [searchTerm, mitigations]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading mitigations...</p>
      </div>
    );
  }

  if (mitigations.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <ShieldCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 font-medium">No mitigations loaded</p>
        <p className="text-sm text-gray-400 mt-2">
          Import STIX data from MITRE ATT&CK to populate mitigations
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Refresh */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredMitigations.length} of {mitigations.length} mitigations
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                  <TableCell className="font-mono font-medium">
                    {mitigation.attackId}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{mitigation.name}</div>
                  </TableCell>
                  <TableCell>
                    {mitigation.description ? (
                      <p className="text-sm text-gray-600 line-clamp-3">
                        {mitigation.description}
                      </p>
                    ) : (
                      <span className="text-sm text-gray-400">No description</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {mitigation.deprecated && (
                      <Badge variant="destructive" className="text-xs">
                        Deprecated
                      </Badge>
                    )}
                    {mitigation.revoked && (
                      <Badge variant="destructive" className="text-xs">
                        Revoked
                      </Badge>
                    )}
                    {!mitigation.deprecated && !mitigation.revoked && (
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
                          `https://attack.mitre.org/mitigations/${mitigation.attackId}/`,
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
