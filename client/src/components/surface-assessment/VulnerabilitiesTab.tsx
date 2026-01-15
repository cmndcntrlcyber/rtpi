import { useState, useEffect } from 'react';
import { toast } from "sonner";
import { api } from '@/lib/api';
import VulnerabilityFilters from './VulnerabilityFilters';
import VulnerabilityBulkActions from './VulnerabilityBulkActions';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface VulnerabilitiesTabProps {
  operationId: string;
}

interface Vulnerability {
  id: string;
  title: string;
  description: string;
  severity: string;
  cvssScore?: number;
  cveId?: string;
  status: string;
  discoveredAt: string;
  targetId?: string;
}

export default function VulnerabilitiesTab({ operationId }: VulnerabilitiesTabProps) {
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [filteredVulns, setFilteredVulns] = useState<Vulnerability[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  
  const [filters, setFilters] = useState({
    severity: [] as string[],
    status: [] as string[],
    search: '',
    assetId: undefined as string | undefined,
  });

  useEffect(() => {
    if (operationId) {
      loadVulnerabilities();
    }
  }, [operationId]);

  useEffect(() => {
    applyFilters();
  }, [vulnerabilities, filters]);

  const loadVulnerabilities = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ vulnerabilities: Vulnerability[] }>(`/vulnerabilities?operationId=${operationId}`);
      setVulnerabilities(response.vulnerabilities || []);
    } catch (error) {
      console.error('Failed to load vulnerabilities:', error);
      setVulnerabilities([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...vulnerabilities];

    // Filter by severity
    if (filters.severity.length > 0) {
      filtered = filtered.filter(v => filters.severity.includes(v.severity));
    }

    // Filter by status
    if (filters.status.length > 0) {
      filtered = filtered.filter(v => filters.status.includes(v.status));
    }

    // Filter by search term
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(v =>
        v.title.toLowerCase().includes(search) ||
        v.description.toLowerCase().includes(search) ||
        v.cveId?.toLowerCase().includes(search)
      );
    }

    // Filter by asset
    if (filters.assetId) {
      filtered = filtered.filter(v => v.targetId === filters.assetId);
    }

    setFilteredVulns(filtered);
    setPage(1); // Reset to first page when filters change
  };

  const handleSelectAll = () => {
    const currentPage = paginatedVulns;
    const newSelected = new Set(selected);
    currentPage.forEach(v => newSelected.add(v.id));
    setSelected(newSelected);
  };

  const handleSelectNone = () => {
    setSelected(new Set());
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const handleBulkStatusChange = async (status: string) => {
    try {
      const selectedIds = Array.from(selected);
      await Promise.all(
        selectedIds.map(id =>
          api.put(`/vulnerabilities/${id}`, { status })
        )
      );
      await loadVulnerabilities();
      setSelected(new Set());
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error("Failed to update vulnerability status");
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    const selectedVulns = vulnerabilities.filter(v => selected.has(v.id));
    const dataToExport = selectedVulns.length > 0 ? selectedVulns : filteredVulns;

    if (format === 'json') {
      const dataStr = JSON.stringify(dataToExport, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vulnerabilities-${operationId}-${Date.now()}.json`;
      link.click();
    } else if (format === 'csv') {
      const headers = ['Title', 'Severity', 'Status', 'CVE ID', 'CVSS Score', 'Discovered At'];
      const rows = dataToExport.map(v => [
        v.title,
        v.severity,
        v.status,
        v.cveId || '',
        v.cvssScore?.toString() || '',
        new Date(v.discoveredAt).toLocaleDateString()
      ]);
      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const dataBlob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vulnerabilities-${operationId}-${Date.now()}.csv`;
      link.click();
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-600 text-white',
      high: 'bg-orange-600 text-white',
      medium: 'bg-yellow-600 text-white',
      low: 'bg-green-600 text-white',
      informational: 'bg-blue-600 text-white',
    };
    return colors[severity] || 'bg-gray-600 text-white';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-red-100 text-red-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      fixed: 'bg-green-100 text-green-800',
      false_positive: 'bg-secondary text-foreground',
      accepted_risk: 'bg-purple-100 text-purple-800',
    };
    return colors[status] || 'bg-secondary text-foreground';
  };

  // Pagination
  const totalPages = Math.ceil(filteredVulns.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedVulns = filteredVulns.slice(startIndex, endIndex);

  if (!operationId) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-8">
        <div className="text-center text-muted-foreground">
          Please select an operation to view vulnerabilities
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-muted-foreground">Loading vulnerabilities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <VulnerabilityFilters filters={filters} onFilterChange={setFilters} />

      {/* Bulk Actions */}
      <VulnerabilityBulkActions
        selectedCount={selected.size}
        totalCount={paginatedVulns.length}
        onSelectAll={handleSelectAll}
        onSelectNone={handleSelectNone}
        onStatusChange={handleBulkStatusChange}
        onExport={handleExport}
      />

      {/* Vulnerabilities Table */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        {paginatedVulns.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {vulnerabilities.length === 0 ? 'No vulnerabilities found' : 'No vulnerabilities match the current filters'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-secondary">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={paginatedVulns.every(v => selected.has(v.id))}
                      onChange={() => {
                        if (paginatedVulns.every(v => selected.has(v.id))) {
                          handleSelectNone();
                        } else {
                          handleSelectAll();
                        }
                      }}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    CVE ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Discovered
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-gray-200">
                {paginatedVulns.map((vuln) => (
                  <tr
                    key={vuln.id}
                    className="hover:bg-secondary cursor-pointer"
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selected.has(vuln.id)}
                        onChange={() => handleToggleSelect(vuln.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-foreground">{vuln.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{vuln.description}</div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge className={getSeverityColor(vuln.severity)}>
                        {vuln.severity}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge className={getStatusColor(vuln.status)}>
                        {vuln.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-foreground">
                      {vuln.cveId || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {new Date(vuln.discoveredAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredVulns.length)} of {filteredVulns.length} vulnerabilities
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
