/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Plus, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";

interface LinkedVulnerabilitiesProps {
  targetId?: string;
  onViewAll?: () => void;
  onAddNew?: () => void;
}

export default function LinkedVulnerabilities({
  targetId,
  onViewAll,
  onAddNew,
}: LinkedVulnerabilitiesProps) {
  const [vulnerabilities, setVulnerabilities] = useState<any[]>([]);

  const loadVulnerabilities = async () => {
    if (!targetId) return;

    try {
      const response = await api.get<{ vulnerabilities: any[] }>("/vulnerabilities");
      // Filter vulnerabilities for this target
      const filtered = response.vulnerabilities.filter(
        (v) => v.targetId === targetId
      );
      setVulnerabilities(filtered);
    } catch (error) {
      console.error("Failed to load vulnerabilities:", error);
    }
  };

  useEffect(() => {
    if (targetId) {
      loadVulnerabilities();
    }
  }, [targetId, loadVulnerabilities]);

  // Calculate severity counts
  const counts = {
    critical: vulnerabilities.filter((v) => v.severity === "critical").length,
    high: vulnerabilities.filter((v) => v.severity === "high").length,
    medium: vulnerabilities.filter((v) => v.severity === "medium").length,
    low: vulnerabilities.filter((v) => v.severity === "low").length,
  };

  const total = vulnerabilities.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4" />
          Linked Vulnerabilities
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Severity Breakdown */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-gray-700">
            {total} Total:
          </span>
          {counts.critical > 0 && (
            <Badge className="bg-red-600 text-white px-2 py-1">
              🔴 {counts.critical} Critical
            </Badge>
          )}
          {counts.high > 0 && (
            <Badge className="bg-orange-500 text-white px-2 py-1">
              🟠 {counts.high} High
            </Badge>
          )}
          {counts.medium > 0 && (
            <Badge className="bg-yellow-500 text-white px-2 py-1">
              🟡 {counts.medium} Medium
            </Badge>
          )}
          {counts.low > 0 && (
            <Badge className="bg-blue-500 text-white px-2 py-1">
              🔵 {counts.low} Low
            </Badge>
          )}
          {total === 0 && (
            <span className="text-sm text-gray-500">No vulnerabilities linked</span>
          )}
        </div>

        {/* Recent Vulnerabilities List */}
        {total > 0 && (
          <div className="space-y-2">
            {vulnerabilities.slice(0, 3).map((vuln) => (
              <div
                key={vuln.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm text-gray-900 truncate">{vuln.title}</span>
                </div>
                <Badge
                  className={`px-2 py-0.5 text-xs ${
                    vuln.severity === "critical"
                      ? "bg-red-600 text-white"
                      : vuln.severity === "high"
                      ? "bg-orange-500 text-white"
                      : vuln.severity === "medium"
                      ? "bg-yellow-500 text-white"
                      : "bg-blue-500 text-white"
                  }`}
                >
                  {vuln.severity.toUpperCase()}
                </Badge>
              </div>
            ))}
            {total > 3 && (
              <p className="text-xs text-gray-500 italic">
                + {total - 3} more vulnerabilities
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {total > 0 && onViewAll && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onViewAll}
              className="flex-1"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View All
            </Button>
          )}
          {onAddNew && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddNew}
              className="flex-1"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Vulnerability
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
