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
import { Search, ExternalLink, RefreshCw, Wrench } from "lucide-react";

interface Software {
  id: string;
  attackId: string;
  name: string;
  description: string;
  type: string;
  platforms: string[] | null;
  aliases: string[] | null;
  deprecated: boolean;
  revoked: boolean;
}

export default function SoftwareTable() {
  const [software, setSoftware] = useState<Software[]>([]);
  const [filteredSoftware, setFilteredSoftware] = useState<Software[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "malware" | "tool">("all");

  const fetchSoftware = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/attack/software", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setSoftware(data);
        setFilteredSoftware(data);
      } else {
        console.error("Failed to fetch software");
      }
    } catch (error) {
      // Error already shown via toast
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSoftware();
  }, []);

  useEffect(() => {
    let filtered = software;

    // Apply type filter
    if (filter !== "all") {
      filtered = filtered.filter((s) => s.type === filter);
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.attackId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (s.aliases && s.aliases.some((alias) => alias.toLowerCase().includes(searchTerm.toLowerCase())))
      );
    }

    setFilteredSoftware(filtered);
  }, [searchTerm, software, filter]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading software...</p>
      </div>
    );
  }

  if (software.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-border">
        <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">No software loaded</p>
        <p className="text-sm text-muted-foreground mt-2">
          Import STIX data from MITRE ATT&CK to populate software
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
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filter === "malware" ? "default" : "outline"}
            onClick={() => setFilter("malware")}
          >
            Malware
          </Button>
          <Button
            size="sm"
            variant={filter === "tool" ? "default" : "outline"}
            onClick={() => setFilter("tool")}
          >
            Tools
          </Button>
        </div>

        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, name, alias, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button size="sm" variant="outline" onClick={fetchSoftware}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredSoftware.length} of {software.length} software items
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Platforms</TableHead>
                <TableHead>Aliases</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSoftware.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-medium">
                    {item.attackId}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      {item.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={item.type === "malware" ? "destructive" : "default"}
                      className="text-xs capitalize"
                    >
                      {item.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.platforms && item.platforms.length > 0 ? (
                        item.platforms.slice(0, 2).map((platform, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {platform}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">N/A</span>
                      )}
                      {item.platforms && item.platforms.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{item.platforms.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.aliases && item.aliases.length > 0 ? (
                        item.aliases.slice(0, 2).map((alias, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {alias}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">N/A</span>
                      )}
                      {item.aliases && item.aliases.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{item.aliases.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.deprecated && (
                      <Badge variant="destructive" className="text-xs">
                        Deprecated
                      </Badge>
                    )}
                    {item.revoked && (
                      <Badge variant="destructive" className="text-xs">
                        Revoked
                      </Badge>
                    )}
                    {!item.deprecated && !item.revoked && (
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
                          `https://attack.mitre.org/software/${item.attackId}/`,
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
