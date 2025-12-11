import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
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
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
}

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/operations", label: "Operations", icon: ListTodo },
  { path: "/targets", label: "Targets", icon: Target },
  { path: "/vulnerabilities", label: "Vulnerabilities", icon: AlertTriangle },
  { path: "/surface-assessment", label: "Surface Assessment", icon: BarChart3 },
  { path: "/agents", label: "Agents", icon: Bot },
  { path: "/infrastructure", label: "Infrastructure", icon: Server },
  { path: "/tools", label: "Tools", icon: Wrench },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/settings", label: "Settings", icon: Settings },
  { path: "/profile", label: "Profile", icon: User },
];

const adminNavItems = [
  { path: "/users", label: "User Management", icon: Users },
];

export default function Sidebar({ isOpen }: SidebarProps) {
  const [location] = useLocation();
  const { isAdmin } = useAuth();

  if (!isOpen) return null;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 fixed left-0 top-16 bottom-0 overflow-y-auto z-10">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <img src="/RTPI.png" alt="RTPI" className="h-10 w-10" />
          <div>
            <h2 className="font-bold text-gray-900">RTPI</h2>
            <p className="text-xs text-gray-500">Red Team Platform</p>
          </div>
        </div>
      </div>
      
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          
          return (
            <Link key={item.path} href={item.path}>
              <a
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </a>
            </Link>
          );
        })}
        
        {isAdmin() && (
          <>
            <div className="pt-4 pb-2 px-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Administration
              </p>
            </div>
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              
              return (
                <Link key={item.path} href={item.path}>
                  <a
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </a>
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </aside>
  );
}
