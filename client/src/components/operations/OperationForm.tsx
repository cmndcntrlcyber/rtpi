import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OperationFormData {
  name: string;
  description?: string;
  status: string;
  type?: string;
}

interface OperationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: OperationFormData) => void;
  initialData?: Partial<OperationFormData>;
  mode?: "create" | "edit";
}

export default function OperationForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  mode = "create",
}: OperationFormProps) {
  const [formData, setFormData] = useState<OperationFormData>({
    name: initialData?.name || "",
    description: initialData?.description || "",
    status: initialData?.status || "planning",
    type: initialData?.type || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onOpenChange(false);
    // Reset form
    setFormData({
      name: "",
      description: "",
      status: "planning",
      type: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Create New Operation" : "Edit Operation"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Set up a new red team operation"
                : "Update operation details"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Operation Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Operation Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Operation Red Dawn"
                required
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe the operation objectives and scope..."
                rows={3}
              />
            </div>

            {/* Type */}
            <div className="grid gap-2">
              <Label htmlFor="type">Operation Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Phishing">Phishing Campaign</SelectItem>
                  <SelectItem value="Network">Network Penetration</SelectItem>
                  <SelectItem value="Web">Web Application</SelectItem>
                  <SelectItem value="Physical">Physical Security</SelectItem>
                  <SelectItem value="Social">Social Engineering</SelectItem>
                  <SelectItem value="Assessment">Vulnerability Assessment</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {mode === "create" ? "Create Operation" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
