import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import TargetList from "@/components/targets/TargetList";

export default function Targets() {
  // Mock data for now - will connect to API in next iteration
  const targets = [
    {
      id: "1",
      hostname: "web-server-01",
      ipAddress: "192.168.1.100",
      domain: "example.com",
      port: 443,
      status: "active",
      operationId: "1",
      lastScanAt: "2025-01-15T10:00:00Z",
    },
    {
      id: "2",
      hostname: "db-server",
      ipAddress: "192.168.1.101",
      port: 5432,
      status: "active",
      operationId: "1",
      lastScanAt: "2025-01-14T15:30:00Z",
    },
    {
      id: "3",
      ipAddress: "10.0.0.50",
      domain: "api.client.com",
      port: 8080,
      status: "vulnerable",
      operationId: "2",
      notes: "Unpatched web server - critical vulnerabilities detected",
      lastScanAt: "2025-01-10T09:00:00Z",
    },
  ];

  const loading = false;

  const handleAddTarget = () => {
    console.log("Add target clicked");
  };

  const handleSelectTarget = (target: any) => {
    console.log("Selected target:", target);
  };

  const handleEditTarget = (target: any) => {
    console.log("Edit target:", target);
  };

  const handleDeleteTarget = (target: any) => {
    console.log("Delete target:", target);
  };

  const handleScanTarget = (target: any) => {
    console.log("Scan target:", target);
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
        onDelete={handleDeleteTarget}
        onScan={handleScanTarget}
      />
    </div>
  );
}
