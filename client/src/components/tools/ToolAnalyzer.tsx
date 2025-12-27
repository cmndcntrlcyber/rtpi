import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type PythonToolAnalysis } from "@/services/tool-migration";
import {
  FileCode,
  Package,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Server,
  TestTube2,
} from "lucide-react";

interface ToolAnalyzerProps {
  tool: PythonToolAnalysis;
}

export function ToolAnalyzer({ tool }: ToolAnalyzerProps) {
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
    <div className="space-y-4">
      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Tool Name</label>
              <div className="mt-1 font-medium">{tool.toolName}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Class Name</label>
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

          <Separator />

          <div>
            <label className="text-sm font-medium text-muted-foreground">Description</label>
            <p className="mt-1 text-sm">{tool.description}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">File Path</label>
            <div className="mt-1 font-mono text-xs text-muted-foreground bg-secondary p-2 rounded">
              {tool.filePath}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Est. Migration</div>
                <div className="font-medium">{tool.estimatedMigrationDays} day{tool.estimatedMigrationDays !== 1 ? 's' : ''}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tool.hasTests ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              )}
              <div>
                <div className="text-xs text-muted-foreground">Tests</div>
                <div className="font-medium">{tool.hasTests ? 'Available' : 'None'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tool.requiresExternalServices ? (
                <Server className="h-4 w-4 text-blue-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              <div>
                <div className="text-xs text-muted-foreground">External Services</div>
                <div className="font-medium">{tool.requiresExternalServices ? 'Required' : 'Not Required'}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Methods ({tool.methods.length})
          </CardTitle>
          <CardDescription>
            Public methods available in this tool
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tool.methods.length > 0 ? (
            <div className="space-y-4">
              {tool.methods.map((method, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-mono text-sm font-medium">{method.name}()</div>
                    <Badge variant="outline" className="text-xs">
                      {method.returnType}
                    </Badge>
                  </div>
                  {method.description && (
                    <p className="text-sm text-muted-foreground mb-3">{method.description}</p>
                  )}
                  {method.parameters.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-2">Parameters:</div>
                      <div className="space-y-1">
                        {method.parameters.map((param, pIndex) => (
                          <div key={pIndex} className="flex items-center gap-2 text-xs">
                            <code className="bg-secondary px-2 py-0.5 rounded">
                              {param.name}: {param.type}
                            </code>
                            {param.required && (
                              <Badge variant="secondary" className="text-xs">
                                required
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No public methods detected
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dependencies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Dependencies ({tool.dependencies.length})
          </CardTitle>
          <CardDescription>
            Python packages required by this tool
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tool.dependencies.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Install Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tool.dependencies.map((dep, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-sm">{dep.name}</TableCell>
                    <TableCell>
                      {dep.version ? (
                        <Badge variant="outline">{dep.version}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Latest</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{dep.installMethod}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No dependencies detected
            </p>
          )}
        </CardContent>
      </Card>

      {/* Migration Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube2 className="h-5 w-5" />
            Migration Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium">TypeScript Wrapper Generation</div>
              <div className="text-muted-foreground">Auto-generate wrapper class for Python tool</div>
            </div>
          </div>

          {tool.dependencies.length > 0 && (
            <div className="flex items-start gap-2">
              <Package className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Dependency Installation</div>
                <div className="text-muted-foreground">
                  Install {tool.dependencies.length} Python package{tool.dependencies.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          )}

          {tool.requiresExternalServices && (
            <div className="flex items-start gap-2">
              <Server className="h-4 w-4 text-orange-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">External Services</div>
                <div className="text-muted-foreground">
                  Configuration required for external API/service integration
                </div>
              </div>
            </div>
          )}

          {tool.hasTests && (
            <div className="flex items-start gap-2">
              <TestTube2 className="h-4 w-4 text-green-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Test Suite Available</div>
                <div className="text-muted-foreground">Run existing tests after migration</div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium">Database Registration</div>
              <div className="text-muted-foreground">Register tool in RTPI tool registry</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
