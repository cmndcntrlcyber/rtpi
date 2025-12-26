import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useKeyboardShortcutsContext } from "@/contexts/KeyboardShortcutsContext";
import { getShortcutDisplay } from "@/hooks/useKeyboardShortcuts";
import { Keyboard } from "lucide-react";

export function KeyboardShortcutsDialog() {
  const { showHelp, setShowHelp, globalShortcuts } = useKeyboardShortcutsContext();

  // Group shortcuts by category
  const navigationShortcuts = globalShortcuts.filter((s) =>
    s.description.startsWith("Go to")
  );
  const actionShortcuts = globalShortcuts.filter(
    (s) => !s.description.startsWith("Go to") && s.key !== "Escape"
  );
  const systemShortcuts = [
    {
      key: "b",
      ctrl: true,
      meta: true,
      description: "Toggle sidebar collapse",
    },
    ...globalShortcuts.filter((s) => s.key === "Escape"),
  ];

  return (
    <Dialog open={showHelp} onOpenChange={setShowHelp}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </div>
          <DialogDescription>
            Navigate RTPI faster with these keyboard shortcuts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Navigation Shortcuts */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="text-primary">▸</span> Navigation
            </h3>
            <div className="space-y-2">
              {navigationShortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <span className="text-sm text-foreground">
                    {shortcut.description}
                  </span>
                  <kbd className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted border border-border rounded">
                    {getShortcutDisplay(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Action Shortcuts */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="text-primary">▸</span> Actions
            </h3>
            <div className="space-y-2">
              {actionShortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <span className="text-sm text-foreground">
                    {shortcut.description}
                  </span>
                  <kbd className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted border border-border rounded">
                    {getShortcutDisplay(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* System Shortcuts */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="text-primary">▸</span> System
            </h3>
            <div className="space-y-2">
              {systemShortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <span className="text-sm text-foreground">
                    {shortcut.description}
                  </span>
                  <kbd className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted border border-border rounded">
                    {getShortcutDisplay(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Footer tip */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Press <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border border-border rounded">?</kbd> anytime to view this help
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
