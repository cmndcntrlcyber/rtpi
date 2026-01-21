import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface ModuleSelectorProps {
  modules: any; // Kept for backward compatibility but no longer used
  selectedModules: Record<string, string>;
  onModuleChange: (type: string, path: string) => void;
}

interface SearchResult {
  type: string;
  path: string;
  fullPath: string;
  disclosureDate: string;
  rank: string;
  description: string;
  displayName: string;
}

export default function ModuleSelector({
  modules: _modules,
  selectedModules,
  onModuleChange,
}: ModuleSelectorProps) {
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  const [searchResults, setSearchResults] = useState<Record<string, SearchResult[]>>({});
  const [isSearching, setIsSearching] = useState<Record<string, boolean>>({});

  const moduleTypes = [
    { key: "exploit", label: "Exploit" },
    { key: "payload", label: "Payload" },
    { key: "auxiliary", label: "Auxiliary" },
    { key: "encoder", label: "Encoder" },
    { key: "post", label: "Post" },
    { key: "evasion", label: "Evasion" },
  ];

  // Debounce search
  useEffect(() => {
    const timers: Record<string, NodeJS.Timeout> = {};

    Object.entries(searchQueries).forEach(([type, query]) => {
      if (query && query.trim().length >= 2) {
        timers[type] = setTimeout(() => {
          performSearch(type, query);
        }, 500); // 500ms debounce
      } else if (!query) {
        // Clear results when query is empty
        setSearchResults((prev) => ({ ...prev, [type]: [] }));
        setExpandedTypes((prev) => ({ ...prev, [type]: false }));
      }
    });

    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, [searchQueries]);

  const performSearch = async (type: string, query: string) => {
    // Guard against empty or invalid queries
    if (!query || query.trim().length < 2) {
      return;
    }

    setIsSearching((prev) => ({ ...prev, [type]: true }));
    setExpandedTypes((prev) => ({ ...prev, [type]: true }));

    try {
      const response = await api.get("/metasploit/search", {
        params: { q: query.trim(), type },
      });

      setSearchResults((prev) => ({
        ...prev,
        [type]: response.data.results || [],
      }));
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults((prev) => ({ ...prev, [type]: [] }));
    } finally {
      setIsSearching((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleSearchChange = (type: string, query: string) => {
    setSearchQueries((prev) => ({ ...prev, [type]: query }));
  };

  const handleClearSearch = (type: string) => {
    setSearchQueries((prev) => ({ ...prev, [type]: "" }));
    setSearchResults((prev) => ({ ...prev, [type]: [] }));
    setExpandedTypes((prev) => ({ ...prev, [type]: false }));
  };

  const handleModuleSelect = (type: string, path: string) => {
    onModuleChange(type, path);
    // Clear search and collapse after selection
    handleClearSearch(type);
  };

  const renderModuleSearch = (type: string, label: string) => {
    const results = searchResults[type] || [];
    const hasSearch = searchQueries[type]?.trim();
    const isExpanded = expandedTypes[type] && hasSearch;
    const selectedModule = selectedModules[type];
    const searching = isSearching[type];

    return (
      <div key={type} className="space-y-2">
        <Label htmlFor={`module-${type}`} className="text-sm font-medium">
          {label}
        </Label>

        {/* Search Input */}
        <div className="relative">
          {searching ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          )}
          <Input
            id={`module-${type}`}
            type="text"
            placeholder={`Search ${label.toLowerCase()}...`}
            value={searchQueries[type] || ""}
            onChange={(e) => handleSearchChange(type, e.target.value)}
            className="pl-9 pr-9"
          />
          {hasSearch && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => handleClearSearch(type)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Selected Module Display */}
        {selectedModule && !isExpanded && (
          <div className="p-2 bg-green-50 border border-green-200 rounded-md">
            <p className="text-xs font-mono text-green-800 truncate" title={selectedModule}>
              {selectedModule}
            </p>
          </div>
        )}

        {/* Search Results */}
        {isExpanded && (
          <div className="border border-border rounded-md bg-card max-h-[250px] overflow-y-auto">
            {searching ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Searching modules...
              </div>
            ) : results.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                {hasSearch && hasSearch.length < 2
                  ? "Type at least 2 characters to search"
                  : "No modules found"}
              </div>
            ) : (
              <div className="p-1">
                {results.map((module, idx) => (
                  <button
                    key={`${module.fullPath}-${idx}`}
                    onClick={() => handleModuleSelect(type, module.path)}
                    className={cn(
                      "w-full text-left p-2 rounded-sm hover:bg-accent transition-colors",
                      "focus:outline-none focus:bg-accent"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-foreground truncate">
                          {module.displayName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate" title={module.description}>
                          {module.description || module.path}
                        </p>
                        {module.rank && (
                          <span className="inline-block mt-1 text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                            {module.rank}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Module Selection</h3>

      {/* 3x2 Grid */}
      <div className="grid grid-cols-3 gap-4">
        {moduleTypes.map((moduleType) =>
          renderModuleSearch(moduleType.key, moduleType.label)
        )}
      </div>

      {/* Selected modules summary */}
      {Object.keys(selectedModules).length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs font-semibold text-blue-900 mb-2">Selected Modules:</p>
          <div className="space-y-1">
            {Object.entries(selectedModules).map(([type, path]) => (
              path && (
                <div key={type} className="text-xs text-blue-800">
                  <span className="font-semibold">{type}:</span>{" "}
                  <span className="font-mono">{path}</span>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
