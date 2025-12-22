import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";

interface CreateListenerDialogProps {
  serverId: string | null;
  onListenerCreated: () => void;
}

interface ListenerOption {
  name: string;
  description: string;
  required: boolean;
  value: string | number | boolean;
  strict: boolean;
  suggested_values?: string[];
}

interface ListenerTemplate {
  name: string;
  category: string;
  description: string;
  author: string[];
  options: Record<string, ListenerOption>;
}

export default function CreateListenerDialog({
  serverId,
  onListenerCreated,
}: CreateListenerDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingTemplates, setFetchingTemplates] = useState(false);
  const [templates, setTemplates] = useState<ListenerTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [listenerName, setListenerName] = useState("");
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Fetch available listener templates
  const fetchTemplates = async () => {
    if (!serverId) return;

    setFetchingTemplates(true);
    try {
      const response = await fetch(
        `/api/v1/empire/servers/${serverId}/listeners/templates`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
        if (data.length > 0) {
          setSelectedTemplate(data[0].name);
        }
      }
    } catch (error) {
      console.error("Failed to fetch listener templates:", error);
    } finally {
      setFetchingTemplates(false);
    }
  };

  useEffect(() => {
    if (open && serverId) {
      fetchTemplates();
    }
  }, [open, serverId]);

  // Initialize form data when template changes
  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find((t) => t.name === selectedTemplate);
      if (template) {
        const initialData: Record<string, any> = {};
        Object.entries(template.options).forEach(([key, option]) => {
          initialData[key] = option.value;
        });
        setFormData(initialData);
      }
    }
  }, [selectedTemplate, templates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverId) return;

    setLoading(true);

    try {
      const response = await fetch(
        `/api/v1/empire/servers/${serverId}/listeners`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            listenerType: selectedTemplate,
            name: listenerName,
            options: formData,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create listener");
      }

      setOpen(false);
      setListenerName("");
      setSelectedTemplate("");
      setFormData({});
      onListenerCreated();
    } catch (error: any) {
      console.error("Failed to create listener:", error);
      alert(`Failed to create listener: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const currentTemplate = templates.find((t) => t.name === selectedTemplate);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={!serverId}>
          <Plus className="h-4 w-4 mr-2" />
          Create Listener
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Empire Listener</DialogTitle>
            <DialogDescription>
              Configure a new listener to accept agent connections
            </DialogDescription>
          </DialogHeader>

          {fetchingTemplates ? (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Loading listener templates...
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="listenerType">Listener Type</Label>
                <Select
                  value={selectedTemplate}
                  onValueChange={setSelectedTemplate}
                >
                  <SelectTrigger id="listenerType">
                    <SelectValue placeholder="Select listener type" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.name} value={template.name}>
                        {template.name} ({template.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentTemplate && (
                  <p className="text-xs text-muted-foreground">
                    {currentTemplate.description}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Listener Name</Label>
                <Input
                  id="name"
                  placeholder="my-http-listener"
                  value={listenerName}
                  onChange={(e) => setListenerName(e.target.value)}
                  required
                />
              </div>

              {currentTemplate && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium mb-3">Listener Options</h4>
                    <div className="space-y-3">
                      {Object.entries(currentTemplate.options)
                        .filter(([key]) => key !== "Name")
                        .map(([key, option]) => (
                          <div key={key} className="space-y-2">
                            <Label htmlFor={key} className="flex items-center gap-2">
                              {key}
                              {option.required && (
                                <span className="text-red-500 text-xs">*</span>
                              )}
                            </Label>
                            {option.suggested_values &&
                            option.suggested_values.length > 0 ? (
                              <Select
                                value={String(formData[key] || "")}
                                onValueChange={(value) =>
                                  setFormData({ ...formData, [key]: value })
                                }
                              >
                                <SelectTrigger id={key}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {option.suggested_values.map((val) => (
                                    <SelectItem key={val} value={val}>
                                      {val}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                id={key}
                                type={
                                  typeof option.value === "number"
                                    ? "number"
                                    : "text"
                                }
                                value={formData[key] || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    [key]:
                                      typeof option.value === "number"
                                        ? parseInt(e.target.value, 10)
                                        : e.target.value,
                                  })
                                }
                                required={option.required}
                                placeholder={String(option.value)}
                              />
                            )}
                            {option.description && (
                              <p className="text-xs text-muted-foreground">
                                {option.description}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || fetchingTemplates}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Listener
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
