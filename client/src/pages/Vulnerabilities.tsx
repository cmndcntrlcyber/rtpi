import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import VulnerabilityList from "@/components/vulnerabilities/VulnerabilityList";

export default function Vulnerabilities() {
  // Mock data for now - will connect to API in next iteration
  const vulnerabilities = [
    {
      id: "1",
      title: "SQL Injection in Login Form",
      description: "User input not properly sanitized, allowing SQL injection attacks",
      severity: "critical",
      cvss: 9.8,
      cve: "CVE-2024-12345",
      status: "open",
      targetId: "1",
      operationId: "1",
      discoveredAt: "2025-01-15T10:00:00Z",
    },
    {
      id: "2",
      title: "Cross-Site Scripting (XSS)",
      description: "Stored XSS vulnerability in user comments section",
      severity: "high",
      cvss: 7.5,
      cve: "CVE-2024-12346",
      status: "investigating",
      targetId: "1",
      operationId: "1",
      discoveredAt: "2025-01-14T14:30:00Z",
    },
    {
      id: "3",
      title: "Weak Password Policy",
      description: "System allows weak passwords without complexity requirements",
      severity: "medium",
      cvss: 5.3,
      status: "open",
      targetId: "2",
      operationId: "2",
      discoveredAt: "2025-01-10T09:00:00Z",
    },
    {
      id: "4",
      title: "Outdated TLS Version",
      description: "Server supports TLS 1.0, which is deprecated and insecure",
      severity: "high",
      cvss: 7.4,
      status: "remediated",
      targetId: "3",
      operationId: "3",
      discoveredAt: "2024-12-20T11:00:00Z",
      remediatedAt: "2025-01-05T16:00:00Z",
    },
  ];

  const loading = false;

  const handleAddVulnerability = () => {
    console.log("Add vulnerability clicked");
  };

  const handleSelectVulnerability = (vulnerability: any) => {
    console.log("Selected vulnerability:", vulnerability);
  };

  const handleEditVulnerability = (vulnerability: any) => {
    console.log("Edit vulnerability:", vulnerability);
  };

  const handleDeleteVulnerability = (vulnerability: any) => {
    console.log("Delete vulnerability:", vulnerability);
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
          <h1 className="text-3xl font-bold text-gray-900">Vulnerabilities</h1>
          <p className="text-gray-600 mt-1">
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
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            Total Vulnerabilities
          </h3>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Critical</h3>
          <p className="text-3xl font-bold text-red-600">{stats.critical}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">High</h3>
          <p className="text-3xl font-bold text-orange-600">{stats.high}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Remediated</h3>
          <p className="text-3xl font-bold text-green-600">{stats.remediated}</p>
        </div>
      </div>

      {/* Vulnerabilities List */}
      <VulnerabilityList
        vulnerabilities={vulnerabilities}
        loading={loading}
        onSelect={handleSelectVulnerability}
        onEdit={handleEditVulnerability}
        onDelete={handleDeleteVulnerability}
      />
    </div>
  );
}
