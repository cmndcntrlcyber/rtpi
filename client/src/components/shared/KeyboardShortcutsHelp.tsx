import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: string;
}

export default function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  const shortcuts: ShortcutItem[] = [
    // Global
    { keys: ["Ctrl", "K"], description: "Open command palette", category: "Global" },
    { keys: ["Ctrl", "B"], description: "Toggle sidebar", category: "Global" },
    { keys: ["Ctrl", "/"], description: "Show keyboard shortcuts", category: "Global" },
    { keys: ["Escape"], description: "Close modals/dialogs", category: "Global" },

    // Actions
    { keys: ["Ctrl", "N"], description: "New item (context-aware)", category: "Actions" },
    { keys: ["Ctrl", "S"], description: "Save/Submit", category: "Actions" },

    // Navigation
    { keys: ["Ctrl", "1"], description: "Go to Dashboard", category: "Navigation" },
    { keys: ["Ctrl", "2"], description: "Go to Operations", category: "Navigation" },
    { keys: ["Ctrl", "3"], description: "Go to Targets", category: "Navigation" },
  ];

  // Group shortcuts by category
  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  const formatKeys = (keys: string[]) => {
    return keys.map(key => {
      // Replace Ctrl with Cmd on Mac
      if (key === "Ctrl" && isMac) {
        return "⌘";
      }
      return key;
    }).join(isMac ? "" : "+");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {shortcuts
                  .filter((s) => s.category === category)
                  .map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/50 transition-colors"
                    >
                      <span className="text-sm text-foreground">{shortcut.description}</span>
                      <kbd className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-foreground bg-muted rounded border border-border shadow-sm">
                        {formatKeys(shortcut.keys)}
                      </kbd>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-sm text-muted-foreground">
            <strong>Tip:</strong> Most shortcuts work with{" "}
            <kbd className="px-1.5 py-0.5 text-xs bg-background rounded border">
              {isMac ? "⌘" : "Ctrl"}
            </kbd>{" "}
            on {isMac ? "macOS" : "Windows/Linux"}.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
