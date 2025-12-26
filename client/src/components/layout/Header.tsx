import { Menu, User, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
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
    <header className="bg-background border-b border-border h-16 fixed top-0 left-0 right-0 z-10">
      <div className="h-full px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <img src="/RTPI.png" alt="RTPI" className="h-8 w-8" />
            <h1 className="text-xl font-bold text-foreground">RTPI</h1>
          </div>
          <span className="text-sm text-muted-foreground hidden sm:inline">
            Red Team Portable Infrastructure
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 mr-2">
            <span className="text-sm text-foreground">{user?.username}</span>
            <span className="text-xs text-muted-foreground capitalize bg-secondary px-2 py-1 rounded">
              {user?.role}
            </span>
          </div>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleProfile} title="Profile">
            <User className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
