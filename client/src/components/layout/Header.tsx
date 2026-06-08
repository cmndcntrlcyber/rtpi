import { Menu, User, LogOut, Keyboard } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useKeyboardShortcutsContext } from "@/contexts/KeyboardShortcutsContext";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NotificationCenter } from "@/components/shared/NotificationCenter";

interface HeaderProps {
  onMenuClick: () => void;
  onSearchClick?: () => void;
}

export default function Header({ onMenuClick, onSearchClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const { setShowHelp } = useKeyboardShortcutsContext();
  const [, navigate] = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleProfile = () => {
    navigate("/profile");
  };

  return (
    <header className="bg-background border-b border-border h-[var(--header-h)] fixed top-0 left-0 right-0 z-40">
      <div className="h-full px-2 sm:px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden h-11 w-11"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
          <div className="flex items-center gap-2">
            <img src="/RTPI.png" alt="RTPI" className="h-7 w-7 sm:h-8 sm:w-8" />
            <h1 className="text-lg sm:text-xl font-bold text-foreground">RTPI</h1>
          </div>
          <span className="text-sm text-muted-foreground hidden md:inline">
            Red Team Portable Infrastructure
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <div className="hidden md:flex items-center gap-2 mr-2">
            <span className="text-sm text-foreground">{user?.username}</span>
            <span className="text-xs text-muted-foreground capitalize bg-secondary px-2 py-1 rounded">
              {user?.role}
            </span>
          </div>
          
          <Button
            variant="outline"
            className="hidden md:flex relative h-9 w-full justify-start rounded-[0.5rem] bg-background text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
            onClick={onSearchClick}
          >
            <span className="hidden lg:inline-flex">Search...</span>
            <span className="inline-flex lg:hidden">Search...</span>
            <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowHelp(true)}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            className="h-11 w-11 sm:h-10 sm:w-10"
          >
            <Keyboard className="h-5 w-5" aria-hidden="true" />
          </Button>
          <NotificationCenter />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleProfile}
            title="Profile"
            aria-label="Profile"
            className="h-11 w-11 sm:h-10 sm:w-10"
          >
            <User className="h-5 w-5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Logout"
            aria-label="Log out"
            className="h-11 w-11 sm:h-10 sm:w-10"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
}
