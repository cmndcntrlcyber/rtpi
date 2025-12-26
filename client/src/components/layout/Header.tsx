import { Menu, User, LogOut, Keyboard } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useKeyboardShortcutsContext } from "@/contexts/KeyboardShortcutsContext";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
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
    <header className="bg-background border-b border-border h-16 fixed top-0 left-0 right-0 z-40">
      <div className="h-full px-2 sm:px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
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
            variant="ghost"
            size="icon"
            onClick={() => setShowHelp(true)}
            title="Keyboard shortcuts (?)"
            className="h-9 w-9 sm:h-10 sm:w-10"
          >
            <Keyboard className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleProfile}
            title="Profile"
            className="h-9 w-9 sm:h-10 sm:w-10"
          >
            <User className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Logout"
            className="h-9 w-9 sm:h-10 sm:w-10"
          >
            <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
