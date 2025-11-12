import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import TargetList from "@/components/targets/TargetList";
import EditTargetDialog from "@/components/targets/EditTargetDialog";
import { api } from "@/lib/api";

export default function Targets() {
  const [, navigate] = useLocation();
  const [targets, setTargets] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [targetsRes, operationsRes] = await Promise.all([
        api.get<{ targets: any[] }>("/targets"),
        api.get<{ operations: any[] }>("/operations"),
      ]);
      setTargets(targetsRes.targets);
      setOperations(operationsRes.operations);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTarget = () => {
    setSelectedTarget(null);
    setEditDialogOpen(true);
  };

  const handleSelectTarget = (target: any) => {
    setSelectedTarget(target);
    setEditDialogOpen(true);
  };

  const handleEditTarget = (target: any) => {
    setSelectedTarget(target);
    setEditDialogOpen(true);
  };

  const handleSaveTarget = async (target: any) => {
    try {
      if (target.id) {
        // Update existing
        await api.put(`/targets/${target.id}`, target);
      } else {
        // Create new
        await api.post("/targets", target);
      }
      setEditDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error("Failed to save target:", error);
      alert("Failed to save target");
    }
  };

  const handleDeleteTarget = async (id: string) => {
    try {
      await api.delete(`/targets/${id}`);
      setEditDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error("Failed to delete target:", error);
      alert("Failed to delete target");
    }
  };

  const handleScanTarget = (target: any) => {
    console.log("Scan target:", target);
    // TODO: Implement scan functionality in future
    alert(`Scan functionality for ${target.name} will be implemented in future updates`);
  };

  const handleViewVulnerabilities = (targetId: string) => {
    // Navigate to vulnerabilities page
    // TODO: Add filtering support in vulnerabilities page
    setEditDialogOpen(false);
    navigate("/vulnerabilities");
  };

  const handleAddVulnerability = (targetId: string) => {
    // This would ideally open the vulnerability dialog with targetId pre-filled
    // For now, navigate to vulnerabilities page
    setEditDialogOpen(false);
    navigate("/vulnerabilities");
    // TODO: Pass targetId to vulnerabilities page to pre-fill in add dialog
  };

  // Calculate stats
  const stats = {
    total: targets.length,
    active: targets.filter((t) => t.status === "active").length,
    scanning: targets.filter((t) => t.status === "scanning").length,
    vulnerable: targets.filter((t) => t.status === "vulnerable").length,
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Targets</h1>
          <p className="text-gray-600 mt-1">
            Manage target systems and infrastructure
          </p>
        </div>
        <Button onClick={handleAddTarget}>
          <Plus className="h-4 w-4 mr-2" />
          Add Target
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Targets</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Active</h3>
          <p className="text-3xl font-bold text-green-600">{stats.active}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Scanning</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.scanning}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Vulnerable</h3>
          <p className="text-3xl font-bold text-red-600">{stats.vulnerable}</p>
        </div>
      </div>

      {/* Targets List */}
      <TargetList
        targets={targets}
        loading={loading}
        onSelect={handleSelectTarget}
        onEdit={handleEditTarget}
        onDelete={(t) => handleDeleteTarget(t.id)}
        onScan={handleScanTarget}
      />

      {/* Edit Dialog */}
      <EditTargetDialog
        open={editDialogOpen}
        target={selectedTarget}
        operations={operations}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleSaveTarget}
        onDelete={handleDeleteTarget}
        onViewVulnerabilities={handleViewVulnerabilities}
        onAddVulnerability={handleAddVulnerability}
      />
    </div>
  );
}
