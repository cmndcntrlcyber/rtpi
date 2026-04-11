import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Target,
  AlertTriangle,
  Bot,
  Server,
  Wrench,
  FileText,
  Settings,
  User,
  ListTodo,
  Users,
  BarChart3,
  Package,
  Shield,
  Crown,
  Cpu,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Brain,
  Microscope,
  Radio,
  Gauge,
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
}

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  collapsible?: boolean;
}

const navGroups: NavGroup[] = [
  {
    label: "",
    items: [
      { path: "/", label: "Dashboard", icon: LayoutDashboard },
      { path: "/engagement", label: "Engagement", icon: Gauge },
    ],
  },
  {
    label: "Operations",
    collapsible: true,
    items: [
      { path: "/operations", label: "Operations", icon: ListTodo },
      { path: "/targets", label: "Targets", icon: Target },
      { path: "/vulnerabilities", label: "Vulnerabilities", icon: AlertTriangle },
      { path: "/surface-assessment", label: "Surface Assessment", icon: BarChart3 },
    ],
  },
  {
    label: "Intelligence",
    collapsible: true,
    items: [
      { path: "/frameworks", label: "Frameworks", icon: Shield },
      { path: "/reports", label: "Reports", icon: FileText },
      { path: "/offsec-rd", label: "OffSec Team R&D", icon: Microscope },
    ],
  },
  {
    label: "Automation",
    collapsible: true,
    items: [
      { path: "/agents", label: "Agents", icon: Bot },
      { path: "/empire", label: "C2 Warroom", icon: Crown },
      { path: "/implants", label: "Agentic Implants", icon: Cpu },
      { path: "/ollama", label: "Ollama AI", icon: Brain },
    ],
  },
  {
    label: "Tools",
    collapsible: true,
    items: [
      { path: "/tools", label: "Tools", icon: Wrench },
      { path: "/tool-registry", label: "Tool Registry", icon: Package },
      { path: "/tool-migration", label: "Tool Migration", icon: Download },
    ],
  },
  {
    label: "Infrastructure",
    collapsible: true,
    items: [
      { path: "/infrastructure", label: "Infrastructure", icon: Server },
    ],
  },
  {
    label: "Settings",
    collapsible: true,
    items: [
      { path: "/settings", label: "Settings", icon: Settings },
      { path: "/profile", label: "Profile", icon: User },
    ],
  },
];

const adminNavItems = [
  { path: "/users", label: "User Management", icon: Users },
  { path: "/reporters", label: "Reporter Agents", icon: Radio },
];

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
        className={`bg-background border-r border-border fixed left-0 top-16 bottom-0 overflow-y-auto z-30 transition-all duration-300
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
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
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
                <div
                  className={`pt-4 pb-2 px-4 flex items-center justify-between ${
                    group.collapsible ? "cursor-pointer hover:bg-secondary/50 rounded-md -mx-1 px-5" : ""
                  }`}
                  onClick={group.collapsible ? () => toggleGroup(group.label) : undefined}
                >
                  <p className={`text-xs font-semibold uppercase tracking-wider ${
                    hasActiveItem ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {group.label}
                  </p>
                  {group.collapsible && (
                    <ChevronDown
                      className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${
                        isGroupCollapsed ? "-rotate-90" : ""
                      }`}
                    />
                  )}
                </div>
              )}
              {isCollapsed && group.label && (
                <div className="pt-2 pb-1 flex justify-center">
                  <div className="w-6 border-t border-border" />
                </div>
              )}
              {(!isGroupCollapsed || isCollapsed) && group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-secondary"
                    } ${isCollapsed ? "justify-center" : ""}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
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
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-secondary"
                  } ${isCollapsed ? "justify-center" : ""}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
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
