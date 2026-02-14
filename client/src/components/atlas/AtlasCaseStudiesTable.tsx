import { useState, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, RefreshCw, BookOpen } from "lucide-react";

interface AtlasCaseStudy {
  id: string;
  techniqueId: string;
  name: string;
  description: string | null;
  targetSystem: string | null;
  impact: string | null;
  references: string[] | null;
}

export default function AtlasCaseStudiesTable() {
  const [caseStudies, setCaseStudies] = useState<AtlasCaseStudy[]>([]);
  const [filteredCaseStudies, setFilteredCaseStudies] = useState<AtlasCaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchCaseStudies = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/atlas/case-studies", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setCaseStudies(data);
        setFilteredCaseStudies(data);
      }
    } catch (error) {
      console.error("Failed to fetch ATLAS case studies:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaseStudies();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredCaseStudies(caseStudies);
      return;
    }
    const filtered = caseStudies.filter(
      (cs) =>
        cs.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cs.description && cs.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cs.targetSystem && cs.targetSystem.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cs.impact && cs.impact.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredCaseStudies(filtered);
  }, [searchTerm, caseStudies]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading case studies...</p>
      </div>
    );
  }

  if (caseStudies.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-border">
        <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">No case studies available</p>
        <p className="text-sm text-muted-foreground mt-2">
          Case studies document real-world AI/ML attacks. They can be added manually or imported.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => window.open("https://atlas.mitre.org/studies", "_blank")}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Browse ATLAS Case Studies
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search case studies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button size="sm" variant="outline" onClick={fetchCaseStudies}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredCaseStudies.length} of {caseStudies.length} case studies
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Target System</TableHead>
                <TableHead>Impact</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCaseStudies.map((cs) => (
                <TableRow key={cs.id}>
                  <TableCell>
                    <div className="font-medium">{cs.name}</div>
                  </TableCell>
                  <TableCell>
                    {cs.targetSystem ? (
                      <Badge variant="secondary" className="text-xs">{cs.targetSystem}</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {cs.impact ? (
                      <p className="text-sm text-muted-foreground line-clamp-2">{cs.impact}</p>
                    ) : (
                      <span className="text-sm text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {cs.description ? (
                      <p className="text-sm text-muted-foreground line-clamp-2">{cs.description}</p>
                    ) : (
                      <span className="text-sm text-muted-foreground">No description</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {cs.references && cs.references.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(cs.references![0], "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
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
