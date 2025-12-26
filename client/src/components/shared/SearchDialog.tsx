import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSearch, SearchableEntity, SearchableEntityType } from "@/contexts/SearchContext";
import { highlightMatches } from "@/utils/fuzzySearch";
import {
  Search,
  X,
  Filter,
  History,
  Target,
  AlertTriangle,
  ListTodo,
  Bot,
  FileText,
  Wrench,
  Calendar,
  ChevronRight,
} from "lucide-react";

// Mock data - in production, this would come from API
const useMockSearchData = (): SearchableEntity[] => {
  return [
    {
      id: 1,
      type: "operation",
      title: "Web Application Penetration Test",
      description: "Full security assessment of e-commerce platform",
      status: "in_progress",
      createdAt: "2025-12-20",
      url: "/operations",
    },
    {
      id: 2,
      type: "target",
      title: "Production Web Server",
      description: "192.168.1.100 - Apache 2.4.52",
      status: "active",
      createdAt: "2025-12-21",
      url: "/targets",
    },
    {
      id: 3,
      type: "vulnerability",
      title: "SQL Injection in Login Form",
      description: "Critical vulnerability allowing authentication bypass",
      status: "open",
      createdAt: "2025-12-22",
      url: "/vulnerabilities",
    },
    {
      id: 4,
      type: "agent",
      title: "Operation Lead Agent",
      description: "AI agent for orchestrating penetration tests",
      status: "active",
      createdAt: "2025-12-15",
      url: "/agents",
    },
    {
      id: 5,
      type: "report",
      title: "Q4 Security Assessment Report",
      description: "Comprehensive findings from December testing",
      status: "completed",
      createdAt: "2025-12-25",
      url: "/reports",
    },
  ];
};

const entityTypeIcons: Record<SearchableEntityType, React.ReactNode> = {
  operation: <ListTodo className="h-4 w-4" />,
  target: <Target className="h-4 w-4" />,
  vulnerability: <AlertTriangle className="h-4 w-4" />,
  agent: <Bot className="h-4 w-4" />,
  report: <FileText className="h-4 w-4" />,
  tool: <Wrench className="h-4 w-4" />,
  all: <Search className="h-4 w-4" />,
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  open: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export function SearchDialog() {
  const {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    filter,
    setFilter,
    results,
    performSearch,
    history,
    addToHistory,
    clearHistory,
    navigateToResult,
  } = useSearch();

  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const mockData = useMockSearchData();

  // Perform search when query or filter changes
  useEffect(() => {
    performSearch(mockData);
  }, [query, filter]);

  // Add to history when search is performed
  useEffect(() => {
    if (query.trim() && results.length > 0) {
      addToHistory(query, results.length);
    }
  }, [results]);

  const handleClear = () => {
    setQuery("");
    setFilter({ type: "all" });
    setShowFilters(false);
  };

  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    setShowHistory(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-3xl max-h-[80vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Advanced Search
          </DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="px-6 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search operations, targets, vulnerabilities..."
              className="pl-10 pr-20"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Filter and History Buttons */}
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant={showFilters ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-3 w-3 mr-2" />
              Filters
            </Button>
            <Button
              variant={showHistory ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              disabled={history.length === 0}
            >
              <History className="h-3 w-3 mr-2" />
              History ({history.length})
            </Button>
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear History
              </Button>
            )}
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="px-6 py-4 bg-secondary/30 border-y border-border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Type
                </label>
                <Select
                  value={filter.type}
                  onValueChange={(value) =>
                    setFilter({ ...filter, type: value as SearchableEntityType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="operation">Operations</SelectItem>
                    <SelectItem value="target">Targets</SelectItem>
                    <SelectItem value="vulnerability">Vulnerabilities</SelectItem>
                    <SelectItem value="agent">Agents</SelectItem>
                    <SelectItem value="report">Reports</SelectItem>
                    <SelectItem value="tool">Tools</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Date From
                </label>
                <Input
                  type="date"
                  value={filter.dateFrom || ""}
                  onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Date To
                </label>
                <Input
                  type="date"
                  value={filter.dateTo || ""}
                  onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Search History */}
        {showHistory && history.length > 0 && (
          <div className="px-6 py-4 bg-secondary/30 border-b border-border max-h-48 overflow-y-auto">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">
              Recent Searches
            </h3>
            <div className="space-y-1">
              {history.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleHistoryClick(item.query)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-secondary transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <History className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm text-foreground">{item.query}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.resultCount} results
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        <div className="px-6 py-4 overflow-y-auto max-h-96">
          {!query && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Start typing to search across all entities
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Try searching for operations, targets, vulnerabilities, and more
              </p>
            </div>
          )}

          {query && results.length === 0 && (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No results found for "{query}"</p>
              <p className="text-xs text-muted-foreground mt-2">
                Try adjusting your search or filters
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                Found {results.length} result{results.length === 1 ? "" : "s"}
              </p>
              {results.map((result, index) => {
                const match = result.matches.find((m) => m.field === "title");
                return (
                  <button
                    key={index}
                    onClick={() => navigateToResult(result.item)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors text-left border border-border hover:border-primary/50"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      {entityTypeIcons[result.item.type]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-foreground truncate">
                          {match
                            ? highlightMatches(result.item.title, match.indices).map((part, i) =>
                                part.highlighted ? (
                                  <mark
                                    key={i}
                                    className="bg-yellow-200 dark:bg-yellow-900 px-0.5 rounded"
                                  >
                                    {part.text}
                                  </mark>
                                ) : (
                                  part.text
                                )
                              )
                            : result.item.title}
                        </h4>
                        {result.item.status && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              statusColors[result.item.status] ||
                              statusColors.active
                            }`}
                          >
                            {result.item.status.replace("_", " ")}
                          </span>
                        )}
                      </div>
                      {result.item.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {result.item.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground capitalize">
                          {result.item.type}
                        </span>
                        {result.item.createdAt && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(result.item.createdAt).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-secondary/30">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border border-border rounded">/</kbd> to focus search •{" "}
            <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border border-border rounded">Esc</kbd> to close
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
