import { Bot, Clock, ArrowRight, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface ReporterAgentCardProps {
  agent: {
    id: string;
    name: string;
    status: string;
    config: any;
    latestReport: any;
    lastReportAt: string | null;
  };
  onClick?: (agent: any) => void;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  idle: "secondary",
  running: "default",
  error: "destructive",
  stopped: "outline",
};

export function ReporterAgentCard({ agent, onClick }: ReporterAgentCardProps) {
  const pageRole = agent.config?.pageRole || "unknown";
  const latestReport = agent.latestReport;

  return (
    <div
      className="bg-card p-6 rounded-lg shadow border border-border cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => onClick?.(agent)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Bot className="h-8 w-8 text-purple-600" />
          <div>
            <h3 className="font-semibold">{agent.name}</h3>
            <p className="text-sm text-muted-foreground capitalize">
              {pageRole.replace(/_/g, " ")}
            </p>
          </div>
        </div>
        <Badge variant={statusVariant[agent.status] || "outline"}>{agent.status}</Badge>
      </div>

      {latestReport ? (
        <>
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Last report:{" "}
                {agent.lastReportAt
                  ? formatDistanceToNow(new Date(agent.lastReportAt), { addSuffix: true })
                  : "Never"}
              </span>
            </div>

            <div className="flex gap-4 text-sm">
              {latestReport.changesDetected?.length > 0 && (
                <span className="flex items-center gap-1">
                  <Activity className="h-4 w-4 text-blue-500" />
                  {latestReport.changesDetected.length} changes
                </span>
              )}
              {latestReport.issuesReported?.length > 0 && (
                <span className="flex items-center gap-1">
                  <Activity className="h-4 w-4 text-orange-500" />
                  {latestReport.issuesReported.length} issues
                </span>
              )}
              {latestReport.recommendations?.length > 0 && (
                <span className="flex items-center gap-1">
                  <Activity className="h-4 w-4 text-green-500" />
                  {latestReport.recommendations.length} recommendations
                </span>
              )}
            </div>
          </div>

          {latestReport.activitySummary && (
            <div className="bg-secondary/50 p-3 rounded text-sm mb-4">
              <p className="line-clamp-2">{latestReport.activitySummary}</p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-secondary/30 p-4 rounded text-sm text-muted-foreground mb-4">
          No reports yet
        </div>
      )}

      <Button variant="ghost" size="sm" className="w-full">
        View Full Report <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}
