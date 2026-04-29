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
  Download,
  Brain,
  Microscope,
  Radar,
  Radio,
  Gauge,
} from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  collapsible?: boolean;
}

/**
 * Sidebar navigation groups, in display order.
 *
 * Intelligence ordering (per v2.9.1): Offsec Team R&D → CTI → Frameworks → Reports.
 */
export const navGroups: NavGroup[] = [
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
      { path: "/offsec-rd", label: "OffSec Team R&D", icon: Microscope },
      { path: "/cti", label: "CTI", icon: Radar },
      { path: "/frameworks", label: "Frameworks", icon: Shield },
      { path: "/reports", label: "Reports", icon: FileText },
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

export const adminNavItems: NavItem[] = [
  { path: "/users", label: "User Management", icon: Users },
  { path: "/reporters", label: "Reporter Agents", icon: Radio },
];
