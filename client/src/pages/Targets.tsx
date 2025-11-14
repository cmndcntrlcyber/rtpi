import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import TargetList from "@/components/targets/TargetList";
import EditTargetDialog from "@/components/targets/EditTargetDialog";
import { api } from "@/lib/api";

export default function Targets() {
  const [, navigate] = useLocation();
  const [targets, setTargets] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  const [loopDialogOpen, setLoopDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [runningLoop, setRunningLoop] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [targetsRes, operationsRes, agentsRes] = await Promise.all([
        api.get<{ targets: any[] }>("/targets"),
        api.get<{ operations: any[] }>("/operations"),
        api.get<{ agents: any[] }>("/agents"),
      ]);
      setTargets(targetsRes.targets);
      setOperations(operationsRes.operations);
      setAgents(agentsRes.agents || []);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAgentLoop = (target: any) => {
    setSelectedTarget(target);
    setLoopDialogOpen(true);
  };

  const handleExecuteLoop = async () => {
    if (!selectedAgent || !selectedTarget) return;

    setRunningLoop(true);
    try {
      await api.post("/agent-loops/start", {
        agentId: selectedAgent,
        targetId: selectedTarget.id,
        initialInput: `Analyze target ${selectedTarget.name} (${selectedTarget.value}) for security vulnerabilities`,
      });
      
      alert(`Agent loop started successfully for target: ${selectedTarget.name}`);
      setLoopDialogOpen(false);
      setSelectedAgent("");
    } catch (error) {
      console.error("Failed to start agent loop:", error);
      alert("Failed to start agent loop");
    } finally {
      setRunningLoop(false);
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

  const handleScanTarget = async (target: any) => {
    if (!confirm(`Start nmap scan on ${target.name} (${target.value})?\n\nThis will scan all 65535 ports and may take several minutes.`)) {
      return;
    }

    try {
      console.log("Starting scan for target:", target);
      
      // Show loading state
      const loadingAlert = `Scanning ${target.name}...\nThis may take up to 10 minutes for a full port scan.`;
      alert(loadingAlert);

      // Call scan API
      const response = await api.post(`/targets/${target.id}/scan`);
      
      // Show results
      const { openPorts, scanDuration, scanOutput } = response;
      const durationSeconds = (scanDuration / 1000).toFixed(2);
      
      alert(
        `Scan Completed!\n\n` +
        `Target: ${target.name}\n` +
        `Duration: ${durationSeconds} seconds\n` +
        `Open Ports Found: ${openPorts}\n\n` +
        `Full scan results have been saved to the target metadata.\n` +
        `Check the target details to view the complete nmap output.`
      );

      // Refresh targets to show updated data
      await loadData();
    } catch (error: any) {
      console.error("Scan failed:", error);
      const errorMsg = error.response?.data?.details || error.message || "Unknown error";
      alert(`Scan failed: ${errorMsg}`);
    }
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
        onRunAgentLoop={handleRunAgentLoop}
      />

      {/* Agent Loop Dialog */}
      <Dialog open={loopDialogOpen} onOpenChange={setLoopDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-blue-600" />
              Run Agent Loop
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Target</Label>
              <p className="text-sm text-gray-600 mt-1">
                {selectedTarget?.name} ({selectedTarget?.type}: {selectedTarget?.value})
              </p>
            </div>

            <div>
              <Label htmlFor="agent-select">Select Agent</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger id="agent-select">
                  <SelectValue placeholder="Choose an agent with loop enabled" />
                </SelectTrigger>
                <SelectContent>
                  {agents
                    .filter((a) => a.config?.loopEnabled)
                    .map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name} ({agent.type})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {agents.filter((a) => a.config?.loopEnabled).length === 0 && (
                <p className="text-sm text-amber-600 mt-2">
                  No agents with loop configuration found. Please configure an agent first.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLoopDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleExecuteLoop} 
              disabled={!selectedAgent || runningLoop}
            >
              {runningLoop ? "Starting..." : "Start Agent Loop"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
