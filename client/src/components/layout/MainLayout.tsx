import { useState, useEffect } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import CommandPalette from "@/components/shared/CommandPalette";
import KeyboardShortcutsHelp from "@/components/shared/KeyboardShortcutsHelp";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start closed on mobile
  const { isCollapsed: sidebarCollapsed, toggleCollapse } = useSidebarCollapse();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  // Detect if we're on desktop on mount
  useEffect(() => {
    const checkDesktop = () => {
      // Open sidebar by default on desktop (>= 1024px)
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      }
    };

    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'k',
        ctrl: true,
        meta: true,
        description: 'Open command palette',
        action: () => setCommandPaletteOpen(true),
      },
      {
        key: '/',
        ctrl: true,
        meta: true,
        description: 'Show keyboard shortcuts',
        action: () => setShortcutsHelpOpen(true),
      },
      {
        key: 'Escape',
        description: 'Close modals',
        action: () => {
          setCommandPaletteOpen(false);
          setShortcutsHelpOpen(false);
        },
        preventDefault: false,
      },
    ],
  });

  const getSidebarWidth = () => {
    return sidebarCollapsed ? "lg:ml-20" : "lg:ml-64";
  };

  const handleMenuClick = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSidebarClose = () => {
    // Only close on mobile
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuClick={handleMenuClick} />
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleCollapse}
        onClose={handleSidebarClose}
      />
      <main
        className={`pt-16 px-2 sm:px-4 lg:px-6 transition-all duration-300 ${getSidebarWidth()}`}
      >
        {children}
      </main>

      {/* Global Components */}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      <KeyboardShortcutsHelp open={shortcutsHelpOpen} onOpenChange={setShortcutsHelpOpen} />
    </div>
  );
}
