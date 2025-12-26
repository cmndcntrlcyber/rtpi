/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus } from "lucide-react";
import { useOperations } from "@/hooks/useOperations";
import { useVulnerabilities } from "@/hooks/useVulnerabilities";
import { useTargets } from "@/hooks/useTargets";
import { useAuth } from "@/contexts/AuthContext";

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (reportData: any) => void;
  generating?: boolean;
}

export default function GenerateReportDialog({
  open,
  onClose,
  onGenerate,
  generating = false,
}: GenerateReportDialogProps) {
  const { user } = useAuth();
  const { operations } = useOperations();
  const { vulnerabilities } = useVulnerabilities();
  const { targets } = useTargets();
  
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [selectedVulnerabilities, setSelectedVulnerabilities] = useState<string[]>([]);
  const [reportData, setReportData] = useState({
    name: "",
    type: "penetration_test",
    format: "markdown",
    // Auto-populated fields
    testType: "",
    testDate: "",
    objectives: "",
    scope: "",
    // Manual fields
    clientName: "",
    projectName: "",
    testerName: user?.username || "",
    additionalNotes: "",
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedOperationId("");
      setSelectedVulnerabilities([]);
      setReportData({
        name: "",
        type: "penetration_test",
        format: "markdown",
        testType: "",
        testDate: "",
        objectives: "",
        scope: "",
        clientName: "",
        projectName: "",
        testerName: user?.username || "",
        additionalNotes: "",
      });
    }
  }, [open, user]);

  // Pre-populate data when operation is selected
  useEffect(() => {
    if (selectedOperationId) {
      const operation = operations.find((op) => op.id === selectedOperationId);
      if (operation) {
        setReportData((prev) => ({
          ...prev,
          name: `${operation.name} - Security Assessment Report`,
          testType: operation.type || "Penetration Test",
          testDate: operation.startedAt 
            ? new Date(operation.startedAt).toLocaleDateString() 
            : new Date().toLocaleDateString(),
          objectives: operation.description || "",
          scope: operation.description || "",
        }));
      }
    }
  }, [selectedOperationId, operations]);

  const handleVulnerabilityToggle = (vulnId: string) => {
    setSelectedVulnerabilities((prev) =>
      prev.includes(vulnId)
        ? prev.filter((id) => id !== vulnId)
        : [...prev, vulnId]
    );
  };

  const handleSelectAll = () => {
    const operationVulns = operationVulnerabilities.map((v) => v.id);
    setSelectedVulnerabilities(operationVulns);
  };

  const handleDeselectAll = () => {
    setSelectedVulnerabilities([]);
  };

  const handleGenerate = () => {
    // Build complete report data
    const completeData = {
      ...reportData,
      operationId: selectedOperationId,
      selectedVulnerabilities,
      content: {
        header: {
          testType: reportData.testType,
          testDate: reportData.testDate,
          clientName: reportData.clientName,
          projectName: reportData.projectName,
          testerName: reportData.testerName,
        },
        objectives: reportData.objectives,
        scope: reportData.scope,
        findings: selectedVulnerabilities,
        additionalNotes: reportData.additionalNotes,
      },
    };
    
    onGenerate(completeData);
  };

  // Get vulnerabilities for selected operation (both direct and via targets)
  const operationTargets = targets.filter((t) => t.operationId === selectedOperationId);
  const targetIds = operationTargets.map((t) => t.id);
  
  const operationVulnerabilities = vulnerabilities.filter((v) => {
    // Direct operation association
    if (v.operationId === selectedOperationId) return true;
    
    // Target association (where target belongs to this operation)
    if (v.targetId && targetIds.includes(v.targetId)) return true;
    
    return false;
  });

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500/10 text-red-600",
      high: "bg-orange-500/10 text-orange-600",
      medium: "bg-yellow-500/10 text-yellow-600",
      low: "bg-blue-500/10 text-blue-600",
      informational: "bg-secondary0/10 text-muted-foreground",
    };
    return colors[severity.toLowerCase()] || colors.informational;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate New Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Operation Selection */}
          <div>
            <Label htmlFor="operation-select">
              Operation <span className="text-red-500">*</span>
            </Label>
            <Select value={selectedOperationId} onValueChange={setSelectedOperationId}>
              <SelectTrigger id="operation-select">
                <SelectValue placeholder="Select operation..." />
              </SelectTrigger>
              <SelectContent>
                {operations.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.name} ({op.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedOperationId && (
            <>
              {/* Header Information Section */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-foreground mb-4">Header Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="report-name">Report Name *</Label>
                    <Input
                      id="report-name"
                      value={reportData.name}
                      onChange={(e) =>
                        setReportData({ ...reportData, name: e.target.value })
                      }
                      placeholder="Security Assessment Report"
                    />
                  </div>

                  <div>
                    <Label htmlFor="test-type">Test Type (Auto-filled)</Label>
                    <Input
                      id="test-type"
                      value={reportData.testType}
                      onChange={(e) =>
                        setReportData({ ...reportData, testType: e.target.value })
                      }
                      placeholder="Penetration Test"
                      className="bg-secondary"
                    />
                  </div>

                  <div>
                    <Label htmlFor="test-date">Test Date (Auto-filled)</Label>
                    <Input
                      id="test-date"
                      value={reportData.testDate}
                      onChange={(e) =>
                        setReportData({ ...reportData, testDate: e.target.value })
                      }
                      className="bg-secondary"
                    />
                  </div>

                  <div>
                    <Label htmlFor="client-name">Client Name (Manual)</Label>
                    <Input
                      id="client-name"
                      value={reportData.clientName}
                      onChange={(e) =>
                        setReportData({ ...reportData, clientName: e.target.value })
                      }
                      placeholder="Enter client name..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="project-name">Project Name (Manual)</Label>
                    <Input
                      id="project-name"
                      value={reportData.projectName}
                      onChange={(e) =>
                        setReportData({ ...reportData, projectName: e.target.value })
                      }
                      placeholder="Enter project name..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="tester-name">Tester (Auto-filled)</Label>
                    <Input
                      id="tester-name"
                      value={reportData.testerName}
                      onChange={(e) =>
                        setReportData({ ...reportData, testerName: e.target.value })
                      }
                      className="bg-secondary"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <Label htmlFor="objectives">Objectives (Auto-filled)</Label>
                  <Textarea
                    id="objectives"
                    value={reportData.objectives}
                    onChange={(e) =>
                      setReportData({ ...reportData, objectives: e.target.value })
                    }
                    rows={2}
                    className="bg-secondary"
                  />
                </div>

                <div className="mt-4">
                  <Label htmlFor="scope">Scope (Auto-filled)</Label>
                  <Textarea
                    id="scope"
                    value={reportData.scope}
                    onChange={(e) =>
                      setReportData({ ...reportData, scope: e.target.value })
                    }
                    rows={2}
                    className="bg-secondary"
                  />
                </div>
              </div>

              {/* Findings Section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Findings ({operationVulnerabilities.length} available)
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSelectAll}
                      disabled={operationVulnerabilities.length === 0}
                    >
                      Select All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDeselectAll}
                      disabled={selectedVulnerabilities.length === 0}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {operationVulnerabilities.length === 0 ? (
                  <div className="text-center py-8 bg-secondary rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground">
                      No vulnerabilities found for this operation
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto border border-border rounded-lg p-3">
                    {operationVulnerabilities.map((vuln) => {
                      const sourceTarget = operationTargets.find((t) => t.id === vuln.targetId);
                      
                      return (
                        <div
                          key={vuln.id}
                          className="flex items-center gap-3 p-2 hover:bg-secondary rounded"
                        >
                          <input
                            type="checkbox"
                            id={`vuln-${vuln.id}`}
                            checked={selectedVulnerabilities.includes(vuln.id)}
                            onChange={() => handleVulnerabilityToggle(vuln.id)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-border rounded"
                          />
                          <Label
                            htmlFor={`vuln-${vuln.id}`}
                            className="flex-1 flex flex-col gap-1 mb-0 cursor-pointer"
                          >
                            <div className="flex items-center gap-2 w-full">
                              <Badge
                                variant="secondary"
                                className={`text-xs ${getSeverityColor(vuln.severity)}`}
                              >
                                {vuln.severity}
                              </Badge>
                              <span className="flex-1">{vuln.title}</span>
                              <div className="flex items-center gap-2">
                                {vuln.cvss && (
                                  <span className="text-xs text-muted-foreground">
                                    CVSS: {vuln.cvss}
                                  </span>
                                )}
                                {vuln.cve && (
                                  <span className="text-xs text-muted-foreground">{vuln.cve}</span>
                                )}
                              </div>
                            </div>
                            {sourceTarget && (
                              <span className="text-xs text-blue-600 font-medium">
                                📍 Target: {(sourceTarget as any).name}
                              </span>
                            )}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-2">
                  Selected: {selectedVulnerabilities.length} vulnerability(s)
                </p>
              </div>

              {/* Additional Notes */}
              <div>
                <Label htmlFor="additional-notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="additional-notes"
                  value={reportData.additionalNotes}
                  onChange={(e) =>
                    setReportData({ ...reportData, additionalNotes: e.target.value })
                  }
                  placeholder="Enter any additional notes or observations..."
                  rows={3}
                />
              </div>

              {/* Format Selection */}
              <div>
                <Label htmlFor="format">Report Format</Label>
                <Select
                  value={reportData.format}
                  onValueChange={(value) =>
                    setReportData({ ...reportData, format: value })
                  }
                >
                  <SelectTrigger id="format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="docx">DOCX</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !selectedOperationId || !reportData.name}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {generating ? "Generating..." : "Generate Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
