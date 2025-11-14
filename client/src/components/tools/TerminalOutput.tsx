import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Terminal, Copy, Download } from "lucide-react";

interface TerminalOutputProps {
  output: string;
  title?: string;
  isExecuting?: boolean;
}

export default function TerminalOutput({ 
  output, 
  title = "Execution Output",
  isExecuting = false 
}: TerminalOutputProps) {
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    alert("Output copied to clipboard!");
  };

  const handleDownload = () => {
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metasploit-output-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-green-400">
            <Terminal className="h-4 w-4" />
            {title}
            {isExecuting && (
              <span className="text-xs text-yellow-400 animate-pulse">
                Executing...
              </span>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              disabled={!output}
              className="text-gray-400 hover:text-gray-200"
              title="Copy to clipboard"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDownload}
              disabled={!output}
              className="text-gray-400 hover:text-gray-200"
              title="Download output"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={outputRef}
          className="bg-black rounded-md p-4 h-96 overflow-y-auto font-mono text-sm text-green-400 whitespace-pre-wrap"
          style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
        >
          {output || (
            <span className="text-gray-600">
              {isExecuting 
                ? "Waiting for output..." 
                : "No output yet. Execute a module to see results."}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
