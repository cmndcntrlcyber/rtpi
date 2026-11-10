import { useRef, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Terminal } from "lucide-react";
import { useNexusKaliLogs } from "@/hooks/useNexusKali";

const LINE_OPTIONS = [50, 100, 500] as const;

function classifyLine(line: string): string {
  if (/\bERROR\b/i.test(line)) return "text-red-400";
  if (/\bWARN(ING)?\b/i.test(line)) return "text-amber-400";
  if (/\bINFO\b/i.test(line)) return "text-blue-400";
  if (/\bDEBUG\b/i.test(line)) return "text-muted-foreground";
  return "";
}

export default function NexusKaliLogsPanel() {
  const [lineCount, setLineCount] = useState<number>(100);
  const { logs, loading, refresh } = useNexusKaliLogs(lineCount);
  const scrollRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          Container Logs
        </CardTitle>
        <div className="flex items-center gap-1">
          {LINE_OPTIONS.map((n) => (
            <Button
              key={n}
              variant={lineCount === n ? "secondary" : "ghost"}
              size="sm"
              className="h-5 px-1.5 text-[10px]"
              onClick={() => setLineCount(n)}
            >
              {n}
            </Button>
          ))}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No logs available.</p>
        ) : (
          <pre
            ref={scrollRef}
            className="text-[11px] leading-4 font-mono bg-muted/30 rounded p-2 max-h-64 overflow-auto"
          >
            {logs.map((line, i) => (
              <div key={i} className={classifyLine(line)}>
                {line}
              </div>
            ))}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
