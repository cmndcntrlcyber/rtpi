import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Plus, Calendar } from "lucide-react";
import { useReports, useReportTemplates, useCreateReport, useCreateTemplate, useDeleteReport } from "@/hooks/useReports";

export default function Reports() {
  const { reports, loading: reportsLoading, refetch: refetchReports } = useReports();
  const { templates, loading: templatesLoading, refetch: refetchTemplates } = useReportTemplates();
  const { create: createReport, creating } = useCreateReport();
  const { create: createTemplate, creating: creatingTemplate } = useCreateTemplate();
  const { delete: deleteReport, deleting } = useDeleteReport();

  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
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

  const handleGenerateReport = async () => {
    try {
      await createReport(newReport);
      await refetchReports();
      setReportDialogOpen(false);
      setNewReport({ name: "", type: "operation_summary", format: "pdf" });
    } catch (err) {
      console.error("Failed to generate report:", err);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      // Default bug bounty template structure
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
      console.error("Failed to create template:", err);
    }
  };

  const handleDownload = (report: any) => {
    // In a real implementation, this would download the actual file
    console.log("Download report:", report.name);
    alert(`Download functionality for: ${report.name}\nFile path: ${report.filePath || "Not yet generated"}`);
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Are you sure you want to delete this report?")) {
      return;
    }

    try {
      await deleteReport(reportId);
      await refetchReports();
    } catch (err) {
      console.error("Failed to delete report:", err);
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
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">
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
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Reports</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Completed</h3>
          <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Drafts</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.draft}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Templates</h3>
          <p className="text-3xl font-bold text-gray-600">{stats.templates}</p>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Recent Reports</h2>
        {reportsLoading ? (
          <p className="text-gray-500">Loading reports...</p>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No reports found</p>
            <p className="text-sm text-gray-500 mb-4">Get started by generating your first report</p>
            <Button onClick={() => setReportDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {reports.map((report) => (
              <Card key={report.id} className="bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center mr-4">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{report.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-gray-500">{report.type}</span>
                          <span className="text-sm text-gray-400">•</span>
                          <span className="text-sm text-gray-500">{report.format.toUpperCase()}</span>
                          {report.fileSize && (
                            <>
                              <span className="text-sm text-gray-400">•</span>
                              <span className="text-sm text-gray-500">
                                {(report.fileSize / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </>
                          )}
                          <span className="text-sm text-gray-400">•</span>
                          <div className="flex items-center text-sm text-gray-500">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(report.generatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className={`${
                          report.status === "completed"
                            ? "bg-green-500/10 text-green-600"
                            : "bg-gray-500/10 text-gray-600"
                        }`}
                      >
                        {report.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(report)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteReport(report.id)}
                        disabled={deleting}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Templates Section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Report Templates</h2>
        {templatesLoading ? (
          <p className="text-gray-500">Loading templates...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <FileText className="h-5 w-5 text-gray-400 mr-2" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900">{template.name}</span>
                        {template.description && (
                          <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setNewReport({ ...newReport, name: `New ${template.name}`, type: template.type });
                      setReportDialogOpen(true);
                    }}>
                      Use
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Generate Report Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate New Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="report-name">Report Name</Label>
              <Input
                id="report-name"
                value={newReport.name}
                onChange={(e) => setNewReport({ ...newReport, name: e.target.value })}
                placeholder="Q1 2025 Security Assessment"
              />
            </div>
            <div>
              <Label htmlFor="report-type">Report Type</Label>
              <Select value={newReport.type} onValueChange={(value) => setNewReport({ ...newReport, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operation_summary">Operation Summary</SelectItem>
                  <SelectItem value="vulnerability_assessment">Vulnerability Assessment</SelectItem>
                  <SelectItem value="penetration_test">Penetration Test Report</SelectItem>
                  <SelectItem value="bug_bounty">Bug Bounty Report</SelectItem>
                  <SelectItem value="executive_summary">Executive Summary</SelectItem>
                  <SelectItem value="technical_analysis">Technical Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="report-format">Format</Label>
              <Select value={newReport.format} onValueChange={(value) => setNewReport({ ...newReport, format: value })}>
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
              <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerateReport} disabled={creating || !newReport.name}>
                {creating ? "Generating..." : "Generate Report"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operation_summary">Operation Summary</SelectItem>
                  <SelectItem value="vulnerability_assessment">Vulnerability Assessment</SelectItem>
                  <SelectItem value="penetration_test">Penetration Test</SelectItem>
                  <SelectItem value="bug_bounty">Bug Bounty Report</SelectItem>
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
