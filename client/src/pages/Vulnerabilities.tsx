import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import VulnerabilityList from "@/components/vulnerabilities/VulnerabilityList";
import EditVulnerabilityDialog from "@/components/vulnerabilities/EditVulnerabilityDialog";
import { api } from "@/lib/api";

export default function Vulnerabilities() {
  const [vulnerabilities, setVulnerabilities] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedVulnerability, setSelectedVulnerability] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [vulnsRes, targetsRes] = await Promise.all([
        api.get<{ vulnerabilities: any[] }>("/vulnerabilities"),
        api.get<{ targets: any[] }>("/targets"),
      ]);
      setVulnerabilities(vulnsRes.vulnerabilities);
      setTargets(targetsRes.targets);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVulnerability = () => {
    setSelectedVulnerability(null);
    setEditDialogOpen(true);
  };

  const handleSelectVulnerability = (vulnerability: any) => {
    setSelectedVulnerability(vulnerability);
    setEditDialogOpen(true);
  };

  const handleEditVulnerability = (vulnerability: any) => {
    setSelectedVulnerability(vulnerability);
    setEditDialogOpen(true);
  };

  const handleSaveVulnerability = async (vulnerability: any) => {
    try {
      // Only send editable fields (exclude timestamps which cause date conversion errors)
      const payload = {
        title: vulnerability.title,
        description: vulnerability.description,
        severity: vulnerability.severity,
        cvssScore: vulnerability.cvssScore,
        cvssVector: vulnerability.cvssVector,
        cveId: vulnerability.cveId,
        cweId: vulnerability.cweId,
        targetId: vulnerability.targetId,
        operationId: vulnerability.operationId,
        proofOfConcept: vulnerability.proofOfConcept,
        remediation: vulnerability.remediation,
        references: vulnerability.references,
        status: vulnerability.status,
      };

      console.log("Saving vulnerability:", payload);

      if (vulnerability.id) {
        // Update existing
        await api.put(`/vulnerabilities/${vulnerability.id}`, payload);
      } else {
        // Create new
        await api.post("/vulnerabilities", payload);
      }
      setEditDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error("Failed to save vulnerability:", error);
      alert("Failed to save vulnerability");
    }
  };

  const handleDeleteVulnerability = async (id: string) => {
    try {
      await api.delete(`/vulnerabilities/${id}`);
      setEditDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error("Failed to delete vulnerability:", error);
      alert("Failed to delete vulnerability");
    }
  };

  // Calculate stats
  const stats = {
    total: vulnerabilities.length,
    critical: vulnerabilities.filter((v) => v.severity === "critical").length,
    high: vulnerabilities.filter((v) => v.severity === "high").length,
    open: vulnerabilities.filter((v) => v.status === "open").length,
    remediated: vulnerabilities.filter((v) => v.status === "remediated").length,
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Vulnerabilities</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage security vulnerabilities
          </p>
        </div>
        <Button onClick={handleAddVulnerability}>
          <Plus className="h-4 w-4 mr-2" />
          Add Vulnerability
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Total Vulnerabilities
          </h3>
          <p className="text-3xl font-bold text-foreground">{stats.total}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Critical</h3>
          <p className="text-3xl font-bold text-red-600">{stats.critical}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">High</h3>
          <p className="text-3xl font-bold text-orange-600">{stats.high}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Remediated</h3>
          <p className="text-3xl font-bold text-green-600">{stats.remediated}</p>
        </div>
      </div>

      {/* Vulnerabilities List */}
      <VulnerabilityList
        vulnerabilities={vulnerabilities}
        loading={loading}
        onSelect={handleSelectVulnerability}
        onEdit={handleEditVulnerability}
        onDelete={(v) => handleDeleteVulnerability(v.id)}
      />

      {/* Edit Dialog */}
      <EditVulnerabilityDialog
        open={editDialogOpen}
        vulnerability={selectedVulnerability}
        targets={targets}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleSaveVulnerability}
        onDelete={handleDeleteVulnerability}
      />
    </div>
  );
}
