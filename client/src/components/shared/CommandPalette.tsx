import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Command } from "cmdk";
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
  Brain,
  Microscope,
  ClipboardList,
  Download,
  Plus,
  Search,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import "./CommandPalette.css";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandItem {
  id: string;
  label: string;
  icon: any;
  action: () => void;
  category: string;
  keywords?: string[];
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const commands: CommandItem[] = [
    // Navigation
    { id: "nav-dashboard", label: "Dashboard", icon: LayoutDashboard, action: () => navigate("/"), category: "Navigation" },
    { id: "nav-operations", label: "Operations", icon: ListTodo, action: () => navigate("/operations"), category: "Navigation" },
    { id: "nav-operations-manager", label: "Operations Manager", icon: ClipboardList, action: () => navigate("/operations-manager"), category: "Navigation" },
    { id: "nav-targets", label: "Targets", icon: Target, action: () => navigate("/targets"), category: "Navigation" },
    { id: "nav-vulnerabilities", label: "Vulnerabilities", icon: AlertTriangle, action: () => navigate("/vulnerabilities"), category: "Navigation" },
    { id: "nav-surface-assessment", label: "Surface Assessment", icon: BarChart3, action: () => navigate("/surface-assessment"), category: "Navigation" },
    { id: "nav-attack", label: "ATT&CK Framework", icon: Shield, action: () => navigate("/attack"), category: "Navigation", keywords: ["mitre", "attack"] },
    { id: "nav-agents", label: "Agents", icon: Bot, action: () => navigate("/agents"), category: "Navigation" },
    { id: "nav-empire", label: "Empire C2", icon: Crown, action: () => navigate("/empire"), category: "Navigation", keywords: ["c2", "command", "control"] },
    { id: "nav-implants", label: "Agentic Implants", icon: Cpu, action: () => navigate("/implants"), category: "Navigation" },
    { id: "nav-infrastructure", label: "Infrastructure", icon: Server, action: () => navigate("/infrastructure"), category: "Navigation" },
    { id: "nav-ollama", label: "Ollama AI", icon: Brain, action: () => navigate("/ollama"), category: "Navigation", keywords: ["ai", "llm", "model"] },
    { id: "nav-tools", label: "Tools", icon: Wrench, action: () => navigate("/tools"), category: "Navigation" },
    { id: "nav-tool-registry", label: "Tool Registry", icon: Package, action: () => navigate("/tool-registry"), category: "Navigation" },
    { id: "nav-tool-migration", label: "Tool Migration", icon: Download, action: () => navigate("/tool-migration"), category: "Navigation" },
    { id: "nav-reports", label: "Reports", icon: FileText, action: () => navigate("/reports"), category: "Navigation" },
    { id: "nav-offsec-rd", label: "OffSec Team R&D", icon: Microscope, action: () => navigate("/offsec-rd"), category: "Navigation", keywords: ["research", "development"] },
    { id: "nav-settings", label: "Settings", icon: Settings, action: () => navigate("/settings"), category: "Navigation" },
    { id: "nav-profile", label: "Profile", icon: User, action: () => navigate("/profile"), category: "Navigation" },
    { id: "nav-users", label: "User Management", icon: Users, action: () => navigate("/users"), category: "Navigation", keywords: ["admin"] },

    // Actions
    { id: "action-new-operation", label: "New Operation", icon: Plus, action: () => { navigate("/operations"); /* TODO: Trigger form */ }, category: "Actions", keywords: ["create", "add"] },
    { id: "action-new-target", label: "New Target", icon: Plus, action: () => { navigate("/targets"); /* TODO: Trigger form */ }, category: "Actions", keywords: ["create", "add"] },
    { id: "action-new-vulnerability", label: "New Vulnerability", icon: Plus, action: () => { navigate("/vulnerabilities"); /* TODO: Trigger form */ }, category: "Actions", keywords: ["create", "add"] },
    { id: "action-search", label: "Search", icon: Search, action: () => {}, category: "Actions", keywords: ["find", "look"] },
  ];

  const handleSelect = (command: CommandItem) => {
    command.action();
    onOpenChange(false);
  };

  // Group commands by category
  const categories = Array.from(new Set(commands.map(c => c.category)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-2xl overflow-hidden">
        <Command className="rounded-lg border-0 shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              placeholder="Type a command or search..."
              value={search}
              onValueChange={setSearch}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {categories.map((category) => (
              <Command.Group key={category} heading={category} className="mb-2">
                {commands
                  .filter((cmd) => cmd.category === category)
                  .map((command) => {
                    const Icon = command.icon;
                    return (
                      <Command.Item
                        key={command.id}
                        onSelect={() => handleSelect(command)}
                        className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-secondary aria-selected:bg-secondary"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span>{command.label}</span>
                      </Command.Item>
                    );
                  })}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
