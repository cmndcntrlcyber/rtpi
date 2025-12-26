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
import { Search, ExternalLink, RefreshCw, Users } from "lucide-react";

interface Group {
  id: string;
  attackId: string;
  name: string;
  description: string;
  aliases: string[] | null;
  deprecated: boolean;
  revoked: boolean;
  associatedGroups: string[] | null;
}

export default function GroupsTable() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/attack/groups", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setGroups(data);
        setFilteredGroups(data);
      } else {
        console.error("Failed to fetch threat groups");
      }
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredGroups(groups);
      return;
    }

    const filtered = groups.filter(
      (g) =>
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.attackId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.description && g.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (g.aliases && g.aliases.some((alias) => alias.toLowerCase().includes(searchTerm.toLowerCase())))
    );
    setFilteredGroups(filtered);
  }, [searchTerm, groups]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading threat groups...</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-border">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">No threat groups loaded</p>
        <p className="text-sm text-muted-foreground mt-2">
          Import STIX data from MITRE ATT&CK to populate threat groups
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Refresh */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, name, alias, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button size="sm" variant="outline" onClick={fetchGroups}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredGroups.length} of {groups.length} threat groups
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Aliases</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-mono font-medium">
                    {group.attackId}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{group.name}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {group.aliases && group.aliases.length > 0 ? (
                        group.aliases.slice(0, 3).map((alias, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {alias}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">N/A</span>
                      )}
                      {group.aliases && group.aliases.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{group.aliases.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {group.description ? (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {group.description}
                      </p>
                    ) : (
                      <span className="text-sm text-muted-foreground">No description</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {group.deprecated && (
                      <Badge variant="destructive" className="text-xs">
                        Deprecated
                      </Badge>
                    )}
                    {group.revoked && (
                      <Badge variant="destructive" className="text-xs">
                        Revoked
                      </Badge>
                    )}
                    {!group.deprecated && !group.revoked && (
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
                          `https://attack.mitre.org/groups/${group.attackId}/`,
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
