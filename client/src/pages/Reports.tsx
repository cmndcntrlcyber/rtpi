import { useState, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Plus, Calendar, Trash2, Edit, ChevronDown, ChevronRight, Folder, Upload } from "lucide-react";
import { useReports, useReportTemplates, useCreateReport, useCreateTemplate, useDeleteReport } from "@/hooks/useReports";
import { useOperations } from "@/hooks/useOperations";
import { reportsService } from "@/services/reports";
import GenerateReportDialog from "@/components/reports/GenerateReportDialog";
import EditReportDialog from "@/components/reports/EditReportDialog";
import SysReptorExportDialog from "@/components/reports/SysReptorExportDialog";
import SysReptorProjectsList from "@/components/reports/SysReptorProjectsList";

const REPORT_GROUPS_KEY = "rtpi-report-groups-expanded";

function loadExpandedGroups(): Set<string> {
  try {
    const stored = localStorage.getItem(REPORT_GROUPS_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch { /* ignore */ }
  return new Set();
}

export default function Reports() {
  const { isAdmin } = useAuth();
  const { reports, loading: reportsLoading, refetch: refetchReports } = useReports();
  const { templates, loading: templatesLoading, refetch: refetchTemplates } = useReportTemplates();
  const { operations } = useOperations();
  const { create: createReport, creating } = useCreateReport();
  const { create: createTemplate, creating: creatingTemplate } = useCreateTemplate();
  const { delete: deleteReport, deleting } = useDeleteReport();

  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [sysReptorExportOpen, setSysReptorExportOpen] = useState(false);
  const [sysReptorExportTarget, setSysReptorExportTarget] = useState<{
    operationId: string;
    operationName?: string;
  } | null>(null);
  const [newReport, setNewReport] = useState({
    name: "",
    type: "operation_summary",
    format: "pdf",
  });
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    type: "bug_bounty",
    format: "pdf",
    structure: {},
  });

  // Group state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(loadExpandedGroups);
  const [initialGroupSet, setInitialGroupSet] = useState(false);

  // Build operation lookup
  const operationMap = useMemo(() => {
    const map = new Map<string, string>();
    operations.forEach((op: any) => map.set(op.id, op.name));
    return map;
  }, [operations]);

  // Group reports by operation
  const reportGroups = useMemo(() => {
    const groupMap = new Map<string, any[]>();

    reports.forEach((report: any) => {
      const key = report.operationId || "__unassigned__";
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(report);
    });

    const result: { key: string; label: string; reports: any[] }[] = [];
    const namedGroups: { key: string; label: string; reports: any[] }[] = [];

    groupMap.forEach((groupReports, key) => {
      if (key === "__unassigned__") return;
      namedGroups.push({
        key,
        label: operationMap.get(key) || "Unknown Operation",
        reports: groupReports,
      });
    });
    namedGroups.sort((a, b) => a.label.localeCompare(b.label));
    result.push(...namedGroups);

    const unassigned = groupMap.get("__unassigned__");
    if (unassigned) {
      result.push({ key: "__unassigned__", label: "Unassigned", reports: unassigned });
    }

    return result;
  }, [reports, operationMap]);

  // Auto-expand first group on initial load
  useEffect(() => {
    if (!initialGroupSet && !reportsLoading && reportGroups.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set([reportGroups[0].key]));
      setInitialGroupSet(true);
    }
  }, [reportsLoading, reportGroups, expandedGroups.size, initialGroupSet]);

  const handleToggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      localStorage.setItem(REPORT_GROUPS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const handleGenerateReport = async (reportData: any) => {
    try {
      await createReport(reportData);
      await refetchReports();
      setReportDialogOpen(false);
      setNewReport({ name: "", type: "operation_summary", format: "pdf" });
    } catch (err) {
      // Error handled via toast
    }
  };

  const handleCreateTemplate = async () => {
    try {
      const bugBountyStructure = {
        sections: [
          { title: "Executive Summary", required: true },
          { title: "Vulnerability Details", required: true },
          { title: "Proof of Concept", required: true },
          { title: "Impact Assessment", required: true },
          { title: "Remediation Steps", required: true },
          { title: "Timeline", required: false },
          { title: "References", required: false },
        ],
        fields: ["title", "severity", "cvss_score", "affected_systems", "description", "steps_to_reproduce"],
      };

      await createTemplate({
        ...newTemplate,
        structure: newTemplate.type === "bug_bounty" ? bugBountyStructure : newTemplate.structure,
      });
      await refetchTemplates();
      setTemplateDialogOpen(false);
      setNewTemplate({ name: "", description: "", type: "bug_bounty", format: "pdf", structure: {} });
    } catch (err) {
      // Error handled via toast
    }
  };

  const handleDownload = async (report: any) => {
    if (!report.filePath) {
      toast.warning(`Report file not yet generated for: ${report.name}`);
      return;
    }

    try {
      const response = await fetch(`/api/v1/reports/${report.id}/download`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to download report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.name}.${report.format === "markdown" ? "md" : report.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error("Failed to download report");
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Are you sure you want to delete this report?")) {
      return;
    }

    try {
      await deleteReport(reportId);
      await refetchReports();
    } catch (err) {
      // Error handled via toast
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) {
      return;
    }

    try {
      await reportsService.deleteTemplate(templateId);
      await refetchTemplates();
    } catch (err) {
      // Error handled via toast
    }
  };

  const handleEditReport = (report: any) => {
    setEditingReport(report);
    setEditDialogOpen(true);
  };

  const handleExportToSysReptor = (operationId: string) => {
    const opName = operationMap.get(operationId);
    setSysReptorExportTarget({ operationId, operationName: opName });
    setSysReptorExportOpen(true);
  };

  const handleSaveReport = async (_reportId: string, _content: string) => {
    try {
      toast.success("Report saved successfully!");
      await refetchReports();
    } catch (err) {
      toast.error("Failed to save report");
    }
  };

  const stats = {
    total: reports.length,
    completed: reports.filter((r) => r.status === "completed").length,
    draft: reports.filter((r) => r.status === "draft").length,
    templates: templates.length,
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-1">
            Generate and manage security assessment reports
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setTemplateDialogOpen(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
          <Button onClick={() => setReportDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Reports</h3>
          <p className="text-3xl font-bold text-foreground">{stats.total}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Completed</h3>
          <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Drafts</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.draft}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Templates</h3>
          <p className="text-3xl font-bold text-muted-foreground">{stats.templates}</p>
        </div>
      </div>

      {/* Reports — grouped by operation */}
      <div className="space-y-3">
        {reportsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border animate-pulse">
                <div className="w-10 h-10 bg-muted rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-20 bg-muted rounded" />
                  <div className="h-8 w-16 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No reports found</p>
            <p className="text-sm text-muted-foreground mb-4">Get started by generating your first report</p>
            <Button onClick={() => setReportDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </div>
        ) : (
          reportGroups.map((group) => (
            <div key={group.key} className="border border-border rounded-lg overflow-hidden">
              {/* Group header */}
              <button
                onClick={() => handleToggleGroup(group.key)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
              >
                {expandedGroups.has(group.key) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-semibold text-sm text-foreground">{group.label}</span>
                <Badge variant="secondary" className="text-xs ml-auto mr-2">
                  {group.reports.length} report{group.reports.length !== 1 ? "s" : ""}
                </Badge>
                {group.key !== "__unassigned__" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportToSysReptor(group.key);
                    }}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    SysReptor
                  </Button>
                )}
              </button>

              {/* Collapsible report rows */}
              {expandedGroups.has(group.key) && (
                <div className="max-h-[350px] overflow-y-auto border-t border-border">
                  <div className="divide-y divide-border">
                    {group.reports.map((report: any) => (
                      <div key={report.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors">
                        <div className="flex items-center flex-1 min-w-0">
                          <div className="w-10 h-10 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-4 flex-shrink-0">
                            <FileText className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-foreground truncate">{report.name}</h3>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-muted-foreground">{report.type}</span>
                              <span className="text-xs text-muted-foreground">&bull;</span>
                              <span className="text-xs text-muted-foreground">{report.format.toUpperCase()}</span>
                              {report.fileSize && (
                                <>
                                  <span className="text-xs text-muted-foreground">&bull;</span>
                                  <span className="text-xs text-muted-foreground">
                                    {(report.fileSize / 1024 / 1024).toFixed(2)} MB
                                  </span>
                                </>
                              )}
                              <span className="text-xs text-muted-foreground">&bull;</span>
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(report.generatedAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              report.status === "completed"
                                ? "bg-green-500/10 text-green-600"
                                : "bg-secondary/10 text-muted-foreground"
                            }`}
                          >
                            {report.status}
                          </Badge>
                          {report.status === "draft" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              onClick={() => handleEditReport(report)}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => handleDownload(report)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteReport(report.id)}
                            disabled={deleting}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Templates Section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Report Templates</h2>
        {templatesLoading ? (
          <p className="text-muted-foreground">Loading templates...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <FileText className="h-5 w-5 text-muted-foreground mr-2" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-foreground">{template.name}</span>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => {
                        setNewReport({ ...newReport, name: `New ${template.name}`, type: template.type });
                        setReportDialogOpen(true);
                      }}>
                        Use
                      </Button>
                      {isAdmin() && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteTemplate(template.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* SysReptor Projects */}
      <div className="mt-8">
        <SysReptorProjectsList />
      </div>

      {/* SysReptor Export Dialog */}
      {sysReptorExportTarget && (
        <SysReptorExportDialog
          open={sysReptorExportOpen}
          onClose={() => {
            setSysReptorExportOpen(false);
            setSysReptorExportTarget(null);
          }}
          operationId={sysReptorExportTarget.operationId}
          operationName={sysReptorExportTarget.operationName}
        />
      )}

      {/* Generate Report Dialog */}
      <GenerateReportDialog
        open={reportDialogOpen}
        onClose={() => setReportDialogOpen(false)}
        onGenerate={handleGenerateReport}
        generating={creating}
      />

      {/* Edit Report Dialog */}
      <EditReportDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingReport(null);
        }}
        report={editingReport}
        onSave={handleSaveReport}
      />

      {/* Create Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                placeholder="Custom Bug Bounty Report"
              />
            </div>
            <div>
              <Label htmlFor="template-description">Description</Label>
              <Input
                id="template-description"
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                placeholder="Template for documenting bug bounty findings"
              />
            </div>
            <div>
              <Label htmlFor="template-type">Template Type</Label>
              <Select value={newTemplate.type} onValueChange={(value) => setNewTemplate({ ...newTemplate, type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vulnerability_assessment">Vulnerability Assessment</SelectItem>
                  <SelectItem value="network_penetration_test">Network Penetration Test</SelectItem>
                  <SelectItem value="web_application_penetration_test">Web Application Penetration Test</SelectItem>
                  <SelectItem value="bug_bounty">Bug Bounty</SelectItem>
                  <SelectItem value="llm_top_10">LLM Top 10</SelectItem>
                  <SelectItem value="sast">SAST</SelectItem>
                  <SelectItem value="operation_summary">Operation Summary</SelectItem>
                  <SelectItem value="executive_summary">Executive Summary</SelectItem>
                  <SelectItem value="technical_analysis">Technical Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="template-format">Format</Label>
              <Select value={newTemplate.format} onValueChange={(value) => setNewTemplate({ ...newTemplate, format: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="docx">DOCX</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTemplate} disabled={creatingTemplate || !newTemplate.name}>
                {creatingTemplate ? "Creating..." : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
