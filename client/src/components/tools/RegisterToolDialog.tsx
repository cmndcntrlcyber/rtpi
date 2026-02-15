import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";

interface RegisterToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TOOL_CATEGORIES = [
  { value: "reconnaissance", label: "Reconnaissance" },
  { value: "scanning", label: "Scanning" },
  { value: "exploitation", label: "Exploitation" },
  { value: "post-exploitation", label: "Post-Exploitation" },
  { value: "wireless", label: "Wireless" },
  { value: "web-application", label: "Web Application" },
  { value: "password-cracking", label: "Password Cracking" },
  { value: "forensics", label: "Forensics" },
  { value: "social-engineering", label: "Social Engineering" },
  { value: "reporting", label: "Reporting" },
  { value: "vulnerability", label: "Vulnerability" },
  { value: "web", label: "Web" },
  { value: "network", label: "Network" },
  { value: "fuzzing", label: "Fuzzing" },
  { value: "reverse-engineering", label: "Reverse Engineering" },
  { value: "binary-analysis", label: "Binary Analysis" },
  { value: "fingerprinting", label: "Fingerprinting" },
  { value: "cms", label: "CMS" },
  { value: "azure", label: "Azure" },
  { value: "active-directory", label: "Active Directory" },
  { value: "enumeration", label: "Enumeration" },
  { value: "c2", label: "C2" },
  { value: "proxy", label: "Proxy" },
  { value: "discovery", label: "Discovery" },
  { value: "security-scanning", label: "Security Scanning" },
  { value: "web-recon", label: "Web Recon" },
  { value: "other", label: "Other" },
];

const INSTALL_METHODS = [
  { value: "apt", label: "APT" },
  { value: "pip", label: "Pip" },
  { value: "npm", label: "NPM" },
  { value: "go-install", label: "Go Install" },
  { value: "cargo", label: "Cargo" },
  { value: "docker", label: "Docker" },
  { value: "github-binary", label: "GitHub Binary" },
  { value: "github-source", label: "GitHub Source" },
  { value: "manual", label: "Manual" },
];

const INITIAL_FORM = {
  toolId: "",
  name: "",
  version: "",
  category: "",
  description: "",
  binaryPath: "",
  installMethod: "",
  baseCommand: "",
  dockerImage: "",
  githubUrl: "",
};

export default function RegisterToolDialog({ open, onOpenChange }: RegisterToolDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(INITIAL_FORM);

  const registerMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const response = await fetch("/api/v1/tools/registry", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: data.toolId,
          name: data.name,
          version: data.version,
          category: data.category,
          description: data.description,
          binaryPath: data.binaryPath,
          installMethod: data.installMethod,
          baseCommand: data.baseCommand || data.binaryPath,
          dockerImage: data.dockerImage || "rtpi-tools",
          githubUrl: data.githubUrl || undefined,
          parameters: [],
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to register tool");
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Tool registered successfully");
      queryClient.invalidateQueries({ queryKey: ["tool-registry"] });
      setForm(INITIAL_FORM);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error("Registration failed", { description: err.message });
    },
  });

  const handleSubmit = () => {
    if (!form.toolId || !form.name || !form.category || !form.binaryPath || !form.installMethod) {
      toast.warning("Please fill in all required fields");
      return;
    }
    registerMutation.mutate(form);
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Register Tool
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reg-toolId">
                Tool ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="reg-toolId"
                placeholder="e.g. nmap"
                value={form.toolId}
                onChange={(e) => updateField("toolId", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reg-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="reg-name"
                placeholder="e.g. Nmap"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reg-category">
                Category <span className="text-red-500">*</span>
              </Label>
              <Select value={form.category} onValueChange={(v) => updateField("category", v)}>
                <SelectTrigger id="reg-category">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {TOOL_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="reg-version">Version</Label>
              <Input
                id="reg-version"
                placeholder="e.g. 7.94"
                value={form.version}
                onChange={(e) => updateField("version", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reg-description">Description</Label>
            <Textarea
              id="reg-description"
              placeholder="Brief description of the tool..."
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="reg-binaryPath">
              Binary Path <span className="text-red-500">*</span>
            </Label>
            <Input
              id="reg-binaryPath"
              placeholder="e.g. /usr/bin/nmap"
              value={form.binaryPath}
              onChange={(e) => updateField("binaryPath", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reg-installMethod">
                Install Method <span className="text-red-500">*</span>
              </Label>
              <Select value={form.installMethod} onValueChange={(v) => updateField("installMethod", v)}>
                <SelectTrigger id="reg-installMethod">
                  <SelectValue placeholder="Select method..." />
                </SelectTrigger>
                <SelectContent>
                  {INSTALL_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="reg-baseCommand">Base Command</Label>
              <Input
                id="reg-baseCommand"
                placeholder="e.g. nmap"
                value={form.baseCommand}
                onChange={(e) => updateField("baseCommand", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reg-dockerImage">Docker Image</Label>
              <Input
                id="reg-dockerImage"
                placeholder="rtpi-tools"
                value={form.dockerImage}
                onChange={(e) => updateField("dockerImage", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reg-githubUrl">GitHub URL</Label>
              <Input
                id="reg-githubUrl"
                placeholder="https://github.com/..."
                value={form.githubUrl}
                onChange={(e) => updateField("githubUrl", e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={registerMutation.isPending}>
            {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
