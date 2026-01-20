import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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
  Download,
  Brain,
  Microscope,
  ClipboardList,
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
}

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/operations", label: "Operations", icon: ListTodo },
  { path: "/operations-manager", label: "Operations Manager", icon: ClipboardList },
  { path: "/targets", label: "Targets", icon: Target },
  { path: "/vulnerabilities", label: "Vulnerabilities", icon: AlertTriangle },
  { path: "/surface-assessment", label: "Surface Assessment", icon: BarChart3 },
  { path: "/attack", label: "ATT&CK Framework", icon: Shield },
  { path: "/agents", label: "Agents", icon: Bot },
  { path: "/empire", label: "Empire C2", icon: Crown },
  { path: "/implants", label: "Agentic Implants", icon: Cpu },
  { path: "/infrastructure", label: "Infrastructure", icon: Server },
  { path: "/ollama", label: "Ollama AI", icon: Brain },
  { path: "/tools", label: "Tools", icon: Wrench },
  { path: "/tool-registry", label: "Tool Registry", icon: Package },
  { path: "/tool-migration", label: "Tool Migration", icon: Download },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/offsec-rd", label: "OffSec Team R&D", icon: Microscope },
  { path: "/settings", label: "Settings", icon: Settings },
  { path: "/profile", label: "Profile", icon: User },
];

const adminNavItems = [
  { path: "/users", label: "User Management", icon: Users },
];

export default function Sidebar({ isOpen, isCollapsed, onToggleCollapse, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { isAdmin } = useAuth();

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
        {navItems.map((item) => {
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

        {isAdmin() && (
          <>
            {!isCollapsed && (
              <div className="pt-4 pb-2 px-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Administration
                </p>
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
