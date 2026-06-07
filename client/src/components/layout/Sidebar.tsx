import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { navGroups, adminNavItems } from "@/config/nav-groups";

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
}

const COLLAPSED_GROUPS_KEY = "rtpi_sidebar_collapsed_groups";

function loadCollapsedGroups(): Set<string> {
  try {
    const stored = localStorage.getItem(COLLAPSED_GROUPS_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set();
}

function saveCollapsedGroups(groups: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...groups]));
  } catch {}
}

export default function Sidebar({ isOpen, isCollapsed, onToggleCollapse, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { isAdmin } = useAuth();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(loadCollapsedGroups);

  // Auto-expand group containing the active route
  useEffect(() => {
    for (const group of navGroups) {
      if (group.label && group.items.some((item) => item.path === location)) {
        if (collapsedGroups.has(group.label)) {
          const next = new Set(collapsedGroups);
          next.delete(group.label);
          setCollapsedGroups(next);
          saveCollapsedGroups(next);
        }
        break;
      }
    }
  }, [location]);

  const toggleGroup = (label: string) => {
    const next = new Set(collapsedGroups);
    if (next.has(label)) {
      next.delete(label);
    } else {
      next.add(label);
    }
    setCollapsedGroups(next);
    saveCollapsedGroups(next);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        role="navigation"
        aria-label="Primary"
        className={`bg-background border-r border-border fixed left-0 top-[var(--header-h)] bottom-0 overflow-y-auto z-30 transition-[width,transform] duration-300
          ${isCollapsed ? "w-20" : "w-64"}
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        {!isCollapsed ? (
          <div className="flex items-center gap-3">
            <img src="/RTPI.png" alt="RTPI" className="h-10 w-10" />
            <div>
              <h2 className="font-bold text-foreground">RTPI</h2>
              <p className="text-xs text-muted-foreground">Red Team Platform</p>
            </div>
          </div>
        ) : (
          <img src="/RTPI.png" alt="RTPI" className="h-10 w-10 mx-auto" />
        )}
      </div>

      {/* Collapse/Expand Button */}
      <div className="p-2 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="w-full justify-center"
          title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft aria-hidden="true" className="h-4 w-4 mr-2" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {navGroups.map((group, groupIndex) => {
          const isGroupCollapsed = group.collapsible && collapsedGroups.has(group.label);
          const hasActiveItem = group.items.some((item) => item.path === location);

          return (
            <div key={group.label || `group-${groupIndex}`}>
              {group.label && !isCollapsed && (
                group.collapsible ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={!isGroupCollapsed}
                    aria-controls={`nav-group-${groupIndex}`}
                    className="w-full pt-4 pb-2 px-4 flex items-center justify-between rounded-md hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                  >
                    <span className={`text-xs font-semibold uppercase tracking-wider ${
                      hasActiveItem ? "text-primary" : "text-muted-foreground"
                    }`}>
                      {group.label}
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${
                        isGroupCollapsed ? "-rotate-90" : ""
                      }`}
                    />
                  </button>
                ) : (
                  <div className="pt-4 pb-2 px-4">
                    <p className={`text-xs font-semibold uppercase tracking-wider ${
                      hasActiveItem ? "text-primary" : "text-muted-foreground"
                    }`}>
                      {group.label}
                    </p>
                  </div>
                )
              )}
              {isCollapsed && group.label && (
                <div className="pt-2 pb-1 flex justify-center">
                  <div className="w-6 border-t border-border" />
                </div>
              )}
              {(!isGroupCollapsed || isCollapsed) && (
                <div id={`nav-group-${groupIndex}`}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;

                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={onClose}
                        aria-current={isActive ? "page" : undefined}
                        aria-label={isCollapsed ? item.label : undefined}
                        title={isCollapsed ? item.label : undefined}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground hover:bg-secondary"
                        } ${isCollapsed ? "justify-center" : ""}`}
                      >
                        <Icon aria-hidden="true" className="w-5 h-5 flex-shrink-0" />
                        {!isCollapsed && <span>{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {isAdmin() && (
          <>
            {!isCollapsed ? (
              <div className="pt-4 pb-2 px-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Administration
                </p>
              </div>
            ) : (
              <div className="pt-2 pb-1 flex justify-center">
                <div className="w-6 border-t border-border" />
              </div>
            )}
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={onClose}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={isCollapsed ? item.label : undefined}
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-secondary"
                  } ${isCollapsed ? "justify-center" : ""}`}
                >
                  <Icon aria-hidden="true" className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </aside>
    </>
  );
}
