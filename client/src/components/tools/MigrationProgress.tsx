import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { type PythonToolAnalysis, type MigrationOptions } from "@/services/tool-migration";
import {
  Play,
  Package,
  TestTube2,
  Database,
  FileCode,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface MigrationProgressProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: PythonToolAnalysis;
  onConfirm: (options: MigrationOptions) => void;
  isLoading: boolean;
}

export function MigrationProgress({
  open,
  onOpenChange,
  tool,
  onConfirm,
  isLoading,
}: MigrationProgressProps) {
  const [options, setOptions] = useState<MigrationOptions>({
    installDependencies: true,
    runTests: tool.hasTests,
    registerInDatabase: true,
    generateWrapper: true,
    overwriteExisting: false,
  });

  const handleConfirm = () => {
    onConfirm(options);
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'very-high':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-secondary text-foreground border-border';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Migrate Tool: {tool.toolName}</DialogTitle>
          <DialogDescription>
            Configure migration options and start the migration process
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tool Summary */}
          <div className="border rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Tool Name</label>
                <div className="mt-1 font-medium">{tool.toolName}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Class</label>
                <div className="mt-1 font-mono text-sm">{tool.className}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Category</label>
                <div className="mt-1">
                  <Badge>{tool.category}</Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Complexity</label>
                <div className="mt-1">
                  <Badge className={getComplexityColor(tool.complexity)}>
                    {tool.complexity}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <FileCode className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Methods:</span>
                <span className="font-medium">{tool.methods.length}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Dependencies:</span>
                <span className="font-medium">{tool.dependencies.length}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {tool.hasTests ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                )}
                <span className="text-muted-foreground">Tests:</span>
                <span className="font-medium">{tool.hasTests ? 'Available' : 'Not Available'}</span>
              </div>
            </div>
          </div>

          {/* Migration Options */}
          <div className="space-y-4">
            <div className="font-medium text-sm">Migration Options</div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="generateWrapper"
                  checked={options.generateWrapper}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, generateWrapper: checked as boolean })
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="generateWrapper"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                  >
                    <FileCode className="h-4 w-4" />
                    Generate TypeScript Wrapper
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Create a TypeScript wrapper class for the Python tool (required)
                  </p>
                </div>
              </div>

              {tool.dependencies.length > 0 && (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="installDependencies"
                    checked={options.installDependencies}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, installDependencies: checked as boolean })
                    }
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="installDependencies"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                    >
                      <Package className="h-4 w-4" />
                      Install Python Dependencies
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Install {tool.dependencies.length} required Python package{tool.dependencies.length !== 1 ? 's' : ''} using pip
                    </p>
                  </div>
                </div>
              )}

              {tool.hasTests && (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="runTests"
                    checked={options.runTests}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, runTests: checked as boolean })
                    }
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="runTests"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                    >
                      <TestTube2 className="h-4 w-4" />
                      Run Tests After Migration
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Verify the tool works correctly by running existing test suite
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Checkbox
                  id="registerInDatabase"
                  checked={options.registerInDatabase}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, registerInDatabase: checked as boolean })
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="registerInDatabase"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                  >
                    <Database className="h-4 w-4" />
                    Register in Tool Registry
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Add the tool to RTPI's tool registry database (required)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="overwriteExisting"
                  checked={options.overwriteExisting}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, overwriteExisting: checked as boolean })
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="overwriteExisting"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Overwrite Existing Tool
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Replace the tool if it already exists in the registry
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Migration Steps Preview */}
          <div className="border rounded-lg p-4 bg-secondary/50">
            <div className="font-medium text-sm mb-3">Migration Steps</div>
            <div className="space-y-2 text-sm">
              {options.installDependencies && tool.dependencies.length > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center text-xs font-medium">
                    1
                  </div>
                  <span>Install {tool.dependencies.length} Python dependencies</span>
                </div>
              )}
              {options.generateWrapper && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center text-xs font-medium">
                    {options.installDependencies && tool.dependencies.length > 0 ? '2' : '1'}
                  </div>
                  <span>Generate TypeScript wrapper class</span>
                </div>
              )}
              {options.runTests && tool.hasTests && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center text-xs font-medium">
                    {[
                      options.installDependencies && tool.dependencies.length > 0,
                      options.generateWrapper,
                    ].filter(Boolean).length + 1}
                  </div>
                  <span>Run test suite</span>
                </div>
              )}
              {options.registerInDatabase && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center text-xs font-medium">
                    {[
                      options.installDependencies && tool.dependencies.length > 0,
                      options.generateWrapper,
                      options.runTests && tool.hasTests,
                    ].filter(Boolean).length + 1}
                  </div>
                  <span>Register tool in database</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Migrating...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Migration
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
