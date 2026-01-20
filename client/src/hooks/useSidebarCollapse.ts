import { useState, useEffect } from "react";

const STORAGE_KEY = "rtpi_sidebar_collapsed";

/**
 * Custom hook for managing sidebar collapse state with localStorage persistence
 * and keyboard shortcut support (Ctrl+B / Cmd+B)
 */
export function useSidebarCollapse() {
  // Initialize from localStorage, default to false (expanded)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "true";
    } catch {
      return false;
    }
  });

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isCollapsed));
    } catch (error) {
      // Silently fail if localStorage is not available
      console.warn("Failed to persist sidebar state:", error);
    }
  }, [isCollapsed]);

  // Keyboard shortcut: Ctrl+B (or Cmd+B on Mac)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Toggle function
  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
  };

  return {
    isCollapsed,
    toggleCollapse,
    setIsCollapsed,
  };
}
