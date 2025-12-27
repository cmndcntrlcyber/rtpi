import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, Activity, ListTodo, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { ImplantStats } from "./ImplantsTab";

interface ImplantStatsCardsProps {
  stats: ImplantStats;
}

export default function ImplantStatsCards({ stats }: ImplantStatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Implants */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Implants</CardTitle>
          <Cpu className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.implants.total}</div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-green-600" />
              {stats.implants.connected + stats.implants.idle + stats.implants.busy} active
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-gray-400" />
              {stats.implants.disconnected} offline
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Connected */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Connected</CardTitle>
          <Activity className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.implants.connected}</div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>Idle: {stats.implants.idle}</span>
            <span>Busy: {stats.implants.busy}</span>
          </div>
        </CardContent>
      </Card>

      {/* Active Tasks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
          <ListTodo className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.tasks.queued + stats.tasks.running}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {stats.tasks.queued} queued
            </span>
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-blue-600" />
              {stats.tasks.running} running
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Task Success Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Task Success</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.tasks.total > 0
              ? Math.round((stats.tasks.completed / stats.tasks.total) * 100)
              : 0}
            %
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              {stats.tasks.completed}
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <XCircle className="h-3 w-3" />
              {stats.tasks.failed}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
