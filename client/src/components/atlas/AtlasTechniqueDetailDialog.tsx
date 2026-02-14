import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, ExternalLink } from "lucide-react";

interface AtlasTechnique {
  id: string;
  atlasId: string;
  name: string;
  description: string | null;
  isSubtechnique: boolean;
  platforms: string[] | null;
  killChainPhases: string[] | null;
  deprecated: boolean;
  revoked: boolean;
  caseStudies?: string[] | null;
  detectionMethods?: string[] | null;
  mitigationStrategies?: string[] | null;
}

interface AtlasTechniqueDetailDialogProps {
  technique: AtlasTechnique | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AtlasTechniqueDetailDialog({
  technique,
  open,
  onOpenChange,
}: AtlasTechniqueDetailDialogProps) {
  if (!technique) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <Badge variant="outline" className="font-mono">
              {technique.atlasId}
            </Badge>
            {technique.isSubtechnique && (
              <Badge variant="secondary" className="text-xs">
                Sub-technique
              </Badge>
            )}
            {technique.deprecated && (
              <Badge variant="destructive" className="text-xs">
                Deprecated
              </Badge>
            )}
          </div>
          <DialogTitle className="text-xl">{technique.name}</DialogTitle>
          <DialogDescription>MITRE ATLAS Technique Details</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Description */}
          {technique.description && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Description</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {technique.description}
              </p>
            </div>
          )}

          {/* Platforms */}
          {technique.platforms && technique.platforms.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Platforms</h4>
              <div className="flex flex-wrap gap-2">
                {technique.platforms.map((platform) => (
                  <Badge key={platform} variant="secondary">
                    {platform}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Tactics */}
          {technique.killChainPhases && technique.killChainPhases.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Tactics</h4>
              <div className="flex flex-wrap gap-2">
                {technique.killChainPhases.map((phase) => (
                  <Badge key={phase} variant="outline">
                    {phase.replace(/-/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Detection Methods */}
          {technique.detectionMethods && technique.detectionMethods.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Detection Methods</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {technique.detectionMethods.map((method, idx) => (
                  <li key={idx}>{method}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Mitigation Strategies */}
          {technique.mitigationStrategies && technique.mitigationStrategies.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Mitigation Strategies</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {technique.mitigationStrategies.map((strategy, idx) => (
                  <li key={idx}>{strategy}</li>
                ))}
              </ul>
            </div>
          )}

          {/* External Link */}
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(
                  `https://atlas.mitre.org/techniques/${technique.atlasId}`,
                  "_blank"
                )
              }
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View on MITRE ATLAS
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
