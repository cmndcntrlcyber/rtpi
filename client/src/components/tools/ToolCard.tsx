import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Settings, Trash2 } from "lucide-react";
import { Tool } from "@/services/tools";

interface ToolCardProps {
  tool: Tool;
  onConfigure: (tool: Tool) => void;
  onDelete: (toolId: string) => void;
}

export default function ToolCard({ tool, onConfigure, onDelete }: ToolCardProps) {
  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${tool.name}? This action cannot be undone.`)) {
      onDelete(tool.id);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      reconnaissance: "bg-blue-500/10 text-blue-600",
      exploitation: "bg-red-500/10 text-red-600",
      password_cracking: "bg-purple-500/10 text-purple-600",
      active_directory: "bg-orange-500/10 text-orange-600",
      post_exploitation: "bg-pink-500/10 text-pink-600",
      network_analysis: "bg-cyan-500/10 text-cyan-600",
      web_application: "bg-green-500/10 text-green-600",
      development: "bg-indigo-500/10 text-indigo-600",
      ssl_tls: "bg-yellow-500/10 text-yellow-600",
    };
    return colors[category] || "bg-secondary0/10 text-muted-foreground";
  };

  return (
    <Card className="bg-card hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center flex-1">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center mr-3 flex-shrink-0">
              <Wrench className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{tool.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="secondary"
                  className={`text-xs ${getCategoryColor(tool.category)}`}
                >
                  {tool.category.replace(/_/g, " ")}
                </Badge>
                <Badge
                  variant="secondary"
                  className={`text-xs ${
                    tool.status === "running"
                      ? "bg-green-500/10 text-green-600"
                      : "bg-secondary0/10 text-muted-foreground"
                  }`}
                >
                  {tool.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {tool.description || "No description available"}
        </p>

        {/* Metadata */}
        <div className="space-y-1 mb-4">
          {tool.version && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Version:</span> {tool.version}
            </p>
          )}
          {tool.command && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Command:</span> {tool.command}
            </p>
          )}
          {tool.dockerImage && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Container:</span> {tool.dockerImage}
            </p>
          )}
          {tool.lastUsed && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Last Used:</span>{" "}
              {new Date(tool.lastUsed).toLocaleDateString()}
            </p>
          )}
          {tool.usageCount > 0 && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Usage Count:</span> {tool.usageCount}
            </p>
          )}
          {tool.configPath && (
            <p className="text-xs text-green-600 font-medium">
              ✓ Custom file uploaded
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onConfigure(tool)}
            className="flex-1"
          >
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Configure
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Delete tool"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
