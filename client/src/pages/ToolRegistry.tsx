import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
  Wrench,
  Loader2,
} from "lucide-react";
import GitHubToolsDialog from "@/components/tools/GitHubToolsDialog";
import RegisterToolDialog from "@/components/tools/RegisterToolDialog";
import ConfigureToolDialog from "@/components/tools/ConfigureToolDialog";
import type { Tool as LegacyTool } from "@/services/tools";

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

const TOOL_CATEGORIES = [
  { value: "reconnaissance", label: "Reconnaissance" },
  { value: "scanning", label: "Scanning" },
  { value: "exploitation", label: "Exploitation" },
  { value: "post-exploitation", label: "Post-Exploitation" },
  { value: "wireless", label: "Wireless" },
  { value: "web-application", label: "Web Application" },
  { value: "password-cracking", label: "Password Cracking" },
  { value: "forensics", label: "Forensics" },
  { value: "social-engineering", label: "Social Engineering" },
  { value: "reporting", label: "Reporting" },
  { value: "vulnerability", label: "Vulnerability" },
  { value: "web", label: "Web" },
  { value: "network", label: "Network" },
  { value: "fuzzing", label: "Fuzzing" },
  { value: "reverse-engineering", label: "Reverse Engineering" },
  { value: "binary-analysis", label: "Binary Analysis" },
  { value: "fingerprinting", label: "Fingerprinting" },
  { value: "cms", label: "CMS" },
  { value: "azure", label: "Azure" },
  { value: "active-directory", label: "Active Directory" },
  { value: "enumeration", label: "Enumeration" },
  { value: "c2", label: "C2" },
  { value: "proxy", label: "Proxy" },
  { value: "discovery", label: "Discovery" },
  { value: "security-scanning", label: "Security Scanning" },
  { value: "web-recon", label: "Web Recon" },
  { value: "other", label: "Other" },
];

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

function registryToolToLegacy(tool: Tool): LegacyTool {
  return {
    id: tool.id,
    name: tool.name,
    category: tool.category,
    description: tool.description,
    status: tool.installStatus === 'installed' ? 'available' : 'stopped',
    command: tool.toolId,
    dockerImage: 'rtpi-tools',
    version: tool.version,
    usageCount: 0,
    createdAt: '',
    updatedAt: '',
  };
}

export default function ToolRegistry() {
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [installStatusFilter, setInstallStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<LegacyTool | null>(null);

  // Client-side favorites via localStorage
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('rtpi-tool-favorites');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleFavorite = (toolId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      localStorage.setItem('rtpi-tool-favorites', JSON.stringify([...next]));
      return next;
    });
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['tool-registry', categoryFilter, installStatusFilter, searchQuery],
    queryFn: () => fetchTools({
      category: categoryFilter && categoryFilter !== 'all' ? categoryFilter : undefined,
      installStatus: installStatusFilter && installStatusFilter !== 'all' ? installStatusFilter : undefined,
      search: searchQuery || undefined,
    }),
  });

  const testMutation = useMutation({
    mutationFn: async (toolId: string) => {
      const response = await fetch(`/api/v1/tools/registry/${toolId}/test`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Test failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('All tests passed');
      } else {
        const failed = data.results?.filter((r: any) => !r.passed) || [];
        toast.error(`${failed.length} test(s) failed`);
      }
      queryClient.invalidateQueries({ queryKey: ['tool-registry'] });
    },
    onError: (err: Error) => {
      toast.error('Test failed', { description: err.message });
    },
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
        return 'bg-secondary';
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
        return 'bg-secondary';
    }
  };

  const getCategoryColor = (category: string) => {
    const cat = category.toLowerCase();
    if (['reconnaissance', 'scanning', 'discovery', 'enumeration', 'fingerprinting', 'web-recon'].includes(cat))
      return 'bg-blue-100 text-blue-800 border-blue-300';
    if (['exploitation', 'c2'].includes(cat))
      return 'bg-red-100 text-red-800 border-red-300';
    if (['post-exploitation'].includes(cat))
      return 'bg-purple-100 text-purple-800 border-purple-300';
    if (['web-application', 'web', 'cms'].includes(cat))
      return 'bg-green-100 text-green-800 border-green-300';
    if (['network', 'wireless', 'proxy'].includes(cat))
      return 'bg-cyan-100 text-cyan-800 border-cyan-300';
    if (['password-cracking', 'active-directory'].includes(cat))
      return 'bg-orange-100 text-orange-800 border-orange-300';
    if (['vulnerability', 'security-scanning', 'fuzzing'].includes(cat))
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (['forensics', 'reverse-engineering', 'binary-analysis'].includes(cat))
      return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    if (['reporting', 'social-engineering'].includes(cat))
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (['azure'].includes(cat))
      return 'bg-sky-100 text-sky-800 border-sky-300';
    return 'bg-secondary text-foreground border-border';
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
          <Button onClick={() => setInstallDialogOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            Install from GitHub
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Wrench className="mr-2 h-4 w-4" />
            Create Agent Tools
          </Button>
          <Button onClick={() => setRegisterDialogOpen(true)}>
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
                {TOOL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
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
                      {tool.version ? `v${tool.version}` : 'unknown'}
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
                    onClick={() => {
                      setSelectedTool(registryToolToLegacy(tool));
                      setExecuteDialogOpen(true);
                    }}
                  >
                    <Play className="mr-1 h-3 w-3" />
                    Execute
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={tool.installStatus !== 'installed' || testMutation.isPending}
                    onClick={() => testMutation.mutate(tool.id)}
                  >
                    {testMutation.isPending && testMutation.variables === tool.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <TestTube2 className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleFavorite(tool.id)}
                    className={favorites.has(tool.id) ? 'text-red-500 border-red-300' : ''}
                  >
                    <Heart className={`h-3 w-3 ${favorites.has(tool.id) ? 'fill-current' : ''}`} />
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

      <GitHubToolsDialog mode="install" open={installDialogOpen} onOpenChange={setInstallDialogOpen} />
      <GitHubToolsDialog mode="create" open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <RegisterToolDialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen} />
      <ConfigureToolDialog
        open={executeDialogOpen}
        tool={selectedTool}
        onClose={() => {
          setExecuteDialogOpen(false);
          setSelectedTool(null);
        }}
      />
    </div>
  );
}
