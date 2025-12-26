import React, { createContext, useContext, useState } from "react";
import { useLocation } from "wouter";
import { useKeyboardShortcuts, KeyboardShortcut } from "@/hooks/useKeyboardShortcuts";

interface KeyboardShortcutsContextType {
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
  globalShortcuts: KeyboardShortcut[];
  openSearch?: () => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(
  undefined
);

interface KeyboardShortcutsProviderProps {
  children: React.ReactNode;
  onSearchOpen?: () => void;
}

export function KeyboardShortcutsProvider({ children, onSearchOpen }: KeyboardShortcutsProviderProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [, navigate] = useLocation();

  // Define global keyboard shortcuts
  const globalShortcuts: KeyboardShortcut[] = [
    {
      key: "?",
      shift: true,
      description: "Show keyboard shortcuts",
      action: () => setShowHelp(true),
    },
    {
      key: "/",
      description: "Open search",
      action: () => {
        if (onSearchOpen) {
          onSearchOpen();
        }
      },
    },
    {
      key: "h",
      ctrl: true,
      meta: true,
      description: "Go to dashboard",
      action: () => navigate("/"),
    },
    {
      key: "o",
      ctrl: true,
      meta: true,
      description: "Go to operations",
      action: () => navigate("/operations"),
    },
    {
      key: "t",
      ctrl: true,
      meta: true,
      description: "Go to targets",
      action: () => navigate("/targets"),
    },
    {
      key: "v",
      ctrl: true,
      meta: true,
      description: "Go to vulnerabilities",
      action: () => navigate("/vulnerabilities"),
    },
    {
      key: "a",
      ctrl: true,
      meta: true,
      description: "Go to agents",
      action: () => navigate("/agents"),
    },
    {
      key: "e",
      ctrl: true,
      meta: true,
      description: "Go to Empire C2",
      action: () => navigate("/empire"),
    },
    {
      key: "s",
      ctrl: true,
      meta: true,
      description: "Go to surface assessment",
      action: () => navigate("/surface-assessment"),
    },
    {
      key: "r",
      ctrl: true,
      meta: true,
      description: "Go to reports",
      action: () => navigate("/reports"),
    },
    {
      key: ",",
      ctrl: true,
      meta: true,
      description: "Go to settings",
      action: () => navigate("/settings"),
    },
    {
      key: "Escape",
      description: "Close dialogs/modals",
      action: () => {
        // Close help modal if open
        if (showHelp) {
          setShowHelp(false);
        }
      },
      preventDefault: false,
    },
  ];

  // Register global shortcuts
  useKeyboardShortcuts({
    shortcuts: globalShortcuts,
    enabled: true,
  });

  return (
    <KeyboardShortcutsContext.Provider
      value={{ showHelp, setShowHelp, globalShortcuts }}
    >
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcutsContext() {
  const context = useContext(KeyboardShortcutsContext);
  if (context === undefined) {
    throw new Error(
      "useKeyboardShortcutsContext must be used within a KeyboardShortcutsProvider"
    );
  }
  return context;
}
