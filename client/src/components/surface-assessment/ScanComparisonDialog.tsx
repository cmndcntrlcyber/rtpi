import { useState, useEffect } from "react";
import { ArrowRight, Plus, Minus, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface ScanComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operationId: string;
}

interface Scan {
  id: string;
  name: string;
  completedAt: string;
  assetsCount: number;
  servicesCount: number;
  vulnerabilitiesCount: number;
}

interface ComparisonResult {
  assets: {
    added: any[];
    removed: any[];
    unchanged: any[];
  };
  services: {
    added: any[];
    removed: any[];
    unchanged: any[];
  };
  vulnerabilities: {
    added: any[];
    removed: any[];
    changed: any[];
    unchanged: any[];
  };
}

export default function ScanComparisonDialog({
  open,
  onOpenChange,
  operationId,
}: ScanComparisonDialogProps) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [scan1Id, setScan1Id] = useState<string>("");
  const [scan2Id, setScan2Id] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);

  useEffect(() => {
    if (open && operationId) {
      loadScans();
    }
  }, [open, operationId]);

  const loadScans = async () => {
    try {
      setLoading(true);
      // This endpoint would need to be implemented on the backend
      const response = await api.get<{ scans: Scan[] }>(
        `/surface-assessment/${operationId}/scans`
      );
      setScans(response.scans || []);
    } catch (error) {
      console.error("Failed to load scans:", error);
      toast.error("Failed to load scans");
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!scan1Id || !scan2Id) {
      toast.error("Please select two scans to compare");
      return;
    }

    if (scan1Id === scan2Id) {
      toast.error("Please select different scans");
      return;
    }

    try {
      setComparing(true);
      // This would call a backend endpoint that performs the comparison
      const response = await api.post<{ comparison: ComparisonResult }>(
        `/surface-assessment/${operationId}/compare`,
        {
          scan1Id,
          scan2Id,
        }
      );
      setComparison(response.comparison);
      toast.success("Comparison completed");
    } catch (error) {
      console.error("Failed to compare scans:", error);
      toast.error("Failed to compare scans");
    } finally {
      setComparing(false);
    }
  };

  const handleExportComparison = () => {
    if (!comparison) return;

    const markdown = generateComparisonMarkdown();
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `scan-comparison-${Date.now()}.md`;
    link.click();
    toast.success("Comparison exported");
  };

  const generateComparisonMarkdown = (): string => {
    if (!comparison) return "";

    const scan1 = scans.find((s) => s.id === scan1Id);
    const scan2 = scans.find((s) => s.id === scan2Id);

    let md = `# Scan Comparison Report\n\n`;
    md += `**Scan 1:** ${scan1?.name} (${new Date(scan1?.completedAt || "").toLocaleDateString()})\n`;
    md += `**Scan 2:** ${scan2?.name} (${new Date(scan2?.completedAt || "").toLocaleDateString()})\n`;
    md += `**Generated:** ${new Date().toLocaleString()}\n\n`;

    md += `## Summary\n\n`;
    md += `| Category | Added | Removed | Changed | Unchanged |\n`;
    md += `|----------|-------|---------|---------|----------|\n`;
    md += `| Assets | ${comparison.assets.added.length} | ${comparison.assets.removed.length} | - | ${comparison.assets.unchanged.length} |\n`;
    md += `| Services | ${comparison.services.added.length} | ${comparison.services.removed.length} | - | ${comparison.services.unchanged.length} |\n`;
    md += `| Vulnerabilities | ${comparison.vulnerabilities.added.length} | ${comparison.vulnerabilities.removed.length} | ${comparison.vulnerabilities.changed.length} | ${comparison.vulnerabilities.unchanged.length} |\n\n`;

    // Added Assets
    if (comparison.assets.added.length > 0) {
      md += `## New Assets (${comparison.assets.added.length})\n\n`;
      comparison.assets.added.forEach((asset) => {
        md += `- ${asset.value} (${asset.type})\n`;
      });
      md += `\n`;
    }

    // Removed Assets
    if (comparison.assets.removed.length > 0) {
      md += `## Removed Assets (${comparison.assets.removed.length})\n\n`;
      comparison.assets.removed.forEach((asset) => {
        md += `- ${asset.value} (${asset.type})\n`;
      });
      md += `\n`;
    }

    // New Vulnerabilities
    if (comparison.vulnerabilities.added.length > 0) {
      md += `## New Vulnerabilities (${comparison.vulnerabilities.added.length})\n\n`;
      comparison.vulnerabilities.added.forEach((vuln) => {
        md += `- **${vuln.title}** - ${vuln.severity}\n`;
        if (vuln.cveId) md += `  - CVE: ${vuln.cveId}\n`;
      });
      md += `\n`;
    }

    return md;
  };

  const getChangeIcon = (type: "added" | "removed" | "changed") => {
    switch (type) {
      case "added":
        return <Plus className="h-4 w-4 text-green-600" />;
      case "removed":
        return <Minus className="h-4 w-4 text-red-600" />;
      case "changed":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare Scans</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Scan Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div>
              <label className="text-sm font-medium mb-2 block">
                First Scan (Baseline)
              </label>
              <Select value={scan1Id} onValueChange={setScan1Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scan..." />
                </SelectTrigger>
                <SelectContent>
                  {scans.map((scan) => (
                    <SelectItem key={scan.id} value={scan.id}>
                      {scan.name} -{" "}
                      {new Date(scan.completedAt).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Second Scan (Comparison)
              </label>
              <Select value={scan2Id} onValueChange={setScan2Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scan..." />
                </SelectTrigger>
                <SelectContent>
                  {scans.map((scan) => (
                    <SelectItem key={scan.id} value={scan.id}>
                      {scan.name} -{" "}
                      {new Date(scan.completedAt).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleCompare}
              disabled={!scan1Id || !scan2Id || comparing}
            >
              {comparing ? "Comparing..." : "Compare Scans"}
            </Button>

            {comparison && (
              <Button
                variant="outline"
                onClick={handleExportComparison}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            )}
          </div>

          {/* Comparison Results */}
          {comparison && (
            <Tabs defaultValue="summary" className="mt-6">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="assets">Assets</TabsTrigger>
                <TabsTrigger value="services">Services</TabsTrigger>
                <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border border-border rounded-lg">
                    <h3 className="font-semibold mb-2">Assets</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-green-600">Added:</span>
                        <Badge variant="outline" className="bg-green-50">
                          {comparison.assets.added.length}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-red-600">Removed:</span>
                        <Badge variant="outline" className="bg-red-50">
                          {comparison.assets.removed.length}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Unchanged:</span>
                        <Badge variant="outline">
                          {comparison.assets.unchanged.length}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border border-border rounded-lg">
                    <h3 className="font-semibold mb-2">Services</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-green-600">Added:</span>
                        <Badge variant="outline" className="bg-green-50">
                          {comparison.services.added.length}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-red-600">Removed:</span>
                        <Badge variant="outline" className="bg-red-50">
                          {comparison.services.removed.length}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Unchanged:</span>
                        <Badge variant="outline">
                          {comparison.services.unchanged.length}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border border-border rounded-lg">
                    <h3 className="font-semibold mb-2">Vulnerabilities</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-green-600">New:</span>
                        <Badge variant="outline" className="bg-green-50">
                          {comparison.vulnerabilities.added.length}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-red-600">Fixed:</span>
                        <Badge variant="outline" className="bg-red-50">
                          {comparison.vulnerabilities.removed.length}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-yellow-600">Changed:</span>
                        <Badge variant="outline" className="bg-yellow-50">
                          {comparison.vulnerabilities.changed.length}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="assets" className="space-y-4">
                {comparison.assets.added.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-green-600 mb-2 flex items-center gap-2">
                      {getChangeIcon("added")} New Assets ({comparison.assets.added.length})
                    </h3>
                    <div className="space-y-2">
                      {comparison.assets.added.map((asset: any, idx: number) => (
                        <div key={idx} className="p-2 bg-green-50 rounded text-sm">
                          {asset.value} ({asset.type})
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {comparison.assets.removed.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-red-600 mb-2 flex items-center gap-2">
                      {getChangeIcon("removed")} Removed Assets ({comparison.assets.removed.length})
                    </h3>
                    <div className="space-y-2">
                      {comparison.assets.removed.map((asset: any, idx: number) => (
                        <div key={idx} className="p-2 bg-red-50 rounded text-sm">
                          {asset.value} ({asset.type})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="services" className="space-y-4">
                {/* Similar structure for services */}
                <p className="text-muted-foreground">
                  Service comparison details would be displayed here...
                </p>
              </TabsContent>

              <TabsContent value="vulnerabilities" className="space-y-4">
                {comparison.vulnerabilities.added.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-green-600 mb-2 flex items-center gap-2">
                      {getChangeIcon("added")} New Vulnerabilities ({comparison.vulnerabilities.added.length})
                    </h3>
                    <div className="space-y-2">
                      {comparison.vulnerabilities.added.map((vuln: any, idx: number) => (
                        <div key={idx} className="p-3 bg-green-50 rounded">
                          <div className="font-medium">{vuln.title}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Severity: {vuln.severity} {vuln.cveId && `| CVE: ${vuln.cveId}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {comparison.vulnerabilities.removed.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-red-600 mb-2 flex items-center gap-2">
                      {getChangeIcon("removed")} Fixed Vulnerabilities ({comparison.vulnerabilities.removed.length})
                    </h3>
                    <div className="space-y-2">
                      {comparison.vulnerabilities.removed.map((vuln: any, idx: number) => (
                        <div key={idx} className="p-3 bg-red-50 rounded">
                          <div className="font-medium">{vuln.title}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Severity: {vuln.severity}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
