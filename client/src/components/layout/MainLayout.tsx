import { useState, useEffect } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import CommandPalette from "@/components/shared/CommandPalette";
import KeyboardShortcutsHelp from "@/components/shared/KeyboardShortcutsHelp";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { AgentChatProvider } from "@/contexts/AgentChatContext";
import AgentChatManager from "@/components/agents/AgentChatManager";

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
    <AgentChatProvider>
      <div className="min-h-dvh bg-background">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[1000] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Skip to main content
        </a>
        <Header onMenuClick={handleMenuClick} onSearchClick={() => setCommandPaletteOpen(true)} />
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleCollapse}
        onClose={handleSidebarClose}
      />
      <main
        id="main"
        tabIndex={-1}
        className={`pt-[var(--header-h)] px-2 sm:px-4 lg:px-6 transition-[margin] duration-300 focus:outline-none ${getSidebarWidth()}`}
      >
        {children}
      </main>

      {/* Global Components */}
        <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
        <KeyboardShortcutsHelp open={shortcutsHelpOpen} onOpenChange={setShortcutsHelpOpen} />
        <AgentChatManager />
      </div>
    </AgentChatProvider>
  );
}
