import { useState, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Link2, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";

interface AtlasRelationship {
  id: string;
  relationshipType: string;
  sourceRef: string;
  targetRef: string;
  description: string | null;
}

export default function AtlasAttackMappingsTab() {
  const [relationships, setRelationships] = useState<AtlasRelationship[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRelationships = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/atlas/relationships", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setRelationships(data);
      }
    } catch (error) {
      console.error("Failed to fetch ATLAS relationships:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRelationships();
  }, []);

  // Group relationships by type
  const mitigates = relationships.filter((r) => r.relationshipType === "mitigates");
  const subtechniqueOf = relationships.filter((r) => r.relationshipType === "subtechnique-of");
  const other = relationships.filter(
    (r) => r.relationshipType !== "mitigates" && r.relationshipType !== "subtechnique-of"
  );

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading relationships...</p>
      </div>
    );
  }

  if (relationships.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-border">
        <Link2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">No relationships loaded</p>
        <p className="text-sm text-muted-foreground mt-2">
          Import ATLAS STIX data to populate relationships between objects.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Relationships include mitigations for techniques, subtechnique hierarchies, and cross-framework mappings.
        </p>
      </div>
    );
  }

  const renderRelationshipTable = (rels: AtlasRelationship[], title: string) => {
    if (rels.length === 0) return null;

    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">{title} ({rels.length})</h4>
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rels.slice(0, 50).map((rel) => (
                  <TableRow key={rel.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {rel.relationshipType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{rel.sourceRef.split("--")[0]}</TableCell>
                    <TableCell className="font-mono text-xs">{rel.targetRef.split("--")[0]}</TableCell>
                    <TableCell>
                      {rel.description ? (
                        <p className="text-sm text-muted-foreground line-clamp-2">{rel.description}</p>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {rels.length > 50 && (
            <div className="p-3 text-center text-sm text-muted-foreground border-t">
              Showing 50 of {rels.length} relationships
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">ATLAS Relationships & ATT&CK Mappings</h3>
          <p className="text-sm text-muted-foreground">
            {relationships.length} total relationships
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchRelationships}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Mitigates</p>
          <p className="text-2xl font-bold">{mitigates.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Subtechnique-of</p>
          <p className="text-2xl font-bold">{subtechniqueOf.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Other</p>
          <p className="text-2xl font-bold">{other.length}</p>
        </Card>
      </div>

      {renderRelationshipTable(mitigates, "Mitigation Relationships")}
      {renderRelationshipTable(subtechniqueOf, "Subtechnique Hierarchies")}
      {renderRelationshipTable(other, "Other Relationships")}

      <Card className="p-4 bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
        <div className="text-sm text-purple-800 dark:text-purple-200">
          <p className="font-medium mb-1">Cross-Framework Mappings</p>
          <p>
            For full ATLAS-to-ATT&CK cross-framework mappings, import the combined{" "}
            <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">stix-atlas-attack-enterprise.json</code>{" "}
            file from the{" "}
            <a
              href="https://github.com/mitre-atlas/atlas-navigator-data/tree/main/dist"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              atlas-navigator-data repository
            </a>
            .
          </p>
        </div>
      </Card>
    </div>
  );
}
