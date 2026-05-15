import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { CatalogEntry } from "@/hooks/useMcpCatalog";

interface ConfigureSecretsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: CatalogEntry | null;
  onConfigure: (serverId: string, env: Record<string, string>) => Promise<void>;
}

/**
 * v2.9.3 Phase 4 — modal for setting required secret values on a managed
 * MCP server row. Renders one masked input per `requiredSecrets` entry.
 *
 * Submit calls PATCH /:id/secrets, which merges values into the row's env
 * column without disturbing other env keys. The dialog never displays
 * existing secret values — they're stored server-side and the response
 * env is redacted to `••••<last4>` by the backend.
 */
export function ConfigureSecretsDialog({
  open,
  onOpenChange,
  entry,
  onConfigure,
}: ConfigureSecretsDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Reset form when dialog opens for a new entry
  useEffect(() => {
    if (open && entry) {
      const blank: Record<string, string> = {};
      for (const key of entry.requiredSecrets) blank[key] = "";
      setValues(blank);
    }
  }, [open, entry]);

  if (!entry) return null;

  const canSubmit = Boolean(entry.serverId)
    && entry.requiredSecrets.every((key) => values[key]?.trim().length > 0);

  async function handleSubmit() {
    if (!entry?.serverId) return;
    setSubmitting(true);
    try {
      // Trim whitespace defensively — pasted PATs often have a trailing newline.
      const sanitized: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) sanitized[k] = v.trim();
      await onConfigure(entry.serverId, sanitized);
      toast.success(`${entry.name} configured`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save secrets");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure {entry.name}</DialogTitle>
          <DialogDescription>
            Provide the API keys this MCP server needs to start. Values are
            sent via HTTPS, stored on the server row, and never echoed in
            plaintext — the UI shows only the last 4 characters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {entry.requiredSecrets.map((key) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`secret-${key}`} className="text-sm font-medium">
                {key}
              </Label>
              <Input
                id={`secret-${key}`}
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={values[key] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={`Paste ${key} value`}
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
