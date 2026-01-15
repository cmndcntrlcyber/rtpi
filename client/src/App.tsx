import { useEffect } from "react";
import { Route, Switch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { KeyboardShortcutsProvider } from "@/contexts/KeyboardShortcutsContext";
import { SearchProvider, useSearch } from "@/contexts/SearchContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";
import { initializeSessionManagement } from "@/lib/api";
import MainLayout from "@/components/layout/MainLayout";
import { KeyboardShortcutsDialog } from "@/components/shared/KeyboardShortcutsDialog";
import { SearchDialog } from "@/components/shared/SearchDialog";
import Dashboard from "@/pages/Dashboard";
import Operations from "@/pages/Operations";
import Targets from "@/pages/Targets";
import Vulnerabilities from "@/pages/Vulnerabilities";
import Agents from "@/pages/Agents";
import Infrastructure from "@/pages/Infrastructure";
import Tools from "@/pages/Tools";
import ToolRegistry from "@/pages/ToolRegistry";
import ToolMigration from "@/pages/ToolMigration";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import Users from "@/pages/Users";
import SurfaceAssessment from "@/pages/SurfaceAssessment";
import AttackFramework from "@/pages/AttackFramework";
import Empire from "@/pages/Empire";
import Implants from "@/pages/Implants";
import Ollama from "@/pages/Ollama";
import Login from "@/pages/Login";

const queryClient = new QueryClient();

function AuthenticatedApp() {
  const { setIsOpen } = useSearch();

  // Set up notification triggers
  useNotificationTriggers();

  return (
    <KeyboardShortcutsProvider onSearchOpen={() => setIsOpen(true)}>
      <MainLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/operations" component={Operations} />
          <Route path="/targets" component={Targets} />
          <Route path="/vulnerabilities" component={Vulnerabilities} />
          <Route path="/surface-assessment" component={SurfaceAssessment} />
          <Route path="/attack" component={AttackFramework} />
          <Route path="/agents" component={Agents} />
          <Route path="/empire" component={Empire} />
          <Route path="/implants" component={Implants} />
          <Route path="/infrastructure" component={Infrastructure} />
          <Route path="/ollama" component={Ollama} />
          <Route path="/tools" component={Tools} />
          <Route path="/tool-registry" component={ToolRegistry} />
          <Route path="/tool-migration" component={ToolMigration} />
          <Route path="/reports" component={Reports} />
          <Route path="/settings" component={Settings} />
          <Route path="/profile" component={Profile} />
          <Route path="/users" component={Users} />
          <Route>
            <div className="p-8">
              <h1 className="text-3xl font-bold mb-4">404 - Page Not Found</h1>
              <p className="text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist.</p>
            </div>
          </Route>
        </Switch>
      </MainLayout>
      <KeyboardShortcutsDialog />
      <SearchDialog />
    </KeyboardShortcutsProvider>
  );
}

function AppContent() {
  const { user, loading, logout } = useAuth();

  // Apply dark mode on app load
  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode");
    if (savedDarkMode === "true") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Initialize session management
  useEffect(() => {
    if (user) {
      initializeSessionManagement();
    }
  }, [user]);

  // Handle unauthorized events (session expired)
  useEffect(() => {
    // Track if logout is in progress to prevent multiple calls
    let isLoggingOut = false;

    const handleUnauthorized = () => {
      // Guard: don't trigger logout if already in progress
      if (isLoggingOut) {
        console.log("Logout already in progress, skipping duplicate logout");
        return;
      }

      isLoggingOut = true;

      toast.error("Session Expired", {
        description: "Your login session has expired. Please log in again.",
        duration: 5000,
      });

      // Execute logout and reset guard after completion
      logout().finally(() => {
        // Reset flag after a short delay to prevent rapid re-triggers
        setTimeout(() => {
          isLoggingOut = false;
        }, 1000);
      });
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
      isLoggingOut = false; // Reset on cleanup
    };
  }, [logout]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <NotificationProvider>
      <SearchProvider>
        <AuthenticatedApp />
      </SearchProvider>
    </NotificationProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
      <Toaster
        position="top-right"
        expand={false}
        richColors
        closeButton
        duration={4000}
      />
    </QueryClientProvider>
  );
}
