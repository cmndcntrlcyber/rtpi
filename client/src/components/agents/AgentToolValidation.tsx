import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, AlertCircle, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface ValidationResult {
  isCompatible: boolean;
  errors: string[];
  warnings: string[];
  recommendations?: string[];
}

interface AgentToolValidationProps {
  agentId: string;
  toolId: string;
  agentName?: string;
  toolName?: string;
  onValidated?: (result: ValidationResult) => void;
}

export default function AgentToolValidation({
  agentId,
  toolId,
  agentName,
  toolName,
  onValidated,
}: AgentToolValidationProps) {
  const [validating, setValidating] = useState(true);
  const [result, setResult] = useState<ValidationResult | null>(null);

  useEffect(() => {
    validateAssignment();
  }, [agentId, toolId]);

  const validateAssignment = async () => {
    try {
      setValidating(true);
      const response = await api.post<ValidationResult>("/agent-tool-validation/validate", {
        agentId,
        toolId,
      });

      setResult(response);
      onValidated?.(response);
    } catch (error) {
      console.error("Failed to validate assignment:", error);
      toast.error("Failed to validate agent-tool compatibility");
      setResult({
        isCompatible: false,
        errors: ["Failed to perform validation"],
        warnings: [],
      });
    } finally {
      setValidating(false);
    }
  };

  if (validating) {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
          <p className="text-sm">Validating compatibility...</p>
        </div>
      </Card>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Compatibility Status */}
      <Card className={`p-4 ${result.isCompatible ? "border-green-500" : "border-red-500"} border-2`}>
        <div className="flex items-center gap-3">
          {result.isCompatible ? (
            <CheckCircle className="h-8 w-8 text-green-600" />
          ) : (
            <AlertTriangle className="h-8 w-8 text-red-600" />
          )}
          <div className="flex-1">
            <h3 className="font-semibold text-lg">
              {result.isCompatible ? "Compatible" : "Incompatible"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {result.isCompatible
                ? `${agentName || "Agent"} can execute ${toolName || "this tool"}`
                : `${agentName || "Agent"} cannot execute ${toolName || "this tool"}`}
            </p>
          </div>
          {result.isCompatible ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              ✓ Ready
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
              ✗ Blocked
            </Badge>
          )}
        </div>
      </Card>

      {/* Errors */}
      {result.errors.length > 0 && (
        <Card className="p-4 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                Critical Issues
              </h4>
              <ul className="space-y-1">
                {result.errors.map((error, idx) => (
                  <li key={idx} className="text-sm text-red-800 dark:text-red-200">
                    • {error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <Card className="p-4 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                Warnings
              </h4>
              <ul className="space-y-1">
                {result.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-yellow-800 dark:text-yellow-200">
                    • {warning}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Recommendations */}
      {result.recommendations && result.recommendations.length > 0 && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Recommendations
              </h4>
              <ul className="space-y-1">
                {result.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm text-blue-800 dark:text-blue-200">
                    • {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={validateAssignment}
        >
          Re-validate
        </Button>

        {!result.isCompatible && (
          <p className="text-sm text-muted-foreground">
            Resolve issues above before proceeding
          </p>
        )}
      </div>
    </div>
  );
}
