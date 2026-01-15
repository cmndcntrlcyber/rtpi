import React, { useState, useEffect } from "react";
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
import { Search, ExternalLink, RefreshCw, Info, Download, ChevronRight, ChevronDown } from "lucide-react";
import TechniqueDetailDialog from "./TechniqueDetailDialog";
import { exportToNavigator } from "@/utils/attack-navigator-export";
import type { Technique, TechniqueWithSubtechniques } from "@shared/types/attack";

export default function TechniquesTable() {
  const [techniques, setTechniques] = useState<TechniqueWithSubtechniques[]>([]);
  const [filteredTechniques, setFilteredTechniques] = useState<TechniqueWithSubtechniques[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "techniques" | "subtechniques">("techniques");
  const [selectedTechnique, setSelectedTechnique] = useState<Technique | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [expandedTechniques, setExpandedTechniques] = useState<Set<string>>(new Set());

  const fetchTechniques = async () => {
    setLoading(true);
    try {
      const subtechniquesParam = filter === "techniques" ? "exclude" : filter === "subtechniques" ? "only" : "";
      const hierarchicalParam = filter === "techniques" ? "true" : "false";

      const params = new URLSearchParams();
      if (subtechniquesParam) params.append("subtechniques", subtechniquesParam);
      if (filter === "techniques") params.append("hierarchical", hierarchicalParam);

      const url = `/api/v1/attack/techniques${params.toString() ? `?${params.toString()}` : ""}`;

      const response = await fetch(url, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setTechniques(data);
        setFilteredTechniques(data);
      } else {
        console.error("Failed to fetch techniques");
      }
    } catch (error) {
      // Error already shown via toast
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTechniques();
  }, [filter]);

  const toggleExpanded = (techniqueId: string) => {
    setExpandedTechniques((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(techniqueId)) {
        newSet.delete(techniqueId);
      } else {
        newSet.add(techniqueId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (!searchTerm) {
      setFilteredTechniques(techniques);
      return;
    }

    const filtered = techniques.filter((t) => {
      const matchesParent =
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.attackId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));

      // Also check sub-techniques
      const matchesSubtechnique = t.subtechniques?.some(
        (sub) =>
          sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          sub.attackId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (sub.description && sub.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      return matchesParent || matchesSubtechnique;
    });
    setFilteredTechniques(filtered);
  }, [searchTerm, techniques]);

  const handleViewDetails = (technique: Technique) => {
    setSelectedTechnique(technique);
    setDetailDialogOpen(true);
  };

  const handleExportToNavigator = () => {
    const filterLabel =
      filter === "techniques"
        ? "Techniques Only"
        : filter === "subtechniques"
        ? "Sub-techniques Only"
        : "All Techniques";

    // Flatten techniques for export (include all sub-techniques)
    const flatTechniques: Technique[] = [];
    filteredTechniques.forEach((t) => {
      flatTechniques.push(t);
      if (t.subtechniques) {
        flatTechniques.push(...t.subtechniques);
      }
    });

    exportToNavigator(flatTechniques, {
      layerName: `RTPI ${filterLabel}${searchTerm ? ` - Search: ${searchTerm}` : ""}`,
      description: `Exported from RTPI on ${new Date().toLocaleDateString()}. Contains ${flatTechniques.length} techniques.`,
    });
  };

  const renderTechniqueRow = (technique: Technique | TechniqueWithSubtechniques, isSubtechnique = false): JSX.Element => {
    const hasSubtechniques = !isSubtechnique && (technique as TechniqueWithSubtechniques).subtechniques && (technique as TechniqueWithSubtechniques).subtechniques!.length > 0;
    const isExpanded = expandedTechniques.has(technique.id);

    return (
      <React.Fragment key={technique.id}>
        <TableRow className={isSubtechnique ? "bg-secondary" : ""}>
          <TableCell className="font-mono font-medium">
            <div className="flex items-center gap-2">
              {hasSubtechniques && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => toggleExpanded(technique.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              )}
              {!hasSubtechniques && !isSubtechnique && <div className="w-6" />}
              {isSubtechnique && <div className="w-10" />}
              <span>{technique.attackId}</span>
              {isSubtechnique && (
                <Badge variant="outline" className="ml-2 text-xs">
                  Sub
                </Badge>
              )}
            </div>
          </TableCell>
          <TableCell>
            <div>
              <p className="font-medium">{technique.name}</p>
              {technique.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {technique.description}
                </p>
              )}
            </div>
          </TableCell>
          <TableCell>
            <div className="flex flex-wrap gap-1">
              {technique.platforms && technique.platforms.length > 0 ? (
                technique.platforms.slice(0, 3).map((platform) => (
                  <Badge key={platform} variant="secondary" className="text-xs">
                    {platform}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">N/A</span>
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
                technique.killChainPhases.slice(0, 2).map((phase) => (
                  <Badge key={phase} variant="outline" className="text-xs">
                    {phase.replace(/-/g, " ")}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">N/A</span>
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
            <div className="flex gap-1 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleViewDetails(technique)}
                title="View details"
              >
                <Info className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  window.open(
                    `https://attack.mitre.org/techniques/${technique.attackId}/`,
                    "_blank"
                  )
                }
                title="View on MITRE ATT&CK"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        {hasSubtechniques && isExpanded && (technique as TechniqueWithSubtechniques).subtechniques!.map((sub) => (
          <React.Fragment key={sub.id}>
            {renderTechniqueRow(sub, true)}
          </React.Fragment>
        ))}
      </React.Fragment>
    );
  };

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
      <div className="text-center py-12 bg-card rounded-lg border border-border">
        <p className="text-muted-foreground font-medium">No techniques loaded</p>
        <p className="text-sm text-muted-foreground mt-2">
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
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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

        <Button
          size="sm"
          variant="outline"
          onClick={handleExportToNavigator}
          disabled={filteredTechniques.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export to Navigator
        </Button>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filter === "techniques" ? (
          <>
            Showing {filteredTechniques.length} parent techniques
            {filteredTechniques.reduce((acc, t) => acc + (t.subtechniques?.length || 0), 0) > 0 && (
              <span className="text-muted-foreground">
                {" "}
                with {filteredTechniques.reduce((acc, t) => acc + (t.subtechniques?.length || 0), 0)} sub-techniques
              </span>
            )}
          </>
        ) : (
          <>Showing {filteredTechniques.length} of {techniques.length} {filter === "subtechniques" ? "sub-techniques" : "techniques"}</>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
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
              {filteredTechniques.map((technique) => renderTechniqueRow(technique))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Technique Detail Dialog */}
      <TechniqueDetailDialog
        technique={selectedTechnique}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
}
