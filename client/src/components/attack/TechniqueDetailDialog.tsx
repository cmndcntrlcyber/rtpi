import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Shield, Target, Database, BookOpen } from "lucide-react";
import type { Technique } from "@shared/types/attack";

interface TechniqueDetailDialogProps {
  technique: Technique | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TechniqueDetailDialog({
  technique,
  open,
  onOpenChange,
}: TechniqueDetailDialogProps) {
  if (!technique) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <Shield className="h-6 w-6 text-primary" />
                {technique.attackId}
              </DialogTitle>
              <DialogDescription className="text-lg mt-2">
                {technique.name}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  window.open(
                    `https://attack.mitre.org/techniques/${technique.attackId}/`,
                    "_blank"
                  )
                }
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View on MITRE
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Status Badges */}
          <div className="flex gap-2 flex-wrap">
            {technique.isSubtechnique && (
              <Badge variant="outline">Sub-technique</Badge>
            )}
            {technique.deprecated && (
              <Badge variant="destructive">Deprecated</Badge>
            )}
            {technique.revoked && <Badge variant="destructive">Revoked</Badge>}
            {!technique.deprecated && !technique.revoked && (
              <Badge variant="default" className="bg-green-600">
                Active
              </Badge>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="platforms">Platforms</TabsTrigger>
              <TabsTrigger value="tactics">Tactics</TabsTrigger>
              <TabsTrigger value="metadata">Metadata</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div>
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Description
                </h3>
                <p className="text-foreground leading-relaxed">
                  {technique.description ||
                    "No description available for this technique."}
                </p>
              </div>

              {technique.dataSources && technique.dataSources.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Data Sources
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {technique.dataSources.map((source, idx) => (
                      <Badge key={idx} variant="secondary">
                        {source}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="platforms" className="space-y-4 mt-4">
              <div>
                <h3 className="font-semibold text-lg mb-3">
                  Target Platforms
                </h3>
                {technique.platforms && technique.platforms.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {technique.platforms.map((platform, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-3 bg-secondary rounded-lg border border-border"
                      >
                        <Target className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">{platform}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">
                    No platform information available
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="tactics" className="space-y-4 mt-4">
              <div>
                <h3 className="font-semibold text-lg mb-3">
                  Kill Chain Phases (Tactics)
                </h3>
                {technique.killChainPhases &&
                technique.killChainPhases.length > 0 ? (
                  <div className="space-y-2">
                    {technique.killChainPhases.map((phase, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200"
                      >
                        <div className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full font-bold text-sm">
                          {idx + 1}
                        </div>
                        <span className="font-medium capitalize">
                          {phase.replace(/-/g, " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">
                    No tactic information available
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="metadata" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-secondary rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground mb-1">ATT&CK ID</p>
                  <p className="font-mono font-semibold">
                    {technique.attackId}
                  </p>
                </div>

                {technique.version && (
                  <div className="p-4 bg-secondary rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground mb-1">Version</p>
                    <p className="font-semibold">{technique.version}</p>
                  </div>
                )}

                {technique.created && (
                  <div className="p-4 bg-secondary rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground mb-1">Created</p>
                    <p className="font-semibold">
                      {new Date(technique.created).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {technique.modified && (
                  <div className="p-4 bg-secondary rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground mb-1">
                      Last Modified
                    </p>
                    <p className="font-semibold">
                      {new Date(technique.modified).toLocaleDateString()}
                    </p>
                  </div>
                )}

                <div className="p-4 bg-secondary rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground mb-1">Type</p>
                  <p className="font-semibold">
                    {technique.isSubtechnique
                      ? "Sub-technique"
                      : "Technique"}
                  </p>
                </div>

                <div className="p-4 bg-secondary rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <p className="font-semibold">
                    {technique.deprecated
                      ? "Deprecated"
                      : technique.revoked
                      ? "Revoked"
                      : "Active"}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
