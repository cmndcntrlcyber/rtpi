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
  Play,
  TestTube2,
  Heart,
  Download,
  Search,
  Filter,
  Plus,
} from "lucide-react";

interface Tool {
  id: string;
  toolId: string;
  name: string;
  version: string;
  category: string;
  description: string;
  installStatus: string;
  validationStatus: string;
  tags: string[];
  lastValidated?: string;
  installedAt?: string;
}

async function fetchTools(filters?: {
  category?: string;
  installStatus?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.category) params.append('category', filters.category);
  if (filters?.installStatus) params.append('installStatus', filters.installStatus);
  if (filters?.search) params.append('search', filters.search);

  const response = await fetch(`/api/v1/tools/registry?${params.toString()}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch tools');
  }

  return response.json();
}

export default function ToolRegistry() {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [installStatusFilter, setInstallStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['tool-registry', categoryFilter, installStatusFilter, searchQuery],
    queryFn: () => fetchTools({
      category: categoryFilter && categoryFilter !== 'all' ? categoryFilter : undefined,
      installStatus: installStatusFilter && installStatusFilter !== 'all' ? installStatusFilter : undefined,
      search: searchQuery || undefined,
    }),
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'installed':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-secondary0';
    }
  };

  const getValidationColor = (status: string) => {
    switch (status) {
      case 'validated':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-secondary0';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'reconnaissance':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'exploitation':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'post-exploitation':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'reporting':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-secondary text-foreground border-border';
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Tool Registry</h1>
          <p className="text-muted-foreground">
            Manage security tools and their configurations
          </p>
        </div>
        <div className="flex gap-2">
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Install from GitHub
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Register Tool
          </Button>
        </div>
      </div>

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
                <SelectItem value="reconnaissance">Reconnaissance</SelectItem>
                <SelectItem value="exploitation">Exploitation</SelectItem>
                <SelectItem value="post-exploitation">Post-Exploitation</SelectItem>
                <SelectItem value="reporting">Reporting</SelectItem>
              </SelectContent>
            </Select>

            <Select value={installStatusFilter} onValueChange={setInstallStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Install Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="installed">Installed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                setCategoryFilter('all');
                setInstallStatusFilter('all');
                setSearchQuery('');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tool List */}
      {isLoading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading tools...</p>
        </div>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">Failed to load tools. Please try again.</p>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.tools.map((tool: Tool) => (
            <Card key={tool.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{tool.name}</CardTitle>
                    <CardDescription className="mt-1">
                      v{tool.version}
                    </CardDescription>
                  </div>
                  <Badge className={getCategoryColor(tool.category)}>
                    {tool.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {tool.description}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {tool.tags?.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {tool.tags?.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{tool.tags.length - 3}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-4 text-sm">
                  <span className="text-muted-foreground">Install:</span>
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${getStatusColor(tool.installStatus)}`} />
                    <span className="capitalize">{tool.installStatus}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4 text-sm">
                  <span className="text-muted-foreground">Validation:</span>
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${getValidationColor(tool.validationStatus)}`} />
                    <span className="capitalize">{tool.validationStatus}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={tool.installStatus !== 'installed'}
                  >
                    <Play className="mr-1 h-3 w-3" />
                    Execute
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                  >
                    <TestTube2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                  >
                    <Heart className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && data.tools.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <p className="text-muted-foreground">
              No tools found. Try adjusting your filters or register a new tool.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
