import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  Filter,
  Package,
  FileCode,
  CheckCircle2,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { toolsService, type Tool } from "@/services/tools";

export function ToolCatalog() {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);

  // Fetch all tools
  const { data, isLoading, error } = useQuery({
    queryKey: ['tools'],
    queryFn: () => toolsService.list(),
  });

  // Filter migrated tools
  const migratedTools = (data?.tools || []).filter(
    (tool) => (tool.metadata as any)?.source === 'offsec-team'
  );

  // Apply filters
  const filteredTools = migratedTools.filter((tool) => {
    if (categoryFilter !== 'all' && tool.category !== categoryFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        tool.name.toLowerCase().includes(query) ||
        tool.description?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Get unique categories
  const categories = Array.from(
    new Set(migratedTools.map((t) => t.category))
  ).sort();

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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Migrated Tools Catalog</h2>
        <p className="text-muted-foreground">
          {migratedTools.length} tool{migratedTools.length !== 1 ? 's' : ''} migrated from offsec-team
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <Button
              variant="outline"
              onClick={() => {
                setCategoryFilter('all');
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
          <p className="text-muted-foreground">Loading migrated tools...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">Failed to load tools. Please try again.</p>
          </CardContent>
        </Card>
      )}

      {/* Tools Grid */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTools.map((tool) => {
            const metadata = (tool.metadata as any) || {};
            return (
              <Card key={tool.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileCode className="h-4 w-4" />
                        {tool.name}
                      </CardTitle>
                      {tool.version && (
                        <CardDescription className="mt-1">
                          v{tool.version}
                        </CardDescription>
                      )}
                    </div>
                    <Badge className={getCategoryColor(tool.category)}>
                      {tool.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {tool.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {tool.description}
                    </p>
                  )}

                  <div className="space-y-2 mb-4">
                    {metadata.complexity && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Complexity:</span>
                        <Badge className={getComplexityColor(metadata.complexity)}>
                          {metadata.complexity}
                        </Badge>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-muted-foreground">Status:</span>
                      <span className="capitalize">{tool.status}</span>
                    </div>

                    {metadata.migrationDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Migrated:</span>
                        <span>{new Date(metadata.migrationDate).toLocaleDateString()}</span>
                      </div>
                    )}

                    {metadata.wrapperPath && (
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Wrapper:</span>
                        <code className="text-xs bg-secondary px-1 py-0.5 rounded">
                          {metadata.wrapperPath.split('/').pop()}
                        </code>
                      </div>
                    )}
                  </div>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setSelectedTool(tool)}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{tool.name}</DialogTitle>
                        <DialogDescription>Migrated Tool Details</DialogDescription>
                      </DialogHeader>
                      {selectedTool && (
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Description</label>
                            <p className="mt-1 text-sm">{selectedTool.description}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Category</label>
                              <div className="mt-1">
                                <Badge className={getCategoryColor(selectedTool.category)}>
                                  {selectedTool.category}
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Status</label>
                              <div className="mt-1">
                                <Badge variant="outline">{selectedTool.status}</Badge>
                              </div>
                            </div>
                          </div>

                          {selectedTool.command && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Command</label>
                              <div className="mt-1 font-mono text-xs bg-secondary p-2 rounded">
                                {selectedTool.command}
                              </div>
                            </div>
                          )}

                          {(selectedTool.metadata as any)?.wrapperPath && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Wrapper Path</label>
                              <div className="mt-1 font-mono text-xs bg-secondary p-2 rounded">
                                {(selectedTool.metadata as any).wrapperPath}
                              </div>
                            </div>
                          )}

                          {(selectedTool.metadata as any)?.pythonModule && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Python Module</label>
                              <div className="mt-1 font-mono text-xs bg-secondary p-2 rounded">
                                {(selectedTool.metadata as any).pythonModule}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Created</label>
                              <div className="mt-1 text-sm">
                                {new Date(selectedTool.createdAt).toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Updated</label>
                              <div className="mt-1 text-sm">
                                {new Date(selectedTool.updatedAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* No Results */}
      {!isLoading && !error && filteredTools.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <p className="text-muted-foreground">
              No migrated tools found. {searchQuery || categoryFilter !== 'all' ? 'Try adjusting your filters.' : ''}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
