import React, { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { fuzzySearch, FuzzySearchResult } from "@/utils/fuzzySearch";

export type SearchableEntityType =
  | "operation"
  | "target"
  | "vulnerability"
  | "agent"
  | "report"
  | "tool"
  | "all";

export interface SearchableEntity {
  id: string | number;
  type: SearchableEntityType;
  title: string;
  description?: string;
  status?: string;
  createdAt?: string;
  url: string;
  metadata?: Record<string, any>;
}

export interface SearchFilter {
  type: SearchableEntityType;
  status?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface SearchHistoryItem {
  query: string;
  timestamp: string;
  resultCount: number;
}

interface SearchContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  query: string;
  setQuery: (query: string) => void;
  filter: SearchFilter;
  setFilter: (filter: SearchFilter) => void;
  results: FuzzySearchResult<SearchableEntity>[];
  performSearch: (entities: SearchableEntity[]) => void;
  history: SearchHistoryItem[];
  addToHistory: (query: string, resultCount: number) => void;
  clearHistory: () => void;
  navigateToResult: (result: SearchableEntity) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

const STORAGE_KEY = "rtpi-search-history";
const MAX_HISTORY_ITEMS = 10;

interface SearchProviderProps {
  children: React.ReactNode;
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>({ type: "all" });
  const [results, setResults] = useState<FuzzySearchResult<SearchableEntity>[]>([]);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [, navigate] = useLocation();

  // Load search history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load search history:", error);
    }
  }, []);

  // Save search history to localStorage
  const saveHistory = (newHistory: SearchHistoryItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      setHistory(newHistory);
    } catch (error) {
      console.error("Failed to save search history:", error);
    }
  };

  const performSearch = (entities: SearchableEntity[]) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    // Filter entities by type if specified
    let filteredEntities = entities;
    if (filter.type !== "all") {
      filteredEntities = entities.filter((e) => e.type === filter.type);
    }

    // Filter by status if specified
    if (filter.status && filter.status.length > 0) {
      filteredEntities = filteredEntities.filter(
        (e) => e.status && filter.status!.includes(e.status)
      );
    }

    // Filter by date range if specified
    if (filter.dateFrom || filter.dateTo) {
      filteredEntities = filteredEntities.filter((e) => {
        if (!e.createdAt) return false;
        const entityDate = new Date(e.createdAt);
        if (filter.dateFrom && entityDate < new Date(filter.dateFrom)) return false;
        if (filter.dateTo && entityDate > new Date(filter.dateTo)) return false;
        return true;
      });
    }

    // Perform fuzzy search
    const searchResults = fuzzySearch(
      filteredEntities,
      query,
      ["title", "description", "status"] as any[],
      0.3
    );

    setResults(searchResults);
  };

  const addToHistory = (searchQuery: string, resultCount: number) => {
    if (!searchQuery.trim()) return;

    const newItem: SearchHistoryItem = {
      query: searchQuery,
      timestamp: new Date().toISOString(),
      resultCount,
    };

    // Remove duplicate queries
    const filtered = history.filter((item) => item.query !== searchQuery);

    // Add new item to beginning and limit size
    const newHistory = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);

    saveHistory(newHistory);
  };

  const clearHistory = () => {
    saveHistory([]);
  };

  const navigateToResult = (result: SearchableEntity) => {
    navigate(result.url);
    setIsOpen(false);
    setQuery("");
    setResults([]);
  };

  return (
    <SearchContext.Provider
      value={{
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
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return context;
}
