import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Search,
  Filter,
  Download,
  Play,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  FileCode,
  Star,
} from "lucide-react";
import { toolMigrationService, type PythonToolAnalysis, type MigrationOptions } from "@/services/tool-migration";
import { ToolAnalyzer } from "@/components/tools/ToolAnalyzer";
import { MigrationProgress } from "@/components/tools/MigrationProgress";
import { toast } from "sonner";

export default function ToolMigration() {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [complexityFilter, setComplexityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTool, setSelectedTool] = useState<PythonToolAnalysis | null>(null);
  const [migrationDialogOpen, setMigrationDialogOpen] = useState(false);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Fetch all tools analysis
  const { data, isLoading, error } = useQuery({
    queryKey: ['tool-migration-analyze'],
    queryFn: () => toolMigrationService.analyzeAll(),
  });

  // Fetch recommendations
  const { data: recommendationsData } = useQuery({
    queryKey: ['tool-migration-recommendations'],
    queryFn: () => toolMigrationService.getRecommendations(),
  });

  // Migration mutation
  const migrateMutation = useMutation({
    mutationFn: async ({ filePath, options }: { filePath: string; options?: MigrationOptions }) =>
      toolMigrationService.migrate(filePath, options),
    onSuccess: (response) => {
      if (response.success && response.data.status === 'completed') {
        toast.success("Migration Successful", {
          description: `${response.data.toolName} has been migrated successfully.`,
        });
        queryClient.invalidateQueries({ queryKey: ['tool-migration-analyze'] });
        queryClient.invalidateQueries({ queryKey: ['tool-registry'] });
      } else {
        toast.error("Migration Failed", {
          description: response.data.errors?.join(', ') || "Unknown error",
        });
      }
      setMigrationDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error("Migration Error", {
        description: error.message || "Failed to migrate tool",
      });
    },
  });

  // Batch migration mutation
  const batchMigrateMutation = useMutation({
    mutationFn: async ({ category, options }: { category: string; options?: MigrationOptions }) =>
      toolMigrationService.migrateBatch({ category, options }),
    onSuccess: (response) => {
      if (response.success) {
        toast.success("Batch Migration Complete", {
          description: `Migrated ${response.data.summary.completed} of ${response.data.summary.total} tools successfully.`,
        });
        queryClient.invalidateQueries({ queryKey: ['tool-migration-analyze'] });
        queryClient.invalidateQueries({ queryKey: ['tool-registry'] });
      }
    },
    onError: (error: any) => {
      toast.error("Batch Migration Error", {
        description: error.message || "Failed to migrate tools",
      });
    },
  });

  // Filter tools
  const filteredTools = data?.data.summary.tools.filter((tool) => {
    if (categoryFilter !== 'all' && tool.category !== categoryFilter) return false;
    if (complexityFilter !== 'all' && tool.complexity !== complexityFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        tool.toolName.toLowerCase().includes(query) ||
        tool.className.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query)
      );
    }
    return true;
  }) || [];

  // Get unique categories
  const categories = Array.from(
    new Set(data?.data.summary.tools.map((t) => t.category) || [])
  ).sort();

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

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'scanning': 'bg-blue-100 text-blue-800 border-blue-300',
      'web-application': 'bg-purple-100 text-purple-800 border-purple-300',
      'network-analysis': 'bg-cyan-100 text-cyan-800 border-cyan-300',
      'reporting': 'bg-green-100 text-green-800 border-green-300',
      'research': 'bg-pink-100 text-pink-800 border-pink-300',
    };
    return colors[category] || 'bg-secondary text-foreground border-border';
  };

  const isRecommended = (toolName: string) => {
    return recommendationsData?.data.recommended.some((t) => t.toolName === toolName) || false;
  };

  const handleMigrate = (tool: PythonToolAnalysis) => {
    setSelectedTool(tool);
    setMigrationDialogOpen(true);
  };

  const confirmMigration = (options: MigrationOptions) => {
    if (selectedTool) {
      migrateMutation.mutate({
        filePath: selectedTool.filePath,
        options,
      });
    }
  };

  const handleBatchMigrate = (category: string) => {
    if (confirm(`Migrate all tools in category: ${category}?`)) {
      batchMigrateMutation.mutate({
        category,
        options: {
          installDependencies: true,
          registerInDatabase: true,
          generateWrapper: true,
        },
      });
    }
  };

  const toggleToolSelection = (toolName: string) => {
    const newSelection = new Set(selectedTools);
    if (newSelection.has(toolName)) {
      newSelection.delete(toolName);
    } else {
      newSelection.add(toolName);
    }
    setSelectedTools(newSelection);
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Tool Migration</h1>
          <p className="text-muted-foreground">
            Migrate Python security tools from offsec-team repository
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['tool-migration-analyze'] })}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Refresh Analysis
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Tools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.data.summary.totalTools}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Low Complexity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {data.data.summary.byComplexity.low}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Medium Complexity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {data.data.summary.byComplexity.medium}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">High+ Complexity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {data.data.summary.byComplexity.high + data.data.summary.byComplexity['very-high']}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={complexityFilter} onValueChange={setComplexityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Complexity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Complexities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="very-high">Very High</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                setCategoryFilter('all');
                setComplexityFilter('all');
                setSearchQuery('');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Analyzing offsec-team tools...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-800">Failed to analyze tools. Please try again.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tools Table */}
      {data && filteredTools.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Tools ({filteredTools.length})</CardTitle>
            <CardDescription>
              Select tools to migrate from offsec-team repository
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Tool Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Complexity</TableHead>
                  <TableHead>Dependencies</TableHead>
                  <TableHead>Est. Days</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTools.map((tool) => (
                  <TableRow key={tool.toolName}>
                    <TableCell>
                      {isRecommended(tool.toolName) && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" title="Recommended" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileCode className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div>{tool.toolName}</div>
                          <div className="text-xs text-muted-foreground">{tool.className}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getCategoryColor(tool.category)}>
                        {tool.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getComplexityColor(tool.complexity)}>
                        {tool.complexity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {tool.dependencies.length > 0 ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-sm">{tool.dependencies.length}</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">None</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{tool.estimatedMigrationDays}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedTool(tool)}
                            >
                              Analyze
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{tool.toolName} - Analysis</DialogTitle>
                              <DialogDescription>
                                Detailed analysis of the Python tool
                              </DialogDescription>
                            </DialogHeader>
                            {selectedTool && <ToolAnalyzer tool={selectedTool} />}
                          </DialogContent>
                        </Dialog>

                        <Button
                          size="sm"
                          onClick={() => handleMigrate(tool)}
                          disabled={migrateMutation.isPending}
                        >
                          <Play className="mr-1 h-3 w-3" />
                          Migrate
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {data && filteredTools.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <p className="text-muted-foreground">
              No tools found. Try adjusting your filters.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Migration Dialog */}
      {selectedTool && (
        <MigrationProgress
          open={migrationDialogOpen}
          onOpenChange={setMigrationDialogOpen}
          tool={selectedTool}
          onConfirm={confirmMigration}
          isLoading={migrateMutation.isPending}
        />
      )}
    </div>
  );
}
