import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ListOrdered, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";

interface QueueStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

interface QueueTask {
  id: string;
  type: string;
  status: string;
  priority: number;
  implantId?: string;
  createdAt: string;
}

export default function TaskQueueView() {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [tasks, setTasks] = useState<QueueTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        api.get<QueueStats>("/rust-nexus/tasks/queue/stats").catch(() => null),
        api.get<{ tasks: QueueTask[] }>("/rust-nexus/tasks/queue/prioritized").catch(() => ({ tasks: [] })),
      ]);
      setStats(s);
      setTasks(t?.tasks || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const retryFailed = async () => {
    setRetrying(true);
    try {
      await api.post("/rust-nexus/tasks/retry-failed", {});
      refresh();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ListOrdered className="h-4 w-4" />
          Task Queue
        </CardTitle>
        <div className="flex items-center gap-1">
          {stats && stats.failed > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={retryFailed} disabled={retrying}>
              <RotateCcw className={`h-3 w-3 mr-1 ${retrying ? "animate-spin" : ""}`} />
              Retry Failed ({stats.failed})
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {stats && (
          <div className="grid grid-cols-5 gap-2 mb-3 text-center text-xs">
            <div><div className="font-bold tabular-nums">{stats.total}</div><div className="text-muted-foreground">Total</div></div>
            <div><div className="font-bold tabular-nums text-blue-500">{stats.pending}</div><div className="text-muted-foreground">Pending</div></div>
            <div><div className="font-bold tabular-nums text-amber-500">{stats.running}</div><div className="text-muted-foreground">Running</div></div>
            <div><div className="font-bold tabular-nums text-green-500">{stats.completed}</div><div className="text-muted-foreground">Done</div></div>
            <div><div className="font-bold tabular-nums text-red-500">{stats.failed}</div><div className="text-muted-foreground">Failed</div></div>
          </div>
        )}

        <div className="space-y-1 max-h-48 overflow-y-auto">
          {tasks.slice(0, 20).map((task) => (
            <div key={task.id} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-muted/50">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] px-1 tabular-nums">P{task.priority}</Badge>
                <span className="truncate max-w-[150px]">{task.type}</span>
              </div>
              <Badge
                variant={task.status === "completed" ? "default" : task.status === "failed" ? "destructive" : "secondary"}
                className="text-[10px]"
              >
                {task.status}
              </Badge>
            </div>
          ))}
          {tasks.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground text-center py-3">Queue empty</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
